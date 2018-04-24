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
    _ = require('lodash');


module.exports = {
    findOne: function (findResults, res, notFound) {
        switch (findResults.length) {
            case 0:
                return res.status(HttpCodes.NotFound).send(notFound || 'Could not find any documents matching the query.');
            case 1: {
                var result = findResults[0].toJSON();
                delete result._id;
                delete result.__v;
                delete result.UUID;
                delete result.MetaDataID;
                return res.status(HttpCodes.OK).send(result);
            }
            default:
                console.warn('Should be just one search result, found multiple: ', findResults);
                return res.status(HttpCodes.Conflict).send('Found multiple documents when expected to find only one.');
        }
    },
    findOneLocal: function (findResults, resolve, reject) {
        switch (findResults.length) {
            case 0: {
                return reject(null);
            }
            case 1: {
                var result = findResults[0].toJSON();
                delete result._id;
                delete result.__v;
                delete result.UUID;
                delete result.MetaDataID;
                return resolve(null);
            }
            default: {
                console.warn('Should be just one search result, found multiple: ', findResults);
                return reject(null);
            }
        }
    },
    findMany: function (findResults, res) {
        _.forEach(findResults, function (value) {
            delete value.UUID;
        }); _
        return res.status(HttpCodes.OK).send(findResults);
    },
    updateOne: function (result, res, notFound) {
        if (result) {
            return res.status(HttpCodes.NoContent).send('The metadata was updated');
        } else {
            return res.status(HttpCodes.NotFound).send(notFound);
        }
    },
    returnUUID: function (findResults, res) {
        var results = [];
        _.forEach(findResults, function (value) {
            results.push('https://record-import.api.melinda.kansalliskirjasto.fi/v1/blob/' + value.UUID)
        });
        return res.status(HttpCodes.OK).send(results);
    },
    removeOne: function (obj, res, whatWasRemoved) {
        if (obj) {
            return res.status(HttpCodes.NoContent).send(whatWasRemoved);
        } else {
            return res.status(HttpCodes.NotFound).send('Content not found');
        }
    },
    invalidQuery: function (res) {
        return res.status(HttpCodes.BadRequest).send('Invalid query');
    },
    upsertObject: function (updated, res) {
        if (updated) {
            return res.status(HttpCodes.NoContent).send('The profile was updated');
        } else {
            return res.status(HttpCodes.Created).send('The profile was created');
        }
    }
};