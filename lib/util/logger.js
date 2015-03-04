var assert  = require('assert')
  , fs      = require('fs')
  , util    = require('util')
;

module.exports = {
  FileLogger: FileLogger
};

function FileLogger(logPath) {
  assert('string' === typeof logPath, 'Log file path must be a string');

  Object.defineProperties(this, {
    _stream: { value: fs.createWriteStream(logPath, { flags: 'a' }) },
  });
};

FileLogger.prototype.log = function() {
  this._stream.write(util.format.apply(null, arguments) + '\n');
}

FileLogger.prototype.getStream = function() {
  return this._stream;
}
