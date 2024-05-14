
import {expect} from 'chai';
import Mongoose from 'mongoose';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import generateTests from '@natlibfi/fixugen';

import blobsFactory, {__RewireAPI__ as RewireAPI} from './blobs';

describe('interfaces/blobs', () => {
  let mongoFixtures; // eslint-disable-line functional/no-let

  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'query'],
    recurse: false,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: true,
      reader: READERS.JSON
    },
    mocha: {
      before: async () => {
        mongoFixtures = await mongoFixturesFactory({
          rootPath: [__dirname, '..', '..', 'test-fixtures', 'blobs', 'query'],
          gridFS: {bucketName: 'blobs'},
          useObjectId: true,
          format: {
            blobmetadatas: {
              creationTime: v => new Date(v),
              modificationTime: v => new Date(v)
            }
          }
        });
        await Mongoose.connect(await mongoFixtures.getUri(), {useNewUrlParser: true});
      },
      beforeEach: async () => {
        RewireAPI.__Rewire__('uuid', () => 'foo');
        RewireAPI.__Rewire__('BLOBS_QUERY_LIMIT', 3);
        await mongoFixtures.clear();
      },
      afterEach: async () => {
        RewireAPI.__ResetDependency__('uuid');
        RewireAPI.__ResetDependency__('BLOBS_QUERY_LIMIT');
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
    params = {}
  }) {
    try {
      const user = getFixture('user.json');
      const expectedResults = getFixture('expectedResults.json');
      const dbContents = getFixture('dbContents.json');
      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(dbContents);

      const {results} = await blobs.query({user, ...params});
      expect(formatResults(results)).to.eql(expectedResults);
      expect(expectToFail, 'This is expected to succes').to.equal(false);
    } catch (error) {
      if (!expectToFail) { // eslint-disable-line
        throw error;
      }
      expect(expectToFail, 'This is expected to fail').to.equal(true);
    }

    function formatResults(results) {
      return results.map(result => {
        delete result.modificationTime; // eslint-disable-line functional/immutable-data
        delete result.creationTime; // eslint-disable-line functional/immutable-data
        return result;
      });
    }
  }
});
