
/**
 * Get express, make an app and serve static
 * files on port 8080.
 */
var express = require('express');
var app = express();
app.use(express.static(__dirname + '/public'));
app.listen(8080);

/**
 * Create a new WebSocket server.
 */
var WebSocketServer = require("ws").Server;
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
var courses = ['inda', 'tilda', 'numme'].map(function (name) {
	return {
		name: name,
		size: 0,
		open: true,
		active: true
	};
});

/**
 * Sends the list of courses to the client.
 */
app.get('/api/list', function (req, res) {
	respondWithJSON(res, courses)
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
 * A flunent function returns this.
 *
 * @param {Function} fn
 * @return {Function}
 */
function fluent(fn) {
	return function () {
		fn.apply(this, arguments);
		return this;
	}
}

/**
 * A QueueRoom consists of a number
 * of queuing students and connections
 * interested in updates to the queue.
 */
function QueueRoom() {
	this.listeners = [];
	this.queue = [];
}

QueueRoom.prototype = {
	addListener: fluent(function (socket) {
		this.listeners.push(socket);
	}),

	removeListener: fluent(function (socket) {
		var i = this.listeners.indexOf(socket);

		if (i !== -1) {
			this.listeners.splice(i, 1);
		}
	}),

	forListener: fluent(function (fn) {
		this.listeners.forEach(fn);
	}),

	addUser: fluent(function (user) {
		this.queue.push(user);
	}),

	removeUser: fluent(function (username) {
		this.queue = this.queue.filter(function (user) {
			return user.name !== username;
		});
	}),

	forUser: fluent(function (fn) {
		this.queue.forEach(fn);
	}),

	updateUser: fluent(function (name, user) {
		this.queue.forEach(function (usr, i, queue) {
			if (usr.name === name) {
				queue[i] = user;
			}
		});

		this.forListener(notify('queue/update', name, user));
	})
};

/**
 * The current list of queues.
 */
var queues = {};
courses.forEach(function (course) {
	queues[course.name] = new QueueRoom();
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
	return getRoom(name).queue;
}

/**
 * @param {string} name
 * @return {Array} queue
 */
function getListers(name) {
	return getRoom(name).listeners;
}

/**
 * Removes the client from it's channel.
 * @param {WebSocket} socket
 */
function removeClient(socket) {
	try {
		var extra = socketExtras.get(socket);

		// extra.rooms.forEach(function (room) {
		// 	getRoom(room).removeListener(socket);
		// });

		extra.listeners.forEach(function (room) {
			getRoom(room).removeListener(socket);
		});

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
		// var extra = socketExtras.get(this);

		// if (extra.name !== user.name) {
		// 	extra.rooms.forEach(function (room) {
		// 		room.updateUser(extra.name, user);
		// 	});

		// 	extra.name = user.name;
		// }

		console.log(user.name + " queued up to " +
			(user.action == 'H' ? 'ask for help' : 'present' ) +
			' for ' + course);

		getRoom(course)
			.addUser(user)
			.forListener(notify("queue/add", course, user));
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
	} catch (e) {
		console.error(e);
	}
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
