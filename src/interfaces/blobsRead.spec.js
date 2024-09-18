import {expect} from 'chai';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import generateTests from '@natlibfi/fixugen';

import blobsFactory, {__RewireAPI__ as RewireAPI} from './blobs';
import {formatBlobMetadata} from './utils';

describe('interfaces/blobs', () => {
  let mongoFixtures; // eslint-disable-line functional/no-let

  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'read'],
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
        RewireAPI.__Rewire__('uuid', () => 'foo');
        await mongoFixtures.clear();
      },
      afterEach: async () => {
        RewireAPI.__ResetDependency__('uuid');
        await mongoFixtures.clear();
      },
      after: async () => {
        await mongoFixtures.close();
      }
    }
  });

  async function initMongofixtures() {
    mongoFixtures = await mongoFixturesFactory({
      rootPath: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'read'],
      gridFS: {bucketName: 'blobmetadatas'},
      useObjectId: true,
      format: {
        blobmetadatas: {
          creationTime: v => new Date(v),
          modificationTime: v => new Date(v)
        }
      }
    });
  }

  async function callback({
    getFixture,
    expectToFail = false,
    expectedFailStatus = ''
  }) {
    try {
      const MONGO_URI = await mongoFixtures.getUri();
      const expectedResults = getFixture('expectedResults.json');
      const user = getFixture('user.json');
      const dbContents = getFixture('dbContents.json');
      const blobs = await blobsFactory({MONGO_URI, MELINDA_API_OPTIONS: {}, BLOBS_QUERY_LIMIT: 100, MONGO_DB: ''});

      await mongoFixtures.populate(dbContents);

      const result = await blobs.read({id: 'foo', user});
      expect(formatBlobMetadata(result)).to.eql(expectedResults);
      expect(expectToFail, 'This is expected to succes').to.equal(false);
    } catch (error) {
      if (!expectToFail) { // eslint-disable-line
        throw error;
      }
      expect(expectToFail, 'This is expected to fail').to.equal(true);
      expect(error).to.be.instanceOf(ApiError);
      expect(error.status).to.equal(expectedFailStatus);
    }
  }
});
