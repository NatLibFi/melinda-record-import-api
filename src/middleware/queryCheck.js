import httpStatus from 'http-status';
import {createLogger} from '@natlibfi/melinda-backend-commons';
import {version as uuidVersion, validate as uuidValidate} from 'uuid';
import {BLOB_STATE} from '@natlibfi/melinda-record-import-commons';

const logger = createLogger();

export function checkQueryParams(req, res, next) {
  const queryParams = req.query;

  /*
  Object.keys(queryParams).foreach(key => {
    if (['id', 'correlationId', 'profile', 'contentType', 'state', 'creationTime', 'modificationTime', 'skip', 'limit'].includes(key)) {
      logger.debug(queryParams[key]);
      return;
    }
    delete queryParams[key]; // eslint-disable-line functional/immutable-data
    return;
  });
  */

  req.query = queryParams; // eslint-disable-line
  logger.debug(`Checking query params: ${JSON.stringify(queryParams)}`);
  const failedParams = [
    {name: 'id', value: queryParams.id ? uuidValidate(queryParams.id) && uuidVersion(queryParams.id) === 4 : true},
    {name: 'correlationId', value: queryParams.correlationId ? uuidValidate(queryParams.correlationId) && uuidVersion(queryParams.correlationId) === 4 : true},
    {name: 'profile', value: queryParams.profile ? checkProfile(queryParams.profile) : true},
    {name: 'contentType', value: queryParams.contentType ? (/^(?:[-.\w/]{1,30})$/iu).test(queryParams.contentType) : true},
    {name: 'state', value: queryParams.state ? checkState(queryParams.state) : true},
    {name: 'creationTime', value: queryParams.creationTime ? checkTimeFormat(queryParams.creationTime) : true},
    {name: 'modificationTime', value: queryParams.modificationTime ? checkTimeFormat(queryParams.modificationTime) : true},
    {name: 'skip', value: queryParams.skip ? (/^\d{1,7}$/u).test(queryParams.skip) : true},
    {name: 'limit', value: queryParams.limit ? (/^\d{1,7}$/u).test(queryParams.limit) : true}
  ].filter(param => !param.value).map(param => param.name);

  if (failedParams.length === 0) {
    logger.debug('Query params OK');
    return next();
  }

  logger.error(`Failed query params: ${failedParams}`);
  //const combinedFailedParams = [...failedParams, ...nonCompatibleParams];
  return res.status(httpStatus.BAD_REQUEST).json({error: 'BAD query params', failedParams});

  function checkProfile(profile) {
    if ((/^(?:[-.\w/]{1,30})$/iu).test(profile)) {
      const {groups} = req.user.roles;
      if (profile.includes(',')) {
        const profileArray = profile.split(',');
        return profileArray.some(p => !groups.includes(p));
      }

      if (groups.includes(profile)) {
        return false;
      }

      return true;
    }

    return true;
  }

  function checkState(state) {
    if (state.includes(',')) { // eslint-disable-line functional/no-conditional-statements
      const stateArray = state.split(',');
      return stateArray.filter(singleState => !BLOB_STATE.includes(singleState)).length > 0;
    }

    if (Array.isArray(state)) {
      return state.filter(singleState => !BLOB_STATE.includes(singleState)).length > 0;
    }

    return !BLOB_STATE.includes(queryParams.state);
  }

  function checkTimeFormat(timestampArrayString) {
    logger.debug(`TimestampArrayString: ${timestampArrayString}`);
    try {
      // 2024-08-30T00:00:00.000Z or 2024-08-30T00:00:00.000Z,2024-08-31T00:00:00.000Z
      if ((/^(?:\d{4}-[01]{1}\d{1}-[0-3]{1}\d{1}T[0-2]{1}\d{1}:[0-6]{1}\d{1}:[0-6]{1}\d{1}\.\d{3}Z,?){1,2}$/u).test(timestampArrayString)) {
        logger.debug('timestamp UTC format OK (e.g. 2024-08-30T00:00:00.000Z)');
        return false;
      }

      // 2024-08-30 or 2024-08-30,2024-09-05
      if ((/^(?:\d{4}-[01]{1}\d{1}-[0-3]{1}\d{1},?){1,2}$/u).test(timestampArrayString)) {
        logger.debug('timestamp day format OK (e.g. 2024-08-30)');
        return false;
      }

      return true;
    } catch (err) {
      logger.debug(`Parsing timestampArrayString ${timestampArrayString} failed: ${err.message}`);
      return false;
    }
  }
}
