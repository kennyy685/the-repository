/* A mocked claude.ai runtime for the AI hub's live-data smoke test (hub_live_check.js), shaped like contract 0.2.58
 * (the d.ts files the artifact-capabilities skill ships): claude.use(name) -> db (in-memory store seeded with the hub's
 * real doc shapes, live onSnapshot), sample, mcp (callTool), user. Each piece can succeed, fail or hang, so the test proves
 * the page stays usable when the runtime doesn't answer - the offline checks never did, and the hub froze live.
 *   window.__MOCK = {docs:{'<coll>/<id>': body}, modes:{db|dbw|sample|mcp|user: 'ok'|'fail'|'hang'|'slow', use_<name>: 'hang'|'null'|'throw'}}
 *   window.__mockLog: ['set'|'update'|'delete', path] and ['mcp', tool, input] entries, in order. */
(function(){
  const cfg = window.__MOCK || {docs:{}, modes:{}};
  const M = cfg.modes || {};
  const log = window.__mockLog = [];
  const store = new Map(Object.entries(cfg.docs || {}).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
  const listeners = new Set();
  const hang = () => new Promise(() => {});
  const err = (code) => Object.assign(new Error(code), {code});
  const later = (fn, ms) => new Promise((res, rej) => setTimeout(() => { try { res(fn()); } catch (e) { rej(e); } }, ms == null ? 5 : ms));
  function mode(k){ return M[k] || 'ok'; }
  function gate(k, fn){
    const m = mode(k);
    if (m === 'hang') return hang();
    if (m === 'fail') return later(() => { throw err('unavailable'); });
    if (m === 'slow') return later(fn, 3000);
    return later(fn);
  }
  const frz = o => JSON.parse(JSON.stringify(o));
  function snapDoc(path){ const id = path.split('/').pop(), b = store.get(path); return {id, exists: !!b, data: () => b ? frz(b) : undefined, metadata:{fromCache:false, hasPendingWrites:false}}; }
  function collDocs(coll){ const out = []; for (const k of store.keys()) { const i = k.lastIndexOf('/'); if (k.slice(0, i) === coll) out.push(snapDoc(k)); } return out; }
  function runQuery(q){
    let d = collDocs(q.coll);
    for (const [f, op, v] of q.wh) d = d.filter(x => { const a = (x.data() || {})[f]; return op === '==' ? a === v : op === '!=' ? a !== v : op === '>' ? a > v : op === '<' ? a < v : op === '>=' ? a >= v : op === '<=' ? a <= v : true; });
    if (q.ob) { const [f, dir] = q.ob; d.sort((a, b) => { const x = (a.data() || {})[f], y = (b.data() || {})[f]; const c = x == null ? 1 : y == null ? -1 : x < y ? -1 : x > y ? 1 : 0; return dir === 'desc' ? -c : c; }); }
    else d.sort((a, b) => a.id < b.id ? -1 : 1);
    if (q.lim) d = d.slice(0, q.lim);
    return {docs: d, size: d.length, empty: !d.length, docChanges: () => d.map((doc, i) => ({type:'added', doc, oldIndex:-1, newIndex:i})), metadata:{fromCache:false, hasPendingWrites:false}};
  }
  function notify(){ for (const l of [...listeners]) l.fire(); }
  function onSnap(fire0, next, error){
    if (mode('db') === 'hang') return () => {};
    const l = {fire: () => { try { next(fire0()); } catch (e) { setTimeout(() => { throw e; }); } }};
    if (mode('db') === 'fail') { setTimeout(() => error && error(err('unavailable')), 10); return () => {}; }
    listeners.add(l); setTimeout(l.fire, 10);
    window.__subs = (window.__subs || 0) + 1;
    return () => { if (listeners.delete(l)) window.__subs--; };
  }
  function docRef(path){
    return {id: path.split('/').pop(), path,
      get: () => gate('db', () => snapDoc(path)),
      set: (data) => gate('dbw', () => { store.set(path, frz(data)); log.push(['set', path]); notify(); }),
      update: (data) => gate('dbw', () => { if (!store.has(path)) throw err('invalid_argument'); store.set(path, Object.assign(store.get(path), frz(data))); log.push(['update', path]); notify(); }),
      delete: () => gate('dbw', () => { store.delete(path); log.push(['delete', path]); notify(); }),
      onSnapshot: (n, e) => onSnap(() => snapDoc(path), n, e),
      collection: (p) => collRef(path + '/' + p)};
  }
  function query(coll, wh, ob, lim){
    const q = {coll, wh, ob, lim};
    return {where: (f, op, v) => query(coll, [...wh, [f, op, v]], ob, lim), orderBy: (f, dir) => query(coll, wh, [f, dir || 'asc'], lim), limit: (n) => query(coll, wh, ob, n),
      get: () => gate('db', () => runQuery(q)), onSnapshot: (n, e) => onSnap(() => runQuery(q), n, e)};
  }
  function collRef(coll){ const q = query(coll, [], null, 0); return Object.assign(q, {path: coll, doc: (id) => docRef(coll + '/' + (id || Math.random().toString(36).slice(2, 12))), add: async (d) => { const r = docRef(coll + '/' + Math.random().toString(36).slice(2, 12)); await r.set(d); return r; }}); }
  const db = {doc: docRef, collection: collRef};
  window.__mockDb = {store, notify, db};
  const withSignal = (pr, opts) => opts && opts.signal ? Promise.race([pr, new Promise((_, rej) => { const f = () => rej(err('cancelled')); if (opts.signal.aborted) f(); else opts.signal.addEventListener('abort', f); })]) : pr;   // abort rejects promptly (sample.d.ts)
  const sample = Object.assign((input, opts) => withSignal(gate('sample', () => { const t = 'Mock King answer. ' + (window.__sampleText || 'Done.'); opts && opts.onText && opts.onText({text:t, delta:t}); return {text:t, truncated:false}; }), opts),
    {json: (input, opts) => withSignal(gate('sample', () => (window.__sampleJson || {reply:'Mock answer', actions:[]})), opts), limits: async () => ({images:false})});
  const mcp = {callTool: (server, tool, input) => { log.push(['mcp', tool, input]); return gate('mcp', () => { return {payload: tool === 'get_session' ? {id:'s', status:'idle', title:'SMUIPO (King)'} : tool === 'create_session' ? {id:'session_new'} : tool === 'list_environments' ? {environments:[{environment_id:'env_test', kind:'anthropic_cloud', state:'active'}]} : {ok:true}, content:[{type:'text', text:'{}'}]}; }); },
    watchTool: () => () => {}, server: async () => ({})};
  const user = {isOwner: () => gate('user', () => true), canEdit: () => gate('user', () => true), can: () => gate('user', () => true), id: () => gate('user', () => 'u_owner'), me: () => gate('user', () => ({id:'u_owner', name:'FilthE'})), profiles: async () => ({})};
  const caps = {db, sample, mcp, user, assets: null};
  window.claude = {use: (n) => {
    const m = mode('use_' + n);
    if (m === 'hang') return hang();
    if (m === 'null' || mode(n) === 'null') return later(() => null, 20);
    if (m === 'throw') return later(() => { throw err('not_granted'); }, 20);
    return later(() => caps[n] || null, 20);
  }};
})();
