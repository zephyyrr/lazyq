
/**
 * Get express, make an app and serve static
 * files on port 8080.
 */
var express	= require('express');
var _	= require('lodash');
var mongoose = require('mongoose');
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

var model = require('./model.js');
var User = model.User;
var Statistic = model.Statistic;
var Course = model.Course;


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
var courses = [];

var courseListeners = new SocketSet();

/**
 * The current list of queues.
 */
var queues = {};

Course.find(function (err, courses) {
	if (err) {
		console.error('Could not find any courses', err);
		return;
	}

	courses.forEach(function (course) {
		queues[course.name] = new QueueRoom(course);
	});
});

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


commands.set("queue/broadcast", function (course, message) {
	try {
		console.log(JSON.stringify(course) + " is sent " + JSON.stringify(message) + " message");
		getRoom(course)
			.forListener(notify("queue/broadcast", course, message));
	} catch (e) {
		console.error(e);
	}
});

commands.set("course/add", function (courseName) {
	try {
		console.log("Course: " + courseName + " is added");
		newCourse = new Course({name: courseName});
		newCourse.save();
		queues[courseName] = new QueueRoom(newCourse);
		
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

setUpAutoPurge();

function setUpAutoPurge (argument) {
	var middnight = new Date();
	middnight.setHours(23);
	middnight.setMinutes(58);
	console.log("minutes to purge",(middnight.getTime() - Date.now())/60/1000);
	middnight = middnight.getTime() - Date.now();

	setTimeout(autoPurgeUsers, middnight);
}

function autoPurgeUsers () {
	purgeUsers();
	setInterval(purgeUsers, 24*60*60*1000);
}

/**
 * Purges all the users from all the queues
 */
function purgeUsers(){
	for(var courseName in queues) {
  	console.log(queues[courseName].courseData.name);
  	queues[courseName].courseData.queue.forEach(function (user) {
		console.log(user.name);
			removeUser(courseName, user);
		})
	}
}

function removeUser (courseName, user) {
	getRoom(courseName).removeUser(user.name)
	.forListener(notify("queue/remove", courseName, user.name));

	courseListeners.forEach(notify("courses/update", courseName,
		{size: getQueue(courseName).length}));
}


// var test1 = new QueueRoom(new Course({name: "test1"}));
// var test2 = new QueueRoom(new Course({name: "test2"}));
// var test3 = new QueueRoom(new Course({name: "test3"}));
// queues = 
// {length
// 	'test1': test1,
// 	'test2': test2,
// 	'test3': test3
// };