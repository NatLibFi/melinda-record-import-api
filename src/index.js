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

'use strict';

import {configurationGeneral as config} from '@natlibfi/melinda-record-import-commons';

const logs = config.logs,
      express = require('express'),
      bodyParser = require('body-parser'),
      cors = require('cors'),
      mongoose = require('mongoose');

const MANDATORY_ENV_VARIABLES = [
    'HOSTNAME_API',
    'PORT_API',
    'URL_API',
    'MONGODB_URI',
    'MONGODB_DEBUG',
    'LOGS',
    'DB_SEED',
    'CROWD_TOKENNAME',
    'CROWD_USERNAME',
    'CROWD_PASS',
    'CROWD_SERVER',
    'CROWD_APPNAME',
    'CROWD_APPPASS'
];    

//If USE_DEF is set to true, app uses default values
if(!process.env.USE_DEF){
    config.default(MANDATORY_ENV_VARIABLES); //Check that all values are set
}else{
    var configCrowd = require('./config-crowd') //Load default crowd authentications to env variables
    if(configCrowd){
        process.env.CROWD_TOKENNAME = configCrowd.tokenName;
        process.env.CROWD_USERNAME = configCrowd.username;
        process.env.CROWD_PASS = configCrowd.password;
        process.env.CROWD_SERVER = configCrowd.server;
        process.env.CROWD_APPNAME = configCrowd.appName;
        process.env.CROWD_APPPASS = configCrowd.appPass;
    }else{
        throw new Error('Trying to use default variables, but Crowd configuration file not found');
    }
}

var app = express();
app.config = config; //If env variables are set, those are used, otherwise defaults
app.enums = config.enums;
app.use(cors());

// Normal express config defaults
app.use(require('morgan')('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(require('method-override')());
app.use(express.static(__dirname + '/public'));

mongoose.connect(app.config.mongodb.uri);
mongoose.set('debug', app.config.mongoDebug);

require('./routes')(app);

//Swagger UI
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../api.json');

app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

/// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// general error handlers
app.use(function (err, req, res, next) {
    if (logs) console.log('-------------- At error handling --------------');
    if (logs) console.warn(err);

    switch (err.type) {
        case config.enums.errorTypes.parseFailed:
        case config.enums.errorTypes.notObject:
            return res.status(config.httpCodes.Malformed).send('Malformed content');
        case config.enums.errorTypes.invalidSyntax:
            return res.status(config.httpCodes.ValidationError).send('Invalid syntax');
        case config.enums.errorTypes.unauthorized:
            return res.status(config.httpCodes.Unauthorized).send('Authentication failed');
        case config.enums.errorTypes.forbidden:
            return res.status(config.httpCodes.Forbidden).send('Not authorized');
        case config.enums.errorTypes.missingProfile:
            return res.status(config.httpCodes.BadRequest).send('The profile does not exist or the user is not authorized to it');
        case config.enums.errorTypes.missingContentType:
            return res.status(config.httpCodes.Unsupported).send('Content type was not specified');
        case config.enums.errorTypes.validation:{
            console.error(err.data);
            return res.status(config.httpCodes.ValidationError).send('Request validation failed');
        }
        case config.enums.errorTypes.unknown:{
            console.error(err.data);
            return res.status(config.httpCodes.InternalServerError).send('Unknown error');
        }
        default: {
            res.status(err.status || 500);
            res.json({
                'errors': {
                    message: err.message,
                    error: {}
                    //error: err // will print stacktrace
                }
            });
        }
    }
});

if (app.config.seedDB) {
    require('./utils/database/seedDB');
}

// finally, let's start our server...
var server = app.listen(app.config.portAPI, function () {
    console.log('Server running using seed DB: ' + app.config.seedDB + ', at: ', server.address() );
});