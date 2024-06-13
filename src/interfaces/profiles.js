import Mongoose from 'mongoose';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import {ProfileModel} from './models';
import {hasPermission} from './utils';
import {createLogger} from '@natlibfi/melinda-backend-commons';
import httpStatus from 'http-status';

export default function ({url}) {
  Mongoose.model('Profile', ProfileModel);
  const logger = createLogger();

  return {query, read, createOrUpdate, remove};

  // MARK: Query
  async function query({user}) {
    try {
      logger.debug('Looking for profiles');
      const profiles = await Mongoose.models.Profile.find().exec();
      return profiles.filter(p => hasPermission(user.roles.groups, p.groups))
        .map(profile => ({id: profile.id, url: `${url}/profiles/${profile.id}`}));
    } catch (error) {
      logger.error(error); // eslint-disable-line
      return [];
    }
  }

  // MARK: Read
  async function read({id, user}) {
    const profile = await Mongoose.models.Profile.findOne({id}).exec();

    if (profile) {
      if (hasPermission(user.roles.groups, profile.groups)) {
        logger.debug('Reading profile');
        return format(profile);
      }

      throw new ApiError(httpStatus.FORBIDDEN, 'Permission error');
    }

    throw new ApiError(httpStatus.NOT_FOUND, 'Profile not found');

    function format(profile) {
      const doc = profile._doc;

      return Object.keys(doc).reduce((acc, key) => (/^_+/u).test(key) ? acc : {[key]: doc[key], ...acc}, {});
    }
  }

  // MARK: Remove
  async function remove({id, user}) {
    const profile = await Mongoose.models.Profile.findOne({id}).exec();
    if (profile) {
      if (hasPermission(user.roles.groups, profile.groups)) {
        logger.debug('Removing profile');
        return Mongoose.models.Profile.deleteOne({id}).exec();
      }

      throw new ApiError(httpStatus.FORBIDDEN, 'Permission error');
    }

    throw new ApiError(httpStatus.NOT_FOUND, 'Profile not found');
  }

  // MARK: Create or update
  async function createOrUpdate({id, payload, user}) {
    if (hasPermission(user.roles.groups)) {
      const profile = await Mongoose.models.Profile.findOne({id});

      logger.debug(profile ? 'got profile' : 'existing profile not found');

      if (profile) {
        return execute(true);
      }

      return execute();
    }

    throw new ApiError(httpStatus.FORBIDDEN, 'Permission error');

    async function execute(update = false) {
      try {
        if (update) {
          logger.debug('Updating profile');
          await Mongoose.models.Profile.updateOne({id}, {...payload, id}).exec();
          return {status: httpStatus.NO_CONTENT};
        }

        logger.debug('Creating profile');
        await Mongoose.models.Profile.create({...payload, id});
        return {status: httpStatus.CREATED};
      } catch (error) {
        logger.debug('Profile handling error');
        if (error instanceof Mongoose.Error && (error.name === 'ValidationError' || error.name === 'StrictModeError')) {
          throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'Profile provided is malformed');
        }

        throw error;
      }
    }
  }
}
