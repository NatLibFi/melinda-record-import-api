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

var HttpCodes = require('./HttpCodes'),
    configCrowd = require('../configCrowd'),
    mongoose = require('mongoose'),
    enums = require('../utils/enums'),
    MongoErrorHandler = require('../utils/MongooseErrorHandler'),
    config = require('../config'),
    logs = true, //config.logs,
    authen = require('basic-auth'),
    request = require('request'),
    serverErrors = require('./ServerErrors'),
    _ = require('lodash');

////////////////////////////////////////////////////
// Start: Authenticate user and recieve SSO token //
var authenticateUserOptions = _.cloneDeep(configCrowd.defaultOptions);
authenticateUserOptions.url = authenticateUserOptions.url + '/usermanagement/1/session';
authenticateUserOptions.body = {
    'username': configCrowd.username,
    'password': configCrowd.password
};

module.exports.authenticateUserSSO = function () {
    //Accepted response is in JSON-format
    function callback(error, response, body) {
        if (!error && (response.statusCode == 200 || response.statusCode == 201)
            && body && body.token) {
            token = body.token;
            console.log("Token: ", token);
        } else {
            if (logs) console.log('Error: ', error);
        }
    };

    request.post(authenticateUserOptions, callback);
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
        // 2. Check what profiles user is trying to use
        var getProfilenamesPromise = getProfilenames(req, res, next);
        getProfilenamesPromise.then(function (profilenames) {
            // 3. Check if user has rights to those profiles by checking users groups in crowd
            if (profilenames) { //User is trying to access some profiles 
                var isUserInGroupsPromise = isUserInGroups(username, profilenames);
                isUserInGroupsPromise.then(function (isInGroup) {
                    if (isInGroup) {
                        if (logs) console.log("User is in usergroup, they can continue to Endpoint");
                        return next(); //User can continue to EP
                    } else {
                        if (logs) console.log("User is in not in all usergroups they are trying to use, they cannot continue to Endpoint");
                        return next(serverErrors.getForbiddenError());
                    }
                }).catch(function (err) {
                    return next(err);
                });
            } else {
                if(logs) console.log("User is not trying to use any profile, they can continue to Endpoint");
                return next(); //User can continue to EP
            }
        }).catch(function (err) {
            return next(err);
        });
    }).catch(function (err) {
        if (!(err.type && err.type === enums.errorTypes.unauthorized || err.type === enums.errorTypes.forbidden)) {
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
    var authenticateUserOptionsBasic = _.cloneDeep(configCrowd.defaultOptions);
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
    var reqToken = req.headers[configCrowd.tokenName];
    var validateTokenOptions = _.cloneDeep(configCrowd.defaultOptions);
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
function getProfilenames(req, res, next) {
    var url = req.url;
    var met = req.method;
    var profile = '';
    var profileID = '';
    var blobID = '';

    return new Promise(function (resolve, reject) {
        //Find on what basis profile is suppose to be checked
        //EP: POST /blobs
        if (met === 'POST' && url.startsWith('/blobs?Import-Profile=')) {
            profile = [url.slice(22)]; //Only parameter and mandatory

        //EP: GET /blobs
        } else if (met === 'GET' && url.startsWith('/blobs?')) {
            resolve(null); //Authenticated users can make queries
            //profile = [findProfile(url)]; //Can be one of multiple parameters
        } else if ((met === 'GET' || met == 'POST' || met === 'DELETE') && url.startsWith('/blobs/')) {
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
            profileID = url.slice(10);
        }

        //If one of the methods is set return profile name
        if (profile) {
            resolve(profile);
        }else if (profileID) {
            mongoose.models.Profile.where('id', profileID)
            .exec()
            .then((documents) = function (documents) {
                if (documents.length > 1) {
                    console.warn('Should be just one search result, found multiple: ', document);
                } else if (documents.length === 0) {
                    resolve(null);
                }
                resolve(documents[0].auth.groups);
            })
            .catch((reason) = function (reason) {
                reject(reason);
            });
        } else if (blobID) {
            mongoose.models.BlobMetadata.where('UUID', blobID)
            .exec()
            .then((documents) = function (documents) {
                if (documents.length > 1) {
                    console.warn('Should be just one search result, found multiple: ', document);
                } else if (documents.length === 0) {
                    resolve(null);
                }
                resolve([documents[0].profile]);
            })
            .catch((reason) = function (reason) {
                reject(reason);
            });
        } else {
            reject(serverErrors.getUnknownError('Undetected endpoint call'));
        }
    })
}

function isUserInGroups(username, profilenames) { //Profilenames contains names of profiles that user is trying to use
    return new Promise(function (resolve, reject) {
        var getUserGroupsPromise = getUserGroups(username);
        getUserGroupsPromise.then(function (groupnames) { //Groupnames contains groups that user is part of
            resolve(arrayContainsArray(groupnames, profilenames)); //This returns true if any of array's elements match
        }).catch(function (err) {
            reject(err); //Pass error foward
        });
    });
}

function getUserGroups(username) {
    var getUserGroupsOptions = _.cloneDeep(configCrowd.defaultOptions);
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
                if (logs) console.log('Error: ', error);
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
    console.log('Superset: ', superset);
    console.log('Subset: ', subset);
    return subset.every(function (value) {
        return (superset.indexOf(value) >= 0);
    });
};
//  End: Supporting functions to get groupnames  //
///////////////////////////////////////////////////