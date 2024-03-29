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

import {createLogger, createExpressLogger, handleInterrupt} from '@natlibfi/melinda-backend-commons';
import {generatePassportMiddlewares} from '@natlibfi/passport-melinda-crowd';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import HttpStatus from 'http-status';
import passport from 'passport';
import express from 'express';
import cors from 'cors';
import Mongoose from 'mongoose';

import {
  createAuthRouter, createBlobsRouter,
  createProfilesRouter, createApiDocRouter
} from './routes';

import {
  ENABLE_PROXY, HTTP_PORT,
  MONGO_URI, MONGO_POOLSIZE, MONGO_DEBUG,
  USER_AGENT_LOGGING_BLACKLIST,
  CROWD_URL, CROWD_APP_NAME, CROWD_APP_PASSWORD,
  PASSPORT_LOCAL_USERS, SOCKET_KEEP_ALIVE_TIMEOUT
} from './config';

run();

async function run() {
  let server; // eslint-disable-line functional/no-let

  registerSignalHandlers();

  const logger = createLogger();
  const app = express();

  logger.info(`Setting up crowd authentication: ${CROWD_URL}`);
  const passportMiddlewares = generatePassportMiddlewares({
    localUsers: PASSPORT_LOCAL_USERS,
    crowd: {
      appName: CROWD_APP_NAME, appPassword: CROWD_APP_PASSWORD,
      url: CROWD_URL, useCache: true, fetchGroupMembership: true
    }
  });

  Mongoose.set('debug', MONGO_DEBUG);
  Mongoose.set('strictQuery', true);

  try {
    await Mongoose.connect(MONGO_URI, {useNewUrlParser: true, maxPoolSize: MONGO_POOLSIZE, useUnifiedTopology: true});
  } catch (err) {
    throw new Error(`Failed connecting to MongoDB: ${err instanceof Error ? err.stack : err}`);
  }

  app.enable('trust proxy', ENABLE_PROXY);

  app.use(createExpressLogger({
    // Do not log requests from automated processes ('Cause there'll be plenty)
    skip: r => USER_AGENT_LOGGING_BLACKLIST.includes(r.get('User-Agent'))
  }));

  app.use(passport.initialize());

  app.use(cors());

  app.use(pathValidator);
  app.use('/', createApiDocRouter());
  app.use('/auth', createAuthRouter(passportMiddlewares.credentials));
  app.use('/blobs', createBlobsRouter(passportMiddlewares.token));
  app.use('/profiles', createProfilesRouter(passportMiddlewares.token));

  app.use(handleError);

  server = app.listen(HTTP_PORT, () => { // eslint-disable-line prefer-const
    logger.info('Started melinda-record-import-api');
  });

  setSocketKeepAlive();

  function pathValidator(req, res, next) {
    if (req.path.startsWith('//')) {
      logger.debug(`path: ${req.path}`);
      return res.status(HttpStatus.BAD_REQUEST).send('Invalid URL: extra /');
    }

    next();
  }

  function handleError(err, req, res, next) { // eslint-disable-line no-unused-vars
    if (err instanceof ApiError || 'status' in err) {
      return res.sendStatus(err.status);
    }

    logger.error(err instanceof Error ? err.stack : err);
    return res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
  }

  function setSocketKeepAlive() {
    if (SOCKET_KEEP_ALIVE_TIMEOUT) { // eslint-disable-line functional/no-conditional-statements
      server.keepAliveTimeout = SOCKET_KEEP_ALIVE_TIMEOUT; // eslint-disable-line functional/immutable-data

      server.on('connection', socket => {
        socket.setTimeout(SOCKET_KEEP_ALIVE_TIMEOUT);
      });
    }
  }

  function registerSignalHandlers() {
    process
      .on('SIGINT', handle)
      .on('uncaughtException', handle)
      .on('unhandledRejection', handle)
      // Nodemon
      .on('SIGUSR2', handle);

    function handle(arg) {
      if (server) { // eslint-disable-line functional/no-conditional-statements
        server.close();
      }

      Mongoose.disconnect();
      handleInterrupt(arg);
    }
  }
}

