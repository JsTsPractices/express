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

var debug = require('debug')('express:view');
var path = require('path');
var fs = require('fs');

/**
 * Module variables.
 * @private
 */

var dirname = path.dirname;
var basename = path.basename;
var extname = path.extname;
var join = path.join;
var resolve = path.resolve;

/**
 * Module exports.
 * @public
 */

module.exports = View;

/**
 * Initialize a new `View` with the given `name`.
 *
 * Options:
 *
 *   - `defaultEngine` the default template engine name
 *   - `engines` template engine require() cache
 *   - `root` root path for view lookup
 *
 * @param {string} name
 * @param {object} options
 * @public
 */

/**
 *
 * View가 저장되어있는 경로를 입력 -> 해당 View를 express에서 사용할 수 있도록 개체화
 */
function View(name, options) {
  /**
   * View는 render함수에서 사용된다.
   * render의 첫번째 프로퍼티를 name으로 전달받는다.
   * 랜더링할 파일 명을 의미한다.
   */

  /**
   * options
   *
   * defaultEngine : app settings 프로퍼티의 "view engine" 값 / 템플릿 엔진을 가져오는 부분 / 예 : app.set("view engine", "pug");
   * root : views 폴더 까지의 경로
   * engines : app engines 프로퍼티 / app.init() 시점에는 빈 개체({})이다.
   */

  var opts = options || {};

  this.defaultEngine = opts.defaultEngine;
  this.ext = extname(name);
  /**
   * extname : 경로안에서 확장자를 추출하는 함수
   * ext에는 추출한 확장자가 들어온다.
   */
  this.name = name;
  this.root = opts.root;

  if (!this.ext && !this.defaultEngine) {
    /**
     * 템플릿 엔진과 확장자를 추출하는 함수가 없는 경우 에러를 던진다.
     */
    throw new Error('No default engine was specified and no extension was provided.');
  }

  var fileName = name;

  if (!this.ext) {
    /**
     * 확장자 추출 함수가 없는경우
     * defaultEngine을 통해 확장자를 추출후 확장자를 추가한다.
     */
    // get extension from default engine name
    this.ext = this.defaultEngine[0] !== '.'
      ? '.' + this.defaultEngine
      : this.defaultEngine;

    fileName += this.ext;
  }

  if (!opts.engines[this.ext]) {
    /**
     * engines 프로퍼티에 해당 템플릿 엔진이 없는경우
     * ext를 이용하여 엔진을 설정해준다.
     */
    // load engine
    var mod = this.ext.substr(1)
    debug('require "%s"', mod)

    // default engine export
    var fn = require(mod).__express

    if (typeof fn !== 'function') {
      throw new Error('Module "' + mod + '" does not provide a view engine.')
    }

    opts.engines[this.ext] = fn
  }

  // store loaded engine
  this.engine = opts.engines[this.ext];

  // lookup path
  this.path = this.lookup(fileName);
  /**
   * engine 프로퍼티와 path프로퍼티를 설정한다.
   */
}

/**
 * Lookup view by the given `name`
 *
 * @param {string} name
 * @private
 */

/**
 *
 * 파일명 in -> 파일 경로 out
 */
View.prototype.lookup = function lookup(name) {
  var path;
  var roots = [].concat(this.root);
  /**
   * this.root프로퍼티를 오염시키지 않도록 새로운 roots 배열을 만든다.
   */

  /**
   * 근데 왜 굳이 배열을 만들어 반복문을 돌릴까?
   *
   * express 라이브러리상에서는 this.root의 값이 배열로 들어올 일은 없음
   * 따라서 반복문이 작동할 이유는 없다.
   *
   * 만약 this.settings["views"]의 값을 배열로 바꾼 경우
   * 배열의 마지막 값을 가지고 path를 만든다
   */

  debug('lookup "%s"', name);

  for (var i = 0; i < roots.length && !path; i++) {
    var root = roots[i];

    // resolve the path
    var loc = resolve(root, name);
    /**
     * views 디렉토리까지 설정된 경로에다가 name을 합친다.
     * <views 디렉토리까지의 경로>/<name>
     */
    var dir = dirname(loc);
    /**
     * 합친 경로에서 views디렉토리까지의 경로를 다시 가져온다.
     */
    var file = basename(loc);
    /**
     * 합친 경로에서 파일명을 다시 가져온다.
     */

    // resolve the file
    path = this.resolve(dir, file);
  }
  /**
   * 굳이 resolve dirname basename 처리를 하는 이유
   *
   * name에 절대 경로를 넣는경우 처리하기 위해
   *
   * name에 절대 경로가 들어가면 resolve는 root를 무시한다.
   */

  return path;
};

/**
 * Render with the given options.
 *
 * @param {object} options
 * @param {function} callback
 * @private
 */

View.prototype.render = function render(options, callback) {
  debug('render "%s"', this.path);
  this.engine(this.path, options, callback);
};

/**
 * Resolve the file within the given directory.
 *
 * @param {string} dir
 * @param {string} file
 * @private
 */

View.prototype.resolve = function resolve(dir, file) {
  var ext = this.ext;

  // <path>.<ext>
  var path = join(dir, file);
  var stat = tryStat(path);

  if (stat && stat.isFile()) {
    return path;
  }
  /**
   * 해당 경로에 파일이 있는경우 파일 경로를 리턴한다.
   */

  // <path>/index.<ext>
  path = join(dir, basename(file, ext), 'index' + ext);
  stat = tryStat(path);
  /**
   * 경로에 파일이 없는경우 파일명에 해당하는 디렉토리를 찾고, 해당 디렉토리에 index파일이 있는지 확인한다.
   */

  if (stat && stat.isFile()) {
    return path;
  }
  /**
   * 있으면 리턴한다.
   */
};

/**
 * Return a stat, maybe.
 *
 * @param {string} path
 * @return {fs.Stats}
 * @private
 */

function tryStat(path) {
  debug('stat "%s"', path);

  try {
    return fs.statSync(path);
    /**
     * 주어진 파일 경로에대한 정보를 리턴한다.
     */
  } catch (e) {
    return undefined;
  }
}
