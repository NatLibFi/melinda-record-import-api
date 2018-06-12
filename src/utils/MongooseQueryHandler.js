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

var serverErrors = require('./ServerErrors'),
    _ = require('lodash');


module.exports = {
    findOne: function (findResults, res, notFound) {
        switch (findResults.length) {
            case 0:
                return res.status(config.httpCodes.NotFound).send(notFound || 'Could not find any documents matching the query.');
            case 1: {
                var result = findResults[0].toJSON();
                delete result._id;
                delete result.__v;
                delete result.MetaDataID;
                return res.status(config.httpCodes.OK).send(result);
            }
            default:
                console.warn('Should be just one search result, found multiple: ', findResults);
                return res.status(config.httpCodes.Conflict).send('Found multiple documents when expected to find only one.');
        }
    },
    findOneProfile: function (findResults, resolve, reject) {
        switch (findResults.length) {
            case 0: {
                return reject(serverErrors.getMissingProfileError());
            }
            case 1: {
                return resolve(findResults[0].toJSON().profile);
            }
            default: {
                console.warn('Should be just one search result, found multiple: ', findResults);
                return reject(null);
            }
        }
    },
    findAuthgroups: function (findResults, resolve, reject) {
        switch (findResults.length) {
            case 0: {
                return reject(serverErrors.getMissingProfileError());
            }
            case 1: {
                return resolve(findResults[0].toJSON().auth.groups);
            }
            default: {
                console.warn('Should be just one search result, found multiple: ', findResults);
                return reject(null);
            }
        }
    },
    findMany: function (findResults, res) {
        _.forEach(findResults, function (value) {
            delete value.id;
        }); _
        return res.status(config.httpCodes.OK).send(findResults);
    },
    updateOne: function (result, res, notFound) {
        if (result) {
            return res.status(config.httpCodes.Updated).send('The metadata was updated');
        } else {
            return res.status(config.httpCodes.NotFound).send(notFound || 'Data not found');
        }
    },
    returnUUID: function (findResults, res) {
        var results = [];
        _.forEach(findResults, function (value) {
            results.push(config.urlAPI + '/blobs/' + value.id)
        });
        return res.status(config.httpCodes.OK).send(results);
    },
    removeOne: function (obj, res, whatWasRemoved) {
        if (obj) {
            return res.status(config.httpCodes.NoContent).send(whatWasRemoved);
        } else {
            return res.status(config.httpCodes.NotFound).send('Content not found');
        }
    },
    invalidQuery: function (res) {
        return res.status(config.httpCodes.BadRequest).send('Invalid query');
    },
    upsertObject: function (updated, res) {
        if (updated) {
            return res.status(config.httpCodes.NoContent).send('The profile was updated');
        } else {
            return res.status(config.httpCodes.Created).send('The profile was created');
        }
    }
};