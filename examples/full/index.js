var path = require('path');

const STATIC_PATH               = path.sep + 'static'
  ,   PRIVATE_PATH              = path.sep + 'homes'
  ,   PUBLIC_APP_URL_MOUNT      = '/public'
  ,   PRIVATE_APP_URL_MOUNT     = '/files'
  ,   DEFAULT_PORT              = 8888
  ,   STATIC_SETTINGS           = {
        dotfiles: 'allow'
      }
  ,   VIEWS_PATH                = path.sep + 'views'
  ,   HTML5_VIEWS_MOUNT         = 'html5' + path.sep
  ,   HTML4_VIEWS_MOUNT         = 'html4' + path.sep
  ,   PLAIN_APP_URL_MOUNT       = '/plain-app'
  ,   PLAIN_APP_VIEWS_MOUNT     = 'apps' + path.sep + 'plain' + path.sep
  ,   MAIN_APP_VIEWS_MOUNT      = 'apps' + path.sep + 'main' + path.sep
  ,   COMMON_VIEWS_MOUNT        = 'common' + path.sep
  ,   USER_VIEWS_MOUNT          = COMMON_VIEWS_MOUNT + 'user' + path.sep
  ,   LOGIN_ROUTE               = '/login'
  ,   LOGOUT_ROUTE              = '/logout'
  ,   HOME_ROUTE                = '/home'
  ,   ROOT_ROUTE                = '/'
  ,   LOGOUT_REDIR_ROUTE        = LOGIN_ROUTE
  ,   NG_APP_NAME               = 'fcmderApp'
  ,   NG_UPLOAD_BYTES_LIMIT_KEY = 'FCMDER_UPLOAD_BYTES_LIMIT'
  ,   NG_UPLOAD_TYPES_KEY       = 'FCMDER_UPLOAD_TYPES'
  ,   NG_PREVIEW_PLAIN_BYTES_LIMIT_KEY  = 'FCMDER_PREVIEW_PLAIN_BYTES_LIMIT'
  ,   NG_PREVIEW_CODE_BYTES_LIMIT_KEY   = 'FCMDER_PREVIEW_CODE_BYTES_LIMIT'
  ,   MEGA_BYTE                 = Math.pow(2,20)
  ,   USER_MODEL_NAME           = 'user'
      // TODO read html5 support from external file
  ,   HTML5_SUPPORT             = {
        "IE"                : {major: 11, minor: 0}
      , "Firefox"           : {major: 24, minor: 0}
      , "Chrome"            : {major: 24, minor: 0}
      , "Safari"            : {major: 7 , minor: 0}
      , "Opera"             : {major: 15, minor: 0}
      , "Mobile Safari"     : {major: 7 , minor: 0}
      , "Android"           : {major: 4 , minor: 4}
      , "Opera Mobile"      : {major: 24, minor: 0}
      , "BlackBerry WebKit" : {major: 10, minor: 0}
      , "BlackBerry"        : {major: 10, minor: 0}
      , "Chrome Mobile"     : {major: 38, minor: 0}
      , "Chrome Mobile iOS" : {major: 38, minor: 0}
      , "Firefox Mobile"    : {major: 32, minor: 0}
      , "IE Mobile"         : {major: 10, minor: 0}
      , "UC Browser"        : {major: 9 , minor: 9}
      }
  ,   PUBLIC_APP_ROUTE_EXP        = new RegExp('^' + PUBLIC_APP_URL_MOUNT)
  ,   PRIVATE_APP_ROUTE_EXP       = new RegExp('^' + PRIVATE_APP_URL_MOUNT)
  ,   PUBLIC_PLAIN_APP_ROUTE_EXP  = new RegExp('^' + PUBLIC_APP_URL_MOUNT + PLAIN_APP_URL_MOUNT)
  ,   PRIVATE_PLAIN_APP_ROUTE_EXP = new RegExp('^' + PRIVATE_APP_URL_MOUNT + PLAIN_APP_URL_MOUNT)
;

// get required modules
var express = require('express')
  , bodyParser = require('body-parser')
  , methodOverride = require('method-override')
  , cookieParser = require('cookie-parser')
  , expressSession = require('express-session')
  , logger = require('morgan')
  , fs = require('fs')
  , useragent = require('useragent')
  , config = require('config')
  , _ = require('underscore')
  , redisTest = require('./lib/redis-test')
  , Commander = require('../..').Commander
;

// get configurations
var appConfig = config.get('app')
  , dbConfig  = config.get('db')
  , clientConfig  = config.get('client')
;

var dbio = require('./lib/dbio/' + dbConfig.type)
  , authmod = require('./lib/auth')
;

// initialize constants
const PORT                = appConfig.net.port
      // TODO share supported mime types with file commander
  ,   UPLOAD_BYTES_LIMIT  = appConfig.upload.bytesPerReqLimit
  ,   UPLOAD_TYPES_STR    = appConfig.mimes.join()
  ,   LONG_RUNNING_TASK_MS= appConfig.timers.longRunningTask
  ,   MSG_PAGE_TIMEOUT_S  = appConfig.timers.msgPageTimeout
  ,   NG_PREVIEW_PLAIN_BYTES_LIMIT = clientConfig.preview.limits.textPlainBytes
  ,   NG_PREVIEW_CODE_BYTES_LIMIT  = clientConfig.preview.limits.syntaxHlBytes
;

// get app
// ... express app
var app = express();
// ... file commander app - public - read-only settings
var publicApp = new Commander({
  publicFiles : __dirname + STATIC_PATH,
  dotfiles    : STATIC_SETTINGS.dotfiles,
  mount       : PUBLIC_APP_URL_MOUNT
});
// ... file commander app - private - read/write settings
var privateApp = new Commander({
  authorize   : authorizeOwnerMiddleware,
  dotfiles    : STATIC_SETTINGS.dotfiles,
  mount       : PRIVATE_APP_URL_MOUNT
});

// make sure redis server is running and ready
redisTest.ready(startApp);

// create session store
var RedisStore = require('connect-redis')(expressSession);

// create connection to a database specified in the app configuration
var db = new dbio.Connection(dbConfig.settings);
// create authentication manager
var auth = authmod.configure({
  db: db,
  model: USER_MODEL_NAME
});
// create authentication strategies
var strategies = {}
  , stratConfig = appConfig.auth.strategies
  , stratLocals = {links: []}
;
if (!!stratConfig && !Array.isArray(stratConfig)) {
  throw new Error('file-commander: invalid configuration - authentication strategies must be an array.');
}

stratConfig.forEach(function(strategy) {
  var name = strategy.name
    , Auth = require('./lib/auth/' + name).Auth
  ;
  // set strategies locals data
  if (name === 'local') {
    stratLocals.local = {
      postRoute : strategy.postRoute,
      fields    : {
        username: strategy.fields.username,
        password: strategy.fields.password
      }
    }
  } else {
    stratLocals.links.push({
      sendRoute : strategy.sendRoute,
      nice      : strategy.nice,
      name      : name
    });
  }
  // create strategies instances
  strategies[name] = new Auth(
    _.extend({
      manager : auth,
      db      : db,
      model   : USER_MODEL_NAME
    }, strategy)
  );
});

// store auth locals config in app object
app.set('authLocals', stratLocals);

// -------------------------------------------------------------------
// APP CONFIGURATION
// -------------------------------------------------------------------

// attributes configuration
// -------------------------------------------------------------------
app.locals = {
  CONSTS: {
    COMMANDER: {
      LOGIN_ROUTE           : LOGIN_ROUTE,
      LOGOUT_ROUTE          : LOGOUT_ROUTE,
      HOME_ROUTE            : HOME_ROUTE,
      PUBLIC_APP_URL_MOUNT  : PUBLIC_APP_URL_MOUNT,
      PRIVATE_APP_URL_MOUNT : PRIVATE_APP_URL_MOUNT,
      PLAIN_APP_URL_MOUNT   : PLAIN_APP_URL_MOUNT
    }
  }
};

// render engine setup
app.set('views', path.join(__dirname, VIEWS_PATH));
app.set('view engine', 'jade');


// middleware configuration
// -------------------------------------------------------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// HTTP POST method overriding
app.use(methodOverride(overrideBodyMethod));

// logging
app.use(logger('dev'));

// serving public files
app.use(express.static(__dirname + STATIC_PATH, STATIC_SETTINGS));

// session support
app.use(cookieParser());
app.use(expressSession({
  store: new RedisStore(),
  secret: appConfig.session.secret,
  resave: true,
  saveUninitialized: true
}));
// authentication support
app.use(auth.initialize());
app.use(auth.session());

// preprocess middleware
app.use(reqInitMiddleware);

// application home page
app.get(
  ROOT_ROUTE,
  userAgentInitMiddleware,
  resInitMiddleware,
  viewsInitMiddleware,
  getViewMiddleware(COMMON_VIEWS_MOUNT + 'index.jade'),
  renderRootMiddleware
);

// application login page
app.get(
  LOGIN_ROUTE,
  ensureUnauthenticated,
  userAgentInitMiddleware,
  resInitMiddleware,
  viewsInitMiddleware,
  getViewMiddleware(USER_VIEWS_MOUNT + 'login.jade'),
  renderLoginMiddleware
);

// application logout handler
app.get(LOGOUT_ROUTE, redirLogoutMiddleware);

// application user home page
app.get(
  HOME_ROUTE,
  ensureAuthenticated,
  userAgentInitMiddleware,
  resInitMiddleware,
  viewsInitMiddleware,
  getViewMiddleware(USER_VIEWS_MOUNT + 'account.jade'),
  renderHomeMiddleware
);

// authentication routers
for (var key in strategies) {
  app.use(strategies[key].router());
}

// --------------------------------------
// use file commander - private PLAIN APP
// --------------------------------------
var privatePlainAppMsgViewMiddleware = getViewMiddleware(PLAIN_APP_VIEWS_MOUNT + 'msg.jade');
app.use(PRIVATE_APP_URL_MOUNT + PLAIN_APP_URL_MOUNT, privateApp.serverBased());
// process file commander result
app.route(PRIVATE_PLAIN_APP_ROUTE_EXP)
.all(
  validateCommanderMiddleware,
  userAgentInitMiddleware,
  resInitMiddleware,
  viewsInitMiddleware
)
.get(
  getViewMiddleware(PLAIN_APP_VIEWS_MOUNT + 'private.jade'),
  renderPlainAppMiddleware
)
.post(
  privatePlainAppMsgViewMiddleware,
  renderPlainAppMsgMiddleware
)
.delete(
  privatePlainAppMsgViewMiddleware,
  renderPlainAppMsgMiddleware
);
// not found middleware sub-stack
app.route(PRIVATE_PLAIN_APP_ROUTE_EXP)
.all(
  notFoundCommonMiddleware,
  notFoundRenderMiddleware
);

// --------------------------------------
// use file commander - public PLAIN APP
// --------------------------------------
app.use(PUBLIC_APP_URL_MOUNT + PLAIN_APP_URL_MOUNT, publicApp.serverBased());
// process file commander result
app.route(PUBLIC_PLAIN_APP_ROUTE_EXP)
.get(
  validateCommanderMiddleware,
  userAgentInitMiddleware,
  resInitMiddleware,
  viewsInitMiddleware,
  getViewMiddleware(PLAIN_APP_VIEWS_MOUNT + 'index.jade'),
  renderPlainAppMiddleware
);
// not found middleware sub-stack
app.route(PUBLIC_PLAIN_APP_ROUTE_EXP)
.all(
  notFoundCommonMiddleware,
  notFoundRenderMiddleware
);

// --------------------------------------
// use file commander - private MAIN APP
// --------------------------------------
app.use(PRIVATE_APP_URL_MOUNT, privateApp.restBased());
// process file commander result
app.route(PRIVATE_APP_ROUTE_EXP)
.get(
  validateCommanderMiddleware,
  userAgentInitMiddleware,
  resInitMiddleware,
  viewsInitMiddleware,
  getViewMiddleware(MAIN_APP_VIEWS_MOUNT + 'private.jade'),
  renderMainAppMiddleware
);
// not found middleware sub-stack
app.route(PRIVATE_APP_ROUTE_EXP)
.all(
  notFoundCommonMiddleware,
  notFoundRenderMiddleware
);

// --------------------------------------
// use file commander - public MAIN APP
// --------------------------------------
app.use(PUBLIC_APP_URL_MOUNT, publicApp.restBased());
// process file commander result
app.route(PUBLIC_APP_ROUTE_EXP)
.get(
  validateCommanderMiddleware,
  userAgentInitMiddleware,
  resInitMiddleware,
  viewsInitMiddleware,
  getViewMiddleware(MAIN_APP_VIEWS_MOUNT + 'index.jade'),
  renderMainAppMiddleware
);
// not found middleware sub-stack
app.route(PUBLIC_APP_ROUTE_EXP)
.all(
  notFoundCommonMiddleware,
  notFoundRenderMiddleware
);

// -------------------------------------------------------------------
// CUSTOM MIDDLEWARE DEFINITIONS
// -------------------------------------------------------------------

// renders app home page
function renderRootMiddleware(req, res, next) {
  simpleRenderer(req, res, next);
} // END of renderRootMiddleware

// renders user home page
function renderHomeMiddleware(req, res, next) {
  simpleRenderer(req, res, next);
} // END of renderHomeMiddleware

// renders app login page
function renderLoginMiddleware(req, res, next) {
  // optional success redirection after login
  res.locals.appkey.redir = req.query.redir;
  // parameters for authentication strategies
  res.locals.appkey.auth = app.get('authLocals');
  // render response
  simpleRenderer(req, res, next);
} // END of renderLoginMiddleware

// renders main app response
function renderMainAppMiddleware(req, res, next) {
  res.locals.appkey.app.path = req.fcmder.fs.path.name;
  var attrs = res.locals.appkey.root.attrs;
  attrs["ng-app"] = NG_APP_NAME;
  attrs["ng-init"] = NG_UPLOAD_BYTES_LIMIT_KEY + '=' + UPLOAD_BYTES_LIMIT + ';' +
                     NG_UPLOAD_TYPES_KEY + '=' + '\'' + UPLOAD_TYPES_STR + '\';' +
                     NG_PREVIEW_PLAIN_BYTES_LIMIT_KEY + '=' + NG_PREVIEW_PLAIN_BYTES_LIMIT + ';' +
                     NG_PREVIEW_CODE_BYTES_LIMIT_KEY  + '=' + NG_PREVIEW_CODE_BYTES_LIMIT  + ';';
  simpleRenderer(req, res, next);
}

// renders plain app response
function renderPlainAppMiddleware(req, res, next) {
  res.locals.appkey.app.path  = req.fcmder.fs.path.name;
  res.locals.appkey.app.files = req.fcmder.fs.files;
  res.locals.appkey.app.parentPath = path.dirname(req.fcmder.fs.path.name);
  res.locals.appkey.app.uploadTypes = UPLOAD_TYPES_STR;
  res.locals.appkey.app.uploadLimit = (UPLOAD_BYTES_LIMIT / MEGA_BYTE) + ' MB';
  res.locals.appkey.fn.meta2kind = meta2kind;
  res.locals.appkey.fn.meta2size = meta2size;
  simpleRenderer(req, res, next);
}

function redirLogoutMiddleware(req, res){
  req.logout();
  res.redirect(LOGOUT_REDIR_ROUTE);
}

function renderPlainAppMsgMiddleware(req, res, next) {
  var state = req.fcmder.state;
  if (!state || !state.code) {
    next({
      msg : 'Internal server error.',
      desc: 'Invalid state format.'
    });
    return;
  }
  var locals = res.locals.appkey.app;
  // prevent automatic redirection for long run tasks
  locals.autoRedirect = (Date.now() - req.appkey.timer) < LONG_RUNNING_TASK_MS;
  locals.state = state;
  locals.timeout = MSG_PAGE_TIMEOUT_S;
  locals.redirect = getRedirectBackAddress(req);
  res.status(state.code);
  simpleRenderer(req, res, next);
} // END of renderPlainAppMsgMiddleware

// redirects back with message and status
// - mainly used for serving POST method of request
function redirBackMiddleware(req, res, next) {
  var state = req.fcmder.state;
  console.log(state);
  if (!state || !state.code) {
    next({
      msg : 'Internal server error.',
      desc: 'Invalid state format.'
    });
    return;
  }
  // TODO set session properties to let the client know message and other data
  // TODO set res.status according state.code
  res.redirect('back');
} // END of redirBackMiddleware

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    next();
    return;
  }
  // TODO provide query set to redir=req.url
  res.redirect(LOGIN_ROUTE);
} // END of ensureAuthenticated

function ensureUnauthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    next();
    return;
  }
  res.redirect(HOME_ROUTE);
} // END of ensureUnauthenticated

// supplies absolute path to user's private files (his home directory)
// to next midleware
function authorizeOwnerMiddleware(req, res, next) {
  if (!req.isAuthenticated()) {
    // TODO provide query set to redir=req.url
    res.redirect(LOGIN_ROUTE);
    return;
  }
  // user authenticated
  // get user home directory
  var mount = __dirname + PRIVATE_PATH + path.sep + req.user._id;
  // check existence of the directory
  fs.exists(mount, function(exists) {
    if (exists) {
      // the directory exists
      // ... set user home directory
      Commander.setRequestPrivateDir(req, mount);
      // ... proceed with next middleware
      next();
      return;
    }
    // the directory does not exist, create it
    console.log('Creating home directory for user: "%s".', req.user._id);
    fs.mkdir(mount, function(err) {
      debugger;
      if (err) {
        // unexpected error occurred
        // TODO format the error
        next(err);
        return;
      }
      // the directory successfully created
      console.log('Home directory created for user: "%s".', req.user._id);
      // ... set user home directory
      Commander.setRequestPrivateDir(req, mount);
      // ... finally proceed with next middleware
      next();
    });
  });
} // END of authorizeOwnerMiddleware

// initializes request specific parameters
// - shall be the first one from custom middleware chain
function reqInitMiddleware(req, res, next) {
  req.appkey = {
    timer: Date.now(),
    req: {
      path: decodeURIComponent(req.path),
      url: decodeURIComponent(req.url)
    }
  };
  next();
} // END of reqInitMiddleware

// initializes response specific parameters
function resInitMiddleware(req, res, next) {
  res.locals = {
    appkey: {
      root: {
        attrs: {}
      },
      body: {},
      app : {},
      fn  : {},
      req : {
        path  : req.appkey.req.path,
        url   : req.appkey.req.url
      }
    }
  };
  if (req.user) {
    res.locals.appkey.user = {
      provider    : req.user.provider,
      username    : req.user.username,
      displayName : req.user.displayName
    };
  }
  next();
} // END of resInitMiddleware

// sets user-agent specific attributes regarding a current request
function userAgentInitMiddleware(req, res, next) {
  var ua = useragent.parse(req.headers['user-agent']);
  var html5min = HTML5_SUPPORT[ua.family];
  req.appkey.ua = {
    html4: (
      !html5min ||
      html5min.major >  ua.major ||
      html5min.major == ua.major &&
      html5min.minor >  ua.minor
    )
  };
  next();
} // END of userAgentInitMiddleware

// check result of a processing of the commander app
function validateCommanderMiddleware(req, res, next) {
  if (!req.fcmder) {
    next('route');
    return;
  }
  next();
} // END of validateCommanderMiddleware

// sets path to render templates according to client's user-agent settings
function viewsInitMiddleware(req, res, next) {
  req.appkey.views = {
    mount: (req.appkey.ua.html4) ? HTML4_VIEWS_MOUNT : HTML5_VIEWS_MOUNT
  };
  next();
} // END of viewsInitMiddleware

// sets view used in this middleware sub-stack
function getViewMiddleware(view) {
  return function(req, res, next) {
    req.appkey.views.name = view;
    next();
  }
} // END of getViewMiddleware

// performs common actions regarding 404 status http status response
function notFoundCommonMiddleware(req, res, next) {
  res.status(404);
  next();
}

// renders 404 page
function notFoundRenderMiddleware(req, res, next) {
  // TODO render 404 status page
  res.send('Sorry, we cannot find that!!!!');
}

// -------------------------------------------------------------------
// UTILITIES
// -------------------------------------------------------------------
function overrideBodyMethod(req, res){
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in body and delete it
    var method = req.body._method
    delete req.body._method
    return method
  }
}

// returns address with express uses for redirection to 'back' (res.redirect('back'))
function getRedirectBackAddress(req) {
  return req.get('Referrer') || '/';
}

function gracefulExit() {
  // TODO what about redis?

  db.disconnect(function () {
    console.log(
      '\nConnection with ' +
      'db: "' + dbConfig.settings.name + '" ' +
      'disconnected via app termination.'
    );
    process.exit(0);
  });
} // END of gracefulExit

function meta2kind(meta) {
  if (!meta) {
    return;
  }
  if (!!meta.isFile && !meta.isDir && !meta.isLink) {
    return 'File';
  }
  if (!meta.isFile && !!meta.isDir && !meta.isLink) {
    return 'Folder';
  }
  if (!meta.isFile && !meta.isDir && !!meta.isLink) {
    return 'Alias';
  }
  return 'unknown'
} // END of meta2kind

function meta2size(meta) {
  if (!meta) {
    return;
  }
  if (meta.isDir) {
    return '--';
  }
  if (meta.size < 1000) {
    return meta.size + ' B';
  }
  if (meta.size < 1000000) {
    return (Math.round(meta.size / 10) / 100) + ' KB';
  }
  if (meta.size < 1000000000) {
    return (Math.round(meta.size / 10000) / 100) + ' MB';
  }
  return (Math.round(meta.size / 10000000) / 100) + ' GB';
} // END of meta2size

// -------------------------------------------------------------------
// RESPONSE RENDERER DEFINITIONS
// -------------------------------------------------------------------

// renders response with given parameters without any further
// modifications of the request or response
function simpleRenderer(req, res, next, locals, cb) {
  res.render(req.appkey.views.mount + req.appkey.views.name, locals, cb);
}


// -------------------------------------------------------------------
// APP START
// -------------------------------------------------------------------

// ensure graceful exit of the process when signal received
process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);

// start listening on defined port when the connection to the database is open
db.on('open', function() {
  console.log('connection with database "%s" open ...', dbConfig.settings.name);
  app.listen(PORT);
  console.log('listening on port ' + PORT);
});

function startApp() {
  redisTest.quit();
  db.connect();
}
