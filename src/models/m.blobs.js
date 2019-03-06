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

const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const _ = require('lodash');

const config = require('../config-general');

const BlobMetadata = new Schema({
	id: {type: String, required: true, unique: true},
	profile: {type: String, required: true},
	contentType: {type: String, required: true},
	state: {
		type: String,
		enum: _.values(config.enums.BLOB_STATE), // Defined in enums
		default: config.enums.BLOB_STATE.pending
	},
	creationTime: {type: Date, default: Date.now},
	modificationTime: {type: Date, default: Date.now},
	processingInfo: {
		transformationError: {type: Object, default: null},
		numberOfRecords: {type: Number, default: null},
		importResults: [new Schema({
			status: {
				type: String,
				enum: _.values(config.enums.RECORD_IMPORT_STATE),
				required: true},
			metadata: {type: String, required: true, unique: true}
		}, {_id: false})]
	}
}, {
	strict: 'throw'
});

const RecordImportResult = new Schema({
	id: {type: String, required: true, unique: true},
	status: {
		type: String,
		enum: _.values(config.enums.recodImportStatuses),
		required: true
	},
	ids: [{
		type: String
	}],
	metadata: {type: Object}
});

const BlobContentFilesSchema = new Schema({
    // UploadDate: {type: Date, default: Date.now}
}, {strict: false, versionKey: false}, 'fs.files');

const BlobContentChunksSchema = new Schema({
}, {strict: false, versionKey: false}, 'fs.chunks');

module.exports = mongoose.model('BlobMetadata', BlobMetadata);
module.exports = mongoose.model('BlobMetaDatas.File', BlobContentFilesSchema);
module.exports = mongoose.model('BlobMetaDatas.Chunk', BlobContentChunksSchema);
module.exports = mongoose.model('RecordImportResult', RecordImportResult);
