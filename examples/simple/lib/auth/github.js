var Strategy  = require('passport-github').Strategy
  , Router    = require('express').Router
  , BaseAuth  = require('./auth').OAuth2
  , util      = require('util')
;
const NAME = 'github';

function Auth(options) {
  // construct base class instance
  BaseAuth.call(this, NAME, Strategy, options);
}

// perform the inheritance
util.inherits(Auth, BaseAuth);

// ---------------------
// Auth - implementation
// ---------------------
Auth.prototype._query = function(profile) {
  return {
    githubId: profile.id
  };
}

Auth.prototype._model = function(profile) {
  return {
    githubId: profile.id,
    // TODO set default displayName if not provided
    displayName: profile.displayName || profile.username
  };
}

// ----------------
// Public interface
// ----------------
module.exports = {
  Auth: Auth
};
