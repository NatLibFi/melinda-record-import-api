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

var config = require('../melinda-record-import-commons/config'),
    logs = config.logs,
    enums = require('../melinda-record-import-commons/utils/enums'),
    HttpCodes = require('../melinda-record-import-commons/utils/HttpCodes'),
    express = require('express'),
    bodyParser = require('body-parser'),
    cors = require('cors'),
    mongoose = require('mongoose');

var app = express();
app.config = config;
app.enums = enums;
app.use(cors());

//var isProduction = process.env.NODE_ENV === enums.environment.production;
var isProduction = app.config.environment === enums.environment.production;


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
        case enums.errorTypes.parseFailed:
        case enums.errorTypes.notObject:
            return res.status(HttpCodes.Malformed).send('Malformed content');
        case enums.errorTypes.invalidSyntax:
            return res.status(HttpCodes.ValidationError).send('Invalid syntax');
        case enums.errorTypes.unauthorized:
            return res.status(HttpCodes.Unauthorized).send('Authentication failed');
        case enums.errorTypes.forbidden:
            return res.status(HttpCodes.Forbidden).send('Not authorized');
        case enums.errorTypes.unknown:
            return res.status(HttpCodes.InternalServerError).send('Unknown error');
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