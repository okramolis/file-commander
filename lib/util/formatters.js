exports.meta2kind = function(meta) {
  if (!meta) {
    return;
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
  return 'unknown';
} // END of meta2kind

exports.meta2size = function(meta) {
  if (!meta) {
    return;
  }
  if (meta.isDir) {
    return '--';
  }
  if (meta.size < 1000) {
    return meta.size + ' B';
  }
  if (meta.size < 1000000) {
    return (Math.round(meta.size / 100) / 10) + ' KB';
  }
  if (meta.size < 1000000000) {
    return (Math.round(meta.size / 100000) / 10) + ' MB';
  }
  return (Math.round(meta.size / 100000000) / 10) + ' GB';
} // END of meta2size

exports.bytes2string = function(size) {
  if (size < 0) {
    return '--';
  }
  if (size < 1000) {
    return size + ' B';
  }
  if (size < 1000000) {
    return (Math.round(size / 100) / 10) + ' KB';
  }
  if (size < 1000000000) {
    return (Math.round(size / 100000) / 10) + ' MB';
  }
  return (Math.round(size / 100000000) / 10) + ' GB';
} // END of bytes2string

