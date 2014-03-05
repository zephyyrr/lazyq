angular.module('LazyQ', ['ngRoute', 'ui.bootstrap'])

.config(['$routeProvider', '$locationProvider',	function ($route, $location) {

	$route
	.when('/list', {
		templateUrl: 'template/list.html',
		controller: 'ListCtrl',
		resolve: {
			courses: ['$http', '$q', function ($http, $q) {
				return $http.get('/api/list').then(function (d) { return d.data });
			}]
		}
	})
	.when('/list/:course', {
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

.controller('ListCtrl', ['$scope', '$http', function ($scope, $http) {
	$scope.query = "";

	$scope.courses = $http.get('/list').then(function (d) { return d.data });
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
	var handlers = {},
		ws = new WebSocket("ws://" + location.hostname + ":8000");

	ws.onmessage = function (e) {
		var data = e.data,
			cmd = data.split(":", 1)[0],
			params = JSON.parse(data.slice(cmd.length + 1));

		if (handlers[cmd]) {
			handlers[cmd].forEach(function (callback) {
				callback.apply(null, params);
			});
		}
	};

	return {
		/**
		 * @param {string} type
		 * @param {...?} data
		 */
		send: function (type) {
			ws.send(type + ":" +
				angular.toJson(Array.prototype.slice.call(arguments, 1)));
		},

		on: function (type, callback) {
			if (!handlers[type]) {
				handlers[type] = [];
			}

			handlers[type].push(callback);
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
			o[cmd] = socket.send.bind(socket, course + '/' + cmd);
		});

		return o;
	}

	return {
		/**
		 * Subscribes to a course, and gets notified of changes to
		 * the course's queue through it's callback.
		 *
		 * @param {string} course
		 * @param {Function} insert
		 * @param {Function} remove
		 */
		subscribeTo: function (course, insert, remove) {
			var args = Array.prototype.slice.call(arguments, 1);

			commands.forEach(function (command, i) {
				if (args[i]) {
					socket.on('course/' + command, args[i]);
				}
			});

			return makeCommands(course);
		},

		forCourse: function (name) {
			return $http.get('/api/list/' + name);
		}
	}
}])

.controller('QueueCtrl', ['$scope', '$routeParams', 'UserService', 'QueueService', function ($scope, params, User, Queue) {
	$scope.course = params.course;
	Queue.forCourse(params.course).then(function (res) {
		$scope.queue = res.data;
	});

	// Default action is "help"
	$scope.action = "H";

	var socket = Queue.subscribeTo(params.course,
		function insert(user) {
			$scope.queue.push(user);
		},
		function remove(user) {
			$scope.queue = $scope.queue.filter(withName(user.name));
		});

	function withName (name) {
		return function (usr) {
			return usr.name === name;
		};
	}

	$scope.addToQueue = function () {
		if (!$scope.queue.some(withName(User.getName()))) {
			var user = {
				name: User.getName(),
				action: $scope.action,
				comment: $scope.comment
			};

			socket.insert(user);
			$scope.queue.push(user);
		}
	};
}])

.controller('NameCtrl', ['$scope', 'UserService', '$location', function ($scope, User, $location) {
	$scope.done = function () {
		User.setName($scope.name);
		$location.path('list');
	};
}])

.controller('TitleCtrl', ['$scope', function ($scope) {
	$scope.course = 'none';
	$scope.title = "LazyQ"
	$scope.num = 1;
}])

<<<<<<< HEAD
.controller('SearchCtrl', ['$scope', '$rootScope', function ($scope, $rootScope) {
	$scope.query = "";
	$scope.search = function() {
		$rootScope.$broadcast('searchEvent', $scope.query);
	};
=======
.controller('UserCtrl', ['$scope', function ($scope) {
	$scope.user = {
		name: "User"
	}
>>>>>>> be19a5bf4769975541f78c1787130074dd169d6a
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
