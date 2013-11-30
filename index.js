
/**
 * Dependencies
 */

var source = require('function-source');
var escodegen = require('escodegen');
var esprima = require('esprima');
var global = require('global');

/**
 * Export `Instrument`
 */

module.exports = Instrument;

/**
 * Instrument the given `component`.
 *
 * @param {String} name
 * @param {String} global
 * @api public
 */

function Instrument(name, global){
  if (!(this instanceof Instrument)) return new Instrument(name, global);
  var self = this;
  this.name = name;
  this.modules = {};
  this.global = global || random();
  this.expose();
  sources(name, function(mod){
    self.modules[mod.key] = mod;
    self.cover(mod);
  });
}

/**
 * Cover `mod`.
 *
 * @param {Object} mod
 * @api private
 */

Instrument.prototype.cover = function(mod){
  this.mod = mod;
  this.walk(mod.ast);
  this.generate();
  this.replace();
  this.mod = null;
};

/**
 * Expose `global`.
 *
 * @api private
 */

Instrument.prototype.expose = function(){
  var global = this.update.bind(this);
  window[this.global] = global;
};

/**
 * Walk `ast` and `type`
 *
 * @param {Mixed} ast
 * @param {Mixed} type
 * @api private
 */

Instrument.prototype.walk = function(ast, type){
  var arr = '[object Array]' == ({}).toString.call(ast);

  // ignore
  if ('object' != typeof ast) return;

  // add
  if (arr && ('consequent' == type || 'body' == type)) {
    for (var i = 0, len = ast.length; i < len; ++i) {
      var range = ast[i * 2].range;
      var global = this.global;
      var mod = this.mod;
      var expr = statement(range, mod, global);
      mod.ranges.push(range);
      range = range.join(':');
      this.mod.uncovered[range] = 0;
      ast.splice(i * 2, 0, expr);
    }
  }

  // array
  if (arr) {
    for (var i = 0; i < ast.length; ++i) {
      this.walk(ast[i], i);
    }
    return;
  }

  // object
  for (var k in ast) this.walk(ast[k], k);
};

/**
 * Generate instrumented code.
 *
 * @api private
 */

Instrument.prototype.generate = function(){
  var mod = this.mod;
  mod.instrumented = escodegen.generate(mod.ast);
};

/**
 * Replace module code.
 *
 * @api private
 */

Instrument.prototype.replace = function(){
  var mods = global.require.modules;
  var mod = this.mod;
  var src = mod.instrumented;
  mods[mod.key] = Function('exports', 'require', 'module', src);
};

/**
 * Update `name`, `start`, `end`.
 *
 * @param {String} key
 * @param {Number} start
 * @param {Number} end
 * @api private
 */

Instrument.prototype.update = function(key, start, end){
  var mod = this.modules[key];
  var range = [start, end].join(':');
  var obj = mod.covered;
  obj[range] = obj[range] || 0;
  delete mod.uncovered[range];
  ++obj[range];
};

/**
 * Loop sources of `component`.
 *
 * @param {String} component
 * @param {Function} fn
 * @api private
 */

function sources(component, fn){
  var mods = global.require.modules;
  var name = component + '/';
  var deps = name + 'deps';

  for (var key in mods) {
    if (0 != key.indexOf(name)) continue;
    if (0 == key.indexOf(deps)) continue;
    var obj = { fn: mods[key] };
    var src = obj.fn.toString();
    obj.ranges = [];
    obj.covered = {};
    obj.uncovered = {};
    obj.instrumented = '';
    obj.source = source(src);
    obj.name = name.slice(0, -1);
    obj.key = key;
    obj.ast = parse(obj.source);
    fn(obj);
  }
};

/**
 * Generate `statement`.
 *
 * @param {Array} range
 * @param {Object} mod
 * @param {String} global
 * @api private
 */

function statement(range, mod, global){
  return {
    type: 'ExpressionStatement',
    expression: {
      type: 'CallExpression',
      callee: { type: 'Identifier', name: global },
      arguments: [
        { type: 'Literal', value: mod.key },
        { type: 'Literal', value: range[0] },
        { type: 'Literal', value: range[1] }
      ]
    }
  };
}

/**
 * Parse `src`.
 *
 * @param {String} src
 * @return {Object}
 * @api private
 */

function parse(src){
  return esprima.parse(src, {
    range: true
  });
};

/**
 * Product a random `str`.
 *
 * @return {String}
 * @api private
 */

function random(){
  return ['____', '____'].join(Math
    .random()
    .toString(16)
    .slice(6));
}
