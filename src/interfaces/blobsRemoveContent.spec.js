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
    path: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'removeContent'],
    recurse: false,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: true,
      reader: READERS.JSON
    },
    mocha: {
      before: async () => {
        mongoFixtures = await mongoFixturesFactory({
          rootPath: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'removeContent'],
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
      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(dbContents);
      await mongoFixtures.populateFiles(dbFiles);

      await blobs.removeContent({id: 'foo', user});

      const files = await mongoFixtures.dumpFiles(true);
      expect(files).to.eql({});
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
