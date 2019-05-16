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
import blobsFactory, {__RewireAPI__ as RewireAPI} from './blobs'; // eslint-disable-line import/named
import {ApiError} from '@natlibfi/melinda-record-import-commons';
import fixtureFactory, {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';

describe('interfaces/blobs', () => {
	let mongoFixtures;
	const {getFixture} = fixtureFactory({
		root: [__dirname, '..', '..', 'test-fixtures', 'blobs'],
		reader: READERS.JSON
	});

	beforeEach(async () => {
		RewireAPI.__Rewire__('uuid', () => 'foo');
		mongoFixtures = await mongoFixturesFactory({gridFS: {bucketName: 'blobs'}});
		await Mongoose.connect(await mongoFixtures.getConnectionString(), {useNewUrlParser: true});
	});

	afterEach(async () => {
		RewireAPI.__ResetDependency__('uuid');
		await Mongoose.disconnect();
		await mongoFixtures.close();
	});

	describe('#create', () => {
		it('Should create a new blob', async (index = '0') => {
			const dbContents = getFixture(['create', index, 'dbContents.json']);
			const expectedDb = getFixture(['create', index, 'expectedDb.json']);
			const inputStream = getFixture({components: ['create', index, 'payload.txt'], reader: READERS.STREAM});
			const user = getFixture(['create', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			const id = await blobs.create({contentType: 'foo/bar', profile: 'foo', inputStream, user});
			const db = await mongoFixtures.dump();

			expect(id).to.equal('foo');
			expect(formatDump(db)).to.eql(expectedDb);
		});

		it('Should fail to create a new blob because of invalid profile', async (index = '1') => {
			const inputStream = getFixture({components: ['create', index, 'payload.txt'], reader: READERS.STREAM});
			const user = getFixture(['create', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			try {
				await blobs.create({contentType: 'foo/bar', profile: 'foo', inputStream, user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.BAD_REQUEST);
			}
		});

		it('Should fail to create a new blob because of invalid permissions', async (index = '2') => {
			const dbContents = getFixture(['create', index, 'dbContents.json']);
			const inputStream = getFixture({components: ['create', index, 'payload.txt'], reader: READERS.STREAM});
			const user = getFixture(['create', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await blobs.create({contentType: 'foo/bar', profile: 'foo', inputStream, user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.FORBIDDEN);
			}
		});
	});

	describe('#update', () => {
		it('Should fail because the blob doesn\'t exist', async (index = '0') => {
			const payload = getFixture(['update', index, 'payload.json']);
			const user = getFixture(['update', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			try {
				await blobs.update({id: 'foo', payload, user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.NOT_FOUND);
			}
		});

		it('Should fail because of invalid syntax', async () => testError({index: '1', status: HttpStatus.UNPROCESSABLE_ENTITY}));
		it('Should fail because of invalid syntax (Missing op)', async () => testError({index: '2', status: HttpStatus.UNPROCESSABLE_ENTITY}));
		it('Should fail because of invalid permissions', async () => testError({index: '3', status: HttpStatus.FORBIDDEN}));

		it('Should abort the processing', async () => testUpdate('4'));
		it('Should set the transformation in progress ', async () => testUpdate('5'));
		it('Should set the transformation as failed ', async () => testUpdate('6'));
		it('Should set the transformation done', async () => testUpdate('7'));
		it('Should set the transformation done (All records failed)', async () => testUpdate('8'));
		it('Should set record as processed', async () => testUpdate('9'));
		it('Should set blob as processed (All records processed)', async () => testUpdate('10'));
		it('Should fail because current state doesn\'t allow updates', async () => testError({index: '11', status: HttpStatus.CONFLICT}));

		async function testError({index, status}) {
			const dbContents = getFixture(['update', index, 'dbContents.json']);
			const payload = getFixture(['update', index, 'payload.json']);
			const user = getFixture(['update', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await blobs.update({id: 'foo', payload, user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(status);
			}
		}

		async function testUpdate(index) {
			const dbContents = getFixture(['update', index, 'dbContents.json']);
			const expectedDb = getFixture(['update', index, 'expectedDb.json']);
			const payload = getFixture(['update', index, 'payload.json']);
			const user = getFixture(['update', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);
			await blobs.update({id: 'foo', payload, user});

			const db = await mongoFixtures.dump();
			expect(formatDump(db)).to.eql(expectedDb);
		}
	});

	describe('#read', () => {
		it('Should succeed', async (index = '0') => {
			const dbContents = getFixture(['read', index, 'dbContents.json']);
			const user = getFixture(['read', index, 'user.json']);
			const expectedResults = getFixture(['read', index, 'expectedResults.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			const result = await blobs.read({id: 'foo', user});
			expect(formatBlobMetadata(result)).to.eql(expectedResults);
		});

		it('Should fail because the blob doesn\'t exist', async (index = '1') => {
			const dbContents = getFixture(['read', index, 'dbContents.json']);
			const user = getFixture(['read', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await blobs.read({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.NOT_FOUND);
			}
		});

		it('Should fail because of invalid permissions', async (index = '2') => {
			const dbContents = getFixture(['read', index, 'dbContents.json']);
			const user = getFixture(['read', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await blobs.read({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.FORBIDDEN);
			}
		});
	});

	describe('#query', () => {
		it('Should return all blobs', async () => test('0'));
		it('Should return only blobs that the user has access to', async () => test('1'));
		it('Should return blobs using state filter', async () => test('2', {state: ['ABORTED']}));
		it('Should return blobs using contentType filter', async () => test('3', {contentType: ['foo/bar']}));
		it('Should return blobs using profile filter', async () => test('4', {profile: ['foo']}));

		it('Should return blobs using creationTime filter', async () => test('5', {creationTime: ['2000-01-01T00:00:00.000Z']}));
		it('Should return blobs using creationTime range filter', async () => test('6', {
			creationTime: [
				'2000-01-01T00:00:00.000Z',
				'2000-01-02T00:00:00.000Z'
			]
		}));

		it('Should return blobs using modificationTime filter', async () => test('7', {modificationTime: ['2000-01-01T00:00:00.000Z']}));
		it('Should return blobs using modificationTime range filter', async () => test('8', {
			modificationTime: [
				'2000-01-01T00:00:00.000Z',
				'2000-01-02T00:00:00.000Z'
			]
		}));

		it('Should return blobs using multiple filters', async () => test('9', {
			state: ['ABORTED'],
			modificationTime: [
				'2000-01-01T00:00:00.000Z',
				'2000-01-02T00:00:00.000Z'
			]
		}));

		it('Should not find blobs using multiple filters', async () => test('10', {
			state: ['ABORTED'],
			modificationTime: [
				'2000-01-01T00:00:00.000Z',
				'2000-01-02T00:00:00.000Z'
			]
		}));

		async function test(index, params = {}) {
			const dbContents = getFixture(['query', index, 'dbContents.json']);
			const user = getFixture(['query', index, 'user.json']);
			const expectedResults = getFixture(['query', index, 'expectedResults.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			const results = await blobs.query({user, ...params});
			expect(results).to.eql(expectedResults);
		}
	});

	describe('#remove', () => {
		it('Should succeed', async (index = '0') => {
			const dbContents = getFixture(['remove', index, 'dbContents.json']);
			const user = getFixture(['remove', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);
			await blobs.remove({id: 'foo', user});
		});

		it('Should fail because the blob doesn\'t exist', async (index = '1') => {
			const user = getFixture(['remove', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			try {
				await blobs.remove({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.NOT_FOUND);
			}
		});

		it('Should fail because of invalid permissions', async (index = '2') => {
			const dbContents = getFixture(['remove', index, 'dbContents.json']);
			const user = getFixture(['remove', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await blobs.remove({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.FORBIDDEN);
			}
		});

		it('Should fail because content still exists', async (index = '3') => {
			const dbContents = getFixture(['remove', index, 'dbContents.json']);
			const user = getFixture(['remove', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await blobs.remove({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.BAD_REQUEST);
			}
		});
	});

	describe('#removeContent', () => {
		it('Should succeed', async (index = '0') => {
			const dbContents = getFixture(['removeContent', index, 'dbContents.json']);
			const dbFiles = getFixture(['removeContent', index, 'dbFiles.json']);
			const user = getFixture(['removeContent', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);
			await mongoFixtures.populateFiles(dbFiles);

			await blobs.removeContent({id: 'foo', user});

			const files = await mongoFixtures.dumpFiles(true);
			expect(files).to.eql({});
		});

		it('Should fail because the blob doesn\'t exist', async (index = '1') => {
			const user = getFixture(['removeContent', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			try {
				await blobs.removeContent({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.NOT_FOUND);
			}
		});

		it('Should fail because of invalid permissions', async (index = '2') => {
			const dbContents = getFixture(['removeContent', index, 'dbContents.json']);
			const user = getFixture(['removeContent', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await blobs.removeContent({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.FORBIDDEN);
			}
		});

		it('Should fail because the blob content has already been removed', async (index = '3') => {
			const dbContents = getFixture(['removeContent', index, 'dbContents.json']);
			const user = getFixture(['removeContent', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await blobs.removeContent({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.NOT_FOUND);
				expect(await mongoFixtures.dump()).to.eql(dbContents);
			}
		});
	});

	describe('#readContent', () => {
		it('Should succeed', async (index = '0') => {
			const dbContents = getFixture(['readContent', index, 'dbContents.json']);
			const dbFiles = getFixture(['readContent', index, 'dbFiles.json']);
			const user = getFixture(['readContent', index, 'user.json']);
			const expectedContent = getFixture({components: ['readContent', index, 'expectedContent.txt'], reader: READERS.TEXT});
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);
			await mongoFixtures.populateFiles(dbFiles);

			const {contentType, readStream} = await blobs.readContent({id: 'foo', user});

			expect(contentType).to.equal(dbContents.blobmetadatas[0].contentType);
			expect(await getData(readStream)).to.equal(expectedContent);

			async function getData(stream) {
				return new Promise((resolve, reject) => {
					const chunks = [];

					stream
						.setEncoding('utf8')
						.on('error', reject)
						.on('data', chunk => chunks.push(chunk))
						.on('end', () => resolve(chunks.join('')));
				});
			}
		});

		it('Should fail because the blob doesn\'t exist', async (index = '1') => {
			const user = getFixture(['readContent', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			try {
				await blobs.readContent({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.NOT_FOUND);
			}
		});

		it('Should fail because of invalid permissions', async (index = '2') => {
			const dbContents = getFixture(['readContent', index, 'dbContents.json']);
			const user = getFixture(['readContent', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await blobs.readContent({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.FORBIDDEN);
			}
		});

		it('Should fail because the blob content has been removed', async (index = '3') => {
			const dbContents = getFixture(['readContent', index, 'dbContents.json']);
			const user = getFixture(['readContent', index, 'user.json']);
			const blobs = blobsFactory({url: 'https://api'});

			await mongoFixtures.populate(dbContents);

			try {
				await blobs.readContent({id: 'foo', user});
				throw new Error('Should not succeed');
			} catch (err) {
				expect(err).to.be.instanceOf(ApiError);
				expect(err.status).to.equal(HttpStatus.NOT_FOUND);
			}
		});
	});

	// Remove properties we cannot have expectations for
	function formatDump(dump) {
		dump['blobs.chunks'].forEach(doc => {
			Object.keys(doc).forEach(k => {
				delete doc[k];
			});
		});

		dump['blobs.files'].forEach(doc => {
			Object.keys(doc).filter(k => k !== 'filename').forEach(k => {
				delete doc[k];
			});
		});

		dump.blobmetadatas.forEach(formatBlobMetadata);

		return dump;
	}

	function formatBlobMetadata(doc) {
		format(doc);
		return doc;

		function format(o) {
			Object.keys(o).forEach(key => {
				if (['_id', 'creationTime', 'modificationTime', 'creationTime'].includes(key)) {
					delete o[key];
				} else if (Array.isArray(o[key])) {
					o[key].filter(v => typeof v === 'object').forEach(format);
				} else if (typeof o[key] === 'object') {
					format(o[key]);
				}
			});
		}
	}
});
