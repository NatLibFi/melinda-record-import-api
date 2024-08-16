
import HttpStatus from 'http-status';
import moment from 'moment';
import {ObjectId} from 'mongodb';
import {v4 as uuid} from 'uuid';
import {BLOB_UPDATE_OPERATIONS, BLOB_STATE, createMongoOperator} from '@natlibfi/melinda-record-import-commons';
import {hasPermission} from './utils';
import {createLogger} from '@natlibfi/melinda-backend-commons';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import {createApiClient as createMelindaApiClient} from '@natlibfi/melinda-rest-api-client';
import {QUEUE_ITEM_STATE} from '@natlibfi/melinda-rest-api-commons';

export async default function ({MONGO_URI, MELINDA_API_OPTIONS, BLOBS_QUERY_LIMIT}) {
  const logger = createLogger();
  const collection = 'blobmetadatas';
  const mongoOperator = await createMongoOperator(MONGO_URI, {db: 'db', collection});
  const melindaApiClient = MELINDA_API_OPTIONS.melindaApiUrl ? createMelindaApiClient(MELINDA_API_OPTIONS) : false;


  return {query, read, create, update, remove, removeContent, readContent};

  // MARK: Query
  /* eslint-disable-next-line */
  async function query({profile, contentType, state, creationTime, modificationTime, user, offset}) {
    logger.silly('Query');
    console.log(user);
  }

  // MARK: Read
  async function read({id, user}) {
    logger.debug(`Read: ${id}`);

    const doc = await Mongoose.models.BlobMetadata.findOne({id});

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

  // MARK: Remove
  async function remove({id, user}) {
    logger.debug('Remove');
    const blob = await Mongoose.models.BlobMetadata.findOne({id});

    if (blob) { // eslint-disable-line functional/no-conditional-statements
      const apiProfile = await getProfile({id: blob.profile});
      if (hasPermission(user.roles.groups, apiProfile.groups)) { // eslint-disable-line functional/no-conditional-statements
        try {
          await getFileMetadata(id);
          throw new ApiError(HttpStatus.CONFLICT, 'Request error: Content still exists');
        } catch (error) {
          if (error instanceof ApiError && error.status === HttpStatus.NOT_FOUND) { // eslint-disable-line functional/no-conditional-statements
            console.log(`*** ERROR: Status: ${error.status}, message: ${error.payload} ***`); // eslint-disable-line
            logger.debug('Removing blob!');
            return Mongoose.models.BlobMetadata.deleteOne({id});
          }

          throw error;
        }
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob removal permission error');
    }

    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob not found');
  }

  // MARK: Create
  async function create({inputStream, profile, contentType, user}) {
    logger.debug('Create');
    const apiProfile = await getProfile({id: profile});
    if (apiProfile) {
      if (hasPermission(user.roles.groups, apiProfile.groups)) {
        const id = uuid();

        await Mongoose.models.BlobMetadata.create({id, profile, contentType});

        await new Promise((resolve, reject) => {
          const outputStream = gridFSBucket.openUploadStream(id);

          inputStream
            .on('error', reject)
            .on('data', chunk => outputStream.write(chunk))

            .on('end', () => outputStream.end(undefined, undefined, () => {
              resolve(id);
            }));
        });

        await Mongoose.models.BlobMetadata.updateOne({id}, {state: BLOB_STATE.PENDING_TRANSFORMATION, modificationTime: moment()});
        return id;
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob creation permission error');
    }

    logger.error('Blob create invalid profile');
    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob create profile not found');
  }

  // MARK: Read content
  async function readContent({id, user}) {
    const blob = await Mongoose.models.BlobMetadata.findOne({id});

    if (blob) {
      const apiProfile = await getProfile({id: blob.profile});
      if (hasPermission(user.roles.groups, apiProfile.groups)) { // eslint-disable-line functional/no-conditional-statements
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

  // MARK: Remove content
  async function removeContent({id, user}) {
    const blob = await Mongoose.models.BlobMetadata.findOne({id});

    if (blob) {
      const apiProfile = await getProfile({id: blob.profile});
      if (hasPermission(user.roles.groups, apiProfile.groups)) { // eslint-disable-line functional/no-conditional-statements
        const {_id: fileId} = await getFileMetadata(id);
        return gridFSBucket.delete(fileId);
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob removeContent permission error');
    }
    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob not found');
  }

  // MARK: Update
  async function update({id, payload, user}) { // Updated 20211103
    const blob = await Mongoose.models.BlobMetadata.findOne({id});

    if (blob) {
      const apiProfile = await getProfile({id: blob.profile});
      if (hasPermission(user.roles.groups, apiProfile.groups)) {
        const {op} = payload;
        if (op) {
          const doc = await getUpdateDoc(op);

          const updateIfNotInStates = [BLOB_STATE.TRANSFORMATION_FAILED, BLOB_STATE.ABORTED, BLOB_STATE.PROCESSED];
          if (updateIfNotInStates.includes(blob.state)) {
            throw new ApiError(HttpStatus.CONFLICT);
          }

          const {numberOfRecords, failedRecords, importResults} = blob.processingInfo;
          if (op === BLOB_UPDATE_OPERATIONS.recordProcessed && numberOfRecords <= failedRecords.length + importResults.length) { // eslint-disable-line functional/no-conditional-statements
            throw new ApiError(HttpStatus.CONFLICT);
          }

          const {modifiedCount} = await Mongoose.models.BlobMetadata.updateOne({id}, doc);

          if (modifiedCount === 0) { // eslint-disable-line functional/no-conditional-statements
            throw new ApiError(HttpStatus.CONFLICT);
          }

          if (MELINDA_API_OPTIONS.melindaApiUrl && doc.correlationId) {
            await melindaApiClient.setBulkStatus(doc.correlationId, QUEUE_ITEM_STATE.ABORT);
            return;
          }

          return;
        }

        throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'Blob update operation error');
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Blob update/abort permission error');
    }

    throw new ApiError(HttpStatus.NOT_FOUND, 'Blob not found');

    // MARK: Update - Get update doc
    function getUpdateDoc(op) {
      const {
        abort, recordProcessed, transformationFailed,
        updateState, transformedRecord, addCorrelationId,
        setCataloger, setNotificationEmail
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

      if (op === addCorrelationId) {
        logger.debug(`case: ${op}, CorrelationId: ${payload.correlationId}`);
        return {
          modificationTime: moment(),
          correlationId: payload.correlationId
        };
      }

      if (op === setCataloger) {
        logger.debug(`case: ${op}, cataloger: ${payload.cataloger}`);
        return {
          modificationTime: moment(),
          $set: {
            cataloger: payload.cataloger
          }
        };
      }

      if (op === setNotificationEmail) {
        logger.debug(`case: ${op}, cataloger: ${payload.notificationEmail}`);
        return {
          modificationTime: moment(),
          $set: {
            notificationEmail: payload.notificationEmail
          }
        };
      }

      logger.error(`Blob update case '${op}' was not found`);
      throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'Blob update operation error');
    }
  }

  // MARK: Get profile
  async function getProfile({id}) {
    const profile = await Mongoose.models.Profile.findOne({id});
    if (profile) {
      return profile;
    }

    return false;
  }

  // MARK: Get file metadata
  async function getFileMetadata(filename) {
    logger.silly('Getting file metadata!');
    const files = await gridFSBucket.find({filename}).toArray();
    if (files.length === 0) {
      logger.silly('No file metadata found!');
      throw new ApiError(HttpStatus.NOT_FOUND, 'File metadata not found');
    }

    logger.silly('Returning file metadata!');
    return files[0];
  }
}
