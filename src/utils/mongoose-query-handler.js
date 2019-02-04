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

const _ = require('lodash');
const config = require('../config-general');
const serverErrors = require('./server-errors');

module.exports = {
	findOne(findResults, res, next, notFound) {
		switch (findResults.length) {
			case 0: {
				return next(serverErrors.getMissingContentError(notFound));
			}
			case 1: {
				const result = findResults[0].toJSON();
				delete result._id;
				delete result.__v;
				delete result.MetaDataID;
				return res.status(config.httpCodes.OK).send(result);
			}
			default:
				console.warn('Should be just one search result, found multiple: ', findResults);
				return res.status(config.httpCodes.Conflict).send('Found multiple documents when expected to find only one.');
		}
	},
	findOneProfile(findResults, resolve, reject) {
		switch (findResults.length) {
			case 0: {
				return resolve(null); // Item not found, no profile used
			}
			case 1: {
				return resolve(findResults[0].toJSON().profile);
			}
			default: {
				console.warn('Should be just one search result, found multiple: ', findResults);
				return reject(null);
			}
		}
	},
	findAuthgroups(findResults, reqGroups, resolve, reject) {
		switch (findResults.length) {
			case 0: {
				return resolve({reqGroups, DBGroups: []});
			}
			case 1: {
				return resolve({reqGroups, DBGroups: findResults[0].toJSON().auth.groups});
			}
			default: {
				console.warn('Should be just one search result, found multiple: ', findResults);
				return reject(null);
			}
		}
	},
	findMany(findResults, res) {
		_.forEach(findResults, value => {
			delete value.id;
		});
		return res.status(config.httpCodes.OK).send(findResults);
	},
	updateOne(result, res, next, notFound) {
		if (result) {
			return res.status(config.httpCodes.Updated).send('The metadata was updated');
		}
		return next(serverErrors.getMissingContentError(notFound || 'Data not found'));
	},
	returnUUID(findResults, res) {
		const results = [];
		_.forEach(findResults, value => {
			results.push(config.urlAPI + '/blobs/' + value.id);
		});
		return res.status(config.httpCodes.OK).send(results);
	},
	removeOne(obj, res, next, whatWasRemoved) {
		if (obj) {
			return res.status(config.httpCodes.NoContent).send(whatWasRemoved);
		}
		return next(serverErrors.getMissingContentError('Content not found'));
	},
	invalidQuery(res) {
		return res.status(config.httpCodes.BadRequest).send('Invalid query');
	},
	upsertObject(updated, res) {
		if (updated) {
			return res.status(config.httpCodes.NoContent).send('The profile was updated');
		}
		return res.status(config.httpCodes.Created).send('The profile was created');
	}
};
