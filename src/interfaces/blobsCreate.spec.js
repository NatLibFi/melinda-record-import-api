import {expect} from 'chai';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import generateTests from '@natlibfi/fixugen';

import blobsFactory, {__RewireAPI__ as RewireAPI} from './blobs';

describe('interfaces/blobs', () => {
  let mongoFixtures; // eslint-disable-line functional/no-let

  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'create'],
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
      rootPath: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'create'],
      gridFS: {bucketName: 'blobs'},
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
    loadExpectedDb,
    expectToFail = false,
    expectedFailStatus = ''
  }) {
    const MONGO_URI = await mongoFixtures.getUri();
    await mongoFixtures.populate(getFixture({components: ['dbContents.json'], reader: READERS.JSON}));
    const expectedDb = loadExpectedDb ? getFixture('expectedDb.json') : false;

    const inputStream = getFixture({components: ['payload.txt'], reader: READERS.STREAM});
    const user = getFixture('user.json');

    const blobs = await blobsFactory({MONGO_URI, MELINDA_API_OPTIONS: {}, BLOBS_QUERY_LIMIT: 100, MONGO_DB: ''});

    try {
      const id = await blobs.create({contentType: 'foo/bar', profile: 'foo', inputStream, date: new Date('2024-07-20'), user});
      const dump = dumpParser(await mongoFixtures.dump());

      expect(id).to.equal('foo');
      expect(dump.blobmetadatas).to.eql(expectedDb.blobmetadatas);
      expect(expectToFail, 'This is expected to succes').to.equal(false);
    } catch (error) {
      if (!expectToFail) { // eslint-disable-line
        throw error;
      }
      // console.log(error);  // eslint-disable-line
      expect(expectToFail, 'This is expected to fail').to.equal(true);
      expect(error).to.be.instanceOf(ApiError);
      expect(error.status).to.equal(expectedFailStatus);
    }

    function dumpParser(dump) {
      // Drop timestamps
      const blobmetadatas = dump.blobmetadatas.map(blobmetadata => {
        const {_id, modificationTime, creationTime, timestamp, ...rest} = blobmetadata; // eslint-disable-line no-unused-vars
        return rest;
      });

      return {
        blobmetadatas,
        'blobmetadatas.files': dump['blobmetadatas.files'].map(({filename}) => ({filename}))
      };
    }
  }
});
