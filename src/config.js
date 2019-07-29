/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* Shared modules for microservices of Melinda record batch import system
*
* Copyright (C) 2018-2019 University Of Helsinki (The National Library Of Finland)
*
* This file is part of melinda-record-import-commons
*
* melinda-record-import-commons program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* melinda-record-import-commons is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*
* @licend  The above is the entire license notice
* for the JavaScript code in this file.
*
*/

import {Utils} from '@natlibfi/melinda-commons';

const {readEnvironmentVariable, parseBoolean} = Utils;

export const CROWD_URL = readEnvironmentVariable('CROWD_URL', {defaultValue: ''});
export const CROWD_APP_NAME = readEnvironmentVariable('CROWD_APP_NAME', {defaultValue: ''});
export const CROWD_APP_PASSWORD = readEnvironmentVariable('CROWD_APP_PASSWORD', {defaultValue: ''});

export const PASSPORT_LOCAL_USERS = readEnvironmentVariable('PASSPORT_LOCAL_USERS', {defaultValue: ''});

export const ENABLE_PROXY = readEnvironmentVariable('ENABLE_PROXY', {defaultValue: false, format: parseBoolean});

export const API_URL = readEnvironmentVariable('API_URL', {defaultValue: 'http://localhost:8080'});
export const HTTP_PORT = readEnvironmentVariable('HTTP_PORT', {defaultValue: 8080, format: v => Number(v)});

export const MONGO_URI = readEnvironmentVariable('MONGO_URI', {defaultValue: 'mongodb://127.0.0.1/db'});
export const MONGO_DEBUG = readEnvironmentVariable('MONGO_DEBUG', {defaultValue: false, format: parseBoolean});

export const BLOBS_QUERY_LIMIT = readEnvironmentVariable('BLOBS_QUERY_LIMIT', {defaultValue: 100, format: v => Number(v)});

// 0 means unlimited
export const CONTENT_MAX_LENGTH = readEnvironmentVariable('CONTENT_MAX_LENGTH', {defaultValue: 0, format: v => Number(v)});

export const SOCKET_KEEP_ALIVE_TIMEOUT = readEnvironmentVariable('SOCKET_KEEP_ALIVE_TIMEOUT', {defaultValue: 0, format: v => Number(v)});

export const USER_AGENT_LOGGING_BLACKLIST = readEnvironmentVariable('USER_AGENT_LOGGING_BLACKLIST', {
	defaultValue: [
		'_RECORD-IMPORT-CONTROLLER',
		'_RECORD-IMPORT-IMPORTER',
		'_RECORD-IMPORT-TRANSFORMER',
		'_RECORD-IMPORT-HARVESTER'
	],
	format: JSON.parse
});

