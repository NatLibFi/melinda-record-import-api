/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file.
*
* API microservice of Melinda record batch import system
*
* Copyright (C) 2018-2019 University Of Helsinki (The National Library Of Finland)
*
* This file is part of melinda-record-import-api
*
* melinda-record-import-api program is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as
* published by the Free Software Foundation, either version 3 of the
* License, or (at your option) any later version.
*
* melinda-record-import-api is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*
* @licend  The above is the entire license notice
* for the JavaScript code in this file.
*
*/

import {expect} from 'chai';
import Mongoose from 'mongoose';
import {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';
import {Error as ApiError} from '@natlibfi/melinda-commons';
import generateTests from '@natlibfi/fixugen';

import profilesFactory from './profiles';

describe('interfaces/profiles', () => {
  let mongoFixtures; // eslint-disable-line functional/no-let

  generateTests({
    callback,
    path: [__dirname, '..', '..', 'test-fixtures', 'profiles', 'read'],
    recurse: false,
    useMetadataFile: true,
    fixura: {
      failWhenNotFound: true,
      reader: READERS.JSON
    },
    mocha: {
      before: async () => {
        mongoFixtures = await mongoFixturesFactory({
          rootPath: [__dirname, '..', '..', 'test-fixtures', 'profiles', 'read'],
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
        await mongoFixtures.clear();
      },
      afterEach: async () => {
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
      const expectedProfile = getFixture('expectedProfile.json');
      const user = getFixture('user.json');
      const profiles = profilesFactory({url: 'https://api'});

      await mongoFixtures.populate(dbContents);

      const profile = await profiles.read({id: 'foo', user});
      expect(profile).to.eql(expectedProfile);
      expect(expectToFail, 'This is expected to succes').to.equal(false);
    } catch (error) {
      if (!expectToFail) { // eslint-disable-line
        throw error;
      }
      expect(expectToFail, 'This is expected to fail').to.equal(true);
      expect(error).to.be.an.instanceOf(ApiError);
      expect(error.status).to.equal(expectedFailStatus);
    }
  }
});
