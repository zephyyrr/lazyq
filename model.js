var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var _ = require('lodash');

var util = require('./util.js');
var fluent = util.fluent;
var saving = util.saving;

var statisticSchema = new Schema({
	name: String,
	time: { type: Number, default: Date.now },
	action: String,
	leftQueue: { type: Boolean, default: false }
});

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
		var stat = new Statistic({name: this.name, time: Date.now(), action: user.action, leftQueue: false});
		stat.save();
}));

courseSchema.methods.removeUser = fluent(saving(function (username) {
	var courseName = this.name;
	this.queue = this.queue.filter(function (user) {
		if (user.name === username) {
			var stat = new Statistic({name: courseName, time: Date.now(), action: user.action, leftQueue: true});
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




module.exports = {
	User: User,
	Course: Course,
	Statistic: Statistic
};