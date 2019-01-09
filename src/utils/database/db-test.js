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

/* eslint-disable camelcase */

'use strict';
import {configurationGeneral as config} from '@natlibfi/melinda-record-import-commons';

const logs = config.logs;

const mongoose = require('mongoose');
const chunks = require('./chunks');

console.log('Setting up db-test');

// /////////////////////////////////////////
// Start: Generate testing objects to DB //
mongoose.models.BlobMetadata.remove(() => {
	mongoose.models.BlobMetadata.create({
		id: '2000',
		profile: '2200',
		contentType: 'standard'
	}, {
		id: '2001',
		profile: 'single_test_metadata',
		contentType: 'standard'
	}, {
		id: '2002',
		profile: '2200',
		contentType: 'standard'
	}, err => {
		if (logs) {
			console.log('Finished populating testing blobs, errors: ', err);
		}
	});
});

mongoose.models['BlobMetaDatas.File'].remove(() => {
	mongoose.models['BlobMetaDatas.Chunk'].remove(() => {
		mongoose.models['BlobMetaDatas.File'].create({
			filename: '2000', // This is metadataID
			contentType: 'binary/octet-stream',
			length: 310,
			chunkSize: 261120,
			uploadDate: chunks.chunkDefDate,
			aliases: null,
			metadata: null,
			md5: '5b8c890af47c4dc7df19ea512005f207'
		}, (err, item) => {
			if (logs) {
				console.log('ID of created: ', item._id, ' Errors: ', err);
			}

			mongoose.models['BlobMetaDatas.Chunk'].create({
				files_id: item._id,
				n: 0,
				data: Buffer.from(chunks.chunkDef, 'base64')
			}, err => {
				if (logs) {
					console.log('Chunk created for ', item._id, ', Error: ', err);
				}
			});
		});

		mongoose.models['BlobMetaDatas.File'].create({
			filename: '2001', // This is metadataID
			contentType: 'binary/octet-stream',
			length: 310,
			chunkSize: 261120,
			uploadDate: chunks.chunkDefDate,
			aliases: null,
			metadata: null,
			md5: '5b8c890af47c4dc7df19ea512005f207'
		}, (err, item) => {
			if (logs) {
				console.log('ID of created: ', item._id, ' Errors: ', err);
			}

			mongoose.models['BlobMetaDatas.Chunk'].create({
				files_id: item._id,
				n: 0,
				data: Buffer.from(chunks.chunkDef, 'base64')
			}, err => {
				if (logs) {
					console.log('Chunk created for ', item._id, ', Error: ', err);
				}
			});
		});

		mongoose.models['BlobMetaDatas.File'].create({
			filename: '2002', // This is metadataID
			contentType: 'binary/octet-stream',
			length: 310,
			chunkSize: 261120,
			uploadDate: chunks.chunkDefDate,
			aliases: null,
			metadata: null,
			md5: '5b8c890af47c4dc7df19ea512005f207'
		}, (err, item) => {
			if (logs) {
				console.log('ID of created: ', item._id, ' Errors: ', err);
			}

			mongoose.models['BlobMetaDatas.Chunk'].create({
				files_id: item._id,
				n: 0,
				data: Buffer.from(chunks.chunkDef, 'base64')
			}, err => {
				if (logs) {
					console.log('Chunk created for ', item._id, ', Error: ', err);
				}
			});
		});
	});
});

mongoose.models.Profile.remove(() => {
	mongoose.models.Profile.create({
		name: '2200',
		auth: {
			groups: ['test']
		},
		transformation: {
			abortOnInvalidRecords: false,
			image: 'standard_user',
			env: {}
		},
		import: {
			image: 'standard_user',
			env: {}
		}
	}, {
		name: '2201',
		auth: {
			groups: ['admin', 'test']
		},
		transformation: {
			abortOnInvalidRecords: false,
			image: 'standard',
			env: {}
		},
		import: {
			image: 'standard',
			env: {}
		}
	}, {
		name: '2202',
		auth: {
			groups: ['subTest']
		},
		transformation: {
			abortOnInvalidRecords: false,
			image: 'standard_user',
			env: {}
		},
		import: {
			image: 'standard_user',
			env: {}
		}
	}, {
		name: 'single_test_metadata',
		auth: {
			groups: ['admin', 'test']
		},
		transformation: {
			abortOnInvalidRecords: false,
			image: 'standard',
			env: {}
		},
		import: {
			image: 'standard',
			env: {}
		}
	}, err => {
		if (logs) {
			console.log('Finished populating testing profiles, errors: ', err);
		}
	});
});
// End: Generate testing objects to DB //
// ///////////////////////////////////////
