'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

module.exports = exports = new Schema(
	{
		userid: {
			type: String,
			required: true,
			unique: true
		},
		password: {
			type: String,
			required: true
		},
	},
	{
		collection: 'users'
	}
);
