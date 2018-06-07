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

var logs = config.logs,
    express = require('express'),
    bodyParser = require('body-parser'),
    cors = require('cors'),
    mongoose = require('mongoose');

var app = express();
app.config = config;
app.enums = config.enums;
app.use(cors());

//var isProduction = process.env.NODE_ENV === enums.environment.production;
var isProduction = app.config.environment === app.enums.environment.production;


// Normal express config defaults
app.use(require('morgan')('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(require('method-override')());
app.use(express.static(__dirname + '/public'));

if (isProduction) {
    mongoose.connect(app.config.mongodb);
} else {
    mongoose.connect('mongodb://generalAdmin:ToDoChangeAdmin@127.0.0.1:27017/melinda-record-import-api');
    mongoose.set('debug', config.mongoDebug);
}

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
    if (logs) console.error(err);

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
        case config.enums.errorTypes.missing:
            return res.status(config.httpCodes.BadRequest).send('The profile does not exist or the user is not authorized to it');
        case config.enums.errorTypes.unknown:
            return res.status(config.httpCodes.InternalServerError).send('Unknown error');
        default: {
            // development error handler
            // will print stacktrace
            if (!isProduction) {
                res.status(err.status || 500);
                res.json({
                    'errors': {
                        message: err.message,
                        error: err
                    }
                });
            // production error handler
            // no stacktraces leaked to user
            } else {
                res.status(err.status || 500);
                res.json({
                    'errors': {
                        message: err.message,
                        error: {}
                    }
                });
            }
        }
    }
});

if (app.config.seedDB) {
    console.log("Seed DB");
    require('./utils/database/seedDB');
}
if (app.config.emptyDB) {
    require('./utils/database/emptyDB');
}

// finally, let's start our server...
var server = app.listen(app.config.portAPI, function () {
    console.log('Listening on port ' + server.address().port + ', is in production: ' + isProduction);
    //console.log('Env:', process.env);
});