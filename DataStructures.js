var util = require('./util.js');

var not = util.not;
var eq = util.eq;
var fluent = util.fluent;

/**
 * A set of sockets. Used for listeners.
 */
function SocketSet() {
	this.sockets = [];
}

SocketSet.prototype = {
	add: function (socket) {
		if (!this.has(socket)) {
			this.sockets.push(socket);
		}
	},

	remove: function (socket) {
		this.sockets = this.sockets.filter(not(eq(socket)));
	},

	has: function (socket) {
		return this.sockets.some(eq(socket));
	},

	forEach: function (fn) {
		this.sockets.forEach(fn);
	}
};

/**
 * A QueueRoom consists of a number
 * of queuing students and connections
 * interested in updates to the queue.
 *
 * @param {mongoose.Course} course
 */
function QueueRoom(course) {
	this.courseData = course;

	this.listeners = new SocketSet();

	this.toJSON = function () {
		var d = this.courseData;

		return {
			name: d.name,
			size: d.queue.length,
			active: d.active,
			open: d.open
		};
	};
}

// QueueRoom.fromName = function (name) {
// 	var courseData = _.extend(Object.create(courseDataProto), {
// 		name: name,
// 		queue: [],
// 		open: true,
// 		active: true
// 	});

// 	return new QueueRoom(courseData);
// };

// var courseDataProto = _.extend({
// 	save: function () {}
// }, courseSchema.methods, {
// 	save: function () {},
// 	addUser: function (user) {
// 		this.queue.push(user);
// 	}
// });

QueueRoom.prototype = {
	updateWith: fluent(function (data) {
		if (typeof data.name === 'string' && this.name !== data.name) {
			queues[this.name] = undefined;
			queues[data.name] = this;
			this.name = data.name;
		}

		if (typeof data.open === 'boolean') {
			this.open = data.open;
		}

		if (typeof data.active === 'boolean') {
			this.active = data.active;
		}
	}),

	addListener: fluent(function (socket) {
		this.listeners.add(socket);
	}),

	removeListener: fluent(function (socket) {
		this.listeners.remove(socket);
	}),

	forListener: fluent(function (fn) {
		this.listeners.forEach(fn);
	}),

	addUser: fluent(function (user) {
		this.courseData.addUser(user);
	}),

	removeUser: fluent(function (username) {
		this.courseData.removeUser(username);
	}),

	forUser: fluent(function (fn) {
		this.courseData.forUser(fn);
	}),

	updateUser: fluent(function (name, user) {
		this.courseData.updateUser(name, user);
	})
};

module.exports.QueueRoom = QueueRoom;

module.exports.SocketSet = SocketSet;
