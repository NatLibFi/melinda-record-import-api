// import {describe} from 'node:test';
import assert from 'node:assert';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import generateTests from '@natlibfi/fixugen';

import profilesFactory from './profiles.mjs';

let mongoFixtures;

generateTests({
  callback,
  path: [import.meta.dirname, '..', '..', 'test-fixtures', 'profiles', 'query'],
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
    rootPath: [import.meta.dirname, '..', '..', 'test-fixtures', 'profiles', 'query'],
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
    assert.deepStrictEqual(results, expectedResults);
    assert.equal(expectToFail, false, 'This is expected to succes');
  } catch (error) {
    if (!expectToFail) {
      throw error;
    }
    assert.equal(expectToFail, true, 'This is expected to fail');
    assert(error instanceof ApiError);
    assert.equal(error.status, expectedFailStatus);
  }
}
