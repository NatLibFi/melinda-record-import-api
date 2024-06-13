import {Schema} from 'mongoose';
import {BLOB_STATE, RECORD_IMPORT_STATE} from '@natlibfi/melinda-record-import-commons';

export const ProfileModel = new Schema({
  id: {type: String, required: true, unique: true},
  groups: [
    {
      type: String,
      required: true
    }
  ]
}, {strict: 'throw', versionKey: false});

export const BlobMetadataModel = new Schema({
  id: {type: String, required: true, unique: true},
  correlationId: {type: String, default: ''},
  profile: {type: String, required: true},
  cataloger: {default: false},
  contentType: {type: String, required: true},
  state: {
    type: String,
    required: true,
    enum: Object.values(BLOB_STATE),
    default: BLOB_STATE.UPLOADING
  },
  creationTime: {type: Date, default: Date.now},
  modificationTime: {type: Date, default: Date.now},
  processingInfo: {
    transformationError: {},
    numberOfRecords: {type: Number, required: true, default: 0},
    failedRecords: [],
    importResults: [
      new Schema({
        status: {
          type: String,
          enum: Object.values(RECORD_IMPORT_STATE),
          required: true
        },
        timestamp: {type: Date, default: Date.now},
        metadata: {}
      }, {_id: false})
    ]
  }
}, {strict: 'throw', versionKey: false});
