import httpStatus from 'http-status';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import https from 'https';
import ipRangeCheck from 'ip-range-check';

import {getUserApplicationRoles, generateUserAuthorizationMiddleware, generatePermissionMiddleware} from './middleware';
import {generatePassportMiddlewares} from '@natlibfi/passport-natlibfi-keycloak';

import {Error as ApiError} from '@natlibfi/melinda-commons';
import {createLogger, createExpressLogger} from '@natlibfi/melinda-backend-commons';

import {
  createBlobsRouter,
  createProfilesRouter,
  createApiDocRouter,
  createStatusRouter
} from './routes';

export default async function (config) {
  const logger = createLogger();
  const app = express();
  const {
    ENABLE_PROXY, HTTPS_PORT, ipWhiteList,
    USER_AGENT_LOGGING_BLACKLIST, SOCKET_KEEP_ALIVE_TIMEOUT,
    keycloakOpts, tlsKeyPath, tlsCertPath, allowSelfSignedApiCert
  } = config;
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

  app.use(pathValidator);
  app.use('/', createApiDocRouter());
  app.use('/blobs', ipWhiteListMiddleware, gatherUserInformationMiddlewares, await createBlobsRouter(permissionMiddleware, config));
  app.use('/profiles', ipWhiteListMiddleware, gatherUserInformationMiddlewares, await createProfilesRouter(permissionMiddleware, config));
  app.use('/status', createStatusRouter());

  app.use(handleError);


  if (!tlsKeyPath || !tlsCertPath) {
    const server = app.listen(HTTPS_PORT, () => logger.info(`Started Melinda record import api in port ${HTTPS_PORT}`));
    setSocketKeepAlive(server);

    return server;
  }

  const tlsConfig = {
    key: fs.readFileSync(tlsKeyPath, 'utf8'),
    cert: fs.readFileSync(tlsCertPath, 'utf8'),
    rejectUnauthorized: allowSelfSignedApiCert
  };

  const server = https.createServer(tlsConfig, app).listen(HTTPS_PORT, logger.info(`Started Melinda record import api in port ${HTTPS_PORT}`));

  setSocketKeepAlive(server);

  return server;

  function ipWhiteListMiddleware(req, res, next) {
    logger.verbose('Ip whitelist middleware');
    if (ipWhiteList.length === 0) {
      return next();
    }
    const connectionIp = req.headers['cf-connecting-ip'];
    //logger.debug(connectionIp);
    if (ipRangeCheck(`${connectionIp}`, ipWhiteList)) {
      logger.debug('IP ok');
      return next();
    }

    logger.debug(`Bad IP: ${connectionIp}`);
    return res.sendStatus(httpStatus.FORBIDDEN);
  }

  function pathValidator(req, res, next) {
    if (req.path.startsWith('//')) {
      logger.debug(`path: ${req.path}, query: ${JSON.stringify(req.query)}`);
      return res.status(httpStatus.BAD_REQUEST).send('Invalid URL: extra /');
    }

    next();
  }

  function handleError(error, req, res, next) { // eslint-disable-line no-unused-vars
    console.log('App Error handling'); // eslint-disable-line
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

  function setSocketKeepAlive(server) {
    if (SOCKET_KEEP_ALIVE_TIMEOUT) { // eslint-disable-line functional/no-conditional-statements
      server.keepAliveTimeout = SOCKET_KEEP_ALIVE_TIMEOUT; // eslint-disable-line functional/immutable-data

      server.on('connection', socket => {
        socket.setTimeout(SOCKET_KEEP_ALIVE_TIMEOUT);
      });
    }
  }
}
