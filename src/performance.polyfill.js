(function(global) {
  if(!('performance' in global)) {
    var performance = {};
    global.performance = performance;
  }

  if(!('now' in performance)) {
    if(typeof process !== 'undefined') {
      performance.now = function() {
        var t = process.hrtime();
        return t[0] * 1e3 + t[1] * 1e-6;
      };
    } else {
      performance.now = function() {
        return Date.now();
      };
    }
  }
})(global || window || this);
