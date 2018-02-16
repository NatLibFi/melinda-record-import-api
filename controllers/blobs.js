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

var mongoose = require('mongoose'),
    Blob = require('../models/m.blobs'),
    HttpCodes = require('../utils/HttpCodes'),
    enums = require('../utils/enums'),
    MongoErrorHandler = require('../utils/MongooseErrorHandler'),
    queryHandler = require('../utils/MongooseQueryHandler'),
    moment = require('moment');

var validationError = function (res, err) {
    return res.json(HttpCodes.ValidationError, err);
};

/**
 * Create a new blob
 * 
 * Import-Profile string Name of the import profile to use
 * no response value expected for this operation
*/
module.exports.postBlob = function (req, res, next) {
    console.log("-------------- Post blob --------------");
    console.log(req.body);
    console.log(req.query);

    if (!req.query['Import-Profile']) {
        return res.status(HttpCodes.BadRequest).send("The profile does not exist or the user is not authorized to it")
    }

    req.body.creationTime = moment(); //Use this if you want datetime to be formated etc, otherwise mongoose appends creation and modificationTime
    req.body.state = enums.blobStates.pending;

    var newBlob = new Blob(req.body);
    newBlob.save(function (err, result) {
        if (err) {
            return validationError(res, err);
        }
        return res.status(HttpCodes.OK).send("The blob was succesfully created.")
    });
};

/**
 * Query for blobs
 *
 * profile string  (optional)
 * contentType string  (optional)
 * state string  (optional)
 * creationTime string The query is done using a time range if the parameter is provided twice (optional)
 * modificationTime string The query is done using a time range if the parameter is provided twice (optional)
 * returns array
*/
module.exports.getBlob = function (req, res, next) {
    console.log("-------------- Query blob --------------");
    var query = req.query;

    if (query.creationTime){
        if(query.creationTime.length === 2) {
            query.creationTime = {
                $gte: query.creationTime[0],
                $lte: query.creationTime[1]
            }
        }else{
            delete query.creationTime;
        }
    }

    if (query.modificationTime){
        if(query.modificationTime.length === 2) {
            query.modificationTime = {
                $gte: query.modificationTime[0],
                $lte: query.modificationTime[1]
            }
        } else {
            delete query.modificationTime;
        }
    }

    console.log(query);

    Blob.find(query)
        .exec()
        .then((documents) => queryHandler.findMany(documents, res))
        .catch((reason) => MongoErrorHandler(reason, res, next));
};


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
module.exports.getBlobById = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

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
*/
module.exports.postBlobById = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

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
module.exports.deleteBlobById = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

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
module.exports.getBlobByIdContent = function (req, res, next) {
    res.status(HttpCodes.NotImplemented).send('Endpoint is not yet implemented');
};

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