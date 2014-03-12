function not(fn) {
	return function () {
		return !fn.apply(this, arguments);
	};
}

angular.module('LazyQ')

.controller('SearchCtrl',
['$scope', '$location', 'UserService', 'courses',
function ($scope, $location, User, courses) {
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
	
	$scope.lock = function(course) {
		course.open = !course.open
	}
	
	$scope.activate = function(course) {
		course.active = !course.active
	}

	$scope.user = User
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
['$scope', '$routeParams', 'UserService', 'QueueService', 'NavService', 'TitleService',
function ($scope, params, User, Queue, Nav, Title) {
	var socket;

	Nav.title = $scope.course = params.course;
	Nav.logout = true;
	Nav.back = '/search';

	Queue.forCourse($scope.course).then(function (res) {
		$scope.queue = res.data;
		$scope.queued = isQueuing();
	});

	$scope.admin = {
		open: User.admin(function ($event) {
			$event.target.style.left = '-70px';
		}),

		close: User.admin(function ($event) {
			$event.target.style.left = 0;
		}),

		remove: User.admin(function ($event, i) {
			socket.remove($scope.queue[i].name);
		}),

		accept: User.admin(function ($event, i) {
			var u = $scope.queue[i];
			socket.update(u.name, {enroute: !u.enroute});
		})
	};

	window['scope'] = $scope;

	// Default action is "help"
	$scope.action = "H";

	function isQueuing() {
		var inQueue = $scope.queue.some(function (user, i) {
			if (user.name === User.getName()) {
				$scope.position = i;
				Title.set((i + 1) + ' in ' + $scope.course);
				return true;
			}
		});

		if (!inQueue) {
			Title.reset();
		}

		return inQueue;
	}

	socket = Queue.subscribeTo(params.course,
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
		},
		function update(course, username, updatedUser) {
			$scope.$apply(function () {
				$scope.queue.forEach(function (user, i) {
					if (user.name === username) {
						angular.extend($scope.queue[i], updatedUser);
					}
				});
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
		User.setAdmin($scope.type == 'admin')
		$location.path('search');
	};
}])

.controller('TitleCtrl', ['$scope', 'TitleService', function ($scope, Title) {
	$scope.data = Title.get();
}]);
