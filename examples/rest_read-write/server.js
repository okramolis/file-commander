// Require server app.
var server = require('./');
// Configure the server.
server.configure(require('morgan')('dev'));
// Start listening on desired port optionally
// passed as the first argument to this process.
server.listen(Number(process.argv[2]));
