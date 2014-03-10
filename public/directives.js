angular.module('LazyQ')

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