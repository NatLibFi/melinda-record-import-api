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
import {Router} from 'express';
import bodyParser from 'body-parser';
import {blobsFactory} from '../interfaces';
import validateContentType from '@natlibfi/express-validate-content-type';
import {validateMax as validateContentLength} from 'express-content-length-validator';
import {API_URL, CONTENT_MAX_LENGTH} from '../config';
import sanitize from 'mongo-sanitize';
import createDebugLogger from 'debug';

export default function (passportMiddleware) {
  const blobs = blobsFactory({url: API_URL});
  const debug = createDebugLogger('@natlibfi/melinda-record-import-api:route/blobs');

  return new Router()
    .use(passportMiddleware)
    .get('/', query)
    .post('/', getContentLengthMiddleware(), create)
    .get('/:id', read)
    .delete('/:id', remove)
    .post('/:id', validateContentType({type: 'application/json'}), bodyParser.json({type: 'application/json'}), update)
    .get('/:id/content', readContent)
    .delete('/:id/content', removeContent);

  async function query(req, res, next) {
    debug('Query Blob');

    try {
      const queryParams = getQueryParams();
      const parameters = {user: req.user, ...queryParams};

      if (req.get('QueryOffset')) { // eslint-disable-line functional/no-conditional-statement
        parameters.offset = sanitize(req.get('QueryOffset')); // eslint-disable-line functional/immutable-data
      }

      const {nextOffset, results} = await blobs.query(parameters); // njsscan-ignore: node_sqli_injection

      if (nextOffset) {
        res.set('NextOffset', nextOffset);
        return res.json(results);
      }

      res.json(results);
    } catch (err) {
      return next(err);
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

  async function read(req, res, next) {
    debug('Read Blob');

    try {
      const result = await blobs.read({id: req.params.id, user: req.user});
      res.json(result);
    } catch (err) {
      return next(err);
    }
  }

  async function remove(req, res, next) {
    debug('Remove Blob');

    try {
      await blobs.remove({id: req.params.id, user: req.user});
      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (err) {
      return next(err);
    }
  }

  async function create(req, res, next) {
    debug('Creating Blob');

    if ('content-type' in req.headers && 'import-profile' in req.headers) { // eslint-disable-line functional/no-conditional-statement
      try {
        const id = await blobs.create({
          inputStream: req, user: req.user,
          profile: req.headers['import-profile'],
          contentType: req.headers['content-type']
        });

        res.set('Location', `${API_URL}/blobs/${id}`);
        return res.sendStatus(HttpStatus.CREATED);
      } catch (err) {
        return next(err);
      }
    }

    res.sendStatus(400);
  }

  async function update(req, res, next) {
    debug('Update Blob');

    try {
      await blobs.update({
        id: req.params.id, user: req.user,
        payload: req.body
      });

      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (err) {
      return next(err);
    }
  }

  async function readContent(req, res, next) {
    debug('Read content Blob');

    try {
      const {contentType, readStream} = await blobs.readContent({id: req.params.id, user: req.user});
      res.set('Content-Type', contentType);
      readStream.pipe(res);
    } catch (err) {
      return next(err);
    }
  }

  async function removeContent(req, res, next) {
    debug('Remove content Blob');

    try {
      await blobs.removeContent({id: req.params.id, user: req.user});
      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (err) {
      return next(err);
    }
  }

  function getContentLengthMiddleware() {
    if (CONTENT_MAX_LENGTH > 0) {
      return validateContentLength({
        max: CONTENT_MAX_LENGTH,
        status: HttpStatus.REQUEST_ENTITY_TOO_LARGE,
        message: `Content length must no exceed ${CONTENT_MAX_LENGTH}`
      });
    }

    return (req, res, next) => next();
  }
}
