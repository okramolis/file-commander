const ARRAY_QUOTED_DELIMITER    = '", "'
  ,   FS_NOT_ALLOWED_CHARS_ARR  = ['<', '>', '|', '?', '*', ':', '/', '%', '$', '\\']
  ,   FS_NOT_ALLOWED_CHARS_EXP  = utilFsBuildNotAllowedCharsRegExp(FS_NOT_ALLOWED_CHARS_ARR)
  ,   FS_NOT_ALLOWED_CHARS_STR  = FS_NOT_ALLOWED_CHARS_ARR.join(ARRAY_QUOTED_DELIMITER)
  ,   APP_ERR                   = {
        // TODO move string messages to external file
        FS_READLINK             : 'An error occurred while trying to read a symbolic link "%s".'
      , FS_READDIR              : 'An error occurred while trying to read a directory "%s".'
      , FS_STAT                 : 'An error occurred while trying to read a file metadata at "%s".'
      , FS_MKDIR                : 'An error occurred while trying to create a directory "%s" at "%s".'
      , FS_COPY                 : 'An error occurred while trying to copy a file or directory "%s" to "%s".'
      , FS_MOVE                 : 'An error occurred while trying to move a file or directory "%s" to "%s".'
      , FS_RENAME               : 'An error occurred while trying to rename a file or directory "%s" to "%s".'
      , FS_REMOVE               : 'An error occurred while trying to remove a file or directory "%s".'
      , FS_UPLOAD               : 'An error occurred while trying to upload file(s) to path "%s".'
      , FS_POST_UPLOAD          : 'An error occurred during post upload processing of file(s).'
      , INVALID_FILE_FORMAT     : 'Invalid format of a file "%s".'
      , INVALID_CHILDREN_FORMAT : 'Invalid format of files container for a directory "%s".'
      , INVALID_REQUEST_FORMAT  : 'Invalid format of request.'
      }
  ,   APP_OK                    = {
        FS_MKDIR                : 'The directory "%s" successfully created at "%s".'
      , FS_UPLOAD               : 'The file(s) "%s" successfully uploaded to "%s".'
      , FS_COPY                 : 'The file or directory "%s" successfully copied to "%s".'
      , FS_MOVE                 : 'The file or directory "%s" successfully moved to "%s".'
      , FS_RENAME               : 'The file or directory "%s" successfully renamed to "%s".'
      , FS_REMOVE               : 'The file or directory "%s" successfully removed.'
      }
  ,   APP_WARN                  = {
        FS_POST_UPLOAD_ALL      : 'All uploaded files have been rejected by server ("%s").'
      , FS_POST_UPLOAD_MIXED    : 'Some uploaded files have been rejected by server ("%s"). ' +
                                  'Other files have been accepted ("%s").'
      , FS_UPLOAD_NONE          : 'No files have been uploaded.'
      , FS_OVERWRITE_EXIST      : 'The name "%s" is already taken. Please choose a different name.'
      , FS_DIR_NOTEMPTY         : 'Cannot remove not empty directory "%s".'
      , NOT_FOUND               : 'No resources have been found on the requested address.'
      , FS_NOT_ALLOWED_CHARS    : 'Not allowed characters detected in name "%s". ' +
                                  'Please avoid using of these characters: "' + FS_NOT_ALLOWED_CHARS_STR + '". ' +
                                  'Please also avoid a dot character "." at the beginning of the name and ' +
                                  'invisible characters from x00 to x1F anywhere. Also empty name is not allowed.'
      }
  ,   FS_ERR_ENOTEMPTY          = 'ENOTEMPTY'
  ,   FS_ERR_ENOTDIR            = 'ENOTDIR'
  ,   FS_ERR_ENOENT             = 'ENOENT'
  ,   FS_ERR_EEXIST             = 'EEXIST'
  ,   APP_ERR_FSNAME_INVALID    = 'FCMDER_FSNAME_INVALID'
  ,   APP_ERR_ATTEMPTS_OVERFLOW = 'FCMDER_ATTEMPTS_OVERFLOW'
  ,   FS_DEFAULT_NEXT_ROUTE_ERR = FS_ERR_ENOENT
  ,   FS_DEFAULT_DIRECTORY_NAME = 'untitled folder'
  ,   FS_NUM_SUFFIX_DELIMITER   = ' '
  ,   FS_MKDIR_ATTEMPTS_LIMIT   = 22
  ,   FS_MKDIR_RANDOM_ATTEMPTS  = 2
  ,   ENC_MULTIPART_FORM_DATA   = 'multipart/form-data'
  ,   ENC_URL_ENCODED           = 'application/x-www-form-urlencoded'
  ,   ENC_JSON                  = 'application/json'
  ,   RESPONSE_TYPE_JSON        = 'json'
  ,   EVERY_ROUTE_EXP           = '*'
  ,   UPLOAD_METHOD_EXP         = /^post$/
  ,   TUNNELED_METHOD_FIELD     = '_method'
  ,   MIME_SUPPORT              = {
        "application/pdf"       : true
      , "text/plain"            : true
      , "text/html"             : true
      }
;

// get required modules
var express = require('express')
  , is = require('type-is')
  , fs = require('fs')
  , fsx = require('fs-extra')
  , path = require('path')
  , util = require('util')
  , mime = require('mime-magic')
  , async = require('async')
  , uploader = require('formidable')
  , _ = require('underscore')
;

// validate default directory name
if (!utilFsValidateFilename(FS_DEFAULT_DIRECTORY_NAME)) {
  throw new Error(
    'Invalid default directory name.\n' +
    utilErrCode2Msg(APP_WARN.FS_NOT_ALLOWED_CHARS, FS_DEFAULT_DIRECTORY_NAME)
  );
}
// validate default directory name numeric suffix delimiter
if (!utilFsValidateFilename(FS_NUM_SUFFIX_DELIMITER)) {
  throw new Error(
    'Invalid numeric suffix delimiter.\n' +
    utilErrCode2Msg(APP_WARN.FS_NOT_ALLOWED_CHARS, FS_NUM_SUFFIX_DELIMITER)
  );
}

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

// ensures provided encoding for current middleware sub-stack only
function getEnsureEncodingMiddleware(types) {
  return function (req, res, next) {
    // use "is" module directly as req.is checks body length
    if (!is.is(req.get('Content-type'), types)) {
      // req content type IS NOT supported
      next('route');
      return;
    }
    // req content type IS supported
    next();
  }
} // END of getEnsureEncodingMiddleware

// middleware for removing file system elements
// - validates request arguments
// - uses utility function for the removal itself
function fsDeleteMiddleware(req, res, next) {
  debugger;
  var fspath  = req.fcmder.fs.path
    , source  = fspath.name
    , name    = path.basename(source)
  ;

  // check the path is not a root directory of static files and is absolute path
  if (!name || !utilFsIsAbsolutePath(source)) {
    // respond with not found (404) or forbidden (403)
    next('route');
    return;
  }
  // setup options
  var options = {force: req.body.hasOwnProperty('force')};
  // perform the removal
  utilFsRemove(path.join(fspath.mount, source), fspath.stats, options, function(err) {
    // check result
    debugger;
    if (!err) {
      // success
      utilSetReqState(req, utilOkCode2Msg(APP_OK.FS_REMOVE, name));
      next('route');
      return;
    }
    if (!utilMatchError(err, FS_ERR_ENOTEMPTY)) {
      // unexpected error occured
      utilSetReqState(
        req,
        utilErrCode2Msg(APP_ERR.FS_REMOVE, name),
        utilErr2Desc(err),
        500
      );
      next('route');
      return;
    }
    // trying to remove not empty directory without force flag - 409 conflict
    utilSetReqState(
      req,
      utilWarnCode2Msg(APP_WARN.FS_DIR_NOTEMPTY, name),
      null,
      409
    );
    next('route');
  });
} // END of fsDeleteMiddleware

// selects appropriate middleware for the desired task according to request properties
function fsPostSwitchMiddleware(req, res, next) {
  debugger;
  if (!req.fcmder.fs.path.stats.isDir) {
    // current location is not a directory - not able to serve the request
    next();
    return;
  }
  if (req.is(ENC_MULTIPART_FORM_DATA)) {
    // upload file(s) to current directory
    fsUploadMiddleware(req, res, next);
    return;
  }
  if (!!req.body.local) {
    // copy/move file/directory to current directory
    fsMovementsMiddleware(req, res, next);
    return;
  }
  // create a new directory in the current directory
  fsMkdirMiddleware(req, res, next);
} // END of fsPostSwitchMiddleware

// copies local file to current location if possible
// REQUIREMENT: current location SHALL be directory
// DRAWBACK   : source file location is limited to be from the same
//              static path like the current directory
// TODO work correctly with symbolic links
//      currently
//      - renaming
//        - ok
//      - copying
//        - works with the source file
//      - moving
//        - makes the link corrupted
function fsMovementsMiddleware(req, res, next) {
  var fspath  = req.fcmder.fs.path
    , mount   = fspath.mount
    , source  = req.body.local
  ;
  debugger;
  // make sure source is in right format - not null or undefined but valid string
  if (!source || !_.isString(source)) {
    // invalid attribute => respond with not found (404) or bad request (400)
    next('route');
    return;
  }
  // check validity of source path
  // 1. source path must be inside the root directory or deeper - not the root itself
  // 2. source path must be absolute
  if (!path.basename(source) || !utilFsIsAbsolutePath(source)) {
    // root path or relative path detected => respond with not found (404) or forbidden (403)
    next('route');
    return;
  }

  // new name is optional - take it from user if provided or use the same as local source
  var newname = (req.body.name || path.basename(source)) + '';
  // check validity of the new file name and check it is not a file path
  if (!utilFsValidateFilename(newname) || !utilFsIsBasename(newname)) {
    // not allowed characters in file name or path detected
    // => respond with not found (404) or forbidden (403)
    next('route');
    return;
  }

  // destination is current path - directory - joined with basename of the element
  var dest = path.join(fspath.name, newname);

  // determine performed action - MOVE (default), RENAME or COPY
  var handler = utilFsMove
    , codeOK  = APP_OK.FS_MOVE
    , codeERR = APP_ERR.FS_MOVE
  ;

  if (req.body.hasOwnProperty('preserve')) {
    // copying
    handler = utilFsCopy;
    codeOK  = APP_OK.FS_COPY;
    codeERR = APP_ERR.FS_COPY;
  } else if (path.dirname(source) == path.dirname(dest)) {
    // moving in current directory - renaming
    codeOK  = APP_OK.FS_RENAME;
    codeERR = APP_ERR.FS_RENAME;
  }

  handler(path.join(mount, source), path.join(mount, dest), function(err) {
    debugger;
    if (!err) {
      // success
      utilSetReqState(req, utilOkCode2Msg(codeOK, source, dest));
      next('route');
      return;
    }
    if (!utilMatchError(err, FS_ERR_EEXIST)) {
      // unexpected error occured
      utilSetReqState(
        req,
        utilErrCode2Msg(codeERR, source, dest),
        utilErr2Desc(err),
        500
      );
      next('route');
      return;
    }
    // file cannot be copied - another file with the same name exists - 409 conflict
    utilSetReqState(
      req,
      utilWarnCode2Msg(APP_WARN.FS_OVERWRITE_EXIST, newname),
      null,
      409
    );
    next('route');
  });
} // END of fsMovementsMiddleware

function fsMkdirMiddleware(req, res, next) {
  var fsmount = req.fcmder.fs.path.mount
    , fsname  = req.fcmder.fs.path.name
  ;

  var newname = req.body.name;
  utilFsCreateDirectory(fsmount + fsname, newname, function(err, dirname) {
    debugger;
    if (!err) {
      // the new directory successfully created
      utilSetReqState(req, utilOkCode2Msg(APP_OK.FS_MKDIR, dirname || newname, fsname));
      next('route');
      return;
    }
    // some error occurred
    if (utilMatchError(err, FS_ERR_EEXIST)) {
      // the same name already exists
      utilSetReqState(
        req,
        utilWarnCode2Msg(APP_WARN.FS_OVERWRITE_EXIST, dirname || newname),
        null,
        409
      );
      next('route');
      return;
    }
    if (utilMatchError(err, APP_ERR_FSNAME_INVALID)) {
      // not allowed characters detected in desired directory name
      utilSetReqState(
        req,
        utilWarnCode2Msg(APP_WARN.FS_NOT_ALLOWED_CHARS, dirname || newname),
        null,
        409
      );
      next('route');
      return;
    }
    // unexpected error occurred
    utilSetReqState(
      req,
      utilErrCode2Msg(APP_ERR.FS_MKDIR, dirname || newname, fsname),
      utilErr2Desc(err),
      500
    );
    next('route');
  });
} // END of fsMkdirMiddleware

function fsUploadMiddleware(req, res, next) {
  var fsmount = req.fcmder.fs.path.mount
    , fsname  = req.fcmder.fs.path.name
  ;

  // parse a file upload
  var form = new uploader.IncomingForm()
    , files = []
    , fields = {}
  ;
  // TODO use default tmp directory
  form.uploadDir = fsmount + fsname;
  form.multiples = true;

  var uploading;
  form.on('field', function(field, value) {
    // store parsed field in collection
    // TODO add complex field parsing - like field == "rootfield[subfield][subsubfield]"?
    fields[field] = value;
  });
  form.on('fileBegin', function(field, file) {
    uploading = file;
    // TODO check claimed mime type
    // - if not supported, respond that mime type not supported + process successfully uploaded files
  });
  form.on('file', function(field, file) {
    files.push([field, file]);
  });
  form.on('end', function() {
    // upload successfully finished
    utilFsPostUpload(files, fsmount + fsname, function(err, accepted, rejected) {
      if (err) {
        // post upload processing failed
        utilSetReqState(
          req,
          utilErrCode2Msg(APP_ERR.FS_POST_UPLOAD),
          utilErr2Desc(err),
          500
        );
        next('route');
        return;
      }

      // post upload processing succeeded
      if (!rejected.length && !accepted.length) {
        // no files uploaded
        utilSetReqState(
          req,
          utilWarnCode2Msg(APP_WARN.FS_UPLOAD_NONE)
        );
      } else if (!!rejected.length && !accepted.length) {
        // all files rejected
        utilSetReqState(
          req,
          utilWarnCode2Msg(
            APP_WARN.FS_POST_UPLOAD_ALL,
            rejected.join(ARRAY_QUOTED_DELIMITER)
          )
        );
      } else if (!rejected.length && !!accepted.length) {
        // all files accepted
        utilSetReqState(
          req,
          utilOkCode2Msg(
            APP_OK.FS_UPLOAD,
            accepted.join(ARRAY_QUOTED_DELIMITER),
            fsname
          )
        );
      } else { // if (!!rejected.length && !!accepted.length) {
        // at least one file rejected and at least one file accepted
        utilSetReqState(
          req,
          utilWarnCode2Msg(
            APP_WARN.FS_POST_UPLOAD_MIXED,
            rejected.join(ARRAY_QUOTED_DELIMITER),
            accepted.join(ARRAY_QUOTED_DELIMITER)
          )
        );
      }
      next('route');

      // finally make sure all temporary files are deleted
      utilFsPostUploadCleanup(files);
    });
  });
  form.on('error', function(err) {
    if (err) {
      // error occured during upload
      utilSetReqState(
        req,
        utilErrCode2Msg(APP_ERR.FS_UPLOAD, fsname),
        utilErr2Desc(err),
        500
      );
      next('route');
      return;
    }
  });
  // start parsing
  form.parse(req);
} // END of fsUploadMiddleware

// initializes request specific parameters
// - shall be the first one from custom middleware chain
function reqInitMiddleware(req, res, next) {
  req.fcmder = {
    req: {
      url: decodeURIComponent(req.url)
    },
    state: {},
    fs: {}
  };
  if (!req.session.hasOwnProperty('fcmder')) {
    req.session.fcmder = {};
  }
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

// checks result of preceding processing for GET method
function plainResultValidatorMiddleware(req, res, next) {
  var ofs = req.fcmder.fs;

  if (!ofs.path || !ofs.path.mount || !ofs.path.name || !ofs.path.stats ||
      !ofs.path.stats.isDir) {
    // path has not been found or processed by preceding middleware stack
    // or is not a directory
    next();
    return;
  }

  // ofs.files.names must be array only if ofs.files are defined
  if (ofs.path.stats.isDir && ofs.files && !_.isArray(ofs.files.names)) {
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

// checks result of preceding processing for non GET methods
function plainResultStateValidatorMiddleware(req, res, next) {
  var state = req.fcmder.state;
  if (!state || !state.code || state.code == 404) {
    // NOT FOUND
    next();
    return;
  }
  // at least FOUND
  next('route');
} // END of plainResultStateValidatorMiddleware

// checks result of preceding processing for non GET methods
// and sends json response if possible
function resolveJsonStateMiddleware(req, res, next) {
  var state = req.fcmder.state;
  if (!state || !state.code || state.code == 404) {
    // pass NOT FOUND status to next middleware
    next();
    return;
  }
  res.status(state.code).json(utilReqState2ResJson(state));
} // END of resolveJsonStateMiddleware

// performs common tasks for not found status before the response is sent
function notFoundCommonMiddleware(req, res, next) {
  res.status(404);
  next();
}

// sends not found response in form of json data
function notFoundJsonMiddleware(req, res, next) {
  res.json(utilReqState2ResJson({
    code: 404,
    msg : utilWarnCode2Msg(APP_WARN.NOT_FOUND)
  }));
}

// used to signalize user of this module that this module was
// not able to handle this request - like 404 http state
function notFoundHandoverMiddleware(req, res, next) {
  req.fcmder = null;
  next();
}


// -------------------------------------------------------------------
// FILE SYSTEM UTILITIES DEFINITIONS
// -------------------------------------------------------------------

// removes file/link/directory according to passed stats and options
function utilFsRemove(fspath, stats, options, callback) {
  var handler = null;
  // setup handler
  if (stats.isFile || stats.isLink) {
    // simply remove file
    handler = fs.unlink;
  } else if (stats.isDir) {
    // check "force" attribute to use appropriate handler
    if (!options.force) {
      // remove only empty directory
      handler = fs.rmdir;
    } else {
      // remove directory including its content
      handler = fsx.remove;
    }
  } else {
    // invoke not found like error
    callback({code: FS_ERR_ENOENT});
    return;
  }
  // perform the removal
  handler(fspath, callback);
} // END of utilFsRemove

// moves file
// - does not overwrite file if it exists,
//   but returns an error FS_ERR_EEXIST
function utilFsMove(oldPath, newPath, callback) {
  fs.exists(newPath, function(exists) {
    if (exists) {
      callback({code: FS_ERR_EEXIST});
      return;
    }
    fs.rename(oldPath, newPath, callback);
  });
} // END of utilFsMove

// copies file
// - does not overwrite file if it exists,
//   but returns an error FS_ERR_EEXIST
function utilFsCopy(oldPath, newPath, callback) {
  fs.exists(newPath, function(exists) {
    if (exists) {
      callback({code: FS_ERR_EEXIST});
      return;
    }
    fsx.copy(oldPath, newPath, callback);
  });
} // END of utilFsCopy

// creates directory according to provided arguments
// - high level utility
// - if the desired name is already taken, it tries to add a numeric suffix
//   - perfomed by low level utility
//   - number of attempts is limited by global constant
function utilFsCreateDirectory(dirpath, dirname, callback) {
  // dirname is optional if not specified, the default directory name is used
  debugger;
  var usernamed = true; // user provided directory name
  if (_.isFunction(dirname)) {
    callback = dirname;
    dirname = null;
  }
  if (!dirname || !_.isString(dirname)) {
    usernamed = false;
    dirname = FS_DEFAULT_DIRECTORY_NAME;
  }
  if (!utilFsValidateDirname(dirname)) {
    callback({
      msg : 'Invalid name of a new directory.',
      code: APP_ERR_FSNAME_INVALID
    }, dirname);
    return;
  }
  // try to create directory and check the result
  var joined = path.join(dirpath, dirname);
  fs.mkdir(joined, function(err) {
    debugger;
    if (!err) {
      // directory successfully created - pass its name
      callback(null, dirname);
      return;
    }
    if (usernamed || !utilMatchError(err, FS_ERR_EEXIST)) {
      // user provided directory name so pass every error type
      // or pass every error except EEXIST in case dirname has been
      // chosen by systemd
      callback(err, dirname);
      return;
    }
    // directory with default name cannot be created
    // - the same name is already in use
    // => add suffix to directory name
    var n = 2;
    utilFsMkdirSuffix(n, FS_NUM_SUFFIX_DELIMITER + n, joined, callback);
  });
} // END of utilFsCreateDirectory

// tries to create directory with supplied suffix and move
// to next suffix until directory is not created or limit is reached
function utilFsMkdirSuffix(n, suffix, fspath, callback) {
  fs.mkdir(fspath + suffix, function(err) {
    debugger;
    if (!err) {
      // successfully created - pass name of the created directory
      callback(null, path.basename(fspath) + suffix);
      return;
    }
    // check error code, continue only if FS_ERR_EEXIST
    if (!utilMatchError(err, FS_ERR_EEXIST)) {
      // unexpected error occurred => pass the error to the callback
      callback(err);
      return;
    }
    n++;
    if (FS_MKDIR_ATTEMPTS_LIMIT + 1 <= n) {
      // limit reached - pass error
      callback({
        msg : 'Maximum number of attempts reached.',
        code: APP_ERR_ATTEMPTS_OVERFLOW
      }, path.basename(fspath));
      return;
    }
    if (FS_MKDIR_ATTEMPTS_LIMIT - FS_MKDIR_RANDOM_ATTEMPTS + 1 <= n) {
      // last x attempts - generate random suffix
      suffix = FS_NUM_SUFFIX_DELIMITER + String(Math.random()).slice(2);
    } else {
      // still try to generate next name in order
      suffix = FS_NUM_SUFFIX_DELIMITER + n;
    }
    // dive into a next recursion
    utilFsMkdirSuffix(n, suffix, fspath, callback);
  });
} // END of utilFsMkdirSuffix

// returns true if name is absolute path
// - tested for not allowed patterns in absolute paths
//   - non slash character at the begining
//   - anywhere /../ or /./
//   - at the end /.. or /.
function utilFsIsAbsolutePath(name) {
  return !(/(^[^\/]|\/\.\.\/|\/\.\/|\/\.\.$|\/\.$)/.test(name));
} // END of utilFsIsAbsolutePath

// returns true if name is not a path
function utilFsIsBasename(name) {
  return (path.basename(name) === name);
} // END of utilFsIsBasename

// builds regular expression to be tested againts file names
// - characters provided by user are escaped with back slash
// - by default all characters from interval 0x00 to 0x1F are added
// - pattern to match dot files is included by default
function utilFsBuildNotAllowedCharsRegExp(chars) {
  return new RegExp('([\\x00-\\x1F\\' + chars.join('\\') + ']|^\\.)');
} // END of utilFsBuildNotAllowedCharsRegExp

function utilFsValidateFilename(name) {
  return (!!name && !(FS_NOT_ALLOWED_CHARS_EXP.test(name)));
} // END of utilFsValidateFilename

var utilFsValidateDirname = utilFsValidateFilename;

// performs post file(s) upload processing
function utilFsPostUpload(files, dest, callback) {
  var move = {}
    , notMoved = []
  ;
  // TODO build description object {<filename>: <reason why the file has been rejected>}
  //      - use status propositions
  async.each(files, function(fileArr, next) {
    var file = fileArr[1];
    debugger;
    // check file name format - 400 bad request
    if (!utilFsValidateFilename(file.name)) {
      // invalid file name
      // delete temporary file and go to next file
      notMoved.push(file.name);
      fs.unlink(file.path, next);
      return;
    }
    // check real mime type and see if allowed
    mime(file.path, function(err, type) {
      debugger;
      if (err) {
        // unexpected error occured => stop processing
        // caller should delete all temporary files
        next(err);
        return;
      }
      // check mime type support - 415 unsupported media type
      if (!utilMimeSupported(type)) {
        // mime type not supported
        // delete temporary file and go to next file
        notMoved.push(file.name);
        fs.unlink(file.path, next);
        return;
      }
      // compare mime type provided by client with the detected one - 409 conflict
      if (!utilMimeCompare(type, file.type)) {
        // mime type claimed by client not the same as the detected mime type
        // delete temporary file and go to next file
        notMoved.push(file.name);
        fs.unlink(file.path, next);
        return;
      }
      // all tests passed
      // => check file name uniqueness right before adding the file
      //    to the collection - 409 conflict
      if (!_.isUndefined(move[file.name])) {
        // at least two files with the same name detected
        // delete temporary file and go to next file
        notMoved.push(file.name);
        fs.unlink(file.path, next);
        return;
      }
      // => add the file to the collection of files to be moved to the destination
      move[file.name] = file.path;
      next();
    });
  }, function(err) {
    debugger;
    if (err) {
      // caller should delete all temporary files
      callback(err);
      return;
    }
    // prepare array of files to be moved
    var moving = _.pairs(move);
    var moved = [];
    async.eachSeries(moving, function(file, next) {
      debugger;
      // move files to their destination and give them their original name
      utilFsMove(file[1], path.join(dest, file[0]), function(err) {
        debugger;
        if (!err) {
          // file successfully moved to its destination
          moved.push(file[0]);
          next();
          return;
        }
        if (!utilMatchError(err, FS_ERR_EEXIST)) {
          // unexpected error occured
          next(err);
          return;
        }
        // file cannot be moved - another file with the same name exists - 409 conflict
        // TODO try to add suffix to file name
        // ... for now delete the temporary file
        notMoved.push(file[0]);
        fs.unlink(file[1], next);
      });
    }, function(err) {
      if (err) {
        // caller should delete all temporary files
        callback(err);
        return;
      }
      // no unexpected error occured
      // - zero or more files were successfully processed
      // - no temporary files remain in upload directory
      //   - moved to their destination or deleted
      // pass the list of successfully processed files
      callback(null, moved, notMoved);
    });
  });
} // END of utilFsPostUpload

// performs cleanup after file(s) upload
function utilFsPostUploadCleanup(files, callback) {
  // go through all files and try to delete them
  async.each(files, function(fileArr, next) {
    var file = fileArr[1];
    fs.unlink(file.path, function(err) {
      // silent error when the file does not exist
      if (err && !utilMatchError(err, FS_ERR_ENOENT)) {
        console.log(
          'file-commander ERROR: Error occured during post upload processing ' +
          'cleanup while trying to delete file "%s" with original name "%s":',
          file.path,
          file.name
        );
        console.log(err);
      }
      next();
    });
  }, function(err) {
    if (_.isFunction(callback)) {
      callback(err);
    }
  });
} // END of utilFsPostUploadCleanup

function utilMimeSupported(type) {
  return !!(MIME_SUPPORT[type]);
}

function utilMimeCompare(t1, t2) {
  return (t1 == t2);
}
// -------------------------------------------------------------------
// UTILITIES DEFINITIONS
// -------------------------------------------------------------------

function utilReqState2ResJson(state) {
  var result = {
    status  : state.code,
    message : state.msg
  };
  if (state.err) {
    result.error = {
      description: state.desc
    };
  }
  return result;
} // END of utilReqState2ResJson

function utilSetReqState(req, msg, desc, code) {
  var state = req.fcmder.state;
  state.msg = msg;
  if (code >= 400 || code < 600) {
    state.err = true;
  }
  state.code = (!code) ? 200 : code;
  if (desc) {
    state.desc = desc;
  }
}

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

var utilWarnCode2Msg = utilErrCode2Msg;
var utilOkCode2Msg = utilErrCode2Msg;

function utilErr2Desc(err) {
  return JSON.stringify(err);
}

function utilMatchError(err, code) {
  return (err.code == code);
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
  )
  .post(
    getEnsureEncodingMiddleware([ENC_URL_ENCODED, ENC_MULTIPART_FORM_DATA]),
    fsPostSwitchMiddleware
  )
  .delete(
    getEnsureEncodingMiddleware([ENC_URL_ENCODED]),
    fsDeleteMiddleware
  );

  // LAST router configuration
  // -------------------------------------------------------------------

  // validate result of plain app
  last.route(EVERY_ROUTE_EXP)
  .get(
    plainResultValidatorMiddleware
  )
  .post(
    plainResultStateValidatorMiddleware
  )
  .delete(
    plainResultStateValidatorMiddleware
  )
  .all(
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
    // TODO for better readability, move this middleware to next middleware sub-stack
    // investigate data and send OK response if possible
  , getSuccessJsonMiddleware(APP_URL_PREFIX + REST_API_URL_MOUNT)
  )
  .post(
    getEnsureEncodingMiddleware([ENC_URL_ENCODED, ENC_JSON, ENC_MULTIPART_FORM_DATA]),
    fsPostSwitchMiddleware
  )
  .delete(
    getEnsureEncodingMiddleware([ENC_URL_ENCODED, ENC_JSON]),
    fsDeleteMiddleware
  );

  rest.route(EVERY_ROUTE_EXP)
  .post(
    // see request state and inform client about result if possible
    resolveJsonStateMiddleware
  )
  .delete(
    // see request state and inform client about result if possible
    resolveJsonStateMiddleware
  )
  .all(
    // finish middleware stack by NOT FOUND response
    notFoundCommonMiddleware,
    notFoundJsonMiddleware
  );

  // TODO add error middleware here rest.use(function(err, req, res, next))
  //      - ensures all responses to REST API are served by this router

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
