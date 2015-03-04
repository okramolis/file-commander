var assert      = require('../../../lib/test/assert')
  , server      = require('../../../examples/rest_read-only')
  , FileLogger  = require('../../../lib/util/logger').FileLogger
  , utils       = require('../../../lib/util/common')
  , Dummy       = require('fs-dummy').Dummy
  , logger      = require('morgan')
  , async       = require('async')
  , path        = require('path')
  , fs          = require('fs')
;

const APP_NAME          = 'rest_read-only'
  ,   LOG_NAME          = APP_NAME + '.log'
  ,   LOG_PATH          = path.join(__dirname, 'log', LOG_NAME)
  ,   SERVER_PATH       = path.join('..', '..', '..', 'examples', APP_NAME)
  ,   STATIC_DIR        = 'public'
  ,   TEST_DIR          = '__test__' + utils.getRandStr()
  ,   TEST_ROOT_PATH    = path.resolve(__dirname, SERVER_PATH, STATIC_DIR, TEST_DIR)
  ,   TEST_INDIR        = 'test_dir'
  ,   TEST_FILE         = 'test.txt'
  ,   TEST_CONTENT      = 'testing ...'
  ,   PORT              = utils.getRandPort()
  ,   HOST              = 'localhost'
  ,   PROTOCOL          = 'http'
  ,   ORIGIN            = PROTOCOL + '://' + HOST + ':' + PORT
  ,   POST              = 'POST'
  ,   DELETE            = 'DELETE'
  ,   URL_ROOT          = '/'
  ,   URL_BASE          = '/rest-api'
  ,   URL_DIR           = URL_BASE + '/' + TEST_DIR
  ,   URL_FILE          = URL_DIR + '/' + TEST_FILE
  ,   URL_INDIR         = URL_DIR + '/' + TEST_INDIR
  ,   URL_FILE_DOWNLOAD = URL_ROOT + TEST_DIR + '/' + TEST_FILE
  ,   URL_404_NO_REST   = '/not/existing/url'
  ,   URL_404           = URL_BASE + URL_404_NO_REST
  ,   URL_BASE_PARENT   = URL_BASE + '/..'
  ,   TEXT_PLAIN        = /text\/plain/
  ,   APP_JSON          = /application\/json/
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
       'application/json, and with body containing current base ' +
       'directory metadata and metadata of its children', function(done) {
      assert.http.req.get(ORIGIN + URL_BASE, 200, [
        assert.http.res.contentType.bind(null, APP_JSON),
        assert.http.res.baseDirBodyJson.bind(null, TEST_DIR)
      ], done);
    });
  });

  describe('GET existing directory', function() {
    it('should respond with status code 200, content type ' +
       'application/json and with body containing metadata of ' +
       'current and parent base directory and metadata of ' +
       'current directory children', function(done) {
      assert.http.req.get(ORIGIN + URL_DIR, 200, [
        assert.http.res.contentType.bind(null, APP_JSON),
        assert.http.res.testDirBodyJson.bind(
          null,
          TEST_DIR,
          TEST_FILE,
          TEST_INDIR
        )
      ], done);
    });
  });

  describe('GET existing text file', function() {
    it('should respond with status code 200, content type ' +
       'application/json and with body containing metadata ' +
       'of the file and its parent directory', function(done) {
      assert.http.req.get(ORIGIN + URL_FILE, 200, [
        assert.http.res.contentType.bind(null, APP_JSON),
        assert.http.res.testFileBodyJson.bind(
          null,
          TEST_FILE,
          TEXT_PLAIN,
          '/' + TEST_DIR
        )
      ], done);
    });
  });

  describe('GET download existing text file', function() {
    it('should respond with status code 200, content type text/plain ' +
       'and body "' + TEST_CONTENT + '"', function(done) {
      assert.http.req.get(ORIGIN + URL_FILE_DOWNLOAD, 200, [
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

  describe('GET not existing outside of rest api', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.get(ORIGIN + URL_404_NO_REST, 404, null, done);
    });
  });

  // -----------------------------------------------------------------
  // POST
  // -----------------------------------------------------------------

  describe('POST existing base', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(POST, ORIGIN + URL_BASE, {}, 404, null, done);
    });
  });

  describe('POST existing base parent', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(POST, ORIGIN + URL_BASE_PARENT, {}, 404, null, done);
    });
  });

  describe('POST existing directory', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(POST, ORIGIN + URL_DIR, {}, 404, null, done);
    });
  });

  describe('POST existing file', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(POST, ORIGIN + URL_FILE, {}, 404, null, done);
    });
  });

  describe('POST not existing', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(POST, ORIGIN + URL_404, {}, 404, null, done);
    });
  });

  describe('POST not existing outside of rest api', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(POST, ORIGIN + URL_404_NO_REST, {}, 404, null, done);
    });
  });

  // -----------------------------------------------------------------
  // DELETE
  // -----------------------------------------------------------------

  describe('DELETE existing base', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(DELETE, ORIGIN + URL_BASE, {}, 404, null, done);
    });
  });

  describe('DELETE existing base parent', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(DELETE, ORIGIN + URL_BASE_PARENT, {}, 404, null, done);
    });
  });

  describe('DELETE existing directory', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(DELETE, ORIGIN + URL_DIR, {}, 404, null, done);
    });
  });

  describe('DELETE existing file', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(DELETE, ORIGIN + URL_FILE, {}, 404, null, done);
    });
  });

  describe('DELETE not existing', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(DELETE, ORIGIN + URL_404, {}, 404, null, done);
    });
  });

  describe('DELETE not existing outside of rest api', function() {
    it('should respond with status code 404', function(done) {
      assert.http.req.common(DELETE, ORIGIN + URL_404_NO_REST, {}, 404, null, done);
    });
  });
});
