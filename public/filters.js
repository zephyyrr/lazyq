angular.module('LazyQ')

.filter('ifactive', function() {
	return function(courses, override) {
		if (override) return courses
		var out = [];
		courses.forEach(function(i, val){
			if (val.active) out.append(val);
		})
		return out;
	}
});