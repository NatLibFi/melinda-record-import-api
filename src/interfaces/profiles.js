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

import HttpStatus from 'http-status';
import Mongoose from 'mongoose';
import {ApiError} from '@natlibfi/melinda-record-import-commons';
import {ProfileModel} from './models';
import {hasPermission} from './utils';

export default function ({url}) {
	Mongoose.model('Profile', ProfileModel);

	return {query, read, createOrUpdate, remove};

	async function query({user}) {
		const profiles = await Mongoose.models.Profile.find().exec();
		return profiles.filter(p => hasPermission('profiles', 'query', user.groups, p.auth.groups)).map(profile => {
			return {
				id: profile.id,
				url: `${url}/profiles/${profile.id}`
			};
		});
	}

	async function read({id, user}) {
		const profile = await Mongoose.models.Profile.findOne({id}).exec();

		if (profile) {
			if (hasPermission('profiles', 'read', user.groups, profile.auth.groups)) {
				return format(profile);
			}

			throw new ApiError(HttpStatus.FORBIDDEN);
		}

		throw new ApiError(HttpStatus.NOT_FOUND);

		function format(profile) {
			const doc = profile._doc;

			return Object.keys(doc).reduce((acc, key) => {
				return /^_+/.test(key) ? acc : {[key]: doc[key], ...acc};
			}, {});
		}
	}

	async function remove({id, user}) {
		if (hasPermission('profiles', 'remove', user.groups)) {
			const profile = await Mongoose.models.Profile.findOne({id}).exec();

			if (profile) {
				await Mongoose.models.Profile.deleteOne({id}).exec();
			} else {
				throw new ApiError(HttpStatus.NOT_FOUND);
			}
		} else {
			throw new ApiError(HttpStatus.FORBIDDEN);
		}
	}

	async function createOrUpdate({id, payload, user}) {
		if (hasPermission('profiles', 'createOrUpdate', user.groups)) {
			const profile = await Mongoose.models.Profile.findOne({id}).exec();

			if (profile) {
				return execute(true);
			}

			return execute();
		}

		throw new ApiError(HttpStatus.FORBIDDEN);

		async function execute(update = false) {
			try {
				if (update) {
					await Mongoose.models.Profile.updateOne({id}, {...payload, id});
					return {updated: true};
				}

				await Mongoose.models.Profile.create({...payload, id});
				return {created: true};
			} catch (err) {
				if (err instanceof Mongoose.Error && (err.name === 'ValidationError' || err.name === 'StrictModeError')) {
					throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY);
				} else {
					throw err;
				}
			}
		}
	}
}
