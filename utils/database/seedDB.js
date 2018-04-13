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
var mongoose = require('mongoose'),
    config = require('../../config');

var logs = config.logs;

mongoose.models.BlobMetadata.remove(function () {
    mongoose.models.BlobMetadata.create({
        UUID: '1001',
        profile: 'test',
        contentType: 'standard'
    }, {
        UUID: '1002',
        profile: 'standard',
        contentType: 'standard'
    }, {
        UUID: '1003',
        profile: 'standards',
        contentType: 'stylized'
    }, {
        UUID: '1004',
        profile: 'adminstrator',
        contentType: 'stylized'
    }, {
        UUID: '1005',
        profile: 'guest',
        contentType: 'standard'
    }, function (err) {
        if (logs) console.log('Finished populating development blobs, errors: ', err);
    });
});

mongoose.models.BlobContent.remove(function () {
    mongoose.models.BlobContent.create({
        UUID: '1101',
        MetaDataID: '1001',
        data: {
            datafield1: 'single data',
            datafield2: 'single data 1'
        }
    }, {
        UUID: '1102',
        MetaDataID: '1002',
        data: {
            datafield1: 'data 1',
            datafield2: 'data 2'
        }
    }, {
        UUID: '1103',
        MetaDataID: '1003',
        data: {
            datafield1: 'data 1',
            datafield2: 'data 2'
        }
    }, {
        UUID: '1104',
        MetaDataID: '1004',
        data: {
            datafield1: 'data 1',
            datafield2: 'data 2'
        }
    }, {
        UUID: '1105',
        MetaDataID: '1005',
        data: {
            datafield1: 'data 1',
            datafield2: 'data 2'
        }
    }, function (err) {
        if (logs) console.log('Finished populating development blobs, errors: ', err);
    });
});

//These do not match profiles schema and because of that mongoose doesn't add these
mongoose.models.Profile.remove(function () {
    mongoose.models.Profile.create({
        id: '1201',
        auth: {
            groups: ['admin', 'user']
        },
        transformation: {
            abortOnInvalidRecords: false,
            module: 'standard',
            parameters: {
                priority: true,
                ignoreFlags: false
            },
        },
        'import': {
            module: 'standard',
            parameters: {
                priority: true,
                ignoreFlags: false
            }
        }
    }, function (err) {
        console.log('Finished populating testing profiles, errors: ', err);
    });
});