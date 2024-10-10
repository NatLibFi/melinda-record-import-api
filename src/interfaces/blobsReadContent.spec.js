import {expect} from 'chai';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import generateTests from '@natlibfi/fixugen';
import {Error as ApiError} from '@natlibfi/melinda-commons';

import blobsFactory from './blobs';


describe('interfaces/blobs', () => {
  let mongoFixtures; // eslint-disable-line functional/no-let

  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'readContent'],
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
      rootPath: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'readContent'],
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

      expect(contentType).to.eql(expectedContentType);
      expect(await getData(readStream)).to.equal(expectedContent);
      expect(expectToFail, 'This is expected to succes').to.equal(false);
    } catch (error) {
      if (!expectToFail) {
        throw error;
      }
      expect(expectToFail, 'This is expected to fail').to.equal(true);
      if (error.errmsg) {
        expect(error.errmsg.includes('FileNotFound')).to.equal(true);
        return;
      }
      expect(error).to.be.instanceOf(ApiError);
      expect(error.status).to.equal(expectedFailStatus);
    }

    function getData(stream) {
      return new Promise((resolve, reject) => {
        const chunks = [];

        stream
          .setEncoding('utf8')
          .on('error', reject)
          .on('data', chunk => chunks.push(chunk)) // eslint-disable-line functional/immutable-data
          .on('end', () => resolve(chunks.join('')));
      });
    }
  }
});
