
import HttpStatus from 'http-status';
import Mongoose from 'mongoose';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import {ProfileModel} from './models';
import {hasPermission} from './utils';
import {createLogger} from '@natlibfi/melinda-backend-commons';

export default function ({url}) {
  Mongoose.model('Profile', ProfileModel);
  const logger = createLogger();

  return {query, read, createOrUpdate, remove};

  async function query({user}) {
    logger.debug('Looking for profiles');
    const profiles = await Mongoose.models.Profile.find().exec();
    return profiles.filter(p => hasPermission('profiles', 'query', user.groups, p.auth.groups)).map(profile => ({id: profile.id, url: `${url}/profiles/${profile.id}`}));
  }

  async function read({id, user}) {
    const profile = await Mongoose.models.Profile.findOne({id}).exec();

    if (profile) {
      if (hasPermission('profiles', 'read', user.groups, profile.auth.groups)) {
        logger.debug('Reading profile');
        return format(profile);
      }

      throw new ApiError(HttpStatus.FORBIDDEN, 'Permission error');
    }

    throw new ApiError(HttpStatus.NOT_FOUND, 'Profile not found');

    function format(profile) {
      const doc = profile._doc;

      return Object.keys(doc).reduce((acc, key) => (/^_+/u).test(key) ? acc : {[key]: doc[key], ...acc}, {});
    }
  }

  async function remove({id, user}) {
    if (hasPermission('profiles', 'remove', user.groups)) {
      const profile = await Mongoose.models.Profile.findOne({id}).exec();

      if (profile) {
        logger.debug('Removing profile');
        return Mongoose.models.Profile.deleteOne({id}).exec();
      }

      throw new ApiError(HttpStatus.NOT_FOUND, 'Profile not found');
    }

    throw new ApiError(HttpStatus.FORBIDDEN, 'Permission error');
  }

  async function createOrUpdate({id, payload, user}) {
    if (hasPermission('profiles', 'createOrUpdate', user.groups)) {
      const profile = await Mongoose.models.Profile.findOne({id});

      logger.debug(profile ? 'got profile' : 'invalid profile');

      if (profile) {
        return execute(true);
      }

      return execute();
    }

    throw new ApiError(HttpStatus.FORBIDDEN, 'Permission error');

    async function execute(update = false) {
      try {
        if (update) {
          logger.debug('Updating profile');
          await Mongoose.models.Profile.updateOne({id}, {...payload, id}).exec();
          return {updated: true};
        }

        logger.debug('Creating profile');
        await Mongoose.models.Profile.create({...payload, id});
        return {created: true};
      } catch (err) {
        if (err instanceof Mongoose.Error && (err.name === 'ValidationError' || err.name === 'StrictModeError')) {
          throw new ApiError(HttpStatus.UNPROCESSABLE_ENTITY, 'Profile provided is malformed');
        }

        throw err;
      }
    }
  }
}
