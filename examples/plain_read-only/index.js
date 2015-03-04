// get required modules
var express = require('express')
  , http = require('http')
  , path = require('path')
  , formatters = require('../../lib/util/formatters')
  , Commander = require('../..').Commander
;

// app constants
const DEFAULT_PORT    = 8080
  ,   STATIC_DOTFILES = 'allow'
  ,   STATIC_PATH     = 'public'
  ,   VIEWS_PATH      = 'views'
  ,   APP_ROUTE       = '*'
;

// app variables
// ... express app
var app = express();
// ... http server
var server = http.createServer(app);
// ... file commander app - public - read-only settings
var commander = new Commander({
  publicFiles : path.join(__dirname, STATIC_PATH),
  dotfiles    : STATIC_DOTFILES,
  mount       : '/'
});

// -------------------------------------------------------------------
// APP CONFIGURATION
// -------------------------------------------------------------------

exports.configure = function(logger) {
  // render engine setup
  app.set('views', path.join(__dirname, VIEWS_PATH));
  app.set('view engine', 'jade');

  // logging
  app.use(logger);

  // ------------------
  // use file commander
  // ------------------
  app.use(commander.serverBased());
  // process file commander result
  app.route(APP_ROUTE)
  .get(
    validateCommanderMiddleware,
    renderMiddleware
  );
  // not found middleware sub-stack
  app.route(APP_ROUTE)
  .all(
    notFoundMiddleware
  );
}

// -------------------------------------------------------------------
// CUSTOM MIDDLEWARE DEFINITIONS
// -------------------------------------------------------------------

// renders response of the file-commander
function renderMiddleware(req, res, next) {
  res.locals.appkey = {
    app: {
      path      : req.fcmder.fs.path.name,
      files     : req.fcmder.fs.files,
      parentPath: path.dirname(req.fcmder.fs.path.name)
    },
    req: {
      path: decodeURIComponent(req.path)
    },
    fn: {
      meta2kind : formatters.meta2kind,
      meta2size : formatters.meta2size
    }
  };
  res.render('index.jade');
}

// check result of a processing of the commander app
function validateCommanderMiddleware(req, res, next) {
  if (!req.fcmder) {
    next('route');
    return;
  }
  next();
}

// renders 404 page
function notFoundMiddleware(req, res, next) {
  res.status(404).send('Not found - 404');
}

// -------------------------------------------------------------------
// APP START
// -------------------------------------------------------------------

exports.listen = function(port, callback) {
  server.listen((port && typeof port === 'number') ? port : DEFAULT_PORT, function() {
    if (typeof callback === 'function') {
      callback(server.address().port);
    } else {
      console.log('listening on port %s', server.address().port);
    }
  });
}

// -------------------------------------------------------------------
// APP STOP
// -------------------------------------------------------------------

exports.close = function(callback) {
  if (typeof callback !== 'function') {
    console.log('closing port %s ...', server.address().port);
  }
  server.close(callback);
}
