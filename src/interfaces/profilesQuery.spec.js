import {expect} from 'chai';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import generateTests from '@natlibfi/fixugen';

import profilesFactory from './profiles';

describe('interfaces/profiles', () => {
  let mongoFixtures; // eslint-disable-line functional/no-let

  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'profiles', 'query'],
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
      rootPath: [__dirname, '..', '..', 'test-fixtures', 'profiles', 'query'],
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
      const mongoUri = await mongoFixtures.getUri();
      const dbContents = getFixture('dbContents.json');
      const user = getFixture('user.json');
      const expectedResults = getFixture('results.json');
      const profiles = await profilesFactory({MONGO_URI: mongoUri, MONGO_DB: ''});

      await mongoFixtures.populate(dbContents);

      const results = await profiles.query({user});
      expect(results).to.eql(expectedResults);
      expect(expectToFail, 'This is expected to succes').to.equal(false);
    } catch (error) {
      if (!expectToFail) {
        throw error;
      }
      expect(expectToFail, 'This is expected to fail').to.equal(true);
      expect(error).to.be.an.instanceOf(ApiError);
      expect(error.status).to.equal(expectedFailStatus);
    }
  }
});
