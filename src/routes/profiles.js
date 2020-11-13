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
import {profilesFactory} from '../interfaces';
import {API_URL} from '../config';
import validateContentType from '@natlibfi/express-validate-content-type';

export default function (passportMiddleware) {
  const profiles = profilesFactory({url: API_URL});

  return new Router()
    .use(passportMiddleware)
    .get('/', query)
    .get('/:id', read)
    .delete('/:id', remove)
    .put('/:id', validateContentType({type: 'application/json'}), bodyParser.json({type: 'application/json'}), createOrUpdate);

  async function query(req, res, next) {
    try {
      const result = await profiles.query({user: req.user});
      res.json(result);
    } catch (err) {
      return next(err);
    }
  }

  async function read(req, res, next) {
    try {
      const profile = await profiles.read({id: req.params.id, user: req.user});
      res.json(profile);
    } catch (err) {
      return next(err);
    }
  }

  async function remove(req, res, next) {
    try {
      await profiles.remove({id: req.params.id, user: req.user});
      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (err) {
      return next(err);
    }
  }

  async function createOrUpdate(req, res, next) {
    try {
      const result = await profiles.createOrUpdate({
        id: req.params.id, user: req.user,
        payload: req.body
      });

      if (result.created) {
        res.set('Location', `${API_URL}/profiles/${req.params.id}`);
        return res.sendStatus(HttpStatus.CREATED);
      }

      res.sendStatus(HttpStatus.NO_CONTENT);
    } catch (err) {
      return next(err);
    }
  }
}
