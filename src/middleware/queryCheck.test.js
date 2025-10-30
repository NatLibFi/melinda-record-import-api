import {describe} from 'node:test';
import assert from 'node:assert';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

import {validateQueryParams} from './queryCheck.js';

describe('middleware', () => {
  generateTests({
    callback,
    path: [import.meta.dirname, '..', '..', 'test-fixtures', 'queryCheck'],
    recurse: false,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: true,
      reader: READERS.JSON
    }
  });

  function callback({
    getFixture,
    query,
    groups = [],
    expectedFailedParams = [],
    expectToFail = false,
    expectedFailStatus = 200
  }) {
    try {
      // console.log(query); // eslint-disable-line
      // console.log(groups); // eslint-disable-line
      const failedParams = validateQueryParams(query, groups);

      assert.deepStrictEqual(failedParams, expectedFailedParams);
      assert.equal(expectToFail, false, 'This is expected to succes');
    } catch (error) {
      if (!expectToFail) {
        throw error;
      }
      // console.log(error); // eslint-disable-line
      assert.equal(expectToFail, true, 'This is expected to fail');
      assert.equal(error.status, expectedFailStatus);
    }
  }
});
