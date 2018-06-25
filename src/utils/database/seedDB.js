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
const logs = config.logs;

var mongoose = require('mongoose');
const chunks = require('./chunks');

mongoose.models.BlobMetadata.remove(function () {
    mongoose.models.BlobMetadata.create({
        id: '1001',
        profile: '1201',
        contentType: 'standard',
        state: config.enums.blobStates.pending
    }, {
        id: '1002',
        profile: 'standard',
        contentType: 'standard',
        state: config.enums.blobStates.processed
    }, {
        id: '1003',
        profile: 'standard',
        contentType: 'stylized',
        state: config.enums.blobStates.processed
    }, {
        id: '1004',
        profile: '1201',
        contentType: 'stylized',
        state: config.enums.blobStates.processed
    }, {
        id: '1005',
        profile: '1201',
        contentType: 'standard',
        state: config.enums.blobStates.processed
    }, function (err) {
        if (logs) console.log('Finished populating development blobs, errors: ', err);
    });
});

mongoose.models['BlobMetaDatas.File'].remove(function () {
    mongoose.models['BlobMetaDatas.Chunk'].remove(function () {
        mongoose.models['BlobMetaDatas.File'].create({
            filename : '1001', //This is metadataID
            contentType : 'binary/octet-stream', 
            length : 310, 
            chunkSize : 261120, 
            uploadDate: chunks.chunkDefDate,
            aliases : null, 
            metadata : null, 
            md5 : '5b8c890af47c4dc7df19ea512005f207'
        }, function (err, item) {
            console.log("ID of created: ", item._id, " Errors: ", err, );

            mongoose.models['BlobMetaDatas.Chunk'].create({
                files_id: item._id,
                n: 0,
                data :  new Buffer(chunks.chunkDef, 'base64')
            }, function (err, small) {
                console.log("Chunk created for 1001, Error: ", err);
            });
        });

        mongoose.models['BlobMetaDatas.File'].create({
            filename : '1002', //This is metadataID
            contentType : 'binary/octet-stream', 
            length : 310, 
            chunkSize : 261120, 
            uploadDate: new Date(),
            aliases : null, 
            metadata : null, 
            md5 : '5b8c890af47c4dc7df19ea512005f207'
        }, function (err, item) {
            console.log("ID of created: ", item._id, " Errors: ", err, );

            mongoose.models['BlobMetaDatas.Chunk'].create({
                files_id: item._id,
                n: 0,
                data :  new Buffer(chunks.chunkDef, 'base64')
            }, function (err, small) {
                console.log("Chunk created for 1002, Error: ", err);
            });
        });
        
        mongoose.models['BlobMetaDatas.File'].create({
            filename : '1003', //This is metadataID
            contentType : 'binary/octet-stream', 
            length : 354020, 
            chunkSize : 261120, 
            uploadDate: new Date(),
            aliases : null, 
            metadata : null, 
            md5 : '531c35384c3ab6913cb2f6dbd6e98253'
        }, function (err, item) {
            console.log("ID of created: ", item._id, " Errors: ", err, );

            mongoose.models['BlobMetaDatas.Chunk'].create({
                files_id: item._id,
                n: 0,
                data :  new Buffer(chunks.chunk_0, 'base64')
            },{
                files_id: item._id,
                n: 1,
                data :  new Buffer(chunks.chunk_1, 'base64')
            }, function (err, small) {
                console.log("Chunk created for 1003, Error: ", err);
            });
        });

        mongoose.models['BlobMetaDatas.File'].create({
            filename : '1004', //This is metadataID
            contentType : 'binary/octet-stream', 
            length : 310, 
            chunkSize : 261120, 
            uploadDate: chunks.chunkDefDate,
            aliases : null, 
            metadata : null, 
            md5 : '5b8c890af47c4dc7df19ea512005f207'
        }, function (err, item) {
            console.log("ID of created: ", item._id, " Errors: ", err, );

            mongoose.models['BlobMetaDatas.Chunk'].create({
                files_id: item._id,
                n: 0,
                data :  new Buffer(chunks.chunkDef, 'base64')
            }, function (err, small) {
                console.log("Chunk created for 1004, Error: ", err);
            });
        });

        mongoose.models['BlobMetaDatas.File'].create({
            filename : '1005', //This is metadataID
            contentType : 'binary/octet-stream', 
            length : 310, 
            chunkSize : 261120, 
            uploadDate: chunks.chunkDefDate,
            aliases : null, 
            metadata : null, 
            md5 : '5b8c890af47c4dc7df19ea512005f207'
        }, function (err, item) {
            console.log("ID of created: ", item._id, " Errors: ", err, );

            mongoose.models['BlobMetaDatas.Chunk'].create({
                files_id: item._id,
                n: 0,
                data :  new Buffer(chunks.chunkDef, 'base64')
            }, function (err, small) {
                console.log("Chunks created for 1005, Error: ", err);
            });
        });
    });
});

//These do not match profiles schema and because of that mongoose doesn't add these
mongoose.models.Profile.remove(function () {
    mongoose.models.Profile.create({
        name: '1201',
        auth: {
            groups: ['admin', 'test']
        },
        transformation: {
            abortOnInvalidRecords: false,
            image: 'melinda-transformer',
            env: {}
        },
        'import': {
            image: 'melinda-importer',
            env: {}
        }
    }, {
        name: 'standard',
        auth: {
            groups: ['subTest']
        },
        transformation: {
            abortOnInvalidRecords: false,
            image: 'melinda-transformer',
            env: {}
        },
        'import': {
            image: 'melinda-importer',
            env: {}
        }
    }, function (err) {
        if (logs) console.log('Finished populating testing profiles, errors: ', err);
    });
});