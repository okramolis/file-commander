var redis   = require("redis")
  , client  = null
;
const NAME  = 'redis-test'
  ,   DEBUG = (process.env.NODE_ENV !== 'production')
;

function _testVal(right, val) {
  if (right !== val) {
    throw new Error(NAME + ': Test FAILED - shall be: "' + right + '", but is: "' + val + '"');
  }
  if (DEBUG) {
    console.log(NAME + ': Test PASSED - shall be: "' + right + '" and is: "' + val + '"');
  }
}

function isReady(cb) {
  if (client === null) {
    client = redis.createClient();
  }

  client.on("error", function (err) {
    throw new Error(NAME + err);
  });

  var testHashVals = ["hashtest 1", "hashtest 2"];
  client.set("string key", "string val", function(err, res) {
    _testVal(null, err);
    _testVal('OK', res);
  });
  client.hset("hash key", testHashVals[0], "some value", function(err, res) {
    _testVal(null, err);
    _testVal(0, res);
  });
  client.hset(["hash key", testHashVals[1], "some other value"], function(err, res) {
    _testVal(null, err);
    _testVal(0, res);
  });
  client.hkeys("hash key", function (err, replies) {
    testHashVals.forEach(function (right, i) {
      _testVal(right, replies[i]);
    });
    console.log(NAME + ': All tests PASSED');
    if (typeof cb === 'function') {
      cb();
    }
  });
}

function quitClient() {
  if (client === null) {
    return;
  }
  client.quit();
}

module.exports = {
  ready: isReady,
  quit : quitClient
};
