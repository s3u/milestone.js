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
    fs = require('fs'),
    hogan = require('hogan.js');

var summaryTemplate = fs.readFileSync("./views/summary.html", "utf-8");
var summary = hogan.compile(summaryTemplate);

exports.index = function (req, res) {
    var ser = req.query ? req.query.c : undefined;
    var state;
    if (ser) {
        var buffer = new Buffer(req.query.c, "base64");
        state = JSON.parse(buffer.toString());
    }
    else {
        state = util.makeState(config);
        buffer = new Buffer(JSON.stringify(state));
        ser = buffer.toString("base64");
    }

    function findMilestones(next) {
        util.multiGet([util.appendAccessToken(req, state.api + "/milestones?state=closed"),
            util.appendAccessToken(req, state.api + "/milestones")], true, function (e, milestones) {

            // Sort milestones by due_on field. The assumption here is that all milestones have due_on fields.
            // But note that due_on is optional in GitHub.
            milestones = _.sortBy(milestones, function (milestone) {
                return milestone.due_on;
            });

            var current = 0;
            var now = Date.now();
            _.each(milestones, function (milestone) {
                var d1 = new Date(Date.parse(milestone.due_on));
                // Arbitrarily assume that milestones are a month apart.
                var d0 = new Date(d1.getTime() - (30 * 24 * 3600 * 1000));
                if (now < d0) {
                    current++;
                }
            });
            next(current);
        });
    }

    function gotoIndex(current) {
        if (!state.isEnterprise) {
            // Redirect to github to get an auth token - this is to avoid default rate limits
            res.redirect("https://github.com/login/oauth/authorize?client_id=" + config.client_id + "&redirect_uri=" +
                "http://" + req.headers.host + "/oauth&state=" + ser)
        }
        else {
            res.redirect("/label/" + state.labels[0].name + "/" + current + "?c=" + ser);
        }
    }

    if (state.labels) {
        findMilestones(gotoIndex);
    }
    else {
        // Get all labels
        request.get(util.appendAccessToken(req, state.api + "/labels"), function (e, r, body) {
            state.labels = body ? JSON.parse(body) : [];
            state.labels = [""].concat(state.labels);
            findMilestones(gotoIndex);
        });
    }
}


exports.setup = function (req, res) {
    res.render("setup");
};

exports.saveSetup = function (req, res) {
    var state = util.makeState({
        name: req.body.name,
        repo: req.body.repo
    });

    var buffer = new Buffer(JSON.stringify(state));
    var ser = buffer.toString("base64");

    if (!state.isEnterprise) {
        // Redirect to github to get an auth token - this is to avoid default rate limits
        res.redirect("https://github.com/login/oauth/authorize?client_id=" + config.client_id + "&redirect_uri=" +
            "http://" + req.headers.host + "/oauth&state=" + ser)
    }
    else {
        res.redirect("/?c=" + ser);
    }
}

exports.oauth = function (req, res) {
    var code = req.query.code;
    var state = req.query.state;

    request.post({
            url: "https://github.com/login/oauth/access_token",
            json: {
                client_id: config.client_id,
                client_secret: config.client_secret,
                code: code
            }},
        function (e, r, body) {
            var buffer = new Buffer(state, "base64");
            var obj = JSON.parse(buffer.toString());
            obj.access_token = body.access_token;
            buffer = new Buffer(JSON.stringify(obj));
            state = buffer.toString("base64");

            res.redirect("/?c=" + ser);
        }
    );
}

//
// The main thing
//
exports.label = function (req, res) {
    if (!req.query || !req.query.c) {
        // Force setup
        res.redirect('/');
        return;
    }

    // Get config back
    var buffer = new Buffer(req.query.c, "base64");
    var state = JSON.parse(buffer.toString());

    var label = req.params.label;
    var currentMilestone = req.params.milestone;

    util.multiGet([util.appendAccessToken(req, state.api + "/milestones?state=closed"),
        util.appendAccessToken(req, state.api + "/milestones")], true, function (e, milestones) {

        // Sort milestones by due_on field. The assumption here is that all milestones have due_on fields.
        // But note that due_on is optional in GitHub.
        milestones = _.sortBy(milestones, function (milestone) {
            return milestone.due_on;
        });

        var dates = [];
        var startAtSlide = 0;
        var now = Date.now();
        _.each(milestones, function (milestone, index) {
            var d1 = new Date(Date.parse(milestone.due_on));
            // Arbitrarily assume that milestones are a month apart.
            var d0 = new Date(d1.getTime() - (30 * 24 * 3600 * 1000));

            if(milestone.number === parseInt(currentMilestone)) {
                startAtSlide = index;
            }

            // Add human friendly date
            milestone.due_date = d1.toDateString();
            milestone.open = 100 * milestone.open_issues / (milestone.closed_issues + milestone.open_issues);
            milestone.closed = 100 - milestone.open;
            var media = summary.render({
                milestone: milestone
            })

            dates.push({
                "startDate": d0.getFullYear() + "," + (d0.getMonth() + 1) + "," + d0.getDate(),
                "endDate": d1.getFullYear() + "," + (d1.getMonth() + 1) + "," + d1.getDate(),
                "headline": "<a href='" + state.web + "/issues?milestone=" + milestone.number + "'>" + milestone.title + "</a>" + media,
                "href": "http://" + req.headers.host + "/issues/" + label + "/" + milestone.number + "?c=" + req.query.c,
            })
        });
        var timeline = {
            "timeline": {
                "type": "default",
                "startDate": "2012",
                "date": dates
            }
        }

        var nav = [
            {
                "name" : "Home",
                "href" : (req && req.query.c) ? "/?c=" + req.query.c : "/",
                "class" : "icon-home"
            },
            {
                "name" : "Setup",
                "href" : "/setup",
                "class" : "icon-wrench"
            },
            {
                "name" : "Fork",
                "href" : "https://github.com/s3u/milestone.js",
                "class" : "icon-circle-arrow-right"
            }
        ];
        res.render('index', {
            req: req,
            state: state,
            labels: state.labels,
            label: req.params.label,
            startAtSlide: startAtSlide,
            source: JSON.stringify(timeline, null, '\t'),
            nav: nav,
            timeline: timeline
        });

    });
}

exports.issues = function (req, res) {
    if (!req.query || !req.query.c) {
        // Force setup
        res.redirect('/');
        return;
    }

    // Get config back
    var buffer = new Buffer(req.query.c, "base64");
    var state = JSON.parse(buffer.toString());

    var label = req.params.label;
    var currentMilestone = req.params.milestone;

    // Get all open and closed issues for the current milestone as well as all unassigned ones
    util.multiGet([util.appendAccessToken(req, state.api + "/issues?milestone=" +
            currentMilestone + "&labels=" + label + "&state=closed"),
        util.appendAccessToken(req, state.api + "/issues?milestone=" +
            currentMilestone + "&labels=" + label),
        util.appendAccessToken(req, state.api + "/issues?milestone=none&" +
            "labels=" + label)], true, function (e, issues) {

        issues = _.sortBy(issues, function (issue) {
            if (issue.milestone) {
                return issue.milestone.due_on;
            }
            else if (issue.closed_at) {
                // Interpolate to the nearest milestone
                _.each(milestones, function (milestone) {
                    if (issue.closed_at < milestone.due_on) {
                        issue.milestone = milestone
                    }
                })

            }
            if(issue.milestone) {
                return issue.milestone.due_on;
            }
            else {
                issue.unassigned = true;
                return undefined;
            }
        });

        // Get related issues. Related issues are comments starting with 'id:'
        var urls = [];
        _.each(issues, function (issue) {
            urls.push(util.appendAccessToken(req, issue.url + "/comments"));
        });

        util.multiGet(urls, false, function (e, arr) {
            _.each(issues, function (issue, index) {
                if(issue.assignee) {
                    issue.assignee.href = state.web + "/" + issue.assignee.login;
                }
                if(issues.milestone) {
                    issue.milestone.href = state.web + "/issues?milestone=" + issue.milestone.number
                }
                if (arr[index]) {
                    var commentsArr = arr[index];
                    issue.tasks = [];
                    _.each(commentsArr, function (comment) {
                        if (comment.body) {
                            var index = comment.body.indexOf(':');
                            var ref = comment.body.substring(1, comment.body.indexOf(':') === -1 ?
                                comment.body.length : comment.body.indexOf(':'));
                            if (util.isNumber(ref)) {
                                issue.tasks.push({
                                    id: ref,
                                    title: comment.body.substring(index + 1),
                                    url: state.api + "/issues/" + ref,
                                    html_url: state.repo + "/issues/" + ref
                                });
                            }
                        }
                    });
                }
            })

            res.writeHead(200, {
                "Content-Type": "application/json"
            });
            res.end(JSON.stringify(issues));
        })
    });
}
