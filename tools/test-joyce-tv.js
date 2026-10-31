const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = path.join(__dirname, '../web/joyce-tv.js');
assert.ok(fs.existsSync(source), 'JoyceTV client must exist');
const storage = {};
const context = { window: {}, localStorage: {getItem: k => storage[k] || null, setItem: (k,v) => {storage[k]=v;}, removeItem: k => {delete storage[k];}}, setTimeout, clearTimeout, setInterval, clearInterval, Date, JSON, console };
vm.runInNewContext(fs.readFileSync(source, 'utf8'), context);
const tv = context.window.JoyceTV;
const sample = {updatedAt:'2026-10-31T12:00:00Z',timeZone:'America/Sao_Paulo',meals:[{date:'2026-10-31',lunch:'Soup',dinner:null}],eventDates:['2026-10-31'],upcomingEvents:[{date:'2026-11-01',title:'Family',start:'2026-11-01T12:00:00Z',allDay:false}]};
assert.strictEqual(tv.validSnapshot(sample), true);
assert.strictEqual(tv.validSnapshot({updatedAt:'bad',timeZone:'x',meals:[],eventDates:[],upcomingEvents:[]}), false);
assert.strictEqual(tv.validSnapshot({updatedAt:sample.updatedAt,timeZone:sample.timeZone,meals:[],eventDates:['bad'],upcomingEvents:[]}), false);
assert.strictEqual(tv.validSnapshot({updatedAt:sample.updatedAt,timeZone:sample.timeZone,meals:{},eventDates:[],upcomingEvents:[]}), false);
assert.deepStrictEqual(JSON.parse(JSON.stringify(tv.monthRange(2026, 2))), {fromDate:'2026-02-01',toDate:'2026-02-28'});
assert.deepStrictEqual(JSON.parse(JSON.stringify(tv.monthRange(2024, 2))), {fromDate:'2024-02-01',toDate:'2024-02-29'});
assert.strictEqual(tv.snapshot(), null);
storage['fmtv.joyce.snapshot'] = JSON.stringify(sample);
assert.strictEqual(tv.snapshot().meals[0].lunch, 'Soup');
assert.strictEqual(tv.snapshot().eventDates[0], '2026-10-31');
assert.strictEqual(tv.snapshot().upcomingEvents[0].title, 'Family');
assert.strictEqual(tv.updatedAt(), sample.updatedAt);
storage['fmtv.joyce.snapshot'] = '{bad';
assert.strictEqual(tv.snapshot(), null);
console.log('JoyceTV checks passed');


(async function integration() {
  const crypto = require('crypto');
  const saved = {}, requests = [], polls = [];
  let status = 'pending';
  class XHR {
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { (this.headers || (this.headers = {}))[key] = value; }
    send(body) {
      requests.push({method:this.method, url:this.url, headers:this.headers || {}, body:body && JSON.parse(body)});
      this.readyState = 4; this.status = 200;
      if (this.method === 'POST') this.responseText = JSON.stringify({ok:true,status:'pending',expiresAt:'2099-01-01T00:00:00Z'});
      else if (this.url.indexOf('/pairing') !== -1) this.responseText = JSON.stringify({ok:true,status,expiresAt:'2099-01-01T00:00:00Z'});
      else this.responseText = JSON.stringify(sample);
      this.onreadystatechange();
    }
  }
  const c = {window:{crypto:crypto.webcrypto,btoa:s => Buffer.from(s,'binary').toString('base64')}, Uint8Array, XMLHttpRequest:XHR, localStorage:{getItem:k=>saved[k] || null,setItem:(k,v)=>{saved[k]=v;},removeItem:k=>{delete saved[k];}}, setTimeout:fn=>{polls.push(fn);return polls.length;}, clearTimeout:()=>{}, setInterval:()=>1, clearInterval:()=>{}, Date, JSON};
  vm.runInNewContext(fs.readFileSync(source, 'utf8'), c);
  let state;
  await new Promise((resolve,reject) => c.window.JoyceTV.beginPairing('https://joyce.example','Free My TV',(err,result)=>{if(err) reject(err); else {state=result; resolve();}}));
  assert.strictEqual(state.status, 'pending');
  assert.match(state.code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  assert.strictEqual(saved['fmtv.joyce.token'], undefined);
  const posted = requests[0].body;
  assert.deepStrictEqual(Object.keys(posted).sort(), ['deviceLabel','deviceTokenHash','pairingCodeHash']);
  assert.strictEqual(posted.pairingCodeHash, crypto.createHash('sha256').update(state.code).digest('hex'));
  status = 'active'; polls.shift()();
  assert.strictEqual(state.status, 'active');
  const token = saved['fmtv.joyce.token'];
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.strictEqual(posted.deviceTokenHash, crypto.createHash('sha256').update(token).digest('hex'));
  assert.strictEqual(requests[1].headers.Authorization, 'Bearer ' + token);
  assert.strictEqual(requests[2].headers.Authorization, 'Bearer ' + token);
  assert.strictEqual(c.window.JoyceTV.snapshot().meals[0].lunch, 'Soup');
  console.log('Pairing and snapshot XHR checks passed');
}()).catch(err => { console.error(err); process.exitCode = 1; });

(function refreshOrderingAndFallback() {
  const saved = {'fmtv.joyce.base':'https://joyce.example', 'fmtv.joyce.token':'a'.repeat(43), 'fmtv.joyce.snapshot':JSON.stringify(sample)};
  const pending = [];
  class XHR {
    open(method, url) { this.url = url; }
    setRequestHeader() {}
    send() { pending.push(this); }
    reply(status, text) { this.status=status; this.responseText=text; this.readyState=4; this.onreadystatechange(); }
    fail() { this.onerror(); }
  }
  const c = {window:{}, XMLHttpRequest:XHR, localStorage:{getItem:k=>saved[k] || null,setItem:(k,v)=>{saved[k]=v;},removeItem:k=>{delete saved[k];}}, setTimeout, clearTimeout, setInterval:()=>1, clearInterval:()=>{}, Date, JSON};
  vm.runInNewContext(fs.readFileSync(source,'utf8'), c);
  const api = c.window.JoyceTV, newer = {...sample, updatedAt:'2026-11-01T12:00:00Z', meals:[{date:'2026-11-01',dinner:'New'}]};
  let oldResult, newResult;
  api.refresh('2026-10-01','2026-10-31',(err,data)=>{oldResult={err,data};});
  api.refresh('2026-11-01','2026-11-30',(err,data)=>{newResult={err,data};});
  pending[1].reply(200,JSON.stringify(newer));
  pending[0].reply(200,JSON.stringify(sample));
  assert.strictEqual(newResult.err, null);
  assert.ok(oldResult.err, 'superseded request must report an error');
  assert.strictEqual(api.snapshot().meals[0].dinner, 'New');
  assert.strictEqual(api.updatedAt(), newer.updatedAt);
  for (const response of ['network', JSON.stringify({invalid:true}), 'x'.repeat(262145)]) {
    let result;
    api.refresh('2026-11-01','2026-11-30',(err,data)=>{result={err,data};});
    const xhr=pending[pending.length-1];
    if (response === 'network') xhr.fail(); else xhr.reply(200,response);
    assert.ok(result.err, 'failure must be reported');
    assert.strictEqual(result.data.updatedAt,newer.updatedAt);
    assert.strictEqual(api.snapshot().meals[0].dinner,'New');
    assert.strictEqual(api.updatedAt(),newer.updatedAt);
  }
  let cancelled;
  api.refresh('2026-11-01','2026-11-30',(err,data)=>{cancelled={err,data};});
  const prior = pending[pending.length-1];
  assert.strictEqual(api.configure('https://other.example','b'.repeat(43)),true);
  prior.reply(200,JSON.stringify(newer));
  assert.ok(cancelled.err, 'reconfiguration must invalidate an in-flight request');
  assert.strictEqual(api.snapshot(),null);
  assert.strictEqual(api.monthRange(undefined,2),null);
  assert.strictEqual(api.monthRange(2026,NaN),null);
  let secureError;
  api.beginPairing('https://joyce.example','Free My TV',err=>{secureError=err;});
  assert.strictEqual(secureError.code,'SECURE_PAIRING_UNAVAILABLE');
  console.log('Refresh ordering and fallback checks passed');
}());
