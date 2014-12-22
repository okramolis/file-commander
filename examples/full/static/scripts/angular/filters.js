'use strict';

/* Filters */

angular.module('fcmderListOrderFilters', [])
.filter('marker', function() {
  return function(input) {
    if (!input || !input.visible) {
      return;
    }
    return (input.state) ? '\u25B2' : '\u25BC';
  };
});
angular.module('fcmderListFormatters', [])
.filter('size', function() {
  return function(item) {
    if (!item) { return; }
    if (item.kind === 'Folder') {
      return '--';
    }
    if (item.size < 1000) {
      return item.size + ' B';
    }
    if (item.size < 1000000) {
      return (Math.round(item.size / 10) / 100) + ' KB';
    }
    if (item.size < 1000000000) {
      return (Math.round(item.size / 10000) / 100) + ' MB';
    }
    return (Math.round(item.size / 10000000) / 100) + ' GB';
  };
})
.filter('kind', function() {
  return function(item) {
    if (!item) { return; }
    return (item.kind === 'File') ? item.mime : item.kind;
  }
})
.filter('url', function() {
  return function(item) {
    if (!item) { return; }
    return item.getHref();
  }
})
.filter('mtime', function() {
  return function(item) {
    if (!item || !(item.mtime instanceof Date)) { return '--'; }
    return item.mtime.toLocaleString();
  };
})
;
