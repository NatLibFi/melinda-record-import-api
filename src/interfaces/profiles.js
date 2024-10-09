import httpStatus from 'http-status';

import {createLogger} from '@natlibfi/melinda-backend-commons';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import {createMongoProfilesOperator} from '@natlibfi/melinda-record-import-commons';

import {hasPermission} from './utils';
import {profileSchema, validate} from './models';

export default async function ({MONGO_URI, MONGO_DB = 'db'}) {
  const logger = createLogger();
  const mongoProfileOperator = await createMongoProfilesOperator(MONGO_URI, MONGO_DB);

  return {query, read, createOrUpdate, remove};

  // MARK: Query
  async function query({user}) {
    try {
      logger.debug('Looking for profiles');

      const profiles = [];
      await new Promise((resolve, reject) => {
        const emitter = mongoProfileOperator.queryProfile();
        emitter.on('profiles', profilesArray => profilesArray.forEach(profile => profiles.push(profile))) // eslint-disable-line functional/immutable-data
          .on('error', error => reject(error))
          .on('end', () => resolve());
      });

      return profiles.filter(profile => hasPermission(user.roles.groups, profile.groups))
        .map(profile => ({id: profile.id}));
    } catch (error) {
      logger.error(error); // eslint-disable-line
      return [];
    }
  }

  // MARK: Read
  async function read({id, user}) {
    const profile = await mongoProfileOperator.readProfile({id});

    if (profile) {
      if (hasPermission(user.roles.groups, profile.groups)) {
        logger.debug('Reading profile');
        return profile;
      }

      throw new ApiError(httpStatus.FORBIDDEN, 'Permission error');
    }

    throw new ApiError(httpStatus.NOT_FOUND, 'Profile not found');
  }

  // MARK: Remove
  async function remove({id, user}) {
    const profile = await mongoProfileOperator.readProfile({id});
    if (profile) {
      if (hasPermission(user.roles.groups, profile.groups)) {
        logger.debug('Removing profile');
        await mongoProfileOperator.removeProfile({id});
        return;
      }

      throw new ApiError(httpStatus.FORBIDDEN, 'Permission error');
    }

    throw new ApiError(httpStatus.NOT_FOUND, 'Profile not found');
  }

  // MARK: Create or update
  function createOrUpdate({id, payload, user}) {
    if (hasPermission(user.roles.groups, payload.groups)) {
      validate({id, ...payload}, profileSchema); // eslint-disable-line
      return mongoProfileOperator.createOrModifyProfile({id, payload});
    }

    throw new ApiError(httpStatus.FORBIDDEN, 'Permission error');
  }
}
