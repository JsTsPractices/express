/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2013 Roman Shtylman
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

/**
 * Module dependencies.
 */

var bodyParser = require('body-parser')
var EventEmitter = require('events').EventEmitter;
var mixin = require('merge-descriptors');
var proto = require('./application');
var Route = require('./router/route');
var Router = require('./router');
var req = require('./request');
var res = require('./response');

/**
 * Expose `createApplication()`.
 */

exports = module.exports = createApplication;

/**
 * 일반적인 자바스크립트 개체를 익스포트해야하는 경우 이런 식으로 사용 가능
 *
 * exports.get = function (key) {
 *     // ...
 * };
 * exports.set = function (key, value) {
 *     // ..
 * };
 *
 * exports = {
 *     get: [Function],
 *     set: [Function]
 * };
 *
 * 하지만 Express의 경우 생성자 함수(createApplication)를 익스포트해야함
 * 이 경우 위의 경우처럼 프로퍼티를 변경하는것이 아닌 익스포트할 개체 자체를 생성자 함수(createApplication)로 대체하여야함
 *
 * module.exports = createApplication;
 *
 * 하지만 express의 경우 익스포트 해야하는것이 생성자 함수(createApplication)만이 아님
 *
 * exports.json = bodyParser.json
 * 등의 프로퍼티도 익스포트 해야함
 *
 * module.exports.json = bodyParse.json 보다는
 * exports.json = bodyParser.json이 깔끔함
 *
 * https://stackoverflow.com/questions/23509162/expressjs-javascript-fundamentals-exports-module-exports-createapplication 참고
 *
 * 진짜로 단지 귀찮아서일까?
 *
 * 아니었음
 *
 * 앞으로 스택오버플로우도 그대로 믿지는 말아야겠다
 */

/**
 * exports와 module.exports의 차이
 *
 * 노드의 경우 파일을 실행시키기 전에 퍄일내의 스크립트들을 즉시 실행 함수로 감쌈
 *
 * (function (exports, require, module, __filename, __dirname) {
 *     // 스크립트 위치
 * });
 *
 * 따라서 exports와 module의 경우 즉시 실행함수를 통해 들어오는 인자에 불과함
 *
 * exports와 module.exports의 경우 같은 빈 개체({})를 가리키고 있음
 *
 * 개체의 경우 참조형이기 때문에 프로퍼티를 변경하는경우 exports와 module.exports에 모두 반영이 됨
 *
 * 하지만 함수와 같이 exports 또는 module.exports 자체가 가리키고 있는것을 바꾸어야 하는경우 상황이 달라짐
 *
 * exports와 module.exports 둘다 가리키는 대상을 변경하지 않으면 서로 다른것을 가리키고 있을수 있음
 *
 */

/**
 * exports = module.exports = createApplication; 으로 모듈을 익스포트 하는 이유
 *
 * exports와 module.exports가 가리키는 개체의 프로퍼티를 바꾸는것이 아니라 개체 자체를 바꾸어야하는경우
 *
 * exports와 module.exports 둘다 바꾸지 않은경우 서로 다른것을 가리킬 위험이 있음
 */

/**
 * exports와 module.exports의 참조 관계
 *
 * exports -> module.exports -> {}
 *
 * var module = new Moduel(...);
 * var exports = module.exports;
 *
 * https://stackoverflow.com/questions/7137397/module-exports-vs-exports-in-node-js 참고
 *
 */

/**
 *
 * require()호출을 통해 받는 값 -> module.exports
 *
 * exports는 편의 변수로 모듈 작성자가 코드를 덜 작성하도록 돕는다.
 * exports는 require()함수에서 반환되지 않는다.
 *
 * https://edykim.com/ko/post/module.exports-and-exports-in-node.js/#요약 참고
 */

/**
 * moduel.exports와 exports require 간의 관계
 *
 * https://medium.com/@chullino/require-exports-module-exports-공식문서로-이해하기-1d024ec5aca3 참고
 */

/**
 * Create an express application.
 *
 * @return {Function}
 * @api public
 */

function createApplication() {
  var app = function(req, res, next) {
    // TODO 아직 이해 못함
    app.handle(req, res, next);
  };

  /**
   * merge-descriptors의 경우 두번째 인자의 프로퍼티를 첫번째 인자의 프로퍼티로 복사해줌
   * 세번째 인자가 true인 경우 첫번째 인자에 이미 존재하는 프로퍼티를 두번째 인자의 프로퍼티로 덮어 씌움
   */

  mixin(app, EventEmitter.prototype, false);
  /**
   * EventEmitter란?
   *
   * https://edykim.com/ko/post/events-eventemitter-translation-in-node.js/ https://stickie.tistory.com/66 참고
   *
   * 노드에서는 대부분의 이벤트를 비동기 방식으로 처리
   * EventEmitter는 이벤트를 보내고 받을수 있는 기능을 가지고 있음
   *
   */

  /**
   * EventEmitter.prototype에서 app에 복사한 프로퍼티
   *
   * _events
   * _eventsCount
   * _maxListeners
   * setMaxListeners
   * getMaxListeners
   * emit
   * addListener
   * on
   * prependListener
   * once
   * prependOnceListener
   * removeListener
   * off
   * removeAllListeners
   * listeners
   * rawListeners
   * listenerCount
   * eventNames
   *
   */

  /**
   * 현재 express에서 사용중인것으로 추정되는 메소드
   *
   * emit -> 등록한 이벤트를 호출
   * on -> 리스너 등록시 사용
   *
   */

  /**
   * EventEmitter를 상속받지 않은 이유
   *
   * app의 경우 함수이므로 EventEmitter를 상속받기보다는 필요한 프로퍼티를 복사하는것이 더 나을것으로 추정
   *
   */

  /**
   * express에서 EventEmitter의 프로퍼티를 복사하는 이유
   *
   * 비동기적인 이벤트 처리를 위해 복사하는것으로 추정
   */

  mixin(app, proto, false);

  /**
   *
   * proto에서 app에 복사한 프로퍼티
   *
   * init
   * defaultConfiguration
   * lazyrouter
   * handle
   * use
   * route
   * engine
   * param
   * set
   * path
   * enabled
   * disabled
   * enable
   * disable
   * acl
   * bind
   * checkout
   * connect
   * copy
   * delete
   * get
   * head
   * link
   * lock
   * m-search
   * merge
   * mkactivity
   * mkcalendar
   * mkcol
   * move
   * notify
   * options
   * patch
   * post
   * pri
   * propfind
   * proppatch
   * purge
   * put
   * rebind
   * report
   * search
   * source
   * subscribe
   * trace
   * unbind
   * unlink
   * unlock
   * unsubscribe
   * all
   * del
   * render
   * listen
   */

  // expose the prototype that will get set on requests
  app.request = Object.create(req, {
    app: { configurable: true, enumerable: true, writable: true, value: app }
  })

  // expose the prototype that will get set on responses
  app.response = Object.create(res, {
    app: { configurable: true, enumerable: true, writable: true, value: app }
  })

  /**
   * Object.create() 메서드는 프로토타입 개체 및 속성(property)을 갖는 새 개체를 만든다.
   *
   * https://developer.mozilla.org/ko/docs/Web/JavaScript/Reference/Global_Objects/Object/create 참고
   */

  /**
   * 첫번째 매개변수 : 새로 만든 개체의 프로토타입이어야 할 객체
   *
   * 두번째 매개변수 : 설정된 경우 새로 만든 개체에 프로퍼티 설명자(property descriptor)를 추가한다 / Object.defineProperties()의 두 번째 인수에 해당
   */

  /**
   * writable: true이면 값을 수정할 수 있다.
   * enumerable: true이면 반복문을 사용해 나열할 수 있다.
   * configurable: true이면 프로퍼티 삭제나 플래그 수정이 가능하다.
   *
   * 위의 프로퍼티들의 기본값은 false이다.
   *
   */

  /**
   * res 개체가 가지고있는 출력가능한 프로퍼티
   *
   * header
   * get
   * accepts
   * acceptsEncodings
   * acceptsEncoding
   * acceptsCharsets
   * acceptsCharset
   * acceptsLanguages
   * acceptsLanguage
   * range
   * param
   * is
   * protocol
   * secure
   * ip
   * ips
   * subdomains
   * path
   * hostname
   * host
   * fresh
   * stale
   * xhr
   *
   * app.request 개체가 가지고있는 출력가능한 프로퍼티
   *
   * app
   *
   */

  /**
   * res 개체가 가지고 있는 출력가능한 프로퍼티
   *
   * status
   * links
   * send
   * json
   * jsonp
   * sendStatus
   * sendFile
   * sendfile
   * download
   * type
   * contentType
   * format
   * attachment
   * append
   * header
   * set
   * get
   * clearCookie
   * cookie
   * location
   * redirect
   * vary
   * render
   *
   * app.response 개체가 가지고있는 출력가능한 프로퍼티
   *
   * app
   *
   */

  /**
   * res와 req개채의 프로퍼티중 app프로퍼티는 존재하지 않음
   *
   * Object.create의 두번쨰 매개변수를 통해 원본 개체에 존재하지 않는 프로퍼티를 추가할수 있는것 같다.
   *
   */

  /**
   * app request 프로퍼티와 response 프로퍼티에 req와 res의 프로토타입 개체 및 속성을 갖는 새 개체를 할당한다.
   * 이때 새로 할당하는 개체의 프로퍼티 app의 경우 { configurable: true, enumerable: true, writable: true, value: app }에 해당하는 프로퍼티 플래그를 갖는다.
   * 그 이외의 나머지 프로퍼티들의 경우 { configurable: false, enumerable: false, writable: false }가 기본값으로써 설정된다.
   * 따라서 나머지 프로퍼티의 경우 수정 삭제 열거가 불가능해진다.
   *
   * ex) app.response.header === undefined
   */

  /**
   * new를 사용하지 않은 이유
   *
   * res, req의 경우 함수가 아닌 개체이므로 new키워드 사용시 에러가 발생한다.
   *
   */

  app.init();

  /**
   *
   * app.init()을 통해 추가된 프로퍼티
   *
   * cache
   * engines
   * settings
   * locals
   * mountpath
   *
   */

  /**
   * cache, engines, settings를 비어있는 개체로 초기화하고 defaultConfiguration메서드를 호출한다.
   */

  return app;
}

/**
 * Expose the prototypes.
 */

exports.application = proto;
exports.request = req;
exports.response = res;

/**
 * Expose constructors.
 */

exports.Route = Route;
exports.Router = Router;

/**
 * Expose middleware
 */

exports.json = bodyParser.json
exports.query = require('./middleware/query');
exports.raw = bodyParser.raw
exports.static = require('serve-static');
exports.text = bodyParser.text
exports.urlencoded = bodyParser.urlencoded

/**
 * Replace removed middleware with an appropriate error message.
 */

var removedMiddlewares = [
  'bodyParser',
  'compress',
  'cookieSession',
  'session',
  'logger',
  'cookieParser',
  'favicon',
  'responseTime',
  'errorHandler',
  'timeout',
  'methodOverride',
  'vhost',
  'csrf',
  'directory',
  'limit',
  'multipart',
  'staticCache'
]

removedMiddlewares.forEach(function (name) {
  Object.defineProperty(exports, name, {
    get: function () {
      throw new Error('Most middleware (like ' + name + ') is no longer bundled with Express and must be installed separately. Please see https://github.com/senchalabs/connect#middleware.');
    },
    configurable: true
  });
});

/**
 * Object.defineProperty()는 개체에 직접 새로운 속성을 정의하거나 이미 존재하는 속성을 수정한다.
 *
 * 첫번째 매개변수 : 속성을 정의할 개체
 *
 * 두번째 매개변수 : 새로 정의하거나 수정하려는 속성의 이름 또는 심볼
 *
 * 세번째 매개변수 : 새로 정의하거나 수정하려는 속성을 기술하는 개체
 *
 * get: 속성 접근자로 사용할 함수, 속성에 접근하면 이 함수를 매개변수 없이 호출하고 그 반환값이 속성의 값이 된다.
 */

/**
 * 제거된 미들웨어에 접근하는 경우 에러를 던진다.
 */
