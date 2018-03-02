/**
*
* @licstart  The following is the entire license notice for the JavaScript code in this file. 
*
* API microservice of Melinda record batch import system
*
* Copyright (C) 2018 University Of Helsinki (The National Library Of Finland)
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

/* eslint-disable no-undef, max-nested-callbacks, no-unused-expressions */

'use strict';

const chai = require('chai')
const should = chai.should();
const app = require('../index');
const httpMocks = require('node-mocks-http');
const mongoose = require('mongoose'),    
      config = require('../config');

const blobs = require('../controllers/blobs');
const profiles = require('../controllers/profiles');

///////////////////////////////////////////////////
//    These test should be run for all paths     //
///////////////////////////////////////////////////
/*
describe('All paths', function () {
    describe('Authentication', function () {
        it('should respond with 401 - Authentication failed (Test TODO)', function (done) {
            var req = httpMocks.createRequest({
                method: 'POST',
                url: '/blobs',
                query: { 'Import-Profile': 'testing' },
                body: {
                    data: 'test data',
                    data2: 'more data'
                }
            });

            var res = httpMocks.createResponse({
                eventEmitter: require('events').EventEmitter
            });

            blobs.postBlob(req, res);

            res.on('end', function () {
                var data = res._getData();

                res.statusCode.should.equal(401);
                data.should.be.an('string');
                data.should.equal('Authentication failed');

                done();
            });
        });


        it('should respond with 403 - Not authorized (Test TODO)', function (done) {
            var req = httpMocks.createRequest({
                method: 'POST',
                url: '/blobs',
                query: { 'Import-Profile': 'testing' },
                body: {
                    data: 'test data',
                    data2: 'more data'
                }
            });

            var res = httpMocks.createResponse({
                eventEmitter: require('events').EventEmitter
            });

            blobs.postBlob(req, res);

            res.on('end', function () {
                var data = res._getData();

                res.statusCode.should.equal(403);
                data.should.be.an('string');
                data.should.equal('Not authorized');

                done();
            });
        });
    });
});
*/


/////////////////////////////////////////////////////
// Tests for blob services, meaning /blobs/* paths //
/////////////////////////////////////////////////////
describe('Blob services', function () {
    ////////////////////////////
    // Start: POST /blobs     //
    describe('#POST /blobs', function () {
        it('should respond with 201 - The blob was succesfully created...', function (done) {
            var req = httpMocks.createRequest({
                method: 'POST',
                url: '/blobs',
                query: { 'Import-Profile': 'testing_single' },
                body: {
                    data: 'test data',
                    data2: 'more data'
                }
            });

            var res = httpMocks.createResponse({
                eventEmitter: require('events').EventEmitter
            });


            blobs.postBlob(req, res);

            res.on('end', function () {
                var data = res._getData();
                res.statusCode.should.equal(200);
                data.should.be.an('string');
                data.should.equal('The blob was succesfully created. State is set to PENDING_TRANSFORMATION');

                done();
            });
        });


        it('should respond with 400 - The profile does not exist...', function (done) {
            var req = httpMocks.createRequest({
                method: 'POST',
                url: '/blobs',
                query: { 'Import-Profile': 'testing_invalid_profile' },
                body: {
                    data: 'test data',
                    data2: 'more data'
                }
            });

            var res = httpMocks.createResponse({
                eventEmitter: require('events').EventEmitter
            });

            blobs.postBlob(req, res);

            res.on('end', function () {
                var data = res._getData();

                res.statusCode.should.equal(400);
                data.should.be.an('string');
                data.should.equal('The profile does not exist or the user is not authorized to it');

                done();
            });
        });


        it('should respond with 413 - Request body is too large (Test TODO)', function (done) {
            var req = httpMocks.createRequest({
                method: 'POST',
                url: '/blobs',
                query: { 'Import-Profile': 'testing' },
                body: {
                    data: 'test data',
                    data2: 'more data'
                }
            });

            var res = httpMocks.createResponse({
                eventEmitter: require('events').EventEmitter
            });

            blobs.postBlob(req, res);

            res.on('end', function () {
                var data = res._getData();

                res.statusCode.should.equal(413);
                data.should.be.an('string');
                data.should.equal('Request body is too large');

                done();
            });
        });


        it('should respond with 415 - Content type was not specified (Test TODO)', function (done) {
            var req = httpMocks.createRequest({
                method: 'POST',
                url: '/blobs',
                query: { 'Import-Profile': 'testing' },
                body: {
                    data: 'test data',
                    data2: 'more data'
                }
            });

            var res = httpMocks.createResponse({
                eventEmitter: require('events').EventEmitter
            });

            blobs.postBlob(req, res);

            res.on('end', function () {
                var data = res._getData();

                res.statusCode.should.equal(413);
                data.should.be.an('string');
                data.should.equal('Content type was not specified');

                done();
            });
        });
    });
    // End: POST /blobs       //
    ////////////////////////////


    ////////////////////////////
    // Start: GET /blobs      //
    describe('#GET /blobs', function () {
        describe('-valid queries (200)', function () {
            it('should respond with 200 and list of URLs', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: {},
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);

                res.on('end', function () {
                    try {
                        var data = res._getData();
                        res.statusCode.should.equal(200);
                        data.should.be.an('array');
                        if (config.seedDB && !config.emptyDB) {
                            data.length.should.be.gte(1);
                        }
                        done();

                    } catch (e) {
                        done(e);
                    }
                });
            });


            it('should respond with 200 and array (parameter profile)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: { 'profile': 'standard' },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);

                res.on('end', function () {
                    try {
                        var data = res._getData();
                        res.statusCode.should.equal(200);
                        data.should.be.an('array');
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });


            it('should respond with 200 and array (parameter contentType)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: { 'contentType': 'standard' },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);

                res.on('end', function () {
                    try {
                        var data = res._getData();
                        res.statusCode.should.equal(200);
                        data.should.be.an('array');
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });


            it('should respond with 200 and array of URLs (parameter creationTime 2000-2100)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: {
                        'creationTime': ['2000-01-01T00:00Z', '2100-01-01T00:00Z']
                        //This is identical to:
                        //?creationTime=2000-01-01T00:00Z&creationTime=2100-01-01T00:00Z
                    },
                });
                
                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);

                res.on('end', function () {
                    try {
                        var data = res._getData();
                        res.statusCode.should.equal(200);
                        data.should.be.an('array');
                        data.length.should.be.gte(1);
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });


            it('should respond with 200 and array of URLs (parameter modificationTime 2000-2100)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: {
                        'modificationTime': ['2000-01-01T00:00Z', '2100-01-01T00:00Z']
                    },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);

                res.on('end', function () {
                    try {
                        var data = res._getData();
                        res.statusCode.should.equal(200);
                        data.should.be.an('array');
                        data.length.should.be.gte(1);
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });


            if (config.seedDB && !config.emptyDB) {
                it('should respond with 200 and single URL (from seed)', function (done) {
                    var req = httpMocks.createRequest({
                        method: 'GET',
                        url: '/blobs',
                        query: { 'profile': 'single_test_metadata' },
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });


                    blobs.getBlob(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();
                            res.statusCode.should.equal(200);
                            data.should.be.an('array');
                            data.should.have.lengthOf(1);
                            done();

                        } catch (e) {
                            done(e);
                        }
                    });
                });
            }

            it('should respond with 200 and single URL (from #POST test)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: { 'profile': 'testing_single' },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);

                res.on('end', function () {
                    try {
                        var data = res._getData();
                        res.statusCode.should.equal(200);
                        data.should.be.an('array');
                        data.should.have.lengthOf(1);
                        done();

                    } catch (e) {
                        done(e);
                    }
                });
            });


            it('should respond with 200 and empty array', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: { 'profile': 'nonexistent' },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);

                res.on('end', function () {
                    try {
                        var data = res._getData();
                        res.statusCode.should.equal(200);
                        data.should.be.an('array');
                        data.should.have.lengthOf(0);
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
        });


        describe('-invalid queries (400)', function () {
            it('should respond with 400 - Invalid query (date format)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: {
                        'creationTime': ['20000-01-01T00:00Z', '2100-01-01T00:00Z']
                    },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);

                var data = res._getData();
                res.statusCode.should.equal(400);
                data.should.be.an('string');
                data.should.equal('Invalid query');
                done();
            });


            it('should respond with 400 - Invalid query (single date)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: {
                        'creationTime': '2000-01-01T00:00Z',
                    },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);

                var data = res._getData();
                res.statusCode.should.equal(400);
                data.should.be.an('string');
                data.should.equal('Invalid query');
                done();
            });


            it('should respond with 400 - Invalid query (too many values in creationTime)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: {
                        'creationTime': ['2000-01-01T00:00Z', '2100-01-01T00:00Z', '2000-01-01T00:00Z'],
                    },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);

                var data = res._getData();
                res.statusCode.should.equal(400);
                data.should.be.an('string');
                data.should.equal('Invalid query');
                done();
            });


            it('should respond with 400 - Invalid query (wrong parameter name #1)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: {
                        'creationTime': ['2000-01-01T00:00Z', '2100-01-01T00:00Z'],
                        'creationsTime': ['2000-01-01T00:00Z', '2100-01-01T00:00Z']
                    },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);

                var data = res._getData();
                res.statusCode.should.equal(400);
                data.should.be.an('string');
                data.should.equal('Invalid query');
                done();
            });


            it('should respond with 400 - Invalid query (wrong parameter name #2)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: {
                        'profiles': 'wrong',
                    },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);
                var data = res._getData();
                res.statusCode.should.equal(400);
                data.should.be.an('string');
                data.should.equal('Invalid query');
                done();

            });


            it('should respond with 400 - Invalid query (double parameter #1)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: {
                        'profile': ['wrong', 'weird']
                    },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);
                var data = res._getData();
                res.statusCode.should.equal(400);
                data.should.be.an('string');
                data.should.equal('Invalid query');
                done();
            });


            it('should respond with 400 - Invalid query (triple parameter)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: {
                        'profiles': 'wrong',
                        'profiles': 'really',
                        'profile': 'weird'
                    },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);
                var data = res._getData();
                res.statusCode.should.equal(400);
                data.should.be.an('string');
                data.should.equal('Invalid query');
                done();
            });


            it('should respond with 400 - Invalid query (double parameter #2)', function (done) {
                var req = httpMocks.createRequest({
                    method: 'GET',
                    url: '/blobs',
                    query: {
                        'contentType': ['wrong','really']
                    },
                });

                var res = httpMocks.createResponse({
                    eventEmitter: require('events').EventEmitter
                });


                blobs.getBlob(req, res);
                var data = res._getData();
                res.statusCode.should.equal(400);
                data.should.be.an('string');
                data.should.equal('Invalid query');
                done();
            });
        });
    });
    // End: GET /blobs        //
    ////////////////////////////
});

