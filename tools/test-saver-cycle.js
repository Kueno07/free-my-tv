const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = require('path').join(__dirname, '../web/saver-cycle.js');
assert.ok(fs.existsSync(source), 'SaverCycle must exist');
let nextId = 0, timers = {};
const window = {};
vm.runInNewContext(fs.readFileSync(source, 'utf8'), {window});
function schedule(fn, delay) { const id = ++nextId; timers[id] = {fn, delay}; return id; }
function cancel(id) { delete timers[id]; }
function fire(delay) {
  const entry = Object.keys(timers).map(Number).map(id => ({id, timer: timers[id]})).find(x => x.timer.delay === delay);
  assert.ok(entry, 'expected a timer for ' + delay + 'ms');
  delete timers[entry.id]; entry.timer.fn();
}
const states = [];
const cycle = window.SaverCycle.create({photo: () => states.push('photo'), expanded: () => states.push('calendar'),
  setTimeout: schedule, clearTimeout: cancel, photoMs: 12000, expandedMs: 5000});
cycle.start();
assert.deepStrictEqual(states, ['photo']);
fire(12000);
assert.deepStrictEqual(states, ['photo', 'calendar']);
fire(5000);
assert.deepStrictEqual(states, ['photo', 'calendar', 'photo']);
cycle.stop();
assert.strictEqual(Object.keys(timers).length, 0);
cycle.start();
assert.strictEqual(states[3], 'photo');
cycle.stop();
assert.strictEqual(Object.keys(timers).length, 0);
console.log('SaverCycle checks passed');
