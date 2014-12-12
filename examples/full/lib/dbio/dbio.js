var util = require('util')
  , EventEmitter = require('events').EventEmitter
;
// ------------------------------------------
// Base constructor derived from EventEmitter
// ------------------------------------------

function Connection() {
  EventEmitter.call(this);
} // END of Connection
util.inherits(Connection, EventEmitter);

function Model() {
  EventEmitter.call(this);
} // END of Model
util.inherits(Model, EventEmitter);

function Schema(definition) {
  EventEmitter.call(this);
  // TODO implement data filtering according to the schema definition
} // END of Schema
util.inherits(Schema, EventEmitter);

// ---------------------------------------------
// Interface to be implemented - virtual methods
// ---------------------------------------------
Connection.prototype.connect = function() {
  throw new Error('Connection: method "connect" is not implemented.');
}

Connection.prototype.disconnect = function() {
  throw new Error('Connection: method "disconnect" is not implemented.');
}

Connection.prototype.model = function() {
  throw new Error('Connection: method "model" is not implemented.');
}

Connection.prototype.Schema = Schema;

Model.prototype.save = function() {
  throw new Error('Connection: method "save" is not implemented.');
}

function ObjectId(id) {
  if (typeof id === 'string') {
    // from String
    this._oid = id;
  } else if (id instanceof ObjectId) {
    // copy constructor
    // TODO not tested
    this._oid = id._oid;
  } else {
    // default - generate random id
    this._oid = '__' + String(Math.random()).slice(2);
  }
}
ObjectId.prototype.toString = function() {
  return this._oid;
}

module.exports = {
  Connection: Connection,
  Model     : Model,
  Types     : {
    ObjectId: ObjectId
  }
};
