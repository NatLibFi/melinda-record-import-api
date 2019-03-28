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
import {GridFSBucket} from 'mongodb';
import {v4 as uuid} from 'uuid';
import {BLOB_UPDATE_OPERATIONS, BLOB_STATE} from '@natlibfi/melinda-record-import-commons';
import moment from 'moment';
import ApiError from '../error';
import {BlobMetadataModel, ProfileModel} from './models';
import {hasPermission, hasAdminPermission} from './utils';

export default function ({url}) {
	const gridFSBucket = new GridFSBucket(Mongoose.connection.db, {bucketName: 'blobs'});

	Mongoose.model('BlobMetadata', BlobMetadataModel);
	Mongoose.model('Profile', ProfileModel);

	return {query, read, create, update, remove, removeContent, readContent};

	async function query({profile, contentType, state, creationTime, modificationTime, user}) {
		const blobs = await Mongoose.models.BlobMetadata.find();
		const permittedBlobs = await filterPermitted();

		return permittedBlobs
			.filter(applyFilters)
			.map(blob => ({
				id: blob.id,
				url: `${url}/blobs/${blob.id}`
			}));

		async function filterPermitted() {
			const filtered = await Promise.all(blobs.map(async blob => {
				const profile = await getProfile(blob.profile);

				if (hasPermission(profile, user)) {
					return blob;
				}
			}));

			return filtered.filter(v => v);
		}

		function applyFilters(blob) {
			if (state && !state.includes(blob.state)) {
				return false;
			}

			if (profile && !profile.includes(blob.profile)) {
				return false;
			}

			if (contentType && !contentType.includes(blob.contentType)) {
				return false;
			}

			if (creationTime && !timeInRange(blob.creationTime, creationTime)) {
				return false;
			}

			if (modificationTime && !timeInRange(blob.modificationTime, modificationTime)) {
				return false;
			}

			return true;

			function timeInRange(contextStr, [startStr, endStr]) {
				const context = moment(contextStr);
				const start = moment(startStr);
				const end = endStr ? moment(endStr) : start;

				return context.isSameOrAfter(start) && context.isSameOrBefore(end);
			}
		}
	}

	async function read({id, user}) {
		const blob = await Mongoose.models.BlobMetadata.findOne({id});

		if (blob) {
			if (hasPermission(await getProfile(blob.profile), user)) {
				return format(blob);
			}

			throw new ApiError(HttpStatus.FORBIDDEN);
		}

		throw new ApiError(HttpStatus.NOT_FOUND);

		function format(blob) {
			const doc = blob._doc;

			return Object.keys(doc).reduce((acc, key) => {
				return /^_+/.test(key) ? acc : {[key]: doc[key], ...acc};
			}, {});
		}
	}

	async function remove({id, user}) {
		const blob = await Mongoose.models.BlobMetadata.findOne({id});

		if (blob) {
			if (hasAdminPermission(user)) {
				try {
					const {_id: fileId} = await getFileMetadata(id);
					await gridFSBucket.delete(fileId);
				} catch (err) {
					if (!(err instanceof ApiError && ApiError.status === HttpStatus.NOT_FOUND)) {
						throw err;
					}
				}

				await Mongoose.models.BlobMetadata.deleteOne({id});
			} else {
				throw new ApiError(HttpStatus.FORBIDDEN);
			}
		} else {
			throw new ApiError(HttpStatus.NOT_FOUND);
		}
	}

	async function create({inputStream, profile, contentType, user}) {
		const profileContent = await getProfile(profile);

		if (profileContent) {
			if (hasPermission(profileContent, user)) {
				const id = uuid();

				await Mongoose.models.BlobMetadata.create({id, profile, contentType});

				return new Promise((resolve, reject) => {
					const outputStream = gridFSBucket.openUploadStream(id);

					inputStream
						.on('error', reject)
						.on('data', chunk => {
							outputStream.write(chunk);
						})
						.on('end', () => {
							outputStream.end(undefined, undefined, () => {
								resolve(id);
							});
						});
				});
			}

			throw new ApiError(HttpStatus.FORBIDDEN);
		}

		throw new ApiError(HttpStatus.BAD_REQUEST);
	}

	async function readContent({id, user}) {
		const blob = await Mongoose.models.BlobMetadata.findOne({id});

		if (blob) {
			if (hasPermission(await getProfile(blob.profile), user)) {
				// Check if the file exists
				await getFileMetadata(id);

				return {
					contentType: blob.contentType,
					readStream: gridFSBucket.openDownloadStreamByName(id)
				};
			}

			throw new ApiError(HttpStatus.FORBIDDEN);
		}

		throw new ApiError(HttpStatus.NOT_FOUND);
	}

	async function removeContent({id, user}) {
		const blob = await Mongoose.models.BlobMetadata.findOne({id});

		if (blob) {
			if (hasAdminPermission(user)) {
				const {_id: fileId} = await getFileMetadata(id);
				await gridFSBucket.delete(fileId);
			} else {
				throw new ApiError(HttpStatus.FORBIDDEN);
			}
		} else {
			throw new ApiError(HttpStatus.NOT_FOUND);
		}
	}

	async function update({id, payload, user}) {
		const blob = await Mongoose.models.BlobMetadata.findOne({id});

		if (blob) {
			const profile = await getProfile(blob.profile);

			if (hasPermission(profile, user)) {
				if ('op' in payload) {
					const doc = await getUpdateDoc();
					await Mongoose.models.BlobMetadata.update({id}, doc);
				} else {
					throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY);
				}
			} else {
				throw new ApiError(HttpStatus.FORBIDDEN);
			}
		} else {
			throw new ApiError(HttpStatus.NOT_FOUND);
		}

		async function getUpdateDoc() {
			const {
				abort, recordProcessed, transformationStarted,
				transformationFailed, transformationDone
			} = BLOB_UPDATE_OPERATIONS;

			switch (payload.op) {
				case abort:
					return {
						state: BLOB_STATE.aborted
					};
				case transformationStarted:
					return {
						state: BLOB_STATE.inProgress
					};
				case transformationFailed:
					return {
						state: BLOB_STATE.failed,
						$set: {
							'processingInfo.transformationError': payload.error
						}
					};
				case transformationDone:
					if ('numberOfRecords' in payload) {
						return {
							state: getTransformedState(),
							modificationTime: moment(),
							$set: {
								'processingInfo.numberOfRecords': payload.numberOfRecords,
								'processingInfo.failedRecords': payload.failedRecords ? payload.failedRecords : []
							}
						};
					}

					throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY);
				case recordProcessed:
					if ('status' in payload) {
						return {
							state: getRecordProcessedState(),
							modificationTime: moment(),
							$push: {
								'processingInfo.importResults': {
									status: payload.status,
									metadata: payload.metadata
								}
							}
						};
					}

					throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY);
				default:
					throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY);
			}

			function getTransformedState() {
				const {failedRecords, numberOfRecords} = payload;

				if ((failedRecords === undefined ? 0 : failedRecords.length) === numberOfRecords) {
					return BLOB_STATE.processed;
				}

				return BLOB_STATE.transformed;
			}

			function getRecordProcessedState() {
				const {numberOfRecords, importResults, failedRecords} = blob.processingInfo;
				const recordsProcessed = failedRecords.length + importResults.length + 1;

				return numberOfRecords === recordsProcessed ? BLOB_STATE.processed : BLOB_STATE.transformed;
			}
		}
	}

	async function getProfile(id) {
		const profile = await Mongoose.models.Profile.findOne({id});

		if (profile) {
			return profile;
		}
	}

	async function getFileMetadata(filename) {
		return new Promise((resolve, reject) => {
			gridFSBucket.find({filename})
				.on('error', reject)
				.on('data', resolve)
				.on('end', () => reject(new ApiError(HttpStatus.NOT_FOUND)));
		});
	}
}
