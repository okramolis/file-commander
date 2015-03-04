const PORT_MAX  = 65535
  ,   PORT_MIN  = 49152
;

exports.getRandStr = function() {
  return String(Math.random()).slice(2);
}

exports.getRandPort = function() {
  return Math.floor((Math.random() * (PORT_MAX - PORT_MIN + 1)) + PORT_MIN)
}
