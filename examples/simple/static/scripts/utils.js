var fcmderUtils = {
  app: {
    kind2mount: function(kind) {
      switch(kind) {
        case 'File':
          kind = 'files';
          break;
        case 'Folder':
          kind = 'folders';
          break;
        case 'Alias':
          kind = 'aliases';
          break;
        default:
          kind = (typeof kind === 'string')
                    ? ((kind.charAt(kind.length - 1) === 's')
                        ? kind.toLowerCase() + 'es'
                        : kind.toLowerCase() + 's')
                    : '';
      }
      return '/' + kind;
    },
    routeParams2url: function(params) {
      // TODO read mount via other way - move 'rest-api/' definition outside of js
      var url = fcmderUtils.path.join(location.pathname, 'rest-api/');
      if (typeof params.pathname === 'string') {
        url = fcmderUtils.path.join(url, params.pathname);
      }
      if (typeof params.itemname === 'string') {
        url = fcmderUtils.path.join(url, params.itemname);
      }
      url = fcmderUtils.path.removeTrailingSlash(url);
      return (!url || typeof url !== 'string') ? null : url;
    },
    meta2kind: function(meta) {
      if (!meta) {
        return null;
      }
      if (!!meta.isFile && !meta.isDir && !meta.isLink) {
        return 'File';
      }
      if (!meta.isFile && !!meta.isDir && !meta.isLink) {
        return 'Folder';
      }
      if (!meta.isFile && !meta.isDir && !!meta.isLink) {
        return 'Alias';
      }
      return 'unknown'
    }
  },
  // TODO add browserified versions for path utils
  path: {
    removeTrailingSlash: function(p) {
      if (typeof p !== 'string') {
        return null;
      }
      return (p === '/') ? p : p.replace(/\/+$/, '');
    },
    normalize: function(p) {
      if (typeof p !== 'string') {
        return null;
      }
      var arr = p.split('/');
      var out = [];
      var first = '';
      if (arr[0] === '') {
        arr.shift();
        first = '/';
      }
      var last = '';
      if (arr.length && arr[arr.length - 1] === '') {
        arr.pop();
        last = '/';
      }
      for(var i = 0, len = arr.length; i < len; i++) {
        if (!arr[i] || arr[i] === '.') {
          continue;
        }
        if (arr[i] === '..') {
          if (out.length) {
            out.pop();
            continue;
          }
        }
        out.push(arr[i]);
      }
      return first + out.join('/') + last;
    },
    basename: function(p) {
      p = fcmderUtils.path.removeTrailingSlash(p + '');
      var name;
      if ((name = p.match(/[^\/]*$/)) === null) {
        return p;
      }
      return name[0];
    },
    join: function(first, second) {
      if (typeof first !== 'string' || typeof second !== 'string') {
        return null;
      }
      var firstSlash = (first.charAt(first.length - 1) === '/');
      var secondSlash = (second.charAt(0) === '/');
      if ((firstSlash && !secondSlash) || (!firstSlash && secondSlash)) {
        return first + second;
      }
      if (firstSlash && secondSlash) {
        return first + second.slice(1);
      }
      return first + '/' + second;
    }
  }
};
