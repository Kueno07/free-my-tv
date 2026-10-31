/* Joyce menu and Family event date transforms for the screensaver. */
(function (root) {
  'use strict';

  var ZONE = 'America/Sao_Paulo';

  function partsAt(value) {
    var date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) date = new Date();
    try {
      var parts = new Intl.DateTimeFormat('en-CA', {timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false}).formatToParts(date), result = {};
      for (var i = 0; i < parts.length; i++) result[parts[i].type] = parts[i].value;
      var hour = Number(result.hour);
      if (hour === 24) hour = 0;
      return {year: Number(result.year), month: Number(result.month), day: Number(result.day), hour: hour,
        minute: Number(result.minute), key: result.year + '-' + result.month + '-' + result.day};
    } catch (e) {
      // Sao Paulo has observed UTC-03:00 since 2019; this keeps older TV WebKit functional.
      var fallback = new Date(date.getTime() - 3 * 60 * 60 * 1000);
      return {year: fallback.getUTCFullYear(), month: fallback.getUTCMonth() + 1, day: fallback.getUTCDate(),
        hour: fallback.getUTCHours(), minute: fallback.getUTCMinutes(), key: key(fallback.getUTCFullYear(), fallback.getUTCMonth() + 1, fallback.getUTCDate())};
    }
  }

  function key(year, month, day) {
    return String(year) + '-' + ('0' + month).slice(-2) + '-' + ('0' + day).slice(-2);
  }

  function render(snapshot, selectedDate, now) {
    var selected = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate || '') ? selectedDate : partsAt(now || new Date()).key;
    var split = selected.split('-'), year = Number(split[0]), month = Number(split[1]);
    if (month < 1 || month > 12) { var today = partsAt(now || new Date()); year = today.year; month = today.month; }
    var first = new Date(Date.UTC(year, month - 1, 1)), offset = (first.getUTCDay() + 6) % 7;
    var start = Date.UTC(year, month - 1, 1 - offset), meals = {}, events = {}, rows = [], todayKey = partsAt(now || new Date()).key;
    snapshot = snapshot || {};
    (snapshot.meals || []).forEach(function (meal) {
      if (meal && /^\d{4}-\d{2}-\d{2}$/.test(meal.date) && (meal.lunch || meal.dinner)) meals[meal.date] = true;
    });
    (snapshot.eventDates || []).forEach(function (date) { if (/^\d{4}-\d{2}-\d{2}$/.test(date)) events[date] = true; });
    for (var i = 0; i < 42; i++) {
      var d = new Date(start + i * 86400000), dateKey = key(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      rows.push({date: dateKey, day: d.getUTCDate(), inMonth: d.getUTCMonth() + 1 === month, today: dateKey === todayKey,
        meal: !!meals[dateKey], event: !!events[dateKey]});
    }
    return {year: year, month: month, today: todayKey, cells: rows};
  }

  function currentMeal(snapshot, now) {
    var p = partsAt(now || new Date()), meals = snapshot && snapshot.meals || [], found = null;
    if (p.hour >= 18) return null;
    for (var i = 0; i < meals.length; i++) if (meals[i] && meals[i].date === p.key) { found = meals[i]; break; }
    if (!found) return null;
    var title = p.hour < 12 ? found.lunch : found.dinner;
    return title ? {type: p.hour < 12 ? 'lunch' : 'dinner', title: title} : null;
  }

  function upcomingEvents(snapshot, now, limit) {
    var p = partsAt(now || new Date()), current = (now || new Date()).getTime(), all = snapshot && snapshot.upcomingEvents || [];
    var future = all.filter(function (event) {
      if (!event || !event.title || !/^\d{4}-\d{2}-\d{2}$/.test(event.date) || event.date < p.key) return false;
      if (event.allDay) return true;
      if (event.start) { var start = new Date(event.start).getTime(); return !isNaN(start) && start > current; }
      return event.date >= p.key;
    });
    future.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      var ta = a.start && !a.allDay ? new Date(a.start).getTime() : 0;
      var tb = b.start && !b.allDay ? new Date(b.start).getTime() : 0;
      return ta - tb || a.title.localeCompare(b.title);
    });
    return future.slice(0, Math.max(0, Math.min(Number(limit) || 3, 3)));
  }

  function revision(snapshot, now) {
    var events = upcomingEvents(snapshot, now, 3);
    var eventKey = events.map(function (event) { return [event.date, event.title, event.start || '', event.end || '', event.allDay].join('~'); }).join('|');
    return [(snapshot && snapshot.updatedAt) || '', partsAt(now || new Date()).key, eventKey].join('::');
  }

  function formatEventDate(date, locale) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return date || '';
    try { return new Intl.DateTimeFormat(locale || 'en-US', {weekday: 'short', month: 'short', day: 'numeric', timeZone: ZONE}).format(new Date(date + 'T12:00:00Z')); }
    catch (e) { return date; }
  }

  root.CalendarView = {render: render, currentMeal: currentMeal, upcomingEvents: upcomingEvents, revision: revision,
    formatEventDate: formatEventDate};
}(window));
