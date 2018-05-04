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
    utils = require('../utils/ServerUtils'),
    MongoErrorHandler = require('../utils/MongooseErrorHandler'),
    queryHandler = require('../utils/MongooseQueryHandler');

/**
 * Create or update a profile
 * 
 * body object  (optional)
 * no response value expected for this operation
*/
module.exports.upsertProfileByName = function (req, res, next) {
    if (logs) console.log('-------------- Upsert profile --------------');
    if (logs) console.log(req.body);

    if (typeof (req.body) !== 'object') {
        return next(serverErrors.getMalformedError());
    }

    try {
        utils.ensureMatchingNames(req, res);
    } catch (e) {
        return next(e);
    }

    try {
        var profile = Object.assign({}, req.body);
    } catch (e) {
        return next(serverErrors.getMalformedError());
    }

    mongoose.models.Profile.findOneAndUpdate(
        { name: profile.name },
        profile,
        { new: true, upsert: true, runValidators: true, rawResult: true }
        ).then((result) => queryHandler.upsertObject(result.lastErrorObject.updatedExisting, res))
        .catch((reason) => MongoErrorHandler(reason, res, next));
};


/**
 * Retrieve a profile
 *
 * returns Profile
*/
module.exports.getProfileByName = function (req, res, next) {
    if (logs) console.log('-------------- Get profile --------------');
    if (logs) console.log(req.params.id);

    mongoose.models.Profile.where('name', req.params.name)
        .exec()
        .then((documents) => queryHandler.findOne(documents, res, 'The profile does not exist'))
        .catch((reason) => MongoErrorHandler(reason, res, next));
};