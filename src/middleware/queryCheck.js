import httpStatus from 'http-status';
import {version as uuidVersion, validate as uuidValidate} from 'uuid';
import {createLogger} from '@natlibfi/melinda-backend-commons';
import {BLOB_STATE} from '@natlibfi/melinda-record-import-commons';

const logger = createLogger();

export function checkQueryParams(req, res, next) {
  const queryParams = req.query;
  const {groups} = req.user.roles;
  logger.debug(`Checking query params: ${JSON.stringify(queryParams)}`);

  const failedParams = validateQueryParams(queryParams, groups);

  if (failedParams.length === 0) {
    logger.debug('Query params OK');
    return next();
  }

  logger.error(`Failed query params: ${failedParams}`);
  //const combinedFailedParams = [...failedParams, ...nonCompatibleParams];
  return res.status(httpStatus.BAD_REQUEST).json({error: 'BAD query params', failedParams});

}

export function validateQueryParams(queryParams = {}, groups = {}) {
  const failedParams = [
    {name: 'id', value: queryParams.id ? validateUuid(queryParams.id) : true},
    {name: 'correlationId', value: queryParams.correlationId ? validateUuid(queryParams.correlationId) : true},
    {name: 'profile', value: queryParams.profile ? checkProfile(queryParams.profile) : true},
    {name: 'contentType', value: queryParams.contentType ? (/^(?:[-.\w/]{1,30})$/iu).test(queryParams.contentType) : true},
    {name: 'state', value: queryParams.state ? checkState(queryParams.state) : true},
    {name: 'creationTime', value: queryParams.creationTime ? checkTimeFormat(queryParams.creationTime) : true},
    {name: 'modificationTime', value: queryParams.modificationTime ? checkTimeFormat(queryParams.modificationTime) : true},
    {name: 'skip', value: queryParams.skip ? (/^\d{1,7}$/u).test(queryParams.skip) : true},
    {name: 'limit', value: queryParams.limit ? (/^\d{1,7}$/u).test(queryParams.limit) : true},
    {name: 'getAll', value: queryParams.getAll ? (/^[10]{1}$/u).test(queryParams.getAll) : true}
  ].filter(param => !param.value).map(param => param.name);

  return failedParams;

  function validateUuid(uuid) {
    logger.debug(`Uuid: ${uuid}`);
    return uuidValidate(uuid) && uuidVersion(uuid) === 4;
  }

  function checkProfile(profile) {
    logger.debug(`Profile: ${profile}`);
    if ((/^(?:[-.,\w/]{1,30})$/iu).test(profile)) {
      if (groups.includes('kvp')) {
        return true;
      }


      if (profile.includes(',')) {
        const profileArray = profile.split(',');
        return !profileArray.some(p => !groups.includes(p));
      }

      if (groups.includes(profile)) {
        return true;
      }

      logger.debug('Invalid profile permissions');
      return false;
    }

    logger.debug('Malformed profile query');
    return false;
  }

  function checkState(state) {
    logger.debug(`State: ${state}`);
    if (state.includes(',')) {
      const stateArray = state.split(',');
      return !stateArray.find(singleState => BLOB_STATE[singleState] === undefined);
    }

    if (Array.isArray(state)) {
      return !state.find(singleState => BLOB_STATE[singleState] === undefined);
    }

    logger.debug(`${JSON.stringify(BLOB_STATE)}`);

    return BLOB_STATE[state] !== undefined;
  }

  function checkTimeFormat(timestampArrayString) {
    logger.debug(`TimestampArrayString: ${timestampArrayString}`);
    try {
      const array = timestampArrayString.split(',');
      if (array.length > 2) {
        return true;
      }

      return !array.some(value => {

        // 2024-08-30T00:00:00.000Z
        if ((/^(?:\d{4}-[01]{1}\d{1}-[0-3]{1}\d{1}T(?:[01][0-9]|2[0-3]):[0-5]{1}\d{1}:[0-5]{1}\d{1}\.\d{3}Z)$/u).test(value)) {
          logger.debug('timestamp UTC format OK (e.g. 2024-08-30T00:00:00.000Z)');
          return false;
        }

        if ((/^(?:\d{4}-[01]{1}\d{1}-[0-3]{1}\d{1}T(?:[01][0-9]|2[0-3]):[0-5]{1}\d{1}:[0-5]{1}\d{1}\.\d{3}[+-]{1}[0-1]{1}\d:\d{2})$/u).test(value)) {
          logger.debug('timestamp ISO format OK (e.g. 2024-10-02T00:00:00.000+03:00)');
          return false;
        }

        if ((/^(?:\d{4}-[01]{1}\d{1}-[0-3]{1}\d{1}T(?:[01][0-9]|2[0-3]):[0-5]{1}\d{1}:[0-5]{1}\d{1}[+-]{1}[0-1]{1}\d:\d{2})$/u).test(value)) {
          logger.debug('timestamp format OK (e.g. 2024-08-30:00:00:00+00:00)');
          return false;
        }

        // 2024-08-30 or 2024-08-30,2024-09-05
        if ((/^(?:\d{4}-[01]{1}\d{1}-[0-3]{1}\d{1})$/u).test(value)) {
          logger.debug('timestamp day format OK (e.g. 2024-08-30)');
          return false;
        }

        return true;
      });
    } catch (err) {
      logger.debug(`Parsing timestampArrayString ${timestampArrayString} failed: ${err.message}`);
      return false;
    }
  }
}
