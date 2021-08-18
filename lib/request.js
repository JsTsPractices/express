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
 * @private
 */

var accepts = require('accepts');
var deprecate = require('depd')('express');
var isIP = require('net').isIP;
var typeis = require('type-is');
var http = require('http');
var fresh = require('fresh');
var parseRange = require('range-parser');
var parse = require('parseurl');
var proxyaddr = require('proxy-addr');

/**
 * Request prototype.
 * @public
 */

/**
 * http 모듈의 request개체는 ImcommingMessage의 인스턴스 이므로
 */
var req = Object.create(http.IncomingMessage.prototype)

/**
 * Module exports.
 * @public
 */

module.exports = req

/**
 * Return request header.
 *
 * The `Referrer` header field is special-cased,
 * both `Referrer` and `Referer` are interchangeable.
 *
 * Examples:
 *
 *     req.get('Content-Type');
 *     // => "text/plain"
 *
 *     req.get('content-type');
 *     // => "text/plain"
 *
 *     req.get('Something');
 *     // => undefined
 *
 * Aliased as `req.header()`.
 *
 * @param {String} name
 * @return {String}
 * @public
 */

/**
 * req.get or req.header 를 통하여 http 헤더를 가져온다.
 */
req.get =
req.header = function header(name) {
  if (!name) {
    throw new TypeError('name argument is required to req.get');
  }

  if (typeof name !== 'string') {
    throw new TypeError('name must be a string to req.get');
  }

  var lc = name.toLowerCase();
  /**
   * http 헤더는 케이스 센서티브 하지 않다.
   * 따라서 소문자로 변경하여 사용함
   *
   * https://stackoverflow.com/questions/5258977/are-http-headers-case-sensitive 참고
   */

  /**
   * referer 헤더
   * 현재 요청된 페이지의 링크 이전의 웹 페이지 주소를 포함한다.
   * referer는 실제로 단어 "referrer"에서 철자를 빼먹은 것
   *
   * 참조되는 리소스가 로컬 "파일" 혹은 "데이터"의 URI인 경우,
   * 안전하지 않은 HTTP 요청이 사용되고 참조 페이지가 보안 프로토콜(HTTPS)로 수신된 경우.
   * 브라우저는 referer헤더를 전송하지 않는다.
   *
   * https://developer.mozilla.org/ko/docs/Web/HTTP/Headers/Referer 참고
   */
  switch (lc) {
    case 'referer':
    case 'referrer':
      return this.headers.referrer
        || this.headers.referer;
        /**
         * The Referrer and Referer fields are interchangeable.
         * http://expressjs.com/en/4x/api.html#req.get 참고
         *
         * 서로 사용 가능하도록 설정한것 같다.
         *
         * 만약 referer헤더와 referrer헤더가 모두 설정되어 있는 경우 referrer헤더를 우선시한다.
         *
         * 구글에서 검색해본 결과 "referrer"로 사용되는 경우는 거의 없는것 같다.
         * referrer이 사용되는 경우는 "referrer-policy"로써 사용되는 경우 뿐인것 같다.
         *
         * referer헤더와 referrer헤더가 모두 설정되어 있는 경우 referrer헤더의 값을 리턴하는 이유는
         * 애초에 두 헤더가 동시에 들어오는 경우를 상정하지 않았거나,
         * referrer이 제대로된 철자이기 때문이지 않을까 추측해본다.
         *
         * 하지만 나의 생각으로 referer이 주로 사용되므로 referer헤더의 값을 리턴하는것이 좀 더 나은 선택이지 않을까
         * 생각한다.
         */
    default:
      return this.headers[lc];
  }
};

/**
 * To do: update docs.
 *
 * Check if the given `type(s)` is acceptable, returning
 * the best match when true, otherwise `undefined`, in which
 * case you should respond with 406 "Not Acceptable".
 *
 * The `type` value may be a single MIME type string
 * such as "application/json", an extension name
 * such as "json", a comma-delimited list such as "json, html, text/plain",
 * an argument list such as `"json", "html", "text/plain"`,
 * or an array `["json", "html", "text/plain"]`. When a list
 * or array is given, the _best_ match, if any is returned.
 *
 * Examples:
 *
 *     // Accept: text/html
 *     req.accepts('html');
 *     // => "html"
 *
 *     // Accept: text/*, application/json
 *     req.accepts('html');
 *     // => "html"
 *     req.accepts('text/html');
 *     // => "text/html"
 *     req.accepts('json, text');
 *     // => "json"
 *     req.accepts('application/json');
 *     // => "application/json"
 *
 *     // Accept: text/*, application/json
 *     req.accepts('image/png');
 *     req.accepts('png');
 *     // => undefined
 *
 *     // Accept: text/*;q=.5, application/json
 *     req.accepts(['html', 'json']);
 *     req.accepts('html', 'json');
 *     req.accepts('html, json');
 *     // => "json"
 *
 * @param {String|Array} type(s)
 * @return {String|Array|Boolean}
 * @public
 */

/**
 * 입력받은 컨텐츠 타입이 accept 헤더에 설정된 컨텐츠 형식에 포함되는지 여부를 리턴한다.
 *
 * Accept: text/html
 * req.accepts('html')
 * => "html"
 *
 * Accept: text/*, application/json
 * req.accepts('image/png')
 * req.accepts('png')
 * => false
 *
 * accept 헤더
 * MIME 타입으로 표현되는, 클라이언트가 이해 가능한 컨텐츠 타입이 무엇인지 알려준다.
 * 컨텐츠 협상에 사용되며, 서버는 Content-Type 응답 헤더로 클라이언트에게 선택된 타입을 알려준다.
 *
 * MIME 타입
 * 표준화된 미디어 타입
 * RFC 6838에 설정되어 있다.
 *
 * 컨텐츠 협상
 * 동일한 URI에서의 리소스를 다른 표현으로 제공하기 위해 사용되는 메커니즘
 *
 * 서버 주도 컨텐츠 협상
 * 브라우저가 URL에 몇개의 HTTP 헤더를 전송
 * 브라우저가 보낸 HTTP 헤더를 통하여 클라이언트에 보내는 최적의 컨텐츠 선택
 *
 * HTTP 1.1에서 정의한 서버 주도 협상을 시작하는 표준 헤더 목록
 * accept accept-charset accept-encoding accept-language
 */
req.accepts = function(){
  var accept = accepts(this);
  return accept.types.apply(accept, arguments);
};

/**
 * Check if the given `encoding`s are accepted.
 *
 * @param {String} ...encoding
 * @return {String|Array}
 * @public
 */

/**
 * accept-encoding : (압축을 지원하는) 컨텐츠 인코딩 정의
 */

req.acceptsEncodings = function(){
  var accept = accepts(this);
  /**
   * apply
   * 첫번째 인자로 주어진 값을 this로 하여 함수를 호출한다.
   * 이때 두번째 인자는 호출된 함수의 인자로 들어간다.
   *
   * call과의 차이
   */
  return accept.encodings.apply(accept, arguments);
};

req.acceptsEncoding = deprecate.function(req.acceptsEncodings,
  'req.acceptsEncoding: Use acceptsEncodings instead');

/**
 * Check if the given `charset`s are acceptable,
 * otherwise you should respond with 406 "Not Acceptable".
 *
 * @param {String} ...charset
 * @return {String|Array}
 * @public
 */

/**
 * accept-charset : 클라이언트가 이해 할 수 있는 캐릭터 인코딩 정의
 */

req.acceptsCharsets = function(){
  var accept = accepts(this);
  return accept.charsets.apply(accept, arguments);
};

req.acceptsCharset = deprecate.function(req.acceptsCharsets,
  'req.acceptsCharset: Use acceptsCharsets instead');

/**
 * Check if the given `lang`s are acceptable,
 * otherwise you should respond with 406 "Not Acceptable".
 *
 * @param {String} ...lang
 * @return {String|Array}
 * @public
 */

/**
 * accept-language : 클라이언트가 선호하는 언어 정의
 */

req.acceptsLanguages = function(){
  var accept = accepts(this);
  return accept.languages.apply(accept, arguments);
};

req.acceptsLanguage = deprecate.function(req.acceptsLanguages,
  'req.acceptsLanguage: Use acceptsLanguages instead');

/**
 * Parse Range header field, capping to the given `size`.
 *
 * Unspecified ranges such as "0-" require knowledge of your resource length. In
 * the case of a byte range this is of course the total number of bytes. If the
 * Range header field is not given `undefined` is returned, `-1` when unsatisfiable,
 * and `-2` when syntactically invalid.
 *
 * When ranges are returned, the array has a "type" property which is the type of
 * range that is required (most commonly, "bytes"). Each array element is an object
 * with a "start" and "end" property for the portion of the range.
 *
 * The "combine" option can be set to `true` and overlapping & adjacent ranges
 * will be combined into a single range.
 *
 * NOTE: remember that ranges are inclusive, so for example "Range: users=0-3"
 * should respond with 4 users when available, not 3.
 *
 * @param {number} size
 * @param {object} [options]
 * @param {boolean} [options.combine=false]
 * @return {number|array}
 * @public
 */

/**
 * http range 헤더
 * 서버가 보내야하는 문서의 부분을 지정하는 헤더
 *
 * 서버가 range에 해당하는 문서를 보낸경우 206을 리턴하고
 * 전체 문서를 보내는 경우 200을 리턴한다.
 * 만약 보낸 range가 잘못된 경우 416(Range Not Satisfiable)을 리턴한다.
 *
 * 문법
 *
 * Range: <unit>=<range-start>-
 * Range: <unit>=<range-start>-<range-end>
 * Range: <unit>=<range-start>-<range-end>, <range-start>-<range-end>
 * Range: <unit>=<range-start>-<range-end>, <range-start>-<range-end>, <range-start>-<range-end>
 * Range: <unit>=-<suffix-length>
 *
 * unit = range를 명시할 단위 / 일반적으로 bytes
 * range-start = range의 시작을 가리키는 숫자
 * range-end = range의 끝을 가리키는 숫자 / 생략가능 / 생략시 문서의 마지막이 range-end가 된다.
 * suffix-lengh = 문서의 끝에서 부터 얼마만큼의 길이를 range에 포함할지 여부
 *
 */

/**
 * parseRange(range-parser)
 * range 헤더를 파싱한다.
 *
 * 첫번째 인자 : 파싱할 range 개수
 * 두번째 인자 : range 헤더
 * 세번쨰 인자 : combine(boolean) 옵션 / 기본값 false / ture인 경우 겹치는 범위를 하나로 합친다.
 *
 * parseRange(1, 'bytes=50-55,0-10,5-10,56-60', { combine: true }) -> [ { start: 0, end: 0 }, type: 'bytes' ]
 * parseRange(100, 'bytes=50-55,0-10,5-10,56-60', { combine: true }) -> [ { start: 50, end: 60 }, { start: 0, end: 10 }, type: 'bytes' ]
 * parseRange(100, 'bytes=50-55,0-10,5-10,56-60', { combine: false }) -> [ { start: 50, end: 55 }, { start: 0, end: 10 }, { start: 5, end: 10 }, { start: 56, end: 60 }, type: 'bytes' ]
 *
 * 조건이 하나인데 굳이 개체를 사용하는 이유
 * 예 = { combine : true }
 * 자바스크립트의 경우 정의된 매개변수의 값을 모두 입력하지 않아도 됨
 * 따라서 사용자가 값을 넣어 줬는지 넣어주지 않았는지 판단이 필요
 * !연산은 undefined, 0, false를 구분하지 않음
 * 따라서 굳이 typeof value === "undefined"로 확인해주어야함
 * 개체로 감싸는 경우 값이 들어왔는지 여부를 !연산등을 통해 체크할 수 있음
 *
 */

req.range = function range(size, options) {
  var range = this.get('Range');
  if (!range) return;
  return parseRange(size, range, options);
};

/**
 * Return the value of param `name` when present or `defaultValue`.
 *
 *  - Checks route placeholders, ex: _/user/:id_
 *  - Checks body params, ex: id=12, {"id":12}
 *  - Checks query string params, ex: ?id=12
 *
 * To utilize request bodies, `req.body`
 * should be an object. This can be done by using
 * the `bodyParser()` middleware.
 *
 * @param {String} name
 * @param {Mixed} [defaultValue]
 * @return {String}
 * @public
 */

req.param = function param(name, defaultValue) {
  var params = this.params || {};
  var body = this.body || {};
  var query = this.query || {};

  var args = arguments.length === 1
    ? 'name'
    : 'name, default';
  deprecate('req.param(' + args + '): Use req.params, req.body, or req.query instead');

  if (null != params[name] && params.hasOwnProperty(name)) return params[name];
  if (null != body[name]) return body[name];
  if (null != query[name]) return query[name];

  return defaultValue;
};

/**
 * Check if the incoming request contains the "Content-Type"
 * header field, and it contains the give mime `type`.
 *
 * Examples:
 *
 *      // With Content-Type: text/html; charset=utf-8
 *      req.is('html');
 *      req.is('text/html');
 *      req.is('text/*');
 *      // => true
 *
 *      // When Content-Type is application/json
 *      req.is('json');
 *      req.is('application/json');
 *      req.is('application/*');
 *      // => true
 *
 *      req.is('html');
 *      // => false
 *
 * @param {String|Array} types...
 * @return {String|false|null}
 * @public
 */

/**
 *
 * Content-Type에 특정 컨텐츠 타입이 설정되어 있는지 확인하는 함수
 */

req.is = function is(types) {
  var arr = types;

  // support flattened arguments
  if (!Array.isArray(types)) {
    arr = new Array(arguments.length);
    for (var i = 0; i < arr.length; i++) {
      arr[i] = arguments[i];
    }
  }
  /**
   * 배열이 아닌경우 배열로 만든다.
   */

  return typeis(this, arr);
};

/**
 * Return the protocol string "http" or "https"
 * when requested with TLS. When the "trust proxy"
 * setting trusts the socket address, the
 * "X-Forwarded-Proto" header field will be trusted
 * and used if present.
 *
 * If you're running behind a reverse proxy that
 * supplies https for you this may be enabled.
 *
 * @return {String}
 * @public
 */

/**
 * 암호화 통신인 경우 : https
 * trust proxy가 설정되어 있고, X-Forwarded-Proto 헤더가 있는 경우 : 맨 처음 프로토콜을 리턴
 * 그 외 : http
 */

defineGetter(req, 'protocol', function protocol(){
  var proto = this.connection.encrypted
    ? 'https'
    : 'http';
    /**
     * this.connection 는 node v16.0.0 부터 deprecated되었음
     * this.connection 은 this.socket 의 alias임
     */

  var trust = this.app.get('trust proxy fn');

  if (!trust(this.connection.remoteAddress, 0)) {
    /**
     * this.connection.remoteAddress = 소켓과 연결되어 있는 원격 ip주소
     * 가능한 trust proxy 설정 값
     * true -> 항상 true
     * false -> 항상 false
     * 숫자 -> hopcount가 0보다 큰경우 항상 true (hopcount가 작거나 같은 경우 trust proxy가 true와 같으므로 사실상 무의미)
     * ip 주소 -> this.connection.remoteAddress 와 설정된 ip 주소가 맞는지 체크
     */
    return proto;
  }

  // Note: X-Forwarded-Proto is normally only ever a
  //       single value, but this is to be safe.
  /**
   * 위의 조건문에서 종료되지 않은 경우 : trust proxy가 설정 되어 있음을 의미
   */
  var header = this.get('X-Forwarded-Proto') || proto
  var index = header.indexOf(',')

  return index !== -1
    ? header.substring(0, index).trim()
    : header.trim()
    /**
     * trim : whitespace를 제거한다.
     */
});

/**
 * Short-hand for:
 *
 *    req.protocol === 'https'
 *
 * @return {Boolean}
 * @public
 */

defineGetter(req, 'secure', function secure(){
  return this.protocol === 'https';
});

/**
 * Return the remote address from the trusted proxy.
 *
 * The is the remote address on the socket unless
 * "trust proxy" is set.
 *
 * @return {String}
 * @public
 */

/**
 * trust proxy가 설정되어 있는 경우 : trust proxy 중 가장 멀리 떨어져 있는 ip 리턴
 * 아닌경우 : 소켓 주소
 */
defineGetter(req, 'ip', function ip(){
  var trust = this.app.get('trust proxy fn');
  return proxyaddr(this, trust);
});

/**
 * When "trust proxy" is set, trusted proxy addresses + client.
 *
 * For example if the value were "client, proxy1, proxy2"
 * you would receive the array `["client", "proxy1", "proxy2"]`
 * where "proxy2" is the furthest down-stream and "proxy1" and
 * "proxy2" were trusted.
 *
 * @return {Array}
 * @public
 */

/**
 * 소켓 주소를 제외한 프록시 주소를 가져온다.
 */
defineGetter(req, 'ips', function ips() {
  var trust = this.app.get('trust proxy fn');
  var addrs = proxyaddr.all(this, trust);

  // reverse the order (to farthest -> closest)
  // and remove socket address
  addrs.reverse().pop()

  return addrs
});

/**
 * Return subdomains as an array.
 *
 * Subdomains are the dot-separated parts of the host before the main domain of
 * the app. By default, the domain of the app is assumed to be the last two
 * parts of the host. This can be changed by setting "subdomain offset".
 *
 * For example, if the domain is "tobi.ferrets.example.com":
 * If "subdomain offset" is not set, req.subdomains is `["ferrets", "tobi"]`.
 * If "subdomain offset" is 3, req.subdomains is `["tobi"]`.
 *
 * @return {Array}
 * @public
 */

defineGetter(req, 'subdomains', function subdomains() {
  var hostname = this.hostname;

  if (!hostname) return [];

  var offset = this.app.get('subdomain offset');
  var subdomains = !isIP(hostname)
    ? hostname.split('.').reverse()
    : [hostname];
  /**
   * top-level domain, second-level domain, subdomain 순서로 오도록 설정
   */

  return subdomains.slice(offset);
  /**
   * top-level, second-level domain 을 삭제한다.
   * ip인 경우 빈배열("[]")이 리턴됨
   */
});

/**
 * Short-hand for `url.parse(req.url).pathname`.
 *
 * @return {String}
 * @public
 */

defineGetter(req, 'path', function path() {
  return parse(this).pathname;
  /**
   * req.url에서 path를 파싱한다.
   */
});

/**
 * Parse the "Host" header field to a hostname.
 *
 * When the "trust proxy" setting trusts the socket
 * address, the "X-Forwarded-Host" header field will
 * be trusted.
 *
 * @return {String}
 * @public
 */

/**
 * trust proxy가 설정되어 있고, X-Forwarded-Host가 설정되어 있는 경우 : X-Forwarded-Host의 호스트를 리턴
 * 그 외 : Host헤더의 호스트를 리턴
 */
defineGetter(req, 'hostname', function hostname(){
  var trust = this.app.get('trust proxy fn');
  var host = this.get('X-Forwarded-Host');

  if (!host || !trust(this.connection.remoteAddress, 0)) {
    /**
     * X-Forwarded-Host 헤더에 값이 없거나
     * trust proxy가 설정되어 있지 않은경우
     * Host헤더에서 값을 가져온다.
     */
    host = this.get('Host');
  } else if (host.indexOf(',') !== -1) {
    // Note: X-Forwarded-Host is normally only ever a
    //       single value, but this is to be safe.
    host = host.substring(0, host.indexOf(',')).trimRight()
    /**
     * X-Forwarded-Host 헤더의 값이 복수인 경우
     * 맨 처음의 Host값을 가져온다.
     */
  }

  if (!host) return;
  /**
   * X-Forwarded-For 헤더와 Host헤더의 값이 없는 경우 의미
   */

  /**
   * Host 헤더 : <host>:<port>
   */

  // IPv6 literal support
  var offset = host[0] === '['
    ? host.indexOf(']') + 1
    : 0;
  /**
   * Ipv6 Host헤더 구조 [::1]:3000
   */
  var index = host.indexOf(':', offset);
  /**
   * indexOf(searchElement, fromIndex)
   * fromIndex : 검색 시작하는 인덱스
   *
   * Host 헤더의 host 와 port를 나누는 구분자(":")위치 검색
   */

  return index !== -1
    ? host.substring(0, index)
    : host;
    /**
     * Host 헤더로 부터 host를 가져온다.
     */
});

// TODO: change req.host to return host in next major

defineGetter(req, 'host', deprecate.function(function host(){
  return this.hostname;
}, 'req.host: Use req.hostname instead'));

/**
 * Check if the request is fresh, aka
 * Last-Modified and/or the ETag
 * still match.
 *
 * @return {Boolean}
 * @public
 */

/**
 * response send()에서 사용 fresh true인 경우 304를 리턴함
 * 304 : 요청된 리소스를 재전송할 필요가 없음을 나타냄 / 캐시된 자원으로의 암묵적 리디렉션
 */
defineGetter(req, 'fresh', function(){
  var method = this.method;
  var res = this.res
  /**
   * request 에 response 헤더 설정은
   * middleware/init.js/init() 함수에서 추가해줌
   */
  var status = res.statusCode
  /**
   * ServerResponse.statusCode default 200
   */

  // GET or HEAD for weak freshness validation only
  if ('GET' !== method && 'HEAD' !== method) return false;

  // 2xx or 304 as per rfc2616 14.26
  /**
   * response send() 메서드에서 fresh 함수 호출되기 전에
   * response의 statusCode가 설정될 수 있으므로
   */
  if ((status >= 200 && status < 300) || 304 === status) {
    return fresh(this.headers, {
      'etag': res.get('ETag'),
      'last-modified': res.get('Last-Modified')
    })
    /**
     * fresh 함수
     *
     * req 헤더에 if-modified-since와 if-none-match 헤더가 둘다 없는 경우
     * -> 리소스를 전달하도록 false 리턴
     * cache-control 헤더가 있고 값이 no-cache인 경우
     * -> 리소스를 전달하도록 false 리턴
     * response의 etag가 없거나 if-none-match 의 etag와 response의 etag가 맞지 않는 경우(weak 태그 포함)
     * -> 리소스를 전달하도록 false 리턴
     * response의 last-modified가 없거나 if-modified-since 헤더의 날짜보다 앞서는 경우
     * -> 리소스를 전달하도록 false 리턴
     *
     * 그 외 304만 리턴하기위해 true를 리턴
     *
     * if-modified-since 헤더 : 지정된 날짜 이후 수정 된 경우에만 리소스를 리턴
     * if-none-match 헤더 : 헤더에 나열된 Etag가 response헤더의 Etag와 일치하지 않는 경우에만 리소스 리턴
     * cache-control 헤더 : 캐싱 방법에 대해 지시함
     */
  }

  return false;
});

/**
 * Check if the request is stale, aka
 * "Last-Modified" and / or the "ETag" for the
 * resource has changed.
 *
 * @return {Boolean}
 * @public
 */

defineGetter(req, 'stale', function stale(){
  return !this.fresh;
});

/**
 * Check if the request was an _XMLHttpRequest_.
 *
 * @return {Boolean}
 * @public
 */

/**
 * X-Requested-With:XMLHttpRequest
 * 헤더가 설정되어 있는지 여부 판단
 */
defineGetter(req, 'xhr', function xhr(){
  var val = this.get('X-Requested-With') || '';
  return val.toLowerCase() === 'xmlhttprequest';
});

/**
 * Helper function for creating a getter on an object.
 *
 * @param {Object} obj
 * @param {String} name
 * @param {Function} getter
 * @private
 */
function defineGetter(obj, name, getter) {
  Object.defineProperty(obj, name, {
    configurable: true,
    enumerable: true,
    get: getter
  });
}
