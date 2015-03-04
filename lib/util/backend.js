// overrides request method property with provided one "_method"
exports.overrideBodyMethod = function(req, res){
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in body and delete it
    var method = req.body._method;
    delete req.body._method;
    return method;
  }
}

// returns address with express uses for redirection to 'back' (res.redirect('back'))
exports.getRedirectBackAddress = function(req) {
  return req.get('Referrer') || '/';
}
