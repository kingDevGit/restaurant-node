'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

module.exports = exports = new Schema(
	{
		name: {
			type: String,
			required: true
		},
		borough: String,
		cuisine: String,
		address: {
			street: String,
			building: String,
			zipcode: String,
			coord: {
				latitude: Number,
				longtitude: Number
			}
		},
		photo: String,
		mimetype: String,
		grades:[{
			score: {
				type: Number,
				min: 0,
				max: 10
			},
			user: String
		}],
		userid: String
	},
	{
		collection: 'restaurants'
	}
);
