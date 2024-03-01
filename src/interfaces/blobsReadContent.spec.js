import {expect} from 'chai';
import Mongoose from 'mongoose';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import generateTests from '@natlibfi/fixugen';
import {Error as ApiError} from '@natlibfi/melinda-commons';

import blobsFactory, {__RewireAPI__ as RewireAPI} from './blobs';


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
        mongoFixtures = await mongoFixturesFactory({
          rootPath: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'readContent'],
          gridFS: {bucketName: 'blobs'},
          useObjectId: true,
          format: {
            blobmetadatas: {
              creationTime: v => new Date(v),
              modificationTime: v => new Date(v)
            }
          }
        });
        Mongoose.set('strictQuery', true);
        await Mongoose.connect(await mongoFixtures.getUri(), {});
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
        await Mongoose.disconnect();
        await mongoFixtures.close();
      }
    }
  });

  async function callback({
    getFixture,
    expectToFail = false,
    expectedFailStatus = ''
  }) {
    try {
      const dbContents = getFixture('dbContents.json');
      const dbFiles = getFixture('dbFiles.json');
      const user = getFixture('user.json');
      const expectedContent = getFixture({components: ['expectedContent.txt'], reader: READERS.TEXT});
      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(dbContents);
      await mongoFixtures.populateFiles(dbFiles);

      const {contentType, readStream} = await blobs.readContent({id: 'foo', user});

      expect(contentType).to.equal(dbContents.blobmetadatas[0].contentType);
      expect(await getData(readStream)).to.equal(expectedContent);
      expect(expectToFail, 'This is expected to succes').to.equal(false);
    } catch (error) {
      if (!expectToFail) { // eslint-disable-line
        throw error;
      }
      expect(expectToFail, 'This is expected to fail').to.equal(true);
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
