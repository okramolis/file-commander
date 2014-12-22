'use strict';

/* Directives */

angular.module('fcmderDirectives', [])

// File details renderer
// - overview of file details
// - read/write access independent
.directive('fcmderFileDetails', [
  function () {
    return {
      restrict: 'E',
      templateUrl: '/templates/common/file-details.html'
    };
  }
])

// File preview not supported
// - message instead of file preview
.directive('fcmderFileNoPreview', [
  function () {
    return {
      restrict: 'E',
      templateUrl: '/templates/common/file-no-preview.html'
    };
  }
])

