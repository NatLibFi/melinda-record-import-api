import {describe} from 'node:test';
import assert from 'node:assert';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import generateTests from '@natlibfi/fixugen';

import blobsFactory from './blobs.js';
import {formatDump} from './utils.js';


describe('interfaces/blobs', () => {
  let mongoFixtures;

  generateTests({
    callback,
    path: [import.meta.dirname, '..', '..', 'test-fixtures', 'blobs', 'update'],
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
      rootPath: [import.meta.dirname, '..', '..', 'test-fixtures', 'blobs', 'update'],
      gridFS: {bucketName: 'blobmetadatas'},
      useObjectId: true
    });
  }

  async function callback({
    getFixture,
    loadDbContents = true,
    expectToFail = false,
    expectedFailStatus = ''
  }) {
    try {
      const MONGO_URI = await mongoFixtures.getUri();
      const expectedDb = getFixture('expectedDb.json');
      const payload = getFixture('payload.json');
      const user = getFixture('user.json');
      const blobs = await blobsFactory({MONGO_URI, MELINDA_API_OPTIONS: {}, BLOBS_QUERY_LIMIT: 100, MONGO_DB: ''});
      await populateDB();

      await blobs.update({id: 'foo', payload, user});

      const db = await mongoFixtures.dump();
      const formatedDump = formatDump(db);

      assert.deepStrictEqual(formatedDump.blobmetadatas, expectedDb.blobmetadatas);
      assert.equal(expectToFail, false, 'This is expected to succes');
    } catch (error) {
      if (!expectToFail) {
        throw error;
      }
      //console.log(error); // eslint-disable-line
      assert.equal(expectToFail, true, 'This is expected to fail');
      assert.equal(error.status, expectedFailStatus);
    }

    async function populateDB() {
      if (loadDbContents) {
        const dbContents = getFixture('dbContents.json');
        await mongoFixtures.populate(dbContents);
        return;
      }

      return;
    }
  }
});
