  var fs = require('fs-extra')
    , path = require('path')
  ;

  // Make sure log directory for http tests does exist.
  var logPath = path.join(__dirname, '..', 'test', 'examples', 'http', 'log');
  fs.ensureDirSync(logPath);
