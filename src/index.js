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

/* eslint-disable no-unused-vars */

'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config-general');

const logs = config.logs;
let server = null;
// Const bodyParser = require('body-parser');

const MANDATORY_ENV_VARIABLES = [
	'HOSTNAME_API',
	'PORT_API',
	'URL_API',
	'CONT_MAX_LENGTH',
	'MONGODB_URI',
	'MONGODB_DEBUG',
	'CROWD_TOKENNAME',
	'CROWD_SERVER',
	'CROWD_APPNAME',
	'CROWD_APPPASS'
];

// If USE_DEF is set to true, app uses default values, otherwise checks that "mandatory" variables are set
if (process.env.NODE_ENV === 'test') {
	process.env.REQ_AUTH = false;
} else if (process.env.USE_DEF === 'true' || process.env.NODE_ENV === 'test_full') {
	const configCrowd = require('./config-crowd'); // Load default crowd authentications to env variables
	if (configCrowd) {
		process.env.CROWD_TOKENNAME = process.env.CROWD_TOKENNAME || configCrowd.tokenName;
		process.env.CROWD_USERNAME = process.env.CROWD_USERNAME || configCrowd.username;
		process.env.CROWD_PASS = process.env.CROWD_PASS || configCrowd.password;
		process.env.CROWD_SERVER = process.env.CROWD_SERVER || configCrowd.server;
		process.env.CROWD_APPNAME = process.env.CROWD_APPNAME || configCrowd.appName;
		process.env.CROWD_APPPASS = process.env.CROWD_APPPASS || configCrowd.appPass;
	} else {
		throw new Error('Trying to use default variables, but Crowd configuration file not found');
	}
} else {
	config.default(MANDATORY_ENV_VARIABLES); // Check that all values are set
}

const app = express();
app.config = config; // If env variables are set, those are used, otherwise defaults
app.enums = config.enums;
app.use(cors());

// Normal express config defaults
if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'test_full') {
	app.use(require('morgan')('dev'));
}
app.use(require('method-override')());

app.use(express.static(path.join(__dirname, '/public')));

// These were enabled during development for manual testing purposes
// app.use(bodyParser.urlencoded({ extended: false }));
// app.use(bodyParser.json());

// Start mongo from configuration
mongoose.connect(app.config.mongodb.uri, {useNewUrlParser: true}).then(() => { // Routes uses mongo connection to setup gridFS
	mongoose.set('debug', app.config.mongoDebug);

    // Setup routes
	require('./routes')(app);

    // Swagger UI
	const swaggerUi = require('swagger-ui-express');
	const swaggerDocument = require('./api.json');
	app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

    // Catch 404 and forward to error handler
	app.use((req, res, next) => {
		const err = new Error('Not Found');
		err.status = 404;
		next(err);
	});

    // General error, next required for overloading
	app.use((err, req, res, next) => {
		if (logs) {
			console.log('-------------- At error handling --------------');
			console.warn(err);
		}

		switch (err.type) {
			case config.enums.errorTypes.notObject:
				return res.status(config.httpCodes.Malformed).send('Malformed content');
			case config.enums.errorTypes.unauthorized:
				return res.status(config.httpCodes.Unauthorized).send('Authentication failed');
			case config.enums.errorTypes.forbidden:
				return res.status(config.httpCodes.Forbidden).send('Not authorized');
			case config.enums.errorTypes.badRequest:
				return res.status(config.httpCodes.BadRequest).send('The profile does not exist or the user is not authorized to it');
			case config.enums.errorTypes.missingProfile:
				return res.status(config.httpCodes.BadRequest).send(err.message || 'Bad request');
			case config.enums.errorTypes.missingContent:
				return res.status(config.httpCodes.NotFound).send(err.message || 'Content not found');
			case config.enums.errorTypes.missingContentType:
				return res.status(config.httpCodes.Unsupported).send('Content type was not specified');
			case config.enums.errorTypes.bodyTooLarge:
				return res.status(config.httpCodes.PayloadTooLarge).send('Request body is too large');
			case config.enums.errorTypes.validation:
				return res.status(config.httpCodes.ValidationError).send(err.message || 'Request validation failed');
			case config.enums.errorTypes.idConflict:
				return res.status(config.httpCodes.ValidationError).send('Invalid syntax');
			case config.enums.errorTypes.stream:
				return res.status(config.httpCodes.InternalServerError).send(err.message || 'Unspecified stream error');
			case config.enums.errorTypes.unknown: {
				console.error(err); // Log unkown errors by default, others are semi-normal usage errors
				return res.status(config.httpCodes.InternalServerError).send('Unknown error');
			}
			default: {
				console.error(err); // Log missed errors by default
				res.status(err.status || 500);
				res.json({
					errors: {
						message: err.message,
						error: {}
                        // Error: err // will print stacktrace
					}
				});
			}
		}
	});

	// Clear DB or use seed version
	if (app.config.seedDB === true) {
		require('./utils/database/db-seed')();
	} else if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test_full') { // Test version
		require('./utils/database/db-test')();
	}

    // Finally, let's start our server...
	server = app.listen(app.config.portAPI, () => {
		console.log('Server running using seed DB: ' + app.config.seedDB + ', at: ', server.address());

		// Inform any listeners (tests) that server is running (and mongo/gridFS has had enough time)
		setTimeout(() => {
			app.emit('app_started');
		}, 3000);
	});
});

// Export app for testing
module.exports = app;

// Shut down app. (after tests)
module.exports.close = function (callback) {
	server.close();
	callback();
};
