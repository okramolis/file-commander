var expect  = require('chai').expect
  , request = require('request')
  , async   = require('async')
  , fs      = require('fs')
  , cheerio = require('cheerio')
;

const GET   = 'GET'
  ,   POST  = 'POST'
;

// -------------------------------------------------------------------
// PUBLIC INTERFACE
// -------------------------------------------------------------------
module.exports = {
  error: {
    code: assertErrCode
  },
  fs: {
    path: {
      none: assertPathNone,
      file: {
        ok  : assertPathIsFile
      },
      dir : {
        ok  : assertPathIsDirectory
      }
    }
  },
  dummy: {
    ok  : assertDummyVerified,
    none: assertDummyNone,
    file: {
      ok  : assertDummyFileVerified,
      none: assertDummyFileNone
    },
    folder: {
      ok  : assertDummyFolderVerified
    }
  },
  http: {
    req: {
      common  : assertHttp,
      get     : assertHttpGET,
      created : assertHttpCreated
    },
    res: {
      contentType     : assertHttpResContentType,
      bodyContent     : assertHttpResBodyContent,
      baseDirBodyHtml : assertHttpResBaseDirBodyHtml,
      testDirBodyHtml : assertHttpResTestDirBodyHtml,
      baseDirBodyJson : assertHttpResBaseDirBodyJson,
      testDirBodyJson : assertHttpResTestDirBodyJson,
      testFileBodyJson: assertHttpResTestFileBodyJson
    }
  }
};

// -------------------------------------------------------------------
// IMPLEMENTATION
// -------------------------------------------------------------------

// error
// -------------------------------------------------------------------

function assertErrCode(code, done, err) {
  expect(err).to.be.instanceOf(Error);
  expect(err.code).to.equal(code);
  done();
}

// fs
// -------------------------------------------------------------------

function assertPathNone(apath, done) {
  fs.lstat(apath, assertErrCode.bind(null, 'ENOENT', done));
}

function assertStats(stated, statsTest, callback) {
  fs.lstat(stated, function(err, stats) {
    if (err) return callback(err);
    // check stats
    expect(stats).to.satisfy(statsTest);
    callback();
  });
}

function assertPathIsFile(apath, done) {
  assertStats(apath, isFile, done);
}

function assertPathIsDirectory(apath, done) {
  assertStats(apath, isDirectory, done);
}

function isDirectory(stats) {
  return stats.isDirectory();
}

function isFile(stats) {
  return stats.isFile();
}

// rest
// -------------------------------------------------------------------

function metaIsDirectory(meta) {
  return  !meta.isFile && !!meta.isDir &&  !meta.isLink;
}

function metaIsFile(meta) {
  return !!meta.isFile &&  !meta.isDir &&  !meta.isLink;
}

function metaIsSymbolicLink(meta) {
  return  !meta.isFile &&  !meta.isDir && !!meta.isLink;
}

// dummy
// -------------------------------------------------------------------

function assertDummyVerified(done) {
  this.verify(function(err) {
    expect(err).to.not.exist;
    done();
  });
}

function assertDummyFileVerified(done) {
  this.verifyFile(function(err) {
    expect(err).to.not.exist;
    done();
  });
}

function assertDummyFolderVerified(done) {
  this.verifyFolder(function(err) {
    expect(err).to.not.exist;
    done();
  });
}

function assertDummyNone(done) {
  this.verify(assertErrCode.bind(null, 'ENOENT', done));
}

function assertDummyFileNone(done) {
  this.verifyFile(assertErrCode.bind(null, 'ENOENT', done));
}

// http
// -------------------------------------------------------------------

function assertHttpGET(reqUrl, assertCode, asserts, callback) {
  request({
    method: GET,
    url   : reqUrl,
  }, function(err, res, body) {
    if (err) return callback(err);

    // check statusCode
    expect(res).to.have.a.property('statusCode', assertCode);

    if (!asserts) return callback();

    // perform caller's assertion(s)
    if (!Array.isArray(asserts)) {
      return asserts(res, body, callback);
    }
    asserts.unshift(function(next) {
      // at first, provide the asserts with response and body objects
      next(null, res, body);
    });
    async.waterfall(asserts, callback);
  });
}

function assertHttp(method, reqUrl, form, expectedCode, asserts, callback) {
  request({
    method: method,
    url   : reqUrl,
    form  : form
  }, function(err, res, body) {
    if (err) return callback(err);

    // check statusCode
    expect(res).to.have.a.property('statusCode', expectedCode);

    if (!asserts) return callback();

    // perform caller's assertion(s)
    if (!Array.isArray(asserts)) {
      return asserts(callback);
    }
    async.series(asserts, callback);
  });
}

function assertHttpCreated(reqUrl, form, expectedType, expectedLoc, asserts, callback) {
  request({
    method: POST,
    url   : reqUrl,
    form  : form
  }, function(err, res, body) {
    if (err) return callback(err);

    // check statusCode
    expect(res).to.have.a.property('statusCode', 201);

    // check content-type
    expect(res)
    .to.have.a.deep.property('headers.content-type')
      .that.match(expectedType);

    // check location
    expect(res).to.have.a.deep.property('headers.location', expectedLoc);

    // perform caller's assertion(s)
    if (!Array.isArray(asserts)) {
      return asserts(callback);
    }
    async.series(asserts, callback);
  });
}

function assertHttpResContentType(expectedType, res, body, callback) {
  // check content-type
  expect(res)
    .to.have.a.deep.property('headers.content-type')
      .to.match(expectedType);

  callback(null, res, body);
}

function assertHttpResBaseDirBodyHtml(
  expectedUrl,
  expectedName,
  expectedCurrentRef,
  res,
  body,
  callback
) {
  // parse body
  var $ = cheerio.load(body),
      $a = $('a'),
      $cdir = $a.filter('[href="/"]')
      $dir = $a.filter('[href="' + expectedUrl + '"]');

  // check current directory link
  expect($cdir).to.have.length.above(0);
  expect($cdir.text()).to.equal(expectedCurrentRef);

  // check content of current directory
  expect($dir).to.have.length.above(0);
  expect($dir.text()).to.equal(expectedName);

  callback(null, res, body);
}

function assertHttpResTestDirBodyHtml(
  expectedFileUrl,
  expectedFileName,
  expectedFolderUrl,
  expectedFolderName,
  expectedParentRef,
  res,
  body,
  callback
) {
  // parse body
  var $ = cheerio.load(body),
      $a = $('a'),
      $pdir = $a.filter('[href="/"]'),
      $file = $a.filter('[href="' + expectedFileUrl + '"]'),
      $indir = $a.filter('[href="' + expectedFolderUrl + '"]');

  // check parent directory link
  expect($pdir).to.have.length.above(0);
  expect($pdir.text()).to.equal(expectedParentRef);

  // check content of current directory
  // ... file
  expect($file).to.have.length.above(0);
  expect($file.text()).to.equal(expectedFileName);
  // ... folder
  expect($indir).to.have.length.above(0);
  expect($indir.text()).to.equal(expectedFolderName);

  callback(null, res, body);
}

function assertHttpResBaseDirBodyJson(expectedName, res, body, callback) {
  // parse body
  body = JSON.parse(body);

  // check name of current directory
  expect(body.name).to.equal('');

  // check path to itself
  expect(body.path).to.equal('/');

  // check metadata of current directory
  expect(body.meta)
    .is.an('object')
    .that.satisfy(metaIsDirectory);

  // check content of current directory
  // ... check name
  expect(body)
    .to.have.property('children')
      .that.is.an('object')
      .that.have.property('names')
        .that.is.an('array')
        .that.include(expectedName);
  // ... check metadata
  expect(body.children)
    .to.have.property('stats')
      .that.is.an('object')
      .that.have.property(expectedName)
        .that.is.an('object')
        .that.satisfy(metaIsDirectory);

  callback(null, res, body);
}

function assertHttpResTestDirBodyJson(
  expectedCurrentName,
  expectedFileName,
  expectedFolderName,
  res,
  body,
  callback
) {
  // parse body
  body = JSON.parse(body);

  // check name of current directory
  expect(body.name).to.equal(expectedCurrentName);

  // check path to parent directory
  expect(body.path).to.equal('/');

  // check metadata of current directory
  expect(body.meta)
    .is.an('object')
    .that.satisfy(metaIsDirectory);

  // check content of current directory
  // ... check names
  expect(body)
    .to.have.property('children')
      .that.is.an('object')
      .that.have.property('names')
        .that.is.an('array')
        .that.have.members([expectedFolderName, expectedFileName]);
  // ... check metadata
  expect(body.children)
    .to.have.property('stats')
      .that.is.an('object')
      .that.have.keys(expectedFolderName, expectedFileName);
  // ... ... directory
  expect(body.children.stats[expectedFolderName])
    .is.an('object')
    .that.satisfy(metaIsDirectory);
  // ... ... file
  expect(body.children.stats[expectedFileName])
    .is.an('object')
    .that.satisfy(metaIsFile);

  callback(null, res, body);
}

function assertHttpResTestFileBodyJson(
  expectedName,
  expectedType,
  expectedParent,
  res,
  body,
  callback
) {
  // parse body
  body = JSON.parse(body);

  // check file information
  // ... check name
  expect(body)
    .to.have.property('name')
      .that.is.a('string')
      .that.equals(expectedName);
  // ... check metadata
  expect(body)
    .to.have.property('meta')
      .that.is.an('object')
      .that.satisfy(metaIsFile);
  // ... check mime type
  expect(body)
    .to.have.property('mime')
      .that.is.a('string')
      .that.match(expectedType);

  // check path to parent directory
  expect(body.path).to.equal(expectedParent);

  callback(null, res, body);
}

function assertHttpResBodyContent(expectedBody, res, body, callback) {
  // check body content
  expect(body).to.equal(expectedBody);

  callback(null, res, body);
}

