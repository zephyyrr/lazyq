function privacy(fn) {
  var set = new Set();

  function private(fn) {
    return function p() {
      if (set.has(p.caller)) {
        return fn.apply(this, arguments);
      } else {
        throw new Error(fn.name + " is private, and "
          + p.caller.name +" isn't privileged.");
      }
    };
  }

  function privileged(fn) {
    set.add(fn);
    return fn;
  }

  return fn(private, privileged);
}

var A = privacy(function (private, privileged) {
  function A() {}

  A.prototype = {
     a: private(function a(x) {
       console.log(x);
     }),

     b: privileged(function b() {
       this.a(5);
     })
  };

  return A;
});

