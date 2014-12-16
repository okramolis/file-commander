FileCommander
==============

FileCommander is [Express](http://expressjs.com/)-compatible file manager middleware for [Node.js](http://nodejs.org/).

Install
-------
    $ npm install file-commander

Supported platforms
-------------------
All platforms supported by Node.js with Linux-like file system path format. MS Windows support will be added soon.
Please note, that the application was tested on Mac OS X 10.9 and Linux Ubuntu 12.04 only.

Example
-------
Currently there is only full demo application. You may see it running on [file-commander.com](http://file-commander.com).

To install the application go to root directory of the `file-commander` installation and do:

    $ cd examples/full
    $ npm install

Run the application using default configuration like this (see [default.json](https://github.com/okramolis/file-commander/blob/master/examples/full/config/default.json) file):

    $ node index.js

To run the application using production configuration update [production.json](https://github.com/okramolis/file-commander/blob/master/examples/full/config/production.json) file with settings for your database and authentication strategies and run the application like this:

    $ NODE_ENV=production node index.js

### Authentication
For default configuration, there are two default users for testing purposes. You may log in as `"test"` or `"user"` with password the same as the user name. There is no support for registration of new users.

For production usage, [Google](https://github.com/jaredhanson/passport-google-oauth) and [GitHub](https://github.com/jaredhanson/passport-github) authentication strategies based on [Passport](https://github.com/jaredhanson/passport) are supported.
