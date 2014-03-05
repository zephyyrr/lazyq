angular.module('LazyQ', ['ngRoute'])

.config(['$routeProvider', '$locationProvider', function ($route, $location) {
	$route
	.when('/list', {
		templateUrl: 'template/list.html',
		controller: 'ListCtrl',
		resolve: {
			courses: ['$http', '$q', function ($http, $q) {
				var deferred = $q.defer();
				$http.get('/list').success(deferred.resolve);
				return deferred.promise;
			}]
		}
	})
	.when('/list/:course', {
		templateUrl: 'template/queue.html',
		controller: 'QueueCtrl',
		resolve: {
			list: ['$http', '$q', function ($http, $q) {
				console.log(params);
				var deferred = $q.defer();
				$http.get('/list/' + params.course).success(deferred.resolve);
				return deferred.promise;
			}]
		}
	})
	.otherwise({
		redirectTo: '/list'
	});
}])

.controller('ListCtrl', ['$scope', 'courses', function ($scope, courses) {
	$scope.courses = courses;
}])

.controller('QueueCtrl', ['$scope', 'list', function ($scope, list) {
	$scope.list = list;
}])

.controller('TitleCtrl', ['$scope', function ($scope) {
	$scope.course = 'none';
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
