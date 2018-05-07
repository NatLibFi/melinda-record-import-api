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
    config = require('../../melinda-record-import-commons/config'),
    logs = config.logs,
    serverErrors = require('../utils/ServerErrors'),
    HttpCodes = require('../../melinda-record-import-commons/utils/HttpCodes'),
    enums = require('../../melinda-record-import-commons/utils/enums'),
    MongoErrorHandler = require('../utils/MongooseErrorHandler'),
    queryHandler = require('../utils/MongooseQueryHandler'),
    moment = require('moment'),
    uuid = require('uuid'),
    _ = require('lodash');
    

var validationError = function (res, err) {
    return res.json(HttpCodes.ValidationError, err);
};
 
const allowedQueryFields = ['profile', 'contentType', 'state', 'creationTime', 'modificationTime']

/**
 * Create a new blob
 * 
 * Import-Profile string Name of the import profile to use
 * no response value expected for this operation
*/
module.exports.postBlob = function (req, res, next) {
    if (logs) console.log('-------------- Post blob --------------');
    if (logs) console.log(req.body);
    if (logs) console.log(req.query);

    if (!req.query['Import-Profile']) {
        next(serverErrors.getMissingProfileError());
    } else {
        mongoose.models.Profile.where('name', req.query['Import-Profile'])
        .exec()
        .then((documents) => {
            if(documents.length !== 1 ){
                next(serverErrors.getMissingProfileError());
            }
        })
        .catch((reason) => MongoErrorHandler(reason, res, next));
    }

    var newBlobMetadata = new mongoose.models.BlobMetadata({});
    newBlobMetadata.UUID = uuid.v4()
    newBlobMetadata.profile = req.query['Import-Profile'];
    newBlobMetadata.contentType = 'undefined';
    newBlobMetadata.state = enums.blobStates.pending;
    newBlobMetadata.creationTime = moment(); //Use this if you want datetime to be formated etc, otherwise mongoose appends creation and modificationTime

    var newBlob = new mongoose.models.BlobContent();
    newBlob.data = req.body;
    newBlob.UUID = uuid.v4()
    newBlob.MetaDataID = newBlobMetadata.UUID;

    newBlobMetadata.save(function (err, result) {
        if (err) {
            return validationError(res, err);
        }
        
        newBlob.MetaDataID = result.UUID
        newBlob.data = req.body;
        newBlob.save(function (err, result) {
            if (err) {
                return validationError(res, err);
            }
            return res.status(HttpCodes.OK).send('The blob was succesfully created. State is set to ' + newBlobMetadata.state)
        });
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
    if (logs) console.log('-------------- Query blob --------------');
    var query = req.query;
   
    try {
        //Validate query fields:
        //Allowed field
        //No duplicates
        _.forEach(query, function (value, key, index) {
            if (!allowedQueryFields.includes(key) ||
                Array.isArray(value) && !(key === 'creationTime' || key === 'modificationTime' )) {
                throw 'Invalid query field';
            }
        });
    } catch (e) {
        if (e === 'Invalid query field') {
            return queryHandler.invalidQuery(res);
        }
    }

    if (query.creationTime) {
        if (query.creationTime.length === 2 &&
            moment(query.creationTime[0], moment.ISO_8601).isValid() &&
            moment(query.creationTime[1], moment.ISO_8601).isValid()) {

            query.creationTime = {
                $gte: query.creationTime[0],
                $lte: query.creationTime[1]
            }
        } else {    
            return queryHandler.invalidQuery(res);
        }
    }

    if (query.modificationTime){
        if (query.modificationTime.length === 2 &&
            moment(query.modificationTime[0], moment.ISO_8601).isValid() &&
            moment(query.modificationTime[1], moment.ISO_8601).isValid()) {
            query.modificationTime = {
                $gte: query.modificationTime[0],
                $lte: query.modificationTime[1]
            }
        } else {
            return queryHandler.invalidQuery(res);
        }
    }

    mongoose.models.BlobMetadata.find(query)
        .exec()
        .then((documents) => queryHandler.returnUUID(documents, res))
        .catch((reason) => MongoErrorHandler(reason, res, next));
};


/**
 * Retrieve blob metadata by id
 * 
 * returns BlobMetadata
*/
module.exports.getBlobById = function (req, res, next) {
    if (logs) console.log('-------------- Get blob by id --------------');
    if (logs) console.log(req.params.id);

    mongoose.models.BlobMetadata.where('UUID', req.params.id)
        .exec()
        .then((documents) => queryHandler.findOne(documents, res, 'The blob does not exist'))
        .catch((reason) => MongoErrorHandler(reason, res, next));
};


/**
 * Update blob metadata
 * 
 * body object  (optional)
 * no response value expected for this operation
*/
module.exports.postBlobById = function (req, res, next) {
    if (logs) console.log('-------------- Update  blob by id --------------');
    if (logs) console.log(req.body);
    if (logs) console.log(req.params.id);

    if (req.body.id && req.body.id !== req.params.id) {
        return res.status(HttpCodes.BadRequest).send('Requests ids do not match')
    }

    var blob = Object.assign({}, req.body);

    mongoose.models.BlobMetadata.findOneAndUpdate(
        { UUID: req.params.id },
        blob,
        { new: true, upsert: false, runValidators: true }
        ).then((result) => queryHandler.updateOne(result, res, 'The blob does not exist'))
        .catch((reason) => MongoErrorHandler(reason, res, next));
};

/**
 * Delete a blob
 * The blob is completely removed including _all related records in the queue_
 *a
 * no response value expected for this operation
*/
module.exports.deleteBlobById = function (req, res, next) {
    if (logs) console.log('-------------- Remove blob by id --------------');
    if (logs) console.log(req.params.id);

    //Remove content and then metadata, since content can be removed separately
    mongoose.models.BlobContent.findOneAndRemove()
        .where('MetaDataID', req.params.id)
        .exec() 
        .then((documents) => {
            if (!documents && logs) console.log('BlobContent not found, removed earlier?');
            mongoose.models.BlobMetadata.findOneAndRemove()
            .where('UUID', req.params.id)
            .exec()
            .then((documents) => queryHandler.removeOne(documents, res, 'The blob was removed'))
            .catch((reason) => MongoErrorHandler(reason, res, next));
        })
        .catch((reason) => MongoErrorHandler(reason, res, next));
};

/**
 * Retrieve blob content
 *
 * no response value expected for this operation
*/
module.exports.getBlobByIdContent = function (req, res, next) {
    if (logs) console.log('-------------- Get blob content by id --------------');
    if (logs) console.log(req.params.id);

    mongoose.models.BlobContent.where('MetaDataID', req.params.id)
        .exec()
        .then((documents) => queryHandler.findOne(documents, res, 'Content not found'))
        .catch((reason) => MongoErrorHandler(reason, res, next));
};

/**
 * Delete blob content
 * The blob content is removed. If blob state is PENDING_TRANSFORMATION it is set to ABORTED
 *
 * no response value expected for this operation
*/
module.exports.deleteBlobByIdContent = function (req, res, next) {
    if (logs) console.log('-------------- Remove blob content by id --------------');
    if (logs) console.log(req.params.id);

    mongoose.models.BlobContent.findOneAndRemove()
        .where('MetaDataID', req.params.id)
        .exec()
        .then((documents) => queryHandler.removeOne(documents, res, 'The content was removed'))
        .catch((reason) => MongoErrorHandler(reason, res, next));
};