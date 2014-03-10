angular.module('LazyQ')

.directive('lqQueuecard', function() {
	return {
		restrict: 'E',
		scope: {
			user: '=',
			index: '='
		},
		templateUrl: 'template/QueueCard.html'
	}
});