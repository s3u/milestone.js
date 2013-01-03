/*
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

var url = require('url'),
    _ = require('underscore'),
    async = require('async'),
    request = require("request");

exports.makeState = function(name, repo) {
    var parsed = url.parse(repo);
    var state = {
        name: name
    }
    var isEnterprise = true;

    // Detect API URL
    // Examples:
    //      https://github.com/mojombo/jekyll
    //          -> https://github.com/api/v3/repos/mojombo/jekyll
    //      https://github.scm.corp.ebay.com/OpenStratus/docs
    //          ->  https://github.scm.corp.ebay.com/api/v3/repos/OpenStratus/docs
    if (parsed.host.indexOf("github.com") > -1) {
        state.api = parsed.protocol + "//api.github.com/repos" + parsed.pathname;
        state.host = parsed.protocol + "//api.github.com/";
        state.web = parsed.protocol + "//github.com";
        state.repo = repo;
        state.isEnterprise = false;
    }
    else {
        state.api = parsed.protocol + "//" + parsed.host + "/api/v3/repos" + parsed.pathname;
        state.host = parsed.protocol + "//" + parsed.host + "/api/v3/"
        state.web = parsed.protocol + "//" + parsed.host;
        state.repo = repo;
        state.isEnterprise = true;
    }
    if (state.api.charAt(state.api.length - 1) === '/') {
        state.api = state.api.substring(0, state.api.length - 1);
    }
    return state;
}

exports.appendAccessToken = function(req, uri) {
    if(req.query.access_token) {
        var parsed = url.parse(uri, true);
        parsed.query.access_token = req.query.access_token;
        return url.format(parsed);
    }
    else {
        return uri;
    }
}

exports.isNumber = function(n) {
    return ! isNaN (n-0) && n != null;
}

exports.multiGet = function(urls, merge, callback) {
    var requests = [];
    _.each(urls, function(url) {
        requests.push(function(u) {
            return function(callback) {
                request.get(u, function(e, r, body) {
                    if(e) {
                        callback(e);
                    }
                    else {
                        callback(undefined, JSON.parse(body));
                    }
                })
            }
        }(url));
    });

    // Merge results on a best effort basis - i.e. no failures unless all fail
    var results = []
    var errors = [];
    async.parallel(requests, function(e, arr) {
        if(e) {
            errors.push(e);
        }
        if(merge) {
            if(arr) {
                _.each(arr, function(result) {
                    results = results.concat(result);
                });
            }
        }
        else {
            results = arr;
        }
        callback.call(undefined, errors, results)
    });
}