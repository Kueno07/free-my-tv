/* Personal photos and a private, locally imported iCalendar file for webOS/Tizen. No network account or token is stored. */
var UserMedia = (function () {
  'use strict';
  var PHOTO_KEY = 'fmtv.userPhotos', EVENT_KEY = 'fmtv.calendarEvents';
  var PHOTO_LIMIT = 6, PHOTO_BYTES = 260 * 1024, CALENDAR_BYTES = 2 * 1024 * 1024;

  function read(key) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || '[]');
      return Object.prototype.toString.call(value) === '[object Array]' ? value : [];
    } catch (e) { return []; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  function bytes(data) { return Math.floor((data.length - data.indexOf(',') - 1) * 3 / 4); }

  function imageData(file, done) {
    var reader = new FileReader();
    reader.onerror = function () { done(new Error('Could not read image')); };
    reader.onload = function () {
      var image = new Image();
      image.onerror = function () { done(new Error('Invalid image')); };
      image.onload = function () {
        var scale = Math.min(1, 1600 / image.width, 900 / image.height);
        var canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        try {
          var context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          var quality = 0.78, data = canvas.toDataURL('image/jpeg', quality);
          while (bytes(data) > PHOTO_BYTES && quality > 0.42) {
            quality -= 0.08;
            data = canvas.toDataURL('image/jpeg', quality);
          }
          if (bytes(data) > PHOTO_BYTES) return done(new Error('Image is too large after compression'));
          done(null, {name: String(file.name || 'Photo').replace(/[<>\u0000-\u001f]/g, '').slice(0, 80), data: data});
        } catch (e) { done(new Error('Could not prepare image')); }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function importPhotos(files, done) {
    var old = photos(), list = [], index = 0, failed = 0;
    if (!files || !files.length) return done(null, old.length, 0);
    if (old.length >= PHOTO_LIMIT) return done(new Error('The photo limit is reached'), old.length, 0);
    function next() {
      if (index >= files.length || old.length + list.length >= PHOTO_LIMIT) {
        var merged = old.concat(list);
        if (list.length && !write(PHOTO_KEY, merged)) return done(new Error('TV storage is full'), old.length, 0);
        return done(null, merged.length, list.length, failed);
      }
      var file = files[index++];
      if (!file || (file.type && !/^image\//i.test(file.type))) { failed++; return next(); }
      imageData(file, function (err, item) {
        if (err) failed++;
        else list.push(item);
        next();
      });
    }
    next();
  }

  function unescapeText(s) {
    return String(s || '').replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  }

  function property(lines, key) {
    for (var i = 0; i < lines.length; i++) {
      var colon = lines[i].indexOf(':');
      if (colon < 0) continue;
      var name = lines[i].substring(0, colon).split(';')[0].toUpperCase();
      if (name === key) return {header: lines[i].substring(0, colon), value: lines[i].substring(colon + 1)};
    }
    return null;
  }

  function eventDate(prop) {
    if (!prop) return null;
    var value = prop.value, m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/.exec(value);
    if (!m) return null;
    var allDay = !m[4], date;
    if (m[7]) date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
    else date = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return isNaN(date.getTime()) ? null : {at: date.getTime(), allDay: allDay};
  }

  function parseCalendar(text) {
    var unfolded = String(text || '').replace(/\r?\n[ \t]/g, ''), blocks = unfolded.split(/BEGIN:VEVENT/i), found = [];
    for (var i = 1; i < blocks.length; i++) {
      var lines = blocks[i].split(/\r?\n/), start = eventDate(property(lines, 'DTSTART'));
      var title = property(lines, 'SUMMARY');
      if (!start || !title) continue;
      found.push({at: start.at, allDay: start.allDay, title: unescapeText(title.value).replace(/[<>\u0000-\u001f]/g, '').slice(0, 180)});
    }
    found.sort(function (a, b) { return a.at - b.at; });
    return found;
  }

  function importCalendar(file, done) {
    if (!file) return done(null, events().length);
    if (file.size > CALENDAR_BYTES) return done(new Error('Calendar file is too large'));
    var reader = new FileReader();
    reader.onerror = function () { done(new Error('Could not read calendar file')); };
    reader.onload = function () {
      var parsed = parseCalendar(reader.result);
      if (!parsed.length) return done(new Error('No readable calendar events found'));
      if (!write(EVENT_KEY, parsed)) return done(new Error('TV storage is full'));
      done(null, parsed.length);
    };
    reader.readAsText(file);
  }

  function photos() { return read(PHOTO_KEY).filter(function (p) { return p && /^data:image\/jpeg;base64,/.test(p.data || ''); }).slice(0, PHOTO_LIMIT); }
  function events() {
    var now = Date.now();
    return read(EVENT_KEY).filter(function (e) { return e && typeof e.at === 'number' && e.at >= now - 12 * 60 * 60 * 1000 && e.title; }).slice(0, 500);
  }
  function removePhotos() { try { localStorage.removeItem(PHOTO_KEY); return true; } catch (e) { return false; } }
  function removeCalendar() { try { localStorage.removeItem(EVENT_KEY); return true; } catch (e) { return false; } }

  return {photos: photos, events: events, importPhotos: importPhotos, importCalendar: importCalendar,
    removePhotos: removePhotos, removeCalendar: removeCalendar};
})();
