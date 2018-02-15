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

'use strict';

var HttpCodes = require('../utils/HttpCodes'),
    utils = require('../utils/writer.js');

/**
 * Create or update a profile
 * 
 *
 * body object  (optional)
 * no response value expected for this operation
 *
exports.operation8 = function (body) {
    return new Promise(function (resolve, reject) {
        resolve();
    });
}
*/
module.exports.upsertProfileById = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

/**
 * Retrieve a profile
 * 
 *
 * returns Profile
 *
exports.operation9 = function () {
    return new Promise(function (resolve, reject) {
        var examples = {};
        examples['application/json'] = {
            "auth": {
                "groups": [
                  "string"
                ]
            },
            "transformation": {
                "abortOnInvalidRecords": true,
                "module": "string",
                "parameters": {}
            },
            "import": {
                "module": "string",
                "parameters": {}
            }
        };
        if (Object.keys(examples).length > 0) {
            resolve(examples[Object.keys(examples)[0]]);
        } else {
            resolve();
        }
    });
}
*/
module.exports.getProfileById = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};





/*
module.exports.operation8 = function operation8 (req, res, next) {
  var body = req.swagger.params['body'].value;
  profilesApi.operation8(body)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.operation9 = function operation9 (req, res, next) {
  profilesApi.operation9()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};
*/