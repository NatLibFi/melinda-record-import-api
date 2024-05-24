import HttpStatus from 'http-status';
import {Router} from 'express';
import bodyParser from 'body-parser';
import {blobsFactory} from '../interfaces';
import validateContentType from '@natlibfi/express-validate-content-type';
import {createLogger} from '@natlibfi/melinda-backend-commons';
import {validateMax as validateContentLength} from 'express-content-length-validator';
import {API_URL, CONTENT_MAX_LENGTH} from '../config';
import sanitize from 'mongo-sanitize';
import createDebugLogger from 'debug';

export default function (permissionMiddleware) {
  const blobs = blobsFactory({url: API_URL});
  const logger = createLogger();
  const debug = createDebugLogger('@natlibfi/melinda-record-import-api:routes/blobs'); // eslint-disable-line no-unused-vars

  return new Router()
    .get('/', permissionMiddleware('blobs', 'read'), query)
    .post('/', permissionMiddleware('blobs', 'create'), getContentLengthMiddleware(), create)
    .get('/:id', permissionMiddleware('blobs', 'read'), read)
    .delete('/:id', permissionMiddleware('blobs', 'delete'), remove)
    .put('/:id', permissionMiddleware('blobs', 'update'), validateContentType({type: 'application/json'}), bodyParser.json({type: 'application/json'}), update)
    .get('/:id/content', permissionMiddleware('blobs', 'content'), readContent)
    .delete('/:id/content', permissionMiddleware('blobs', 'content'), removeContent);

  // MARK: Query
  async function query(req, res, next) {
    logger.debug('Route - Blobs - Query');
    try {
      const queryParams = getQueryParams();
      const parameters = {user: req.user, ...queryParams};

      if (req.get('QueryOffset')) { // eslint-disable-line functional/no-conditional-statements
        parameters.offset = sanitize(req.get('QueryOffset')); // eslint-disable-line functional/immutable-data
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

    function getQueryParams() {
      const KEYS = ['state', 'profile', 'contentType', 'creationTime', 'modificationTime'];

      return Object.keys(req.query)
        .filter(k => KEYS.includes(k))
        .reduce((acc, k) => {
          const cleanedK = sanitize(k);
          const value = sanitize(req.query[k]);
          return {...acc, [cleanedK]: Array.isArray(value) ? value : [value]};
        }, {});
    }
  }

  // MARK: Read
  async function read(req, res, next) {
    logger.debug('Route - Blobs - Read');
    try {
      const result = await blobs.read({id: req.params.id, user: req.user});
      res.json(result);
    } catch (error) {
      return next(error);
    }
  }

  // MARK: Remove
  async function remove(req, res, next) {
    logger.debug('Route - Blobs - Remove');
    try {
      await blobs.remove({id: req.params.id, user: req.user});
      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (error) {
      return next(error);
    }
  }

  // MARK: Create
  async function create(req, res, next) {
    logger.debug('Route - Blobs - Create');
    if ('content-type' in req.headers && 'import-profile' in req.headers) { // eslint-disable-line functional/no-conditional-statements
      // logger.debug(`Content-type: ${req.headers['content-type']}`);
      logger.debug(`Import-profile: ${req.headers['import-profile']}`);
      // debug(`Content-type: ${req.headers['content-type']}`);
      // debug(`Import-profile: ${req.headers['import-profile']}`);

      try {
        const id = await blobs.create({
          inputStream: req, user: req.user,
          profile: req.headers['import-profile'],
          contentType: req.headers['content-type']
        });

        res.set('Location', `${API_URL}/blobs/${id}`);
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
    logger.debug('Route - Blobs - Update');
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
    logger.debug('Route - Blobs - Read Content');
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
    logger.debug('Route - Blobs - Remove Content');
    try {
      await blobs.removeContent({id: req.params.id, user: req.user});
      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (error) {
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
}
