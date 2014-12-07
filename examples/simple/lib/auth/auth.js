var Router  = require('express').Router
  , util    = require('util')
;

const DELIMITER           = '_'
  ,   LOG_SIGN_AUTH       = 'Auth'
  ,   LOG_SIGN_OAUTH2     = 'OAuth2'
  ,   LOG_SIGN_LOCAL      = 'LocalAuth'
  ,   MANDATORY_ERR       = '%s: mandatory argument not provided, please provide: "%s"'
  ,   NOT_IMPLEMENTED_ERR = '%s: method "%s" is not implemented.'
;

// ----------------------------------------------------------------------------------------
// ----------------------
// Auth - base auth class
// ----------------------

function Auth(name, Strategy, options) {
  var db = options.db
    , model = options.model
    , schema = options.schema
    , col = options.collection
    , settings = options.settings
  ;

  if (!settings)  {
    throw new Error(util.format(MANDATORY_ERR, LOG_SIGN_AUTH, 'settings'));
  }
  if (!settings.successRedirect) {
    throw new Error(util.format(MANDATORY_ERR, LOG_SIGN_AUTH, 'settings.successRedirect'));
  }
  if (!settings.failureRedirect) {
    throw new Error(util.format(MANDATORY_ERR, LOG_SIGN_AUTH, 'settings.failureRedirect'));
  }

  if (!!model && typeof model === 'string' && !schema) {
    // retrieve already created model
    this._User = db.model(model);
  } else if (!!model && typeof model === 'string' ||
             !!col && typeof col === 'string') {
    // TODO not tested
    // create separate schema and model
    var userSchema = new db.Schema(schema);
    // add prefix to model name if possible
    if (!!model && typeof model === 'string') {
      model = name + DELIMITER + model;
    }
    // add prefix to collection name if possible
    if (!!col && typeof col === 'string') {
      col = name + DELIMITER + col;
    }
    // craete the model
    this._User = db.model(model, userSchema, col);
  } else {
    throw new Error('auth: Invalid input arguments.');
  }

  // create routes
  this._initRouter.call(this, name, options);

  // register this strategy in strategy manager
  this._initManager.call(this, Strategy, options);
} // END of Auth

// -----------------------------------------
// Abstract interface - pure virtual methods
// -----------------------------------------

// Supposed to handle user identity
// arguments
// - varies with chosen auth strategy
Auth.prototype._verify = function() {
  throw new Error(util.format(NOT_IMPLEMENTED_ERR, LOG_SIGN_AUTH, '_verify'));
}

// --------------
// Implementation
// --------------

// Returns app router.
Auth.prototype.router = function() {
  return this._router;
}

// Initializes router.
Auth.prototype._initRouter = function() {
  this._router = Router();
}

// Initializes authentication manager.
Auth.prototype._initManager = function(Strategy, options) {
  options.manager.use(new Strategy(options.strategy || {}, this._verify.bind(this)));
}

// ----------------------------------------------------------------------------------------
// ---------------------------
// OAuth2 - derived auth class
// ---------------------------

function OAuth2(name, Strategy, options) {
  // construct base class instance
  Auth.call(this, name, Strategy, options);
}

// perform the inheritance
util.inherits(OAuth2, Auth);

// -----------------------------------------
// Abstract interface - pure virtual methods
// -----------------------------------------

// Supposed to return query to find user according to provided "profile" argument.
// arguments
// - user profile
OAuth2.prototype._query = function() {
  throw new Error(util.format(NOT_IMPLEMENTED_ERR, LOG_SIGN_OAUTH2, '_query'));
}

// Supposed to return user object according to provided "profile" argument.
// arguments
// - user profile
OAuth2.prototype._model = function() {
  throw new Error(util.format(NOT_IMPLEMENTED_ERR, LOG_SIGN_OAUTH2, '_model'));
}

// --------------
// Implementation
// --------------

OAuth2.prototype._verify = function(accessToken, refreshToken, profile, done) {
  this._User.findOne(this._query(profile), this._cbUserQuery.bind(this, profile, done));
}

OAuth2.prototype._initRouter = function(name, options) {
  if (!options.sendRoute) { throw new Error(util.format(MANDATORY_ERR, LOG_SIGN_OAUTH2, 'sendRoute')); }
  if (!options.backRoute) { throw new Error(util.format(MANDATORY_ERR, LOG_SIGN_OAUTH2, 'backRoute')); }

  Auth.prototype._initRouter.call(this);

  this._router.get(options.sendRoute, options.manager.authenticate(name, options.provided));
  this._router.get(options.backRoute, options.manager.authenticate(name, options.settings));
}

OAuth2.prototype._cbUserQuery = function(profile, done, err, user) {
  if (err) {
    // TODO handle error
    done(err);
    return;
  }
  if (!user) {
    // user doess not exist - add new user
    var user = new this._User(this._model(profile));
    user.save(this._cbUserSave.bind(this, done));
    return;
  }
  // TODO update user profile if needed
  // pass existing user
  done(null, user);
}

OAuth2.prototype._cbUserSave = function(done, err, user) {
  if (err) {
    // TODO handle error
    done(err);
    return;
  }
  // pass created user
  done(null, user);
}


// ----------------------------------------------------------------------------------------
// ---------------------------
// Local - derived auth class
// ---------------------------

function Local(name, Strategy, options) {
  // construct base class instance
  Auth.call(this, name, Strategy, options);
}

// perform the inheritance
util.inherits(Local, Auth);

// -----------------------------------------
// Abstract interface - pure virtual methods
// -----------------------------------------

// Supposed to return query to find user according to provided "username" argument.
// arguments
// - username
Local.prototype._query = function() {
  throw new Error(util.format(NOT_IMPLEMENTED_ERR, LOG_SIGN_LOCAL, '_query'));
}

// Supposed to perform password match.
// arguments
// - found user
// - claimed password
Local.prototype._auth = function() {
  throw new Error(util.format(NOT_IMPLEMENTED_ERR, LOG_SIGN_LOCAL, '_auth'));
}

// --------------
// Implementation
// --------------

Local.prototype._verify = function(username, password, done) {
  this._User.findOne(this._query(username), this._cbUserQuery.bind(this, password, done));
}

Local.prototype._initRouter = function(name, options) {
  if (!options.postRoute) { throw new Error(util.format(MANDATORY_ERR, LOG_SIGN_LOCAL, 'postRoute')); }

  Auth.prototype._initRouter.call(this);
  this._router.post(options.postRoute, options.manager.authenticate(name, options.settings));
}

Local.prototype._cbUserQuery = function(password, done, err, user) {
  if (err) {
    done(err);
    return;
  }
  if (!user || !this._auth(user, password)) {
    done(null, false, {message: 'Incorrect username or password.'});
    return;
  }
  done(null, user);
}

// ----------------
// Public interface
// ----------------
module.exports = {
  Base  : Auth,
  OAuth2: OAuth2,
  Local : Local
};
