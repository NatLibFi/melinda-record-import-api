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

/* eslint-disable array-bracket-newline */

import {Schema} from 'mongoose';
import {BLOB_STATE, RECORD_IMPORT_STATE} from '@natlibfi/melinda-record-import-commons';

export const ProfileModel = new Schema({
  id: {type: String, required: true, unique: true},
  auth: {
    type: Object,
    required: true,
    groups: [{
      type: String,
      required: true
    }]
  },
  transformation: {
    type: Object,
    required: true,
    image: {type: String, required: true},
    env: {type: Object}
  },
  import: {
    type: Object,
    required: true,
    image: {type: String, required: true},
    concurrency: {type: Number},
    env: {type: Object}
  }
}, {strict: 'throw'});

export const BlobMetadataModel = new Schema({
  id: {type: String, required: true, unique: true},
  correlationId: {type: String, default: ''},
  profile: {type: String, required: true},
  contentType: {type: String, required: true},
  state: {
    type: String,
    required: true,
    enum: Object.values(BLOB_STATE),
    default: BLOB_STATE.PENDING_TRANSFORMATION
  },
  creationTime: {type: Date, default: Date.now},
  modificationTime: {type: Date, default: Date.now},
  processingInfo: {
    transformationError: {},
    numberOfRecords: {type: Number, required: true, default: 0},
    failedRecords: [],
    queuedRecords: [new Schema({
      title: {type: String, required: true},
      standardIdentifiers: [],
      timestamp: {type: Date, default: Date.now}
    }, {_id: false})],
    importResults: [new Schema({
      status: {
        type: String,
        enum: Object.values(RECORD_IMPORT_STATE),
        required: true
      },
      timestamp: {type: Date, default: Date.now},
      metadata: {}
    }, {_id: false})]
  }
}, {strict: 'throw'});
