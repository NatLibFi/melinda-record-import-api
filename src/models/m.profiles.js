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

const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const Profile = new Schema({
	name: {type: String, required: true, unique: true},
	auth: {
		groups: [{
			type: String
		}]
	},
	transformation: {
		abortOnInvalidRecords: {type: Boolean},
		image: {type: String},
		env: {type: Object}
	},
	import: {
		image: {type: String},
		env: {type: Object}
	}
}, {
	strict: 'throw'
});

module.exports = mongoose.model('Profile', Profile);
