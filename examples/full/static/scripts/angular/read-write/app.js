'use strict';

/* App Module */

angular.module('fcmderApp', [
  'ngRoute',
  'ui.bootstrap',
  'fcmderUtils',
  'fcmderDirectives',
  'fcmderServices',
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
    .when('/files/application/:mimesub/:pathname*', {
      templateUrl: '/templates/read-write/file/text.html',
      controller: 'FileCtrl'
    })
    .when('/files/text/:mimesub/:pathname*', {
      templateUrl: '/templates/read-write/file/text.html',
      controller: 'FileCtrl'
    })
    .when('/files/:mimemain/:mimesub/:pathname*', {
      templateUrl: '/templates/read-write/file/not-supported.html',
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
