var assert  = require('assert')
  , fs      = require('fs')
  , path    = require('path')
  , util    = require('util')
;

module.exports = {
  FileLogger: FileLogger
};

function FileLogger(logPath) {
  assert('string' === typeof logPath, 'Log file path must be a string, but is "' + typeof logPath + '"');
  assert(fs.existsSync(path.dirname(logPath)), 'Log path parent directory "' + path.dirname(logPath) + '" must exist')

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
