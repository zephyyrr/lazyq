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
});
