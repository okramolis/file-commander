var Strategy  = require('passport-google-oauth').OAuth2Strategy
  , Router    = require('express').Router
  , BaseAuth  = require('./auth').OAuth2
  , util      = require('util')
;

const NAME = 'google'
  ,   LOG_WARN = 'Warning:'
  ,   LOG_SIGN = NAME + '-auth'
;

function Auth(options) {
  // construct base class instance
  BaseAuth.call(this, NAME, Strategy, options);

  // check google specific settings
  if (!options.provided || !options.provided.scope) {
    console.log(
      util.format(
        '%s %s: argument "%s" is missing, authentication process may fail.',
        LOG_WARN, LOG_SIGN, 'provided.scope'));
  }
}

// perform the inheritance
util.inherits(Auth, BaseAuth);

// ---------------------
// Auth - implementation
// ---------------------
Auth.prototype._query = function(profile) {
  return {
    googleId: profile.id
  };
}

Auth.prototype._model = function(profile) {
  return {
    provider: NAME,
    googleId: profile.id,
    // TODO set default displayName if not provided
    displayName: profile.displayName
  };
}

// ----------------
// Public interface
// ----------------
module.exports = {
  Auth: Auth
};
