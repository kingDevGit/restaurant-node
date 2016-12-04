'use strict';

const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const fileUpload = require('express-fileupload');
const express = require('express');
const mongodb = require('mongodb');
const mongoose = require('mongoose');
const Url = require('url');

const restaurantSchema = require('./models/restaurantSchema');
const userSchema = require('./models/userSchema');

mongoose.Promise = Promise;

const ObjectId = mongoose.Types.ObjectId;
const Restaurant = mongoose.model('Restaurant', restaurantSchema);
const User = mongoose.model('User', userSchema);

const app = express();

app.use(bodyParser.json());
app.use(cookieSession({ name: 'session', keys: ['key1', 'key2'] }));
app.use(fileUpload());

app.set('view engine', 'ejs');

const isLogin = function(req, res, next) {
	if (!req.session.userid) {
		return res.redirect('/login');
	}

	next();
}

const isObjectIdValid = function(req, res, next) {
	if (!ObjectId.isValid(req.query._id)) {
		return res.render('error', {
			error: 'The ID is invalid',
			back: '/read' + (req.session.search || '')
		});
	}

	next();
}

const getRestaurant = function(req, res, next) {
	let userid = req.session.userid;

	Restaurant.findById(ObjectId(req.query._id), function(err, result) {
		if (err) {
			return res.render('error', {
				error: err,
				back: '/read' + (req.session.search || '')
			});
		}

		if (!result) {
			return res.render('error', {
				error: 'The restaurant does not exist',
				back: '/read' + (req.session.search || '')
			});
		}

		req.restaurant = result;

		next();
	});
}

const isOwner = function(req, res, next) {
	let userid = req.session.userid;
	let restaurant = req.restaurant;

	if (restaurant.userid != userid) {
		return res.render('error', {
			error: 'Unauthorized',
			back: '/display?_id=' + req.query._id
		});
	}

	next();
}

const isFirstRate = function(req, res, next) {
	let userid = req.session.userid;
	let restaurant = req.restaurant;

	for (let i = 0; i < restaurant.grades.length; i++){
		if (restaurant.grades[i].user == userid) {
			return res.render('error', {
				error: 'You cannot rate a restaurant twice',
				back: '/display?_id=' + req.query._id
			});
		}
	}

	next();
}

app.get('/', isLogin, function(req, res) {
	res.redirect('/read');
});

app.get('/login', function(req, res) {
	req.session = null;
	res.render('login');
});

app.post('/login', function(req, res) {
	let userid = req.body.userid;

	User.findOne(req.body, function(err, result) {
		if (err) {
			return res.render('error', {
				error: err,
				back: '/login'
			});
		}

		if (!result) {
			return res.render('error', {
				error: 'Username / password not match',
				back: '/login'
			});
		}

		req.session.userid = result.userid;
		res.redirect('/read');
	});
});

app.get('/logout', isLogin, function(req, res) {
	req.session = null;
	res.redirect('/login');
});

app.get('/register', function(req, res) {
	req.session = null;
	res.render('register');
});

app.post('/register', function(req, res) {
	let userid = req.body.userid;

	if (!req.body.userid) return res.render('error', { error: 'Username is empty', back: '/register' });
	if (!req.body.password) return res.render('error', { error: 'Password is empty', back: '/register' });

	User.findOne({ userid: userid }, function(err, result) {
		if (err) return res.render('error', { error: err, back: '/register' });
		if (result) return res.render('error', { error: 'Username is used', back: '/register' });

		let user = new User(req.body);
		user.validate(function(err) {
			if (err) return res.render('error', { error: err, back: '/register' });

			user.save(function(err) {
				if (err) return res.render('error', { error: err, back: '/register' });

				req.session.userid = user.userid;
				res.redirect('/read');
			});
		});
	});
});

app.get('/gmap', function(req, res) {
	res.render('gmap', {
		lat: req.query.lat,
		lon: req.query.lon,
		zoom: 13,
		title: req.query.title
	});
});

app.get('/new', isLogin, function(req, res) {
	res.render('create', {
		userid: req.session.userid,
		search: req.session.search || ''
	});
});

app.post('/new', isLogin, function(req, res) {
	let userid = req.session.userid;

	let obj = {
		name: req.body.name,
		borough: req.body.borough,
		cuisine: req.body.cuisine,
		address: {
			street: req.body.street,
			building: req.body.building,
			zipcode: req.body.zipcode,
			coord: {
				latitude: req.body.latitude,
				longtitude: req.body.longtitude
			}
		},
		grades: [],
		userid: userid,
		photo: '',
		mimetype: ''
	};

	if (req.files.photo.name) {
		let photo = req.files.photo;
		obj.photo = new Buffer(photo.data).toString('base64');
		obj.mimetype = photo.mimetype;
	}

	let restaurant = new Restaurant(obj);
	restaurant.validate(function(err) {
		if (err) {
			return res.render('error', {
				error: err,
				back: '/read' + (req.session.search || '')
			});
		}

		restaurant.save(function(err) {
			if (err) {
				return res.render('error', {
					error: err,
					back: '/read' + (req.session.search || '')
				});
			}

			res.redirect('/display?_id=' + restaurant._id);
		});
	});
});

app.get('/read', isLogin, function(req, res) {
	let userid = req.session.userid;

	let criteria = {};
	if (req.query.name) criteria.name = req.query.name;
	if (req.query.borough) criteria.borough = req.query.borough;
	if (req.query.cuisine) criteria.cuisine = req.query.cuisine;
	
	Restaurant.find(criteria, function(err, results) {
		if (err) {
			return res.render('error', {
				error: err,
				back: '/read' + (req.session.search || '')
			});
		}

		let query = Url.parse(req.url || '').query;
		if (query) req.session.search = '?' + query;

		res.render('catalog', {
			criteria: JSON.stringify(criteria),
			restaurants: results,
			search: req.session.search || ''
		});
	});
});

app.get('/display', isLogin, isObjectIdValid, getRestaurant, function(req, res) {
	let userid = req.session.userid;
	let restaurant = req.restaurant;

	res.render('restaurant', {
		restaurant: restaurant,
		search: req.session.search || ''
	});
});

app.get('/change', isLogin, isObjectIdValid, getRestaurant, isOwner, function(req, res) {
	let userid = req.session.userid;
	let restaurant = req.restaurant;

	res.render('edit', {
		restaurant: restaurant
	});
});

app.post('/change', isLogin, isObjectIdValid, getRestaurant, isOwner, function(req, res) {
	let userid = req.session.userid;
	let restaurant = req.restaurant;

	restaurant.name = req.body.name;
	restaurant.borough = req.body.borough;
	restaurant.cuisine = req.body.cuisine;
	restaurant.address.street = req.body.street;
	restaurant.address.building = req.body.building;
	restaurant.address.zipcode = req.body.zipcode;
	restaurant.address.coord.latitude = req.body.latitude;
	restaurant.address.coord.longtitude = req.body.longtitude;

	if (req.files.photo.name) {
		let photo = req.files.photo;
		restaurant.photo = new Buffer(photo.data).toString('base64');
		restaurant.mimetype = photo.mimetype;
	}

	restaurant.validate(function(err) {
		if (err) {
			return res.render('error', {
				error: err,
				back: '/read' + (req.session.search || '')
			});
		}

		restaurant.save(function(err) {
			if (err) {
				return res.render('error', {
					error: err,
					back: '/read' + (req.session.search || '')
				});
			}

			res.redirect('/display?_id=' + restaurant._id);
		});
	});
});

app.get('/remove', isLogin, isObjectIdValid, getRestaurant, isOwner, function(req, res) {
	let userid = req.session.userid;
	let restaurant = req.restaurant;

	restaurant.remove(function(err) {
		if (err) {
			return res.render('error', {
				error: err,
				back: '/read' + (req.session.search || '')
			});
		}

		res.render('info', {
			info: 'The restaurant has been deleted',
			back: '/read' + (req.session.search || '')
		});
	});
});

app.get('/rate', isLogin, isObjectIdValid, getRestaurant, isFirstRate, function(req, res) {
	let userid = req.session.userid;
	let restaurant = req.restaurant;

	res.render('rate', {
		userid: userid,
		restaurant: restaurant
	});
});

app.post('/rate', isLogin, isObjectIdValid, getRestaurant, isFirstRate, function(req, res) {
	let userid = req.session.userid;
	let restaurant = req.restaurant;

	restaurant.grades.push({ score: req.body.score, user: userid });

	restaurant.validate(function(err) {
		if (err) {
			return res.render('error', {
				error: err,
				back: '/read' + (req.session.search || '')
			});
		}

		restaurant.save(function(err) {
			if (err) {
				return res.render('error', {
					error: err,
					back: '/read' + (req.session.search || '')
				});
			}

			res.render('info', {
				info: 'Thank you for rating the restaurant',
				back: '/display?_id=' + restaurant._id
			});
		});
	});
});

app.post('/api/create', function(req, res) {
	req.body.address = req.body.address || {};
	req.body.address.coord = req.body.address.coord || {};

	let userid = req.session.userid;
	let obj = {
		name: req.body.name,
		borough: req.body.borough,
		cuisine: req.body.cuisine,
		address: {
			street: req.body.address.street,
			building: req.body.address.building,
			zipcode: req.body.address.zipcode,
			coord: {
				latitude: req.body.address.coord.latitude,
				longtitude: req.body.address.coord.longtitude
			}
		},
		grades: [],
		userid: userid,
		photo: '',
		mimetype: ''
	};

	let restaurant = new Restaurant(obj);
	restaurant.validate(function(err) {
		if (err) return res.json({ status: 'failed' });

		restaurant.save(function(err) {
			if (err) return res.json({ status: 'failed' });
			res.json({ status: 'ok', _id: restaurant._id });
		});
	});
});

app.get('/api/read/:field/:keyword', function(req, res) {
	if (['name', 'borough', 'cuisine'].indexOf(req.params.field) == -1) {
		return res.json({});
	}

	let criteria = {};
	criteria[req.params.field] = req.params.keyword;

	Restaurant.find(criteria, function(err, results) {
		if (err) return res.json({});
		if (results.length > 0) return res.json(results);
		res.json({});
	});
});

module.exports = exports = app;
