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

module.exports.getMalformedError = function () {
    var err = new Error('Malformed content');
    err.type = config.enums.errorTypes.notObject;
    return err;
}

module.exports.getInvalidError = function () {
    var err = new Error('Invalid syntax');
    err.type = config.enums.errorTypes.invalidSyntax;
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

module.exports.getMissingProfileError = function () {
    var err = new Error('The profile does not exist or the user is not authorized to it');
    err.type = config.enums.errorTypes.missingProfile;
    return err;
}

module.exports.getMissingContentTypeError = function () {
    var err = new Error('Content type was not specified');
    err.type = config.enums.errorTypes.missingContentType;
    return err;
}

module.exports.getValidationError = function (data) {
    var err = new Error('Validation error');
    err.type = config.enums.errorTypes.validation;
    err.data = data;
    return err;
}

module.exports.getUnknownError = function (description, data) {
    var err = new Error(description);
    err.type = config.enums.errorTypes.unknown;
    err.data = data;
    return err;
}