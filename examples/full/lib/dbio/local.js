// ------------------------------------------------------------------
// NOTE: This implementation is not complete and is supposed to be
//       used for development purposes only. It tries to implement
//       mongoose like interface. JavaScript object maintained
//       in memory only is used as a database abstraction.
// ------------------------------------------------------------------

// required modules
var base = require('./dbio')
  , util = require('util')
  , async = require('async')
;

// local in memory databases
var dbs = {};

// set of models
var models = {};

// used base types
var ObjectId = base.Types.ObjectId;

// --------------------------------
// Connection - derived constructor
// --------------------------------
function Connection(config) {
  base.Connection.call(this);

  // init with default values
  this._db = null;

  // check db name - use default if not valid
  this._name = config.name || 'test';

  // temporarily store default content
  this._defaultContent = (Array.isArray(config.defaultContent))
                          ? config.defaultContent
                          : ((!config.defaultContent)
                            ? []
                            : [config.defaultContent]);

  // use particular db in this instance
  this._db = getDB(this._name);
  if (!this._db) {
    // database with specified name does not exist => create it
    this._db = createDB(this._name);
  }

  // initialize database
  this._initializeDb.call(this);
}
// perform the inheritance
util.inherits(Connection, base.Connection);

// ---------------------------
// Connection - implementation
// ---------------------------

Connection.prototype.connect = function() {
  this.emit('open');
} // END of connect

Connection.prototype.disconnect = function(callback) {
  if (typeof callback === 'function') {
    callback();
    return;
  }
  console.log('disconnected from database: "%s".' , this._name);
}

Connection.prototype.model = function(key, schema, collection) {
  var name = collection;
  if (typeof name !== 'string') {
    // TODO make key plural e.g. user => users
    //      - use more sofisticated algorithm
    name = key + 's';
  }
  if (models.hasOwnProperty(name)) {
    return models[name];
  }

  // store model in models collection
  models[name] = makeModel(this._db, name, schema);

  // create collection in Model's database
  this._db[name] = {};

  return models[name];
}

Connection.prototype._initializeDb = function(callback) {
  var self = this;
  async.eachSeries(this._defaultContent, function(item, next) {
    if (typeof item.collection !== 'string' || typeof item.content !== 'object') {
      // do not add invalid item
      next();
      return;
    }
    var Model = self.model.call(self, null, item.schema, item.collection);
    var model = new Model(item.content);
    model.save(function(err, added) {
      if (!err) {
        console.log('Successfully added default item to "%s":', item.collection);
        console.log(added);
      }
      next(err);
    });
  }, function(err) {
    if (err) {
      console.log(err);
      throw new Error('Cannot add default content.');
    }
    if (self._defaultContent.length > 0) {
      console.log('Default content successfully added.');
    }
    self._defaultContent = null;
    if (typeof callback === 'function') {
      callback();
    }
  });
} // END of _initializeDb

// ---------------
// Model - factory
// ---------------

function makeModel(db, key, schema) {
  // ---------------------------
  // Model - derived constructor
  // ---------------------------
  function Model(data) {
    base.Model.call(this);
    this._key = key;
    this._schema = schema;
    this._db = db;
    this._data = data;
    // ensure id of data
    if (!this._data._id) {
      this._data._id = new ObjectId();
    }
  }
  util.inherits(Model, base.Model);

  // --------------------------------
  // Model - override virtual methods
  // --------------------------------
  Model.prototype.save = modelSave;

  // --------------------------------
  // Model - implement static methods
  // --------------------------------
  Model.findById = function(id, callback) {
    Model._through(false, false, getBack, {_id: new ObjectId(id)}, callback);
  } // END of findById

  Model.findOne = function(conditions, fields, options, callback) {
    Model._through(false, false, getBack, conditions, fields, options, callback);
  } // END of findOne

  Model.find = function(conditions, fields, options, callback) {
    Model._through(true, false, getBack, conditions, fields, options, callback);
  } // END of find

  Model.update = function(conditions, update, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = null;
    }
    Model._through(
      (options && options.multi),
      true,
      getUpdateItem(update),
      conditions,
      null,
      options,
      callback
    );
  } // END of update

  Model.remove = function(conditions, callback) {
    Model._through(true, true, removeItem, conditions, callback);
  } // END of remove

  // database operations handler - common for all methods
  // arguments
  // - multi      boolean   perform global search - search through whole database
  // - count      boolean   pass number of found items as a result instead of the data
  // - handle     function  processes found item according to chosen method logic
  // - conditions object    database query
  // - [fields]   object    list of fields to be retrieved from found items
  // - [options]  object    other options for the query
  // - callback   function  callback function with signature (err, result)
  Model._through = function(multi, count, handle, conditions, fields, options, callback) {
    if (typeof fields === 'function') {
      callback = fields;
      fields = null;
      options = null;
    } else if (typeof options === 'function') {
      callback = options;
      options = null;
    }
    if (typeof callback !== 'function') {
      throw new Error('Model._through: callback has to be function!');
    }
    var found = [];
    var col = db[key];
    for (var id in col) {
      if (satisfies(col[id], conditions)) {
        var item = handle(col, id);
        if (!multi) {
          // pass only the first match
          // TODO add fields support - select desired fields only
          callback(null, (count) ? 1 : item);
          return;
        }
        // add each match to the found collection
        found.push(item);
      }
    }
    if (!multi) {
      // pass null when not found in case single item is desired
      found = null;
    }
    // TODO add fields support - select desired fields only
    // pass found data to callback along with null as error
    callback(null, (count) ? found.length : found);
  } // END of _through

  return Model;
} // END of makeModel

// ----------------------
// Model - implementation
// ----------------------

function modelSave(callback) {
  // TODO filter stored data using schema of this model before saving
  // store data to the database under the id
  this._db[this._key][this._data._id] = this._data;
  // inform the caller about result of the operation
  callback(null, this._data);
} // END of save

// ---------------
// Local utilities
// ---------------

function getUpdateItem(update) {
  return function(col, id) {
    var item = col[id];
    for (var key in update) {
      item[key] = update[key];
    }
    return item;
  }
} // END of getUpdateItem

function removeItem(col, id) {
  col[id] = null;
  delete col[id];
} // END of removeItem

function getBack(col, id) {
  return col[id];
} // END of getBack

// creates database
// - not safe - replaces existing database
function createDB(name) {
  dbs[name] = {};
  return getDB(name);
}

// returns database according to its name
// - not safe - returns undefined if the database does not exist
function getDB(name) {
  return dbs[name];
}

// compares object with conditions
// - returns boolean
//   - false if the object does not satisfy the conditions
//   - true if the object does satisfy the conditions
function satisfies(o, conditions) {
  for (var key in conditions) {
    var match = false;
    switch (typeof conditions[key]) {
      case 'object':
        // RegExp supported from object types
        if (conditions[key] instanceof RegExp) {
          match = conditions[key].test(o[key])
        // ObjectId supported from object types
        } else if (conditions[key] instanceof ObjectId) {
          match = ('' + conditions[key]) === ('' + o[key])
        }
        break;
      default:
        // primitive data types comparison
        match = o[key] === conditions[key];
    }
    if (!match) {
      // current condition is not satisfied
      return false;
    }
  }
  // all conditions satisfied
  return true;
} // END of satisfies

// -------------------------------------------------------------------
// PUBLIC INTERFACE
// -------------------------------------------------------------------

module.exports = {
  Connection: Connection,
  Types     : base.Types
};

