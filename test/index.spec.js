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

const chai = require('chai'),
      chaiHTTP = require('chai-http');
      chai.use(chaiHTTP);

const should = chai.should();
var expect = chai.expect();
const app = require('../index');
const routes = require('../routes');
const httpMocks = require('node-mocks-http');
const mongoose = require('mongoose'),
      config = require('../config'),
      configCrowd = require('../configCrowd'),
      //logs = config.logs,
      logs = true,
      server = require('../index'),
      _ = require('lodash');

const blobs = require('../controllers/blobs');
const profiles = require('../controllers/profiles');
const crowd = require('../utils/CrowdServices');

///////////////////////////////////////////
// Start: Generate testing objects to DB //
mongoose.models.BlobMetadata.remove(function () {
    mongoose.models.BlobMetadata.create({
        UUID: '2000',
        profile: 'test',
        contentType: 'standard'
    }, {
        UUID: '2001',
        profile: 'single_test_metadata',
        contentType: 'standard'
    }, {
        UUID: '2002',
        profile: 'standard',
        contentType: 'standard'
    }, function (err) {
        if (logs) console.log('Finished populating testing blobs, errors: ', err);
    });
});


mongoose.models.BlobContent.remove(function () {
    mongoose.models.BlobContent.create({
        UUID: '2100',
        MetaDataID: '2000',
        data: {
            datafield1: 'data 1',
            datafield2: 'data 2'
        }
    }, {
        UUID: '2101',
        MetaDataID: '2001',
        data: {
            datafield1: 'single data',
            datafield2: 'single data 1'
        }
    }, {
        UUID: '2102',
        MetaDataID: '2002',
        data: {
            datafield1: 'data 1',
            datafield2: 'data 2'
        }
    }, function (err) {
        if (logs) console.log('Finished populating testing blobs, errors: ', err);
    });
});


mongoose.models.Profile.remove(function () {
    mongoose.models.Profile.create({
        id: '2200',
        auth: {
            groups: ['user']
        },
        transformation: {
            abortOnInvalidRecords: false,
            module: 'standard_user',
            parameters: {
                priority: false,
                ignoreFlags: false
            },
        },
        'import': {
            module: 'standard_user',
            parameters: {
                priority: true,
                ignoreFlags: false
            }
        }
    },{
        id: '2201',
        auth: {
            groups: ['admin', 'user']
        },
        transformation: {
            abortOnInvalidRecords: false,
            module: 'standard',
            parameters: {
                priority: true,
                ignoreFlags: false
            },
        },
        'import': {
            module: 'standard',
            parameters: {
                priority: true,
                ignoreFlags: false
            }
        }
    }, {
        id: '2202',
        auth: {
            groups: ['user']
        },
        transformation: {
            abortOnInvalidRecords: false,
            module: 'standard_user',
            parameters: {
                priority: false,
                ignoreFlags: false
            },
        },
        'import': {
            module: 'standard_user',
            parameters: {
                priority: true,
                ignoreFlags: false
            }
        }
    }, function (err) {
        if (logs) console.log('Finished populating testing profiles, errors: ', err);
    });
});
// End: Generate testing objects to DB //
/////////////////////////////////////////

///////////////////////////////////////////////////
//    These test should be run for all paths     //
///////////////////////////////////////////////////
describe('All paths', function () {
    //List of all routes to be tested
    var routesObj = [
        {
            'method': 'POST',
            'url': '/blobs?Import-Profile=test',
        },
        {
            'method': 'GET',
            'url': '/blobs?profile=test'
        },
        {
            'method': 'GET',
            'url': '/blobs/2100'
        },
        {
            'method': 'POST',
            'url': '/blobs/2100',
        },
        {
            'method': 'DELETE',
            'url': '/blobs/2100',
        },
        {
            'method': 'GET',
            'url': '/blobs/2100/content',
        },
        {
            'method': 'DELETE',
            'url': '/blobs/2100/content',
        },
        {
            'method': 'PUT',
            'url': '/profiles/2200',
        },
        {
            'method': 'GET',
            'url': '/profiles/2200',
        }
    ];

    //Tests that should be valid for all paths
    var testsValid = [
    {
        'description': 'Valid user Basic',
    }, {
        'description': 'Valid user SSO',
        'sso_test': true
    }];

    var testsInvalid = [
    {
        'description': 'Invalid Basic user',
        'auth':{
            'headerName' : 'Authorization',
            'headerValue': 'Basic invalid_token'
        },
        'res': 'request.authentication.unauthorized'
    }, {
        'description': 'Invalid SSO-token',
        'sso_test': true,
        'auth':{
            'headerName' : configCrowd.tokenName,
            'headerValue': '000MhP8JqjjCTxAzcMIvT000'
        },
        'res': 'request.authentication.unauthorized'
    }];
    
    var token = null;
    it('Getting SSO token', function (done) {
        var getToken = crowd.authenticateUserSSO();
        getToken.then(function(providedToken){
            providedToken.should.be.an('string');
            token = providedToken;
            console.log("Token: ", token);
            done();
        }).catch(function (err) {
            done(err);
        });
    });


    var basicAuthString = configCrowd.username + ':' + configCrowd.password;
    var encodedAuth = Buffer.from(basicAuthString).toString('base64');
    encodedAuth = 'Basic ' + encodedAuth;

    _.forEach(routesObj, function (route) {
        describe('Tests for path: ' + route.url, function () {
            _.forEach(testsValid, function (value) {
                var requestParams = {
                    method: route.method,
                    url: route.url,
                    body: {
                        data: 'test data',
                    },
                    headers: {},
                };

                it(value.description, (done) => {
                    //Add authentication methods
                    if (value.sso_test && !token) {
                        if (!token) {
                            return; //Should be SSO test but no token received from earlier test
                        } else {
                            requestParams.headers[configCrowd.tokenName] = token;
                        }
                    } else {
                        requestParams.headers['Authorization'] = encodedAuth;
                    }

                    var req = httpMocks.createRequest(requestParams);

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });
                    crowd.ensureAuthenticated(req, res, function (err) {
                        if (err) {
                            done(err);
                        } else {
                            done();
                        }
                    });
                });
            });

            _.forEach(testsInvalid, function (value) {
                var requestParams = {
                    method: route.method,
                    url: route.url,
                    body: {
                        data: 'test data',
                    },
                    headers: {},
                };

                it(value.description, (done) => {
                    //Add authentication methods
                    if (value.auth && value.auth.headerName && value.auth.headerValue){
                        requestParams.headers[value.auth.headerName] = value.auth.headerValue;
                    }

                    var req = httpMocks.createRequest(requestParams);

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });
                    crowd.ensureAuthenticated(req, res, function (err) {
                        try{
                            err.type.should.be.equal(value.res);
                        } catch (e) {
                            return done(e);
                        }
                        done();
                    });
                });
            });
        });
    });
});


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
                   id: 2001
               },
               'basic': true
           }, {
               'description': 'Structure test (ToDo: number of records)',
               'params': {
                   id: 2001
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
                   'ids': 2001
               }
           }, {
               'description': 'With multiple params',
               'params': {
                   'id': 2001,
                   'ids': 2001
               },
               'res_code': 200,
               'res_object': true
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
                   'id': 2001
               },
               'body': {
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
                            var data = res._getData();
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
            /*,
            //This test is disabled for the moment since
            //sending malformed JSON doesn't seem to work
            //Test malformed JSON with Postman
            {
                'description': 'Malformed',
                'params': {
                    'id': 2001
                },
                'body': {
                    'profile': Malformed'
                },
                'res': 400
            },*/
            {
                'description': 'Not existing',
                'params': {
                    'id': 9999
                },
                'body': {
                    'profile': 'Updated'
                },
                'res': 404
            }, {
                'description': 'Invalid syntax',
                'params': {
                    'id': 2001
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
                   'id': 2001
               }
           }
        ];

        describe('-valid queries (should respond with 204)', function () {
            _.forEach(testsValid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'DELETE',
                        url: '/blobs/' + value.params.id,
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
                    'id': 2001
                }
            }, {
                'description': 'Not existing',
                'params': {
                    'id': 9999
                }
            }
        ];

        describe('-invalid queries', function () {
            _.forEach(testsInvalid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'DELETE',
                        url: '/blobs/' + value.params.id,
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


    ////////////////////////////////////
    // Start: GET /blobs/{id}/content //
    describe('#GET /blobs/{id}/content', function () {

        var testsValid = [
           {
               'description': 'Basic test',
               'params': {
                   'id': 2002
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
                    'id': 2001
                }
            }, {
                'description': 'Not existing',
                'params': {
                    'id': 9999
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
    // End: GET /blobs/{id}/content  //
    ///////////////////////////////////

    ///////////////////////////////////////
    // Start: DELETE /blobs/{id}/content //
    //The blob content is removed. If blob state is PENDING_TRANSFORMATION it is set to ABORTED
    describe('#DELETE /blobs/{id}/content', function () {

        var testsValid = [
           {
               'description': 'Basic test',
               'params': {
                   'id': 2002
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
                    'id': 2002
                }
            }, {
                'description': 'Not existing',
                'params': {
                    'id': 9999
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
    // End: DELETE /blobs/{id}/content //
    /////////////////////////////////////
});

////////////////////////////////////////////////////////
// Tests for profile services, meaning /blobs/* paths //
////////////////////////////////////////////////////////
describe('Profile services', function () {

    ///////////////////////////////
    // Start: PUT /profiles/{id} //
    describe('#PUT /profiles/{id}', function () {

        var testsValid = [{
            'description': 'Add profile',
            'params': {
                'id': ''
            },
            'body': {
                'auth': {
                    'groups': ['admin', 'user']
                },
                'transformation': {
                    'abortOnInvalidRecords': false,
                    'module': 'standard',
                    'parameters': {
                        'priority': true,
                        'ignoreFlags': false
                    }
                },
                'import': {
                    'module': 'standard',
                    'parameters': {
                        'priority': true,
                        'ignoreFlags': false
                    }
                }
            },
            'status': 201,
            'response' : 'The profile was created'
        }, {
            'description': 'Update profile',
            'params': {
                'id': 2202
            },
            'body': {
                'id': 2202,
                'auth': {
                    'groups': ['admin']
                }
            },
            'status': 204,
            'response': 'The profile was updated'
        }];

        describe('-valid queries (should respond with 20*)', function () {
            _.forEach(testsValid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'PUT',
                        url: '/profiles/' + value.params.id,
                        params: value.params,
                        body: value.body
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    profiles.upsertProfileById(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();
                            res.statusCode.should.equal(value.status);
                            data.should.be.an('string');
                            data.should.equal(value.response);
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
                'description': 'Ids not matching',
                'body': {
                    'id': 2203,
                    'auth': {
                        'groups': ['admin']
                    }
                },
                'params':{
                    'id':2202
                },
                'status': 422,
                'response': 'Invalid syntax',
                'res': 'request.mismatch.id'
            }
            /*,
            //This test is disabled for the moment since
            //sending malformed JSON doesn't seem to work
            //Test malformed JSON with Postman
            {
                'description': 'Malformed body',
                'body': '{ "auth" :"{"groups": ["admin"]"}',
                'status': 400,
                'response': 'Malformed content'
            }
            */
        ];

        describe('-invalid queries (should respond with 4**)', function () {
            _.forEach(testsInvalid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'PUT',
                        url: '/profiles/' + value.params.id,
                        body: value.body,
                        params: value.params
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    profiles.upsertProfileById(req, res, function (err) {
                        try {
                            err.type.should.be.equal(value.res);
                        } catch (e) {
                            return done(e);
                        }
                        done();
                    });
                });
            });
        });
    });
    //  End: PUT /profiles/{id}  //
    ///////////////////////////////

    ///////////////////////////////
    // Start: GET /profiles/{id} //
    describe('#GET /profiles/{id}', function () {

        var testsValid = [{
            'description': 'Get profile',
            'params': {
                'id': '2202'
            },
            'status': 200,
        }];

        describe('-valid queries (should respond with 20*)', function () {
            _.forEach(testsValid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'GET',
                        url: '/profiles/' + value.params.id,
                        params: value.params,
                        body: value.body
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    profiles.getProfileById(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();
                            res.statusCode.should.equal(value.status);
                            data.should.be.an('object');
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });
                });
            });
        });


        var testsInvalid = [{
            'description': 'Not existing',
            'params': {
                'id': 9999,
            },
            'status': 404,
            'response': 'Invalid syntax'
        }];

        describe('-invalid queries (should respond with 4**)', function () {
            _.forEach(testsInvalid, function (value) {
                it(value.description, function (done) {
                    var req = httpMocks.createRequest({
                        method: 'GET',
                        url: '/profiles/' + value.params.id,
                        params: value.params,
                        body: value.body
                    });

                    var res = httpMocks.createResponse({
                        eventEmitter: require('events').EventEmitter
                    });

                    profiles.getProfileById(req, res);

                    res.on('end', function () {
                        try {
                            var data = res._getData();
                            res.statusCode.should.equal(value.status);
                            data.should.be.an('string');
                            data.should.equal('The profile does not exist');
                            done();
                        } catch (e) {
                            done(e);
                        }
                    });

                });
            });
        });
    });
    // End: PUT /profiles/{id} //
    /////////////////////////////
});