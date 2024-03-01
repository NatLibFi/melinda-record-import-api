const permissions = {
  profiles: {
    createOrUpdate: ['record-import-kvp'],
    read: ['record-import-profiles-read'],
    query: ['record-import-profiles-read'],
    remove: ['record-import-kvp']
  },
  blobs: {
    query: ['record-import-blobs-read'],
    read: ['record-import-blobs-read'],
    create: ['record-import-blobs-create'],
    update: ['record-import-blobs-update'],
    remove: ['record-import-blobs-remove'],
    removeContent: ['record-import-blobs-content'],
    readContent: ['record-import-blobs-content']
  }
};

export function hasPermission(type, command, userGroups, permittedGroups = []) {
  console.log(userGroups); // eslint-disable-line
  const commandPermissions = permissions[type][command];
  if (userGroups.includes('record-import-kvp')) {
    return true;
  }

  if (hasGroup(permittedGroups) === false) {
    console.log('Permitted groups does not match'); // eslint-disable-line
    return false;
  }

  if (hasGroup(commandPermissions)) {
    console.log('Command permissions does not match'); // eslint-disable-line
    return true;
  }

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
