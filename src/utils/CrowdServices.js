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

/* eslint-disable no-unused-vars */

import {configurationGeneral as config} from '@natlibfi/melinda-record-import-commons';

var mongoose = require('mongoose'),
    queryHandler = require('../utils/MongooseQueryHandler'),
    logs = config.logs,
    authen = require('basic-auth'),
    request = require('request'),
    serverErrors = require('./ServerErrors'),   
    _ = require('lodash');

var defaultCrowdOptions = {
    url: process.env.CROWD_SERVER,
    headers: {
        'Accept': 'application/json'
    }, auth: {
        user: process.env.CROWD_APPNAME,
        pass: process.env.CROWD_APPPASS
    },
    json: true, //This adds 'Content-Type': 'application/json',
    body: {},
    agentOptions: {
        rejectUnauthorized: false
    }
};


////////////////////////////////////////////////////
// Start: Authenticate user and recieve SSO token //
var authenticateUserOptions = _.cloneDeep(defaultCrowdOptions);
authenticateUserOptions.url = authenticateUserOptions.url + '/usermanagement/1/session';
authenticateUserOptions.body = {
    'username': process.env.CROWD_USERNAME,
    'password': process.env.CROWD_PASS
};

module.exports.authenticateUserSSO = function () {
    return new Promise(function (resolve, reject) {
        //Accepted response is in JSON-format
        function callback(error, response, body) {
            if (!error && (response.statusCode == 200 || response.statusCode == 201)
                && body && body.token) {
                resolve(body.token);
            } else {
                if (logs) console.log('Error: ', error);
                reject( error );
            }
        };

        request.post(authenticateUserOptions, callback);
    })
}
//  End: Authenticate user and recieve SSO token  //
////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////
// Start: Check that user is authenticated and has correct access rights //
// Authentication flow:
// 1. Get Username and authenticate user with request details
//    a) If request has basic auth information use it
//    b) If request doesn't have basic auth, check SSO-token and use it
// 2. Check what profiles user is trying to use 
// 3. Check if user has rights to those profiles by checking users groups in crowd
module.exports.ensureAuthenticated = function (req, res, next) {
    // 1. Get Username and authenticate user with request details
    var getUsernamePromise = getUsernameAndAuthenticate(req, res, next);
    getUsernamePromise.then(function (username) {
        if (logs) console.log('Username: ', username);
        // 2. Check what profiles user is trying to use
        var getProfilenamesPromise = getProfilename(req, res, next);
        getProfilenamesPromise.then(function (profilename) {
            if (logs) console.log('Trying to use profile: ', profilename);
            // 3. Check if user has rights to that profile by checking users groups in crowd
            if (profilename) { //User is trying to access some profile 
                var getAuthenticationGroupsPromise = getAuthenticationGrous(profilename);
                getAuthenticationGroupsPromise.then(function (authGroups) {
                    if (logs) console.log('Authentication groups: ', authGroups);

                    var isUserInGroupsPromise = isUserInGroups(username, authGroups);
                    isUserInGroupsPromise.then(function (isInGroup) {
                        if (isInGroup) {
                            if (logs) console.log('User is in usergroup, they can continue to Endpoint');
                            return next(); //User can continue to EP
                        } else {
                            if (logs) console.log('User is in not in all usergroups they are trying to use, they cannot continue to Endpoint');
                            return next(serverErrors.getForbiddenError());
                        }
                    }).catch(function (err) {
                        return next(err);
                    });

                }).catch(function (err) {
                    return next(err);
                });
                

            } else {
                if(logs) console.log('User is not trying to use any profile, they can continue to Endpoint');
                return next(); //User can continue to EP
            }
        }).catch(function (err) {
            return next(err);
        });
    }).catch(function (err) {
        if (!(err.type && err.type === config.enums.errorTypes.unauthorized || err.type === config.enums.errorTypes.forbidden)) {
            console.error('Unanticipated authentication error: ', err);
        }
        return next(err); //Top layer, log error or pass to handler with throw
    });
}
//  End: Check that user is authenticated and has correct access rights  //
///////////////////////////////////////////////////////////////////////////


/////////////////////////////////////////////////////////
// Start: Supporting functions to get user credentials //
function getUsernameAndAuthenticate(req, res, next) {
    return new Promise(function (resolve, reject) {
        var credentials = authen(req) //Use basic auth as standard //getUserCredentialsBasic(req); 
        if (credentials && credentials.name && credentials.pass) {
            var authenticateUserBasicPromise = authenticateUserBasic(req, res, next, credentials);
            authenticateUserBasicPromise.then(function (cred) {
                if (cred && cred.name) {
                    resolve(cred.name);
                } else {
                    reject(serverErrors.getUnauthorizedError());
                }
            }).catch(function (err) {
                reject(err);
            });

        } else {//If not all credentials try SSO token
            var authenticateUserSSOPromise = getUserCredentialsSSO(req, res, next);
            authenticateUserSSOPromise.then(function (cred) {

                if (cred && cred.name) {
                    resolve(cred.name);
                } else {
                    reject(serverErrors.getUnauthorizedError());
                }
            }).catch(function (err) {
                reject(err);
            });
        }
    });
}

function authenticateUserBasic(req, res, next, credentials) {
    var authenticateUserOptionsBasic = _.cloneDeep(defaultCrowdOptions);
    authenticateUserOptionsBasic.url = authenticateUserOptionsBasic.url + '/usermanagement/1/authentication?username=' + credentials.name;
    authenticateUserOptionsBasic.body = {
        'value': credentials.pass,
    };
   
    return new Promise(function (resolve, reject) {
        //Accepted response is in JSON-format
        function callback(error, response, body) {
            if (!error && response.statusCode == 200 && body) {
                resolve( credentials);
            } else if (error) {
                reject(serverErrors.getUnknownError('Unknown internal server error', error))
            } else {
                if(logs) console.log('Not able to authenticate user with basic auth, throwing unauthorized error');
                reject(serverErrors.getUnauthorizedError());
            }
        };

        request.post(authenticateUserOptionsBasic, callback);
    });
}

function getUserCredentialsSSO(req, res, next) {
    var reqToken = req.headers[process.env.CROWD_TOKENNAME];
    var validateTokenOptions = _.cloneDeep(defaultCrowdOptions);
    validateTokenOptions.url = validateTokenOptions.url + '/usermanagement/1/session/' + reqToken;

    return new Promise(function (resolve, reject) {
        //Accepted response is in JSON-format
        function callback(error, response, body) {
            if (!error && response.statusCode == 200 && body.user) {
                resolve(body.user);
            } else if (error) {
                reject(serverErrors.getUnknownError('Unknown internal server error', error))
            } else {
                if (logs) console.log('Not able to authenticate user with SSO, throwing unauthorized error');
                reject(serverErrors.getUnauthorizedError());
            }
        };

        request.post(validateTokenOptions, callback);
    });
}
//  End: Supporting functions to get user credentials  //
/////////////////////////////////////////////////////////


///////////////////////////////////////////////////
// Start: Supporting functions to get groupnames //
function getProfilename(req, res, next) {
    var url = req.url;
    var met = req.method;
    var profileName = '';
    var blobID = '';

    return new Promise(function (resolve, reject) {
        //Find on what basis profile is suppose to be checked
        //EP: POST /blobs
        if (met === 'POST' && url.startsWith('/blobs')) {
            if(req.headers['Import-Profile']){
                profileName = [req.headers['Import-Profile']];
            }else{
                resolve(null); //No profile can continue, but EP should throw error
            }
        //EP: GET /blobs query
        } else if (met === 'GET' && (url.startsWith('/blobs?') || url === '/blobs')) {
            resolve(null); //Authenticated users can make queries
            //profile = [findProfile(url)]; //Can be one of multiple parameters
        } else if ((met === 'GET' || met == 'POST' || met === 'DELETE') && url.startsWith('/blobs')) {
            //EP: GET&DELETE /blobs/{id}/content
            if ((met === 'GET' || met === 'DELETE') && url.endsWith('/content')) {
                blobID = url.slice(7, url.lastIndexOf('/content'));
            //EP: GET&POST&DELETE /blobs/{id}
            } else {
                blobID = url.slice(7);
            }

        //PUT&GET /profiles/{id}
        } else if (url.startsWith('/profiles/')) {
            if (req.body && req.body.auth && req.body.auth.groups) {
                resolve(req.body.auth.groups);
            }
            profileName = url.slice(10);
        }

        if (logs) console.log('Profilename: ', profileName, ' blobID: ', blobID);

        //If one of the methods is set return profile name
        if (profileName) {
            resolve(profileName);
        } else if (blobID) {
            mongoose.models.BlobMetadata.where('id', blobID)
            .exec()
            .then((documents) => queryHandler.findOneProfile(documents, resolve, reject))
            .catch((reason) => (reason) => {
                console.error(reason);
                reject(reason);
            });
        } else {
            reject(serverErrors.getUnknownError('Undetected endpoint call'));
        }
    })
}

function getAuthenticationGrous(profilename) {
    return new Promise(function (resolve, reject) {

        mongoose.models.Profile.where('name', profilename)
        .exec()
        .then((documents) => queryHandler.findAuthgroups(documents, resolve, reject))
        .catch((reason) => (reason) => {
            console.error(reason);
            reject(reason);
        });
        //resolve(['admin', 'test']);
    });
} 

function isUserInGroups(username, authGroups) { //authGroups contains authentication groups of profile that user is trying to use
    return new Promise(function (resolve, reject) {
        var getUserGroupsPromise = getUserGroups(username);
        getUserGroupsPromise.then(function (groupnames) { //Groupnames contains groups that user is part of
            resolve(arrayContainsArray(authGroups, groupnames)); //This returns true if any of array's elements match
        }).catch(function (err) {
            reject(err); //Pass error foward
        });
    });
}

function getUserGroups(username) {
    var getUserGroupsOptions = _.cloneDeep(defaultCrowdOptions);
    getUserGroupsOptions.url = getUserGroupsOptions.url + '/usermanagement/1/user/group/nested?username=' + username;

    return new Promise(function (resolve, reject) {
        request.get(getUserGroupsOptions, function (error, response, body) {
            var groups = [];
            if (!error && response.statusCode == 200 && body && body.groups) {
                _.forEach(body.groups, function (value, index) {
                    groups[index] = value.name;
                });
                resolve(groups);
            } else if (error) {
                console.error('Error: ', error);
                reject(serverErrors.getUnauthorizedError('Error in getting users groups', error));
            } else if (response.statusCode == 401) {
                reject(serverErrors.getUnauthorizedError())
            } else if (response.statusCode == 403) {
                reject(serverErrors.getForbiddenError())
            } else {
                reject(serverErrors.getUnknownError('Something failed in getting user groups'));
            }
        });
    });
}

var arrayContainsArray = function (superset, subset) {
    return superset.some(function (v) {
        return subset.indexOf(v) >= 0;
    });
};
//  End: Supporting functions to get groupnames  //
///////////////////////////////////////////////////