/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file. 
*
* API microservice of Melinda record batch import system
*
* Copyright (C) 2018 University Of Helsinki (The National Library Of Finland)
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

/* eslint-disable no-unused-vars */
import {configurationGeneral as config} from '@natlibfi/melinda-record-import-commons';

module.exports.getMalformedError = function (message) {
    var err = new Error('Malformed content');
    err.type = config.enums.errorTypes.notObject;
    err.message = message;
    return err;
}

module.exports.getUnauthorizedError = function () {
    var err = new Error('Authentication failed');
    err.type = config.enums.errorTypes.unauthorized;
    return err;
}

module.exports.getForbiddenError = function () {
    var err = new Error('Not authorized');
    err.type = config.enums.errorTypes.forbidden;
    return err;
}

module.exports.getBadRequestError = function (message) {
    var err = new Error('Unknown bad request');
    err.type = config.enums.errorTypes.badRequest;
    err.message = message;
    return err;
}

module.exports.getMissingProfileError = function () {
    var err = new Error('The profile does not exist or the user is not authorized to it');
    err.type = config.enums.errorTypes.missingProfile;
    return err;
}

module.exports.getMissingContentError = function (message) {
    var err = new Error(message || 'Content not found');
    err.type = config.enums.errorTypes.missingContent;
    err.message = message;
    return err;
}

module.exports.getMissingContentTypeError = function () {
    var err = new Error('Content type was not specified');
    err.type = config.enums.errorTypes.missingContentType;
    return err;
}

module.exports.getRequestBodyLargeError = function () {
    var err = new Error('Request body is too large');
    err.type = config.enums.errorTypes.bodyTooLarge;
    return err;
}

module.exports.getValidationError = function (message) {
    var err = new Error('Validation error');
    err.type = config.enums.errorTypes.validation;
    err.message = message;
    return err;
}

module.exports.getIDConflictError = function () {
    var err = new Error('IDs do not match');
    err.type = config.enums.errorTypes.idConflict;
    return err;
}

module.exports.getUnknownError = function (description, data) {
    var err = new Error(description);
    err.type = config.enums.errorTypes.unknown;
    err.data = data;
    return err;
}