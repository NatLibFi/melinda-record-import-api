import httpStatus from 'http-status';
import express from 'express';
import cors from 'cors';
import Mongoose from 'mongoose';
import fs from 'fs';
import https from 'https';

import {getUserApplicationRoles, generateUserAuthorizationMiddleware, generatePermissionMiddleware} from './middleware';
import {generatePassportMiddlewares} from '@natlibfi/passport-natlibfi-keycloak';

import {Error as ApiError} from '@natlibfi/melinda-commons';
import {createLogger, createExpressLogger} from '@natlibfi/melinda-backend-commons';

import {
  createBlobsRouter,
  createProfilesRouter,
  createApiDocRouter
} from './routes';

export default async function ({
  ENABLE_PROXY, HTTPS_PORT,
  MONGO_URI, MONGO_POOLSIZE, MONGO_DEBUG,
  USER_AGENT_LOGGING_BLACKLIST, SOCKET_KEEP_ALIVE_TIMEOUT,
  keycloakOpts, tlsKeyPath, tlsCertPath, allowSelfSignedApiCert
}) {
  const logger = createLogger();

  if (!tlsKeyPath || !tlsCertPath) {
    throw new Error('This prototype requires certificates!');
  }

  const tlsConfig = {
    key: fs.readFileSync(tlsKeyPath, 'utf8'),
    cert: fs.readFileSync(tlsCertPath, 'utf8'),
    rejectUnauthorized: allowSelfSignedApiCert
  };

  const app = express();

  //---------------------------------------------------//
  // Setup Express OpenID authentication with keycloak

  logger.debug('Loading auth');
  // Initialize passport middleware
  const passportMiddlewares = await generatePassportMiddlewares({
    keycloakOpts,
    localUsers: false
  });

  // Initialize custom middleware that handles permissions
  const authorizationMiddleware = generateUserAuthorizationMiddleware(passportMiddlewares);
  const permissionMiddleware = generatePermissionMiddleware();
  const gatherUserInformationMiddlewares = [authorizationMiddleware, getUserApplicationRoles];

  app.enable('trust proxy', ENABLE_PROXY);

  app.use(cors());

  app.use(createExpressLogger({
    // Do not log requests from automated processes ('Cause there'll be plenty)
    skip: r => USER_AGENT_LOGGING_BLACKLIST.includes(r.get('User-Agent'))
  }));

  //---------------------------------------------------//
  // Setup mongoose

  Mongoose.set('debug', MONGO_DEBUG);
  Mongoose.set('strictQuery', true);

  try {
    await Mongoose.connect(MONGO_URI, {maxPoolSize: MONGO_POOLSIZE, useUnifiedTopology: true});
  } catch (error) {
    throw new Error(`Failed connecting to MongoDB: ${error instanceof Error ? error.stack : error}`);
  }

  app.use(pathValidator);
  app.use('/', createApiDocRouter());
  app.use('/blobs', gatherUserInformationMiddlewares, createBlobsRouter(permissionMiddleware));
  app.use('/profiles', gatherUserInformationMiddlewares, createProfilesRouter(permissionMiddleware));

  app.use(handleError);

  const server = https.createServer(tlsConfig, app).listen(HTTPS_PORT, logger.info(`Started Melinda Poistot in port ${HTTPS_PORT}`));

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
    console.log('Index Error handling'); // eslint-disable-line
    console.log(error); // eslint-disable-line

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
