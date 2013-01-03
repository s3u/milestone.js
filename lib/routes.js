/**
 Copyright (c) 2012 Subbu Allamaraju

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */

var request = require("request"),
    _ = require("underscore"),
    url = require("url"),
    util = require('./util.js'),
    config = require("../config.js"),
    async = require("async");

exports.index = function(req, res) {
    // If the config is not present in the URI, load it from config module
    if(req.query && req.query.c) {
        var buffer = new Buffer(req.query.c, "base64");
        _.each(JSON.parse(buffer.toString()), function(value, key) {
            req.query[key] = value;
        });
        res.redirect("/label?c=" + req.query.c);
    }
    else {
        var state = util.makeState(config.name, config.repo);
        buffer = new Buffer(JSON.stringify(state));
        var ser = buffer.toString("base64");

        if(!state.isEnterprise) {
            // Redirect to github to get an auth token - this is to avoid default rate limits
            res.redirect("https://github.com/login/oauth/authorize?client_id=" + config.client_id + "&redirect_uri=" +
                "http://" + req.headers.host + "/oauth&state=" + ser)
        }
        else {
            res.redirect("/label?c=" + ser);
        }
    }
}


exports.setup = function (req, res) {
    res.render('setup', {
        title: 'Setup'
    });

};

exports.saveSetup = function(req, res) {
    var repo = req.body.repo;

    var state = util.makeState(req.body.name, req.body.repo);

    var buffer = new Buffer(JSON.stringify(state));
    var ser = buffer.toString("base64");

    if(!state.isEnterprise) {
        // Redirect to github to get an auth token - this is to avoid default rate limits
        res.redirect("https://github.com/login/oauth/authorize?client_id=" + config.client_id + "&redirect_uri=" +
            "http://" + req.headers.host + "/oauth&state=" + ser)
    }
    else {
        res.redirect("/label?c=" + ser);
    }
}

exports.oauth = function(req, res) {
    var code = req.query.code;
    var state = req.query.state;

    request.post({
            url: "https://github.com/login/oauth/access_token",
            json: {
                client_id: config.client_id,
                client_secret: config.client_secret,
                code: code
            }},
        function(e, r, body) {
            var buffer = new Buffer(state, "base64");
            var obj = JSON.parse(buffer.toString());
            obj.access_token = body.access_token;
            buffer = new Buffer(JSON.stringify(obj));
            state = buffer.toString("base64");

            res.redirect("/?c=" + state);
        }
    );
}

exports.label = function(req, res) {
    if(!req.query || !req.query.c) {
        // Force setup
        res.redirect('/');
        return;
    }

    // Get config back
    var buffer = new Buffer(req.query.c, "base64");
    _.each(JSON.parse(buffer.toString()), function(value, key) {
        req.query[key] = value;
    })

    var label = req.params.label || "";

    // Get all labels
    request.get(util.appendAccessToken(req, req.query.api + "/labels"), function(e, r, body) {
        var labels = body ? JSON.parse(body) : [];

        // Get all open and closed issues for the current label
        util.multiGet([util.appendAccessToken(req, req.query.api + "/issues?labels=" + label + "&state=closed"),
            util.appendAccessToken(req, req.query.api + "/issues?labels=" + label)], true, function(e, issues) {

            util.multiGet([util.appendAccessToken(req, req.query.api + "/milestones?state=closed"),
                util.appendAccessToken(req, req.query.api + "/milestones")], true, function(e, milestones) {
                var dates = [];
                _.each(milestones, function(milestone) {
                    var d1 = new Date(Date.parse(milestone.due_on));
                    var d0 = new Date(d1);
                    d0.setMonth(d0.getMonth() - 1);
                    dates.push({
                        "startDate": d0.getFullYear() + "," + (d0.getMonth() + 1) + "," + d0.getDate(),
                        "endDate": d1.getFullYear() + "," + (d1.getMonth() + 1) + "," + d1.getDate(),
                        "headline": milestone.title,
                        "asset": {
                            "caption": milestone.description || ""
                        }
                    })
                });
                var timeline = {
                    "timeline": {
                        "type": "default",
                        "startDate" : "2012",
                        "date": dates
                    }
                }

                issues = _.sortBy(issues, function(issue) {
                    if(issue.milestone) {
                        return issue.milestone.due_on;
                    }
                    else if(issue.closed_at) {
                        // Interpolate to the nearest milestone
                        _.each(milestones, function(milestone) {
                            if(issue.closed_at < milestone.due_on) {
                                issue.milestone = milestone
                            }
                        })
                    }
                    else {
                        return undefined;
                    }
                });

                // Get related issues. Related issues are comments starting with 'id:'
                var urls = [];
                _.each(issues, function(issue) {
                    urls.push(util.appendAccessToken(req, issue.url + "/comments"));
                });

                util.multiGet(urls, false, function(e, arr) {
                    _.each(issues, function(issue, index) {
                        if(arr[index]) {
                            var commentsArr = arr[index];
                            issue.tasks = [];
                            _.each(commentsArr, function(comment) {
                                if(comment.body) {
                                    var ref = comment.body.substring(1, comment.body.indexOf(':') === -1 ?
                                        comment.body.length : comment.body.indexOf(':'));
                                    if(util.isNumber(ref)) {
                                        issue.tasks.push({
                                            id: ref,
                                            url: req.query.api + "/issues/" + ref,
                                            html_url: req.query.web + "/issues/" + ref
                                        });
                                    }
                                }
                            });
                        }
                    })
                    res.render('index', {
                        req: req,
                        labels: labels,
                        title: req.query.name,
                        issues: issues,
                        timeline: timeline
                    });
                })
            });
        });
    });
}

