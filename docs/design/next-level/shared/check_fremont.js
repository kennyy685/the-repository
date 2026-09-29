// Check for data-fremont.js (build_fremont.py): loads in node after data.js, keeps the Columbus shapes, and every
// sample home sits within 60 m of a walk street. Run from repo root: node docs/design/next-level/shared/check_fremont.js
const path = require('path'), dir = __dirname;
global.window = {};
require(path.join(dir, 'data.js'));
const C = JSON.parse(JSON.stringify(window.NL));             // Columbus values, before the reassign
require(path.join(dir, 'data-fremont.js'));
const N = window.NL, bad = [];
const ok = (cond, msg) => { if (!cond) bad.push(msg); };
const keys = o => Object.keys(o).sort().join(',');
ok(N.city === 'Fremont', 'NL.city');
ok(keys(N.pick) === keys(C.pick), 'pick keys ' + keys(N.pick));
['start', 'best_time', 'why', 'plan', 'center'].forEach(k => ok(keys(N.pick[k]) === keys(C.pick[k]), 'pick.' + k + ' keys'));
ok(N.pick.area_id && N.areas.some(a => a.id === N.pick.area_id), 'pick.area_id is a real area');
const area = N.areas.find(a => a.id === N.pick.area_id) || {};
ok(N.pick.hail_in === area.hail, 'pick hail = the area\'s real hail');
ok(keys(N.walk) === keys(C.walk) && N.walk.zone_id === N.pick.zone_id, 'walk keys / zone_id');
ok(N.walk.s.length === N.walk.c.length && N.walk.s.length === N.walk.r.length, 'walk s/c/r lengths');
ok(N.walk.s.every(s => keys(s) === keys(C.walk.s[0])), 'walk.s keys');
ok(N.walk.s.reduce((t, s) => t + s.h, 0) === 25 && N.pick.doors === 25, 'walk doors = 25');
ok(N.homes.length === 25, 'homes = 25');
ok(N.homes.every(h => keys(h) === keys(C.homes[0])), 'home keys');
ok(N.homes.map(h => h.rank).sort((a, b) => a - b).join() === Array.from({length: 25}, (_, i) => i + 1).join(), 'ranks 1..25');
ok(N.homes.every(h => h.hail >= 1 && h.hail <= 1.66), 'home hail inside the real report..radar range');
ok(!N.homes.some(h => /owner|name/i.test(Object.keys(h).join())), 'no owner fields');
ok(N.streets === N.columbus && N.columbus.length > 50 && N.columbus.every(s => keys(s) === 'c,n,p' && s.n), 'streets');
ok(keys(N.headline) === 'en,es', 'headline');
// every home within 60 m of a walk street line
const kx = 111320 * Math.cos(41.44 * Math.PI / 180), ky = 110540;
const segD = (p, a, b) => {
  const ax = (a[0] - p[0]) * kx, ay = (a[1] - p[1]) * ky, bx = (b[0] - p[0]) * kx, by = (b[1] - p[1]) * ky;
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
  return Math.hypot(ax + dx * t, ay + dy * t);
};
let worst = 0;
for (const h of N.homes) {
  let d = Infinity;
  for (const s of N.walk.s) for (let i = 0; i < s.p.length - 1; i++) d = Math.min(d, segD(h.p, s.p[i], s.p[i + 1]));
  worst = Math.max(worst, d);
  ok(d <= 60, `${h.addr} is ${d.toFixed(0)} m from the walk`);
}
if (bad.length) { console.error('FAIL data-fremont.js:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log(`ok data-fremont.js: ${N.pick.name}, ${N.homes.length} homes, farthest ${worst.toFixed(0)} m from the walk, ${N.streets.length} streets`);
