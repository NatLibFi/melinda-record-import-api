export function hasPermission(userGroups, permittedGroups = []) {
  if (userGroups.includes('kvp')) {
    return true;
  }

  if (hasGroup(permittedGroups) === true) {
    return true;
  }

  console.log('Permitted groups does not match'); // eslint-disable-line
  return false;

  function hasGroup(permitted) {
    return userGroups.some(g => permitted.includes(g));
  }
}

// Test utils
// Remove properties we cannot have expectations for
export function formatDump(dump) {
  dump['blobs.chunks'].forEach(doc => {
    Object.keys(doc).forEach(k => {
      delete doc[k]; // eslint-disable-line functional/immutable-data
    });
  });

  dump['blobs.files'].forEach(doc => {
    Object.keys(doc).filter(k => k !== 'filename').forEach(k => {
      delete doc[k]; // eslint-disable-line functional/immutable-data
    });
  });

  dump.blobmetadatas.forEach(formatBlobMetadata);

  return dump;
}

export function formatBlobMetadata(doc) {
  format(doc);
  return doc;

  function format(o) {
    Object.keys(o).forEach(key => {
      if (['_id', 'creationTime', 'modificationTime', 'creationTime', 'timestamp'].includes(key)) {
        return delete o[key]; // eslint-disable-line functional/immutable-data
      }

      if (Array.isArray(o[key])) {
        return o[key].filter(v => typeof v === 'object').forEach(format);
      }

      if (typeof o[key] === 'object') {
        return format(o[key]);
      }
    });
  }
}
