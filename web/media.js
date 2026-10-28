/* Read only the personal assets bundled into this web app by the platform builder. */
var UserMedia = (function () {
  'use strict';
  var media = window.PERSONAL_MEDIA || {};
  function photos() {
    var list = Object.prototype.toString.call(media.photos) === '[object Array]' ? media.photos : [];
    return list.filter(function (p) { return p && /^photos\/[A-Za-z0-9._-]+$/.test(p.src || ''); }).slice(0, 6);
  }
  function events() {
    var now = Date.now();
    var list = Object.prototype.toString.call(media.events) === '[object Array]' ? media.events : [];
    return list.map(function (e) {
      return e && e.title && e.start ? {title: String(e.title).slice(0, 180), at: new Date(e.start).getTime(), allDay: !!e.allDay} : null;
    }).filter(function (e) { return e && !isNaN(e.at) && e.at >= now - 12 * 60 * 60 * 1000; })
      .sort(function (a, b) { return a.at - b.at; }).slice(0, 500);
  }
  return {photos: photos, events: events};
})();
