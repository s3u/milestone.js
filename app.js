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

var express = require('express'),
    http = require('http'),
    path = require('path'),
    HoganTemplateRenderer = require('hogan-template-compiler'),
    routes = require('./lib/routes.js'),
    config = require('./config.js');

process.on('uncaughtException', function(err) {
    console.log(err);
});

var app = express();

app.use(express.bodyParser());

app.configure(function () {
    app.set('port', process.env.PORT || 3000);
    app.set('view engine', 'html')
    app.set('layout', 'layout')
    app.engine('html', require('hogan-express'));

    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')), {
        maxAge: 86400
    });
});

app.configure('development', function () {
    app.use(express.errorHandler());
});

app.get('/', routes.index);
app.get('/setup', routes.setup);
app.post('/setup', routes.saveSetup);
app.get('/label/:label/:milestone', routes.label);
app.get('/label', routes.label);
app.get('/oauth', routes.oauth);
app.get('/issues/:label/:milestone', routes.issues);

app.get("/templates.js",  function(req, res) {
    var hoganTemplateRenderer = HoganTemplateRenderer({
        partialsDirectory: __dirname + "/public/templates"
    })
    res.contentType("application/javascript");
    res.send(hoganTemplateRenderer.getSharedTemplates());
});


http.createServer(app).listen(app.get('port'), function () {
    console.log("Express server listening on port " + app.get('port'));
});
