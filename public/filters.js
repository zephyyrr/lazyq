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

.filter('lockText', function() {
	return function(open) {
		return (open) ? "Lock" : "Unlock";
	}
})

.filter('activeText', function() {
	return function(active) {
		return (active) ? "Deactivate" : "Activate";
	}
});
