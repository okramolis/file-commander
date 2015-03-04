var assert      = require('../../../lib/test/assert')
  , server      = require('../../../examples/plain_read-write')
  , FileLogger  = require('../../../lib/util/logger').FileLogger
  , utils       = require('../../../lib/util/common')
  , Dummy       = require('fs-dummy').Dummy
  , logger      = require('morgan')
  , async       = require('async')
  , path        = require('path')
  , fs          = require('fs-extra')
;

const APP_NAME              = 'plain_read-write'
  ,   LOG_NAME              = APP_NAME + '.log'
  ,   LOG_PATH              = path.join(__dirname, 'log', LOG_NAME)
  ,   SERVER_PATH           = path.join('..', '..', '..', 'examples', APP_NAME)
  ,   STATIC_DIR            = 'public'
  ,   TEST_DIR              = '__test__' + utils.getRandStr()
  ,   TEST_SERVER_PATH      = path.resolve(__dirname, SERVER_PATH)
  ,   TEST_ROOT_PATH        = path.resolve(__dirname, SERVER_PATH, STATIC_DIR, TEST_DIR)
  ,   TEST_INDIR            = 'test_dir'
  ,   TEST_FILE             = 'test.txt'
  ,   TEST_CONTENT          = 'testing ...'
  ,   TEST_PARENT_DIR       = '..'
  ,   TEST_CURRENT_DIR      = '.'
  ,   PORT                  = utils.getRandPort()
  ,   HOST                  = 'localhost'
  ,   PROTOCOL              = 'http'
  ,   ORIGIN                = PROTOCOL + '://' + HOST + ':' + PORT
  ,   POST                  = 'POST'
  ,   DELETE                = 'DELETE'
  ,   URL_BASE              = ''
  ,   URL_DIR               = URL_BASE + '/' + TEST_DIR
  ,   URL_FILE              = URL_DIR + '/' + TEST_FILE
  ,   URL_INDIR             = URL_DIR + '/' + TEST_INDIR
  ,   URL_404               = URL_BASE + '/not/existing/url'
  ,   URL_BASE_PARENT       = URL_BASE + '/..'
  ,   URL_PARENT_REL        = '..'
  ,   TEXT_HTML             = /text\/html/
  ,   TEXT_PLAIN            = /text\/plain/
  ,   DEFAULT_DIR_NAME      = 'untitled folder'
  ,   NUM_SUFFIX_DELIMITER  = ' '
;

// Create log for debug purposes.
// => Current stdout not populated by any other than test framework logs.
var serverLogger = new FileLogger(LOG_PATH);

// Create manager of test content like directories and files.
var dummy = new Dummy(TEST_ROOT_PATH, TEST_FILE, TEST_CONTENT, TEST_INDIR);

// Configure server before start.
server.configure(logger('common', {
  stream: serverLogger.getStream()
}));

// -------------------------------------------------------------------
// START TESTING
// -------------------------------------------------------------------
describe(APP_NAME + ': http interface', function() {

  // -----------------------------------------------------------------
  // PRE TEST
  // -----------------------------------------------------------------
  before(function(done) {
    // Add testing content to the public directory of the server
    // and run the server afterwards.
    async.series([function(next) {
      dummy.ensure(next);
    }], function(err) {
      if (err) throw err;
      server.listen(PORT, function(port) {
        serverLogger.log('listening on port %s ...', port);
        done();
      });
    });
  });

  // -----------------------------------------------------------------
  // POST TEST
  // -----------------------------------------------------------------
  after(function(done) {
    console.log('\n  for more info see http server log file:\n  %s', LOG_PATH);
    // Remove testing content from the public directory of the server
    // and shut down the server afterwards.
    async.series([function(next) {
      dummy.cleanup(next);
    }], function(err) {
      if (err) throw err;
      server.close(function() {
        serverLogger.log('server shut down');
        done();
      });
    });
  });

  // -----------------------------------------------------------------
  // GET
  // -----------------------------------------------------------------

  describe('GET existing base', function() {
    it('should respond with status code 200, content type ' +
       'text/html and with body containing links to current ' +
       'base directory and its children', function(done) {
      assert.http.req.get(ORIGIN + URL_BASE, 200, [
        assert.http.res.contentType.bind(null, TEXT_HTML),
        assert.http.res.baseDirBodyHtml.bind(
          null,
          URL_DIR,
          TEST_DIR,
          TEST_CURRENT_DIR
        )
      ], done);
    });
  });

  describe('GET existing directory', function() {
    it('should respond with status code 200, content type ' +
       'text/html and with body containing links to parent base ' +
       'directory and children of current directory', function(done) {
      assert.http.req.get(ORIGIN + URL_DIR, 200, [
        assert.http.res.contentType.bind(null, TEXT_HTML),
        assert.http.res.testDirBodyHtml.bind(
          null,
          URL_FILE,
          TEST_FILE,
          URL_INDIR,
          TEST_INDIR,
          TEST_PARENT_DIR
        )
      ], done);
    });
  });

  describe('GET existing text file', function() {
    it('should respond with status code 200, content type text/plain ' +
       'and body "' + TEST_CONTENT + '"', function(done) {
      assert.http.req.get(ORIGIN + URL_FILE, 200, [
        assert.http.res.contentType.bind(null, TEXT_PLAIN),
        assert.http.res.bodyContent.bind(null, TEST_CONTENT)
      ], done);
    });
  });

  describe('GET not existing', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.get(ORIGIN + URL_404, 404, null, done);
    });
  });

  // -----------------------------------------------------------------
  // POST
  // -----------------------------------------------------------------

  // TODO add tests for hidden _method attribute

  // Create directory
  // -----------------------------------------------------------------

  describe('POST existing base', function() {

    var name = utils.getRandStr()
      , npath = path.join(TEST_ROOT_PATH, '..', name)
      , locUrl = URL_BASE + '/' + name;

    before(function(done) {
      fs.remove(npath, done);
    });

    after(function(done) {
      fs.remove(npath, done);
    });

    it('should create directory in base location and respond with ' +
       'status code 201, Content-Type text/html and Location ' +
       '/<created_folder_url> and respond to GET /<created_' +
       'folder_url> request with status code 200', function(done) {

      assert.http.req.created(ORIGIN + URL_BASE, {
        name: name
      }, TEXT_HTML, locUrl, [
        assert.fs.path.dir.ok.bind(null, npath),
        assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
      ], done);

    });
  });

  describe('POST existing base parent', function() {

    var name = utils.getRandStr()
      , npath = path.join(TEST_ROOT_PATH, '..', '..', name);

    before(function(done) {
      fs.remove(npath, done);
    });

    after(function(done) {
      fs.remove(npath, done);
    });

    it('should respond with status code 404 without ' +
       'touching server root directory', function(done) {

      assert.http.req.common(POST, ORIGIN + URL_BASE_PARENT, {
        name: name
      }, 404, assert.fs.path.none.bind(null, npath), done);

    });
  });

  describe('POST existing directory', function() {

    var destPath = path.join(TEST_ROOT_PATH, TEST_INDIR);

    describe('empty body', function() {

      before(function(done) {
        dummy.ensure(done);
      });

      // TODO increase number of calls till the first random suffix

      it('should create directory with default name in deep location ' +
         'and respond with status code 201, Content-Type text/html and ' +
         'Location /<created_folder_url> and respond to GET /<created_' +
         'folder_url> request with status code 200', function(done) {

        var npath = path.join(destPath, DEFAULT_DIR_NAME)
          , locUrl = URL_INDIR + '/' + DEFAULT_DIR_NAME;

        assert.http.req.created(ORIGIN + URL_INDIR, {}, TEXT_HTML, locUrl, [
          assert.fs.path.dir.ok.bind(null, npath),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);


      });

      it('should create directory with default name with numeric suffix "2" ' +
         'in deep location and respond with status code 201, Content-Type ' +
         'text/html and Location /<created_folder_url> and respond to GET ' +
         '/<created_folder_url> request with status code 200', function(done) {

        var name = DEFAULT_DIR_NAME + NUM_SUFFIX_DELIMITER + '2'
          , npath = path.join(destPath, name)
          , locUrl = URL_INDIR + '/' + name;

        assert.http.req.created(ORIGIN + URL_INDIR, {}, TEXT_HTML, locUrl, [
          assert.fs.path.dir.ok.bind(null, npath),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });
    });

    describe('directory name specified', function() {

      before(function(done) {
        dummy.ensure(done);
      });

      var name = utils.getRandStr();
      var body = { name: name };

      it('should create directory with the specified name in deep location ' +
         'and respond with status code 201, Content-Type text/html ' +
         'and Location /<created_folder_url> and respond to GET /<created_' +
         'folder_url> request with status code 200', function(done) {

        var npath = path.join(destPath, name)
          , locUrl = URL_INDIR + '/' + name;

        assert.http.req.created(ORIGIN + URL_INDIR, body, TEXT_HTML, locUrl, [
          assert.fs.path.dir.ok.bind(null, npath),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

      it('should respond with status code 409', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_INDIR, body, 409, null, done);
      });

    });

  });

  describe('POST existing file', function() {

    before(function(done) {
      dummy.ensure(done);
    });

    it('should respond with status code 404', function(done) {
      assert.http.req.common(POST, ORIGIN + URL_FILE, {}, 404, null, done);
    });
  });

  describe('POST not existing', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(POST, ORIGIN + URL_404, {}, 404, null, done);
    });
  });

  // move/copy file/directory
  // -----------------------------------------------------------------
  describe('POST move/copy', function() {

    var sourceRoot = utils.getRandStr()
      , sourceFile = utils.getRandStr()
      , sourceContent = utils.getRandStr()
      , sourceFolder = utils.getRandStr()
      , sourceDummy = new Dummy(
          path.join(TEST_ROOT_PATH, sourceRoot),
          sourceFile,
          sourceContent,
          sourceFolder
        )
      , destRoot = utils.getRandStr()
      , destFile = utils.getRandStr()
      , destContent = utils.getRandStr()
      , destFolder = utils.getRandStr()
      , destDummy = new Dummy(
          path.join(TEST_ROOT_PATH, destRoot),
          destFile,
          destContent,
          destFolder
        )
      , destUrl = URL_DIR + '/' + destRoot;
    ;

    after(function(done) {
      async.parallel([
        sourceDummy.cleanup.bind(sourceDummy),
        destDummy.cleanup.bind(destDummy)
      ], done);
    });

    describe('not existing resources', function() {

      beforeEach(function(done) {
        dummy.ensure(done);
      });

      it('should respond with status code 409 when moving without ' +
         'touching destination location', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_DIR, {
          local: URL_404
        }, 409, assert.dummy.ok.bind(dummy), done);
      });

      it('should respond with status code 409 when copying without ' +
         'touching destination location', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_DIR, {
          local: URL_404,
          preserve: true
        }, 409, assert.dummy.ok.bind(dummy), done);
      });

    });

    describe('overwrite existing file with other existing file', function() {

      beforeEach(function(done) {
        async.parallel([
          sourceDummy.ensure.bind(sourceDummy),
          destDummy.ensure.bind(destDummy)
        ], done);
      });

      it('should respond with status code 409 when moving touching ' +
         'neither the destination file nor the source file', function(done) {
        assert.http.req.common(POST, ORIGIN + destUrl, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFile,
          name : destFile
        }, 409, [
          assert.dummy.file.ok.bind(destDummy),
          assert.dummy.file.ok.bind(sourceDummy)
        ], done);
      });

      it('should respond with status code 409 when copying touching ' +
         'neither the destination file nor the source file', function(done) {
        assert.http.req.common(POST, ORIGIN + destUrl, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFile,
          name : destFile,
          preserve: true
        }, 409, [
          assert.dummy.file.ok.bind(destDummy),
          assert.dummy.file.ok.bind(sourceDummy)
        ], done);
      });

    });

    describe('overwrite existing file with existing directory', function() {

      beforeEach(function(done) {
        async.parallel([
          sourceDummy.ensure.bind(sourceDummy),
          destDummy.ensure.bind(destDummy)
        ], done);
      });

      it('should respond with status code 409 when moving touching neither ' +
         'the destination file nor the source directory', function(done) {
        assert.http.req.common(POST, ORIGIN + destUrl, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFolder,
          name : destFile
        }, 409, [
          assert.dummy.file.ok.bind(destDummy),
          assert.dummy.folder.ok.bind(sourceDummy)
        ], done);
      });

      it('should respond with status code 409 when copying touching neither ' +
         'the destination file nor the source directory', function(done) {
        assert.http.req.common(POST, ORIGIN + destUrl, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFolder,
          name : destFile,
          preserve: true
        }, 409, [
          assert.dummy.file.ok.bind(destDummy),
          assert.dummy.folder.ok.bind(sourceDummy)
        ], done);
      });

    });

    describe('overwrite existing directory with existing file', function() {

      beforeEach(function(done) {
        async.parallel([
          sourceDummy.ensure.bind(sourceDummy),
          destDummy.ensure.bind(destDummy)
        ], done);
      });

      it('should respond with status code 409 when moving touching neither ' +
         'the destination directory nor the source file', function(done) {
        assert.http.req.common(POST, ORIGIN + destUrl, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFile,
          name : destFolder
        }, 409, [
          assert.dummy.folder.ok.bind(destDummy),
          assert.dummy.file.ok.bind(sourceDummy)
        ], done);
      });

      it('should respond with status code 409 when copying touching neither ' +
         'the destination directory nor the source file', function(done) {
        assert.http.req.common(POST, ORIGIN + destUrl, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFile,
          name : destFolder,
          preserve: true
        }, 409, [
          assert.dummy.folder.ok.bind(destDummy),
          assert.dummy.file.ok.bind(sourceDummy)
        ], done);
      });

    });

    describe('overwrite existing directory with other existing ' +
             'directory', function() {

      beforeEach(function(done) {
        async.parallel([
          sourceDummy.ensure.bind(sourceDummy),
          destDummy.ensure.bind(destDummy)
        ], done);
      });

      it('should respond with status code 409 when moving touching neither ' +
         'the destination nor the source directory', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_DIR, {
          local: URL_DIR + '/' + sourceRoot,
          name : destRoot
        }, 409, [
          assert.dummy.ok.bind(destDummy),
          assert.dummy.ok.bind(sourceDummy)
        ], done);
      });

      it('should respond with status code 409 when copying touching neither ' +
         'the destination nor the source directory', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_DIR, {
          local: URL_DIR + '/' + sourceRoot,
          name : destRoot,
          preserve: true
        }, 409, [
          assert.dummy.ok.bind(destDummy),
          assert.dummy.ok.bind(sourceDummy)
        ], done);
      });

    });

    describe('overwrite existing file with itself', function() {

      beforeEach(function(done) {
        async.series([
          destDummy.ensure.bind(destDummy)
        ], done);
      });

      it('should respond with status code 409 when moving without ' +
         'touching the file', function(done) {
        assert.http.req.common(POST, ORIGIN + destUrl, {
          local: destUrl + '/' + destFile
        }, 409, assert.dummy.file.ok.bind(destDummy), done);
      });

      it('should respond with status code 409 when copying without ' +
         'touching the file', function(done) {
        assert.http.req.common(POST, ORIGIN + destUrl, {
          local: destUrl + '/' + destFile,
          preserve: true
        }, 409, assert.dummy.file.ok.bind(destDummy), done);
      });

    });

    describe('overwrite existing directory with itself', function() {

      beforeEach(function(done) {
        async.series([
          destDummy.ensure.bind(destDummy)
        ], done);
      });

      it('should respond with status code 409 when moving without ' +
         'touching the directory', function(done) {
        assert.http.req.common(POST, ORIGIN + destUrl, {
          local: destUrl + '/' + destFolder
        }, 409, assert.dummy.folder.ok.bind(destDummy), done);
      });

      it('should respond with status code 409 when copying without ' +
         'touching the directory', function(done) {
        assert.http.req.common(POST, ORIGIN + destUrl, {
          local: destUrl + '/' + destFolder,
          preserve: true
        }, 409, assert.dummy.folder.ok.bind(destDummy), done);
      });

    });

    describe('try to move/copy existing file outside of root ' +
             'directory', function() {

      var destPath = path.join(TEST_SERVER_PATH, sourceFile);

      beforeEach(function(done) {
        async.series([
          sourceDummy.ensure.bind(sourceDummy)
        ], done);
      });

      after(function(done) {
        fs.remove(destPath, done);
      });

      it('should respond with status code 404 when moving touching neither ' +
         'the source file nor the destination directory', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_BASE_PARENT, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFile
        }, 404, [
          assert.dummy.ok.bind(sourceDummy),
          assert.fs.path.none.bind(null, destPath)
        ], done);
      });

      it('should respond with status code 404 when copying touching neither ' +
         'the source file nor the destination directory', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_BASE_PARENT, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFile,
          preserve: true
        }, 404, [
          assert.dummy.ok.bind(sourceDummy),
          assert.fs.path.none.bind(null, destPath)
        ], done);
      });

    });

    describe('try to move/copy existing directory outside of root ' +
             'directory', function() {

      var outDummy = new Dummy(
        path.join(TEST_SERVER_PATH, sourceRoot),
        sourceFile,
        sourceContent,
        sourceFolder
      );

      beforeEach(function(done) {
        async.parallel([
          sourceDummy.ensure.bind(sourceDummy),
          outDummy.cleanup.bind(outDummy)
        ], done);
      });

      after(function(done) {
        outDummy.cleanup(done);
      });

      it('should respond with status code 404 when moving touching ' +
         'neither the source nor the destination directory', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_BASE_PARENT, {
          local: URL_DIR + '/' + sourceRoot
        }, 404, [
          assert.dummy.ok.bind(sourceDummy),
          assert.dummy.none.bind(outDummy)
        ], done);
      });

      it('should respond with status code 404 when copying touching ' +
         'neither the source nor the destination directory', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_BASE_PARENT, {
          local: URL_DIR + '/' + sourceRoot,
          preserve: true
        }, 404, [
          assert.dummy.ok.bind(sourceDummy),
          assert.dummy.none.bind(outDummy)
        ], done);
      });

    });

    describe('try to move/copy existing file from outside of root ' +
             'directory into the root directory', function() {

      var outDummy = new Dummy(
        path.join(TEST_SERVER_PATH, destRoot),
        destFile,
        destContent,
        destFolder
      );

      beforeEach(function(done) {
        async.series([
          destDummy.ensure.bind(destDummy),
          destDummy.cleanupFile.bind(destDummy),
          outDummy.ensure.bind(outDummy)
        ], done);
      });

      after(function(done) {
        outDummy.cleanup(done);
      });

      it('should respond with status code 403 when moving touching neither ' +
         'the source file nor the destination directory', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_DIR + '/' + destRoot, {
          local: URL_PARENT_REL + '/' + URL_PARENT_REL + '/' + URL_PARENT_REL +
                 '/' + destRoot + '/' + destFile
        }, 403, [
          assert.dummy.file.none.bind(destDummy),
          assert.dummy.file.ok.bind(outDummy)
        ], done);
      });

      it('should respond with status code 403 when copying touching neither ' +
         'the source file nor the destination directory', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_DIR + '/' + destRoot, {
          local: URL_PARENT_REL + '/' + URL_PARENT_REL + '/' + URL_PARENT_REL +
                 '/' + destRoot + '/' + destFile,
          preserve: true
        }, 403, [
          assert.dummy.file.none.bind(destDummy),
          assert.dummy.file.ok.bind(outDummy)
        ], done);
      });

    });

    describe('try to move/copy existing directory from outside of root ' +
             'directory into the root directory', function() {

      var outDummy = new Dummy(
        path.join(TEST_SERVER_PATH, destRoot),
        destFile,
        destContent,
        destFolder
      );

      beforeEach(function(done) {
        async.parallel([
          destDummy.cleanup.bind(destDummy),
          outDummy.ensure.bind(outDummy)
        ], done);
      });

      after(function(done) {
        outDummy.cleanup(done);
      });

      it('should respond with status code 403 when moving touching ' +
         'neither the source nor the destination directory', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_DIR, {
          local: URL_PARENT_REL + '/' + URL_PARENT_REL + '/' + destRoot
        }, 403, [
          assert.dummy.none.bind(destDummy),
          assert.dummy.ok.bind(outDummy)
        ], done);
      });

      it('should respond with status code 403 when copying touching ' +
         'neither the source nor the destination directory', function(done) {
        assert.http.req.common(POST, ORIGIN + URL_DIR, {
          local: URL_PARENT_REL + '/' + URL_PARENT_REL + '/' + destRoot,
          preserve: true
        }, 403, [
          assert.dummy.none.bind(destDummy),
          assert.dummy.ok.bind(outDummy)
        ], done);
      });

    });

    describe('move/copy file to other existing location under its original ' +
             'name avoiding any name conflict', function() {

      var cloneRoot = utils.getRandStr()
        , cloneFile = sourceFile
        , postUrl = destUrl + '/' + destFolder + '/' + cloneRoot
        , locUrl = postUrl + '/' + cloneFile
        , cloneDummy = new Dummy(
            path.join(TEST_ROOT_PATH, destRoot, destFolder, cloneRoot),
            cloneFile,
            sourceContent,
            utils.getRandStr()
          );

      beforeEach(function(done) {
        async.series([
          sourceDummy.ensure.bind(sourceDummy),
          destDummy.ensure.bind(destDummy),
          cloneDummy.ensure.bind(cloneDummy),
          cloneDummy.cleanupFile.bind(cloneDummy)
        ], done);
      });

      it('should move file and respond with status code 201, ' +
         'Content-Type text/html and Location ' +
         '/<moved_file_url> and respond to GET /<moved_file_url> ' +
         'request with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFile
        }, TEXT_HTML, locUrl, [
          assert.dummy.file.ok.bind(cloneDummy),
          assert.dummy.file.none.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

      it('should copy file and respond with status code 201, ' +
         'Content-Type text/html and Location ' +
         '/<copied_file_url> and respond to GET /<copied_file_url> ' +
         'request with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFile,
          preserve: true
        }, TEXT_HTML, locUrl, [
          assert.dummy.file.ok.bind(cloneDummy),
          assert.dummy.file.ok.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

    });

    describe('move/copy file to other existing location under a new ' +
             'name avoiding any name conflict', function() {

      var cloneRoot = utils.getRandStr()
        , cloneFile = utils.getRandStr()
        , postUrl = destUrl + '/' + destFolder + '/' + cloneRoot
        , locUrl = postUrl + '/' + cloneFile
        , cloneDummy = new Dummy(
            path.join(TEST_ROOT_PATH, destRoot, destFolder, cloneRoot),
            cloneFile,
            sourceContent,
            utils.getRandStr()
          );

      beforeEach(function(done) {
        async.series([
          sourceDummy.ensure.bind(sourceDummy),
          destDummy.ensure.bind(destDummy),
          cloneDummy.ensure.bind(cloneDummy),
          cloneDummy.cleanupFile.bind(cloneDummy)
        ], done);
      });


      it('should move file and respond with status code 201, ' +
         'Content-Type text/html and Location ' +
         '/<moved_file_url> and respond to GET /<moved_file_url> ' +
         'request with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFile,
          name : cloneFile
        }, TEXT_HTML, locUrl, [
          assert.dummy.file.ok.bind(cloneDummy),
          assert.dummy.file.none.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

      it('should copy file and respond with status code 201, ' +
         'Content-Type text/html and Location ' +
         '/<copied_file_url> and respond to GET /<copied_file_url> ' +
         'request with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: URL_DIR + '/' + sourceRoot + '/' + sourceFile,
          name : cloneFile,
          preserve: true
        }, TEXT_HTML, locUrl, [
          assert.dummy.file.ok.bind(cloneDummy),
          assert.dummy.file.ok.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

    });

    describe('move/copy directory to other existing location under its ' +
             'original name avoiding any name conflict', function() {

      var cloneRoot = sourceRoot
        , postUrl = destUrl + '/' + destFolder
        , locUrl = postUrl + '/' + cloneRoot
        , cloneDummy = new Dummy(
            path.join(TEST_ROOT_PATH, destRoot, destFolder, cloneRoot),
            sourceFile,
            sourceContent,
            sourceFolder
          );

      beforeEach(function(done) {
        async.series([
          sourceDummy.ensure.bind(sourceDummy),
          destDummy.ensure.bind(destDummy)
        ], done);
      });

      it('should move directory and respond with status code 201, ' +
         'Content-Type text/html and Location /<moved_directory_url> ' +
         'and respond to GET /<moved_directory_url> request ' +
         'with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: URL_DIR + '/' + sourceRoot
        }, TEXT_HTML, locUrl, [
          assert.dummy.ok.bind(cloneDummy),
          assert.dummy.none.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

      it('should copy directory and respond with status code 201, ' +
         'Content-Type text/html and Location /<copied_directory_url> ' +
         'and respond to GET /<copied_directory_url> request ' +
         'with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: URL_DIR + '/' + sourceRoot,
          preserve: true
        }, TEXT_HTML, locUrl, [
          assert.dummy.ok.bind(cloneDummy),
          assert.dummy.ok.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

    });

    describe('move/copy directory to other existing location under ' +
             'a new name avoiding any name conflict', function() {

      var cloneRoot = utils.getRandStr()
        , postUrl = destUrl + '/' + destFolder
        , locUrl = postUrl + '/' + cloneRoot
        , cloneDummy = new Dummy(
            path.join(TEST_ROOT_PATH, destRoot, destFolder, cloneRoot),
            sourceFile,
            sourceContent,
            sourceFolder
          );

      beforeEach(function(done) {
        async.series([
          sourceDummy.ensure.bind(sourceDummy),
          destDummy.ensure.bind(destDummy)
        ], done);
      });


      it('should move directory and respond with status code 201, ' +
         'Content-Type text/html and Location /<moved_directory_url> ' +
         'and respond to GET /<moved_directory_url> request ' +
         'with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: URL_DIR + '/' + sourceRoot,
          name : cloneRoot
        }, TEXT_HTML, locUrl, [
          assert.dummy.ok.bind(cloneDummy),
          assert.dummy.none.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

      it('should copy directory and respond with status code 201, ' +
         'Content-Type text/html and Location /<copied_directory_url> ' +
         'and respond to GET /<copied_directory_url> request ' +
         'with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: URL_DIR + '/' + sourceRoot,
          name : cloneRoot,
          preserve: true
        }, TEXT_HTML, locUrl, [
          assert.dummy.ok.bind(cloneDummy),
          assert.dummy.ok.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

    });

    describe('move/copy file to its current location under a new name ' +
             'avoiding any name conflict', function() {

      var cloneRoot = sourceRoot
        , cloneFile = utils.getRandStr()
        , postUrl = URL_DIR + '/' + cloneRoot
        , locUrl = postUrl + '/' + cloneFile
        , cloneDummy = new Dummy(
            path.join(TEST_ROOT_PATH, cloneRoot),
            cloneFile,
            sourceContent,
            sourceFolder
          );

      beforeEach(function(done) {
        async.series([
          sourceDummy.ensure.bind(sourceDummy)
        ], done);
      });

      it('should move file and respond with status code 201, ' +
         'Content-Type text/html and Location /<moved_file_url> ' +
         'and respond to GET /<moved_file_url> request ' +
         'with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: postUrl + '/' + sourceFile,
          name : cloneFile
        }, TEXT_HTML, locUrl, [
          assert.dummy.file.ok.bind(cloneDummy),
          assert.dummy.file.none.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

      it('should copy file and respond with status code 201, ' +
         'Content-Type text/html and Location /<copied_file_url> ' +
         'and respond to GET /<copied_file_url> request ' +
         'with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: postUrl + '/' + sourceFile,
          name : cloneFile,
          preserve: true
        }, TEXT_HTML, locUrl, [
          assert.dummy.file.ok.bind(cloneDummy),
          assert.dummy.file.ok.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

    });

    describe('move/copy directory to its current location under a new ' +
             'name avoiding any name conflict', function() {

      var cloneRoot = utils.getRandStr()
        , postUrl = URL_DIR
        , locUrl = postUrl + '/' + cloneRoot
        , cloneDummy = new Dummy(
            path.join(TEST_ROOT_PATH, cloneRoot),
            sourceFile,
            sourceContent,
            sourceFolder
          );

      beforeEach(function(done) {
        async.series([
          sourceDummy.ensure.bind(sourceDummy),
          cloneDummy.cleanup.bind(cloneDummy)
        ], done);
      });


      it('should move directory and respond with status code 201, ' +
         'Content-Type text/html and Location /<moved_directory_url> ' +
         'and respond to GET /<moved_directory_url> request ' +
         'with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: URL_DIR + '/' + sourceRoot,
          name : cloneRoot
        }, TEXT_HTML, locUrl, [
          assert.dummy.ok.bind(cloneDummy),
          assert.dummy.none.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

      it('should copy directory and respond with status code 201, ' +
         'Content-Type text/html and Location /<copied_directory_url> ' +
         'and respond to GET /<copied_directory_url> request ' +
         'with status code 200', function(done) {

        assert.http.req.created(ORIGIN + postUrl, {
          local: URL_DIR + '/' + sourceRoot,
          name : cloneRoot,
          preserve: true
        }, TEXT_HTML, locUrl, [
          assert.dummy.ok.bind(cloneDummy),
          assert.dummy.ok.bind(sourceDummy),
          assert.http.req.get.bind(null, ORIGIN + locUrl, 200, null)
        ], done);

      });

    });

  });

  // Upload files
  // -----------------------------------------------------------------
  // TODO add test suites for file uploads

  // -----------------------------------------------------------------
  // DELETE
  // -----------------------------------------------------------------

  describe('DELETE existing base', function() {

    before(function(done) {
      dummy.ensure(done);
    });

    it('should respond with status code 404 without ' +
       'deletion of the base directory', function(done) {
      assert.http.req.common(DELETE, ORIGIN + URL_BASE, {}, 404, [
        assert.fs.path.dir.ok.bind(null, path.join(TEST_SERVER_PATH, STATIC_DIR)),
        assert.fs.path.dir.ok.bind(null, TEST_ROOT_PATH),
        assert.dummy.ok.bind(dummy)
      ], done);
    });

  });

  describe('DELETE existing base parent', function() {

    before(function(done) {
      dummy.ensure(done);
    });

    it('should respond with status code 404 without ' +
       'deletion of the server root directory', function(done) {
      assert.http.req.common(DELETE, ORIGIN + URL_BASE_PARENT, {}, 404, [
        assert.fs.path.dir.ok.bind(null, path.join(TEST_SERVER_PATH)),
        assert.fs.path.dir.ok.bind(null, path.join(TEST_SERVER_PATH, STATIC_DIR)),
        assert.fs.path.dir.ok.bind(null, TEST_ROOT_PATH),
        assert.dummy.ok.bind(dummy)
      ], done);
    });

  });

  describe('DELETE existing not empty directory', function() {

    beforeEach(function(done) {
      dummy.ensure(done);
    });

    describe('empty body', function() {
      it('should respond with status code 409 and without ' +
         'deletion of the directory ', function(done) {
        assert.http.req.common(
          DELETE,
          ORIGIN + URL_DIR,
          {},
          409,
          assert.dummy.ok.bind(dummy),
          done
        );
      });
    });

    describe('force flag provided', function() {
      it('should delete the directory and respond with status ' +
         'code 200', function(done) {
        assert.http.req.common(DELETE, ORIGIN + URL_DIR, {
          force: true
        }, 200, assert.fs.path.none.bind(null, TEST_ROOT_PATH), done);
      });
    });
  });

  describe('DELETE existing file', function() {

    before(function(done) {
      dummy.ensure(done);
    });

    it('should delete the file and respond with status ' +
       'code 200', function(done) {
      assert.http.req.common(
        DELETE,
        ORIGIN + URL_FILE,
        {},
        200,
        assert.dummy.file.none.bind(dummy),
        done
      );
    });
  });

  describe('DELETE existing file outside of root directory', function() {

    var fileName = utils.getRandStr()
      , filePath = path.join(TEST_SERVER_PATH, fileName);

    beforeEach(function() {
      fs.writeFileSync(filePath, '');
    });

    after(function() {
      fs.unlinkSync(filePath);
    });

    it('should respond with status code 404 without ' +
       'deletion of the file', function(done) {
      assert.http.req.common(
        DELETE,
        ORIGIN + URL_BASE_PARENT + '/' + fileName,
        {},
        404,
        assert.fs.path.file.ok.bind(null, filePath),
        done
      );
    });

  });

  describe('DELETE not existing', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(DELETE, ORIGIN + URL_404, {}, 404, null, done);
    });
  });
});
