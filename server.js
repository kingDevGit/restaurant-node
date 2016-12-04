'use strict';

const mongoose = require('mongoose');
const app = require('./app');

mongoose.connect('mongodb://user:11180952@ds145997.mlab.com:45997/comps381f');

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error'));
db.once('open', function(callback) {
	console.log('server', 'Connection open');
	console.log('server', 'Listening to ' + (process.env.PORT || 8080));
	app.listen(process.env.PORT || 8080);
});
