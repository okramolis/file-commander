'use strict';

/* Services */

angular.module('fcmderServices', [])

// File preview provider
// - provides different previews according to mime of the previewed file
.service('fcmderServices.filePreview', ['$q', '$http', 'File',
  function($q, $http, File) {
    if (typeof CodeMirror !== 'undefined') {
      // TODO make this an angular constant
      CodeMirror.modeURL = "/bower_components/codemirror/mode/%N/%N.js";
    }

    // Promises file preview.
    this.get = function(file, config) {
      if (!(file instanceof File)) {
        throw new Error('file-commander.fcmderServices.filePreview Error: ' +
                        'file must be instance of File but is "' +
                        (typeof file) + '"');
      }
      config = config || {};

      var HAS_SYNTAX_SUPPORT = this._hasSyntaxSupport(file.mime)
        , MAY_BE_HIGHLIGHTED = HAS_SYNTAX_SUPPORT &&
                               file.size <= config.syntaxHlBytesLimit
      ;

      if (MAY_BE_HIGHLIGHTED) {
        // CODE with SYNTAX highlight support
        // Return promise for supported source file content.
        return $q(this._promisedContent.bind(this, file, {}, this._onCodeContent));
      }

      var IS_TEXT = HAS_SYNTAX_SUPPORT || /^text\//.test(file.mime)
        , MAY_BE_LOADED_TEXT = file.size <= config.textPlainBytesLimit
      ;

      if (IS_TEXT && MAY_BE_LOADED_TEXT) {
        // TEXT/PLAIN
        // Return promise for text file content.
        return $q(this._promisedContent.bind(this, file, {}, this._onPlainContent));
      }
      if (IS_TEXT && !MAY_BE_LOADED_TEXT) {
        // too big for TEXT/PLAIN
        return $q(function(resolve, reject) {
          reject({code: 413});
        });
      }

      // OTHERWISE
      return $q(function(resolve, reject) {
        // Force not supported error.
        reject({code: 415});
      });
    }

    // Promise handler - provides content of requested file.
    this._promisedContent = function(file, config, onSuccess, resolve, reject) {
      $http.get(file.getHref(), config)
      .success(onSuccess.bind(this, file, resolve))
      .error(reject);
    }

    // Resolves promise got for source file content.
    this._onCodeContent = function(file, resolve, data) {
      if (typeof data !== 'string') {
        // TODO try to prevent json deserialization without
        //      loosing other default transformations
        //      - for now just serialize not string data back
        data = JSON.stringify(data, null, '\t');
      }
      // TODO add support for editing - not just read-only preview
      var elem = document.getElementsByTagName("CODE")[0];
      if (elem) {
        var elemParent = elem.parentNode;
        elemParent.innerHTML = "";
        this._hlSyntax(data, elemParent, file.mime, true);
      }
      resolve({
        // TODO make this an angular constant
        classes: 'fcmder_item-text-code'
      });
    }

    // Resolves promise got for text file content.
    this._onPlainContent = function(file, resolve, data) {
      resolve({
        text: data,
        // TODO make this an angular constant
        classes: 'fcmder_item-text-plain'
      });
    }

    // Performs syntax highlighting if possible.
    this._hlSyntax = function(data, elem, mime, readOnly) {
      if (!elem || !data) {
        return;
      }
      var editor = CodeMirror(elem, {
        mode: mime,
        value: data,
        readOnly: readOnly,
        lineNumbers: true
      });
      this._loadSyntaxDependencies(editor, mime);
    }

    // Returns true if given mime has syntax highlight support.
    this._hasSyntaxSupport = function(mime) {
      return !!(
        mime !== 'text/plain' &&
        typeof CodeMirror !== 'undefined' &&
        CodeMirror.findModeByMIME(mime)
      );
    }

    // Loads dependencies needed to highlight syntax for given mime.
    this._loadSyntaxDependencies = function(editor, mime) {
      var info = CodeMirror.findModeByMIME(mime)
        , mode
      ;
      if (info) {
        mode = info.mode;
      }
      if (mode) {
        CodeMirror.autoLoadMode(editor, mode);
      }
    }
  }
])

