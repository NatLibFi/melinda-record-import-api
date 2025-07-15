import {describe} from 'node:test';
import assert from 'node:assert';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import generateTests from '@natlibfi/fixugen';

import blobsFactory from './blobs.js';


describe('interfaces/blobs', () => {
  let mongoFixtures;

  generateTests({
    callback,
    path: [import.meta.dirname, '..', '..', 'test-fixtures', 'blobs', 'remove'],
    recurse: false,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: true,
      reader: READERS.JSON
    },
    hooks: {
      before: async () => {
        await initMongofixtures();
      },
      beforeEach: async () => {
        await mongoFixtures.clear();
      },
      afterEach: async () => {
        await mongoFixtures.clear();
      },
      after: async () => {
        await mongoFixtures.close();
      }
    }
  });

  async function initMongofixtures() {
    mongoFixtures = await mongoFixturesFactory({
      rootPath: [import.meta.dirname, '..', '..', 'test-fixtures', 'blobs', 'remove'],
      gridFS: {bucketName: 'blobmetadatas'},
      useObjectId: true
    });
  }

  async function callback({
    getFixture,
    expectToFail = false,
    expectedFailStatus = ''
  }) {
    try {
      const MONGO_URI = await mongoFixtures.getUri();
      const dbContents = getFixture('dbContents.json');
      const user = getFixture('user.json');
      const expectedDatabaseState = getFixture('expectedDatabaseState.json');
      const blobs = await blobsFactory({MONGO_URI, MELINDA_API_OPTIONS: {}, BLOBS_QUERY_LIMIT: 100, MONGO_DB: ''});

      await mongoFixtures.populate(dbContents);

      await blobs.remove({id: 'foo', user});
      const dump = await mongoFixtures.dump();
      assert.deepStrictEqual(dump.blobmetadatas, expectedDatabaseState);
      assert.equal(expectToFail, false, 'This is expected to succes');
    } catch (error) {
      if (!expectToFail) {
        if (error.status && error.payload) {
          console.log(`*** ERROR: Status: ${error.status}, message: ${error.payload} ***`);
        }
        throw error;
      }
      // console.log(error); // eslint-disable-line
      assert.equal(expectToFail, true, 'This is expected to fail');
      assert.equal(error.status, expectedFailStatus);
    }
  }
});
