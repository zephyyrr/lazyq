/**
 * A flunent function returns this.
 *
 * @param {Function} fn
 * @return {Function}
 */
function fluent(fn) {
	return function () {
		fn.apply(this, arguments);
		return this;
	};
}

function saving(func) {
	return function () {
		func.apply(this, arguments);
		// console.log('Saving:', JSON.stringify(this));
		this.save();
	}
}

/**
 * @param {T} one
 * @return {function(T): boolean}
 */
function eq(one) {
	return function (other) {
		return one === other;
	};
}

function not(func) {
	return function () {
		return !func.apply(this, arguments);
	};
}

module.exports = {
	fluent: fluent,
	not: not,
	eq: eq,
	saving: saving
};