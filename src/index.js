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

import {Utils} from '@natlibfi/melinda-commons';
import HttpStatus from 'http-status';
import passport from 'passport';
import express from 'express';
import cors from 'cors';
import Mongoose from 'mongoose';
import ApiError from './error';
import {createBlobsRouter, createProfilesRouter} from './routes';
import generatePassportMiddlewares from './passport';
import {
	ENABLE_PROXY, HTTP_PORT,
	MONGO_URI, MONGO_DEBUG,
	USER_AGENT_LOGGING_BLACKLIST
} from './config';

const {createLogger, createExpressLogger, handleInterrupt} = Utils;

run();

async function run() {
	Mongoose.set('debug', MONGO_DEBUG);

	const passportMiddlewares = generatePassportMiddlewares();
	const Logger = createLogger();
	const app = express();

	await Mongoose.connect(MONGO_URI, {useNewUrlParser: true});

	app.enable('trust proxy', ENABLE_PROXY);

	app.use(createExpressLogger({
		// Do not log requests from automated processes ('Cause there'll be plenty)
		skip: r => USER_AGENT_LOGGING_BLACKLIST.includes(r.get('User-Agent'))
	}));

	app.use(passport.initialize());

	app.use(cors());

	app.use('/blobs', createBlobsRouter(passportMiddlewares));
	app.use('/profiles', createProfilesRouter(passportMiddlewares));

	app.use(handleError);

	const server = app.listen(HTTP_PORT, () => {
		Logger.log('info', 'Started melinda-record-import-api');
	});

	registerSignalHandlers();

	function handleError(err, req, res, next) { // eslint-disable-line no-unused-vars
		if (err instanceof ApiError || 'status' in err) {
			res.sendStatus(err.status);
		} else {
			Logger.log('error', err instanceof Error ? err.stack : err);
			res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
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
			server.close();
			Mongoose.disconnect();
			handleInterrupt(arg);
		}
	}
}

