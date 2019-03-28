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
import HttpStatus from 'http-status';
import Mongoose from 'mongoose';
import profilesFactory from './profiles';
import ApiError from '../error';
import fixtureFactory, {READERS} from '@natlibfi/fixura';
import mongoFixtureFactory from '@natlibfi/fixura-mongo';

describe('interfaces/profiles', async () => {
	let mongoFixtures;
	const {getFixture} = fixtureFactory({
		root: [__dirname, '..', '..', 'test-fixtures', 'profiles'],
		reader: READERS.JSON
	});

	beforeEach(async () => {
		mongoFixtures = await mongoFixtureFactory();
		Mongoose.connect(await mongoFixtures.getConnectionString(), {useNewUrlParser: true});
	});

	afterEach(async () => {
		await Mongoose.disconnect();
		await mongoFixtures.close();
	});

	describe('#createOrUpdate', () => {
		it('Should create a new profile', async (index = '0') => {
			const payload = getFixture(['createOrUpdate', index, 'payload.json']);
			const user = getFixture(['createOrUpdate', index, 'user.json']);
			const expectedDb = getFixture(['createOrUpdate', index, 'expectedDb.json']);
			const profiles = profilesFactory({url: 'https://api'});

			await profiles.createOrUpdate({id: 'foo', payload, user});

			const db = await mongoFixtures.dump();
			expect(db).to.eql(expectedDb);
		});

		it('Should fail to create a new because of invalid permissions', async (index = '1') => {
			const payload = getFixture(['createOrUpdate', index, 'payload.json']);
			const user = getFixture(['createOrUpdate', index, 'user.json']);

			const profiles = profilesFactory({url: 'https://api'});
			try {
				await profiles.createOrUpdate({id: 'foo', payload, user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceof(ApiError);
				expect(err.status).to.equal(HttpStatus.FORBIDDEN);
			}
		});

		it('Should fail to create a new profile because of invalid syntax', async (index = '2') => {
			const payload = getFixture(['createOrUpdate', index, 'payload.json']);
			const user = getFixture(['createOrUpdate', index, 'user.json']);
			const profiles = profilesFactory({url: 'https://api'});

			try {
				await profiles.createOrUpdate({id: 'foo', payload, user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceof(ApiError);
				expect(err.status).to.equal(HttpStatus.UNPROCESSABLE_ENTITY);
			}
		});

		it('Should update a profile', async (index = '3') => {
			const createPayload = getFixture(['createOrUpdate', index, 'createPayload.json']);
			const updatePayload = getFixture(['createOrUpdate', index, 'updatePayload.json']);
			const user = getFixture(['createOrUpdate', index, 'user.json']);
			const expectedDb = getFixture(['createOrUpdate', index, 'expectedDb.json']);

			const profiles = profilesFactory({url: 'https://api'});

			await profiles.createOrUpdate({id: 'foo', payload: createPayload, user});
			await profiles.createOrUpdate({id: 'foo', payload: updatePayload, user});

			const db = await mongoFixtures.dump();
			expect(db).to.eql(expectedDb);
		});
	});

	describe('#read', () => {
		it('Should read a profile', async (index = '0') => {
			const dbContents = getFixture(['read', index, 'dbContents.json']);
			const expectedProfile = getFixture(['read', index, 'expectedProfile.json']);
			const user = getFixture(['read', index, 'user.json']);
			const profiles = profilesFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			const profile = await profiles.read({id: 'foo', user});
			expect(profile).to.eql(expectedProfile);
		});

		it('Should fail to read a profile because it doesn\'t exist', async (index = '1') => {
			const user = getFixture(['read', index, 'user.json']);
			const profiles = profilesFactory({url: 'https://api'});

			try {
				await profiles.read({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.an.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.NOT_FOUND);
			}
		});

		it('Should fail to read a profile because of invalid permissions', async (index = '2') => {
			const dbContents = getFixture(['read', index, 'dbContents.json']);
			const user = getFixture(['read', index, 'user.json']);
			const profiles = profilesFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await profiles.read({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.an.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.FORBIDDEN);
			}
		});
	});

	describe('#remove', () => {
		it('Should remove a profile', async (index = '0') => {
			const dbContents = getFixture(['remove', index, 'dbContents.json']);
			const expectedDb = getFixture(['remove', index, 'expectedDb.json']);
			const user = getFixture(['remove', index, 'user.json']);
			const profiles = profilesFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);
			await profiles.remove({id: 'foo', user});

			const db = await mongoFixtures.dump();

			expect(db).to.eql(expectedDb);
		});

		it('Should fail to remove a profile because it doesn\'t exist', async (index = '1') => {
			const user = getFixture(['remove', index, 'user.json']);
			const profiles = profilesFactory({url: 'https://api'});

			try {
				await profiles.remove({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.an.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.NOT_FOUND);
			}
		});

		it('Should fail to remove a profile because of invalid permissions', async (index = '2') => {
			const dbContents = getFixture(['remove', index, 'dbContents.json']);
			const user = getFixture(['remove', index, 'user.json']);
			const profiles = profilesFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await profiles.remove({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.an.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.FORBIDDEN);
			}
		});
	});

	describe('#query', () => {
		it('Should return an empty list', async (index = '0') => {
			const expectedResults = getFixture(['query', index, 'results.json']);
			const profiles = profilesFactory({url: 'https://api'});
			const results = await profiles.query({user: {}});
			expect(results).to.eql(expectedResults);
		});

		it('Should return a list of profiles', async (index = '1') => {
			const dbContents = getFixture(['query', index, 'dbContents.json']);
			const user = getFixture(['query', index, 'user.json']);
			const expectedResults = getFixture(['query', index, 'results.json']);
			const profiles = profilesFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			const results = await profiles.query({user});
			expect(results).to.eql(expectedResults);
		});

		it('Should return an empty list because of no permissions to read profiles', async (index = '2') => {
			const dbContents = getFixture(['query', index, 'dbContents.json']);
			const user = getFixture(['query', index, 'user.json']);
			const expectedResults = getFixture(['query', index, 'results.json']);
			const profiles = profilesFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			const results = await profiles.query({user});
			expect(results).to.eql(expectedResults);
		});
	});
});
