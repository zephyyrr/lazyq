angular.module('LazyQ', ['ngRoute', 'ui.bootstrap'])

.config(['$routeProvider', '$locationProvider',	function ($route, $location) {

	$route
	.when('/list', {
		templateUrl: 'template/list.html',
		controller: 'ListCtrl',
		resolve: {
			courses: ['$http', '$q', function ($http, $q) {
				return $http.get('/list').then(function (d) { return d.data });
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

.factory('QueueService', ['$http', '$q', function ($http, $q) {
	return {
		forCourse: function (name) {
			return $http.get('/list/' + name);
		}
	}
}])

/**
 * The SocketService represents the websocket connection to the server.
 */
.factory('SocketService', [function () {
	var ws = new WebSocket("ws://" + location.hostname + ":8000");

	ws.onmessage = function () {

	};

	function send(course, cmd, data) {
		var pack = course + '/' + cmd + ':' + angular.toJson(data);
	}

	var commands = ['insert', 'remove'];

	function makeCommands(course) {
		var o = {};

		commands.forEach(function (cmd) {
			o[cmd] = send.bind(null, course, cmd);
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
			//route(course, insert, remove);
			return makeCommands(course);
		}
	}
}])

.controller('QueueCtrl', ['$scope', '$routeParams', 'UserService', 'QueueService', 'SocketService', function ($scope, params, User, Queue, Socket) {
	$scope.course = params.course;
	Queue.forCourse(params.course).then(function (res) {
		$scope.queue = res.data;
	});

	// Default action is "help"
	$scope.action = "H";

	var socket = Socket.subscribeTo(params.course,
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

.controller('UserCtrl', ['$scope', function ($scope) {
	$scope.user = {
		name: "User"
	}
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
