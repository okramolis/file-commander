// get required modules
var express = require('express')
  , http = require('http')
  , path = require('path')
  , bodyParser = require('body-parser')
  , methodOverride = require('method-override')
  , backend = require('../../lib/util/backend')
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

// get app
// ... express app
var app = express();
// ... http server
var server = http.createServer(app);
// ... file commander app - private - read/write settings
var commander = new Commander({
  authorize : authorizeOwnerMiddleware,
  dotfiles  : STATIC_DOTFILES,
  mount     : '/'
});

// -------------------------------------------------------------------
// APP CONFIGURATION
// -------------------------------------------------------------------

exports.configure = function(logger) {
  // render engine setup
  app.set('views', path.join(__dirname, VIEWS_PATH));
  app.set('view engine', 'jade');

  // middleware configuration
  // -----------------------------------------------------------------
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // HTTP POST method overriding
  app.use(methodOverride(backend.overrideBodyMethod));

  // logging
  app.use(logger);

  // ------------------
  // use file commander
  // ------------------
  app.use(commander.serverBased());
  // process file commander result
  app.route(APP_ROUTE)
  .all(
    validateCommanderMiddleware
  )
  .get(
    renderPlainAppMiddleware
  )
  .post(
    renderPlainAppMsgMiddleware
  )
  .delete(
    renderPlainAppMsgMiddleware
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

// renders plain app response
function renderPlainAppMiddleware(req, res, next) {
  res.locals = {
    appkey: {
      app: {
        path        : req.fcmder.fs.path.name,
        files       : req.fcmder.fs.files,
        parentPath  : path.dirname(req.fcmder.fs.path.name)
      },
      req : {
        path: decodeURIComponent(req.path)
      },
      fn: {
        meta2kind : formatters.meta2kind,
        meta2size : formatters.meta2size
      }
    }
  };
  res.render('index.jade');
}

// renders plain app response for post or delete method
function renderPlainAppMsgMiddleware(req, res, next) {
  var state = req.fcmder.state;
  if (!state || !state.code) {
    next({
      msg : 'Internal server error.',
      desc: 'Invalid state format.'
    });
    return;
  }
  res.locals = {
    appkey: {
      app: {
        state   : state,
        redirect: backend.getRedirectBackAddress(req)
      }
    }
  };
  res.status(state.code);
  if (state.code === 201 && state.desc && state.desc.loc) {
    res.location(state.desc.loc);
  }
  res.render('msg.jade');
}

// supplies absolute path to private directory to be managed by file-commander midleware
function authorizeOwnerMiddleware(req, res, next) {
  Commander.setRequestPrivateDir(req, path.join(__dirname, STATIC_PATH));
  next();
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

