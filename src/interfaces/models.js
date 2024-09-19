import httpStatus from 'http-status';

import {BLOB_STATE} from '@natlibfi/melinda-record-import-commons';
import {Error as ApiError} from '@natlibfi/melinda-commons';

export const profileSchema = {
  id: value => typeof value === 'string',
  groups: value => Array.isArray(value) && value.every(item => typeof item === 'string')
};

export const blobsSchema = {
  id: value => shcemaHelper(value, {name: 'id', type: 'string', required: true}),
  correlationId: value => shcemaHelper(value, {name: 'id', type: 'string'}),
  profile: value => shcemaHelper(value, {name: 'id', type: 'string', required: true}),
  cataloger: value => shcemaHelper(value, {name: 'id', type: 'string'}),
  notificationEmail: value => shcemaHelper(value, {name: 'id', type: 'string'}),
  contentType: value => shcemaHelper(value, {name: 'id', type: 'string'}),
  state: value => shcemaHelper(value, {name: 'id', type: 'string', match: BLOB_STATE[`${value}`], required: true}),
  creationTime: value => typeof value === Date || typeof value === 'string',
  modificationTime: value => typeof value === Date || typeof value === 'string',
  processingInfo: value => Array.isArray(value)
};

export function validate(object, schema) {
  const extraKeys = Object.keys(object)
    .filter(key => schema[key] === undefined)
    .map(key => new ApiError(httpStatus.UNPROCESSABLE_ENTITY, `Object contains key "${key}" that is not defined in schema.`));

  if (extraKeys.length > 0) {
    throw extraKeys[0];
  }

  const invalidValues = Object.keys(schema)
    .filter(key => !schema[key](object[key]))
    .map(key => new ApiError(httpStatus.UNPROCESSABLE_ENTITY, `Object key "${key}" contains invalid value "${object[key]}".`));

  if (invalidValues.length > 0) {
    throw invalidValues[0];
  }

  return;
}

function shcemaHelper(value, {name = '', type = false, match = false, required = false}) {
  const [firstError] = [
    checkType(value, name, type),
    checkMatch(value, name, match),
    checkRequired(value, name, required)
  ].filter(value => value);

  if (firstError) {
    throw firstError;
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


