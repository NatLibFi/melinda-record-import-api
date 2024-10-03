import {expect} from 'chai';
import {READERS} from '@natlibfi/fixura';
import generateTests from '@natlibfi/fixugen';

import {validateQueryParams} from './queryCheck';

describe('interfaces/blobs', () => {
  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'queryCheck'],
    recurse: false,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: true,
      reader: READERS.JSON
    }
  });

  function callback({
    getFixture, // eslint-disable-line
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

      expect(failedParams).to.eql(expectedFailedParams);
      expect(expectToFail, 'This is expected to succes').to.equal(false);
    } catch (error) {
      if (!expectToFail) { // eslint-disable-line
        throw error;
      }
      console.log(error); // eslint-disable-line
      expect(expectToFail, 'This is expected to fail').to.equal(true);
      expect(error.status).to.equal(expectedFailStatus);
    }
  }
});
