
import {parseBoolean} from '@natlibfi/melinda-commons';
import {readEnvironmentVariable} from '@natlibfi/melinda-backend-commons';

export const CROWD_URL = readEnvironmentVariable('CROWD_URL', {defaultValue: ''});
export const CROWD_APP_NAME = readEnvironmentVariable('CROWD_APP_NAME', {defaultValue: ''});
export const CROWD_APP_PASSWORD = readEnvironmentVariable('CROWD_APP_PASSWORD', {defaultValue: ''});

export const PASSPORT_LOCAL_USERS = readEnvironmentVariable('PASSPORT_LOCAL_USERS', {defaultValue: ''});

export const ENABLE_PROXY = readEnvironmentVariable('ENABLE_PROXY', {defaultValue: false, format: parseBoolean});

export const API_URL = readEnvironmentVariable('RECORD_IMPORT_API_URL', {defaultValue: 'http://localhost:8080'});
export const HTTP_PORT = readEnvironmentVariable('HTTP_PORT', {defaultValue: 8080, format: v => Number(v)});

export const MONGO_URI = readEnvironmentVariable('MONGO_URI', {defaultValue: 'mongodb://127.0.0.1/db'});
export const MONGO_POOLSIZE = readEnvironmentVariable('MONGO_POOLSIZE', {defaultValue: 200, format: v => Number(v)});
export const MONGO_DEBUG = readEnvironmentVariable('MONGO_DEBUG', {defaultValue: false, format: parseBoolean});

export const BLOBS_QUERY_LIMIT = readEnvironmentVariable('BLOBS_QUERY_LIMIT', {defaultValue: 100, format: v => Number(v)});

// 0 means unlimited
export const CONTENT_MAX_LENGTH = readEnvironmentVariable('CONTENT_MAX_LENGTH', {defaultValue: 0, format: v => Number(v)});
export const SOCKET_KEEP_ALIVE_TIMEOUT = readEnvironmentVariable('SOCKET_KEEP_ALIVE_TIMEOUT', {defaultValue: 0, format: v => Number(v)});

export const melindaApiOptions = {
  melindaApiUrl: readEnvironmentVariable('MELINDA_API_URL', {defaultValue: false}),
  melindaApiUsername: readEnvironmentVariable('MELINDA_API_USERNAME', {defaultValue: ''}),
  melindaApiPassword: readEnvironmentVariable('MELINDA_API_PASSWORD', {defaultValue: ''})
};

export const USER_AGENT_LOGGING_BLACKLIST = readEnvironmentVariable('USER_AGENT_LOGGING_BLACKLIST', {
  defaultValue: [
    '_RECORD-IMPORT-CONTROLLER',
    '_RECORD-IMPORT-IMPORTER',
    '_RECORD-IMPORT-TRANSFORMER',
    '_RECORD-IMPORT-HARVESTER'
  ],
  format: JSON.parse
});

