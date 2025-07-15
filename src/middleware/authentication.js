import HttpStatus from 'http-status';

import {permissions} from './permissions.js';
import {KEYCLOAK_ROLE_MAP} from '../config.js';
import {ApiError} from '../utils/apiError.js';


export function generateUserAuthorizationMiddleware(passportMiddlewares) {
  return (req, res, next) => {
    if ('authorization' in req.headers) {
      return passportMiddlewares.token(req, res, next);
    }
    throw new ApiError(HttpStatus.UNAUTHORIZED);
  };
}

/**
 * Getter for user application roles. Requires the request user to exist and have some application role.
 * @returns Next if user has some application role, otherwise throws ApiError with unauthorized status
 */
export function getUserApplicationRoles(req, res, next) {
  if (!req.user || !req.user.roles || !Array.isArray(req.user.roles)) {
    throw new ApiError(HttpStatus.UNAUTHORIZED);
  }

  const userRolesGrouped = getRolesFromKeycloakRoles(req.user.roles);
  req.user.roles = userRolesGrouped.reduce((result, item) => {
    const [key] = Object.keys(item);
    result[key] = item[key];
    return result;
  }, {});
  return next();
}

/**
 * Returns generator for permission middleware which investigates whether user has access
 * to required resource
 */
export function generatePermissionMiddleware() {
  return (type, command) => (req, res, next) => {
    // Do not evaluate further if user is not defined, public endpoints do not utilize permission middleware
    if (!req.user) {
      throw new ApiError(HttpStatus.UNAUTHORIZED);
    }

    // Not allowed to access commands/types that are not defined
    if (!Object.keys(permissions).includes(type) || !Object.keys(permissions[type]).includes(command)) {
      throw new ApiError();
    }

    const commandPermissions = permissions[type][command];
    const endpointIsPublic = commandPermissions.includes('all');

    if (endpointIsPublic) {
      return next();
    }

    // If endpoint was not public and user is not defined, return unauthorized
    if (!req.user.roles) {
      throw new ApiError(HttpStatus.UNAUTHORIZED);
    }

    const permitted = commandPermissions.some(role => req.user.roles[type].includes(role));

    // If authenticated user does not have permissions to endpoint/command, return forbidden
    if (!permitted) {
      throw new ApiError(HttpStatus.FORBIDDEN);
    }

    next();
  };
}

function getRolesFromKeycloakRoles(userKeycloakRoles) {
  return Object.entries(KEYCLOAK_ROLE_MAP).reduce((prev, [applicationRole, filter]) => {
    if (typeof filter === 'string') {
      const tempObject = {};
      tempObject[applicationRole] = filterAndMapRoles(filter, userKeycloakRoles);
      return [...prev, tempObject];
    }

    if (Array.isArray(filter)) {
      const tempObject = {};
      tempObject[applicationRole] = filter.flatMap(filterRegExp => filterAndMapRoles(filterRegExp, userKeycloakRoles));
      return [...prev, tempObject];
    }

    throw new Error('Unknown role mapper type');
  }, []);

  function filterAndMapRoles(filter, roles) {
    return roles
      .filter(role => new RegExp(`^${filter}`, 'u').test(role))
      .map(role => role.replace(filter, ''));
  }
}
