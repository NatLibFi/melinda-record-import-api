import bodyParser from 'body-parser';
import createDebugLogger from 'debug';
import {Router} from 'express';
import {validateMax as validateContentLength} from 'express-content-length-validator';
import HttpStatus from 'http-status';
import sanitize from 'mongo-sanitize';

import {createLogger} from '@natlibfi/melinda-backend-commons';
import {Error as ApiError} from '@natlibfi/melinda-commons';

import {blobsFactory} from '../interfaces/index.mjs';
import {checkQueryParams} from '../middleware/queryCheck.mjs';

export default async function (permissionMiddleware, {CONTENT_MAX_LENGTH, MONGO_URI, MELINDA_API_OPTIONS, BLOBS_QUERY_LIMIT}) {
  const blobs = await blobsFactory({MONGO_URI, MELINDA_API_OPTIONS, BLOBS_QUERY_LIMIT});
  const logger = createLogger();
  const debug = createDebugLogger('@natlibfi/melinda-record-import-api:routes/blobs');

  return new Router()
    .get('/', permissionMiddleware('blobs', 'read'), checkQueryParams, query)
    .post('/', permissionMiddleware('blobs', 'create'), getContentLengthMiddleware(), create)
    .get('/:id', permissionMiddleware('blobs', 'read'), read)
    .delete('/:id', permissionMiddleware('blobs', 'delete'), remove)
    .post('/:id', permissionMiddleware('blobs', 'update'), validateContentType('application/json'), bodyParser.json({type: 'application/json'}), update)
    .get('/:id/content', permissionMiddleware('blobs', 'content'), readContent)
    .delete('/:id/content', permissionMiddleware('blobs', 'content'), removeContent);

  // MARK: Query
  async function query(req, res, next) {
    logger.silly('Route - Blobs - Query');
    try {
      const parameters = {...req.query, user: req.user};

      if (req.get('QueryOffset')) {
        parameters.offset = sanitize(req.get('QueryOffset'));
      }

      const {nextOffset, results} = await blobs.query(parameters); // njsscan-ignore: node_sqli_injection

      if (nextOffset) {
        res.set('NextOffset', nextOffset);
        return res.json(results);
      }

      res.json(results);
    } catch (error) {
      return next(error);
    }
  }

  // MARK: Read
  async function read(req, res, next) {
    logger.verbose('Route - Blobs - Read');
    try {
      const result = await blobs.read({id: req.params.id, user: req.user});
      res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  // MARK: Remove
  async function remove(req, res, next) {
    logger.verbose('Route - Blobs - Remove');
    try {
      await blobs.remove({id: req.params.id, user: req.user});
      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (error) {
      return next(error);
    }
  }

  // MARK: Create
  async function create(req, res, next) {
    logger.verbose('Route - Blobs - Create');
    if ('content-type' in req.headers && 'import-profile' in req.headers) {
      // logger.debug(`Content-type: ${req.headers['content-type']}`);
      logger.debug(`Import-profile: ${req.headers['import-profile']}`);
      // debug(`Content-type: ${req.headers['content-type']}`);
      // debug(`Import-profile: ${req.headers['import-profile']}`);

      try {
        const id = await blobs.create({
          inputStream: req, user: req.user,
          profile: req.headers['import-profile'],
          contentType: req.headers['content-type'],
          date: new Date()
        });
        const apiUrl = `${req.protocol}://${req.header('host')}`;
        res.set('Location', `${apiUrl}/blobs/${id}`);
        return res.sendStatus(HttpStatus.CREATED);
      } catch (error) {
        logger.error('Route - Blobs - Create - Error');
        if (error.status === 400) {
          logger.error(JSON.stringify(error));
          return res.status(404).send(error.payload);
        }
        return next(error);
      }
    }

    res.sendStatus(400);
  }

  // MARK: Update
  async function update(req, res, next) {
    logger.verbose('Route - Blobs - Update');
    try {
      await blobs.update({
        id: req.params.id, user: req.user,
        payload: req.body
      });

      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (error) {
      return next(error);
    }
  }

  // MARK: Read Content
  async function readContent(req, res, next) {
    logger.verbose('Route - Blobs - Read Content');
    try {
      const {contentType, readStream} = await blobs.readContent({id: req.params.id, user: req.user});
      res.setHeader('content-type', contentType);
      readStream.pipe(res);
    } catch (error) {
      return next(error);
    }
  }

  // MARK: Remove Content
  async function removeContent(req, res, next) {
    logger.verbose('Route - Blobs - Remove Content');
    try {
      await blobs.removeContent({id: req.params.id, user: req.user});
      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (error) {
      if (error instanceof ApiError && error.status === HttpStatus.NOT_FOUND) {
        console.log(`*** ERROR: Status: ${error.status}, message: ${error.payload} ***`);
        return res.status(error.status);
      }

      return next(error);
    }
  }

  // MARK: Get content length middleware
  function getContentLengthMiddleware() {
    if (CONTENT_MAX_LENGTH > 0) {
      return validateContentLength({
        max: CONTENT_MAX_LENGTH,
        status: HttpStatus.REQUEST_ENTITY_TOO_LARGE,
        message: `Content length must no exceed ${CONTENT_MAX_LENGTH}`
      });
    }

    logger.debug('Contentlength OK');
    return (req, res, next) => next();
  }

  function validateContentType(type) {
    return (req, res, next) => {
      if (req.is(type)) {
        return next();
      }
      return res.sendStatus(415);
    };
  }
}
