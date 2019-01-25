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

const config = require('../config-general');

module.exports.getMalformedError = function (message) {
	const err = new Error('Malformed content');
	err.type = config.enums.errorTypes.notObject;
	err.message = message;
	return err;
};

module.exports.getUnauthorizedError = function () {
	const err = new Error('Authentication failed');
	err.type = config.enums.errorTypes.unauthorized;
	return err;
};

module.exports.getForbiddenError = function () {
	const err = new Error('Not authorized');
	err.type = config.enums.errorTypes.forbidden;
	return err;
};

module.exports.getBadRequestError = function (message) {
	const err = new Error('Unknown bad request');
	err.type = config.enums.errorTypes.badRequest;
	err.message = message;
	return err;
};

module.exports.getMissingProfileError = function () {
	const err = new Error('The profile does not exist or the user is not authorized to it');
	err.type = config.enums.errorTypes.missingProfile;
	return err;
};

module.exports.getMissingContentError = function (message) {
	const err = new Error(message || 'Content not found');
	err.type = config.enums.errorTypes.missingContent;
	err.message = message;
	return err;
};

module.exports.getMissingContentTypeError = function () {
	const err = new Error('Content type was not specified');
	err.type = config.enums.errorTypes.missingContentType;
	return err;
};

module.exports.getRequestBodyLargeError = function () {
	const err = new Error('Request body is too large');
	err.type = config.enums.errorTypes.bodyTooLarge;
	return err;
};

module.exports.getValidationError = function (message) {
	const err = new Error('Validation error');
	err.type = config.enums.errorTypes.validation;
	err.message = message;
	return err;
};

module.exports.getIDConflictError = function () {
	const err = new Error('IDs do not match');
	err.type = config.enums.errorTypes.idConflict;
	return err;
};

module.exports.getStreamError = function (message) {
	const err = new Error('Error on stream');
	err.type = config.enums.errorTypes.stream;
	err.message = message;
	return err;
};

module.exports.getUnknownError = function (description, data) {
	const err = new Error(description);
	err.type = config.enums.errorTypes.unknown;
	err.data = data;
	return err;
};
