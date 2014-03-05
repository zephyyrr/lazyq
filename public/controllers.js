angular.module('LazyQ', ['ngRoute', 'ui.bootstrap'])

.config(['$routeProvider', '$locationProvider',	function ($route, $location) {

	$route
	.when('/search', {
		templateUrl: 'template/search.html',
		controller: 'SearchCtrl',
		resolve: {
			courses: ['$http', '$q', function ($http, $q) {
				return $http.get('/api/list').then(function (d) { return d.data });
			}]
		}
	})
	.when('/list', {
		templateUrl: 'template/list.html',
		controller: 'ListCtrl',
		resolve: {
			courses: ['$http', '$q', function ($http, $q) {
				return $http.get('/api/list').then(function (d) { return d.data });
			}]
		}
	})
	.when('/course/:course', {
		templateUrl: 'template/queue.html',
		controller: 'QueueCtrl'
	})
	.when('/name', {
		templateUrl: 'template/namepicker.html',
		controller: 'NameCtrl'
	})
	.otherwise({
		redirectTo: '/name'
	});
}])

.controller('SearchCtrl', ['$scope', '$location', 'courses', function ($scope, $location, courses) {
	$scope.query = "";
	$scope.courses = courses;
	$scope.redirect = function(path) {
		$location.path(path);
	};
	$scope.join = function() {
		$scope.redirect('/course/' + $scope.query);
	};
}])

.controller('ListCtrl', ['$scope', 'courses', function ($scope, courses) {
	$scope.courses = courses;
}])

.factory('UserService', function () {
	var username = localStorage.getItem('name') || void 0;

	return {
		setName: function (name) {
			localStorage.setItem('name', name);
			username = name;
		},
		getName: function () {
			return username;
		}
	}
})

.factory('WebSocketService', function () {
	var handlers = {
		'error': [function (d) { console.error("ServerError: " + d); }]
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

			console.log(handlers);
		},

		off: function (type, callback) {
			var h = handlers[type];
			h.splice(h.indexOf(callback), 1);
		}
	};
})

/**
 * The SocketService represents the websocket connection to the server.
 */
.factory('QueueService', ['$http', 'WebSocketService', function ($http, socket) {
	//socket
	var commands = ['add', 'remove'];

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
		}
	}
}])

.controller('QueueCtrl', ['$scope', '$routeParams', 'UserService', 'QueueService', function ($scope, params, User, Queue) {
	$scope.course = params.course;
	$scope.queued = false;

	Queue.forCourse(params.course).then(function (res) {
		$scope.queue = res.data;
	});

	// Default action is "help"
	$scope.action = "H";

	var socket = Queue.subscribeTo(params.course,
		function insert(course, user) {
			console.log(course, user);
			$scope.$apply(function () {
				$scope.queue.push(user);
			});
		},
		function remove(course, username) {
			console.log(course, username);
			$scope.queue = $scope.queue.filter(withName(user.name));
		});

	function withName (name) {
		return function (usr) {
			return usr.name === name;
		};
	}

	$scope.$on('$locationChangeStart', function () {
		Queue.unsubscribe();
	});

	$scope.joinQueue = function () {
		if (!$scope.queue.some(withName(User.getName()))) {
			var user = {
				name: User.getName(),
				action: $scope.action,
				comment: $scope.comment
			};

			socket.add(user);
			$scope.queued = true;
		}
	};

	$scope.leaveQueue = function () {
		socket.remove(user);
		$scope.queued = false;
	};
}])

.controller('NameCtrl', ['$scope', 'UserService', '$location', function ($scope, User, $location) {
	$scope.done = function () {
		User.setName($scope.name);
		$location.path('search');
	};
}])

.controller('TitleCtrl', ['$scope', function ($scope) {
	$scope.course = 'none';
	$scope.title = "LazyQ"
	$scope.num = 1;
}])

.controller('WSCtrl', ['$scope', function ($scope) {
	$scope.course = "course";
	$scope.num = 1;

	var ws = new WebSocket("ws://" + location.hostname + ":8080");
	ws.onmessage = function (msg) {
		var cmd = msg.data.split(":", 1)[0];

		var params = JSON.parse(msg.data.slice(cmd.length + 1));

		console.log(cmd, params);

		$scope.$apply(function () {
			$scope.cmd = cmd;
			$scope.params = params;
		});
	};

	$scope.sendCommand = function () {
		var e = document.getElementById("command"),
			text = e.value;

		e.value = '';

		ws.send(text);
	};
}]);
