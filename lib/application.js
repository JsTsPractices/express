/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 * @private
 */

var finalhandler = require("finalhandler");
var Router = require("./router");
var methods = require("methods");
var middleware = require("./middleware/init");
var query = require("./middleware/query");
var debug = require("debug")("express:application");
var View = require("./view");
var http = require("http");
var compileETag = require("./utils").compileETag;
var compileQueryParser = require("./utils").compileQueryParser;
var compileTrust = require("./utils").compileTrust;
var deprecate = require("depd")("express");
var flatten = require("array-flatten");
var merge = require("utils-merge");
var resolve = require("path").resolve;
var setPrototypeOf = require("setprototypeof");
var slice = Array.prototype.slice;

/**
 * Application prototype.
 */

var app = (exports = module.exports = {});

/**
 * Variable for trust proxy inheritance back-compat
 * @private
 */

var trustProxyDefaultSymbol = "@@symbol:trust_proxy_default";

/**
 * Initialize the server.
 *
 *   - setup default configuration
 *   - setup default middleware
 *   - setup route reflection methods
 *
 * @private
 */

app.init = function init() {
  this.cache = {};
  this.engines = {};
  this.settings = {};

  this.defaultConfiguration();
};

/**
 * Initialize application configuration.
 * @private
 */

app.defaultConfiguration = function defaultConfiguration() {
  var env = process.env.NODE_ENV || "development";

  /**
   * settings에 기본 설정값들을 저장한다.
   *
   * x-powered-by : true
   * -> x로 시작하는 대부분의 http헤더들은 비공식 헤더를 의미한다.
   * -> 해당 앱이 어떤 라이브러리 || 프레임워크 || 언어로 작성되었는지를 알려주기위해 만드는것 같다.
   * -> 해킹을 방지하기위해 x-powered-by헤더를 포함시키지 않거나, 일부러 틀린 정보(php기반인데, APS.NET이라고 적는등의)를 기재하는 경우가 있다.
   * -> 기본 세팅은 true인데 실제 작동하는 express서버에서는 해당 헤더가 보이지 않는것으로 보아 이후 값을 변경하거나 하는것 같다.
   *
   * https://stackoverflow.com/questions/33580671/what-does-x-powered-by-mean 참고
   *
   * enable : set함수를 호출한다. 이때 enable의 첫번째 인자를 set함수의 첫번째 인자로하며, set함수의 두번째 인자는 true가 된다.
   *
   */

  // default settings
  this.enable("x-powered-by");
  this.set("etag", "weak");
  this.set("env", env);
  this.set("query parser", "extended");
  this.set("subdomain offset", 2);
  this.set("trust proxy", false);

  /**
   * settings개체에 기본 값을 설정한다.
   *
   * x-powered-by : true
   * etag : "weak"
   * etag fn : ETag생성 함수
   * env : "development"
   * query parser : "extended"
   * query parser fn : 함수
   * subdomain offset : 2
   * trust proxy : false
   * trust proxy fn : 함수
   */

  /**
   * subdomain offset : subdomain segment의 시작을 결정한다.
   *
   * 도메인 구성
   *
   * 1. Top-level domain(TLD) -> .com / .org
   *
   * 2. Second-level domain(SLD) -> naver / google
   *
   * subdomain
   * SLD앞에 오는것
   * 가장 공통적인 subdomain은 www이다.
   *
   * subdomain의 예: m.naver.com -> 'm'
   */

  /**
   * subdomain offset은 TLD부터 카운팅 하는것 같다.
   * TLD(0) SLD(1) subdomain(2) 순서라 subdomain offset은 기본 2로 설정되는듯
   *
   * test2.localhost:4000과 같이 TLD가 없고, subdomain offset이 기본값(2)으로 설정되어 있는경우 subdomain을 가져올 수 없다고 한다.
   *
   * https://stackoverflow.com/questions/29146489/how-to-get-local-subdomains-using-express-js-s-req-subdomains 참고
   */

  /**
   * https://blog.hubspot.com/what-is-a-domain
   *
   * http:// -> 프로토콜
   *
   * blog. -> subdomain
   *
   * hubspot -> SLD
   *
   * .com -> TLD
   *
   * hubspot.com -> domain name
   *
   * /what-is-a-domain -> page path
   *
   * https://blog.hubspot.com/website/what-is-a-subdomain?toc-variant-a= 참고
   */

  // trust proxy inherit back-compat
  Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
    configurable: true,
    value: true,
  });

  /**
   * this.set("trust proxy", false)설정시 @@symbol:trust_proxy_default : false로 설정이 되는데 다시 값을 설정하는 이유
   *
   * 기본 값이 세팅이 된 경우(app.init()에 의해 설정된 값)와 사용자가 임의로 설정(app.set("trust proxy", true))한 경우를 구분하기 위한것으로 추정됨
   *
   * 기본 값으로 설정된 경우  @@symbol:trust_proxy_default : true 이며
   * 그 이외의 경우에서 "trust proxy"를 설정한 경우
   * 굳이 "trust proxy"값을 바꿀때 @@symbol:trust_proxy_default의 값을 바꾸지 않는 한 @@symbol:trust_proxy_default : false가 설정이 됨
   *
   */

  debug("booting in %s mode", env);

  /**
   * mount 이벤트
   *
   * const express = require("express");
   * const app = express();
   * const admin = express();
   * app.use("/admin", admin); <- 마운트 이벤트 발생
   */

  this.on("mount", function onmount(parent) {
    // inherit trust proxy
    if (
      this.settings[trustProxyDefaultSymbol] === true &&
      typeof parent.settings["trust proxy fn"] === "function"
    ) {
      delete this.settings["trust proxy"];
      delete this.settings["trust proxy fn"];
    }
    /**
     * trust proxy가 default로 설정되어 있는 경우
     * 해당 설정을 지운다.
     */

    // inherit protos
    /**
     * 부모의 프로퍼티를 자식의 프로퍼티의 프로토타입으로 설정한다.
     */
    setPrototypeOf(this.request, parent.request);
    setPrototypeOf(this.response, parent.response);
    setPrototypeOf(this.engines, parent.engines);
    setPrototypeOf(this.settings, parent.settings);
    /**
     * 개체와 프로토타입에 동일한 이름의 프로퍼티가 설정되어 있는 경우
     * 자식 프로퍼티를 우선한다.
     *
     * setPrototypeOf를 이용하여 부모의 프로퍼티를 자식의 프로퍼티의 프로토타입으로 설정한 이유는
     * 자식의 프로퍼티에 설정된 값이 있다면 자식의 값을 우선적으로 사용할수 있도록 하기위한것이 아닐까 추측
     */
  });

  // setup locals
  this.locals = Object.create(null);
  /**
   * hasOwnProperty등의 기본 메서드조차 없는 개체를 생성한다.
   */

  // top-most app is mounted at /
  this.mountpath = "/";
  /**
   * 위의 설정을 통해 마운트 이벤트가 정확하게 어떤 이벤트인지 감을 잡을 수 있는것 같다.
   */

  // default locals
  this.locals.settings = this.settings;

  // default configuration
  this.set("view", View);
  this.set("views", resolve("views"));
  this.set("jsonp callback name", "callback");

  if (env === "production") {
    this.enable("view cache");
  }

  Object.defineProperty(this, "router", {
    get: function () {
      throw new Error(
        "'app.router' is deprecated!\nPlease see the 3.x to 4.x migration guide for details on how to update your app."
      );
    },
  });
};

/**
 * lazily adds the base router if it has not yet been added.
 *
 * We cannot add the base router in the defaultConfiguration because
 * it reads app settings which might be set after that has run.
 *
 * @private
 */
app.lazyrouter = function lazyrouter() {
  if (!this._router) {
    this._router = new Router({
      caseSensitive: this.enabled("case sensitive routing"),
      strict: this.enabled("strict routing"),
    });

    this._router.use(query(this.get("query parser fn")));
    this._router.use(middleware.init(this));
  }
};

/**
 * Dispatch a req, res pair into the application. Starts pipeline processing.
 *
 * If no callback is provided, then default error handlers will respond
 * in the event of an error bubbling through the stack.
 *
 * @private
 */

app.handle = function handle(req, res, callback) {
  var router = this._router;

  // final handler
  var done =
    callback ||
    finalhandler(req, res, {
      env: this.get("env"),
      onerror: logerror.bind(this),
    });

  // no routes
  if (!router) {
    debug("no routes defined on app");
    done();
    return;
  }

  router.handle(req, res, done);
};

/**
 * Proxy `Router#use()` to add middleware to the app router.
 * See Router#use() documentation for details.
 *
 * If the _fn_ parameter is an express app, then it will be
 * mounted at the _route_ specified.
 *
 * @public
 */

app.use = function use(fn) {
  var offset = 0;
  var path = "/";

  // default path to '/'
  // disambiguate app.use([fn])
  if (typeof fn !== "function") {
    var arg = fn;

    while (Array.isArray(arg) && arg.length !== 0) {
      arg = arg[0];
    }

    // first arg is the path
    if (typeof arg !== "function") {
      offset = 1;
      path = fn;
    }
  }

  var fns = flatten(slice.call(arguments, offset));

  if (fns.length === 0) {
    throw new TypeError("app.use() requires a middleware function");
  }

  // setup router
  this.lazyrouter();
  var router = this._router;

  fns.forEach(function (fn) {
    // non-express app
    if (!fn || !fn.handle || !fn.set) {
      return router.use(path, fn);
    }

    debug(".use app under %s", path);
    fn.mountpath = path;
    fn.parent = this;

    // restore .app property on req and res
    router.use(path, function mounted_app(req, res, next) {
      var orig = req.app;
      fn.handle(req, res, function (err) {
        setPrototypeOf(req, orig.request);
        setPrototypeOf(res, orig.response);
        next(err);
      });
    });

    // mounted an app
    fn.emit("mount", this);
  }, this);

  return this;
};

/**
 * Proxy to the app `Router#route()`
 * Returns a new `Route` instance for the _path_.
 *
 * Routes are isolated middleware stacks for specific paths.
 * See the Route api docs for details.
 *
 * @public
 */

app.route = function route(path) {
  this.lazyrouter();
  return this._router.route(path);
};

/**
 * Register the given template engine callback `fn`
 * as `ext`.
 *
 * By default will `require()` the engine based on the
 * file extension. For example if you try to render
 * a "foo.ejs" file Express will invoke the following internally:
 *
 *     app.engine('ejs', require('ejs').__express);
 *
 * For engines that do not provide `.__express` out of the box,
 * or if you wish to "map" a different extension to the template engine
 * you may use this method. For example mapping the EJS template engine to
 * ".html" files:
 *
 *     app.engine('html', require('ejs').renderFile);
 *
 * In this case EJS provides a `.renderFile()` method with
 * the same signature that Express expects: `(path, options, callback)`,
 * though note that it aliases this method as `ejs.__express` internally
 * so if you're using ".ejs" extensions you dont need to do anything.
 *
 * Some template engines do not follow this convention, the
 * [Consolidate.js](https://github.com/tj/consolidate.js)
 * library was created to map all of node's popular template
 * engines to follow this convention, thus allowing them to
 * work seamlessly within Express.
 *
 * @param {String} ext
 * @param {Function} fn
 * @return {app} for chaining
 * @public
 */

app.engine = function engine(ext, fn) {
  if (typeof fn !== "function") {
    throw new Error("callback function required");
  }

  // get file extension
  var extension = ext[0] !== "." ? "." + ext : ext;

  // store engine
  this.engines[extension] = fn;

  return this;
};

/**
 * Proxy to `Router#param()` with one added api feature. The _name_ parameter
 * can be an array of names.
 *
 * See the Router#param() docs for more details.
 *
 * @param {String|Array} name
 * @param {Function} fn
 * @return {app} for chaining
 * @public
 */

app.param = function param(name, fn) {
  this.lazyrouter();

  if (Array.isArray(name)) {
    for (var i = 0; i < name.length; i++) {
      this.param(name[i], fn);
    }

    return this;
  }

  this._router.param(name, fn);

  return this;
};

/**
 * Assign `setting` to `val`, or return `setting`'s value.
 *
 *    app.set('foo', 'bar');
 *    app.set('foo');
 *    // => "bar"
 *
 * Mounted servers inherit their parent server's settings.
 *
 * @param {String} setting
 * @param {*} [val]
 * @return {Server} for chaining
 * @public
 */

/**
 * 1. 첫번째 인자만 들어오는 경우 : 첫번째 인자를 key로하여 value를 리턴한다.
 * 2. 두번째 인자도 들어오는 경우 : 첫번째 인자를 key 두번째 인자를 value로 하여 settings개체에 저장한다.
 * 3. 첫번째 인자의 값이 etag, query parser, trust proxy인경우 : etag fn, query parser fn, trust proxy fn을 key 컴파일한값을 value로 하여 값을 저장한다.
 * 4. 첫번째 인자의 값이 trust proxy인경우 : @@symbol:trust_proxy_default를 key, false를 value로 하여 값을 저장한다.
 */

app.set = function set(setting, val) {
  /**
   * setting : settings의 key 값으로 사용
   * val : settings 변수의 value 값으로 사용
   */

  if (arguments.length === 1) {
    // app.get(setting)
    return this.settings[setting];
    /**
     * set함수에 입력된 인자의 개수가 하나인경우 입력된 인자를 키로하여 저장된 값을 리턴한다.
     */
  }

  debug('set "%s" to %o', setting, val);

  // set value
  this.settings[setting] = val;
  /**
   * settings에 값을 설정한다.
   */

  // trigger matched settings
  switch (setting) {
    case "etag":
      this.set("etag fn", compileETag(val));
      break;
    case "query parser":
      this.set("query parser fn", compileQueryParser(val));
      break;
    case "trust proxy":
      this.set("trust proxy fn", compileTrust(val));

      // trust proxy inherit back-compat
      Object.defineProperty(this.settings, trustProxyDefaultSymbol, {
        configurable: true,
        value: false,
      });

      break;
  }

  /**
   * setting값이 etag, query parser, trust proxy인경우
   * val값을 기반으로 etag fn, query parser fn, truest proxy fn값을 설정한다.
   * 이때 setting값이 trust proxy인경우 프로퍼티를 하나 더 추가한다.
   * "@@symbol:trust_proxy_default" : true
   *
   * 이때 @@symbol:trust_proxy_default의 경우 Object.defineProperty로 추가하였기 때문에 enumerable이 기본값인 false로 설정되어있다.
   */

  return this;
};

/**
 * Return the app's absolute pathname
 * based on the parent(s) that have
 * mounted it.
 *
 * For example if the application was
 * mounted as "/admin", which itself
 * was mounted as "/blog" then the
 * return value would be "/blog/admin".
 *
 * @return {String}
 * @private
 */

app.path = function path() {
  return this.parent ? this.parent.path() + this.mountpath : "";
};

/**
 * Check if `setting` is enabled (truthy).
 *
 *    app.enabled('foo')
 *    // => false
 *
 *    app.enable('foo')
 *    app.enabled('foo')
 *    // => true
 *
 * @param {String} setting
 * @return {Boolean}
 * @public
 */

app.enabled = function enabled(setting) {
  return Boolean(this.set(setting));
};

/**
 * Check if `setting` is disabled.
 *
 *    app.disabled('foo')
 *    // => true
 *
 *    app.enable('foo')
 *    app.disabled('foo')
 *    // => false
 *
 * @param {String} setting
 * @return {Boolean}
 * @public
 */

app.disabled = function disabled(setting) {
  return !this.set(setting);
};

/**
 * Enable `setting`.
 *
 * @param {String} setting
 * @return {app} for chaining
 * @public
 */

app.enable = function enable(setting) {
  return this.set(setting, true);
};

/**
 * Disable `setting`.
 *
 * @param {String} setting
 * @return {app} for chaining
 * @public
 */

app.disable = function disable(setting) {
  return this.set(setting, false);
};

/**
 * Delegate `.VERB(...)` calls to `router.VERB(...)`.
 */

methods.forEach(function (method) {
  app[method] = function (path) {
    if (method === "get" && arguments.length === 1) {
      // app.get(setting)
      return this.set(path);
    }

    this.lazyrouter();

    var route = this._router.route(path);
    route[method].apply(route, slice.call(arguments, 1));
    return this;
  };
});

/**
 * Special-cased "all" method, applying the given route `path`,
 * middleware, and callback to _every_ HTTP method.
 *
 * @param {String} path
 * @param {Function} ...
 * @return {app} for chaining
 * @public
 */

app.all = function all(path) {
  this.lazyrouter();

  var route = this._router.route(path);
  var args = slice.call(arguments, 1);

  for (var i = 0; i < methods.length; i++) {
    route[methods[i]].apply(route, args);
  }

  return this;
};

// del -> delete alias

app.del = deprecate.function(app.delete, "app.del: Use app.delete instead");

/**
 * Render the given view `name` name with `options`
 * and a callback accepting an error and the
 * rendered template string.
 *
 * Example:
 *
 *    app.render('email', { name: 'Tobi' }, function(err, html){
 *      // ...
 *    })
 *
 * @param {String} name
 * @param {Object|Function} options or fn
 * @param {Function} callback
 * @public
 */

app.render = function render(name, options, callback) {
  var cache = this.cache;
  var done = callback;
  var engines = this.engines;
  var opts = options;
  var renderOptions = {};
  var view;

  // support callback function as second arg
  if (typeof options === "function") {
    done = options;
    opts = {};
  }

  // merge app.locals
  merge(renderOptions, this.locals);

  // merge options._locals
  if (opts._locals) {
    merge(renderOptions, opts._locals);
  }

  // merge options
  merge(renderOptions, opts);

  // set .cache unless explicitly provided
  if (renderOptions.cache == null) {
    renderOptions.cache = this.enabled("view cache");
  }

  // primed cache
  if (renderOptions.cache) {
    view = cache[name];
  }

  // view
  if (!view) {
    var View = this.get("view");

    view = new View(name, {
      defaultEngine: this.get("view engine"),
      root: this.get("views"),
      engines: engines,
    });

    if (!view.path) {
      var dirs =
        Array.isArray(view.root) && view.root.length > 1
          ? 'directories "' +
            view.root.slice(0, -1).join('", "') +
            '" or "' +
            view.root[view.root.length - 1] +
            '"'
          : 'directory "' + view.root + '"';
      var err = new Error(
        'Failed to lookup view "' + name + '" in views ' + dirs
      );
      err.view = view;
      return done(err);
    }

    // prime the cache
    if (renderOptions.cache) {
      cache[name] = view;
    }
  }

  // render
  tryRender(view, renderOptions, done);
};

/**
 * Listen for connections.
 *
 * A node `http.Server` is returned, with this
 * application (which is a `Function`) as its
 * callback. If you wish to create both an HTTP
 * and HTTPS server you may do so with the "http"
 * and "https" modules as shown here:
 *
 *    var http = require('http')
 *      , https = require('https')
 *      , express = require('express')
 *      , app = express();
 *
 *    http.createServer(app).listen(80);
 *    https.createServer({ ... }, app).listen(443);
 *
 * @return {http.Server}
 * @public
 */

app.listen = function listen() {
  var server = http.createServer(this);
  return server.listen.apply(server, arguments);
};

/**
 * Log error using console.error.
 *
 * @param {Error} err
 * @private
 */

function logerror(err) {
  /* istanbul ignore next */
  if (this.get("env") !== "test") console.error(err.stack || err.toString());
}

/**
 * Try rendering a view.
 * @private
 */

function tryRender(view, options, callback) {
  try {
    view.render(options, callback);
  } catch (err) {
    callback(err);
  }
}
