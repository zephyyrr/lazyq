angular.module('LazyQ')

.directive('lqCard', function() {
	return {
		restrict: 'E',
		scope: {
			course: '=',
		},
		templateUrl: 'template/Card.html'
	}
})

.directive('lqQueuecard', function() {
	return {
		restrict: 'E',
		scope: {
			user: '=',
			index: '=',
			admin: '='
		},
		templateUrl: 'template/QueueCard.html'
	}
});
