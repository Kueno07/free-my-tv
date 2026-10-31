/* Photo/calendar screensaver rotation, with injectable timers for old TV-safe deterministic tests. */
(function (root) {
  'use strict';

  function create(options) {
    options = options || {};
    var later = options.setTimeout || setTimeout, cancel = options.clearTimeout || clearTimeout;
    var showPhoto = options.photo || function () {}, showExpanded = options.expanded || function () {};
    var photoMs = typeof options.photoMs === 'number' ? options.photoMs : 12000;
    var expandedMs = typeof options.expandedMs === 'number' ? options.expandedMs : 5000;
    var timer = 0, active = false, generation = 0;

    function photoStep(mine) {
      if (!active || mine !== generation) return;
      showPhoto();
      timer = later(function () { expandedStep(mine); }, photoMs);
    }

    function expandedStep(mine) {
      if (!active || mine !== generation) return;
      showExpanded();
      timer = later(function () { photoStep(mine); }, expandedMs);
    }

    function stop() {
      active = false;
      generation++;
      if (timer) cancel(timer);
      timer = 0;
    }

    return {
      start: function () { stop(); active = true; photoStep(generation); },
      stop: stop
    };
  }

  root.SaverCycle = {create: create};
}(window));
