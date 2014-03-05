var express = require('express');

var app = express();

//app.use('/media', express.static(__dirname + '/media'));
app.use(express.static(__dirname + '/public'));

app.listen(8080);

var WebSocketServer = require("ws").Server;

var wss = new WebSocketServer({port: 8000});

var socketExtras = new Map();

wss.on('connection', function (ws) {
	console.log("Client connected!");

	socketExtras.set(ws, {listeners: [], queues: []});

	ws.on('message', function (message) {
		try {
			commandFrom(ws, parseMessage(message));
		} catch (e) {
			if (e instanceof Error) {
				e = JSON.stringify([e.message]);
			}
			ws.send("error:" + e);
		}
	});

	ws.on('close', function () {
		console.log("Client disconnected!");
		removeClient(ws);
	});
});

function respondWithJSON(res, data) {
	res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

var courses = ['inda', 'tilda', 'numme'];

app.get('/api/list', function (req, res) {
	respondWithJSON(res, courses)
});

app.get('/api/list/:course', function (req, res) {
	try {
		respondWithJSON(res, getQueue(req.params.course));

	} catch (e) {
		res.status(404);
		return respondWithJSON(res, e.message);
	}
});

function QueueRoom() {
	this.listeners = [];
	this.queue = [];
}

QueueRoom.prototype = {
	addListener: function (socket) {
		this.listeners.push(socket);
	},

	removeListener: function (socket) {
		var i = this.listeners.indexOf(socket);

		if (i !== -1) {
			this.listeners.splice(i, 1);
		}
	},

	forListener: function (fn) {
		this.listeners.forEach(fn);
	},

	addQueuer: function (user) {
		this.queue.push(user);
	},

	removeQueuer: function (username) {
		this.queue = this.queue.filter(function (user) {
			return user.name !== username;
		})
	},

	forQueuer: function (fn) {
		this.queue.forEach(fn);
	}
};

var queues = {};
var clientChannel = new Map;

courses.forEach(function (course) {
	queues[course] = new QueueRoom();
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
 * Adds the client to the channel.
 * @param {WebSocket} ws
 * @param {string} name
 */
function addClientTo(ws, name) {
	var chan = getQueue(name);

	clientChannel.set(ws, chan);
	chan.push(ws);
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
 * @param {WebSocket} ws
 */
function channelOf(ws) {
	return clientChannel.get(ws);
}

/** @type {Map.<string, Function>} */
var commands = new Map();

commands.set("queue/listen", function (course) {
	try {
		var room = getRoom(course);
		room.addListener(this);
	} catch (e) {
		console.error(e);
	}
});

commands.set("queue/mute", function (course) {
	try {
		var room = getRoom(course);
		room.removeListener(this);
	} catch (e) {
		console.error(e);
	}
});

commands.set("queue/add", function (course, user) {
	try {
		console.log(user.name + " queued up to " +
			(user.action == 'H' ? 'ask for help' : 'present' ) +
			' for ' + course);

		var room = getRoom(course);
		room.addQueuer(user);
		room.forListener(notify("queue/add", course, user));
	} catch (e) {
		console.error(e);
	}
});

commands.set("queue/remove", function (course, username) {
	try {
		console.log(username + " left the " + course + ' queue.');

		var room = getRoom(course);
		room.removeQueuer(username);
		room.forListener(notify("queue/remove", course, username));
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
function commandFrom(ws, command) {
	/** @type {Function} */
	var cmd = commands.get(command.type);

	if (cmd) {
		cmd.apply(ws, command.params);
	} else {
		throw new Error("No such command: " + command.type);
	}
}
