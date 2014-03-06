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
}]);
