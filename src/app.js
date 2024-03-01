import httpStatus from 'http-status';
import express from 'express';
import pkg from 'express-openid-connect';
import cors from 'cors';
import Mongoose from 'mongoose';

import {Error as ApiError} from '@natlibfi/melinda-commons';
import {createLogger, createExpressLogger} from '@natlibfi/melinda-backend-commons';

import {
  createBlobsRouter,
  createProfilesRouter,
  createApiDocRouter
} from './routes';

export default async function ({
  ENABLE_PROXY, HTTP_PORT,
  MONGO_URI, MONGO_POOLSIZE, MONGO_DEBUG,
  USER_AGENT_LOGGING_BLACKLIST, SOCKET_KEEP_ALIVE_TIMEOUT,
  keycloakOptions
}) {
  const logger = createLogger();
  const app = express();
  const {auth, requiresAuth} = pkg;
  //---------------------------------------------------//
  // Setup Express Open Id authentication

  const authenticationOptions = {
    ...keycloakOptions,
    httpUserAgent: 'Melinda-ui',
    session: {
      name: 'melinda-ui'
    },
    idpLogout: true,
    routes: {
      login: '/login',
      logout: '/logout',
      postLogoutRedirect: '/'
    }
  };

  app.use(auth(authenticationOptions));

  //---------------------------------------------------//
  // Setup mongoose

  Mongoose.set('debug', MONGO_DEBUG);
  Mongoose.set('strictQuery', true);

  try {
    await Mongoose.connect(MONGO_URI, {maxPoolSize: MONGO_POOLSIZE, useUnifiedTopology: true});
  } catch (error) {
    throw new Error(`Failed connecting to MongoDB: ${error instanceof Error ? error.stack : error}`);
  }

  app.enable('trust proxy', ENABLE_PROXY);

  app.use(createExpressLogger({
    // Do not log requests from automated processes ('Cause there'll be plenty)
    skip: r => USER_AGENT_LOGGING_BLACKLIST.includes(r.get('User-Agent'))
  }));


  app.use(cors());

  app.use(pathValidator);
  app.use('/', createApiDocRouter());
  app.use('/blobs', requiresAuth(), createBlobsRouter());
  app.use('/profiles', requiresAuth(), createProfilesRouter());

  app.use(handleError);

  const server = app.listen(HTTP_PORT, () => { // eslint-disable-line prefer-const
    logger.info(`Started melinda-record-import-api in port ${HTTP_PORT}`);
  });

  setSocketKeepAlive();

  return server;

  function pathValidator(req, res, next) {
    if (req.path.startsWith('//')) {
      logger.debug(`path: ${req.path}`);
      return res.status(httpStatus.BAD_REQUEST).send('Invalid URL: extra /');
    }

    next();
  }

  function handleError(error, req, res, next) { // eslint-disable-line no-unused-vars
    // console.log('Index Error handling'); // eslint-disable-line
    // console.log(error); // eslint-disable-line

    if (error instanceof ApiError || 'status' in error) {
      if (error.payload) {
        return res.status(error.status).send(error.payload);
      }

      return res.sendStatus(error.status);
    }

    logger.error(error instanceof Error ? error.stack : error);
    return res.sendStatus(httpStatus.INTERNAL_SERVER_ERROR);
  }

  function setSocketKeepAlive() {
    if (SOCKET_KEEP_ALIVE_TIMEOUT) { // eslint-disable-line functional/no-conditional-statements
      server.keepAliveTimeout = SOCKET_KEEP_ALIVE_TIMEOUT; // eslint-disable-line functional/immutable-data

      server.on('connection', socket => {
        socket.setTimeout(SOCKET_KEEP_ALIVE_TIMEOUT);
      });
    }
  }
}
