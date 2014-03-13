
/**
 * Get express, make an app and serve static
 * files on port 8080.
 */
var express					= require('express');
var _								= require('lodash');
var mongoose				= require('mongoose');
var WebSocketServer = require("ws").Server;

var structs = require('./DataStructures.js');
var SocketSet = structs.SocketSet;
var QueueRoom = structs.QueueRoom;

var util = require('./util.js');
var not = util.not;
var eq = util.eq;
var fluent = util.fluent;
var saving = util.saving;

var app = express();
app.use(express.static(__dirname + '/public'));
app.listen(8080);


/**
 * Establish a connection to MongoDB
 */
mongoose.connect('mongodb://localhost/test');

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function callback () {
  // yay!
});

var Schema = mongoose.Schema;

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
}));

courseSchema.methods.removeUser = fluent(saving(function (username) {
	this.queue = this.queue.filter(function (user) {
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

var statisticSchema = new Schema({
	name: String,
	time: { type: Number, default: Date.now },
	action: String,
	leftQueue: { type: Boolean, default: false }
});

var Statistic = mongoose.model("Statistics", statisticSchema);

// var ingmarmnmn = new User({name: "ingmarmnmn", time: Date.now(), action:"h", comment:"lol"});
// var robert = new User({name: "robert", time: Date.now() + 100, action:"R", comment:"hej"});
// var oscar = new User({name: "oscar", time: Date.now() + 200, action:"h", comment:"din"});
// var johan = new User({name: "johan", time: Date.now() + 400, action:"h", comment:"mamma"});

var tilda = new QueueRoom(new Course({name: "tilda"}));
var inda = new QueueRoom(new Course({name: "inda"}));
var prgx = new QueueRoom(new Course({name: "prgx"}));
//tilda.addUser(robert);

// ingmarmnmn.save();
// robert.save();
// oscar.save();
// johan.save();

// //inda.listeners = [];
// inda.queue.push(robert);
// inda.queue.push(johan);
// inda.queue.push(ingmarmnmn);
// tilda.queue.push(oscar);

// inda.save();
// tilda.save();
// prgx.save();

// robert.save();

/**
 * Create a new WebSocket server.
 */
var wss = new WebSocketServer({port: 8000});
var socketExtras = new Map();

/**
 * Websocket handling.
 */
wss.on('connection', function (ws) {
	console.log("Client connected!");

	/**
	 * Every socket has a set of extras.
	 * The purpose of these is to handle removal of
	 * the socket once it is disconnected.
	 */
	socketExtras.set(ws, {
		listeners: [],
		queues: [],
		name: null
	});

	/**
	 * Messages are parsed and commands are executed.
	 * Errors are sent back to the client.
	 */
	ws.on('message', function (message) {
		try {
			executeCommandFrom(ws, parseMessage(message));
		} catch (e) {
			if (e instanceof Error) {
				e = JSON.stringify([e.name, e.message]);
			}
			ws.send("error:" + e);
		}
	});

	/**
	 * When a connection is closed,
	 * the socket is thoroughly removed.
	 */
	ws.on('close', function () {
		console.log("Client disconnected!");
		removeClient(ws);
	});
});

/**
 * @param {string} message
 * @return {{type: string, params: Array}}
 */
function parseMessage(message) {
	var colon = message.indexOf(":");

	if (colon === -1) {
		throw JSON.stringify(["Invalid format! Should be, command:JSON"]);
	}

	return {
		type: message.slice(0, colon),
		params: JSON.parse(message.slice(colon+1))
	};
}

/**
 * @param {WebSocket} ws
 * @param {{type: string, params: Array}} command
 */
function executeCommandFrom(ws, command) {
	/** @type {Function} */
	var cmd = commands.get(command.type);

	if (cmd) {
		cmd.apply(ws, command.params);
	} else {
		throw new Error("No such command: " + command.type);
	}
}

function respondWithJSON(res, data) {
	res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * TODO: database
 * Initial course representation.
 */
var courses = ['inda', 'tilda', 'numme'];

var courseListeners = new SocketSet();

/**
 * The current list of queues.
 */
var queues = {};
// {
// 	'tilda': tilda,
// 	'inda': inda,
// 	'prgx': prgx
// };

Course.find(function (err, courses) {
	if (err) {
		console.error('Could not find any courses', err);
		return;
	}

	courses.forEach(function (course) {
		queues[course.name] = new QueueRoom(course);
	});
});

// courses.forEach(function (course) {
// 	queues[course] = QueueRoom.fromName(course);
// });

/**
 * Sends the list of courses to the client.
 */
app.get('/api/list', function (req, res) {
	respondWithJSON(res, Object.keys(queues).map(getRoom));
});

/**
 * Sends the queue of a given course to the client.
 * 404 if no such course.
 */
app.get('/api/list/:course', function (req, res) {
	try {
		respondWithJSON(res, getQueue(req.params.course));

	} catch (e) {
		res.status(404);
		return respondWithJSON(res, e.message);
	}
});

/**
 * @param {string} name
 * @return {QueueRoom} queue
 */
function getRoom(name) {
	var chan = queues[name];

	if (!chan) {
		throw new Error('No such course: ' + name + '!');
	}

	return chan;
}

/**
 * @param {string} name
 * @return {Array} queue
 */
function getQueue(name) {
	return getRoom(name).courseData.queue;
}

/**
 * Removes the client from it's channel.
 * @param {WebSocket} socket
 */
function removeClient(socket) {
	try {
		var extra = socketExtras.get(socket);

		extra.listeners.forEach(function (room) {
			getRoom(room).removeListener(socket);
		});

		courseListeners.remove(socket);

	} catch (e) {
		console.error(e);
	}
}

/**
 * commands, maps a command string to a function to execute.
 *
 * @type {Map.<string, Function>}
 */
var commands = new Map();

commands.set("queue/listen", function (course) {
	try {
		socketExtras.get(this).listeners.push(course);
		getRoom(course).addListener(this);
	} catch (e) {
		console.error(e);
	}
});

commands.set("queue/mute", function (course) {
	try {
		var l = socketExtras.get(this).listeners;
		l.slice(l.indexOf(course), 1);
		getRoom(course).removeListener(this);
	} catch (e) {
		console.error(e);
	}
});

commands.set("queue/add", function (course, user) {
	try {
		console.log(user.name + " queued up to " +
			(user.action == 'H' ? 'ask for help' : 'present' ) +
			' for ' + course);

		getRoom(course)
			.addUser(user)
			.forListener(notify("queue/add", course, user));

		courseListeners.forEach(notify("courses/update", course,
			{size: getQueue(course).length}));
	} catch (e) {
		console.error(e);
	}
});

commands.set("queue/update", function (course, username, user) {
	try {
		console.log(username + " got " + JSON.stringify(user) + " updated.");
		getRoom(course)
			.updateUser(username, user)
			.forListener(notify("queue/update", course, username, user));
	} catch (e) {
		console.error(e);
	}
});

commands.set("queue/remove", function (course, username) {
	try {
		console.log(username + " left the " + course + ' queue.');

		getRoom(course)
			.removeUser(username)
			.forListener(notify("queue/remove", course, username));

		courseListeners.forEach(notify("courses/update", course,
			{size: getQueue(course).length}));
	} catch (e) {
		console.error(e);
	}
});

commands.set("courses/listen", function () {
	courseListeners.add(this);
});

commands.set("courses/update", function (courseName, course) {
	try {
		console.log(courseName + " got " + JSON.stringify(course) + " updated.");

		getRoom(courseName)
			.updateWith(course);

		courseListeners.forEach(notify("courses/update", courseName, course));
	} catch (e) {
		console.error(e);
	}
});

commands.set("courses/mute", function () {
	courseListeners.remove(this);
});

/**
 * @param {string} command
 * @param {...?} data
 */
function notify(command) {
	var data = Array.prototype.slice.call(arguments, 1);
	return function (socket) {
		socket.send(command + ":" + JSON.stringify(data));
	}
}
