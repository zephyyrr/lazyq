var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var _ = require('lodash');
var async = require('async');

var util = require('./util.js');
var fluent = util.fluent;
var saving = util.saving;

var statisticSchema = new Schema({
	name: String,
	time: { type: Number, default: Date.now },
	action: String,
	leftQueue: { type: Boolean, default: false },
	queLength: { type: Number, default: 0}
});

statisticSchema.index({time: 1});
var Statistic = mongoose.model("Statistic", statisticSchema);

var userSchema = new Schema({
	name: String,
	time: { type: Number, default: Date.now },
	action: String,
	comment: { type: String, default: '' }
});

userSchema.methods.toJSON = function () {
	return {
		name: this.name,
		time: this.time,
		action: this.action,
		comment: this.comment
	};
};

var User = mongoose.model("User", userSchema);

var courseSchema = new Schema({
	name: String,
	open: { type: Boolean, default: true },
	active: { type: Boolean, default: true },
	queue : [userSchema]
});

courseSchema.methods.addUser = fluent(saving(function (user) {
	this.queue.push(user);
	var stat = new Statistic({
		name: this.name, 
		time: Date.now(), 
		action: user.action, 
		leftQueue: false, 
		queLength:  this.queue.length});
	stat.save();
}));

courseSchema.methods.removeUser = fluent(saving(function (username) {
	getStatistics(this.name, Date.now()-30000, Date.now())
	var courseName = this.name;
	this.queue = this.queue.filter(function (user) {
		if (user.name === username) {
			var stat = new Statistic({
				name: courseName, 
				time: Date.now(), 
				action: user.action, 
				leftQueue: true, 
				queLength:  this.queue.length});
			stat.save()
		};
		return user.name !== username;
	});
}));

courseSchema.methods.forUser = fluent(saving(function (fn) {
	this.queue.forEach(fn);
}));

courseSchema.methods.updateUser = fluent(saving(function (name, user) {
	this.queue.forEach(function (usr, i, queue) {
		if (usr.name === name) {
			_.extend(queue[i], user);
		}
	});
}));

var Course = mongoose.model("Course", courseSchema);

function getStatistics(course, start, end){

	Statistic.find({name: course, time: {"$gte": start, "$lt": end}},function (err, stats) {
	  if (err) return console.error(err);
	  console.log(stats) 
	  console.log(stats.length)
	})

	var now = new Date();
	var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	var timeStamp = today.getTime();

	Statistic.count({
		name: course, 
		leftQueue: false, 
		action:"H", 
		time: {"$gte": timeStamp, "$lt": end}},
		function (err, amount) {
	  	if (err) return console.error(err);
	  	console.log("Number of people queued for help today: " + amount + "\n")
	})

	Statistic.count({
		name: course, 
		leftQueue: false, 
		action:"P", 
		time: {"$gte": timeStamp, "$lt": end}},
		function (err, amount) {
		  if (err) return console.error(err);
		  console.log("Number of people queued for presentation today: " + amount + "\n")
	})

	async.parallel([
    function(callback){
      Statistic.count({name: course, 
      	leftQueue: false, 
      	time: {"$gte": timeStamp, "$lt": end}},
    	function (err, amount) {
        callback(null, amount);
      });
	   },
    function(callback){
      Statistic.count({name: course, 
      	leftQueue: true, 
      	time: {"$gte": timeStamp, "$lt": end}},
    	function (err, amount) {
        callback(null, amount);
      });
	   }
	],
	// optional callback
	function(err, results){
		console.log("res data",results)
	    // the results array will equal ['one','two'] even though
	    // the second function had a shorter timeout.
	});

}


module.exports = {
	User: User,
	Course: Course,
	Statistic: Statistic,
	getStatistics: getStatistics
};