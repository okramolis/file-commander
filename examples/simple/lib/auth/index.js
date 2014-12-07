var passport = require('passport');

function configure(options) {
  var db = options.db
    , model = options.model
    , col = options.collection
  ;

  if (!!model && typeof model === 'string' ||
      !!col   && typeof col   === 'string'
  ) {
    var userSchema = new db.Schema({
      username: {// local strategy
        type  : String,
        sparse: true,
        unique: true
      },
      password: String, // local strategy TODO: store encryped form
      displayName: String,
      githubId: {
        type  : String,
        sparse: true,
        unique: true
      },
      googleId: {
        type  : String,
        sparse: true,
        unique: true
      }
    });
    var User = db.model(model, userSchema, col);

    passport.serializeUser(function(user, done) {
      debugger;
      done(null, '' + user._id);
    });

    passport.deserializeUser(function(id, done) {
      debugger;
      User.findById(id, function (err, user) {
        debugger;
        done(err, user);
      });
    });
  }
  return passport;
}


module.exports = {
  configure: configure
};
