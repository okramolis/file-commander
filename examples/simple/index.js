const STATIC_PATH         = '/static'
  ,   COMMANDER_URL_MOUNT = '/commander'
  ,   DEFAULT_PORT        = 8888
  ,   STATIC_SETTINGS     = {
        dotfiles: 'allow'
      }
;

// get arguments passed by user
var usrArgI = 2;
const PORT = Number(process.argv[usrArgI++]) || DEFAULT_PORT;

// get required modules
var express = require('express')
  , bodyParser = require('body-parser')
  , logger = require('morgan')
  , commander = require('../..')
;

// get app
var app = express();

// -------------------------------------------------------------------
// APP CONFIGURATION
// -------------------------------------------------------------------

// middleware configuration
// -------------------------------------------------------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// logging
app.use(logger('dev'));

// serving public files
app.use(express.static(__dirname + STATIC_PATH, STATIC_SETTINGS));

// use file commander
app.use(COMMANDER_URL_MOUNT, commander.app({
  root    : __dirname,
  mount   : COMMANDER_URL_MOUNT,
  dotfiles: STATIC_SETTINGS.dotfiles
}));

// -------------------------------------------------------------------
// APP START
// -------------------------------------------------------------------

// start listening on defined port
app.listen(PORT);
console.log('listening on port ' + PORT);
