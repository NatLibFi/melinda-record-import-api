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

/* eslint-disable no-undef, max-nested-callbacks */

'use strict';

const httpMocks = require('node-mocks-http');
const chaiHTTP = require('chai-http');
const request = require('supertest');
const chai = require('chai');
const _ = require('lodash');

const should = chai.should();
const logs = true;
let blobs = null; // This will be loaded later when app has started since this requires gridFS component loaded at app
let token = null;

chai.use(chaiHTTP);

const app = require('../src/index');

before(function (done) {
	this.timeout(10000);

	// App emits this after app is started
	app.on('app_started', () => {
		done();
	});
});

describe('All tests', () => {
	const configCrowd = require('../src/config-crowd');
	const profiles = require('../src/controllers/profiles');
	const crowd = require('../src/utils/crowd-services');
	// ////////////////////////////////////////////////////////////////////
	//    Authentication tests, cannot be run without crowd connection   //
	// ////////////////////////////////////////////////////////////////////
	if (process.env.NODE_ENV === 'test_full') {
		describe('All paths', () => {
			// List of all routes to be tested
			const routesObj = [
				// {
				//     'method': 'POST',
				//     'url': '/blobs?Import-Profile=2200',
				// },
				// {
				//     'method': 'GET',
				//     'url': '/blobs?profile=2200'
				// },
				// {
				//     'method': 'GET',
				//     'url': '/blobs/2000'
				// },
				// {
				//     'method': 'POST',
				//     'url': '/blobs/2000',
				// },
				// {
				//     'method': 'DELETE',
				//     'url': '/blobs/2000',
				// },
				// {
				//     'method': 'GET',
				//     'url': '/blobs/2000/content',
				// },
				// {
				//     'method': 'DELETE',
				//     'url': '/blobs/2000/content',
				// },
				// {
				//     'method': 'PUT',
				//     'url': '/profiles/2200',
				// },
				{
					method: 'GET',
					url: '/profiles/2200'
				}
			];

			// Tests that should be valid for all paths
			const testsValid = [
				{
					description: 'Valid user Basic'
				}, {
					description: 'Valid user SSO',
					ssoTest: true
				}];

			const testsInvalid = [
				{
					description: 'Invalid Basic user',
					auth: {
						headerName: 'Authorization',
						headerValue: 'Basic invalid_token'
					},
					res: 'request.authentication.unauthorized'
				}, {
					description: 'Invalid SSO-token',
					ssoTest: true,
					auth: {
						headerName: configCrowd.tokenName,
						headerValue: '000MhP8JqjjCTxAzcMIvT000'
					},
					res: 'request.authentication.unauthorized'
				}];

			it('Getting SSO token', function (done) {
				this.timeout(10000);
				const getToken = crowd.authenticateUserSSO();
				getToken.then(providedToken => {
					providedToken.should.be.an('string');
					token = providedToken;
					if (logs) {
						console.log('Token: ', token);
					}
					done();
				}).catch(err => {
					done(err);
				});
			});

			// It('Waiting', function (done) {
			//     this.timeout(30000);
			// });

			const encodedAuth = configCrowd.encodedAuth;

			_.forEach(routesObj, route => {
				describe('Tests for path: ' + route.url, () => {
					_.forEach(testsValid, value => {
						const requestParams = {
							method: route.method,
							url: route.url,
							body: {
								data: 'test data'
							},
							headers: {}
						};

						it(value.description, done => {
							// Add authentication methods
							if (value.ssoTest && !token) {
								if (!token) {
									return; // Should be SSO test but no token received from earlier test
								}
								requestParams.headers[configCrowd.tokenName] = token;
							} else {
								requestParams.headers.Authorization = encodedAuth;
							}

							const req = httpMocks.createRequest(requestParams);

							const res = httpMocks.createResponse({
								eventEmitter: require('events').EventEmitter
							});
							crowd.ensureAuthenticated(req, res, err => {
								if (err) {
									done(err);
								} else {
									done();
								}
							});
						});
					});

					_.forEach(testsInvalid, value => {
						const requestParams = {
							method: route.method,
							url: route.url,
							body: {
								data: 'test data'
							},
							headers: {}
						};

						it(value.description, done => {
							// Add authentication methods
							if (value.auth && value.auth.headerName && value.auth.headerValue) {
								requestParams.headers[value.auth.headerName] = value.auth.headerValue;
							}

							const req = httpMocks.createRequest(requestParams);

							const res = httpMocks.createResponse({
								eventEmitter: require('events').EventEmitter
							});
							crowd.ensureAuthenticated(req, res, err => {
								try {
									err.type.should.be.equal(value.res);
								} catch (err) {
									return done(err);
								}
								done();
							});
						});
					});
				});
			});
		});
	}

	// ///////////////////////////////////////////////////
	// Tests for blob services, meaning /blobs/* paths //
	// ///////////////////////////////////////////////////
	describe('Blob services', () => {
		// //////////////////////////
		// Start: POST /blobs     //
		describe('#POST /blobs', () => {
			it('should respond with 200 - The blob was succesfully created...', done => {
				request(app)
				.post('/blobs')
				.set('Content', 'application/json')
				.set('Import-Profile', 2200)
				.set(configCrowd.tokenName, token)
				.send({
					data: 'test data',
					data2: 'more data'
				})
				.end((err, res) => {
					if (err) {
						return done(err);
					}
					res.statusCode.should.equal(200);
					res.text.should.be.an('string');
					res.text.should.equal('The blob was succesfully created. State is set to PENDING_TRANSFORMATION');
					done();
				});
			});

			it('should respond with 413 - Request body is too large', done => {
				request(app)
				.post('/blobs')
				.set('Content', 'application/json')
				.set('Import-Profile', 2200)
				.set(configCrowd.tokenName, token)
				.send({
					data: 'Default max content length should be 100',
					data2: 'These should contain combined 101 chars'
				})
				.end((err, res) => {
					// Console.log("Res: ", res);
					if (err) {
						return done(err);
					}
					res.statusCode.should.equal(413);
					res.text.should.be.an('string');
					res.text.should.equal('Request body is too large');
					done();
				});
			});

			it('should respond with 415 - Content type was not specified', done => {
				blobs = require('../src/controllers/blobs');

				const req = httpMocks.createRequest({
					method: 'POST',
					url: '/blobs',
					query: {'Import-Profile': '2200'},
					body: {
						data: 'test data',
						data2: 'more data'
					}
				});

				const res = httpMocks.createResponse({
					eventEmitter: require('events').EventEmitter
				});

				blobs.postBlob(req, res, err => {
					try {
						err.message.should.be.equal('Content type was not specified');
					} catch (err) {
						return done(err);
					}
					done();
				});
			});
		});
		// End: POST /blobs       //
		// //////////////////////////

		// //////////////////////////
		// Start: GET /blobs      //
		describe('#GET /blobs', () => {
			describe('-valid queries (should respond with 200)', () => {
				const testsValid = [
					{
						description: 'list of URLs',
						query: {
						},
						gte: 0
					}, {
						description: 'array (parameter profile)',
						query: {
							profile: '2200'
						},
						gte: 0
					}, {
						description: 'array (parameter contentType)',
						query: {
							contentType: 'standard'
						},
						gte: 0
					}, {
						description: 'array of URLs (parameter creationTime 2000-2100)',
						query: {
							creationTime: ['2000-01-01T00:00Z', '2100-01-01T00:00Z']
							// This is identical to:
							// ?creationTime=2000-01-01T00:00Z&creationTime=2100-01-01T00:00Z
						},
						gte: 1
					}, {
						description: 'array of URLs (parameter modificationTime 2000-2100)',
						query: {
							modificationTime: ['2000-01-01T00:00Z', '2100-01-01T00:00Z']
						},
						gte: 1
					}, {
						description: 'single URL (from seed)',
						query: {
							profile: 'single_test_metadata'
						},
						exact: 1
					}, {
						description: 'single URL (from #POST test)',
						query: {
							profile: 'single_test_metadata'
						},
						exact: 1
					}, {
						description: 'empty array',
						query: {
							profile: 'nonexistent'
						},
						exact: 0
					}];

				_.forEach(testsValid, value => {
					it(value.description, done => {
						const req = httpMocks.createRequest({
							method: 'GET',
							url: '/blobs',
							query: value.query
						});

						const res = httpMocks.createResponse({
							eventEmitter: require('events').EventEmitter
						});

						blobs.getBlob(req, res);

						res.on('end', () => {
							try {
								const data = res._getData();
								res.statusCode.should.equal(200);
								data.should.be.an('array');
								if (value.gte) {
									data.should.have.length.gte(value.gte);
								} else if (value.exact) {
									data.should.have.lengthOf(value.exact);
								}
								done();
							} catch (err) {
								done(err);
							}
						});
					});
				});
			});

			describe('-invalid queries (should respond with 400 - )', () => {
				const testsInvalid = [
					{
						description: '(date format)',
						query: {
							creationTime: ['20000-01-01T00:00Z', '2100-01-01T00:00Z']
						}
					}, {
						description: '(single date)',
						query: {
							creationTime: '20000-01-01T00:00Z'
						}
					}, {
						description: '(too many values in creationTime)',
						query: {
							creationTime: ['2000-01-01T00:00Z', '2100-01-01T00:00Z', '2000-01-01T00:00Z']
						}
					}, {
						description: '(wrong parameter name #1)',
						query: {
							creationTime: ['2000-01-01T00:00Z', '2100-01-01T00:00Z'],
							creationsTime: ['2000-01-01T00:00Z', '2100-01-01T00:00Z']
						}
					}, {
						description: '(wrong parameter name #2)',
						query: {
							profiles: 'wrong'
						}
					}, {
						description: '(double parameter #1)',
						query: {
							profile: ['wrong', 'weird']
						}
					}, {
						description: '(triple parameter)',
						query: {
							profiles: 'wrong',
							profiless: 'really',
							profile: 'weird'
						}
					}, {
						description: '(double parameter #2)',
						query: {
							contentType: ['wrong', 'really']
						}
					}
				];

				_.forEach(testsInvalid, value => {
					it(value.description, done => {
						const req = httpMocks.createRequest({
							method: 'GET',
							url: '/blobs',
							query: value.query
						});

						const res = httpMocks.createResponse({
							eventEmitter: require('events').EventEmitter
						});

						blobs.getBlob(req, res);

						const data = res._getData();
						res.statusCode.should.equal(400);
						data.should.be.an('string');
						data.should.equal('Invalid query');
						done();
					});
				});
			});
		});
		// End: GET /blobs        //
		// //////////////////////////

		// //////////////////////////
		// Start: GET /blobs/{id} //
		describe('#GET /blobs/{id}', () => {
			const testsValid = [
				{
					description: 'Basic test',
					params: {
						id: 2001
					}
				}];

			describe('-valid queries (should respond with 200)', () => {
				_.forEach(testsValid, value => {
					it(value.description, done => {
						const req = httpMocks.createRequest({
							method: 'GET',
							url: '/blobs/validID',
							params: value.params
						});

						const res = httpMocks.createResponse({
							eventEmitter: require('events').EventEmitter
						});

						blobs.getBlobById(req, res);

						res.on('end', () => {
							try {
								const data = res._getData();

								res.statusCode.should.equal(200);
								data.should.be.an('object');

								should.exist(data);
								should.exist(data.id);
								data.id.should.be.an('string');
								should.exist(data.contentType);
								data.contentType.should.be.an('string');
								should.exist(data.state);
								data.state.should.be.an('string');
								should.exist(data.creationTime);
								data.creationTime.should.be.an('Date');
								should.exist(data.modificationTime);
								data.modificationTime.should.be.an('Date');
								should.exist(data.processingInfo);
								should.equal(data.processingInfo.transformationError, null);
								should.equal(data.processingInfo.numberOfRecords, null);
								should.exist(data.processingInfo.importResults);
								data.processingInfo.importResults.should.be.an('array');
								done();
							} catch (err) {
								done(err);
							}
						});
					});
				});
			});

			describe('-invalid queries (404)', () => {
				const testsInvalid = [
					{
						description: 'Without param',
						params: {
						},
						res: 'The blob does not exist'
					}, {
						description: 'With invalid param',
						params: {
							ids: 2001
						},
						res: 'The blob does not exist'
					}];

				_.forEach(testsInvalid, value => {
					it(value.description, done => {
						const req = httpMocks.createRequest({
							method: 'GET',
							url: '/blobs/invalidID',
							params: value.params
						});

						const res = httpMocks.createResponse({
							eventEmitter: require('events').EventEmitter
						});

						blobs.getBlobById(req, res, err => {
							try {
								err.message.should.be.equal(value.res);
							} catch (err) {
								return done(err);
							}
							done();
						});
					});
				});
			});

			describe('-questionable queries', () => {
				const testsInvalid = [{
					description: 'With multiple params (one is valid)',
					params: {
						id: 2001,
						ids: 2001
					},
					resCode: 200
				}];

				_.forEach(testsInvalid, value => {
					it(value.description, done => {
						const req = httpMocks.createRequest({
							method: 'GET',
							url: '/blobs/invalidID',
							params: value.params
						});

						const res = httpMocks.createResponse({
							eventEmitter: require('events').EventEmitter
						});

						blobs.getBlobById(req, res);

						res.on('end', () => {
							try {
								const data = res._getData();
								res.statusCode.should.equal(value.resCode);
								data.should.be.an('object');
								done();
							} catch (err) {
								done(err);
							}
						});
					});
				});
			});
		});
		// End: GET /blobs/{id}   //
		// //////////////////////////

		// //////////////////////////
		// Start: POST /blobs/{id} //
		describe('#POST /blobs/{id}', () => {
			const testsValid = [
				{
					description: 'Basic test',
					params: {
						id: 2001
					},
					body: {
						profile: '2200'
					}
				}
			];

			describe('-valid queries (should respond with 204)', () => {
				_.forEach(testsValid, value => {
					it(value.description, done => {
						const req = httpMocks.createRequest({
							method: 'POST',
							url: '/blobs/',
							params: value.params,
							body: value.body
						});

						const res = httpMocks.createResponse({
							eventEmitter: require('events').EventEmitter
						});

						blobs.postBlobById(req, res);

						res.on('end', () => {
							try {
								const data = res._getData();
								res.statusCode.should.equal(204);
								data.should.be.an('string');
								data.should.equal('The metadata was updated');
								done();
							} catch (err) {
								done(err);
							}
						});
					});
				});
			});

			const testsInvalid = [
				/* ,
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
				}, */
				{
					description: 'Not existing',
					params: {
						id: 9999
					},
					body: {
						profile: '2200'
					},
					res: 'request.content.missing'
				}, {
					description: 'Invalid syntax',
					params: {
						id: 2001
					},
					body: {
						profileInvalid: 2200
					},
					res: 'request.content.validation'
				}
			];

			describe('-invalid queries', () => {
				_.forEach(testsInvalid, value => {
					it(value.description, done => {
						const req = httpMocks.createRequest({
							method: 'POST',
							url: '/blobs/',
							params: value.params,
							body: value.body
						});

						const res = httpMocks.createResponse({
							eventEmitter: require('events').EventEmitter
						});

						blobs.postBlobById(req, res, err => {
							try {
								err.type.should.be.equal(value.res);
								done();
							} catch (err) {
								done(err);
							}
						});
					});
				});
			});
		});
		// End: POST /blobs/{id}  //
		// //////////////////////////

		// //////////////////////////
		// Start: DELETE /blobs/{id} //
		describe('#DELETE /blobs/{id}', () => {
			const tests = [
				{
					description: 'Basic test (valid)',
					params: {
						id: '2001'
					},
					res: 204
				}, {
					description: 'Earlier removed blob',
					params: {
						id: '2001'
					},
					res: 'request.content.missing'
				}, {
					description: 'Not existing',
					params: {
						id: '9999'
					},
					res: 'request.content.missing'
				}
			];

			_.forEach(tests, value => {
				it(value.description, done => {
					const req = httpMocks.createRequest({
						method: 'DELETE',
						url: '/blobs/',
						params: value.params
					});

					const res = httpMocks.createResponse({
						eventEmitter: require('events').EventEmitter
					});

					blobs.deleteBlobById(req, res, err => {
						try {
							err.type.should.be.equal(value.res);
							done();
						} catch (err) {
							done(err);
						}
					});

					res.on('end', () => {
						try {
							res.statusCode.should.equal(value.res);
							done();
						} catch (err) {
							done(err);
						}
					});
				});
			});
		});
		// End: DELETE /blobs/{id}  //
		// ////////////////////////////

		// //////////////////////////////////
		// Start: GET /blobs/{id}/content //
		describe('#GET /blobs/{id}/content', () => {
			const tests = [
				{
					description: 'Basic test (valid)',
					params: {
						id: '2002'
					},
					res: 200
				}, {
					description: 'Earlier removed blob',
					params: {
						id: '2001'
					},
					res: 'request.content.missing'
				}, {
					description: 'Not existing',
					params: {
						id: '9999'
					},
					res: 'request.content.missing'
				}
			];

			_.forEach(tests, value => {
				it(value.description, done => {
					const req = httpMocks.createRequest({
						method: 'GET',
						url: '/blobs/' + value.params.id + '/content',
						params: value.params
					});

					const res = httpMocks.createResponse({
						eventEmitter: require('events').EventEmitter
					});

					blobs.getBlobByIdContent(req, res, err => {
						try {
							err.type.should.be.equal(value.res);
							done();
						} catch (err) {
							done(err);
						}
					});

					res.on('end', () => {
						try {
							// Const data = res._getData();
							res.statusCode.should.equal(value.res);
							done();
						} catch (err) {
							done(err);
						}
					});
				});
			});
		});
		// End: GET /blobs/{id}/content  //
		// /////////////////////////////////

		// /////////////////////////////////////
		// Start: DELETE /blobs/{id}/content //
		// The blob content is removed. If blob state is PENDING_TRANSFORMATION it is set to ABORTED
		describe('#DELETE /blobs/{id}/content', () => {
			const tests = [
				{
					description: 'Basic test (valid)',
					params: {
						id: '2002'
					},
					res: 204
				}, {
					description: 'Earlier removed blob',
					params: {
						id: '2002'
					},
					res: 'request.content.missing'
				}, {
					description: 'Not existing',
					params: {
						id: '9999'
					},
					res: 'request.content.missing'
				}
			];

			_.forEach(tests, value => {
				it(value.description, done => {
					const req = httpMocks.createRequest({
						method: 'DELETE',
						url: '/blobs/' + value.params.id + '/content',
						params: value.params
					});

					const res = httpMocks.createResponse({
						eventEmitter: require('events').EventEmitter
					});

					blobs.deleteBlobByIdContent(req, res, err => {
						try {
							err.type.should.be.equal(value.res);
							done();
						} catch (err) {
							done(err);
						}
					});

					res.on('end', () => {
						try {
							const data = res._getData();
							res.statusCode.should.equal(204);
							data.should.be.an('string');
							data.should.equal('The content was removed');
							done();
						} catch (err) {
							done(err);
						}
					});
				});
			});
		});
		// End: DELETE /blobs/{id}/content //
		// ///////////////////////////////////
	});

	// //////////////////////////////////////////////////////
	// Tests for profile services, meaning /profiles/* paths //
	// //////////////////////////////////////////////////////
	describe('Profile services', () => {
		// ///////////////////////////////
		// Start: PUT /profiles/{name} //
		describe('#PUT /profiles/{name}', () => {
			const testsValid = [{
				description: 'Add profile',
				params: {
					name: 2203
				},
				body: {
					auth: {
						groups: ['admin', 'user']
					},
					transformation: {
						abortOnInvalidRecords: false,
						image: 'standard',
						env: {}
					},
					import: {
						image: 'standard',
						env: {}
					}
				},
				status: 201,
				response: 'The profile was created'
			}, {
				description: 'Update profile',
				params: {
					name: 2202
				},
				body: {
					name: 2202,
					auth: {
						groups: ['admin']
					}
				},
				status: 204,
				response: 'The profile was updated'
			}];

			describe('-valid queries (should respond with 20*)', () => {
				_.forEach(testsValid, value => {
					it(value.description, done => {
						const req = httpMocks.createRequest({
							method: 'PUT',
							url: '/profiles/' + value.params.name,
							params: value.params,
							body: value.body
						});

						const res = httpMocks.createResponse({
							eventEmitter: require('events').EventEmitter
						});

						profiles.upsertProfileByName(req, res);

						res.on('end', () => {
							try {
								const data = res._getData();
								res.statusCode.should.equal(value.status);
								data.should.be.an('string');
								data.should.equal(value.response);
								done();
							} catch (err) {
								done(err);
							}
						});
					});
				});
			});

			const testsInvalid = [
				{
					description: 'Names not matching',
					body: {
						name: 2203,
						auth: {
							groups: ['admin']
						}
					},
					params: {
						name: 2202
					},
					status: 422,
					res: 'entity.not.object'
				}
				/* ,
				//This test is disabled for the moment since
				//sending malformed JSON doesn't seem to work
				//Test malformed JSON with Postman
				{
					'description': 'Malformed body',
					'body': '{ 'auth' :'{'groups': ['admin']'}',
					'status': 400,
					'response': 'Malformed content'
				}
				*/
			];

			describe('-invalid queries (should respond with 4**)', () => {
				_.forEach(testsInvalid, value => {
					it(value.description, done => {
						const req = httpMocks.createRequest({
							method: 'PUT',
							url: '/profiles/' + value.params.name,
							body: value.body,
							params: value.params
						});

						const res = httpMocks.createResponse({
							eventEmitter: require('events').EventEmitter
						});

						profiles.upsertProfileByName(req, res, err => {
							try {
								err.type.should.be.equal(value.res);
							} catch (err) {
								return done(err);
							}
							done();
						});
					});
				});
			});
		});
		//  End: PUT /profiles/{name}  //
		// /////////////////////////////

		// /////////////////////////////
		// Start: GET /profiles/{name} //
		describe('#GET /profiles/{name}', () => {
			const testsValid = [{
				description: 'Get profile',
				params: {
					name: '2202'
				},
				status: 200
			}];

			describe('-valid queries (should respond with 20*)', () => {
				_.forEach(testsValid, value => {
					it(value.description, done => {
						const req = httpMocks.createRequest({
							method: 'GET',
							url: '/profiles/' + value.params.id,
							params: value.params,
							body: value.body
						});

						const res = httpMocks.createResponse({
							eventEmitter: require('events').EventEmitter
						});

						profiles.getProfileByName(req, res);

						res.on('end', () => {
							try {
								const data = res._getData();
								res.statusCode.should.equal(value.status);
								data.should.be.an('object');
								done();
							} catch (err) {
								done(err);
							}
						});
					});
				});
			});

			const testsInvalid = [{
				description: 'Not existing',
				params: {
					name: 9999
				},
				status: 404,
				res: 'request.content.missing'
			}];

			describe('-invalid queries (should respond with 4**)', () => {
				_.forEach(testsInvalid, value => {
					it(value.description, done => {
						const req = httpMocks.createRequest({
							method: 'GET',
							url: '/profiles/' + value.params.id,
							params: value.params,
							body: value.body
						});

						const res = httpMocks.createResponse({
							eventEmitter: require('events').EventEmitter
						});

						profiles.getProfileByName(req, res, err => {
							try {
								err.type.should.be.equal(value.res);
								done();
							} catch (err) {
								done(err);
							}
						});
					});
				});
			});
		});
		// End: PUT /profiles/{name} //
		// ///////////////////////////
	});

	after(done => {
		app.close(done);
	});
});
