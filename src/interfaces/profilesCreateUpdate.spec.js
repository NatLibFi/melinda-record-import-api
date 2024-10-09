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
    path: [__dirname, '..', '..', 'test-fixtures', 'profiles', 'createOrUpdate'],
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
      rootPath: [__dirname, '..', '..', 'test-fixtures', 'profiles', 'createOrUpdate'],
      useObjectId: true
    });
  }

  async function callback({
    getFixture,
    expectToFail = false,
    expectedFailStatus = '',
    update = false
  }) {
    try {
      const mongoUri = await mongoFixtures.getUri();
      const createPayload = getFixture('createPayload.json');
      const user = getFixture('user.json');
      const expectedDb = getFixture('expectedDb.json');
      const profiles = await profilesFactory({MONGO_URI: mongoUri, MONGO_DB: ''});

      await profiles.createOrUpdate({id: 'foo', payload: createPayload, user});

      if (update) { // eslint-disable-line functional/no-conditional-statements
        const updatePayload = getFixture('updatePayload.json');
        await profiles.createOrUpdate({id: 'foo', payload: updatePayload, user});
      }

      const db = await mongoFixtures.dump();
      expect(db.profiles).to.eql(expectedDb.profiles);
      expect(expectToFail, 'This is expected to succes').to.equal(false);
    } catch (error) {
      if (!expectToFail) {
        throw error;
      }
      // console.log(error); // eslint-disable-line
      expect(expectToFail, 'This is expected to fail').to.equal(true);
      expect(error).to.be.an.instanceOf(ApiError);
      expect(error.status).to.equal(expectedFailStatus);
    }
  }
});
