import {describe} from 'node:test';
import assert from 'node:assert';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import generateTests from '@natlibfi/fixugen';

import profilesFactory from './profiles.mjs';

describe('interfaces/profiles', () => {
  let mongoFixtures;

  generateTests({
    callback,
    path: [import.meta.dirname, '..', '..', 'test-fixtures', 'profiles', 'createOrUpdate'],
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
      rootPath: [import.meta.dirname, '..', '..', 'test-fixtures', 'profiles', 'createOrUpdate'],
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

      if (update) {
        const updatePayload = getFixture('updatePayload.json');
        await profiles.createOrUpdate({id: 'foo', payload: updatePayload, user});
      }

      const db = await mongoFixtures.dump();
      assert.deepStrictEqual(db.profiles, expectedDb.profiles);
      assert.equal(expectToFail, false, 'This is expected to succes');
    } catch (error) {
      if (!expectToFail) {
        throw error;
      }
      // console.log(error); // eslint-disable-line
      assert.equal(expectToFail, true, 'This is expected to fail');
      assert(error instanceof ApiError);
      assert.equal(error.status, expectedFailStatus);
    }
  }
});
