'use strict';

var request = require('request'),
	multer =require('multer'),
	upload = multer({ dest: 'uploads/' }),
	path = process.cwd(),
	ClickHandler = require(path + '/app/controllers/clickHandler.server.js');

var Url = require('../models/urlshrt');
var ImageSearch = require('../models/imageSearch');

module.exports = function (app, passport) {

	function isLoggedIn (req, res, next) {
		if (req.isAuthenticated()) {
			return next();
		} else {
			res.redirect('/login');
		}
	}

	var clickHandler = new ClickHandler();
	

	app.route('/')
		.get(isLoggedIn, function (req, res) {
			res.sendFile(path + '/public/index.html');
		});

	app.route('/login')
		.get(function (req, res) {
			res.sendFile(path + '/public/login.html');
		});

	app.route('/logout')
		.get(function (req, res) {
			req.logout();
			res.redirect('/login');
		});

	app.route('/profile')
		.get(isLoggedIn, function (req, res) {
			res.sendFile(path + '/public/profile.html');
		});

	app.route('/api/:id')
		.get(isLoggedIn, function (req, res) {
			res.json(req.user.github);
		});

	app.route('/auth/github')
		.get(passport.authenticate('github'));

	app.route('/auth/github/callback')
		.get(passport.authenticate('github', {
			successRedirect: '/',
			failureRedirect: '/login'
		}));

	app.route('/api/:id/clicks')
		.get(isLoggedIn, clickHandler.getClicks)
		.post(isLoggedIn, clickHandler.addClick)
		.delete(isLoggedIn, clickHandler.resetClicks);


	// Added Routes for API projects //

	// Timestamp API project
	app.route('/timestamp')
		.get((req, res) => {
			res.sendFile(path + '/public/timestamp.html');
	});
	app.route('/timestamp/:query')
		.get((req, res) => {
		var queryDate = req.params.query,
		    months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], 
		    dateObj = {};
	
		if(+queryDate){
			dateObj.unix = queryDate;
			var nDate = new Date(queryDate * 1000);
			dateObj.natural = months[nDate.getMonth()] + ' ' + nDate.getDate() + ', ' + nDate.getFullYear();	
		}else if(!isNaN(Date.parse(queryDate)) ){
			dateObj.unix = Date.parse(queryDate) / 1000;
			dateObj.natural = queryDate;
		}else{
			dateObj.unix = null;
			dateObj.natural = null;
		}
			
		res.end(JSON.stringify(dateObj));
	});
	
	// Headers API Project
	app.route('/headers')
		.get( (req, res) => {
			var headersObj = {},
			    reg = /(?:\()([\w\s\d;]+)(?:\))/,
		            userFiltered = reg.exec(req.headers['user-agent']);
			    
			
			headersObj.ip = req.headers['x-forwarded-for'],
			headersObj.lang = req.headers['accept-language'].split(',')[0],
			headersObj.software = userFiltered[1];
			
			res.end(JSON.stringify(headersObj));

	});
	
	// Url Shortener Microservice
	app.route('/shrt')
		.get( (req, res) => {
			res.sendFile(path + '/public/url.html');
	});
	
	app.route('/shrt/:url')
		.get( (req, res) => {
			
			var fullUrl = 'https://' + req.get('host') + req.originalUrl;
			Url.findOne( { 'shortened': fullUrl }, (err, data) => {
				if(err) throw err;
				
				if(data){
					res.writeHead(301, { Location: data.original });
					res.end();
				}
					
					
			})
			
	});
	
	app.route('/shrt/new/:url*')
		.get( (req, res) => {
			var url = req.params.url + req.params[0],
				reg = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/,
				urlObj = {},
				randomStr = Math.random().toString(36).substring(2, 5);
			
			
			if(!reg.test(url)){
				urlObj.error = 'Invalid URL';
			}else{
				urlObj.original = url;
				urlObj.shortened = "https://fcc-api-projects-g-kanoufi.c9users.io/shrt/" + randomStr;
				
				
				Url.findOne({ 'original' : url }, (err, content) => {
					if(err)	 throw err;
					
					if(content){
						urlObj.shortened = content.shortened;
					}else{
						var newObj = new Url();
						newObj.original = urlObj.original;
						newObj.shortened = urlObj.shortened;
						newObj.save( (err, data) => {
							if(err) throw err;
							return data;
						});
					}
					res.send(JSON.stringify(urlObj));
				});
			}
	});
	
	// Image search abstraction layer API
	app.route('/img')
		.get((req, res) => {
			res.sendFile(path + '/public/img.html');
	});
	
	app.route('/img/latest')
		.get( (req, res) => {
		
		ImageSearch.find({}, {__v: 0, _id:0}, (err, content) => {
			if(err) throw new Error(err);
			
			res.send(content);
		}).limit(10).sort({date: -1});
				
	});
	app.route('/img/search/:query')
		.get( (req, res) => {
		
		console.log(req.params, req.query);
		var query = req.params.query,
			page = req.query.page - 1 || 0,
		    options = {
        		uri: 'https://api.imgur.com/3/gallery/search/top/' + page + '/?q=' + query,
        		headers: {
            		'Authorization': 'Client-ID ' + process.env.IMGUR_CLIENT
        		}
		    };
		    
		request.get(options, (err, response, body) => {
			if(err) throw err;
			
			var content = JSON.parse(body)['data'],
			    search = new ImageSearch();
			
			search.terms = query;
			search.date = Date.now();
			
			search.save((err, data) => {
				if(err) throw new Error(err);
				return data;
			});
			res.send(content.map( (part) => {
				return {
					id: part.id,
					url: part.link,
					snippet: part.title
				}
			}));
			
		});
	});
	
	// File metadata API
	
	app.route('/file')
		.get( (req, res) => {
		
		res.render( path + '/public/file.jade')		
	})
		.post( upload.single('file_upload'), (req, res) => {
			console.log(req.file);
			res.render(path + '/public/file.jade', {file : JSON.stringify(req.file.originalname) + 'size is: ' + JSON.stringify(req.file.size) + ' bytes'});
			
		});
};
