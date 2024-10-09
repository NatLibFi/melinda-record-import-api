import {expect} from 'chai';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import generateTests from '@natlibfi/fixugen';

import blobsFactory from './blobs';


describe('interfaces/blobs', () => {
  let mongoFixtures; // eslint-disable-line functional/no-let

  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'remove'],
    recurse: false,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: true,
      reader: READERS.JSON
    },
    mocha: {
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
      rootPath: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'remove'],
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
      expect(dump.blobmetadatas).to.eql(expectedDatabaseState);
      expect(expectToFail, 'This is expected to succes').to.equal(false);
    } catch (error) {
      if (!expectToFail) { // eslint-disable-line functional/no-conditional-statements
        if (error.status && error.payload) { // eslint-disable-line functional/no-conditional-statements
          console.log(`*** ERROR: Status: ${error.status}, message: ${error.payload} ***`); // eslint-disable-line
        }
        throw error;
      }
      // console.log(error); // eslint-disable-line
      expect(expectToFail, 'This is expected to fail').to.equal(true);
      expect(error.status).to.equal(expectedFailStatus);
    }
  }
});
