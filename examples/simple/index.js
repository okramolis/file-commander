const STATIC_PATH               = '/static'
  ,   COMMANDER_URL_MOUNT       = '/commander'
  ,   COMMANDER_ROUTE_EXP       = new RegExp('^' + COMMANDER_URL_MOUNT)
  ,   DEFAULT_PORT              = 8888
  ,   STATIC_SETTINGS           = {
        dotfiles: 'allow'
      }
  ,   VIEWS_PATH                = '/views'
  ,   HTML5_VIEWS_MOUNT         = 'html5/'
  ,   HTML4_VIEWS_MOUNT         = 'html4/'
  ,   PLAIN_APP_URL_MOUNT       = COMMANDER_URL_MOUNT + '/plain-app'
  ,   PLAIN_APP_ROUTE_EXP       = new RegExp('^' + PLAIN_APP_URL_MOUNT)
  ,   PLAIN_APP_VIEWS_MOUNT     = 'apps/plain/'
  ,   MAIN_APP_VIEWS_MOUNT      = 'apps/main/'
  ,   USER_VIEWS_MOUNT          = 'common/user/'
  ,   LOGIN_ROUTE               = '/login'
  ,   LOGOUT_ROUTE              = '/logout'
  ,   HOME_ROUTE                = '/home'
  ,   LOGOUT_REDIR_ROUTE        = LOGIN_ROUTE
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
;

// get required modules
var express = require('express')
  , bodyParser = require('body-parser')
  , methodOverride = require('method-override')
  , cookieParser = require('cookie-parser')
  , expressSession = require('express-session')
  , logger = require('morgan')
  , path = require('path')
  , useragent = require('useragent')
  , config = require('config')
  , _ = require('underscore')
  , commander = require('../..')
;

// get configurations
var appConfig = config.get('app')
  , dbConfig  = config.get('db')
;

var dbio = require('./lib/dbio/' + dbConfig.type)
  , authmod = require('./lib/auth')
;

// initialize constants
const PORT = appConfig.net.port;

// get app
var app = express();

// TODO make sure redis server is running
//      - throw an error if it is not

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
;
for (var strategy in stratConfig) {
  var Auth = require('./lib/auth/' + strategy).Auth;
  strategies[strategy] = new Auth(
    _.extend({
      manager : auth,
      db      : db,
      model   : USER_MODEL_NAME
    }, stratConfig[strategy])
  );
}

// -------------------------------------------------------------------
// APP CONFIGURATION
// -------------------------------------------------------------------

// attributes configuration
// -------------------------------------------------------------------
app.locals = {
  CONSTS: {
    COMMANDER: {
      URL_MOUNT           : COMMANDER_URL_MOUNT,
      PLAIN_APP_URL_MOUNT : PLAIN_APP_URL_MOUNT
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
  secret: 'tralala nana',
  resave: true,
  saveUninitialized: true
}));
// authentication support
app.use(auth.initialize());
app.use(auth.session());

// preprocess middleware
app.use(reqInitMiddleware);

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

// use file commander - PLAIN APP
app.use(PLAIN_APP_URL_MOUNT, commander.serverBased({
  publicFiles : __dirname + STATIC_PATH,
  dotfiles    : STATIC_SETTINGS.dotfiles
}));
// process file commander result
app.route(PLAIN_APP_ROUTE_EXP)
.all(
  validateCommanderMiddleware
)
.get(
  userAgentInitMiddleware,
  resInitMiddleware,
  viewsInitMiddleware,
  getViewMiddleware(PLAIN_APP_VIEWS_MOUNT + 'index.jade'),
  renderPlainAppMiddleware
)
.post(
  redirBackMiddleware
)
.delete(
  redirBackMiddleware
);
// not found middleware sub-stack
app.route(PLAIN_APP_ROUTE_EXP)
.all(
  notFoundCommonMiddleware,
  notFoundRenderMiddleware
);

// use file commander - MAIN APP
app.use(COMMANDER_URL_MOUNT, commander.restBased({
  publicFiles : __dirname + STATIC_PATH,
  dotfiles    : STATIC_SETTINGS.dotfiles,
  mount       : COMMANDER_URL_MOUNT
}));
// process file commander result
app.route(COMMANDER_ROUTE_EXP)
.get(
  validateCommanderMiddleware,
  userAgentInitMiddleware,
  resInitMiddleware,
  viewsInitMiddleware,
  getViewMiddleware(MAIN_APP_VIEWS_MOUNT + 'index.jade'),
  renderMainAppMiddleware
);
// not found middleware sub-stack
app.route(COMMANDER_ROUTE_EXP)
.all(
  notFoundCommonMiddleware,
  notFoundRenderMiddleware
);

// -------------------------------------------------------------------
// CUSTOM MIDDLEWARE DEFINITIONS
// -------------------------------------------------------------------

// renders user home page
function renderHomeMiddleware(req, res, next) {
  res.locals.appkey.user = {
    username    : req.user.username,
    displayName : req.user.displayName
  };
  simpleRenderer(req, res, next);
} // END of renderHomeMiddleware

// renders app login page
function renderLoginMiddleware(req, res, next) {
  // optional success redirection after login
  res.locals.appkey.redir = req.query.redir;
  // parameters for authentication strategies
  res.locals.appkey.auth = { // TODO prebuild this object according to auth configuration
    local: {
      // TODO add parameters for local.jade view
      fields: {
        username: 'username',
        password: 'password'
      }
    },
    links: [
      // TODO add auth strategies with their parameters for link.jade view
    ]
  };
  simpleRenderer(req, res, next);
} // END of renderLoginMiddleware

// renders main app response
function renderMainAppMiddleware(req, res, next) {
  res.locals.appkey.app.path = req.fcmder.fs.path.name;
  simpleRenderer(req, res, next);
}

// renders plain app response
function renderPlainAppMiddleware(req, res, next) {
  res.locals.appkey.app.path  = req.fcmder.fs.path.name;
  res.locals.appkey.app.files = req.fcmder.fs.files;
  simpleRenderer(req, res, next);
}

function redirLogoutMiddleware(req, res){
  req.logout();
  res.redirect(LOGOUT_REDIR_ROUTE);
}

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
  res.redirect('back');
} // END of redirBackMiddleware

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    next();
    return;
  }
  res.redirect(LOGIN_ROUTE);
} // END of ensureAuthenticated

function ensureUnauthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    next();
    return;
  }
  res.redirect(HOME_ROUTE);
} // END of ensureUnauthenticated

// initializes request specific parameters
// - shall be the first one from custom middleware chain
function reqInitMiddleware(req, res, next) {
  req.appkey = {
    req: {
      url: decodeURIComponent(req.url)
    }
  };
  next();
} // END of reqInitMiddleware

// initializes response specific parameters
function resInitMiddleware(req, res, next) {
  res.locals = {
    appkey: {
      body: {},
      app : {},
      req : {
        url   : req.appkey.req.url
      }
    }
  };
  next();
} // END of resInitMiddleware

// sets user-agent specific attributes regarding a current request
function userAgentInitMiddleware(req, res, next) {
  var ua = useragent.parse(req.headers['user-agent']);
  console.log('userAgent:');
  console.log(ua);

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
db.connect();
