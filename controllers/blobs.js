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


module.exports.postBlob = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

module.exports.getBlob = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

module.exports.getBlobById = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

module.exports.postBlobById = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

module.exports.deleteBlobById = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

module.exports.getBlobByIdContent = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

module.exports.deleteBlobByIdContent = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

/*
module.exports.operation1 = function operation1 (req, res, next) {
  var ImportProfile = req.swagger.params['Import-Profile'].value;
  blobsApi.operation1(ImportProfile)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.operation2 = function operation2 (req, res, next) {
  var profile = req.swagger.params['profile'].value;
  var contentType = req.swagger.params['contentType'].value;
  var state = req.swagger.params['state'].value;
  var creationTime = req.swagger.params['creationTime'].value;
  var modificationTime = req.swagger.params['modificationTime'].value;
  blobsApi.operation2(profile,contentType,state,creationTime,modificationTime)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.operation3 = function operation3 (req, res, next) {
  blobsApi.operation3()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.operation4 = function operation4 (req, res, next) {
  var body = req.swagger.params['body'].value;
  blobsApi.operation4(body)
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.operation5 = function operation5 (req, res, next) {
  blobsApi.operation5()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.operation6 = function operation6 (req, res, next) {
  blobsApi.operation6()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};

module.exports.operation7 = function operation7 (req, res, next) {
  blobsApi.operation7()
    .then(function (response) {
      utils.writeJson(res, response);
    })
    .catch(function (response) {
      utils.writeJson(res, response);
    });
};
*/

/**
 * Create a new blob
 * 
 *
 * Import-Profile string Name of the import profile to use
 * no response value expected for this operation
 *
exports.operation1 = function (ImportProfile) {
    return new Promise(function (resolve, reject) {
        resolve();
    });
}
*/

/**
 * Query for blobs
 * 
 *
 * profile string  (optional)
 * contentType string  (optional)
 * state string  (optional)
 * creationTime string The query is done using a time range if the parameter is provided twice (optional)
 * modificationTime string The query is done using a time range if the parameter is provided twice (optional)
 * returns array
exports.operation2 = function (profile, contentType, state, creationTime, modificationTime) {
    return new Promise(function (resolve, reject) {
        var examples = {};
        examples['application/json'] = [
      "https://record-import.api.melinda.kansalliskirjasto.fi/v1/blob/1234",
      "https://record-import.api.melinda.kansalliskirjasto.fi/v1/blob/5678"
        ];
        if (Object.keys(examples).length > 0) {
            resolve(examples[Object.keys(examples)[0]]);
        } else {
            resolve();
        }
    });
}
 **/


/**
 * Retrieve blob metadata
 * 
 *
 * returns BlobMetadata
 *
exports.operation3 = function () {
    return new Promise(function (resolve, reject) {
        var examples = {};
        examples['application/json'] = {
            "id": 123456,
            "profile": "foobar",
            "contentType": "application/json",
            "state": "PENDING_TRANSFORMATION",
            "creationTime": "2018-01-01T00:00:00Z",
            "modificationTime": "2018-01-01T00:01:00Z",
            "processingInfo": {
                "numberOfRecords": 1000,
                "importResults": [
                  {
                      "id": 6000,
                      "state": "CREATED"
                  }
                ]
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

/**
 * Update blob metadata
 * 
 *
 * body object  (optional)
 * no response value expected for this operation
 *
exports.operation4 = function (body) {
    return new Promise(function (resolve, reject) {
        resolve();
    });
}


/**
 * Delete a blob
 * The blob is completely removed including all related records in the queue
 *
 * no response value expected for this operation
 *
exports.operation5 = function () {
    return new Promise(function (resolve, reject) {
        resolve();
    });
}
*/

/**
 * Retrieve blob content
 * 
 *
 * no response value expected for this operation
 *
exports.operation6 = function () {
    return new Promise(function (resolve, reject) {
        resolve();
    });
}
*/

/**
 * Delete blob content
 * The blob content is removed. If blob state is PENDING_TRANSFORMATION it is set to ABORTED
 *
 * no response value expected for this operation
 *
exports.operation7 = function () {
    return new Promise(function (resolve, reject) {
        resolve();
    });
}
*/