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
	$scope.error = "";

	function courseName(query) {
		return function (course) {
			return query === course.name;
		};
	}

	$scope.join = function() {
		if ($scope.courses.some(courseName($scope.query))) {
			$scope.error = "";
			$location.path('/course/' + $scope.query);
		} else {
			$scope.error = "No such course: " + $scope.query;
		}
	};
	
	$scope.user = {admin: true}
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
		$scope.queued = isQueuing();
	});

	// Default action is "help"
	$scope.action = "H";

	function isQueuing() {
		return $scope.queue.some(withName(User.getName()));
	}

	var socket = Queue.subscribeTo(params.course,
		function insert(course, user) {
			$scope.$apply(function () {
				$scope.queue.push(user);
				$scope.queued = isQueuing();
			});
		},
		function remove(course, username) {
			$scope.$apply(function () {
				$scope.queue = $scope.queue.filter(not(withName(username)));
				$scope.queued = isQueuing();
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
			$scope.comment = '';
		}
	};

	$scope.leaveQueue = function () {
		socket.remove(User.getName());
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
