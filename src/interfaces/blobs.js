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
import moment from 'moment';
import {GridFSBucket} from 'mongodb';
import {v4 as uuid} from 'uuid';
import {BLOB_UPDATE_OPERATIONS, BLOB_STATE, ApiError} from '@natlibfi/melinda-record-import-commons';
import {BlobMetadataModel, ProfileModel} from './models';
import {hasPermission, hasAdminPermission} from './utils';

export default function ({url}) {
	const gridFSBucket = new GridFSBucket(Mongoose.connection.db, {bucketName: 'blobs'});

	Mongoose.model('BlobMetadata', BlobMetadataModel);
	Mongoose.model('Profile', ProfileModel);

	return {query, read, create, update, remove, removeContent, readContent};

	async function query({profile, contentType, state, creationTime, modificationTime, user}) {
		const blobs = await Mongoose.models.BlobMetadata.find(generateQuery());
		const permittedBlobs = await filterPermitted();

		return permittedBlobs
			.map(doc => {
				const blob = formatDocument(doc);
				const {numberOfRecords, failedRecords, processedRecords} = getRecordStats();

				delete blob.processingInfo;

				return {
					...blob,
					numberOfRecords, failedRecords, processedRecords,
					url: `${url}/blobs/${blob.id}`
				};

				function getRecordStats() {
					const {processingInfo: {numberOfRecords, failedRecords, importResults}} = blob;
					return {
						numberOfRecords,
						failedRecords: failedRecords.length,
						processedRecords: importResults.length
					};
				}
			});

		async function filterPermitted() {
			const profileCache = {};
			const filtered = await Promise.all(blobs.map(async blob => {
				const profile = await getProfileUsingCache();

				if (hasPermission(profile, user)) {
					return blob;
				}

				async function getProfileUsingCache() {
					if ([blob.profile] in profileCache) {
						return profileCache[blob.profile];
					}

					const profile = await getProfile(blob.profile);

					profileCache[blob.profile] = profile;
					return profile;
				}
			}));

			return filtered.filter(v => v);
		}

		function generateQuery() {
			const doc = {};

			if (state) {
				doc.state = {$in: state};
			}

			if (profile) {
				doc.profile = {$in: profile};
			}

			if (contentType) {
				doc.contentType = {$in: contentType};
			}

			if (creationTime) {
				if (creationTime.length === 1) {
					doc.creationTime = formatTime(creationTime[0]);
				} else {
					doc.$and = [
						{creationTime: {$gte: formatTime(creationTime[0])}},
						{creationTime: {$lte: formatTime(creationTime[1])}}
					];
				}
			}

			if (modificationTime) {
				if (modificationTime.length === 1) {
					doc.modificationTime = formatTime(modificationTime[0]);
				} else {
					doc.$and = [
						{modificationTime: {$gte: formatTime(modificationTime[0])}},
						{modificationTime: {$lte: formatTime(modificationTime[1])}}
					];
				}
			}

			return doc;

			function formatTime(timestamp) {
				// Ditch the timezone
				const time = moment.utc(timestamp);
				return time.toDate();
			}
		}
	}

	async function read({id, user}) {
		const doc = await Mongoose.models.BlobMetadata.findOne({id});

		if (doc) {
			const blob = formatDocument(doc);

			if (hasPermission(await getProfile(blob.profile), user)) {
				return blob;
			}

			throw new ApiError(HttpStatus.FORBIDDEN);
		}

		throw new ApiError(HttpStatus.NOT_FOUND);
	}

	function formatDocument(doc) {
		const blob = doc._doc;

		return Object.keys(blob).reduce((acc, key) => {
			if (/^_+/.test(key)) {
				return acc;
			}

			if (key === 'creationTime' || key === 'modificationTime') {
				const value = moment(blob[key]).format();
				return {...acc, [key]: value};
			}

			return {...acc, [key]: blob[key]};
		}, {});
	}

	async function remove({id, user}) {
		const blob = await Mongoose.models.BlobMetadata.findOne({id});

		if (blob) {
			if (hasAdminPermission(user)) {
				try {
					await getFileMetadata(id);
					throw new ApiError(HttpStatus.BAD_REQUEST);
				} catch (err) {
					if (!(err instanceof ApiError && err.status === HttpStatus.NOT_FOUND)) {
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
						.on('data', chunk => outputStream.write(chunk))

						.on('end', () => outputStream.end(undefined, undefined, () => {
							resolve(id);
						}));
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
		const {op} = payload;

		if (blob) {
			const profile = await getProfile(blob.profile);
			if (hasPermission(profile, user)) {
				if (op) {
					const doc = await getUpdateDoc();
					const conditions = [
						{id},
						{
							state: {
								$nin: [
									BLOB_STATE.TRANSFORMATION_FAILED,
									BLOB_STATE.ABORTED,
									BLOB_STATE.PROCESSED
								]
							}
						}
					];

					if (op === BLOB_UPDATE_OPERATIONS.recordProcessed) {
						conditions.push({
							$expr: {
								$gt: [
									'$processingInfo.numberOfRecords',
									{
										$sum: [
											{$size: '$processingInfo.failedRecords'},
											{$size: '$processingInfo.importResults'}
										]
									}
								]
							}
						});
					}

					const {nModified} = await Mongoose.models.BlobMetadata.updateOne({$and: conditions}, doc);

					if (nModified === 0) {
						throw new ApiError(HttpStatus.CONFLICT);
					}
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
				abort, recordProcessed, transformationFailed, transformationDone, updateState
			} = BLOB_UPDATE_OPERATIONS;

			switch (op) {
				case updateState:
					if (hasAdminPermission(user)) {
						const {state} = payload;

						if ([
							BLOB_STATE.PROCESSED,
							BLOB_STATE.PENDING_TRANSFORMATION,
							BLOB_STATE.TRANSFORMATION_IN_PROGRESS,
							BLOB_STATE.TRANSFORMED
						].includes(state)) {
							return {state};
						}

						throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY);
					}

					throw new ApiError(HttpStatus.FORBIDDEN);
				case abort:
					return {
						state: BLOB_STATE.ABORTED
					};
				case transformationFailed:
					return {
						state: BLOB_STATE.TRANSFORMATION_FAILED,
						$set: {
							'processingInfo.transformationError': payload.error
						}
					};
				case transformationDone:
					if ('numberOfRecords' in payload) {
						return {
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
