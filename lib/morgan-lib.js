module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 41);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

module.exports = require("fs");

/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = require("path");

/***/ }),
/* 2 */
/***/ (function(module, exports) {

module.exports = require("util");

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {


/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = __webpack_require__(6);

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Previous log timestamp.
 */

var prevTime;

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  return debug;
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (var i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * depd
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */



/**
 * Module dependencies.
 * @private
 */

var EventEmitter = __webpack_require__(5).EventEmitter

/**
 * Module exports.
 * @public
 */

lazyProperty(module.exports, 'callSiteToString', function callSiteToString () {
  var limit = Error.stackTraceLimit
  var obj = {}
  var prep = Error.prepareStackTrace

  function prepareObjectStackTrace (obj, stack) {
    return stack
  }

  Error.prepareStackTrace = prepareObjectStackTrace
  Error.stackTraceLimit = 2

  // capture the stack
  Error.captureStackTrace(obj)

  // slice the stack
  var stack = obj.stack.slice()

  Error.prepareStackTrace = prep
  Error.stackTraceLimit = limit

  return stack[0].toString ? toString : __webpack_require__(15)
})

lazyProperty(module.exports, 'eventListenerCount', function eventListenerCount () {
  return EventEmitter.listenerCount || __webpack_require__(16)
})

/**
 * Define a lazy property.
 */

function lazyProperty (obj, prop, getter) {
  function get () {
    var val = getter()

    Object.defineProperty(obj, prop, {
      configurable: true,
      enumerable: true,
      value: val
    })

    return val
  }

  Object.defineProperty(obj, prop, {
    configurable: true,
    enumerable: true,
    get: get
  })
}

/**
 * Call toString() on the obj
 */

function toString (obj) {
  return obj.toString()
}


/***/ }),
/* 5 */
/***/ (function(module, exports) {

module.exports = require("events");

/***/ }),
/* 6 */
/***/ (function(module, exports) {

/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}


/***/ }),
/* 7 */,
/* 8 */,
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

/**
 * Detect Electron renderer process, which is node, but we should
 * treat as a browser.
 */

if (typeof process !== 'undefined' && process.type === 'renderer') {
  module.exports = __webpack_require__(10);
} else {
  module.exports = __webpack_require__(11);
}


/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = __webpack_require__(3);
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  'lightseagreen',
  'forestgreen',
  'goldenrod',
  'dodgerblue',
  'darkorchid',
  'crimson'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}


/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

/**
 * Module dependencies.
 */

var tty = __webpack_require__(12);
var util = __webpack_require__(2);

/**
 * This is the Node.js implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = __webpack_require__(3);
exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;

/**
 * Colors.
 */

exports.colors = [6, 2, 3, 4, 5, 1];

/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */

exports.inspectOpts = Object.keys(process.env).filter(function (key) {
  return /^debug_/i.test(key);
}).reduce(function (obj, key) {
  // camel-case
  var prop = key
    .substring(6)
    .toLowerCase()
    .replace(/_([a-z])/g, function (_, k) { return k.toUpperCase() });

  // coerce string value into JS value
  var val = process.env[key];
  if (/^(yes|on|true|enabled)$/i.test(val)) val = true;
  else if (/^(no|off|false|disabled)$/i.test(val)) val = false;
  else if (val === 'null') val = null;
  else val = Number(val);

  obj[prop] = val;
  return obj;
}, {});

/**
 * The file descriptor to write the `debug()` calls to.
 * Set the `DEBUG_FD` env variable to override with another value. i.e.:
 *
 *   $ DEBUG_FD=3 node script.js 3>debug.log
 */

var fd = parseInt(process.env.DEBUG_FD, 10) || 2;

if (1 !== fd && 2 !== fd) {
  util.deprecate(function(){}, 'except for stderr(2) and stdout(1), any other usage of DEBUG_FD is deprecated. Override debug.log if you want to use a different log function (https://git.io/debug_fd)')()
}

var stream = 1 === fd ? process.stdout :
             2 === fd ? process.stderr :
             createWritableStdioStream(fd);

/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */

function useColors() {
  return 'colors' in exports.inspectOpts
    ? Boolean(exports.inspectOpts.colors)
    : tty.isatty(fd);
}

/**
 * Map %o to `util.inspect()`, all on a single line.
 */

exports.formatters.o = function(v) {
  this.inspectOpts.colors = this.useColors;
  return util.inspect(v, this.inspectOpts)
    .split('\n').map(function(str) {
      return str.trim()
    }).join(' ');
};

/**
 * Map %o to `util.inspect()`, allowing multiple lines if needed.
 */

exports.formatters.O = function(v) {
  this.inspectOpts.colors = this.useColors;
  return util.inspect(v, this.inspectOpts);
};

/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var name = this.namespace;
  var useColors = this.useColors;

  if (useColors) {
    var c = this.color;
    var prefix = '  \u001b[3' + c + ';1m' + name + ' ' + '\u001b[0m';

    args[0] = prefix + args[0].split('\n').join('\n' + prefix);
    args.push('\u001b[3' + c + 'm+' + exports.humanize(this.diff) + '\u001b[0m');
  } else {
    args[0] = new Date().toUTCString()
      + ' ' + name + ' ' + args[0];
  }
}

/**
 * Invokes `util.format()` with the specified arguments and writes to `stream`.
 */

function log() {
  return stream.write(util.format.apply(util, arguments) + '\n');
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  if (null == namespaces) {
    // If you set a process.env field to null or undefined, it gets cast to the
    // string 'null' or 'undefined'. Just delete instead.
    delete process.env.DEBUG;
  } else {
    process.env.DEBUG = namespaces;
  }
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  return process.env.DEBUG;
}

/**
 * Copied from `node/src/node.js`.
 *
 * XXX: It's lame that node doesn't expose this API out-of-the-box. It also
 * relies on the undocumented `tty_wrap.guessHandleType()` which is also lame.
 */

function createWritableStdioStream (fd) {
  var stream;
  var tty_wrap = process.binding('tty_wrap');

  // Note stream._type is used for test-module-load-list.js

  switch (tty_wrap.guessHandleType(fd)) {
    case 'TTY':
      stream = new tty.WriteStream(fd);
      stream._type = 'tty';

      // Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    case 'FILE':
      var fs = __webpack_require__(0);
      stream = new fs.SyncWriteStream(fd, { autoClose: false });
      stream._type = 'fs';
      break;

    case 'PIPE':
    case 'TCP':
      var net = __webpack_require__(13);
      stream = new net.Socket({
        fd: fd,
        readable: false,
        writable: true
      });

      // FIXME Should probably have an option in net.Socket to create a
      // stream from an existing fd which is writable only. But for now
      // we'll just add this hack and set the `readable` member to false.
      // Test: ./node test/fixtures/echo.js < /etc/passwd
      stream.readable = false;
      stream.read = null;
      stream._type = 'pipe';

      // FIXME Hack to have stream not keep the event loop alive.
      // See https://github.com/joyent/node/issues/1726
      if (stream._handle && stream._handle.unref) {
        stream._handle.unref();
      }
      break;

    default:
      // Probably an error on in uv_guess_handle()
      throw new Error('Implement me. Unknown stream file type!');
  }

  // For supporting legacy API we put the FD here.
  stream.fd = fd;

  stream._isStdio = true;

  return stream;
}

/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */

function init (debug) {
  debug.inspectOpts = {};

  var keys = Object.keys(exports.inspectOpts);
  for (var i = 0; i < keys.length; i++) {
    debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
  }
}

/**
 * Enable namespaces listed in `process.env.DEBUG` initially.
 */

exports.enable(load());


/***/ }),
/* 12 */
/***/ (function(module, exports) {

module.exports = require("tty");

/***/ }),
/* 13 */
/***/ (function(module, exports) {

module.exports = require("net");

/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

/*!
 * depd
 * Copyright(c) 2014-2017 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var callSiteToString = __webpack_require__(4).callSiteToString
var eventListenerCount = __webpack_require__(4).eventListenerCount
var relative = __webpack_require__(1).relative

/**
 * Module exports.
 */

module.exports = depd

/**
 * Get the path to base files on.
 */

var basePath = process.cwd()

/**
 * Determine if namespace is contained in the string.
 */

function containsNamespace (str, namespace) {
  var vals = str.split(/[ ,]+/)
  var ns = String(namespace).toLowerCase()

  for (var i = 0; i < vals.length; i++) {
    var val = vals[i]

    // namespace contained
    if (val && (val === '*' || val.toLowerCase() === ns)) {
      return true
    }
  }

  return false
}

/**
 * Convert a data descriptor to accessor descriptor.
 */

function convertDataDescriptorToAccessor (obj, prop, message) {
  var descriptor = Object.getOwnPropertyDescriptor(obj, prop)
  var value = descriptor.value

  descriptor.get = function getter () { return value }

  if (descriptor.writable) {
    descriptor.set = function setter (val) { return (value = val) }
  }

  delete descriptor.value
  delete descriptor.writable

  Object.defineProperty(obj, prop, descriptor)

  return descriptor
}

/**
 * Create arguments string to keep arity.
 */

function createArgumentsString (arity) {
  var str = ''

  for (var i = 0; i < arity; i++) {
    str += ', arg' + i
  }

  return str.substr(2)
}

/**
 * Create stack string from stack.
 */

function createStackString (stack) {
  var str = this.name + ': ' + this.namespace

  if (this.message) {
    str += ' deprecated ' + this.message
  }

  for (var i = 0; i < stack.length; i++) {
    str += '\n    at ' + callSiteToString(stack[i])
  }

  return str
}

/**
 * Create deprecate for namespace in caller.
 */

function depd (namespace) {
  if (!namespace) {
    throw new TypeError('argument namespace is required')
  }

  var stack = getStack()
  var site = callSiteLocation(stack[1])
  var file = site[0]

  function deprecate (message) {
    // call to self as log
    log.call(deprecate, message)
  }

  deprecate._file = file
  deprecate._ignored = isignored(namespace)
  deprecate._namespace = namespace
  deprecate._traced = istraced(namespace)
  deprecate._warned = Object.create(null)

  deprecate.function = wrapfunction
  deprecate.property = wrapproperty

  return deprecate
}

/**
 * Determine if namespace is ignored.
 */

function isignored (namespace) {
  /* istanbul ignore next: tested in a child processs */
  if (process.noDeprecation) {
    // --no-deprecation support
    return true
  }

  var str = process.env.NO_DEPRECATION || ''

  // namespace ignored
  return containsNamespace(str, namespace)
}

/**
 * Determine if namespace is traced.
 */

function istraced (namespace) {
  /* istanbul ignore next: tested in a child processs */
  if (process.traceDeprecation) {
    // --trace-deprecation support
    return true
  }

  var str = process.env.TRACE_DEPRECATION || ''

  // namespace traced
  return containsNamespace(str, namespace)
}

/**
 * Display deprecation message.
 */

function log (message, site) {
  var haslisteners = eventListenerCount(process, 'deprecation') !== 0

  // abort early if no destination
  if (!haslisteners && this._ignored) {
    return
  }

  var caller
  var callFile
  var callSite
  var depSite
  var i = 0
  var seen = false
  var stack = getStack()
  var file = this._file

  if (site) {
    // provided site
    depSite = site
    callSite = callSiteLocation(stack[1])
    callSite.name = depSite.name
    file = callSite[0]
  } else {
    // get call site
    i = 2
    depSite = callSiteLocation(stack[i])
    callSite = depSite
  }

  // get caller of deprecated thing in relation to file
  for (; i < stack.length; i++) {
    caller = callSiteLocation(stack[i])
    callFile = caller[0]

    if (callFile === file) {
      seen = true
    } else if (callFile === this._file) {
      file = this._file
    } else if (seen) {
      break
    }
  }

  var key = caller
    ? depSite.join(':') + '__' + caller.join(':')
    : undefined

  if (key !== undefined && key in this._warned) {
    // already warned
    return
  }

  this._warned[key] = true

  // generate automatic message from call site
  var msg = message
  if (!msg) {
    msg = callSite === depSite || !callSite.name
      ? defaultMessage(depSite)
      : defaultMessage(callSite)
  }

  // emit deprecation if listeners exist
  if (haslisteners) {
    var err = DeprecationError(this._namespace, msg, stack.slice(i))
    process.emit('deprecation', err)
    return
  }

  // format and write message
  var format = process.stderr.isTTY
    ? formatColor
    : formatPlain
  var output = format.call(this, msg, caller, stack.slice(i))
  process.stderr.write(output + '\n', 'utf8')
}

/**
 * Get call site location as array.
 */

function callSiteLocation (callSite) {
  var file = callSite.getFileName() || '<anonymous>'
  var line = callSite.getLineNumber()
  var colm = callSite.getColumnNumber()

  if (callSite.isEval()) {
    file = callSite.getEvalOrigin() + ', ' + file
  }

  var site = [file, line, colm]

  site.callSite = callSite
  site.name = callSite.getFunctionName()

  return site
}

/**
 * Generate a default message from the site.
 */

function defaultMessage (site) {
  var callSite = site.callSite
  var funcName = site.name

  // make useful anonymous name
  if (!funcName) {
    funcName = '<anonymous@' + formatLocation(site) + '>'
  }

  var context = callSite.getThis()
  var typeName = context && callSite.getTypeName()

  // ignore useless type name
  if (typeName === 'Object') {
    typeName = undefined
  }

  // make useful type name
  if (typeName === 'Function') {
    typeName = context.name || typeName
  }

  return typeName && callSite.getMethodName()
    ? typeName + '.' + funcName
    : funcName
}

/**
 * Format deprecation message without color.
 */

function formatPlain (msg, caller, stack) {
  var timestamp = new Date().toUTCString()

  var formatted = timestamp +
    ' ' + this._namespace +
    ' deprecated ' + msg

  // add stack trace
  if (this._traced) {
    for (var i = 0; i < stack.length; i++) {
      formatted += '\n    at ' + callSiteToString(stack[i])
    }

    return formatted
  }

  if (caller) {
    formatted += ' at ' + formatLocation(caller)
  }

  return formatted
}

/**
 * Format deprecation message with color.
 */

function formatColor (msg, caller, stack) {
  var formatted = '\x1b[36;1m' + this._namespace + '\x1b[22;39m' + // bold cyan
    ' \x1b[33;1mdeprecated\x1b[22;39m' + // bold yellow
    ' \x1b[0m' + msg + '\x1b[39m' // reset

  // add stack trace
  if (this._traced) {
    for (var i = 0; i < stack.length; i++) {
      formatted += '\n    \x1b[36mat ' + callSiteToString(stack[i]) + '\x1b[39m' // cyan
    }

    return formatted
  }

  if (caller) {
    formatted += ' \x1b[36m' + formatLocation(caller) + '\x1b[39m' // cyan
  }

  return formatted
}

/**
 * Format call site location.
 */

function formatLocation (callSite) {
  return relative(basePath, callSite[0]) +
    ':' + callSite[1] +
    ':' + callSite[2]
}

/**
 * Get the stack as array of call sites.
 */

function getStack () {
  var limit = Error.stackTraceLimit
  var obj = {}
  var prep = Error.prepareStackTrace

  Error.prepareStackTrace = prepareObjectStackTrace
  Error.stackTraceLimit = Math.max(10, limit)

  // capture the stack
  Error.captureStackTrace(obj)

  // slice this function off the top
  var stack = obj.stack.slice(1)

  Error.prepareStackTrace = prep
  Error.stackTraceLimit = limit

  return stack
}

/**
 * Capture call site stack from v8.
 */

function prepareObjectStackTrace (obj, stack) {
  return stack
}

/**
 * Return a wrapped function in a deprecation message.
 */

function wrapfunction (fn, message) {
  if (typeof fn !== 'function') {
    throw new TypeError('argument fn must be a function')
  }

  var args = createArgumentsString(fn.length)
  var deprecate = this // eslint-disable-line no-unused-vars
  var stack = getStack()
  var site = callSiteLocation(stack[1])

  site.name = fn.name

   // eslint-disable-next-line no-eval
  var deprecatedfn = eval('(function (' + args + ') {\n' +
    '"use strict"\n' +
    'log.call(deprecate, message, site)\n' +
    'return fn.apply(this, arguments)\n' +
    '})')

  return deprecatedfn
}

/**
 * Wrap property in a deprecation message.
 */

function wrapproperty (obj, prop, message) {
  if (!obj || (typeof obj !== 'object' && typeof obj !== 'function')) {
    throw new TypeError('argument obj must be object')
  }

  var descriptor = Object.getOwnPropertyDescriptor(obj, prop)

  if (!descriptor) {
    throw new TypeError('must call property on owner object')
  }

  if (!descriptor.configurable) {
    throw new TypeError('property must be configurable')
  }

  var deprecate = this
  var stack = getStack()
  var site = callSiteLocation(stack[1])

  // set site name
  site.name = prop

  // convert data descriptor
  if ('value' in descriptor) {
    descriptor = convertDataDescriptorToAccessor(obj, prop, message)
  }

  var get = descriptor.get
  var set = descriptor.set

  // wrap getter
  if (typeof get === 'function') {
    descriptor.get = function getter () {
      log.call(deprecate, message, site)
      return get.apply(this, arguments)
    }
  }

  // wrap setter
  if (typeof set === 'function') {
    descriptor.set = function setter () {
      log.call(deprecate, message, site)
      return set.apply(this, arguments)
    }
  }

  Object.defineProperty(obj, prop, descriptor)
}

/**
 * Create DeprecationError for deprecation
 */

function DeprecationError (namespace, message, stack) {
  var error = new Error()
  var stackString

  Object.defineProperty(error, 'constructor', {
    value: DeprecationError
  })

  Object.defineProperty(error, 'message', {
    configurable: true,
    enumerable: false,
    value: message,
    writable: true
  })

  Object.defineProperty(error, 'name', {
    enumerable: false,
    configurable: true,
    value: 'DeprecationError',
    writable: true
  })

  Object.defineProperty(error, 'namespace', {
    configurable: true,
    enumerable: false,
    value: namespace,
    writable: true
  })

  Object.defineProperty(error, 'stack', {
    configurable: true,
    enumerable: false,
    get: function () {
      if (stackString !== undefined) {
        return stackString
      }

      // prepare stack trace
      return (stackString = createStackString.call(this, stack))
    },
    set: function setter (val) {
      stackString = val
    }
  })

  return error
}


/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * depd
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */



/**
 * Module exports.
 */

module.exports = callSiteToString

/**
 * Format a CallSite file location to a string.
 */

function callSiteFileLocation (callSite) {
  var fileName
  var fileLocation = ''

  if (callSite.isNative()) {
    fileLocation = 'native'
  } else if (callSite.isEval()) {
    fileName = callSite.getScriptNameOrSourceURL()
    if (!fileName) {
      fileLocation = callSite.getEvalOrigin()
    }
  } else {
    fileName = callSite.getFileName()
  }

  if (fileName) {
    fileLocation += fileName

    var lineNumber = callSite.getLineNumber()
    if (lineNumber != null) {
      fileLocation += ':' + lineNumber

      var columnNumber = callSite.getColumnNumber()
      if (columnNumber) {
        fileLocation += ':' + columnNumber
      }
    }
  }

  return fileLocation || 'unknown source'
}

/**
 * Format a CallSite to a string.
 */

function callSiteToString (callSite) {
  var addSuffix = true
  var fileLocation = callSiteFileLocation(callSite)
  var functionName = callSite.getFunctionName()
  var isConstructor = callSite.isConstructor()
  var isMethodCall = !(callSite.isToplevel() || isConstructor)
  var line = ''

  if (isMethodCall) {
    var methodName = callSite.getMethodName()
    var typeName = getConstructorName(callSite)

    if (functionName) {
      if (typeName && functionName.indexOf(typeName) !== 0) {
        line += typeName + '.'
      }

      line += functionName

      if (methodName && functionName.lastIndexOf('.' + methodName) !== functionName.length - methodName.length - 1) {
        line += ' [as ' + methodName + ']'
      }
    } else {
      line += typeName + '.' + (methodName || '<anonymous>')
    }
  } else if (isConstructor) {
    line += 'new ' + (functionName || '<anonymous>')
  } else if (functionName) {
    line += functionName
  } else {
    addSuffix = false
    line += fileLocation
  }

  if (addSuffix) {
    line += ' (' + fileLocation + ')'
  }

  return line
}

/**
 * Get constructor name of reviver.
 */

function getConstructorName (obj) {
  var receiver = obj.receiver
  return (receiver.constructor && receiver.constructor.name) || null
}


/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * depd
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */



/**
 * Module exports.
 * @public
 */

module.exports = eventListenerCount

/**
 * Get the count of listeners on an event emitter of a specific type.
 */

function eventListenerCount (emitter, type) {
  return emitter.listeners(type).length
}


/***/ }),
/* 17 */,
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * on-finished
 * Copyright(c) 2013 Jonathan Ong
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */



/**
 * Module exports.
 * @public
 */

module.exports = onFinished
module.exports.isFinished = isFinished

/**
 * Module dependencies.
 * @private
 */

var first = __webpack_require__(19)

/**
 * Variables.
 * @private
 */

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
  ? setImmediate
  : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) }

/**
 * Invoke callback when the response has finished, useful for
 * cleaning up resources afterwards.
 *
 * @param {object} msg
 * @param {function} listener
 * @return {object}
 * @public
 */

function onFinished(msg, listener) {
  if (isFinished(msg) !== false) {
    defer(listener, null, msg)
    return msg
  }

  // attach the listener to the message
  attachListener(msg, listener)

  return msg
}

/**
 * Determine if message is already finished.
 *
 * @param {object} msg
 * @return {boolean}
 * @public
 */

function isFinished(msg) {
  var socket = msg.socket

  if (typeof msg.finished === 'boolean') {
    // OutgoingMessage
    return Boolean(msg.finished || (socket && !socket.writable))
  }

  if (typeof msg.complete === 'boolean') {
    // IncomingMessage
    return Boolean(msg.upgrade || !socket || !socket.readable || (msg.complete && !msg.readable))
  }

  // don't know
  return undefined
}

/**
 * Attach a finished listener to the message.
 *
 * @param {object} msg
 * @param {function} callback
 * @private
 */

function attachFinishedListener(msg, callback) {
  var eeMsg
  var eeSocket
  var finished = false

  function onFinish(error) {
    eeMsg.cancel()
    eeSocket.cancel()

    finished = true
    callback(error)
  }

  // finished on first message event
  eeMsg = eeSocket = first([[msg, 'end', 'finish']], onFinish)

  function onSocket(socket) {
    // remove listener
    msg.removeListener('socket', onSocket)

    if (finished) return
    if (eeMsg !== eeSocket) return

    // finished on first socket event
    eeSocket = first([[socket, 'error', 'close']], onFinish)
  }

  if (msg.socket) {
    // socket already assigned
    onSocket(msg.socket)
    return
  }

  // wait for socket to be assigned
  msg.on('socket', onSocket)

  if (msg.socket === undefined) {
    // node.js 0.8 patch
    patchAssignSocket(msg, onSocket)
  }
}

/**
 * Attach the listener to the message.
 *
 * @param {object} msg
 * @return {function}
 * @private
 */

function attachListener(msg, listener) {
  var attached = msg.__onFinished

  // create a private single listener with queue
  if (!attached || !attached.queue) {
    attached = msg.__onFinished = createListener(msg)
    attachFinishedListener(msg, attached)
  }

  attached.queue.push(listener)
}

/**
 * Create listener on message.
 *
 * @param {object} msg
 * @return {function}
 * @private
 */

function createListener(msg) {
  function listener(err) {
    if (msg.__onFinished === listener) msg.__onFinished = null
    if (!listener.queue) return

    var queue = listener.queue
    listener.queue = null

    for (var i = 0; i < queue.length; i++) {
      queue[i](err, msg)
    }
  }

  listener.queue = []

  return listener
}

/**
 * Patch ServerResponse.prototype.assignSocket for node.js 0.8.
 *
 * @param {ServerResponse} res
 * @param {function} callback
 * @private
 */

function patchAssignSocket(res, callback) {
  var assignSocket = res.assignSocket

  if (typeof assignSocket !== 'function') return

  // res.on('socket', callback) is broken in 0.8
  res.assignSocket = function _assignSocket(socket) {
    assignSocket.call(this, socket)
    callback(socket)
  }
}


/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * ee-first
 * Copyright(c) 2014 Jonathan Ong
 * MIT Licensed
 */



/**
 * Module exports.
 * @public
 */

module.exports = first

/**
 * Get the first event in a set of event emitters and event pairs.
 *
 * @param {array} stuff
 * @param {function} done
 * @public
 */

function first(stuff, done) {
  if (!Array.isArray(stuff))
    throw new TypeError('arg must be an array of [ee, events...] arrays')

  var cleanups = []

  for (var i = 0; i < stuff.length; i++) {
    var arr = stuff[i]

    if (!Array.isArray(arr) || arr.length < 2)
      throw new TypeError('each array member must be [ee, events...]')

    var ee = arr[0]

    for (var j = 1; j < arr.length; j++) {
      var event = arr[j]
      var fn = listener(event, callback)

      // listen to the event
      ee.on(event, fn)
      // push this listener to the list of cleanups
      cleanups.push({
        ee: ee,
        event: event,
        fn: fn,
      })
    }
  }

  function callback() {
    cleanup()
    done.apply(null, arguments)
  }

  function cleanup() {
    var x
    for (var i = 0; i < cleanups.length; i++) {
      x = cleanups[i]
      x.ee.removeListener(x.event, x.fn)
    }
  }

  function thunk(fn) {
    done = fn
  }

  thunk.cancel = cleanup

  return thunk
}

/**
 * Create the event listener.
 * @private
 */

function listener(event, done) {
  return function onevent(arg1) {
    var args = new Array(arguments.length)
    var ee = this
    var err = event === 'error'
      ? arg1
      : null

    // copy args to prevent arguments escaping scope
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i]
    }

    done(err, ee, event, args)
  }
}


/***/ }),
/* 20 */,
/* 21 */,
/* 22 */,
/* 23 */,
/* 24 */,
/* 25 */,
/* 26 */,
/* 27 */,
/* 28 */,
/* 29 */,
/* 30 */,
/* 31 */,
/* 32 */,
/* 33 */,
/* 34 */,
/* 35 */,
/* 36 */,
/* 37 */,
/* 38 */,
/* 39 */,
/* 40 */,
/* 41 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * morgan
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2017 Douglas Christopher Wilson
 * MIT Licensed
 */



/**
 * Module exports.
 * @public
 */

module.exports = morgan
module.exports.compile = compile
module.exports.format = format
module.exports.token = token

/**
 * Module dependencies.
 * @private
 */

var auth = __webpack_require__(42)
var debug = __webpack_require__(9)('morgan')
var deprecate = __webpack_require__(14)('morgan')
var onFinished = __webpack_require__(18)
var onHeaders = __webpack_require__(45)

/**
 * Array of CLF month names.
 * @private
 */

var CLF_MONTH = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

/**
 * Default log buffer duration.
 * @private
 */

var DEFAULT_BUFFER_DURATION = 1000

/**
 * Create a logger middleware.
 *
 * @public
 * @param {String|Function} format
 * @param {Object} [options]
 * @return {Function} middleware
 */

function morgan (format, options) {
  var fmt = format
  var opts = options || {}

  if (format && typeof format === 'object') {
    opts = format
    fmt = opts.format || 'default'

    // smart deprecation message
    deprecate('morgan(options): use morgan(' + (typeof fmt === 'string' ? JSON.stringify(fmt) : 'format') + ', options) instead')
  }

  if (fmt === undefined) {
    deprecate('undefined format: specify a format')
  }

  // output on request instead of response
  var immediate = opts.immediate

  // check if log entry should be skipped
  var skip = opts.skip || false

  // format function
  var formatLine = typeof fmt !== 'function'
    ? getFormatFunction(fmt)
    : fmt

  // stream
  var buffer = opts.buffer
  var stream = opts.stream || process.stdout

  // buffering support
  if (buffer) {
    deprecate('buffer option')

    // flush interval
    var interval = typeof buffer !== 'number'
      ? DEFAULT_BUFFER_DURATION
      : buffer

    // swap the stream
    stream = createBufferStream(stream, interval)
  }

  return function logger (req, res, next) {
    // request data
    req._startAt = undefined
    req._startTime = undefined
    req._remoteAddress = getip(req)

    // response data
    res._startAt = undefined
    res._startTime = undefined

    // record request start
    recordStartTime.call(req)

    function logRequest () {
      if (skip !== false && skip(req, res)) {
        debug('skip request')
        return
      }

      var line = formatLine(morgan, req, res)

      if (line == null) {
        debug('skip line')
        return
      }

      debug('log request')
      stream.write(line + '\n')
    };

    if (immediate) {
      // immediate log
      logRequest()
    } else {
      // record response start
      onHeaders(res, recordStartTime)

      // log when response finished
      onFinished(res, logRequest)
    }

    next()
  }
}

/**
 * Apache combined log format.
 */

morgan.format('combined', ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"')

/**
 * Apache common log format.
 */

morgan.format('common', ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length]')

/**
 * Default format.
 */

morgan.format('default', ':remote-addr - :remote-user [:date] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"')
deprecate.property(morgan, 'default', 'default format: use combined format')

/**
 * Short format.
 */

morgan.format('short', ':remote-addr :remote-user :method :url HTTP/:http-version :status :res[content-length] - :response-time ms')

/**
 * Tiny format.
 */

morgan.format('tiny', ':method :url :status :res[content-length] - :response-time ms')

/**
 * dev (colored)
 */

morgan.format('dev', function developmentFormatLine (tokens, req, res) {
  // get the status code if response written
  var status = headersSent(res)
    ? res.statusCode
    : undefined

  // get status color
  var color = status >= 500 ? 31 // red
    : status >= 400 ? 33 // yellow
    : status >= 300 ? 36 // cyan
    : status >= 200 ? 32 // green
    : 0 // no color

  // get colored function
  var fn = developmentFormatLine[color]

  if (!fn) {
    // compile
    fn = developmentFormatLine[color] = compile('\x1b[0m:method :url \x1b[' +
      color + 'm:status \x1b[0m:response-time ms - :res[content-length]\x1b[0m')
  }

  return fn(tokens, req, res)
})

/**
 * request url
 */

morgan.token('url', function getUrlToken (req) {
  return req.originalUrl || req.url
})

/**
 * request method
 */

morgan.token('method', function getMethodToken (req) {
  return req.method
})

/**
 * response time in milliseconds
 */

morgan.token('response-time', function getResponseTimeToken (req, res, digits) {
  if (!req._startAt || !res._startAt) {
    // missing request and/or response start time
    return
  }

  // calculate diff
  var ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6

  // return truncated value
  return ms.toFixed(digits === undefined ? 3 : digits)
})

/**
 * current date
 */

morgan.token('date', function getDateToken (req, res, format) {
  var date = new Date()

  switch (format || 'web') {
    case 'clf':
      return clfdate(date)
    case 'iso':
      return date.toISOString()
    case 'web':
      return date.toUTCString()
  }
})

/**
 * response status code
 */

morgan.token('status', function getStatusToken (req, res) {
  return headersSent(res)
    ? String(res.statusCode)
    : undefined
})

/**
 * normalized referrer
 */

morgan.token('referrer', function getReferrerToken (req) {
  return req.headers['referer'] || req.headers['referrer']
})

/**
 * remote address
 */

morgan.token('remote-addr', getip)

/**
 * remote user
 */

morgan.token('remote-user', function getRemoteUserToken (req) {
  // parse basic credentials
  var credentials = auth(req)

  // return username
  return credentials
    ? credentials.name
    : undefined
})

/**
 * HTTP version
 */

morgan.token('http-version', function getHttpVersionToken (req) {
  return req.httpVersionMajor + '.' + req.httpVersionMinor
})

/**
 * UA string
 */

morgan.token('user-agent', function getUserAgentToken (req) {
  return req.headers['user-agent']
})

/**
 * request header
 */

morgan.token('req', function getRequestToken (req, res, field) {
  // get header
  var header = req.headers[field.toLowerCase()]

  return Array.isArray(header)
    ? header.join(', ')
    : header
})

/**
 * response header
 */

morgan.token('res', function getResponseHeader (req, res, field) {
  if (!headersSent(res)) {
    return undefined
  }

  // get header
  var header = res.getHeader(field)

  return Array.isArray(header)
    ? header.join(', ')
    : header
})

/**
 * Format a Date in the common log format.
 *
 * @private
 * @param {Date} dateTime
 * @return {string}
 */

function clfdate (dateTime) {
  var date = dateTime.getUTCDate()
  var hour = dateTime.getUTCHours()
  var mins = dateTime.getUTCMinutes()
  var secs = dateTime.getUTCSeconds()
  var year = dateTime.getUTCFullYear()

  var month = CLF_MONTH[dateTime.getUTCMonth()]

  return pad2(date) + '/' + month + '/' + year +
    ':' + pad2(hour) + ':' + pad2(mins) + ':' + pad2(secs) +
    ' +0000'
}

/**
 * Compile a format string into a function.
 *
 * @param {string} format
 * @return {function}
 * @public
 */

function compile (format) {
  if (typeof format !== 'string') {
    throw new TypeError('argument format must be a string')
  }

  var fmt = format.replace(/"/g, '\\"')
  var js = '  "use strict"\n  return "' + fmt.replace(/:([-\w]{2,})(?:\[([^\]]+)\])?/g, function (_, name, arg) {
    var tokenArguments = 'req, res'
    var tokenFunction = 'tokens[' + String(JSON.stringify(name)) + ']'

    if (arg !== undefined) {
      tokenArguments += ', ' + String(JSON.stringify(arg))
    }

    return '" +\n    (' + tokenFunction + '(' + tokenArguments + ') || "-") + "'
  }) + '"'

  // eslint-disable-next-line no-new-func
  return new Function('tokens, req, res', js)
}

/**
 * Create a basic buffering stream.
 *
 * @param {object} stream
 * @param {number} interval
 * @public
 */

function createBufferStream (stream, interval) {
  var buf = []
  var timer = null

  // flush function
  function flush () {
    timer = null
    stream.write(buf.join(''))
    buf.length = 0
  }

  // write function
  function write (str) {
    if (timer === null) {
      timer = setTimeout(flush, interval)
    }

    buf.push(str)
  }

  // return a minimal "stream"
  return { write: write }
}

/**
 * Define a format with the given name.
 *
 * @param {string} name
 * @param {string|function} fmt
 * @public
 */

function format (name, fmt) {
  morgan[name] = fmt
  return this
}

/**
 * Lookup and compile a named format function.
 *
 * @param {string} name
 * @return {function}
 * @public
 */

function getFormatFunction (name) {
  // lookup format
  var fmt = morgan[name] || name || morgan.default

  // return compiled format
  return typeof fmt !== 'function'
    ? compile(fmt)
    : fmt
}

/**
 * Get request IP address.
 *
 * @private
 * @param {IncomingMessage} req
 * @return {string}
 */

function getip (req) {
  return req.ip ||
    req._remoteAddress ||
    (req.connection && req.connection.remoteAddress) ||
    undefined
}

/**
 * Determine if the response headers have been sent.
 *
 * @param {object} res
 * @returns {boolean}
 * @private
 */

function headersSent (res) {
  return typeof res.headersSent !== 'boolean'
    ? Boolean(res._header)
    : res.headersSent
}

/**
 * Pad number to two digits.
 *
 * @private
 * @param {number} num
 * @return {string}
 */

function pad2 (num) {
  var str = String(num)

  return (str.length === 1 ? '0' : '') + str
}

/**
 * Record the start time.
 * @private
 */

function recordStartTime () {
  this._startAt = process.hrtime()
  this._startTime = new Date()
}

/**
 * Define a token function with the given name,
 * and callback fn(req, res).
 *
 * @param {string} name
 * @param {function} fn
 * @public
 */

function token (name, fn) {
  morgan[name] = fn
  return this
}


/***/ }),
/* 42 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * basic-auth
 * Copyright(c) 2013 TJ Holowaychuk
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2015-2016 Douglas Christopher Wilson
 * MIT Licensed
 */



/**
 * Module dependencies.
 * @private
 */

var Buffer = __webpack_require__(43).Buffer

/**
 * Module exports.
 * @public
 */

module.exports = auth
module.exports.parse = parse

/**
 * RegExp for basic auth credentials
 *
 * credentials = auth-scheme 1*SP token68
 * auth-scheme = "Basic" ; case insensitive
 * token68     = 1*( ALPHA / DIGIT / "-" / "." / "_" / "~" / "+" / "/" ) *"="
 * @private
 */

var CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/

/**
 * RegExp for basic auth user/pass
 *
 * user-pass   = userid ":" password
 * userid      = *<TEXT excluding ":">
 * password    = *TEXT
 * @private
 */

var USER_PASS_REGEXP = /^([^:]*):(.*)$/

/**
 * Parse the Authorization header field of a request.
 *
 * @param {object} req
 * @return {object} with .name and .pass
 * @public
 */

function auth (req) {
  if (!req) {
    throw new TypeError('argument req is required')
  }

  if (typeof req !== 'object') {
    throw new TypeError('argument req is required to be an object')
  }

  // get header
  var header = getAuthorization(req)

  // parse header
  return parse(header)
}

/**
 * Decode base64 string.
 * @private
 */

function decodeBase64 (str) {
  return Buffer.from(str, 'base64').toString()
}

/**
 * Get the Authorization header from request object.
 * @private
 */

function getAuthorization (req) {
  if (!req.headers || typeof req.headers !== 'object') {
    throw new TypeError('argument req is required to have headers property')
  }

  return req.headers.authorization
}

/**
 * Parse basic auth to object.
 *
 * @param {string} string
 * @return {object}
 * @public
 */

function parse (string) {
  if (typeof string !== 'string') {
    return undefined
  }

  // parse header
  var match = CREDENTIALS_REGEXP.exec(string)

  if (!match) {
    return undefined
  }

  // decode user pass
  var userPass = USER_PASS_REGEXP.exec(decodeBase64(match[1]))

  if (!userPass) {
    return undefined
  }

  // return credentials object
  return new Credentials(userPass[1], userPass[2])
}

/**
 * Object to represent user credentials.
 * @private
 */

function Credentials (name, pass) {
  this.name = name
  this.pass = pass
}


/***/ }),
/* 43 */
/***/ (function(module, exports, __webpack_require__) {

/* eslint-disable node/no-deprecated-api */
var buffer = __webpack_require__(44)
var Buffer = buffer.Buffer

// alternative to using Object.keys for old browsers
function copyProps (src, dst) {
  for (var key in src) {
    dst[key] = src[key]
  }
}
if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  module.exports = buffer
} else {
  // Copy properties from require('buffer')
  copyProps(buffer, exports)
  exports.Buffer = SafeBuffer
}

function SafeBuffer (arg, encodingOrOffset, length) {
  return Buffer(arg, encodingOrOffset, length)
}

// Copy static methods from Buffer
copyProps(Buffer, SafeBuffer)

SafeBuffer.from = function (arg, encodingOrOffset, length) {
  if (typeof arg === 'number') {
    throw new TypeError('Argument must not be a number')
  }
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.alloc = function (size, fill, encoding) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  var buf = Buffer(size)
  if (fill !== undefined) {
    if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
  } else {
    buf.fill(0)
  }
  return buf
}

SafeBuffer.allocUnsafe = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer(size)
}

SafeBuffer.allocUnsafeSlow = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return buffer.SlowBuffer(size)
}


/***/ }),
/* 44 */
/***/ (function(module, exports) {

module.exports = require("buffer");

/***/ }),
/* 45 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * on-headers
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */



/**
 * Reference to Array slice.
 */

var slice = Array.prototype.slice

/**
 * Execute a listener when a response is about to write headers.
 *
 * @param {Object} res
 * @return {Function} listener
 * @api public
 */

module.exports = function onHeaders(res, listener) {
  if (!res) {
    throw new TypeError('argument res is required')
  }

  if (typeof listener !== 'function') {
    throw new TypeError('argument listener must be a function')
  }

  res.writeHead = createWriteHead(res.writeHead, listener)
}

function createWriteHead(prevWriteHead, listener) {
  var fired = false;

  // return function with core name and argument list
  return function writeHead(statusCode) {
    // set headers from arguments
    var args = setWriteHeadHeaders.apply(this, arguments);

    // fire listener
    if (!fired) {
      fired = true
      listener.call(this)

      // pass-along an updated status code
      if (typeof args[0] === 'number' && this.statusCode !== args[0]) {
        args[0] = this.statusCode
        args.length = 1
      }
    }

    prevWriteHead.apply(this, args);
  }
}

function setWriteHeadHeaders(statusCode) {
  var length = arguments.length
  var headerIndex = length > 1 && typeof arguments[1] === 'string'
    ? 2
    : 1

  var headers = length >= headerIndex + 1
    ? arguments[headerIndex]
    : undefined

  this.statusCode = statusCode

  // the following block is from node.js core
  if (Array.isArray(headers)) {
    // handle array case
    for (var i = 0, len = headers.length; i < len; ++i) {
      this.setHeader(headers[i][0], headers[i][1])
    }
  } else if (headers) {
    // handle object case
    var keys = Object.keys(headers)
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      if (k) this.setHeader(k, headers[k])
    }
  }

  // copy leading arguments
  var args = new Array(Math.min(length, headerIndex))
  for (var i = 0; i < args.length; i++) {
    args[i] = arguments[i]
  }

  return args
}


/***/ })
/******/ ]);