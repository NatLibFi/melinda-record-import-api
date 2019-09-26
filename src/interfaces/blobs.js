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
import {GridFSBucket, ObjectId} from 'mongodb';
import {v4 as uuid} from 'uuid';
import {BLOB_UPDATE_OPERATIONS, BLOB_STATE, ApiError} from '@natlibfi/melinda-record-import-commons';
import {BlobMetadataModel, ProfileModel} from './models';
import {hasPermission} from './utils';
import {BLOBS_QUERY_LIMIT} from '../config';
import {Utils} from '@natlibfi/melinda-commons';

const {createLogger} = Utils;

export default function ({url}) {
	const gridFSBucket = new GridFSBucket(Mongoose.connection.db, {bucketName: 'blobs'});
	const logger = createLogger();

	Mongoose.model('BlobMetadata', BlobMetadataModel);
	Mongoose.model('Profile', ProfileModel);

	return {query, read, create, update, remove, removeContent, readContent};

	async function query({profile, contentType, state, creationTime, modificationTime, user, offset}) {
		const queryOpts = {
			limit: BLOBS_QUERY_LIMIT
		};

		const blobs = await Mongoose.models.BlobMetadata.find(await generateQuery(), undefined, queryOpts);

		if (blobs.length < BLOBS_QUERY_LIMIT) {
			return {results: blobs.map(format)};
		}

		return {
			nextOffset: blobs.slice(-1).shift()._id.toString(),
			results: blobs.map(format)
		};

		function format(doc) {
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
		}

		async function generateQuery() {
			const doc = await init();

			if (state) {
				doc.state = {$in: state};
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

			async function init() {
				const doc = {};
				const permittedProfiles = await getPermittedProfiles();

				if (offset) {
					doc._id = {$gt: ObjectId(offset)}; // eslint-disable-line new-cap
				}

				if (profile) {
					return {
						...doc,
						$and: [
							{profile: {$in: permittedProfiles}},
							{profile: {$in: profile}}
						]
					};
				}

				return {...doc, profile: {$in: permittedProfiles}};

				async function getPermittedProfiles() {
					const profiles = await Mongoose.models.Profile.find();

					return profiles
						.filter(profile => hasPermission('blobs', 'query', user.groups, profile.auth.groups))
						.map(({id}) => id);
				}
			}

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
			const bgroups = await getProfile(blob.profile);
			if (hasPermission('blobs', 'read', user.groups, bgroups.auth.groups)) {
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
			if (hasPermission('blobs', 'remove', user.groups)) {
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
			if (hasPermission('blobs', 'create', user.groups, profileContent.auth.groups)) {
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
			const bgroups = await getProfile(blob.profile);
			if (hasPermission('blobs', 'readContent', user.groups, bgroups.auth.groups)) {
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
			if (hasPermission('blobs', 'removeContent', user.groups)) {
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
			const bgroups = await getProfile(blob.profile);
			const permission = await checkPermission(op, user, bgroups);
			if (permission) {
				const doc = await getUpdateDoc(bgroups);
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
				throw new ApiError(HttpStatus.FORBIDDEN);
			}
		} else {
			throw new ApiError(HttpStatus.NOT_FOUND);
		}

		async function checkPermission(op, user, bgroups) {
			if (op) {
				logger.log('debug', `Update blob: ${op}`);
				if (op === BLOB_UPDATE_OPERATIONS.abort) {
					return hasPermission('blobs', 'abort', user.groups, bgroups.auth.groups);
				}

				return hasPermission('blobs', 'update', user.groups, bgroups.auth.groups);
			}

			throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY);
		}

		async function getUpdateDoc(bgroups) {
			const {
				abort, recordProcessed, transformationFailed,
				transformationDone, updateState,
				transformedRecordFailed
			} = BLOB_UPDATE_OPERATIONS;

			switch (op) {
				case updateState:
					if (hasPermission('blobs', 'update', user.groups, bgroups.auth.groups)) {
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
					logger.log('debug', `case: ${op}, Error: ${payload.error}`);
					return {
						state: BLOB_STATE.TRANSFORMATION_FAILED,
						modificationTime: moment(),
						$set: {
							'processingInfo.transformationError': payload.error
						}
					};
				case transformedRecordFailed:
					return {
						modificationTime: moment(),
						$push: {
							'processingInfo.failedRecords': payload.transformedRecord
						}
					};
				case transformationDone:
					return {
						modificationTime: moment(),
						$set: {
							'processingInfo.numberOfRecords': payload.numberOfRecords
						}
					};
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
