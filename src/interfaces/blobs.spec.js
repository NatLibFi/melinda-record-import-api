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
import blobsFactory, {__RewireAPI__ as RewireAPI} from './blobs';
import {ApiError} from '@natlibfi/melinda-record-import-commons';
import fixtureFactory, {READERS} from '@natlibfi/fixura';
import mongoFixturesFactory from '@natlibfi/fixura-mongo';

describe('interfaces/blobs', () => {
  let mongoFixtures; // eslint-disable-line functional/no-let
  const {getFixture} = fixtureFactory({
    root: [__dirname, '..', '..', 'test-fixtures', 'blobs'],
    reader: READERS.JSON
  });

  beforeEach(async () => {
    RewireAPI.__Rewire__('uuid', () => 'foo');

    mongoFixtures = await mongoFixturesFactory({
      rootPath: [__dirname, '..', '..', 'test-fixtures', 'blobs'],
      gridFS: {bucketName: 'blobs'},
      useObjectId: true,
      format: {
        blobmetadatas: {
          creationTime: v => new Date(v),
          modificationTime: v => new Date(v)
        }
      }
    });

    await Mongoose.connect(await mongoFixtures.getConnectionString(), {useNewUrlParser: true});
  });

  afterEach(async () => {
    RewireAPI.__ResetDependency__('uuid');
    await Mongoose.disconnect();
    await mongoFixtures.close();
  });

  describe('#create', () => {
    it('Should create a new blob', async (index = '0') => {
      const dbContents = getFixture({components: ['create', index, 'dbContents.json']});
      const expectedDb = getFixture({components: ['create', index, 'expectedDb.json']});
      const inputStream = getFixture({components: ['create', index, 'payload.txt'], reader: READERS.STREAM});
      const user = getFixture({components: ['create', index, 'user.json']});
      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(dbContents);

      const id = await blobs.create({contentType: 'foo/bar', profile: 'foo', inputStream, user});
      const db = await mongoFixtures.dump();

      expect(id).to.equal('foo');
      expect(formatDump(db)).to.eql(expectedDb);
    });

    it('Should fail to create a new blob because of invalid profile', async (index = '1') => {
      const inputStream = getFixture({components: ['create', index, 'payload.txt'], reader: READERS.STREAM});
      const user = getFixture({components: ['create', index, 'user.json']});
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
      const dbContents = getFixture({components: ['create', index, 'dbContents.json']});
      const inputStream = getFixture({components: ['create', index, 'payload.txt'], reader: READERS.STREAM});
      const user = getFixture({components: ['create', index, 'user.json']});
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
      const payload = getFixture({components: ['update', index, 'payload.json']});
      const user = getFixture({components: ['update', index, 'user.json']});
      const blobs = blobsFactory({url: 'https://api'});

      try {
        await blobs.update({id: 'foo', payload, user});
        throw new Error('Should not succeed');
      } catch (err) {
        expect(err).to.be.instanceOf(ApiError);
        expect(err.status).to.equal(HttpStatus.NOT_FOUND);
      }
    });

    it('Should fail because of invalid syntax', () => testError({index: '1', status: HttpStatus.UNPROCESSABLE_ENTITY}));
    it('Should fail because of invalid syntax (Missing op)', () => testError({index: '2', status: HttpStatus.UNPROCESSABLE_ENTITY}));
    it('Should fail because of invalid permissions', () => testError({index: '3', status: HttpStatus.FORBIDDEN}));
    it('Should abort the processing', () => testUpdate('4'));
    it('Should set the transformation in progress ', () => testUpdate('5'));
    it('Should set the transformation as failed ', () => testUpdate('6'));
    it('Should set the transformation done', () => testUpdate('7'));
    it('Should set the transformation done (All records failed)', () => testUpdate('8'));
    it('Should set record as processed', () => testUpdate('9'));
    it('Should set blob as processed (All records processed)', () => testUpdate('10'));
    it('Should fail because current state doesn\'t allow updates', () => testError({index: '11', status: HttpStatus.CONFLICT}));
    it('Should fail because all records have been processed', () => testError({index: '12', status: HttpStatus.CONFLICT}));
    it('Should update blob state', () => testUpdate('13'));
    it('Should fail to update blob state because of invalid permissions', () => testError({index: '14', status: HttpStatus.FORBIDDEN}));
    it('Should add failed record to blobs failedRecords array', () => testUpdate('15'));
    it('Should increase numberOfRecords to blobs on succesfull record handling', () => testUpdate('16'));
    it('Should set CorrelationId', () => testUpdate('17'));

    async function testError({index, status}) {
      const dbContents = getFixture({components: ['update', index, 'dbContents.json']});
      const payload = getFixture({components: ['update', index, 'payload.json']});
      const user = getFixture({components: ['update', index, 'user.json']});
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
      const dbContents = getFixture({components: ['update', index, 'dbContents.json']});
      const expectedDb = getFixture({components: ['update', index, 'expectedDb.json']});
      const payload = getFixture({components: ['update', index, 'payload.json']});
      const user = getFixture({components: ['update', index, 'user.json']});
      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(dbContents);
      await blobs.update({id: 'foo', payload, user});

      const db = await mongoFixtures.dump();
      expect(formatDump(db)).to.eql(expectedDb);
    }
  });

  describe('#read', () => {
    it('Should succeed', async (index = '0') => {
      const dbContents = getFixture({components: ['read', index, 'dbContents.json']});
      const user = getFixture({components: ['read', index, 'user.json']});
      const expectedResults = getFixture({components: ['read', index, 'expectedResults.json']});
      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(dbContents);

      const result = await blobs.read({id: 'foo', user});
      expect(formatBlobMetadata(result)).to.eql(expectedResults);
    });

    it('Should fail because the blob doesn\'t exist', async (index = '1') => {
      const dbContents = getFixture({components: ['read', index, 'dbContents.json']});
      const user = getFixture({components: ['read', index, 'user.json']});
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
      const dbContents = getFixture({components: ['read', index, 'dbContents.json']});
      const user = getFixture({components: ['read', index, 'user.json']});
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
    beforeEach(() => {
      RewireAPI.__Rewire__('BLOBS_QUERY_LIMIT', 3);
    });

    afterEach(() => {
      RewireAPI.__ResetDependency__('BLOBS_QUERY_LIMIT');
    });

    it('Should return all blobs', () => test('0'));
    it('Should return only blobs that the user has access to', () => test('1'));
    it('Should return blobs using state filter', () => test('2', {state: ['ABORTED']}));
    it('Should return blobs using contentType filter', () => test('3', {contentType: ['foo/bar']}));
    it('Should return blobs using profile filter', () => test('4', {profile: ['foo']}));

    it('Should return blobs using creationTime filter', () => test('5', {creationTime: ['2000-01-01T00:00:00.000Z']}));
    it('Should return blobs using creationTime range filter', () => test('6', {
      creationTime: [
        '2000-01-01T00:00:00.000Z',
        '2000-01-02T00:00:00.000Z'
      ]
    }));

    it('Should return blobs using modificationTime filter', () => test('7', {modificationTime: ['2000-01-01T00:00:00.000Z']}));
    it('Should return blobs using modificationTime range filter', () => test('8', {
      modificationTime: [
        '2000-01-01T00:00:00.000Z',
        '2000-01-02T00:00:00.000Z'
      ]
    }));

    it('Should return blobs using multiple filters', () => test('9', {
      state: ['ABORTED'],
      modificationTime: [
        '2000-01-01T00:00:00.000Z',
        '2000-01-02T00:00:00.000Z'
      ]
    }));

    it('Should not find blobs using multiple filters', () => test('10', {
      state: ['ABORTED'],
      modificationTime: [
        '2000-01-01T00:00:00.000Z',
        '2000-01-02T00:00:00.000Z'
      ]
    }));

    it('Should return an incomplete set', async (index = '11') => {
      const user = getFixture({components: ['query', index, 'user.json']});
      const expectedResults = getFixture({components: ['query', index, 'expectedResults.json']});
      const expectedNextOffset = getFixture({components: ['query', index, 'expectedNextOffset.txt'], reader: READERS.TEXT});

      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(['query', index, 'dbContents.json']);

      const {nextOffset, results} = await blobs.query({user});

      expect(nextOffset).to.equal(expectedNextOffset);
      expect(formatResults(results)).to.eql(expectedResults);
    });

    it('Should return the results from the specified offset', async (index = '12') => {
      const user = getFixture({components: ['query', index, 'user.json']});
      const expectedResults = getFixture({components: ['query', index, 'expectedResults.json']});
      const queryOffset = getFixture({components: ['query', index, 'queryOffset.txt'], reader: READERS.TEXT});

      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(['query', index, 'dbContents.json']);

      const {nextOffset, results} = await blobs.query({user, offset: queryOffset});

      expect(nextOffset).to.equal(undefined);
      expect(formatResults(results)).to.eql(expectedResults);
    });

    function formatResults(results) {
      return results.map(result => {
        delete result.modificationTime; // eslint-disable-line functional/immutable-data
        delete result.creationTime; // eslint-disable-line functional/immutable-data
        return result;
      });
    }

    async function test(index, params = {}) {
      const user = getFixture({components: ['query', index, 'user.json']});
      const expectedResults = getFixture({components: ['query', index, 'expectedResults.json']});

      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(['query', index, 'dbContents.json']);

      const {results} = await blobs.query({user, ...params});
      expect(formatResults(results)).to.eql(expectedResults);
    }
  });

  describe('#remove', () => {
    it('Should succeed', async (index = '0') => {
      const dbContents = getFixture({components: ['remove', index, 'dbContents.json']});
      const user = getFixture({components: ['remove', index, 'user.json']});
      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(dbContents);
      await blobs.remove({id: 'foo', user});
    });

    it('Should fail because the blob doesn\'t exist', async (index = '1') => {
      const user = getFixture({components: ['remove', index, 'user.json']});
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
      const dbContents = getFixture({components: ['remove', index, 'dbContents.json']});
      const user = getFixture({components: ['remove', index, 'user.json']});
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
      const dbContents = getFixture({components: ['remove', index, 'dbContents.json']});
      const user = getFixture({components: ['remove', index, 'user.json']});
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
      const dbContents = getFixture({components: ['removeContent', index, 'dbContents.json']});
      const dbFiles = getFixture({components: ['removeContent', index, 'dbFiles.json']});
      const user = getFixture({components: ['removeContent', index, 'user.json']});
      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(dbContents);
      await mongoFixtures.populateFiles(dbFiles);

      await blobs.removeContent({id: 'foo', user});

      const files = await mongoFixtures.dumpFiles(true);
      expect(files).to.eql({});
    });

    it('Should fail because the blob doesn\'t exist', async (index = '1') => {
      const user = getFixture({components: ['removeContent', index, 'user.json']});
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
      const dbContents = getFixture({components: ['removeContent', index, 'dbContents.json']});
      const user = getFixture({components: ['removeContent', index, 'user.json']});
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
      const dbContents = getFixture({components: ['removeContent', index, 'dbContents.json']});
      const user = getFixture({components: ['removeContent', index, 'user.json']});
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
      const dbContents = getFixture({components: ['readContent', index, 'dbContents.json']});
      const dbFiles = getFixture({components: ['readContent', index, 'dbFiles.json']});
      const user = getFixture({components: ['readContent', index, 'user.json']});
      const expectedContent = getFixture({components: ['readContent', index, 'expectedContent.txt'], reader: READERS.TEXT});
      const blobs = blobsFactory({url: 'https://api'});

      await mongoFixtures.populate(dbContents);
      await mongoFixtures.populateFiles(dbFiles);

      const {contentType, readStream} = await blobs.readContent({id: 'foo', user});

      expect(contentType).to.equal(dbContents.blobmetadatas[0].contentType);
      expect(await getData(readStream)).to.equal(expectedContent);

      function getData(stream) {
        return new Promise((resolve, reject) => {
          const chunks = [];

          stream
            .setEncoding('utf8')
            .on('error', reject)
            .on('data', chunk => chunks.push(chunk)) // eslint-disable-line functional/immutable-data
            .on('end', () => resolve(chunks.join('')));
        });
      }
    });

    it('Should fail because the blob doesn\'t exist', async (index = '1') => {
      const user = getFixture({components: ['readContent', index, 'user.json']});
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
      const dbContents = getFixture({components: ['readContent', index, 'dbContents.json']});
      const user = getFixture({components: ['readContent', index, 'user.json']});
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
      const dbContents = getFixture({components: ['readContent', index, 'dbContents.json']});
      const user = getFixture({components: ['readContent', index, 'user.json']});
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
        delete doc[k]; // eslint-disable-line functional/immutable-data
      });
    });

    dump['blobs.files'].forEach(doc => {
      Object.keys(doc).filter(k => k !== 'filename').forEach(k => {
        delete doc[k]; // eslint-disable-line functional/immutable-data
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
        if (['_id', 'creationTime', 'modificationTime', 'creationTime', 'timestamp'].includes(key)) {
          return delete o[key]; // eslint-disable-line functional/immutable-data
        } else if (Array.isArray(o[key])) {
          return o[key].filter(v => typeof v === 'object').forEach(format);
        } else if (typeof o[key] === 'object') {
          return format(o[key]);
        }
      });
    }
  }
});
