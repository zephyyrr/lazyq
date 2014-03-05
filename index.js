var express = require('express');

var app = express();

//app.use('/media', express.static(__dirname + '/media'));
app.use(express.static(__dirname + '/public'));

app.listen(8080);

var WebSocketServer = require("ws").Server;

var wss = new WebSocketServer({port: 8000});

wss.on('connection', function (ws) {
	console.log("Client connected!");

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
		respondWithJSON(res, getChannel(req.params.course).map(function (obj) {
			return {
				name: 'unknown',
				action: '?',
				comment: '<blank>'
			};
		}));

	} catch (e) {
		res.status(404);
		return respondWithJSON(res, e.message);
	}
});

/**
 * Nice encapsulation
 */
var addClientTo, removeClient, chanOf, logChannels, getChannel;
(function () {
	var channels = {};
	var clientChannel = new Map;

	courses.forEach(function (course) {
		channels[course] = [];
	});

	/**
	 * @param {string} name
	 * @return {!Array|undefined} queue
	 */
	getChannel = function (name) {
		var chan = channels[name];

		if (!chan) {
			throw new Error('No such course: ' + name + '!');
		}

		return chan;
	};

	/**
	 * Adds the client to the channel.
	 * @param {WebSocket} ws
	 * @param {string} name
	 */
	addClientTo = function (ws, name) {
		var chan = getChannel(name);

		clientChannel.set(ws, chan);
		chan.push(ws);
	};

	/**
	 * Removes the client from it's channel.
	 * @param {WebSocket} ws
	 */
	removeClient = function (ws) {
		var chan = clientChannel.get(ws);

		if (chan) {
			clientChannel.delete(ws);
			chan.splice(chan.indexOf(ws), 1);
		}
	};

	/**
	 * @param {WebSocket} ws
	 */
	channelOf = function (ws) {
		return clientChannel.get(ws);
	};

	logChannels = function () {
		console.log(channels);
	};
})();

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

/** @type {Map.<string, Function>} */
var commands = new Map();

commands.set("echo", function (x) {
	this.send("result:" + JSON.stringify([x]));
});

commands.set("course", function (name) {
	removeClient(this);
	addClientTo(this, name);
	this.send("result:[\"joined course list " + name + "\"]");
	logChannels();
});

commands.set("help", function (msg) {
	channelOf(this).forEach(function (socket) {
		if (socket === this) return;

		socket.send("help:" + JSON.stringify([msg]));
	}, this);
});

commands.set("course/add", function (course, user) {
	console.log(user.name + " queued up to " +
		(user.action == 'H' ? 'ask for help' : 'present' ) +
		' for ' + course);
});

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
