/* Joyce read-only TV client. Credentials stay on this device. */
(function () {
  'use strict';
  var prefix = 'fmtv.joyce.', timer = 0, poll = 0, generation = 0, refreshGeneration = 0, maxBytes = 262144;
  function get(key) { try { return localStorage.getItem(prefix + key); } catch (e) { return null; } }
  function set(key, value) { try { localStorage.setItem(prefix + key, value); return true; } catch (e) { return false; } }
  function remove(key) { try { localStorage.removeItem(prefix + key); } catch (e) {} }
  function dateKey(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  function validSnapshot(s) {
    var i, m, e;
    if (!s || typeof s !== 'object' || typeof s.updatedAt !== 'string' || isNaN(Date.parse(s.updatedAt)) || s.timeZone !== 'America/Sao_Paulo' || !Array.isArray(s.meals) || !Array.isArray(s.eventDates) || !Array.isArray(s.upcomingEvents) || s.meals.length > 42 || s.eventDates.length > 42 || s.upcomingEvents.length > 3) return false;
    for (i = 0; i < s.meals.length; i++) {
      m = s.meals[i];
      if (!m || !dateKey(m.date) || (m.lunch != null && (typeof m.lunch !== 'string' || m.lunch.length > 500)) || (m.dinner != null && (typeof m.dinner !== 'string' || m.dinner.length > 500))) return false;
    }
    for (i = 0; i < s.eventDates.length; i++) if (!dateKey(s.eventDates[i])) return false;
    for (i = 0; i < s.upcomingEvents.length; i++) {
      e = s.upcomingEvents[i];
      if (!e || !dateKey(e.date) || typeof e.title !== 'string' || e.title.length > 500 || typeof e.allDay !== 'boolean' || (e.start != null && (typeof e.start !== 'string' || isNaN(Date.parse(e.start)))) || (e.end != null && (typeof e.end !== 'string' || isNaN(Date.parse(e.end))))) return false;
    }
    return true;
  }
  function snapshot() { var raw = get('snapshot'), data; if (!raw || raw.length > maxBytes) return null; try { data = JSON.parse(raw); return validSnapshot(data) ? data : null; } catch (e) { return null; } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function monthRange(year, month) {
    if (typeof year !== 'number' || typeof month !== 'number' || !isFinite(year) || !isFinite(month) || year < 1 || year > 9999 || month < 1 || month > 12 || year % 1 || month % 1) return null;
    return {fromDate: ('000' + year).slice(-4) + '-' + pad(month) + '-01', toDate: ('000' + year).slice(-4) + '-' + pad(month) + '-' + pad(new Date(Date.UTC(year, month, 0)).getUTCDate())};
  }
  function base(url) { return typeof url === 'string' && /^https:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[a-zA-Z0-9._~-]+)*\/?$/.test(url) ? url.replace(/\/$/, '') : ''; }
  function request(method, url, token, body, cb) {
    var xhr = new XMLHttpRequest(), done = false;
    function finish(err, data) { if (done) return; done = true; cb(err, data); }
    try {
      xhr.open(method, url, true); xhr.timeout = 15000;
      if (token) xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      if (body) xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status < 200 || xhr.status >= 300 || typeof xhr.responseText !== 'string' || xhr.responseText.length > maxBytes) { finish(new Error('Request failed')); return; }
        try { finish(null, JSON.parse(xhr.responseText)); } catch (e) { finish(new Error('Invalid response')); }
      };
      xhr.onerror = xhr.ontimeout = function () { finish(new Error('Request failed')); };
      xhr.send(body ? JSON.stringify(body) : null);
    } catch (e) { finish(new Error('Request failed')); }
  }
  function refresh(from, to, cb) {
    cb = cb || function () {};
    var url = base(get('base')), token = get('token');
    if (!url || !/^[A-Za-z0-9_-]{43,128}$/.test(token || '') || !dateKey(from) || !dateKey(to) || from > to || (Date.parse(to) - Date.parse(from)) / 86400000 > 41) { cb(new Error('Invalid configuration or range'), snapshot()); return; }
    var requestGeneration = ++refreshGeneration;
    request('GET', url + '/api/tv/snapshot?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to), token, null, function (err, data) {
      if (requestGeneration !== refreshGeneration) { cb(new Error('Refresh superseded'), snapshot()); return; }
      if (get('base') !== url || get('token') !== token) { cb(new Error('Configuration changed'), snapshot()); return; }
      if (!err && !validSnapshot(data)) err = new Error('Invalid snapshot');
      if (!err && !set('snapshot', JSON.stringify(data))) err = new Error('Storage unavailable');
      cb(err, err ? snapshot() : data);
    });
  }
  function currentRange() {
    var d = new Date(Date.now() - 3 * 3600000), first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
    var last = new Date(first.getTime() + 41 * 86400000);
    return {fromDate: first.toISOString().slice(0, 10), toDate: last.toISOString().slice(0, 10)};
  }
  function refreshCurrent() { var r = currentRange(); refresh(r.fromDate, r.toDate); }
  function schedule() { clearInterval(timer); timer = setInterval(refreshCurrent, 3600000); }
  function configure(url, token) {
    url = base(url);
    if (!url || !/^[A-Za-z0-9_-]{43,128}$/.test(token || '')) return false;
    refreshGeneration++;
    if (get('base') !== url || get('token') !== token) remove('snapshot');
    if (!set('base', url) || !set('token', token)) { remove('token'); return false; }
    schedule(); refreshCurrent(); return true;
  }
  function cancelPairing() { generation++; clearTimeout(poll); }
  function securePairingError() { var err = new Error('Secure pairing unavailable'); err.code = 'SECURE_PAIRING_UNAVAILABLE'; return err; }
  function beginPairing(url, label, cb) {
    cancelPairing(); var mine = generation, crypto = window.crypto || window.msCrypto, bytes, code = '', alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', token, i;
    url = base(url);
    if (!url || typeof label !== 'string' || !label || label.length > 80) { cb(new Error('Invalid pairing configuration')); return; }
    if (!crypto || !crypto.getRandomValues || !crypto.subtle || !crypto.subtle.digest || typeof Uint8Array === 'undefined') { cb(securePairingError()); return; }
    bytes = new Uint8Array(40); crypto.getRandomValues(bytes);
    for (i = 0; i < 8; i++) code += alphabet.charAt(bytes[i] & 31);
    token = ''; for (i = 8; i < 40; i++) token += String.fromCharCode(bytes[i]);
    token = window.btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    function hash(value, next) {
      var data = new Uint8Array(value.length), j;
      for (j = 0; j < value.length; j++) data[j] = value.charCodeAt(j);
      crypto.subtle.digest('SHA-256', data).then(function (result) {
        var a = new Uint8Array(result), hex = '', k; for (k = 0; k < a.length; k++) hex += ('0' + a[k].toString(16)).slice(-2); next(hex);
      }, function () { if (mine === generation) cb(securePairingError()); });
    }
    hash(code, function (codeHash) { hash(token, function (tokenHash) {
      if (mine !== generation) return;
      request('POST', url + '/api/tv/pairing', null, {pairingCodeHash: codeHash, deviceTokenHash: tokenHash, deviceLabel: label}, function (err, data) {
        if (mine !== generation) return;
        if (err || !data || data.ok !== true || data.status !== 'pending' || isNaN(Date.parse(data.expiresAt))) { cb(new Error('Pairing failed')); return; }
        cb(null, {status: 'pending', code: code, expiresAt: data.expiresAt});
        function check() {
          if (mine !== generation) return;
          if (Date.now() >= Date.parse(data.expiresAt)) { cb(null, {status: 'expired'}); return; }
          request('GET', url + '/api/tv/pairing', token, null, function (error, status) {
            if (mine !== generation) return;
            if (error) { poll = setTimeout(check, 5000); return; }
            if (!status || status.ok !== true || ['pending', 'active', 'expired', 'revoked'].indexOf(status.status) < 0) { cb(new Error('Invalid pairing status')); return; }
            if (status.status === 'pending') { poll = setTimeout(check, 5000); return; }
            if (status.status === 'active' && !configure(url, token)) { cb(new Error('Storage unavailable')); return; }
            cb(null, {status: status.status});
          });
        }
        poll = setTimeout(check, 5000);
      });
    }); });
  }
  if (base(get('base')) && /^[A-Za-z0-9_-]{43,128}$/.test(get('token') || '')) schedule();
  window.JoyceTV = {beginPairing: beginPairing, cancelPairing: cancelPairing, configure: configure, refresh: refresh, refreshCurrent: refreshCurrent, snapshot: snapshot, updatedAt: function () { var s = snapshot(); return s ? s.updatedAt : null; }, validSnapshot: validSnapshot, monthRange: monthRange, baseUrl: function () { return get('base') || 'https://assistente-culinario-joy-git-88a3c2-kelvinueno07-6836s-projects.vercel.app'; }};
}());
