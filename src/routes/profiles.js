import HttpStatus from 'http-status';
import {Router} from 'express';
import bodyParser from 'body-parser';
import {profilesFactory} from '../interfaces';
import validateContentType from '@natlibfi/express-validate-content-type';
import {createLogger} from '@natlibfi/melinda-backend-commons';

export default async function (permissionMiddleware, {MONGO_URI}) {
  const profiles = await profilesFactory({MONGO_URI});
  const logger = createLogger();

  return new Router()
    .get('/', permissionMiddleware('profiles', 'read'), query)
    .get('/:id', permissionMiddleware('profiles', 'read'), read)
    .delete('/:id', permissionMiddleware('profiles', 'edit'), remove)
    .post('/:id', permissionMiddleware('profiles', 'edit'), validateContentType({type: 'application/json'}), bodyParser.json({type: 'application/json'}), createOrUpdate);

  async function query(req, res, next) {
    logger.debug('Route - Profiles - Query');
    try {
      // Variable req.user is inserted by our own middleware and there is no chance to get injection code there
      const result = await profiles.query({user: req.user}); // njsscan-ignore: node_sqli_injection
      logger.debug('Query result: ', result);
      res.status(200).json(result);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  }

  async function read(req, res, next) {
    logger.debug('Route - Profiles - Read');
    try {
      const profile = await profiles.read({id: req.params.id, user: req.user});
      res.json(profile);
    } catch (error) {
      logger.error(error);

      return next(error);
    }
  }

  async function remove(req, res, next) {
    logger.debug('Route - Profiles - Remove');
    try {
      await profiles.remove({id: req.params.id, user: req.user});
      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  }

  async function createOrUpdate(req, res, next) {
    logger.debug('Route - Profiles - Create/Update');
    try {
      const sanitazedId = sanitaze(req.params.id);
      const result = await profiles.createOrUpdate({
        id: sanitazedId, payload: req.body, user: req.user
      });

      res.sendStatus(result.status);
    } catch (error) {
      logger.error(error);
      return next(error);
    }
  }

  function sanitaze(value) {
    return value
      .replace(/\r/gu, '')
      .replace(/%0d/gu, '')
      .replace(/%0D/gu, '')
      .replace(/\n/gu, '')
      .replace(/%0a/gu, '')
      .replace(/%0A/gu, '');
  }
}
