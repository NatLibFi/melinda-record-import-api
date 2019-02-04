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

const mongoose = require('mongoose');
const authen = require('basic-auth');
const request = require('request');
const _ = require('lodash');

const serverErrors = require('../utils/server-errors');
const queryHandler = require('../utils/mongoose-query-handler');
const config = require('../config-general');

const logs = config.logs;
const defaultCrowdOptions = {
	url: process.env.CROWD_SERVER,
	headers: {
		Accept: 'application/json'
	}, auth: {
		user: process.env.CROWD_APPNAME,
		pass: process.env.CROWD_APPPASS
	},
	json: true, // This adds 'Content-Type': 'application/json',
	body: {},
	agentOptions: {
		rejectUnauthorized: false
	}
};

// //////////////////////////////////////////////////
// Start: Authenticate user and recieve SSO token //
const authenticateUserOptions = _.cloneDeep(defaultCrowdOptions);
authenticateUserOptions.url += '/usermanagement/1/session';
authenticateUserOptions.body = {
	username: process.env.CROWD_USERNAME,
	password: process.env.CROWD_PASS
};

module.exports.authenticateUserSSO = function () {
	return new Promise((resolve, reject) => {
		// Accepted response is in JSON-format
		function callback(err, response, body) {
			if (err) {
				if (logs) {
					console.log('Error: ', err);
				}
				reject(err);
			} else if ((response.statusCode === 200 || response.statusCode === 201) && body && body.token) {
				resolve(body.token);
			} else {
				reject(serverErrors.getUnauthorizedError());
			}
		}

		request.post(authenticateUserOptions, callback);
	});
};
//  End: Authenticate user and recieve SSO token  //
// //////////////////////////////////////////////////

// /////////////////////////////////////////////////////////////////////////
// Start: Check that user is authenticated and has correct access rights //
// Authentication flow:
// 1. Get Username and authenticate user with request details
//    a) If request has basic auth information use it
//    b) If request doesn't have basic auth, check SSO-token and use it
// 2. Check what profiles user is trying to use
// 3. Check if user has rights to those profiles by checking users groups in crowd
module.exports.ensureAuthenticated = function (req, res, next) {
	if (process.env.REQ_AUTH === 'false') { // Authentication can be skipped via environment variable REQ_AUTH = false
		if (logs) {
			console.log('REQ_AUTH set to : ', process.env.REQ_AUTH, ' -> Skipping authentication');
		}
		return next(); // User can continue to EP
	}

    // 1. Get Username and authenticate user with request details
	const getUsernamePromise = getUsernameAndAuthenticate(req, res, next);
	getUsernamePromise.then(username => {
		if (logs) {
			console.log('Username: ', username);
		}
        // 2. Check what profiles user is trying to use
		const getProfilenamesPromise = getProfilename(req, res, next);
		getProfilenamesPromise.then(profileName => {
			if (logs) {
				console.log('Trying to use profile: ', profileName);
			}
            // 3. Check if user has rights to that profile by checking users groups in crowd
			if (profileName) { // User is trying to access some profile
				const getAuthenticationGroupsPromise = getAuthenticationGrous(req, profileName); // Get AuthGroups stored in db
				getAuthenticationGroupsPromise.then(authGroups => {
					if (logs) {
						console.log('Authentication groups: ', authGroups);
					}

					const isUserInGroupsPromise = isUserInGroups(username, authGroups);
					isUserInGroupsPromise.then(isInGroup => {
						if (isInGroup) {
							if (logs) {
								console.log('User can continue to Endpoint');
							}
							return next(); // User can continue to EP
						}
						if (logs) {
							console.log('User is in not in any usergroup they are trying to use, they cannot continue to Endpoint');
						}
						return next(serverErrors.getForbiddenError());
					}).catch(err => {
						return next(err);
					});
				}).catch(err => {
					return next(err);
				});
			} else {
				if (logs) {
					console.log('User is not trying to use any profile, they can continue to Endpoint');
				}
				return next(); // User can continue to EP
			}
		}).catch(err => {
			return next(err);
		});
	}).catch(err => {
		if (!(err.type && (err.type === config.enums.errorTypes.unauthorized || err.type === config.enums.errorTypes.forbidden))) {
			console.error('Unanticipated authentication error: ', err);
		}
		return next(err); // Top layer, log error or pass to handler with throw
	});
};
//  End: Check that user is authenticated and has correct access rights  //
// /////////////////////////////////////////////////////////////////////////

// ///////////////////////////////////////////////////////
// Start: Supporting functions to get user credentials //
function getUsernameAndAuthenticate(req, res, next) {
	return new Promise((resolve, reject) => {
		const credentials = authen(req); // Use basic auth as standard //getUserCredentialsBasic(req);
		if (credentials && credentials.name && credentials.pass) {
			const authenticateUserBasicPromise = authenticateUserBasic(req, res, next, credentials);
			authenticateUserBasicPromise.then(cred => {
				if (cred && cred.name) {
					resolve(cred.name);
				} else {
					reject(serverErrors.getUnauthorizedError());
				}
			}).catch(err => {
				reject(err);
			});
		} else {// If not all credentials try SSO token
			const authenticateUserSSOPromise = getUserCredentialsSSO(req, res, next);
			authenticateUserSSOPromise.then(cred => {
				if (cred && cred.name) {
					resolve(cred.name);
				} else {
					reject(serverErrors.getUnauthorizedError());
				}
			}).catch(err => {
				reject(err);
			});
		}
	});
}

function authenticateUserBasic(req, res, next, credentials) {
	const authenticateUserOptionsBasic = _.cloneDeep(defaultCrowdOptions);
	authenticateUserOptionsBasic.url = authenticateUserOptionsBasic.url + '/usermanagement/1/authentication?username=' + credentials.name;
	authenticateUserOptionsBasic.body = {
		value: credentials.pass
	};

	return new Promise((resolve, reject) => {
        // Accepted response is in JSON-format
		function callback(error, response, body) {
			if (!error && response.statusCode === 200 && body) {
				resolve(credentials);
			} else if (error) {
				reject(serverErrors.getUnknownError('Unknown internal server error', error));
			} else {
				if (logs) {
					console.log('Not able to authenticate user with basic auth, throwing unauthorized error');
				}
				reject(serverErrors.getUnauthorizedError());
			}
		}

		request.post(authenticateUserOptionsBasic, callback);
	});
}

function getUserCredentialsSSO(req) {
	const reqToken = req.headers[process.env.CROWD_TOKENNAME];
	const validateTokenOptions = _.cloneDeep(defaultCrowdOptions);
	validateTokenOptions.url = validateTokenOptions.url + '/usermanagement/1/session/' + reqToken;

	return new Promise((resolve, reject) => {
        // Accepted response is in JSON-format
		function callback(error, response, body) {
			if (!error && response.statusCode === 200 && body.user) {
				resolve(body.user);
			} else if (error) {
				reject(serverErrors.getUnknownError('Unknown internal server error', error));
			} else {
				if (logs) {
					console.log('Not able to authenticate user with SSO, throwing unauthorized error');
				}
				reject(serverErrors.getUnauthorizedError());
			}
		}

		request.post(validateTokenOptions, callback);
	});
}
//  End: Supporting functions to get user credentials  //
// ///////////////////////////////////////////////////////

// /////////////////////////////////////////////////
// Start: Supporting functions to get groupnames //
function getProfilename(req) {
	const url = req.url;
	const met = req.method;
	let profileName = '';
	let blobID = '';

	return new Promise((resolve, reject) => {
        // Find on what basis profile is suppose to be checked
        // EP: POST /blobs
		if (met === 'POST' && url.startsWith('/blobs')) {
			if (req.headers['Import-Profile']) {
				profileName = [req.headers['Import-Profile']];
			} else {
				return resolve(null); // No profile can continue, but EP should throw error
			}
        // EP: GET /blobs query
		} else if (met === 'GET' && (url.startsWith('/blobs?') || url === '/blobs')) {
			return resolve(null); // Authenticated users can make queries
            // profile = [findProfile(url)]; //Can be one of multiple parameters
		} else if ((met === 'GET' || met === 'POST' || met === 'DELETE') && url.startsWith('/blobs')) {
            // EP: GET&DELETE /blobs/{id}/content
			if ((met === 'GET' || met === 'DELETE') && url.endsWith('/content')) {
				blobID = url.slice(7, url.lastIndexOf('/content'));
            // EP: GET&POST&DELETE /blobs/{id}
			} else {
				blobID = url.slice(7);
			}

        // PUT&GET /profiles/{id}
		} else if (url.startsWith('/profiles/')) {
			profileName = url.slice(10);
		}

		if (logs) {
			console.log('Profilename: ', profileName, ' blobID: ', blobID);
		}

        // If one of the methods is set return profile name
		if (profileName) {
			resolve(profileName);
		} else if (blobID) {
			mongoose.models.BlobMetadata.where('id', blobID)
            .exec()
            .then(documents => queryHandler.findOneProfile(documents, resolve, reject))
            .catch(err => {
	console.error(err);
	reject(err);
});
		} else {
			reject(serverErrors.getUnknownError('Undetected endpoint call'));
		}
	});
}

function getAuthenticationGrous(req, profilename) {
	return new Promise((resolve, reject) => {
		// Get possible authentication groups from request
		const getReqGroupsPromise = getRequestAuthenticationGroups(req);
		getReqGroupsPromise.then(reqGroups => {
			mongoose.models.Profile.where('name', profilename)
			.exec()
			.then(documents => queryHandler.findAuthgroups(documents, reqGroups, resolve, reject))
			.catch(err => {
				console.error('Catched error: ', err);
				reject(err);
			});
		}).catch(err => {
			reject(err);
		});
	});
}

function getRequestAuthenticationGroups(req) {
	return new Promise((resolve, reject) => {
		try {
			// EP to update profile, EP contains authentication groups in DB and in request (new/modified profile)
			if (req.url.startsWith('/profiles/') && req.method === 'PUT' &&
			req && req.body && req.body.auth) {
				resolve(req.body.auth.groups || []);
			}
		} catch (err) {
			reject(err);
		}
		resolve([]);
	});
}

const arrayContainsArray = function (superset, subset) {
	return superset.some(v => {
		return subset.indexOf(v) >= 0;
	});
};

function isUserInGroups(username, authGroups) { // AuthGroups contains authentication groups of profile that user is trying to use
	return new Promise((resolve, reject) => {
		const getUserGroupsPromise = getUserGroups(username);
		getUserGroupsPromise.then(groupnames => { // Groupnames contains groups that user is part of
			const reqCont = arrayContainsArray(authGroups.reqGroups, groupnames);
			const dbCont = arrayContainsArray(authGroups.DBGroups, groupnames);

			//Go trough all cases
			if (reqCont && authGroups.DBGroups.length === 0) {
				console.warn('Adding usergroup to profile without usergroup or added new profile');
				resolve(true);
			} else if (reqCont && dbCont) {
				resolve(true);
			} else if (reqCont && !dbCont) {
				resolve(false);
			} else if (!reqCont && dbCont) {
				console.warn('User removed usergroup from profile -> cannot use this profile with this user');
				resolve(true);
			} else if (!reqCont && !dbCont) {
				resolve(false);
			}
		}).catch(err => {
			reject(err); // Pass error foward
		});
	});
}

function getUserGroups(username) {
	const getUserGroupsOptions = _.cloneDeep(defaultCrowdOptions);
	getUserGroupsOptions.url = getUserGroupsOptions.url + '/usermanagement/1/user/group/nested?username=' + username;

	return new Promise((resolve, reject) => {
		request.get(getUserGroupsOptions, (error, response, body) => {
			const groups = [];
			if (!error && response.statusCode === 200 && body && body.groups) {
				_.forEach(body.groups, (value, index) => {
					groups[index] = value.name;
				});
				resolve(groups);
			} else if (error) {
				reject(serverErrors.getUnauthorizedError('Error in getting users groups', error));
			} else if (response.statusCode === 401) {
				reject(serverErrors.getUnauthorizedError());
			} else if (response.statusCode === 403) {
				reject(serverErrors.getForbiddenError());
			} else {
				reject(serverErrors.getUnknownError('Something failed in getting user groups'));
			}
		});
	});
}
//  End: Supporting functions to get groupnames  //
// /////////////////////////////////////////////////
