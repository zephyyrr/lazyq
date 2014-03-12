angular.module('LazyQ')

.filter('ifactive', function() {
	return function(courses, override) {
		if (override) {
			return courses;
		}
		return courses.filter(function (course) {
			return course.active;
		});
	};
})

.filter('lockIcon', ['$sce', function ($sce) {
	return function (bool) {
		if (!bool) {
			return $sce.trustAsHtml('<span class="glyphicon glyphicon-lock"></span>');
		}
		return '';
	};
}]);
