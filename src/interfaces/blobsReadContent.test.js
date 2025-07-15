import {describe} from 'node:test';
import assert from 'node:assert';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import generateTests from '@natlibfi/fixugen';
import {Error as ApiError} from '@natlibfi/melinda-commons';

import blobsFactory from './blobs.js';


describe('interfaces/blobs', () => {
  let mongoFixtures;

  generateTests({
    callback,
    path: [import.meta.dirname, '..', '..', 'test-fixtures', 'blobs', 'readContent'],
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
      rootPath: [import.meta.dirname, '..', '..', 'test-fixtures', 'blobs', 'readContent'],
      gridFS: {bucketName: 'blobmetadatas'},
      useObjectId: true
    });
  }

  async function callback({
    getFixture,
    expectedContentType = 'foo/bar',
    expectToFail = false,
    expectedFailStatus = ''
  }) {
    try {
      const MONGO_URI = await mongoFixtures.getUri();
      const dbContents = getFixture('dbContents.json');
      const dbFiles = getFixture('dbFiles.json');
      const user = getFixture('user.json');
      const expectedContent = getFixture({components: ['expectedContent.txt'], reader: READERS.TEXT});
      const blobs = await blobsFactory({MONGO_URI, MELINDA_API_OPTIONS: {}, BLOBS_QUERY_LIMIT: 100, MONGO_DB: ''});

      await mongoFixtures.populate(dbContents);
      await mongoFixtures.populateFiles(dbFiles);

      const {contentType, readStream} = await blobs.readContent({id: 'foo', user});

      assert.equal(contentType, expectedContentType);
      assert.deepStrictEqual(await getData(readStream), expectedContent);
      assert.equal(expectToFail, false, 'This is expected to succes');
    } catch (error) {
      if (!expectToFail) {
        throw error;
      }
      assert.equal(expectToFail, true, 'This is expected to fail');
      if (error.errmsg) {
        assert.equal(error.errmsg.includes('FileNotFound'), true);
        return;
      }
      assert(error instanceof ApiError);
      assert.equal(error.status, expectedFailStatus);
    }

    function getData(stream) {
      return new Promise((resolve, reject) => {
        const chunks = [];

        stream
          .setEncoding('utf8')
          .on('error', reject)
          .on('data', chunk => chunks.push(chunk))
          .on('end', () => resolve(chunks.join('')));
      });
    }
  }
});
