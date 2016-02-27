'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ImageSearch = new Schema({
	terms: String,
    date:Date 
});

module.exports = mongoose.model('ImageSearch', ImageSearch);
