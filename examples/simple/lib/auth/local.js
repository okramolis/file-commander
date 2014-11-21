var Strategy = require('passport-local').Strategy
  , Router = require('express').Router
;
const NAME              = 'local'
  ,   DELIMITER         = '_'
  ,   POST_ROUTE        = '/login'
  ,   SUCCESS_REDIRECT  = '/home'
  ,   FAILURE_REDIRECT  = '/login'
;
function Auth(options) {
  var self = this
    , db = options.db
    , manager = options.manager
    , model = options.model
    , schema = options.schema
    , col = options.collection
    , postRoute = options.postRoute || POST_ROUTE
    , settings = {
        successRedirect: SUCCESS_REDIRECT,
        failureRedirect: FAILURE_REDIRECT
      }
  ;

  for (var key in options.settings) {
    // override default settings for manager.authenticate
    settings[key] = options.settings[key];
  }

  if (!!model && typeof model === 'string' && !schema) {
    // retrieve already created model
    this._User = db.model(model);
  } else if (!!model && typeof model === 'string' ||
             !!col && typeof col === 'string') {
    // TODO not tested
    // create separate schema and model
    var userSchema = new db.Schema({
      username: {// local strategy
        type  : String,
        unique: true
      },
      password: String, // local strategy TODO: store encryped form
      displayName: String
    });
    // add prefix to model name if possible
    if (!!model && typeof model === 'string') {
      model = NAME + DELIMITER + model;
    }
    // add prefix to collection name if possible
    if (!!col && typeof col === 'string') {
      col = NAME + DELIMITER + col;
    }
    // craete the model
    this._User = db.model(model, userSchema, col);
  } else {
    throw new Error('auth.local: Invalid input arguments.');
  }

  // register this strategy in strategy manager
  manager.use(new Strategy(options.strategy || {}, function() {
    self._verify.apply(self, arguments);
  }));

  // create routes
  this._router = Router();
  this._router.post(postRoute, manager.authenticate(NAME, settings));
} // END of Auth

Auth.prototype.router = function() {
  return this._router;
}

Auth.prototype._verify = function(username, password, done) {
  this._User.findOne({username: username}, function(err, user) {
    if (err) {
      done(err);
      return;
    }
    // TODO work with user hash - user password in encrypted form
    if (!user || user.password !== password) {
      done(null, false, {message: 'Incorrect username or password.'});
      return;
    }
    done(null, user);
  });
} // END of _verify

module.exports = {
  Auth: Auth
};
