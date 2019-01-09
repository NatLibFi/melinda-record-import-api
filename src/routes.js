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

// Endpoint controllers
const blobs = require('./controllers/blobs');
const profiles = require('./controllers/profiles');
const crowd = require('./utils/crowd-services');

// Mongoose models, required to be declared to function routes
const Blobs = require('./models/m.blobs');
const Profile = require('./models/m.profiles');

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
module.exports = function (app) {
    // Authentication is done against Crowd and compared to profile that is going to be used
    // If routes are updated detection of profile should also be updated at CrowdServives
	app.all('/blobs*', crowd.ensureAuthenticated);
	app.post('/blobs', blobs.postBlob);
	app.get('/blobs', blobs.getBlob);
	app.get('/blobs/:id', blobs.getBlobById);
	app.post('/blobs/:id', blobs.postBlobById);
	app.delete('/blobs/:id', blobs.deleteBlobById);
	app.get('/blobs/:id/content', blobs.getBlobByIdContent);
	app.delete('/blobs/:id/content', blobs.deleteBlobByIdContent);

	app.all('/profiles*', crowd.ensureAuthenticated);
	app.put('/profiles/:name', profiles.upsertProfileByName);
	app.get('/profiles/:name', profiles.getProfileByName);
};
