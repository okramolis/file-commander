function createApplication(settings) {
  const ROOT_FS_PATH              = settings.root || __dirname
    ,   APP_URL_PREFIX            = utilMount2Prefix(settings.mount)
    ,   STATIC_SETTINGS           = {
          dotfiles: settings.dotfiles
        }
    ,   STATIC_PATH               = '/static'
    ,   VIEWS_PATH                = '../views'
    ,   HTML5_VIEWS_MOUNT         = 'html5/'
    ,   HTML4_VIEWS_MOUNT         = 'html4/'
    ,   EVERY_ROUTE_EXP           = '*'
    ,   PLAIN_APP_URL_MOUNT       = '/plain-app'
    ,   PLAIN_APP_STATIC_PATH     = STATIC_PATH
    ,   PLAIN_APP_VIEWS_MOUNT     = 'apps/plain/'
    ,   PLAIN_APP_ROUTE_EXP       = EVERY_ROUTE_EXP
    ,   MAIN_APP_STATIC_PATH      = STATIC_PATH
    ,   MAIN_APP_VIEWS_MOUNT      = 'apps/main/'
    ,   MAIN_APP_ROUTE_EXP        = EVERY_ROUTE_EXP
    ,   REST_API_URL_MOUNT        = '/rest-api'
    ,   REST_APP_STATIC_PATH      = MAIN_APP_STATIC_PATH
    ,   REST_APP_ROUTE_EXP        = EVERY_ROUTE_EXP
    ,   APP_ERR                   = {
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
    ,   DEFAULT_PORT              = 8888
        // TODO read html5 support from external file
    ,   HTML5_SUPPORT             = {
          "IE"                : {major: 11, minor: 0}
        , "Firefox"           : {major: 24, minor: 0}
        , "Chrome"            : {major: 24, minor: 0}
        , "Safari"            : {major: 7 , minor: 0}
        , "Opera"             : {major: 15, minor: 0}
        , "Mobile Safari"     : {major: 7 , minor: 0}
        , "Android"           : {major: 4 , minor: 4}
        , "Opera Mobile"      : {major: 24, minor: 0}
        , "BlackBerry WebKit" : {major: 10, minor: 0}
        , "BlackBerry"        : {major: 10, minor: 0}
        , "Chrome Mobile"     : {major: 38, minor: 0}
        , "Chrome Mobile iOS" : {major: 38, minor: 0}
        , "Firefox Mobile"    : {major: 32, minor: 0}
        , "IE Mobile"         : {major: 10, minor: 0}
        , "UC Browser"        : {major: 9 , minor: 9}
        }
  ;

  // get arguments passed by user
  var usrArgI = 2;
  const PORT = Number(process.argv[usrArgI++]) || DEFAULT_PORT;

  // get required modules
  var express = require('express')
    , fs = require('fs')
    , path = require('path')
    , util = require('util')
    , useragent = require('useragent')
    , async = require('async')
    , _ = require('underscore')
  ;

  // get app
  var app = express();

  // get an instance of the express Router
  var plain = express.Router();
  var main = express.Router();
  var last = express.Router();
  var rest = express.Router();

  // -------------------------------------------------------------------
  // CUSTOM MIDDLEWARE DEFINITIONS
  // -------------------------------------------------------------------

  // simply calls renderer only
  function simpleRenderMiddleware(req, res, next) {
    debugger;
    simpleRenderer(req, res, next);
  }

  // calls renderer with the fs request parameters as locals
  function fsRenderMiddleware(req, res, next) {
    debugger;
    res.locals.fcmder.app = {
      files: req.fcmder.fs.files
    };
    simpleRenderer(req, res, next);
  }

  // prevents fs error to occur when not a link by reading stats of the current path
  function fsLinkSafeMiddleware(req, res, next) {
    debugger;
    if (req.fcmder.fs.path.stats.isLink) {
      fsLinkMiddleware(req, res, next);
      return;
    }
    next();
  } // END of fsLinkSafeMiddleware

  // resolves link at the current path and stores the result for next middleware
  function fsLinkMiddleware(req, res, next) {
    // read the link at the current path
    debugger;
    var ofs = req.fcmder.fs;
    fs.readlink(ofs.path.mount + ofs.path.name, function(err, original) {
      debugger;
      if (err) {
        // ... ERROR occured => pass the request to the error handler or next route
        utilHandleFsMiddlewareError(err, next, APP_ERR.FS_READLINK, ofs.path.name);
        return;
      }
      // ... link SUCCESSFULLY read => pass the request to the next
      var dirname = path.dirname(ofs.path.name);
      ofs.path.original = path.join(dirname, original);
      next();
    });
  } // END of fsLinkMiddleware

  // prevents fs error to occur when not a directory by reading stats of the current path
  function fsDirectorySafeMiddleware(req, res, next) {
    debugger;
    if (req.fcmder.fs.path.stats.isDir) {
      fsDirectoryMiddleware(req, res, next);
      return;
    }
    next();
  } // END of fsDirectorySafeMiddleware

  // reads content of the current directory and stores the result for next middleware
  function fsDirectoryMiddleware(req, res, next) {
    // read a content of the directory
    debugger;
    var ofs = req.fcmder.fs;
    fs.readdir(ofs.path.mount + ofs.path.name, function(err, files) {
      debugger;
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
    debugger;
    var ofs = req.fcmder.fs;
    async.each(ofs.files.names, function(file, eachNext) {
      fs.lstat(ofs.path.mount + ofs.path.name + file, function(err, stats) {
        debugger;
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
      debugger;
      fs.exists(staticPath + fspath, function(exists) {
        debugger;
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
    debugger;
    var fspath = req.fcmder.fs.path;
    fs.lstat(fspath.mount + fspath.name, function(err, stats) {
      debugger;
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
  function getReqInitMiddleware(appMount, subMount) {
    appMount = utilMount2Prefix(appMount);
    subMount = utilMount2Prefix(subMount);
    return function(req, res, next) {
      req.fcmder = {
        req: {
          url: decodeURIComponent(req.url)
        },
        fs: {}
      };
      res.locals = {
        fcmder: {
          body: {},
          req: {
            prefix: {
              app : appMount,
              sub : subMount
            },
            url   : req.fcmder.req.url
          }
        }
      };
      next();
    }
  } // END of getReqInitMiddleware

  // sets user-agent specific attributes regarding a current request
  function userAgentInitMiddleware(req, res, next) {
    var ua = useragent.parse(req.headers['user-agent']);
    console.log('userAgent:');
    console.log(ua);

    var html5min = HTML5_SUPPORT[ua.family];
    req.fcmder.ua = {
      html4: (
        !html5min ||
        html5min.major >  ua.major ||
        html5min.major == ua.major &&
        html5min.minor >  ua.minor
      )
    };
    next();
  } // END of userAgentInitMiddleware

  // sets path to render templates according to client's user-agent settings
  function viewsInitMiddleware(req, res, next) {
    req.fcmder.views = {
      mount: (req.fcmder.ua.html4) ? HTML4_VIEWS_MOUNT : HTML5_VIEWS_MOUNT
    };
    next();
  } // END of viewsInitMiddleware

  function getViewMiddleware(view) {
    return function(req, res, next) {
      req.fcmder.views.name = view;
      next();
    }
  } // END of getViewMiddleware

  // investigates gathered request data and sends response if everything is OK
  function successJsonMiddleware(req, res, next) {
    debugger;
    var reqfs = req.fcmder.fs;
    // check result of preceding middleware stack
    if (!reqfs.path || !reqfs.path.mount || !reqfs.path.name || !reqfs.path.stats) {
      // path has not been found or processed by preceding middleware stack
      next('route');
      return;
    }

    var result = {};
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
      var locreq = res.locals.fcmder.req;
      result.children = reqfs.files.names;
      result.prefix = locreq.prefix.app + locreq.prefix.sub + utilEnsureTrailingSlash(locreq.url);
    } else if (reqfs.path.stats.isFile) {
      // get details about file
      // ... metadata
      result.meta = reqfs.path.stats;
      // ... download file link
      result.href = res.locals.fcmder.req.prefix.app + reqfs.path.name;
    } else if (reqfs.path.stats.isLink) {
      // get details about link
      // ... metadata
      result.meta = reqfs.path.stats;
      // ... address where to get details about the original file
      var prefix = res.locals.fcmder.req.prefix;
      result.original = prefix.app + prefix.sub + reqfs.path.original;
    } else {
      next({
        desc    : utilErrCode2Msg(APP_ERR.INVALID_FILE_FORMAT, reqfs.path.name),
        resType : RESPONSE_TYPE_JSON
      });
      return;
    }
    res.json(result);
  } // END of successJsonMiddleware

  function notFoundCommonMiddleware(req, res, next) {
    debugger;
    res.status(404);
    next();
  }

  function notFoundRenderMiddleware(req, res, next) {
    // TODO render 404 status page
    debugger;
    res.send('Sorry, we cannot find that!!!!');
  }

  function notFoundJsonMiddleware(req, res, next) {
    // TODO format the message better
    debugger;
    res.json({key: 'REST NOT FOUND'});
  }

  function errorCommonMiddleware(err, req, res, next) {
    debugger;
    console.log(err);
    res.status(500);
    next(err);
  }

  function errorRenderMiddleware(err, req, res, next) {
    // TODO render 500 status page
    // TODO see err.resType of app custom errors
    debugger;
    res.send('Sorry, something blew up!!!!');
  }

  // -------------------------------------------------------------------
  // ROUTER CONFIGURATIONS
  // -------------------------------------------------------------------

  // PLAIN APP router configuration
  // -------------------------------------------------------------------
  // - serves directories only, other file types are served as not found

  // this middleware shall be the first one from html middleware chain
  plain.use(getReqInitMiddleware(APP_URL_PREFIX, PLAIN_APP_URL_MOUNT));
  // mainly html5 sniffer middleware
  plain.use(userAgentInitMiddleware);
  // set path to views specific to the request
  plain.use(viewsInitMiddleware);

  // serving public directories - select the same path as for files
  // and render response
  plain.route(PLAIN_APP_ROUTE_EXP)
  .all(
    getFsPathMiddleware(ROOT_FS_PATH + PLAIN_APP_STATIC_PATH),
    fsStatPathMiddleware
  )
  .get(
    getViewMiddleware(PLAIN_APP_VIEWS_MOUNT + 'index.jade'),
    fsDirectoryMiddleware,
    fsStatFilesMiddleware,
    fsRenderMiddleware
  );

  // finish middleware stack by last router
  // - in case plain app router was invoked, do not pass the request
  //   to others, even if the request cannot be successfully served
  plain.use(last);

  // MAIN APP router configuration
  // -------------------------------------------------------------------

  // this middleware shall be the first one from html middleware chain
  main.use(getReqInitMiddleware(APP_URL_PREFIX));
  // mainly html5 sniffer middleware
  main.use(userAgentInitMiddleware);
  // set path to views specific to the request
  main.use(viewsInitMiddleware);

  // serving public directories - select the same path as for files
  // and render response
  main.route(MAIN_APP_ROUTE_EXP)
  .all(
    getFsPathMiddleware(ROOT_FS_PATH + MAIN_APP_STATIC_PATH)
  )
  .get(
    getViewMiddleware(MAIN_APP_VIEWS_MOUNT + 'index.jade'),
    simpleRenderMiddleware
  );

  // finish middleware stack by last router
  main.use(last);

  // LAST router configuration - serves 404 status
  // -------------------------------------------------------------------

  last.route(EVERY_ROUTE_EXP)
  // perform common actions for all methods like setting status to 404
  .all(notFoundCommonMiddleware)
  // for get method render 404 html page
  .get(notFoundRenderMiddleware)
  // for every other method send error description in json format
  .all(notFoundJsonMiddleware)
  ;

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

  // ensure right format of the url
  // add application routing logic
  rest.use(getReqInitMiddleware(APP_URL_PREFIX, REST_API_URL_MOUNT));
  rest.route(REST_APP_ROUTE_EXP)
  .all(
    getFsPathMiddleware(ROOT_FS_PATH + REST_APP_STATIC_PATH),
    fsStatPathMiddleware
  )
  .get(
    fsLinkSafeMiddleware,
    fsDirectorySafeMiddleware
  )
  .all(
    // investigate data and send OK response if possible
    successJsonMiddleware
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

  // attributes configuration
  // -------------------------------------------------------------------
  app.set('views', path.join(__dirname, VIEWS_PATH));
  app.set('view engine', 'jade');

  app.locals = {
    CONSTS: {
      PLAIN_APP_URL_MOUNT : PLAIN_APP_URL_MOUNT
    }
  };

  // middleware configuration
  // -------------------------------------------------------------------
  // mount REST router - make the app RESTful
  app.use(REST_API_URL_MOUNT, rest);

  // serving public files for MAIN and PLAIN apps
  if (APP_URL_PREFIX) {
    app.use(express.static(ROOT_FS_PATH + MAIN_APP_STATIC_PATH, STATIC_SETTINGS));
  }
  app.use(PLAIN_APP_URL_MOUNT, express.static(ROOT_FS_PATH + PLAIN_APP_STATIC_PATH, STATIC_SETTINGS));

  // mount PLAIN app router
  app.use(PLAIN_APP_URL_MOUNT, plain);
  // mount MAIN app router
  app.use(main);

  // process error and render error page
  app.use(errorCommonMiddleware);
  app.use(errorRenderMiddleware);

  // -------------------------------------------------------------------
  // RESPONSE RENDERER DEFINITIONS
  // -------------------------------------------------------------------

  // renders response with given parameters without any further
  // modifications of the request or response
  function simpleRenderer(req, res, next, locals, cb) {
    res.render(req.fcmder.views.mount + req.fcmder.views.name, locals, cb);
  }

  // -------------------------------------------------------------------
  // UTILITIES DEFINITIONS
  // -------------------------------------------------------------------

  // arguments
  // ... err, custom, next, code, <zero or more parameters for the message>
  function utilHandleFsMiddlewareError() {
    debugger;
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

  function utilEnsureTrailingSlash(arg) {
    return (/\/$/.test(arg)) ? arg : arg + '/';
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

  return app;
} // END of createApplication

// -------------------------------------------------------------------
// PUBLIC INTERFACE
// -------------------------------------------------------------------

module.exports = {
  app: createApplication
};
