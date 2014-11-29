'use strict';

/* Controllers */

var fcmderControllers = angular.module('fcmderControllers', []);

//--------------------------
// Listing directory content
//--------------------------
fcmderControllers.controller('DirectoryCtrl', ['$scope', '$http', '$routeParams',
  // Controller is supposed to be called for directory urls only (this is app's responsibility).
  function($scope, $http, $routeParams) {
    // Compose request address according to route params.
    var url = fcmderUtils.app.routeParams2url($routeParams);
    // Send request for current directory content.
    $http.get(url).success(function(data) {
      $scope.parentDir = new Item((data.path === '/') ? '.' : '..', {isDir: true}, {path: data.path});
      var items = [];
      var names = data.children.names;
      var stats = data.children.stats;
      for (var i = 0, len = names.length; i < len; i++) {
        items.push(new Item(names[i], stats[names[i]], data));
      }
      $scope.items = items;
    });
    // Initialize scope.
    $scope.orderMarker = {};
    // Set default ordering of items in current directory.
    setOrderProp('name');

    // Define handler for user event - reorder items in curent directory
    // according to specified property.
    $scope.onOrderClick = function(prop) {
      if (compareOrderPropNames($scope.orderProp, prop)) {
        setOrderProp(toggleOrderProp($scope.orderProp));
        return;
      }
      hideOrderProp($scope.orderProp);
      setOrderProp(getOrderPropVal(prop) || prop);
    }
    // Define constructor for current directory item like file, folder or alias.
    function Item(name, stats, data) {
      this.name  = name;
      this.kind  = fcmderUtils.app.meta2kind(stats);
      this.path  = fcmderUtils.path.join(
                    fcmderUtils.app.kind2mount(this.kind),
                    fcmderUtils.path.normalize(fcmderUtils.path.join(data.path, name))
                  );
      this.mtime = (!stats.mtime) ? null : new Date(stats.mtime);
      this.size  = (this.kind === 'Folder') ? 0 : stats.size;
    }
    // Define utilities for reordering current directory items according to
    // item's properties like name, date modified, size or kind.
    function setOrderProp(val) {
      $scope.orderProp = val;
      var name = getOrderPropName(val);
      if (!$scope.orderMarker.hasOwnProperty(name)) {
        $scope.orderMarker[name] = {};
      }
      $scope.orderMarker[name].state = (val === name);
      $scope.orderMarker[name].val = val;
      $scope.orderMarker[name].visible = true;
    }
    function hideOrderProp(val) {
      var name = getOrderPropName(val);
      $scope.orderMarker[name].visible = false;
    }
    function toggleOrderProp(prop) {
      if (prop.charAt(0) === '-') {
        prop = prop.slice(1);
      } else {
        prop = '-' + prop;
      }
      return prop;
    }
    function getOrderPropName(prop) {
      if (typeof prop !== 'string') {
        throw new Error('file-commander: order property must be string and no ' + typeof prop);
      }
      if (prop.charAt(0) === '-') {
        return prop.slice(1);
      }
      return prop;
    }
    function getOrderPropVal(prop) {
      return (!$scope.orderMarker[prop]) ? null : $scope.orderMarker[prop].val;
    }
    function compareOrderPropNames(p1, p2) {
      return getOrderPropName(p1) === getOrderPropName(p2);
    }
  }
]);

// ---------------------
// File detail - preview
// ---------------------
fcmderControllers.controller('FileCtrl', ['$scope', '$http', '$routeParams',
  // Controller is supposed to be called for file urls only (this is app's responsibility).
  function($scope, $http, $routeParams) {
    // Compose request address according to route params.
    var url = fcmderUtils.app.routeParams2url($routeParams);
    // Send request for file's details.
    $http.get(url).success(function(data) {
      // Format and store the received data.
      $scope.file = {
        name: data.name,
        path: fcmderUtils.path.normalize(
                fcmderUtils.path.join(
                  fcmderUtils.path.join(data.mounts.root, data.mounts.download),
                  fcmderUtils.path.join(data.path, data.name)
                )
              )
      };
    });
  }
]);

// ------------------------------
// Symbolic link detail - preview
// ------------------------------
fcmderControllers.controller('LinkCtrl', ['$scope', '$http', '$routeParams',
  // Controller is supposed to be called for link urls only (this is app's responsibility).
  function($scope, $http, $routeParams) {
    // Compose request address according to route params.
    var url = fcmderUtils.app.routeParams2url($routeParams);
    // Send request for link's details.
    $http.get(url).success(function(link) {
      // Format and store the received data.
      $scope.link = link;
      $scope.orig = {
        name  : fcmderUtils.path.basename(link.original)
      };
      var origUrl = fcmderUtils.path.normalize(
                      fcmderUtils.path.join(
                        link.mounts.root,
                        fcmderUtils.path.join(link.path, link.original)
                      )
                    );
      // Send request for original file's details.
      $http.get(origUrl).success(function(orig) {
        // Format and store the received data.
        var kind = fcmderUtils.app.meta2kind(orig.meta);
        $scope.orig.name = orig.name;
        $scope.orig.path = fcmderUtils.path.join(
                             fcmderUtils.app.kind2mount(kind),
                             fcmderUtils.path.join(orig.path, orig.name)
                           );
      });
    });
  }
]);
