'use strict';

/* App Module */

angular.module('fcmderApp', [
  'ngRoute',
  'ui.bootstrap',
  'fcmderUtils',
  'fcmderControllers',
  'fcmderListOrderFilters',
  'fcmderListFormatters'
])
.config(['$routeProvider',
  function($routeProvider) {
    $routeProvider
    .when('/folders/', {
      templateUrl: '/templates/read-write/directory.html',
      controller: 'DirectoryCtrl'
    })
    .when('/folders/:pathname*', {
      templateUrl: '/templates/read-write/directory.html',
      controller: 'DirectoryCtrl'
    })
    .when('/files/:pathname*', {
      templateUrl: '/templates/read-write/file.html',
      controller: 'FileCtrl'
    })
    .when('/aliases/:pathname*', {
      templateUrl: '/templates/read-write/link.html',
      controller: 'LinkCtrl'
    })
    .otherwise({
      redirectTo: '/folders/'
    });
  }
]);
