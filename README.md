FileCommander
==============

FileCommander is [Express](http://expressjs.com/)-compatible file manager middleware for [Node.js](http://nodejs.org/).

Supported platforms
-------------------
All platforms supported by Node.js with Linux-like file system path format. MS Windows support will be added soon.
Please note, that the application was tested on Mac OS X 10.9 and Linux Ubuntu 12.04 only.

Install
-------
    $ npm install file-commander

Run tests
---------
Go to the root directory of the `file-commander` module, make sure dependencies are installed and run the tests.

    $ cd node_modules/file-commander
    $ npm install
    $ npm test

Simple examples
---------------
There are four simple examples of `file-commander` middleware usage. Each of the examples implements separate part of the interface, that is read-only or read-write access with html or rest interface.

Run example with read-only access with html interface like this:

    $ cd examples/plain_read-only
    $ node server.js

Demo application
----------------
This example uses all the parts of the `file-commander` interface. You may see it running on [file-commander.com](http://file-commander.com).

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

Public interface
----------------

### Commander class
The `Commander` class is an entry point to the `file-commander` module. Create instance of the class, call `serverBased` or `restBased` method on the created instance and it returns a middleware. There are two base settings - read-only (GET method only provided) and read-write (GET, POST and DELETE methods provided). See [examples](https://github.com/okramolis/file-commander/tree/master/examples) for details.

### Request body properties used by the `file-commander` middleware:
__Body__
* `name` - new name (optional)
* `local` - path to source (optional)
* `force` - not empty string => true (optional)
* `preserve` - not empty string => true (optional)

### Output of the `serverBased` middleware:
The result is stored in the request object using `fcmder` property. If the `fcmder` property is falsy, then the middleware was not able to serve the request, usually because the resources had not been found. Request-response cycle is not finished (no response sent).

__GET request__
* `req.fcmder.fs.path.name` - current path
* `req.fcmder.fs.files.names` - array of file names contained in the current directory
* `req.fcmder.fs.files.stats` - stats for the each file in a form of an object using file names as keys

__POST or DELETE request__
* `req.fcmder.state.code` - proposed http status code
* `req.fcmder.state.err` - error flag
* `req.fcmder.state.msg` - short message
* `req.fcmder.state.desc` - detail description of current state (may be an error message if an error occurred or an object otherwise)
* `req.fcmder.state.desc.loc` - proposed value to be set as http location header field (supplied for 201 statuses only)

### Built-in REST API (`restBased` middleware):
Accessible via url prefix `/rest-api`. Finishes request-response cycle if possible (resources found). See [examples](https://github.com/okramolis/file-commander/tree/master/examples) for details.

### Read directory
__GET request__
* `url` - `"/path/to/directory"`

### Make default directory
__POST request__
* `url` - `"/path/to/parent/directory"`
* `body` - empty

### Make named directory
__POST request__
* `url` - `"/path/to/parent/directory"`
* `body` - `{ name: "my_new_directory" }`

### Move
__POST request__
* `url` - `"/path/to/destination/directory"`
* `body` - `{ local: "/path/to/resources/to/be/moved" }`

### Move and rename
__POST request__
* `url` - `"/path/to/destination/directory"`
* `body` - `{ name: "my_moved_resources", local: "/path/to/resources/to/be/moved" }`

### Copy
__POST request__
* `url` - `"/path/to/destination/directory"`
* `body` - `{ preserve: "preserve", local: "/path/to/resources/to/be/copied" }`

### Copy and rename
__POST request__
* `url` - `"/path/to/destination/directory"`
* `body` - `{ name: "my_copied_resources", preserve: "preserve", local: "/path/to/resources/to/be/copied" }`

### Delete
__DELETE request__
* `url` - `"/path/to/file/or/empty/directory/to/be/removed"`
* `body` - empty

### Force delete
__DELETE request__
* `url` - `"/path/to/resorces/to/be/removed"`
* `body` - `{ force: "force" }`

### Upload
* `url` - `"/path/to/destination/directory"`
* `encoding` - `multipart/form-data`
