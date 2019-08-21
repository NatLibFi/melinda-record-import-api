/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* API microservice of Melinda record batch import system
*
* Copyright (C) 2018-2019 University Of Helsinki (The National Library Of Finland)
*
* This file is part of melinda-record-import-api
*
* melinda-record-import-api program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* melinda-record-import-api is distributed in the hope that it will be useful,
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
const permissions = {
	profiles: {
		createOrUpdate: ['system'],
		read: ['system', 'importer', 'transformer'],
		query: ['system'],
		remove: ['system']
	},
	blobs: {
		query: ['all'],
		read: ['all'],
		create: ['system', 'creator'],
		update: ['system', 'importer', 'transformer'],
		abort: ['all'],
		remove: ['system'],
		removeContent: ['system'],
		readContent: ['all']
	}
};

export function hasPermission(type, command, profile, bgroups = []) {
	const permintted = profile.groups.some(
		group => permissions[type][command].includes(group) ||
		permissions[type][command].includes('all')
	);
	if (profile.groups.includes('system') || bgroups === []) {
		return permintted;
	}

	return profile.groups.some(group => bgroups.includes(group)) && permintted;
}
