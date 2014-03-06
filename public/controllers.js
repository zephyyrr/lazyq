function not(fn) {
	return function () {
		return !fn.apply(this, arguments);
	};
}

angular.module('LazyQ')

.controller('SearchCtrl',
['$scope', '$location', 'courses',
function ($scope, $location, courses) {
	$scope.query = "";
	$scope.courses = courses;
	$scope.redirect = function(path) {
		$location.path(path);
	};
	$scope.join = function() {
		$scope.redirect('/course/' + $scope.query);
	};
}])

.controller('ListCtrl',
['$scope', 'courses',
function ($scope, courses) {
	$scope.courses = courses;
}])

.controller('NavCtrl',
['$scope', '$location', 'NavService', 'UserService',
function ($scope, $location, Nav, User) {
	$scope.nav = Nav;

	$scope.back = function () {
		$location.path(Nav.back);
	};

	$scope.logout = function () {
		User.clearName();
		$location.path('/name');
	};
}])

.controller('QueueCtrl',
['$scope', '$routeParams', 'UserService', 'QueueService', 'NavService',
function ($scope, params, User, Queue, Nav) {
	Nav.title = $scope.course = params.course;
	Nav.logout = true;
	Nav.back = '/search';

	Queue.forCourse(params.course).then(function (res) {
		$scope.queue = res.data;
		$scope.queued = res.data.some(withName(User.getName()));
	});

	// Default action is "help"
	$scope.action = "H";

	var socket = Queue.subscribeTo(params.course,
		function insert(course, user) {
			$scope.$apply(function () {
				$scope.queue.push(user);
			});
		},
		function remove(course, username) {
			$scope.$apply(function () {
				$scope.queue = $scope.queue.filter(not(withName(username)));
			});
		});

	function withName (name) {
		return function (usr) {
			return usr.name === name;
		};
	}

	$scope.$on('$locationChangeStart', function () {
		Nav.reset();
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
			$scope.comment = '';
		}
	};

	$scope.leaveQueue = function () {
		socket.remove(User.getName());
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
}]);
