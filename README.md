This is a project tracking dashboard for GitHub (including GitHub Enterprise) based projects. The key capability of
Milestone.js is to support [LaunchPad](http://launchpad.net) style
[Blueprints](https://help.launchpad.net/BlueprintDocumentation) to support development of large features spanning one
or more milestones.

Milestone.js requires that certain simple conventions are followed for your GitHub project:

* Use milestones to track progress.
* Use tags to classify issues.
* Break large issues into smaller issues, and attach those smaller issues as comments. Each comment must start with the
  ID of the  related issue, followed by a ':' and some text.

See https://github.com/s3u/milestone.js/issues?labels=blueprint&page=1&state=open for an example. This shows two
blueprints, each with two sub-issues. Here is how Milestone.js will show this project.

![Example screenshot](https://raw.github.com/s3u/milestone.js/master/example/example.png)

This uses [Timeline JS](http://timeline.verite.co) to show issues organized by milestones.

This project is growing out of my personal needs at work where we use GitHub Enterprise for all activities. I welcome
any feedback.

## To Run Milestone.js

Clone this repo

    git://github.com/s3u/milestone.js.git

Install dependencies

    cd milestone.js
    npm install

Configure

    cp config.js.sample config.js

Then fill in the blanks in config.js

Run

    node app.js
