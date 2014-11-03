const APP_ERR                   = {
        // TODO move string messages to external file
        FS_READLINK             : 'An error occurred while trying to read a symbolic link "%s."'
      , FS_READDIR              : 'An error occurred while trying to read a directory "%s".'
      , FS_STAT                 : 'An error occurred while trying to read a file metadata at "%s."'
      , INVALID_FILE_FORMAT     : 'Invalid format of a file "%s".'
      , INVALID_CHILDREN_FORMAT : 'Invalid format of files container for a directory "%s".'
      }
  ,   FS_ERR_ENOTDIR            = 'ENOTDIR'
  ,   FS_ERR_ENOENT             = 'ENOENT'
  ,   FS_DEFAULT_NEXT_ROUTE_ERR = FS_ERR_ENOENT
  ,   RESPONSE_TYPE_JSON        = 'json'
  ,   EVERY_ROUTE_EXP           = '*'
;

// get required modules
var express = require('express')
  , fs = require('fs')
  , path = require('path')
  , util = require('util')
  , async = require('async')
  , _ = require('underscore')
;


// -------------------------------------------------------------------
// CUSTOM MIDDLEWARE DEFINITIONS
// -------------------------------------------------------------------

// prevents fs error to occur when not a link by reading stats of the current path
function fsLinkSafeMiddleware(req, res, next) {
  if (req.fcmder.fs.path.stats.isLink) {
    fsLinkMiddleware(req, res, next);
    return;
  }
  next();
} // END of fsLinkSafeMiddleware

// resolves link at the current path and stores the result for next middleware
function fsLinkMiddleware(req, res, next) {
  // read the link at the current path
  var ofs = req.fcmder.fs;
  fs.readlink(ofs.path.mount + ofs.path.name, function(err, original) {
    if (err) {
      // ... ERROR occured => pass the request to the error handler or next route
      utilHandleFsMiddlewareError(err, next, APP_ERR.FS_READLINK, ofs.path.name);
      return;
    }
    // ... link SUCCESSFULLY read => pass the request to the next
    ofs.path.original = original;
    next();
  });
} // END of fsLinkMiddleware

// prevents fs error to occur when not a directory by reading stats of the current path
function fsDirectorySafeMiddleware(req, res, next) {
  if (req.fcmder.fs.path.stats.isDir) {
    fsDirectoryMiddleware(req, res, next);
    return;
  }
  next();
} // END of fsDirectorySafeMiddleware

// reads content of the current directory and stores the result for next middleware
function fsDirectoryMiddleware(req, res, next) {
  // read a content of the directory
  var ofs = req.fcmder.fs;
  fs.readdir(ofs.path.mount + ofs.path.name, function(err, files) {
    if (err) {
      // ... ERROR occured => pass the request to the error handler or next route
      utilHandleFsMiddlewareError(err, FS_ERR_ENOTDIR, next, APP_ERR.FS_READDIR, ofs.path.name);
      return;
    }
    // ... directory SUCCESSFULLY read => pass the request to the next
    ofs.files = {
      names: files,
      stats: {}
    };
    next();
  });
} // END of fsDirectoryMiddleware

// gets details about files contained in the current directory
function fsStatFilesMiddleware(req, res, next) {
  // get stats about files
  var ofs = req.fcmder.fs;
  async.each(ofs.files.names, function(file, eachNext) {
    fs.lstat(ofs.path.mount + ofs.path.name + file, function(err, stats) {
      if (err) {
        // ... ERROR occured => pass the request to the error handler or next route
        utilHandleFsMiddlewareError(err, eachNext, APP_ERR.FS_STAT, ofs.path.name + file);
        return;
      }
      // ... file SUCCESSFULLY stated => continue with the next one
      ofs.files.stats[file] = utilTransformFsStats(stats);
      eachNext();
    });
  }, next);
} // END of fsStatFilesMiddleware

// serves public directories/files
function getFsPathMiddleware(staticPath) {
  return function(req, res, next) {
    // check existence of the path
    var fspath = req.fcmder.req.url;
    fs.exists(staticPath + fspath, function(exists) {
      if (!exists) {
        // ... path NOT FOUND => pass the request to the next middleware sub-stack
        next('route');
        return;
      }
      // ... path FOUND => continue with the request
      req.fcmder.fs.path = {
        mount : staticPath,
        name  : fspath
      };
      next();
    });
  }
} // END of getFsPathMiddleware

// gets details about specified file system path
function fsStatPathMiddleware(req, res, next) {
  var fspath = req.fcmder.fs.path;
  fs.lstat(fspath.mount + fspath.name, function(err, stats) {
    if (err) {
      // ... ERROR occured => pass the request to the error handler or next route
      utilHandleFsMiddlewareError(err, next, APP_ERR.FS_STAT, ofs.path.name);
      return;
    }
    fspath.stats = utilTransformFsStats(stats);
    next();
  });
} // END of fsStatPathMiddleware

// initializes request specific parameters
// - shall be the first one from custom middleware chain
function reqInitMiddleware(req, res, next) {
  req.fcmder = {
    req: {
      url: decodeURIComponent(req.url)
    },
    fs: {}
  };
  next();
} // END of reqInitMiddleware

// investigates gathered request data and sends response if everything is OK
function getSuccessJsonMiddleware(mount) {
  return function (req, res, next) {
    var reqfs = req.fcmder.fs;
    // check result of preceding middleware stack
    if (!reqfs.path || !reqfs.path.mount || !reqfs.path.name || !reqfs.path.stats) {
      // path has not been found or processed by preceding middleware stack
      next('route');
      return;
    }

    var result = {
      mounts: {
        root: mount
      }
    };

    if (reqfs.path.stats.isDir) {
      if (!_.isArray(reqfs.files.names)) {
        next({
          desc    : utilErrCode2Msg(APP_ERR.INVALID_CHILDREN_FORMAT, reqfs.path.name),
          resType : RESPONSE_TYPE_JSON
        });
        return;
      }
      // get details about directory
      // ... content of the directory
      result.children = reqfs.files.names;
      result.path = reqfs.path.name;
      result.name = '.';
    } else if (reqfs.path.stats.isFile) {
      // get details about file
      // ... metadata
      result.meta = reqfs.path.stats;
      // ... path to a parent directory
      result.path = path.dirname(reqfs.path.name)
      // ... file name
      result.name = path.basename(reqfs.path.name);
      // ... relative path from api mount to download api
      //     - client gets href like this: href = path.join(mounts.root, mounts.download, path, name)
      result.mounts.download = '..';
    } else if (reqfs.path.stats.isLink) {
      // get details about link
      // ... metadata
      result.meta = reqfs.path.stats;
      // ... path to a parent directory
      result.path = path.dirname(reqfs.path.name)
      // ... file name
      result.name = path.basename(reqfs.path.name);
      // ... relative path from current directory to the original file
      //     - client gets api link like this: link = path.join(mounts.root, path, original)
      result.original = reqfs.path.original;
    } else {
      next({
        desc    : utilErrCode2Msg(APP_ERR.INVALID_FILE_FORMAT, reqfs.path.name),
        resType : RESPONSE_TYPE_JSON
      });
      return;
    }
    res.json(result);
  }
} // END of getSuccessJsonMiddleware

// checks result of preceding processing
function plainResultValidatorMiddleware(req, res, next) {
  var ofs = req.fcmder.fs;

  if (!ofs.path || !ofs.path.mount || !ofs.path.name || !ofs.path.stats ||
      !ofs.path.stats.isDir) {
    // path has not been found or processed by preceding middleware stack
    // or is not a directory
    next();
    return;
  }

  if (ofs.path.stats.isDir && !_.isArray(ofs.files.names)) {
    // invalid data => invoke internal error
    next({
      desc: utilErrCode2Msg(APP_ERR.INVALID_CHILDREN_FORMAT, ofs.path.name)
    });
    return;
  }

  // everything seems to be OK
  next('route');
} // END of plainResultValidatorMiddleware

// checks result of preceding processing
function mainResultValidatorMiddleware(req, res, next) {
  var ofs = req.fcmder.fs;

  if (!ofs.path || !ofs.path.mount || !ofs.path.name) {
    // path has not been found or processed by preceding middleware stack
    next();
    return;
  }

  // everything seems to be OK
  next('route');
} // END of mainResultValidatorMiddleware

function notFoundCommonMiddleware(req, res, next) {
  res.status(404);
  next();
}

function notFoundJsonMiddleware(req, res, next) {
  // TODO format the message better
  res.json({key: 'REST NOT FOUND'});
}

// used to signalize user of this module that this module was
// not able to handle this request - like 404 http state
function notFoundHandoverMiddleware(req, res, next) {
  req.fcmder = null;
  next();
}


// -------------------------------------------------------------------
// UTILITIES DEFINITIONS
// -------------------------------------------------------------------

// arguments
// ... err, custom, next, code, <zero or more parameters for the message>
function utilHandleFsMiddlewareError() {
  // "custom" is optional
  var err = arguments[0], custom, next, code;

  // position (in the arguments array) of a first parameter for the message
  // in case all optionals arguments are specified
  var p = 4;

  // map parameters according to usage of optional parameter(s)
  if (_.isFunction(arguments[1])) {
    p--;
    custom = null;
    next = arguments[1];
    code = arguments[2];
  } else {
    custom = arguments[1]
    next = arguments[2];
    code = arguments[3];
  }

  // add default error pattern
  var pattern = '(' + FS_DEFAULT_NEXT_ROUTE_ERR;
  if (!!custom && _.isString(custom)) {
    pattern += '|' + custom;
  } else if (_.isArray(custom)) {
    pattern += '|' + custom.join('|');
  }
  pattern += ')';

  var exp = new RegExp(pattern);
  // test the created expression
  if (exp.test(err.code)) {
    // no such file or directory or custom error code detected
    // => go to other middleware sub-stack
    next('route');
    return;
  }

  // other error => invoke error middleware
  // ... prepare arguments for error message printer
  var args = [code];
  for (var i = p; i < arguments.length; i++) {
    args.push(arguments[i]);
  }
  // ... invoke the error middleware by formatted error
  next({
    desc  : utilErrCode2Msg.apply(null, args),
    err   : err
  });
} // END of utilHandleFsMiddlewareError

// prints error message according to the error code and given parameters (printf-like)
// arguments
// ... error code
// ... zero or more than zero parameters
function utilErrCode2Msg() {
  // TODO when the error code is provided instead of the message load the message at first
  return util.format.apply(null, arguments);
}

function utilMount2Prefix(mount) {
  return (!mount || mount == '/') ? '' : mount;
}

function utilTransformFsLstats(stats) {
  return {
    size    : stats.size,
    mtime   : stats.mtime,
    isDir   : stats.isDirectory(),
    isFile  : stats.isFile(),
    isLink  : stats.isSymbolicLink()
  };
}

var utilTransformFsStats = utilTransformFsLstats;


// -------------------------------------------------------------------
// SERVER BASED APPLICATION
// -------------------------------------------------------------------
// - supposed to be used to support clients without JavaScript

function createServerBased(settings) {
  const PUBLIC_FILES_PATH   = settings.publicFiles
    ,   STATIC_SETTINGS     = {
          dotfiles: settings.dotfiles
        }
  ;

  // check settings validity
  if (!PUBLIC_FILES_PATH) {
    throw new Error("file-commander: path to public files has to be specified.");
  }

  // get app
  var app = express();

  // get an instance of the express Router
  var plain = express.Router();
  var last = express.Router();

  // -------------------------------------------------------------------
  // ROUTER CONFIGURATIONS
  // -------------------------------------------------------------------

  // PLAIN APP router configuration
  // -------------------------------------------------------------------
  // - serves directories only, other file types are served as not found

  // add app routing logic
  plain.route(EVERY_ROUTE_EXP)
  .all(
    getFsPathMiddleware(PUBLIC_FILES_PATH),
    fsStatPathMiddleware
  )
  .get(
    fsDirectoryMiddleware,
    fsStatFilesMiddleware
  );

  // LAST router configuration
  // -------------------------------------------------------------------

  // validate result of plain app
  last.route(EVERY_ROUTE_EXP)
  .all(
    plainResultValidatorMiddleware,
    notFoundHandoverMiddleware
  );

  // -------------------------------------------------------------------
  // APP CONFIGURATION
  // -------------------------------------------------------------------

  // middleware configuration
  // -------------------------------------------------------------------

  // serving public files for PLAIN app
  app.use(express.static(PUBLIC_FILES_PATH, STATIC_SETTINGS));

  // request is not a public file - perform initialization
  app.use(reqInitMiddleware);
  // mount PLAIN app router
  app.use(plain);
  // mount LAST app router
  app.use(last);

  return app;
} // END of createServerBased


// -------------------------------------------------------------------
// REST BASED APPLICATION
// -------------------------------------------------------------------
// - supposed to be used with REST capable clients

function createRestBased(settings) {
  const PUBLIC_FILES_PATH   = settings.publicFiles
    ,   APP_URL_PREFIX      = utilMount2Prefix(settings.mount)
    ,   REST_API_URL_MOUNT  = '/rest-api'
    ,   STATIC_SETTINGS     = {
          dotfiles: settings.dotfiles
        }
  ;

  // check settings validity
  if (!PUBLIC_FILES_PATH) {
    throw new Error("file-commander: path to public files has to be specified.");
  }

  // get app
  var app = express();

  // get an instance of the express Router
  var main = express.Router();
  var last = express.Router();
  var rest = express.Router();

  // -------------------------------------------------------------------
  // ROUTER CONFIGURATIONS
  // -------------------------------------------------------------------

  // MAIN APP router configuration
  // -------------------------------------------------------------------

  // add app routing logic
  // - serving existing content in public directory
  // - files should be served by preceding middleware
  main.route(EVERY_ROUTE_EXP)
  .all(
    getFsPathMiddleware(PUBLIC_FILES_PATH)
  );

  // LAST router configuration
  // -------------------------------------------------------------------

  // validate result of main app
  last.route(EVERY_ROUTE_EXP)
  .all(
    mainResultValidatorMiddleware,
    notFoundHandoverMiddleware
  );

  // REST api router configuration
  // -------------------------------------------------------------------
  // define routes and handlers for the api
  // - api
  //   - GET
  //     - <directory_url>  list directory content
  //                        - return array of file names only
  //     - <file_url>       get details about file (metadata and url)
  //   - PUT
  //     - <directory_url>  rename directory - like mv command
  //     - <file_url>       rename file - like mv command
  //   - POST
  //     - <directory_url>  create default file (directory) in the directory
  //                        with default name ("untitledX") and return the name
  //     - <file_url>       upload a new file or a new version of an existing file
  //   - DELETE
  //     - <directory_url>  remove directory (what about the content?
  //                        - "rm -rf" or "rmdir" like)
  //     - <file_url>       remove file
  //   - OPTIONS
  //     ?

  // initialize request specifics
  rest.use(reqInitMiddleware);

  // add app routing logic
  rest.route(EVERY_ROUTE_EXP)
  .all(
    getFsPathMiddleware(PUBLIC_FILES_PATH),
    fsStatPathMiddleware
  )
  .get(
    fsLinkSafeMiddleware,
    fsDirectorySafeMiddleware
  )
  .all(
    // investigate data and send OK response if possible
    getSuccessJsonMiddleware(APP_URL_PREFIX + REST_API_URL_MOUNT)
  );

  // finish middleware stack by NOT FOUND response
  rest.route(EVERY_ROUTE_EXP)
  .all(
    notFoundCommonMiddleware,
    notFoundJsonMiddleware
  );

  // -------------------------------------------------------------------
  // APP CONFIGURATION
  // -------------------------------------------------------------------

  // middleware configuration
  // -------------------------------------------------------------------

  // mount REST router - make the app RESTful
  app.use(REST_API_URL_MOUNT, rest);

  // serving public files for MAIN app
  app.use(express.static(PUBLIC_FILES_PATH, STATIC_SETTINGS));

  // request is not REST or public file - perform initialization
  app.use(reqInitMiddleware);
  // mount MAIN app router
  app.use(main);
  // mount LAST app router
  app.use(last);

  return app;
} // END of createRestBased


// -------------------------------------------------------------------
// PUBLIC INTERFACE
// -------------------------------------------------------------------

module.exports = {
  serverBased : createServerBased,
  restBased   : createRestBased
};
