var Strategy  = require('passport-local').Strategy
  , Router    = require('express').Router
  , BaseAuth  = require('./auth').Local
  , util      = require('util')
;

const NAME = 'local';

function Auth(options) {
  // construct base class instance
  BaseAuth.call(this, NAME, Strategy, options);
} // END of Auth

// perform the inheritance
util.inherits(Auth, BaseAuth);

// ---------------------
// Auth - implementation
// ---------------------
Auth.prototype._query = function(username) {
  return {
    username: username
  };
}

Auth.prototype._auth = function(user, password) {
  // TODO work with user hash - user password in encrypted form
  return user.password === password;
}

// ----------------
// Public interface
// ----------------
module.exports = {
  Auth: Auth
};
