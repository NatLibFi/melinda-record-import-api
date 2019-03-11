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

const {Utils} = require('@natlibfi/melinda-commons');
const {createLogger, createExpressLogger} = Utils;
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config-general');

let server = null;

let MANDATORY_ENV_VARIABLES = [
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

// Checks that 'mandatory' variables are set etc
if (process.env.NODE_ENV === config.enums.ENVIRONMENT.test + '_full') {
	MANDATORY_ENV_VARIABLES = [
		'CROWD_TOKENNAME',
		'CROWD_SERVER',
		'CROWD_APPNAME',
		'CROWD_APPPASS',
		'CROWD_USERNAME',
		'CROWD_PASS'
	];
} else if (process.env.NODE_ENV === config.enums.ENVIRONMENT.testing) {
	MANDATORY_ENV_VARIABLES = [];
}

config.default(MANDATORY_ENV_VARIABLES); // Check that all values are set

if (process.env.NODE_ENV === config.enums.ENVIRONMENT.testing) {
	process.env.REQ_AUTH = false;
}

const Logger = createLogger();
const app = express();

app.config = config; // If env variables are set, those are used, otherwise defaults

app.use(createExpressLogger());
app.use(cors());
app.use(require('method-override')());

app.use(express.static(path.join(__dirname, '/public')));

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
		Logger.log('debug', `At error handling: ${err}`);

		switch (err.type) {
			case config.enums.ERROR_TYPES.notObject:
				return res.status(config.enums.HTTP_CODES.Malformed).send('Malformed content');
			case config.enums.ERROR_TYPES.unauthorized:
				return res.status(config.enums.HTTP_CODES.Unauthorized).send('Authentication failed');
			case config.enums.ERROR_TYPES.forbidden:
				return res.status(config.enums.HTTP_CODES.Forbidden).send('Not authorized');
			case config.enums.ERROR_TYPES.badRequest:
				return res.status(config.enums.HTTP_CODES.BadRequest).send('The profile does not exist or the user is not authorized to it');
			case config.enums.ERROR_TYPES.missingProfile:
				return res.status(config.enums.HTTP_CODES.BadRequest).send(err.message || 'Bad request');
			case config.enums.ERROR_TYPES.missingContent:
				return res.status(config.enums.HTTP_CODES.NotFound).send(err.message || 'Content not found');
			case config.enums.ERROR_TYPES.missingContentType:
				return res.status(config.enums.HTTP_CODES.Unsupported).send('Content type was not specified');
			case config.enums.ERROR_TYPES.bodyTooLarge:
				return res.status(config.enums.HTTP_CODES.PayloadTooLarge).send('Request body is too large');
			case config.enums.ERROR_TYPES.validation:
				return res.status(config.enums.HTTP_CODES.ValidationError).send('Invalid syntax');
			case config.enums.ERROR_TYPES.idConflict:
				return res.status(config.enums.HTTP_CODES.ValidationError).send('Invalid syntax');
			case config.enums.ERROR_TYPES.stream:
				return res.status(config.enums.HTTP_CODES.InternalServerError).send(err.message || 'Unspecified stream error');
			case config.enums.ERROR_TYPES.unknown: {
				console.error('Unkown error logged: ', err); // Log unkown errors by default, others are semi-normal usage errors
				return res.status(config.enums.HTTP_CODES.InternalServerError).send('Unknown error');
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
	} else if (process.env.NODE_ENV === config.enums.ENVIRONMENT.testing || process.env.NODE_ENV === config.enums.ENVIRONMENT.test + '_full') { // Test version
		require('./utils/database/db-test')();
	}

	// Finally, let's start our server...
	server = app.listen(app.config.portAPI, () => {
		Logger.log('info', `Server running using seed DB: ${app.config.seedDB} at: ${JSON.stringify(server.address())}`);

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
