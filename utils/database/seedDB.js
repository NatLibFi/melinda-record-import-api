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
var mongoose = require('mongoose');

mongoose.models.BlobMetadata.remove(function () {
    mongoose.models.BlobMetadata.create({
        UUID: '1112',
        profile: 'standard',
        contentType: 'standard'
    }, {
        UUID: '1113',
        profile: 'standards',
        contentType: 'stylized'
    }, {
        UUID: '1114',
        profile: 'adminstrator',
        contentType: 'stylized'
    }, {
        UUID: '1115',
        profile: 'guest',
        contentType: 'standard'
    }, function (err) {
        console.log('Finished populating testing blobs, errors: ', err);
    });
});

mongoose.models.BlobContent.remove(function () {
    mongoose.models.BlobContent.create({
        UUID: '0002',
        MetaDataID: '1112',
        data: {
            datafield1: 'data 1',
            datafield2: 'data 2'
        }
    }, {
        UUID: '0003',
        MetaDataID: '1113',
        data: {
            datafield1: 'data 1',
            datafield2: 'data 2'
        }
    }, {
        UUID: '0004',
        MetaDataID: '1114',
        data: {
            datafield1: 'data 1',
            datafield2: 'data 2'
        }
    }, {
        UUID: '0005',
        MetaDataID: '1115',
        data: {
            datafield1: 'data 1',
            datafield2: 'data 2'
        }
    }, function (err) {
        console.log('Finished populating testing blobs, errors: ', err);
    });
});