
import HttpStatus from 'http-status';
import moment from 'moment';
import {v4 as uuid} from 'uuid';

import {createLogger} from '@natlibfi/melinda-backend-commons';
import {Error as ApiError, parseBoolean} from '@natlibfi/melinda-commons';
import {BLOB_STATE, createMongoBlobsOperator, createMongoProfilesOperator} from '@natlibfi/melinda-record-import-commons';
import {createApiClient as createMelindaApiClient} from '@natlibfi/melinda-rest-api-client';
import {QUEUE_ITEM_STATE} from '@natlibfi/melinda-rest-api-commons';

import {hasPermission} from './utils';

export default async function ({MONGO_URI, MELINDA_API_OPTIONS, BLOBS_QUERY_LIMIT, MONGO_DB = 'db'}) {
  const logger = createLogger();
  const mongoBlobsOperator = await createMongoBlobsOperator(MONGO_URI, MONGO_DB);
  const mongoProfileOperator = await createMongoProfilesOperator(MONGO_URI, MONGO_DB);
  const melindaApiClient = MELINDA_API_OPTIONS.melindaApiUrl ? createMelindaApiClient(MELINDA_API_OPTIONS) : false;

  return {query, read, create, update, remove, removeContent, readContent};

  // MARK: Query
  /* eslint-disable-next-line */
  async function query(params) {
    logger.silly('Query');
    const {user, offset: skip, limit = BLOBS_QUERY_LIMIT, getAll: tempGetAll, ...rest} = params;
    console.log(tempGetAll);// eslint-disable-line
    const getAll = tempGetAll ? parseBoolean(tempGetAll) : true;
    console.log(getAll);// eslint-disable-line
    const results = [];
    const nextOffset = await new Promise((resolve, reject) => {
      const emitter = mongoBlobsOperator.queryBlob({...rest, skip, limit, getAll}, user);
      emitter.on('blobs', blobs => blobs.forEach(blob => results.push(blob))) // eslint-disable-line functional/immutable-data
        .on('error', error => reject(error))
        .on('end', nextOffset => resolve(nextOffset));
    });
    return {nextOffset, results: format(results)};

    function format(doc) {
      const blobs = doc.map(blob => formatBlobDocument(blob, true)).map(blob => {
        const {numberOfRecords, failedRecords, processedRecords} = blob.processingInfo;
        delete blob.processingInfo; // eslint-disable-line functional/immutable-data

        return {
          ...blob,
          numberOfRecords, failedRecords, processedRecords
        };

      });
      return blobs;
    }
  }

  // MARK: Read
  async function read({id, user}) {
    logger.debug(`Read: ${id}`);

    const doc = await mongoBlobsOperator.readBlob({id});

    if (doc) {
      const blob = formatBlobDocument(doc);
      const apiProfile = await getProfile({id: blob.profile});
      if (hasPermission(user.roles.groups, apiProfile.groups)) {
        return blob;
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob read permission error');
    }

    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob not found');
  }

  // MARK: Format blob document
  function formatBlobDocument(doc, handleStats = false) {
    const blob = doc;

    return Object.keys(blob).reduce((acc, key) => {
      if ((/^_+/u).test(key)) {
        return acc;
      }

      if (key === 'creationTime' || key === 'modificationTime') {
        const value = moment(blob[key]).format();
        return {...acc, [key]: value};
      }

      if (handleStats && key === 'processingInfo') {
        const {numberOfRecords, failedRecords, importResults} = blob[key];
        return {
          ...acc, [key]: {
            numberOfRecords,
            failedRecords: failedRecords.length,
            processedRecords: importResults.length
          }
        };
      }

      return {...acc, [key]: blob[key]};
    }, {});
  }

  // MARK: Remove
  async function remove({id, user}) {
    logger.debug('Remove');
    const blob = await mongoBlobsOperator.readBlob({id});

    const apiProfile = await getProfile({id: blob.profile});
    if (hasPermission(user.roles.groups, apiProfile.groups)) { // eslint-disable-line functional/no-conditional-statements
      return mongoBlobsOperator.removeBlob({id});
    }

    throw new ApiError(HttpStatus.FORBIDDEN, 'Blob removal permission error');
  }

  // MARK: Create
  async function create({inputStream, profile, contentType, date, user}) {
    logger.debug('Create');

    const apiProfile = await getProfile({id: profile});

    if (apiProfile) {
      if (hasPermission(user.roles.groups, apiProfile.groups)) {
        const id = uuid();

        await mongoBlobsOperator.createBlob({id, profile, contentType, date}, inputStream);
        await mongoBlobsOperator.updateBlob({id, payload: {op: 'updateState', state: BLOB_STATE.PENDING_TRANSFORMATION, test: true}});
        return id;
      }

      throw new ApiError(403, 'Invalid profile permissions');
    }
  }

  // MARK: Read content
  async function readContent({id, user}) {
    const blob = await mongoBlobsOperator.readBlob({id});

    if (blob) {
      const apiProfile = await getProfile({id: blob.profile});
      if (hasPermission(user.roles.groups, apiProfile.groups)) { // eslint-disable-line functional/no-conditional-statements
        const {contentType} = blob;
        const readStream = mongoBlobsOperator.readBlobContent({id});
        return {contentType, readStream};
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob readContent permission error');
    }

    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob not found');
  }

  // MARK: Remove content
  async function removeContent({id, user}) {
    const blob = await mongoBlobsOperator.readBlob({id});

    if (blob) {
      const apiProfile = await getProfile({id: blob.profile});
      if (hasPermission(user.roles.groups, apiProfile.groups)) { // eslint-disable-line functional/no-conditional-statements
        return mongoBlobsOperator.removeBlobContent({id});
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob removeContent permission error');
    }
    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob not found');
  }

  // MARK: Update
  async function update({id, payload, user}) {
    const blob = await mongoBlobsOperator.readBlob({id});
    const apiProfile = await getProfile({id: blob.profile});

    if (hasPermission(user.roles.groups, apiProfile.groups)) {
      if (MELINDA_API_OPTIONS.melindaApiUrl && blob.correlationId !== '') {
        await Promise.all([
          melindaApiClient.setBulkStatus(blob.correlationId, QUEUE_ITEM_STATE.ABORT),
          mongoBlobsOperator.updateBlob({id, payload})
        ]);
        return;
      }

      return mongoBlobsOperator.updateBlob({id, payload});
    }

    throw new ApiError(HttpStatus.FORBIDDEN, 'Blob update/abort permission error');
  }

  // MARK: Get profile
  async function getProfile({id}) {
    const profile = await mongoProfileOperator.readProfile({id});
    if (profile) {
      return profile;
    }

    return false;
  }
}
