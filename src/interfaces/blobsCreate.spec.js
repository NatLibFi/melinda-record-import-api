import {expect} from 'chai';
import Mongoose from 'mongoose';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import generateTests from '@natlibfi/fixugen';

import blobsFactory, {__RewireAPI__ as RewireAPI} from './blobs';
import {formatDump} from './utils';

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
    loadDbContents,
    loadExpectedDb,
    expectToFail = false,
    expectedFailStatus = ''
  }) {
    const expectedDb = loadExpectedDb ? getFixture('expectedDb.json') : false;
    const inputStream = getFixture({components: ['payload.txt'], reader: READERS.STREAM});
    const user = getFixture('user.json');
    const blobs = blobsFactory({url: 'https://api'});
    await populateDB();

    try {
      const id = await blobs.create({contentType: 'foo/bar', profile: 'foo', inputStream, user});
      const db = await mongoFixtures.dump();
      const formatedDump = formatDump(db);

      expect(id).to.equal('foo');
      expect(formatedDump.blobmetadatas).to.eql(expectedDb.blobmetadatas);
      expect(expectToFail, 'This is expected to succes').to.equal(false);
    } catch (error) {
      if (!expectToFail) { // eslint-disable-line
        throw error;
      }
      expect(expectToFail, 'This is expected to fail').to.equal(true);
      expect(error).to.be.instanceOf(ApiError);
      expect(error.status).to.equal(expectedFailStatus);
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
