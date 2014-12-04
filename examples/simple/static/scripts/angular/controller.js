'use strict';

/* Controllers */

var fcmderControllers = angular.module('fcmderControllers', []);

//-----------------------------
// File list item constructor
//-----------------------------
fcmderControllers.factory('Item', function() {
  function Item(name, stats, path) {
    this.name  = name;
    this.kind  = fcmderUtils.app.meta2kind(stats);
    this.path  = fcmderUtils.path.normalize(fcmderUtils.path.join(path, name));
    this.mount = fcmderUtils.app.kind2mount(this.kind);
    this.mtime = (!stats.mtime) ? null : new Date(stats.mtime);
    this.size  = (this.kind === 'Folder') ? 0 : stats.size;
  }
  Item.prototype.copy = function(source) {
    this.name  = source.name;
    this.kind  = source.kind;
    this.path  = source.path;
    this.mount = source.mount;
    this.mtime = source.mtime;
    this.size  = source.size;
  }
  return Item;
});

//-----------------------------
// Upload service
//-----------------------------
// Basic multipart/form-data encoding abstraction.
fcmderControllers.service('fileUpload', ['$http',
  function ($http) {
    this.uploadFileToUrl = function(files, uploadUrl){
      var fd = new FormData();
      for (var i = 0, len = files.length; i < len; i++) {
        fd.append('file', files[i]);
      }
      return $http.post(uploadUrl, fd, {
        transformRequest: angular.identity,
        headers: {'Content-Type': undefined}
      });
    }
  }
]);

// Passes files from element to scope.
// Supposed to be used on input[type="file"] element.
fcmderControllers.directive('fileModel', ['$parse',
  function ($parse) {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        var model = $parse(attrs.fileModel);
        var modelSetter = model.assign;

        element.bind('change', function(){
          scope.$apply(function(){
            modelSetter(scope, element[0].files);
          });
        });
      }
    };
  }
]);

// Event listener
// - submit => clear the input file element
fcmderControllers.directive('fileUploadFormWatch', [
  function () {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        element.bind('submit', function(){
          // TODO make this more robust - find input[type="file"] element
          this[0].value = null;
        });
      }
    };
  }
]);

//------------------------
// Submitted form handlers
//------------------------
fcmderControllers.controller('FileUploadCtrl', ['$scope', '$http', 'Item', 'fileUpload',
  function($scope, $http, Item, fileUpload){
    $scope.onSubmit = function(){
      var files = $scope.files2upload;
      if (!files) { return; }
      var uploadUrl = fcmderUtils.path.join('rest-api', $scope.currentDir.path);
      fileUpload.uploadFileToUrl(files, uploadUrl)
      .success(function(res){
        if (res.status === 201) {
          // New data created.
          // At least one file created.

          // Check right response format - location is mandatory.
          if (!res.location) {
            console.error('Invalid server response format.\n' + JSON.stringify(res));
            return;
          }

          // Inform user about accepted/rejected files.
          $scope.$emit('alert', res.message, 'success');

          var uploaded;
          if (Array.isArray(res.location)) {
            uploaded = res.location;
          } else if (typeof res.location === 'string') {
            uploaded = [res.location];
          }
          if (!Array.isArray(uploaded)) {
            console.log('file-commander: invalid location header "' + res.location + '"');
            return;
          }
          // Fetch the created item specified by "location" response property to update self.
          for(var i = 0, len = uploaded.length; i < len; i++) {
            $http.get(uploaded[i])
            .success(function(created) {
              $scope.items.push(new Item(created.name, created.meta, created.path));
            })
            .error(function(res) {
              console.error('file-commander: http error ...\n' + JSON.stringify(res));
              // TODO display error message
              // - page could not be refreshed, please refresh the page manually
            });
          }
          return;
        }
        if (res.status === 200) {
          // OK but nothing was created - nothing uploaded or everything rejected.
          $scope.$emit('alert', res.message);
          return;
        }
      })
      .error($scope.handleErrHttp);
    }
  }
]);

fcmderControllers.controller('FormPostCtrl', ['$scope', '$http', 'Item',
  // Controller is supposed to be called for submitted forms only (this is app's responsibility).
  function($scope, $http, Item) {
    // Set defaults for submitted form.
    $scope.form = {
      attrs : {}
    };

    // Set form submit event handler.
    $scope.onSubmit = function() {
      // Make sure current directory item is initialized.
      if (!($scope.currentDir instanceof Item)) {
        console.warn('file-commander: current directory has not been initialized yet.');
        return;
      }
      // Send post request and handle server response.
      $http.post(fcmderUtils.app.path2url($scope.currentDir.path), $scope.form.attrs)
      .success(function(res) {
        // Try to fetch up-to-date version of posted data.
        if (res.status === 200) {
          // Existing data modified.

          // Check right response format - location is mandatory.
          if (!res.location) {
            console.error('Invalid server response format.\n' + JSON.stringify(res));
            return;
          }
          if (!$scope.item) {
            console.warn('file-commander: content of current directory has been modified, ' +
                         '(from: "%s", to: "%s") but cannot be refreshed automatically, ' +
                         'please refresh the page manually.',
                         fcmderUtils.path.basename($scope.form.attrs.local),
                         $scope.form.attrs.name);
            return;
          }

          // Inform the user.
          $scope.$emit('alert', res.message, 'success');

          // Fetch the updated item specified by "location" response property to update self.
          $http.get(res.location)
          .success(function(updated) {
            var item = new Item(updated.name, updated.meta, updated.path);
            $scope.item.copy(item);
            item = null;
            if ($scope.form.attrs.hasOwnProperty('name')) {
              $scope.form.attrs.name = $scope.item.name;
            }
            if ($scope.form.attrs.hasOwnProperty('local')) {
              $scope.form.attrs.local = $scope.item.path;
            }
          })
          .error(function(res) {
            console.error('file-commander: http error ...\n' + JSON.stringify(res));
            // TODO display error message
            // - page could not be refreshed, please refresh the page manually
          });
          return;
        }
        if (res.status === 201) {
          // New data created.

          // Check right response format - location is mandatory.
          if (!res.location) {
            console.error('Invalid server response format.\n' + JSON.stringify(res));
            return;
          }

          // Inform the user.
          $scope.$emit('alert', res.message, 'success');

          // Fetch the created item specified by "location" response property to update self.
          $http.get(res.location)
          .success(function(created) {
            $scope.items.push(new Item(created.name, created.meta, created.path));
          })
          .error(function(res) {
            console.error('file-commander: http error ...\n' + JSON.stringify(res));
            // TODO display error message
            // - page could not be refreshed, please refresh the page manually
          });
          return;
        }
      })
      .error($scope.handleErrHttp);
    }
  }
]);

fcmderControllers.controller('FormDeleteCtrl', ['$scope', '$http',
  // Controller is supposed to be called for submitted forms only (this is app's responsibility).
  function($scope, $http) {
    // set defaults for submitted form
    $scope.form = {
      attrs : {
        _method: "DELETE"
      }
    };

    // set submit event handler
    $scope.onSubmit = function() {
      // send form and handle server response
      $http.post(fcmderUtils.app.path2url($scope.item.path), $scope.form.attrs)
      .success(function(res) {
        // Inform the user.
        $scope.$emit('alert', res.message, 'success');
        // find current item in the collection
        var i = $scope.items.indexOf($scope.item);
        if (i < 0 || i >= $scope.items.length) {
          // the item not found
          console.error('file-commander: cannot find item to be removed\n' + JSON.stringify($scope.item));
          return;
        }
        // remove current item from the collection
        $scope.items.splice(i, 1);
        $scope.item = null;
      })
      .error($scope.handleErrHttp);
    }
  }
]);

// --------------------------------------
// Shared controller
// --------------------------------------
// Root controller for specific template.
// Provided functionality:
// - handling alerts
//   - display
//   - close
// - handling http errors
fcmderControllers.controller('TemplateCtrl', ['$scope',
  function ($scope) {
    $scope.alerts = [];

    $scope.$on('alert', function(e, msg, type) {
      if (typeof msg !== 'string') {
        // Default messages.
        switch (type) {
          case 'success':
            msg = 'Success ...'
            break;
          case 'danger':
            msg = 'Unknown error occurred ...'
            break;
          default:
            msg = 'Warning ...'
        }
      }
      $scope.alerts.push({msg: msg, type: type});
    });

    $scope.closeAlert = function(index) {
      $scope.alerts.splice(index, 1);
    }

    $scope.handleErrHttp = function(res) {
      $scope.$emit('alert', res.message, 'danger');
    }
  }
]);

//--------------------------
// Listing directory content
//--------------------------
fcmderControllers.controller('DirectoryCtrl', ['$scope', '$http', '$routeParams', 'Item',
  // Controller is supposed to be called for directory urls only (this is app's responsibility).
  function($scope, $http, $routeParams, Item) {
    // Compose request address according to route params.
    var url = fcmderUtils.app.path2url($routeParams.pathname);
    // Send request for current directory content.
    $http.get(url).success(function(data) {
      var path = fcmderUtils.path.join(data.path, data.name);
      //var path = data.path;
      $scope.parentDir = new Item((path === '/') ? '.' : '..', {isDir: true}, path);
      $scope.currentDir = new Item('.', {isDir: true}, path);
      var items = [];
      var names = data.children.names;
      var stats = data.children.stats;
      for (var i = 0, len = names.length; i < len; i++) {
        items.push(new Item(names[i], stats[names[i]], path));
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
    var url = fcmderUtils.app.path2url($routeParams.pathname);
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
    var url = fcmderUtils.app.path2url($routeParams.pathname);
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
