
describe('instrument', function(){

  var instrument = require('instrument')
    , assert = require('assert')
    , cov;

  require.register('math/index.js', function(exports, require){
    exports.mul = require('./mul');
    exports.add = require('./add');
  });

  require.register('math/mul.js', function(_, _, module){
    module.exports = function(a, b){
      if ('number' == typeof a) {
        return a * b;
      }
    };
  });

  require.register('math/add.js', function(_, _, module){
    module.exports = function(a, b){
      return a + b;
    };
  });

  it('should initialize without new', function(){
    assert(instrument() instanceof instrument);
  })

  it('should cover all modules within component', function(){
    cov = instrument('math');
    assert(cov.modules['math/index.js']);
    assert(cov.modules['math/add.js']);
    assert(cov.modules['math/mul.js']);
  });

  it('should cover once a module is called', function(){
    assert(0 == cov.modules['math/index.js'].uncovered['1:32']);
    assert(0 == cov.modules['math/index.js'].uncovered['33:64']);
    var m = require('math');
    assert(1 == cov.modules['math/index.js'].covered['1:32']);
    assert(1 == cov.modules['math/index.js'].covered['33:64']);
  })

  it('should only cover correctly', function(){
    var mul = require('math').mul;
    var mod = cov.modules['math/mul.js'];
    assert(0 == mod.uncovered['36:85']);
    assert(0 == mod.uncovered['68:81']);
    mul();
    assert(mod.covered['36:85']);
    assert(0 == mod.uncovered['68:81']);
    assert('return a * b;' == mod.source.slice(68, 81));
  })

  it('should push ranges', function(){
    var mod = cov.modules['math/mul.js'];
    assert(mod.ranges.length);
    mod.ranges.map(function(range){
      range = range.join(':');
      var n = mod.covered[range] || mod.uncovered[range];
      assert('number' == typeof n);
    });
  })
})
