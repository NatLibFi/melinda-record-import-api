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
var HttpCodes = require('./utils/HttpCodes'),
    enums = require('./utils/enums'),
    serverErrors = require('./utils/ServerErrors'),
    router = require('express').Router();

//Endpoint controllers
var blobs = require('./controllers/blobs');
var profiles = require('./controllers/profiles');
var crowd = require('./utils/CrowdServices');

//Mongoose models
var Blobs = require('./models/m.blobs'),
    Profile = require('./models/m.profiles');

var swagger = function(req, res, next){
    console.log('This should return Swagger documentation!');
    res.status(HttpCodes.NotImplemented).send('Swagger documentation is not yet implemented');
}

/*
//Swagger endpoints
//Testing postman: https://www.getpostman.com/collections/03a898a97fefc2979cfe
POST /blobs  - Create a new blob
GET /blobs - Query for blobs
GET /blobs/{id} - Retrieve blob metadata
POST /blobs/{id} - Update blob metadata
DELETE /blobs/{id} - Delete a blob
GET /blobs/{id}/content - Retrieve blob content
DELETE /blobs/{id}/content - Delete blob content

PUT /profiles/{id} - Create or update a profile
GET /profiles/{id} - Retrieve a profile
*/
exports = module.exports = function (app, passport) {
    //crowd.isUserInGroup('test', 'testNest');
    crowd.authenticateUserSSO();

    app.get('/', swagger);

    //Authentication is done against Crowd and compared to profile that is going to be used
    //If routes are updated detection of profile should also be updated at CrowdServives
    app.all('/*', crowd.ensureAuthenticated) 

    app.post('/blobs', blobs.postBlob)
    app.get('/blobs', blobs.getBlob)
    app.get('/blobs/:id', blobs.getBlobById)
    app.post('/blobs/:id', blobs.postBlobById)
    app.delete('/blobs/:id', blobs.deleteBlobById)
    app.get('/blobs/:id/content', blobs.getBlobByIdContent)
    app.delete('/blobs/:id/content', blobs.deleteBlobByIdContent)

    app.put('/profiles/:id', profiles.upsertProfileById)
    app.get('/profiles/:id', profiles.getProfileById)
};