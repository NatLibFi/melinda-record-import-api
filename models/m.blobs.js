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
var Schema = mongoose.Schema;

var BlobMetadata = new Schema({
    id: { type: Number, required: true },
    profile: { type: String, required: true },
    contentType: { type: String, required: true },
    state: {
        type: String,
        enum: ['PENDING_TRANSFORMATION', 'TRANSFORMATION_IN_PROGRESS', 'TRANSFORMATION_FAILED', 'TRANSFORMED', 'PROCESSED', 'ABORTED'],
        required: true
    },
    creationTime: { type: Date, required: true },
    modificationTime: { type: Date, required: true },
    processingInfo: {
        transformationError: { type: Object, required: true },
        numberOfRecords: { type: Number, required: true },
        importResults: [{
            type: String //Array of RecordImportResults UUID's
        }]
    }
});


var RecordImportResult = new Schema({
    UUID: { type: String, required: true, unique: true },
    status: {
        type: String,
        enum: ['CREATED', 'UPDATED', 'INVALID', 'DUPLICATE', 'MULTIPLE_MATCHES', 'ERROR'],
        required: true
    },
    id: [{
        type: String
    }],
    metadata: { type: Object}
});


module.exports = mongoose.model('BlobMetadata', BlobMetadata);
module.exports = mongoose.model('RecordImportResult', RecordImportResult);