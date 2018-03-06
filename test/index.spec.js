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
      config = require('../config'),
      _ = require('lodash');

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

        var testsValid = [
            {
                'description': 'list of URLs',
                'query': {
                },
                'gte': 0
            }, {
                'description': 'array (parameter profile)',
                'query': {
                    'profile': 'standard'
                },
                'gte': 0
            }, {
                'description': 'array (parameter contentType)',
                'query': {
                    'contentType': 'standard'
                },
                'gte': 0
            }, {
                'description': 'array of URLs (parameter creationTime 2000-2100)',
                'query': {
                    'creationTime': ['2000-01-01T00:00Z', '2100-01-01T00:00Z']
                    //This is identical to:
                    //?creationTime=2000-01-01T00:00Z&creationTime=2100-01-01T00:00Z
                },
                'gte': 1
            }, {
                'description': 'array of URLs (parameter modificationTime 2000-2100)',
                'query': {
                    'modificationTime': ['2000-01-01T00:00Z', '2100-01-01T00:00Z']
                },
                'gte': 1
            }, {
                'description': 'single URL (from seed)',
                'query': {
                    'profile': 'single_test_metadata'
                },
                'exact': 1
            }, {
                'description': 'single URL (from #POST test)',
                'query': {
                    'profile': 'testing_single'
                },
                'exact': 1
            }, {
                'description': 'empty array',
                'query': {
                    'profile': 'nonexistent'
                },
                'exact': 0
            }];

        describe('-valid queries (should respond with 200)', function () {
            _.forEach(testsValid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'GET',
                        url: '/blobs',
                        query: value.query,
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
                            if (value.gte) {
                                data.should.have.length.gte(value.gte);
                            } else if (value.exact) {
                                data.should.have.lengthOf(value.exact);
                            }
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
                });
            });
        });


        var testsInvalid = [
            {
                'description': '(date format)',
                'query': {
                    'creationTime': ['20000-01-01T00:00Z', '2100-01-01T00:00Z']
                }
            }, {
                'description': '(single date)',
                'query': {
                    'creationTime': '20000-01-01T00:00Z'
                }
            }, {
                'description': '(too many values in creationTime)',
                'query': {
                    'creationTime': ['2000-01-01T00:00Z', '2100-01-01T00:00Z', '2000-01-01T00:00Z']
                }
            }, {
                'description': '(wrong parameter name #1)',
                'query': {
                    'creationTime': ['2000-01-01T00:00Z', '2100-01-01T00:00Z'],
                    'creationsTime': ['2000-01-01T00:00Z', '2100-01-01T00:00Z']
                }
            }, {
                'description': '(wrong parameter name #2)',
                'query': {
                    'profiles': 'wrong'
                }
            }, {
                'description': '(double parameter #1)',
                'query': {
                    'profile': ['wrong', 'weird']
                }
            }, {
                'description': '(triple parameter)',
                'query': {
                    'profiles': 'wrong',
                    'profiles': 'really',
                    'profile': 'weird'
                }
            }, {
                'description': '(double parameter #2)',
                'query': {
                    'contentType': ['wrong', 'really']
                }
            }
        ];
        describe('-invalid queries (should respond with 400 - )', function () {
            _.forEach(testsInvalid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'GET',
                        url: '/blobs',
                        query: value.query,
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
    });
    // End: GET /blobs        //
    ////////////////////////////


    ////////////////////////////
    // Start: GET /blobs/{id} //
    describe('#GET /blobs/{id}', function () {

        var testsValid = [
           {
               'description': 'Basic test',
               'params': {
                   id: 1112
               },
               'basic': true
           }, {
               'description': 'Structure test',
                'params': {
                    id: 1112
                },
                'basic': false
    }
        ];

        describe('-valid queries (should respond with 200)', function () {
            _.forEach(testsValid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'GET',
                        url: '/blobs/validID',
                        params: value.params,
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    blobs.getBlobById(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();
                            res.statusCode.should.equal(200);
                            data.should.be.an('object');

                            if (!value.basic) {
                                should.exist(data);
                                //should.exist(data.id); //This is removed from response
                                //data.id.should.be.an('string');
                                //data.id.should.equal('1112')
                                should.exist(data.contentType);
                                data.contentType.should.be.an('string');
                                should.exist(data.state);
                                data.state.should.be.an('string');
                                should.exist(data.creationTime);
                                data.creationTime.should.be.an('Date');
                                should.exist(data.modificationTime);
                                data.modificationTime.should.be.an('Date');
                                should.exist(data.processingInfo);
                                data.processingInfo.should.be.an('object');
                                should.exist(data.processingInfo.numberOfRecords);
                                data.processingInfo.numberOfRecords.should.be.an('number');
                                should.exist(data.processingInfo.importResults);
                                data.processingInfo.importResults.should.be.an('array');


                            }

                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
                });
            });
        });

        var testsInvalid = [
           {
               'description': 'Without param',
               'params': {
               }
           }, {
               'description': 'With invalid param',
               'params': {
                   'ids': '1112'
               }
           }, {
               'description': 'With multiple params',
               'params': {
                   'id': '1112',
                   'ids': '1112'
               },
               'res_code': 200,
               'res_object' : true
           }
        ];

        describe('-invalid queries (404)', function () {
            _.forEach(testsInvalid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'GET',
                        url: '/blobs/invalidID',
                        params: value.params,
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    blobs.getBlobById(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();
                            res.statusCode.should.equal(value.res_code || 404);
                            if (!value.res_object) {
                                data.should.be.an('string');
                                data.should.equal('The blob does not exist');
                            } else {
                                data.should.be.an('object');
                            }

                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
                });
            });
        });
    });
    // End: GET /blobs/{id}   //
    ////////////////////////////


    ////////////////////////////
    // Start: POST /blobs/{id} //
    describe('#POST /blobs/{id}', function () {

        var testsValid = [
           {
               'description': 'Basic test',
               'params': {
                   'id': 1112
               },
               'body':{
                   'profile': 'Updated'
               }
           }
        ];

        describe('-valid queries (should respond with 204)', function () {
            _.forEach(testsValid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'POST',
                        url: '/blobs/',
                        params: value.params,
                        body: value.body
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    blobs.postBlobById(req, res);
                    
                    res.on('end', function () {
                        try {
                            var data =  res._getData();
                            res.statusCode.should.equal(204);
                            data.should.be.an('string');
                            data.should.equal('The metadata was updated');
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });

                });
            });
        });

        var testsInvalid = [
            {
                'description': 'Malformed',
                'params': {
                    'id': 1112
                },
                'body': {
                    'profile': 'Malformed'
                },
                'res' : 400
            }, {
                'description': 'Not existing',
                'params': {
                    'id': 1000
                },
                'body': {
                    'profile': 'Updated'
                },
                'res': 404
            }, {
                'description': 'Invalid syntax',
                'params': {
                    'id': 1112
                },
                'body': {
                    'profile_invalid': 'Invalid syntax'
                },
                'res': 422
            }
        ];

        describe('-invalid queries', function () {
            _.forEach(testsInvalid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'POST',
                        url: '/blobs/',
                        params: value.params,
                        body: value.body
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    blobs.postBlobById(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();

                            if (value.res === 400) {
                                res.statusCode.should.equal(400);
                                data.should.be.an('string');
                                data.should.equal('Malformed content');
                            } else if (value.res === 404) {
                                res.statusCode.should.equal(404);
                                data.should.be.an('string');
                                data.should.equal('The blob does not exist');
                            } else if (value.res === 422) {
                                res.statusCode.should.equal(422);
                                data.should.be.an('string');
                                data.should.equal('Invalid syntax');
                            }
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
                });
            });
        });
    });
    // End: POST /blobs/{id}  //
    ////////////////////////////

    ////////////////////////////
    // Start: DELETE /blobs/{id} //
    describe('#DELETE /blobs/{id}', function () {

        var testsValid = [
           {
               'description': 'Basic test',
               'params': {
                   'id': 1112
               }
           }
        ];

        describe('-valid queries (should respond with 204)', function () {
            _.forEach(testsValid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'DELETE',
                        url: '/blobs/' +value.params.id,
                        params: value.params,
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    blobs.deleteBlobById(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();
                            res.statusCode.should.equal(204);
                            data.should.be.an('string');
                            data.should.equal('The blob was removed');
                            //Should check this from DB
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });

                });
            });
        });

        var testsInvalid = [
            {
                'description': 'Earlier removed blob',
                'params': {
                    'id': 1112
                }
            }, {
                'description': 'Not existing',
                'params': {
                    'id': 1000
                }
            }
        ];

        describe('-invalid queries', function () {
            _.forEach(testsInvalid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'DELETE',
                        url: '/blobs/'+ value.params.id,
                        params: value.params,
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    blobs.deleteBlobById(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();

                            res.statusCode.should.equal(404);
                            data.should.be.an('string');
                            data.should.equal('Content not found');
                         
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
                });
            });
        });
    });
    // End: DELETE /blobs/{id}  //
    //////////////////////////////


    ////////////////////////////
    // Start: GET /blobs/{id} //
    describe('#GET /blobs/{id}/content', function () {

        var testsValid = [
           {
               'description': 'Basic test',
               'params': {
                   'id': 1113
               }
           }
        ];

        describe('-valid queries (should respond with 204)', function () {
            _.forEach(testsValid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'GET',
                        url: '/blobs/' + value.params.id + '/content',
                        params: value.params,
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    blobs.getBlobByIdContent(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();
                            res.statusCode.should.equal(200);
                            data.should.be.an('object');    
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });

                });
            });
        });

        
        var testsInvalid = [
            {
                'description': 'Earlier removed blob',
                'params': {
                    'id': 1112
                }
            }
        ];

        describe('-invalid queries', function () {
            _.forEach(testsInvalid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'GET',
                        url: '/blobs/' + value.params.id + '/content',
                        params: value.params,
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    blobs.getBlobByIdContent(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();

                            res.statusCode.should.equal(404);
                            data.should.be.an('string');
                            data.should.equal('Content not found');

                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
                });
            });
        });
    });
    // End: GET /blobs/{id}  //
    ///////////////////////////

    ///////////////////////////////
    // Start: DELETE /blobs/{id} //
    //The blob content is removed. If blob state is PENDING_TRANSFORMATION it is set to ABORTED
    describe('#DELETE /blobs/{id}/content', function () {

        var testsValid = [
           {
               'description': 'Basic test',
               'params': {
                   'id': 1113
               }
           }
        ];

        describe('-valid queries (should respond with 204)', function () {
            _.forEach(testsValid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'DELETE',
                        url: '/blobs/' + value.params.id + '/content',
                        params: value.params,
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    blobs.deleteBlobByIdContent(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();
                            res.statusCode.should.equal(204);
                            data.should.be.an('string');
                            data.should.equal('The content was removed');
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });

                });
            });
        });


        var testsInvalid = [
            {
                'description': 'Earlier removed blob',
                'params': {
                    'id': 1113
                }
            }, {
                'description': 'Not existing',
                'params': {
                    'id': 1000
                }
            }
        ];

        describe('-invalid queries', function () {
            _.forEach(testsInvalid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'GET',
                        url: '/blobs/' + value.params.id + '/content',
                        params: value.params,
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    blobs.deleteBlobByIdContent(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();

                            res.statusCode.should.equal(404);
                            data.should.be.an('string');
                            data.should.equal('Content not found');

                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
                });
            });
        });
    });
    // End: DELETE /blobs/{id}  //
    //////////////////////////////
});

