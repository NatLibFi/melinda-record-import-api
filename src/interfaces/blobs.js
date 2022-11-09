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
import {BLOB_UPDATE_OPERATIONS, BLOB_STATE} from '@natlibfi/melinda-record-import-commons';
import {BlobMetadataModel, ProfileModel} from './models';
import {hasPermission} from './utils';
import {BLOBS_QUERY_LIMIT, melindaApiOptions} from '../config';
import {createLogger} from '@natlibfi/melinda-backend-commons';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import createDebugLogger from 'debug';
import {createApiClient as createMelindaApiClient} from '@natlibfi/melinda-rest-api-client';
import {QUEUE_ITEM_STATE} from '@natlibfi/melinda-rest-api-commons';

export default function ({url}) {
  const gridFSBucket = new GridFSBucket(Mongoose.connection.db, {bucketName: 'blobs'});
  const logger = createLogger();
  const debug = createDebugLogger('@natlibfi/melinda-record-import-api:interface/blobs');
  const melindaApiClient = melindaApiOptions.melindaApiUrl ? createMelindaApiClient(melindaApiOptions) : false;

  Mongoose.model('BlobMetadata', BlobMetadataModel);
  Mongoose.model('Profile', ProfileModel);

  return {query, read, create, update, remove, removeContent, readContent};

  async function query({profile, contentType, state, creationTime, modificationTime, user, offset}) {
    debug('query');
    const queryOpts = {
      limit: BLOBS_QUERY_LIMIT
    };

    const blobs = await Mongoose.models.BlobMetadata.find(await generateQuery(), undefined, queryOpts);
    logger.silly(`Query state: ${state}`);
    logger.silly(`Found ${blobs.length} blobs`);

    if (blobs.length < BLOBS_QUERY_LIMIT) {
      return {results: blobs.map(format)};
    }

    return {
      nextOffset: blobs.slice(-1).shift()._id.toString(),
      results: blobs.map(format)
    };

    function format(doc) {
      const blob = formatBlobDocument(doc);
      const {numberOfRecords, failedRecords, processedRecords, queuedRecords} = getRecordStats();

      delete blob.processingInfo; // eslint-disable-line functional/immutable-data

      return {
        ...blob,
        numberOfRecords, failedRecords, processedRecords, queuedRecords,
        url: `${url}/blobs/${blob.id}`
      };

      function getRecordStats() {
        const {processingInfo: {numberOfRecords, failedRecords, importResults, queuedRecords}} = blob;
        return {
          numberOfRecords,
          failedRecords: failedRecords.length,
          processedRecords: importResults.length,
          queuedRecords: queuedRecords.length
        };
      }
    }

    async function generateQuery() {
      const doc = await init();

      if (state) { // eslint-disable-line functional/no-conditional-statement
        doc.state = {$in: state}; // eslint-disable-line functional/immutable-data
      }

      if (contentType) { // eslint-disable-line functional/no-conditional-statement
        doc.contentType = {$in: contentType}; // eslint-disable-line functional/immutable-data
      }

      if (creationTime) {
        if (creationTime.length === 1) { // eslint-disable-line functional/no-conditional-statement
          doc.creationTime = formatTime(creationTime[0]); // eslint-disable-line functional/immutable-data
        } else { // eslint-disable-line functional/no-conditional-statement
          doc.$and = [ // eslint-disable-line functional/immutable-data
            {creationTime: {$gte: formatTime(creationTime[0])}},
            {creationTime: {$lte: formatTime(creationTime[1])}}
          ];
        }
      }

      if (modificationTime) {
        if (modificationTime.length === 1) { // eslint-disable-line functional/no-conditional-statement
          doc.modificationTime = formatTime(modificationTime[0]); // eslint-disable-line functional/immutable-data
        } else { // eslint-disable-line functional/no-conditional-statement
          doc.$and = [ // eslint-disable-line functional/immutable-data
            {modificationTime: {$gte: formatTime(modificationTime[0])}},
            {modificationTime: {$lte: formatTime(modificationTime[1])}}
          ];
        }
      }

      return doc;

      async function init() {
        const doc = {};
        const permittedProfiles = await getPermittedProfiles();

        if (offset) { // eslint-disable-line functional/no-conditional-statement
          doc._id = {$gt: ObjectId(offset)}; // eslint-disable-line new-cap, functional/immutable-data
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
    debug('Read');

    const doc = await Mongoose.models.BlobMetadata.findOne({id});

    if (doc) {
      const blob = formatBlobDocument(doc);
      const bgroups = await getProfile(blob.profile);
      if (hasPermission('blobs', 'read', user.groups, bgroups.auth.groups)) {
        return blob;
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob read permission error');
    }

    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob not found');
  }

  function formatBlobDocument(doc) {
    const blob = doc._doc;

    return Object.keys(blob).reduce((acc, key) => {
      if ((/^_+/u).test(key)) {
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
    debug('Remove');
    const blob = await Mongoose.models.BlobMetadata.findOne({id});

    if (blob) {
      if (hasPermission('blobs', 'remove', user.groups)) { // eslint-disable-line functional/no-conditional-statement
        try {
          await getFileMetadata(id);
          throw new ApiError(HttpStatus.BAD_REQUEST, 'Request error');
        } catch (err) {
          if (!(err instanceof ApiError && err.status === HttpStatus.NOT_FOUND)) { // eslint-disable-line functional/no-conditional-statement
            throw err;
          }
        }

        logger.debug('Removing blob!');
        return Mongoose.models.BlobMetadata.deleteOne({id});
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob removal permission error');
    }

    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob not found');
  }

  async function create({inputStream, profile, contentType, user}) {
    debug('Create');
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

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob creation permission error');
    }

    debug('Blob create invalid profile');
    throw new ApiError(HttpStatus.BAD_REQUEST, 'Blob create profile not found');
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

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob readContent permission error');
    }

    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob not found');
  }

  async function removeContent({id, user}) {
    const blob = await Mongoose.models.BlobMetadata.findOne({id});

    if (blob) {
      if (hasPermission('blobs', 'removeContent', user.groups)) {
        const {_id: fileId} = await getFileMetadata(id);
        return gridFSBucket.delete(fileId);
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob removeContent permission error');
    }

    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob not found');
  }

  async function update({id, payload, user}) { // Updated 20211103
    const blob = await Mongoose.models.BlobMetadata.findOne({id});
    const {op} = payload;

    if (blob) {
      const bgroups = await getProfile(blob.profile);
      const permission = await checkPermission(op, user, bgroups);
      if (permission) {
        const doc = await getUpdateDoc(bgroups);

        const updateIfNotInStates = [BLOB_STATE.TRANSFORMATION_FAILED, BLOB_STATE.ABORTED, BLOB_STATE.PROCESSED];
        if (updateIfNotInStates.includes(blob.state)) {
          throw new ApiError(HttpStatus.CONFLICT);
        }

        const {numberOfRecords, failedRecords, importResults} = blob.processingInfo;
        if (op === BLOB_UPDATE_OPERATIONS.recordProcessed && numberOfRecords <= failedRecords.length + importResults.length) { // eslint-disable-line functional/no-conditional-statement
          throw new ApiError(HttpStatus.CONFLICT);
        }

        const {modifiedCount} = await Mongoose.models.BlobMetadata.updateOne({id}, doc);

        if (modifiedCount === 0) { // eslint-disable-line functional/no-conditional-statement
          throw new ApiError(HttpStatus.CONFLICT);
        }

        if (melindaApiOptions.melindaApiUrl && doc.correlationId) {
          await melindaApiClient.setBulkStatus(doc.correlationId, QUEUE_ITEM_STATE.ABORT);
          return;
        }

        return;
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob update/abort permission error');
    }

    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob not found');

    function checkPermission(op, user, bgroups) {
      if (op) {
        if (op === BLOB_UPDATE_OPERATIONS.abort) {
          return hasPermission('blobs', 'abort', user.groups, bgroups.auth.groups);
        }

        return hasPermission('blobs', 'update', user.groups, bgroups.auth.groups);
      }

      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'Blob update operation error');
    }

    function getUpdateDoc() {
      const {
        abort, recordProcessed, recordQueued, transformationFailed,
        updateState, transformedRecord, addCorrelationId
      } = BLOB_UPDATE_OPERATIONS;

      logger.debug(`Update blob: ${op}`);

      if (op === updateState) {
        const {state} = payload;
        logger.debug(`State update to ${state}`);

        if ([
          BLOB_STATE.PROCESSED,
          BLOB_STATE.PROCESSING,
          BLOB_STATE.PROCESSING_BULK,
          BLOB_STATE.PENDING_TRANSFORMATION,
          BLOB_STATE.TRANSFORMATION_IN_PROGRESS,
          BLOB_STATE.TRANSFORMED
        ].includes(state)) {
          return {state, modificationTime: moment()};
        }

        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'Blob update state error');
      }

      if (op === abort) {
        const {correlationId} = blob;

        if (correlationId === '') {
          return {
            state: BLOB_STATE.ABORTED,
            modificationTime: moment()
          };
        }

        return {
          correlationId,
          state: BLOB_STATE.ABORTED,
          modificationTime: moment()
        };
      }

      if (op === transformationFailed) {
        logger.debug(`case: ${op}, Error: ${payload.error}`);
        return {
          state: BLOB_STATE.TRANSFORMATION_FAILED,
          modificationTime: moment(),
          $set: {
            'processingInfo.transformationError': payload.error
          }
        };
      }

      if (op === transformedRecord) {
        if (payload.error) {
          payload.error.timestamp = moment().format(); // eslint-disable-line new-cap, functional/immutable-data
          return {
            modificationTime: moment(),
            $push: {
              'processingInfo.failedRecords': payload.error
            },
            $inc: {
              'processingInfo.numberOfRecords': 1
            }
          };
        }

        return {
          modificationTime: moment(),
          $inc: {
            'processingInfo.numberOfRecords': 1
          }
        };
      }

      if (op === recordProcessed) {
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

      logger.debug(`recordQueued: ${recordQueued}`);
      if (op === recordQueued) {
        logger.debug('recordQueued');
        return {
          modificationTime: moment(),
          $push: {
            'processingInfo.queuedRecords': {
              title: payload.title,
              standardIdentifiers: payload.standardIdentifiers
            }
          }
        };
      }

      if (op === addCorrelationId) {
        logger.debug(`case: ${op}, CorrelationId: ${payload.correlationId}`);
        return {
          modificationTime: moment(),
          correlationId: payload.correlationId
        };
      }

      logger.error('Blob update case was not found');
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'Blob update operation error');
    }
  }

  async function getProfile(id) {
    const profile = await Mongoose.models.Profile.findOne({id});

    if (profile) {
      return profile;
    }
  }

  async function getFileMetadata(filename) {
    logger.debug('Getting file metadata!');
    const files = await gridFSBucket.find({filename}).toArray();
    if (files.length === 0) {
      logger.debug('No file metadata found!');
      throw new ApiError(HttpStatus.NOT_FOUND, 'File metadata not found');
    }

    logger.debug('Returning file metadata!');
    return files[0];
  }
}
