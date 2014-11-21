var base = require('./dbio')
  , util = require("util")
  , mongoose = require('mongoose')
;

// -----------------------------------------
// Derived constructor from Base constructor
// -----------------------------------------
function Connection(config) {
  base.Connection.call(this);

  // store configuration
  this._host = config.host || 'localhost';
  this._name = config.name || 'test';

  // create database
  this._db = mongoose.createConnection();

  // connect to EventEmitter interface of mongoose connection instance
  this._connectDbEvents([
    'connecting',
    'connected',
    'open',
    'disconnecting',
    'disconnected',
    'close',
    'reconnected',
    'error'
  ]);
}
// perform the inheritance
util.inherits(Connection, base.Connection);

// ------------------------------------------
// Implementation of the base class interface
// ------------------------------------------

Connection.prototype.connect = function() {
  this._db.open(this._host, this._name);
} // END of connect

Connection.prototype.disconnect = function(callback) {
  this._db.close(callback);
}

Connection.prototype.model = function(name, schema, collection) {
  return this._db.model(name, schema, collection);
}

Connection.prototype.Schema = mongoose.Schema;

// ------------------------------------------
// Implementation of private methods
// ------------------------------------------

Connection.prototype._connectDbEvents = function(names) {
  for (var i = 0, len = names.length; i < len; i++) {
    this._connectDbEvent.call(this, names[i]);
  }
}
Connection.prototype._connectDbEvent = function(name) {
  var self = this;
  this._db.on(name, function() {
    self.emit.apply(self, [name].concat([].slice.call(arguments)));
  });
}

// -------------------------------------------------------------------
// PUBLIC INTERFACE
// -------------------------------------------------------------------

module.exports = {
  Connection: Connection,
  Types     : mongoose.Types
};

