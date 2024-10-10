import httpStatus from 'http-status';

import {BLOB_STATE} from '@natlibfi/melinda-record-import-commons';
import {Error as ApiError} from '@natlibfi/melinda-commons';

export const profileSchema = {
  id: value => typeof value === 'string',
  groups: value => Array.isArray(value) && value.every(item => typeof item === 'string')
};

export const blobsSchema = {
  id: value => schemaHelper(value, {name: 'id', type: 'string', required: true}),
  correlationId: value => schemaHelper(value, {name: 'id', type: 'string'}),
  profile: value => schemaHelper(value, {name: 'id', type: 'string', required: true}),
  cataloger: value => schemaHelper(value, {name: 'id', type: 'string'}),
  notificationEmail: value => schemaHelper(value, {name: 'id', type: 'string'}),
  contentType: value => schemaHelper(value, {name: 'id', type: 'string'}),
  state: value => schemaHelper(value, {name: 'id', type: 'string', match: BLOB_STATE[`${value}`], required: true}),
  creationTime: value => typeof value === Date || typeof value === 'string',
  modificationTime: value => typeof value === Date || typeof value === 'string',
  processingInfo: value => Array.isArray(value)
};

export function validate(object, schema) {
  const extraKeys = Object.keys(object)
    .filter(key => schema[key] === undefined);

  if (extraKeys.length > 0) {
    throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, `Object contains key(s) that is not defined in schema: ${extraKeys}`);
  }

  const invalidValues = Object.keys(schema)
    .filter(key => !schema[key](object[key]))
    .map(key => `Key: ${key}, Value: ${object[key]}`);

  if (invalidValues.length > 0) {
    throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, `Some of object keys contains invalid value: ${invalidValues}`);
  }

  return;
}

function schemaHelper(value, {name = '', type = false, match = false, required = false}) {
  const errors = [
    checkType(value, name, type),
    checkMatch(value, name, match),
    checkRequired(value, name, required)
  ].filter(value => value);

  if (errors.length > 0) {
    throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, `Object does not match to schema: ${errors}`);
  }

  return;

  function checkType(value, name, type) {
    if (type) {
      return typeof value === type ? false : `${name} key in object has wrong type value ${value} ${typeof value}`;
    }

    return false;
  }

  function checkMatch(value, name, match) {
    if (match) {
      return value === match ? false : `${name} key in object value does not match ${value} ${match}`;
    }

    return false;
  }

  function checkRequired(value, name, required) {
    if (required) {
      return value === false || value === undefined ? `Required ${name} key in object is false or missing` : false;
    }

    return false;
  }
}


