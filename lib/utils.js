/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 * @api private
 */

var Buffer = require("safe-buffer").Buffer;
var contentDisposition = require("content-disposition");
var contentType = require("content-type");
var deprecate = require("depd")("express");
var flatten = require("array-flatten");
var mime = require("send").mime;
var etag = require("etag");
var proxyaddr = require("proxy-addr");
var qs = require("qs");
var querystring = require("querystring");

/**
 * Return strong ETag for `body`.
 *
 * @param {String|Buffer} body
 * @param {String} [encoding]
 * @return {String}
 * @api private
 */

exports.etag = createETagGenerator({ weak: false });

/**
 * Return weak ETag for `body`.
 *
 * @param {String|Buffer} body
 * @param {String} [encoding]
 * @return {String}
 * @api private
 */

exports.wetag = createETagGenerator({ weak: true });

/**
 * Check if `path` looks absolute.
 *
 * @param {String} path
 * @return {Boolean}
 * @api private
 */

exports.isAbsolute = function (path) {
  if ("/" === path[0]) return true;
  if (":" === path[1] && ("\\" === path[2] || "/" === path[2])) return true; // Windows device path
  if ("\\\\" === path.substring(0, 2)) return true; // Microsoft Azure absolute path
};

/**
 * Flatten the given `arr`.
 *
 * @param {Array} arr
 * @return {Array}
 * @api private
 */

exports.flatten = deprecate.function(
  flatten,
  "utils.flatten: use array-flatten npm module instead"
);

/**
 * Normalize the given `type`, for example "html" becomes "text/html".
 *
 * @param {String} type
 * @return {Object}
 * @api private
 */

exports.normalizeType = function (type) {
  return ~type.indexOf("/")
    ? acceptParams(type)
    : { value: mime.lookup(type), params: {} };
};

/**
 * Normalize `types`, for example "html" becomes "text/html".
 *
 * @param {Array} types
 * @return {Array}
 * @api private
 */

exports.normalizeTypes = function (types) {
  var ret = [];

  for (var i = 0; i < types.length; ++i) {
    ret.push(exports.normalizeType(types[i]));
  }

  return ret;
};

/**
 * Generate Content-Disposition header appropriate for the filename.
 * non-ascii filenames are urlencoded and a filename* parameter is added
 *
 * @param {String} filename
 * @return {String}
 * @api private
 */

exports.contentDisposition = deprecate.function(
  contentDisposition,
  "utils.contentDisposition: use content-disposition npm module instead"
);

/**
 * Parse accept params `str` returning an
 * object with `.value`, `.quality` and `.params`.
 * also includes `.originalIndex` for stable sorting
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function acceptParams(str, index) {
  var parts = str.split(/ *; */);
  var ret = { value: parts[0], quality: 1, params: {}, originalIndex: index };

  for (var i = 1; i < parts.length; ++i) {
    var pms = parts[i].split(/ *= */);
    if ("q" === pms[0]) {
      ret.quality = parseFloat(pms[1]);
    } else {
      ret.params[pms[0]] = pms[1];
    }
  }

  return ret;
}

/**
 * Compile "etag" value to function.
 *
 * @param  {Boolean|String|Function} val
 * @return {Function}
 * @api private
 */

/**
 * val의 타입이 함수인경우 해당 함수를 그대로 리턴하고,
 * true 또는 "weak"인경우 wetag 함수를 리턴,
 * "strong"인 경우 etag 함수를 리턴,
 * false인경우 val자체 리턴,
 * 그 외의 값이 들어오는 경우 타입에러를 발생시킨다.
 */

exports.compileETag = function (val) {
  var fn;

  if (typeof val === "function") {
    return val;
  }

  switch (val) {
    case true:
      fn = exports.wetag;
      break;
    case false:
      break;
    case "strong":
      fn = exports.etag;
      break;
    case "weak":
      fn = exports.wetag;
      break;
    default:
      throw new TypeError("unknown value for etag function: " + val);
  }

  return fn;
};

/**
 * Compile "query parser" value to function.
 *
 * @param  {String|Function} val
 * @return {Function}
 * @api private
 */

/**
 * val의 타입이 함수인경우 해당 함수를 그대로 리턴하고,
 * true simple => querystring.parse
 * false => newObject
 * extended => parseExtendedQueryString
 * 리턴한다.
 *
 * parseExtendedQueryString에서 사용하는 쿼리 파싱 라이브러리가
 * querystring라이브러리와 다르다
 */

exports.compileQueryParser = function compileQueryParser(val) {
  var fn;

  if (typeof val === "function") {
    return val;
  }

  switch (val) {
    case true:
      fn = querystring.parse;
      break;
    case false:
      fn = newObject;
      break;
    case "extended":
      fn = parseExtendedQueryString;
      break;
    case "simple":
      fn = querystring.parse;
      break;
    default:
      throw new TypeError("unknown value for query parser function: " + val);
  }

  return fn;
};

/**
 * Compile "proxy trust" value to function.
 *
 * @param  {Boolean|String|Number|Array|Function} val
 * @return {Function}
 * @api private
 */

/**
 * val이 true인 경우 항상 true를 리턴하는 함수를 리턴하고
 * 숫자인 경우 설정된 hopcount보다 낮은경우 true를 리턴하는 함수를
 * 문자열이고 "127.0.0.1, 192.168.0.1"형식의 여러 ip주소가 들어오는 경우
 * 문자열을 나눈다.
 */

exports.compileTrust = function (val) {
  if (typeof val === "function") return val;

  if (val === true) {
    // Support plain true/false
    return function () {
      return true;
    };
  }

  if (typeof val === "number") {
    // Support trusting hop count
    return function (a, i) {
      return i < val;
    };
  }

  if (typeof val === "string") {
    // Support comma-separated values
    val = val.split(/ *, */);
  }

  return proxyaddr.compile(val || []);
  /**
   * val이 undefined, null, false인 경우 빈 배열을 넘기고
   * 그 이외의 경우 val을 넘겨준다.
   *
   * val: undefined || false || null
   * -> return () => false;
   * 그 이외의 경우 입력돤 ip주소가 val을 통하여 입력된 ip주소와 비교하여 그 결과를 리턴하는 함수를 리턴한다.
   */
};

/**
 * Set the charset in a given Content-Type string.
 *
 * @param {String} type
 * @param {String} charset
 * @return {String}
 * @api private
 */

exports.setCharset = function setCharset(type, charset) {
  if (!type || !charset) {
    return type;
  }

  // parse type
  var parsed = contentType.parse(type);

  // set charset
  parsed.parameters.charset = charset;

  // format type
  return contentType.format(parsed);
};

/**
 * Create an ETag generator function, generating ETags with
 * the given options.
 *
 * @param {object} options
 * @return {function}
 * @private
 */

/**
 * body가 Buffer인지 확인하여 Buffer가 아닌경우 Buffer로 만들어 etag함수를 호출한다.
 */
function createETagGenerator(options) {
  return function generateETag(body, encoding) {
    var buf = !Buffer.isBuffer(body) ? Buffer.from(body, encoding) : body;

    return etag(buf, options);
  };
}

/**
 * Parse an extended query string with qs.
 *
 * @return {Object}
 * @private
 */

/**
 * qs를 사용하는데 굳이 해당 라이브러리를 사용하는 이유가 무었일까
 * npm 페이지에서는 보안에 좀 더 신경을 썼다고 나와 있긴 하다.
 *
 * allowPrototypes의 기본값은 false이다.
 *
 * qs라이브러리의 parse함수의 경우 기존에 가지고 있던 프로퍼티에 파싱된 값을 덮어쓰지 않는다.
 * 예) "a[hasOwnProperty]=b" -> hasOwnProperty의 경우 Object.create(null)을 통하여 만들어진 개체를 제외한 모든 개체가 가지고 있는 프로퍼티이므로 hasOwnProperty=b로 덮어쓰지 않는다.
 *
 * allowPrototypes: true인 경우 프로퍼티를 덮어쓴다.
 * {a: { hasOwnProperyt: 'b'}} === qs.parse('a[hasOwnProperty]=b', { allowPrototypes: true });
 *
 * express에서 파싱된 쿼리는 값으로써 사용되므로, 또한 클라이언트가 충분히 a[hasOwnProperty]=b 형태의 값을 보낼수 있으므로(개체의 hasOwnProperty프로퍼티에 함수가있는것은 js의 특징인데 백엔드 코드가 모두 js로 되어있지는 않으므로)
 * 기존의 프로퍼티를 덮어쓴다는 위험성에도 불구하고 allowPrototypes : true 옵션을 준것 같다.
 *
 * 반대로 말한다면 굳이 qs라이브러리를 사용한 이유는 queryString이 기존의 프로퍼티에 값을 덮어쓰지 않기 때문이라고 추측할수 있지 않을까 싶다.
 */

/**
 * 실제 테스트
 *
 * console.log(qs.parser('hasOwnProperty=hasOwnProperty', { allowPrototypes: false })); -> {}
 *
 * console.log(qs.parser('hasOwnProperty=hasOwnProperty', { allowPrototypes: true })); -> { hasOwnProperty: 'hasOwnProperty' }
 *
 * console.log(queryString.parse('hasOwnProperty=hasOwnProperty')); -> [Object: null prototype] { hasOwnProperty: 'hasOwnProperty' }
 *
 * [Object: null prototype]의 의미
 *
 * Object.create(null)로 개체를 만들었다는 의미
 * 내장 함수가 없다.
 *
 * 결론
 *
 * 1. qs를 디폴트로 사용하는 이유
 * 파싱후 얻은 개체 사용시 내장 메서드를 사용하기 위해
 *
 * 2. allowPrototypes : true로 설정한 이유
 * 쿼리의 키값이 내장 매서드와 겹치는 경우 메서드를 쿼리의 벨류로 대체하기 위해
 *
 */

function parseExtendedQueryString(str) {
  return qs.parse(str, {
    allowPrototypes: true,
  });
}

/**
 * Return new empty object.
 *
 * @return {Object}
 * @api private
 */

function newObject() {
  return {};
}
