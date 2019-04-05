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

import passport from 'passport';
import AtlassianCrowdStrategy from '@natlibfi/passport-atlassian-crowd';
import {Utils} from '@natlibfi/melinda-commons';
import {BasicStrategy} from 'passport-http';
import {
	CROWD_URL, CROWD_APP_NAME, CROWD_APP_PASSWORD,
	PASSPORT_USERPASS
} from './config';

const {createLogger} = Utils;

export default function () {
	const Logger = createLogger();
	const middlewares = [];

	if (CROWD_URL && CROWD_APP_NAME && CROWD_APP_PASSWORD) {
		passport.use(new AtlassianCrowdStrategy({
			url: CROWD_URL, app: CROWD_APP_NAME, password: CROWD_APP_PASSWORD,
			fetchGroupMembership: true
		}));

		Logger.log('info', 'Enabling Crowd passport strategy');
		middlewares.push(passport.authenticate('atlassian-crowd', {session: false}));
	}

	if (PASSPORT_USERPASS) {
		const {username, password} = PASSPORT_USERPASS;

		if (username && password) {
			passport.use(new BasicStrategy((reqUsername, reqPassword, done) => {
				if (reqUsername === username && reqPassword === password) {
					done(null, {
						id: username,
						name: {
							givenName: '',
							familyName: ''
						},
						displayName: username,
						emails: [{value: '', type: 'work'}],
						organization: [],
						groups: ['admin']
					});
				} else {
					done(null, false);
				}
			}));

			Logger.log('info', 'Enabling local passport strategy');
			middlewares.push(passport.authenticate('basic', {session: false}));
		}
	}

	if (middlewares.length === 0) {
		throw new Error('No passport strategies initialized');
	}

	return middlewares;
}
