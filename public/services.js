angular.module('LazyQ')

.factory('UserService', function () {
	var username = localStorage.getItem('name') || void 0;
	var admin = false;

	return {
		setName: function (name) {
			localStorage.setItem('name', name);
			username = name;
		},

		getName: function () {
			return username;
		},

		isAdmin: function () {
			return admin;
		},

		setAdmin: function (bool) {
			admin = bool;
		},

		/**
		 * Function decorator.
		 * Requires the user to be admin to run the functions.
		 */
		admin: function (func) {
			return function () {
				if (admin) {
					return func.apply(this, arguments);
				}
			};
		},

		clearName: function () {
			localStorage.removeItem('name');
			username = void 0;
		}
	}
})

.factory('WebSocketService', function () {
	var handlers = {
		'error': [function () { console.error("ServerError: ", arguments); }]
	};

	var ws = new WebSocket("ws://" + location.hostname + ":8000");

	ws.onmessage = function (e) {
		var data = e.data,
			cmd = data.split(":", 1)[0],
			params = JSON.parse(data.slice(cmd.length + 1));

		console.log(cmd, params);

		if (handlers[cmd]) {
			handlers[cmd].forEach(function (callback) {
				callback.apply(null, params);
			});
		}
	};

	var queue = [];

	ws.onopen = function () {
		queue.forEach(function (data) {
			ws.send(data);
		});
		queue = null;
	};

	return {
		/**
		 * @param {string} type
		 * @param {...?} data
		 */
		send: function (type) {
			var data = type + ":" +
				angular.toJson(Array.prototype.slice.call(arguments, 1));

			if (ws.readyState === 0) {
				queue.push(data)
			} else if (ws.readyState === 1) {
				ws.send(data);
			} else {
				console.error("Closed socket!");
			}
		},

		on: function (type, callback) {
			if (!handlers[type]) {
				handlers[type] = [];
			}

			handlers[type].push(callback);
		},

		off: function (type, callback) {
			var h = handlers[type];
			h.splice(h.indexOf(callback), 1);
		}
	};
})

/**
 * The QueueService handles queue related stuff.
 */
.factory('QueueService', ['$http', 'WebSocketService', function ($http, socket) {
	//socket
	var commands = ['add', 'remove', 'update', 'broadcast'];

	function makeCommands(course) {
		var o = {};

		commands.forEach(function (cmd) {
			o[cmd] = socket.send.bind(socket, 'queue/' + cmd, course);
		});

		return o;
	}

	return {
		subscribers: null,
		course: null,

		/**
		 * Subscribes to a course, and gets notified of changes to
		 * the course's queue through it's callback.
		 *
		 * @param {string} course
		 * @param {Function} insert
		 * @param {Function} remove
		 */
		subscribeTo: function (course, insert, remove) {
			var s = this.subscribers = Array.prototype.slice.call(arguments, 1);

			this.course = course;

			s && s.forEach(function (fn, i) {
				socket.on('queue/' + commands[i], fn);
			}, this);

			socket.send('queue/listen', course);

			return makeCommands(course);
		},

		forCourse: function (name) {
			return $http.get('/api/list/' + name);
		},

		unsubscribe: function () {
			this.subscribers.forEach(function (fn, i) {
				socket.off('queue/' + commands[i], fn);
			});

			this.course && socket.send('queue/mute', this.course);
		}, 
		
		broadcast: function (message) {
			var packet = {message: message, source: 'SYSTEM'}
			this.course && socket.send('queue/broadcast', this.course, packet)
		}
	}
}])

/**
 * The CourseService handles course related stuff.
 */
.factory('CourseService', ['$http', 'WebSocketService', function ($http, socket) {
	return {
		subscriber: [],

		/**
		 * Subscribes to a course, and gets notified of changes to
		 * the course's queue through it's callback.
		 *
		 * @param {Function} cb
		 */
		onUpdate: function (cb) {
			socket.on('courses/update', this.subscriber = cb);

			socket.send('courses/listen');
		},

		list: function () {
			return $http.get('/api/list/');
		},

		offUpdate: function () {
			socket.off('courses/update', this.subscriber);

			socket.send('courses/mute');
		},

		update: function (name, data) {
			socket.send('courses/update', name, data);
		}
	}
}])

.factory('TitleService', function() {
	var data = {title: 'LazyQ'};
	return {
		set: function(newTitle) {
			data.title = newTitle;
		},
		get: function() {
			return data;
		},
		reset: function () {
			data.title = 'LazyQ';
		}
	};
})

.factory('NavService', function () {
	var nav = {};

	nav.reset = function reset () {
		nav.title = 'LazyQ';
		nav.back = '';
		nav.logout = false;
		return nav;
	};
nav.reset();
	return nav;
});
