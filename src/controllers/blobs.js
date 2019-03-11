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

/* eslint-disable valid-jsdoc */

'use strict';

const {Utils} = require('@natlibfi/melinda-commons');
const {createLogger} = Utils;

const mongoose = require('mongoose');
const moment = require('moment');
const uuid = require('uuid');
const _ = require('lodash');

const config = require('../config-general');
const serverErrors = require('../utils/server-errors');
const mongoErrorHandler = require('../utils/mongoose-error-handler');
const queryHandler = require('../utils/mongoose-query-handler');

const gFSB = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {bucketName: 'blobmetadatas'});
const allowedQueryFields = ['profile', 'contentType', 'state', 'creationTime', 'modificationTime'];

const Logger = createLogger();

/**
 * Create a new blob
 *
 * Import-Profile string Name of the import profile to use
 * no response value expected for this operation
*/
module.exports.postBlob = function (req, res, next) {
	// Check mandarory variables (http turns those to lowercase)
	if (!req.headers['content-type']) {
		return next(serverErrors.getMissingContentTypeError());
	}

	if (!req.headers['import-profile']) {
		return next(serverErrors.getMissingProfileError());
	}

	mongoose.models.Profile.where('name', req.headers['import-profile'])
		.exec()
		.then(documents => {
			if (documents.length === 1) {
				saveBlob(); // All is good, save.
			} else {
				return next(serverErrors.getMissingProfileError());
			}
		}).catch(err => mongoErrorHandler(err, res, next));
	if (req.headers['content-length'] && config.contentMaxLength > 0 && req.headers['content-length'] > config.contentMaxLength) {
		return next(serverErrors.getRequestBodyLargeError());
	}

	// Do actual saving
	function saveBlob() {
		const newBlobMetadata = new mongoose.models.BlobMetadata({});
		newBlobMetadata.id = uuid.v4();
		newBlobMetadata.profile = req.headers['import-profile'];
		newBlobMetadata.contentType = req.headers['content-type'];
		newBlobMetadata.state = config.enums.BLOB_STATE.pending;
		newBlobMetadata.creationTime = moment(); // Use this if you want datetime to be formated etc, otherwise mongoose appends creation and modificationTime

		newBlobMetadata.save(err => {
			if (err) {
				return next(serverErrors.getValidationError());
			}

			const writestream = gFSB.openUploadStream(newBlobMetadata.id);

			req.on('error', err => {
				return next(serverErrors.getUnknownError(err));
			}).on('data', chunk => {
				Logger.log('debug', `${moment()} Chunk: ${chunk}`);
				writestream.write(chunk);
			}).on('end', () => {
				writestream.end();
				Logger.log('debug', `Finished writing blob with id: ${newBlobMetadata.id}`);
				return res.status(config.enums.HTTP_CODES.OK).header({Location: config.urlAPI + '/blobs/' + newBlobMetadata.id}).send('The blob was succesfully created. State is set to ' + newBlobMetadata.state);
			});
		});
	}
};

/**
 * Query for blobs
 *
 * profile string  (optional)
 * contentType string  (optional)
 * state string  (optional)
 * creationTime string The query is done using a time range if the parameter is provided twice (optional)
 * modificationTime string The query is done using a time range if the parameter is provided twice (optional)
 * returns array
*/
module.exports.getBlob = function (req, res, next) {
	Logger.log('debug', `Query: ${JSON.stringify(req.query)}`);
	const query = req.query;

	try {
		// Validate query fields:
		// Allowed field
		// No duplicates
		_.forEach(query, (value, key) => {
			if (!allowedQueryFields.includes(key) ||
				(Array.isArray(value) && !(key === 'creationTime' || key === 'modificationTime'))) {
				throw new Error('Invalid query field');
			}
		});
	} catch (err) {
		if (err.message === 'Invalid query field') {
			return queryHandler.invalidQuery(res);
		}
	}

	if (query.creationTime) {
		if (query.creationTime.length === 2 &&
			moment(query.creationTime[0], moment.ISO_8601).isValid() &&
			moment(query.creationTime[1], moment.ISO_8601).isValid()) {
			query.creationTime = {
				$gte: query.creationTime[0],
				$lte: query.creationTime[1]
			};
		} else {
			return queryHandler.invalidQuery(res);
		}
	}

	if (query.modificationTime) {
		if (query.modificationTime.length === 2 &&
			moment(query.modificationTime[0], moment.ISO_8601).isValid() &&
			moment(query.modificationTime[1], moment.ISO_8601).isValid()) {
			query.modificationTime = {
				$gte: query.modificationTime[0],
				$lte: query.modificationTime[1]
			};
		} else {
			return queryHandler.invalidQuery(res);
		}
	}

	mongoose.models.BlobMetadata.find(query)
		.exec()
		.then(documents => queryHandler.returnUUID(documents, res))
		.catch(err => mongoErrorHandler(err, res, next));
};

/**
 * Retrieve blob metadata by id
 *
 * returns BlobMetadata
*/
module.exports.getBlobById = function (req, res, next) {
	mongoose.models.BlobMetadata.where('id', req.params.id)
		.exec()
		.then(documents => queryHandler.findOne(documents, res, next, 'The blob does not exist'))
		.catch(err => mongoErrorHandler(err, res, next));
};

/**
 * Update blob metadata
 *
 * body object  (optional)
*/
module.exports.postBlobById = function (req, res, next) {
	if (req.body.id && req.body.id !== req.params.id) {
		return next(serverErrors.getIDConflictError());
	}

	let blob = Object.assign({}, req.body);

	// Operations:
	if (blob.op) {
		const op = blob.op;
		delete blob.op; // Cannot mongo if invalid element
		switch (op) {
			// Blob processing is aborted. State is set to ABORTED and (precondition) all the records related to the blob are removed from the import queue
			case config.enums.OP.abort: {
				blob = {state: config.enums.BLOB_STATE.aborted};
				break; // Use normal update
			}

			// Blob transformation is started. State is set to TRANSFORMATION_IN_PROGRESS
			case config.enums.OP.transformationStarted: {
				blob = {state: config.enums.BLOB_STATE.inProgress};
				break; // Use normal update
			}

			// Blob state is set to TRANSFORMED and numberOfRecords is set to the provided value
			case config.enums.OP.transformationDone: {
				if (typeof (blob.numberOfRecords) !== 'number') {
					return next(serverErrors.getMalformedError('Missing valid number of records'));
				}

				blob = {state: config.enums.BLOB_STATE.transformed, processingInfo: {numberOfRecords: blob.numberOfRecords}};
				break; // Use normal update
			}

			// Blob state is set to TRANSFORMATION_FAILED and transformationError is set to the provided value
			case config.enums.OP.transformationFailed: {
				if (typeof (blob.error) !== 'object') {
					return next(serverErrors.getMalformedError('Missing valid error'));
				}

				blob = {state: config.enums.BLOB_STATE.failed, processingInfo: {transformationError: blob.error}};
				break; // Use normal update
			}

			// The record result is appended to the importResults property. If the number of items in the importResults property equals numberOfRecords state if set to PROCESSED
			case config.enums.OP.recordProcessed: {
				blob = {content: blob.content};
				mongoose.models.BlobMetadata.findOneAndUpdate(
					{id: req.params.id},
					{
						$push: {
							'processingInfo.importResults': blob.content
						}
					},
					{new: true, upsert: false, runValidators: true}
				).then(result => {
					if (result.processingInfo.importResults && result.processingInfo.importResults.length === result.processingInfo.numberOfRecords) {
						mongoose.models.BlobMetadata.findOneAndUpdate(
							{id: req.params.id},
							{state: config.enums.BLOB_STATE.processed},
							{new: true, upsert: false, runValidators: true}
						).then(result => queryHandler.updateOne(result, res, next, 'The blob does not exist')
						).catch(err => mongoErrorHandler(err, res, next));
					} else {
						queryHandler.updateOne(result, res, next, 'The blob does not exist');
					}
				}).catch(err => mongoErrorHandler(err, res, next));
				return; // Ensure that normal update is not called after op update
			}

			default: {
				return next(serverErrors.getMalformedError('Unidentified op'));
			}
		}
	}

	// Default post update
	mongoose.models.BlobMetadata.findOneAndUpdate(
		{id: req.params.id},
		blob,
		{new: true, upsert: false, runValidators: true}
	).then(result => queryHandler.updateOne(result, res, next, 'The blob does not exist'))
		.catch(err => mongoErrorHandler(err, res, next));
};

/**
 * Delete a blob
 * The blob is completely removed including _all related records in the queue
 *
*/
module.exports.deleteBlobById = function (req, res, next) {
	mongoose.models['BlobMetaDatas.File'].where('filename', req.params.id)
		.exec()
		.then(documents => {
			if (documents.length === 1) {
				// Delete both .chunks and .file
				gFSB.delete(documents[0]._id, error => {
					if (error) {
						return next(serverErrors.getUnknownError(error));
					}

					// Remove metadata
					mongoose.models.BlobMetadata.findOneAndRemove()
						.where('id', req.params.id)
						.exec()
						.then(documents => queryHandler.removeOne(documents, res, next, 'The blob was removed'))
						.catch(err => mongoErrorHandler(err, res, next));
				});
			} else {
				return next(serverErrors.getMissingContentError());
			}
		})
		.catch(err => mongoErrorHandler(err, res, next));
};

/**
 * Retrieve blob content
 *
*/
module.exports.getBlobByIdContent = function (req, res, next) {
	mongoose.models['BlobMetaDatas.File'].where('filename', req.params.id)
		.exec()
		.then(documents => {
			if (documents.length === 1) {
				const downloadStream = gFSB.openDownloadStream(documents[0]._id);

				downloadStream.on('error', err => {
					return next(serverErrors.getStreamError('Error on download stream, possibly missing content chunks', err));
				});

				downloadStream.pipe(res);
			} else {
				return next(serverErrors.getMissingContentError());
			}
		})
		.catch(err => mongoErrorHandler(err, res, next));
};

/**
 * Delete blob content
 * The blob content is removed. If blob state is PENDING_TRANSFORMATION it is set to ABORTED
 *
*/
module.exports.deleteBlobByIdContent = function (req, res, next) {
	mongoose.models['BlobMetaDatas.File'].where('filename', req.params.id)
		.exec()
		.then(documents => {
			if (documents.length === 1) {
				gFSB.delete(documents[0]._id, error => {
					if (error) {
						return next(serverErrors.getUnknownError(error));
					}

					queryHandler.removeOne({id: documents[0]._id}, res, next, 'The content was removed');
				});
			} else {
				return next(serverErrors.getMissingContentError());
			}
		})
		.catch(err => mongoErrorHandler(err, res, next));
};
