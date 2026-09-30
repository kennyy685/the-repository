// reviewer scratch: keyboard reachability, visible focus, modals (trap, Esc, focus back), keys acting under modals.
import { launch, serve, watch, waitReady, args } from '../harness.mjs';
const o = args(process.argv.slice(2), { w: 1440, h: 900 });
const browser = await launch({ cpu2d: true });
const ctx = await browser.newContext({ viewport: { width: +o.w, height: +o.h }, deviceScaleFactor: 1, colorScheme: 'dark' });
await serve(ctx);
const page = await ctx.newPage(); const errs = watch(page);
const FOC = () => {
  const e = document.activeElement; if (!e || e === document.body) return { tag: 'BODY' };
  const cs = getComputedStyle(e), r = e.getBoundingClientRect();
  const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none');
  let vis = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  let op = 1, n = e; while (n && n.nodeType === 1) { op *= +getComputedStyle(n).opacity; n = n.parentElement; }
  const hid = !!e.closest('[aria-hidden="true"]');
  const d = e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (e.dataset && e.dataset.view ? '[' + e.dataset.view + ']' : '');
  return { tag: e.tagName, d, ring, vis, op: +op.toFixed(2), hid, label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30), inDialog: !!e.closest('[role=dialog]') };
};
async function tabWalk(n) {
  const seen = []; for (let i = 0; i < n; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(30); seen.push(await page.evaluate(FOC)); } return seen;
}
await page.goto('http://app.test/index.html?still=1#now', { waitUntil: 'load' });
await waitReady(page, 40000); await page.waitForTimeout(500);
for (const v of ['now', 'storms', 'knock', 'deal', 'money']) {
  await page.evaluate((v) => A.view.go(v, { instant: true }), v); await page.waitForTimeout(900);
  await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.scrollTo(0, 0); });
  const s = await tabWalk(90);
  const bad = s.filter((x) => x.tag !== 'BODY' && (!x.ring || !x.vis || x.op < 0.3 || x.hid));
  const uniq = new Set(s.map((x) => x.d)).size;
  console.log(v + ': ' + uniq + ' distinct stops; problems: ' + bad.length);
  const seenB = new Set(); bad.forEach((x) => { const k = x.d + (x.ring ? '' : ' NO-RING') + (x.vis ? '' : ' OFFSCREEN') + (x.op < 0.3 ? ' op' + x.op : '') + (x.hid ? ' ARIA-HIDDEN' : ''); if (!seenB.has(k)) { seenB.add(k); console.log('    ' + k + ' "' + x.label + '"'); } });
}
// credits via keyboard: focus #cut, Enter, Tab x40 stays inside, Esc closes, focus back
await page.evaluate(() => A.view.go('knock', { instant: true })); await page.waitForTimeout(900);
await page.focus('#cut'); await page.keyboard.press('Enter'); await page.waitForTimeout(400);
let c = await page.evaluate(() => !!document.querySelector('.colo'));
const inside = await tabWalk(40);
console.log('credits open:', c, 'focus left dialog on Tab:', inside.filter((x) => !x.inDialog).length, 'no ring:', inside.filter((x) => !x.ring).map((x) => x.d).slice(0, 5));
// knock keys under the credits
const w0 = await page.evaluate(() => JSON.stringify(A.knockDemo.state()));
await page.keyboard.press('n'); await page.waitForTimeout(300);
const w1 = await page.evaluate(() => JSON.stringify(A.knockDemo.state()));
console.log('knock N under credits changed the walk:', w0 !== w1);
await page.keyboard.press('2'); await page.waitForTimeout(500);
console.log('key 2 under credits -> view', await page.evaluate(() => A.view.current), 'credits still open', await page.evaluate(() => !!document.querySelector('.colo')));
// ? on top of credits, then Esc: which closes
await page.keyboard.press('?'); await page.waitForTimeout(300);
console.log('? over credits: keys', await page.evaluate(() => !!document.querySelector('.dir-keys')), 'colo', await page.evaluate(() => !!document.querySelector('.colo')));
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
console.log('after Esc: keys', await page.evaluate(() => !!document.querySelector('.dir-keys')), 'colo', await page.evaluate(() => !!document.querySelector('.colo')), 'focus', JSON.stringify(await page.evaluate(FOC)).slice(0, 120));
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
console.log('after 2nd Esc: keys', await page.evaluate(() => !!document.querySelector('.dir-keys')), 'colo', await page.evaluate(() => !!document.querySelector('.colo')), 'focus', (await page.evaluate(FOC)).d);
// key sheet on storms: arrows under it
await page.evaluate(() => A.view.go('storms', { instant: true })); await page.waitForTimeout(1200);
await page.evaluate(() => document.activeElement && document.activeElement.blur());
const d0 = await page.evaluate(() => A.stormsDemo && JSON.stringify({ a: A.stormsDemo.active, s: document.querySelector('.storms-tick[aria-current], .storms-tick.is-sel') && document.querySelector('.storms-tick[aria-current], .storms-tick.is-sel').dataset.i }));
await page.keyboard.press('?'); await page.waitForTimeout(300);
await page.keyboard.press('ArrowRight'); await page.waitForTimeout(300);
const d1 = await page.evaluate(() => A.stormsDemo && JSON.stringify({ a: A.stormsDemo.active, s: document.querySelector('.storms-tick[aria-current], .storms-tick.is-sel') && document.querySelector('.storms-tick[aria-current], .storms-tick.is-sel').dataset.i }));
console.log('storms ArrowRight under key sheet:', d0, '->', d1);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
// deal sheet: open with keyboard, trap, Esc, focus back
await page.evaluate(() => A.view.go('deal', { instant: true })); await page.waitForTimeout(1500);
const hb = await page.$('.deal-handbtn');
if (hb) {
  await hb.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
  const open = await page.evaluate(() => !!document.querySelector('.deal-modal'));
  const t = await tabWalk(20);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  console.log('deal sheet open', open, 'left dialog on Tab', t.filter((x) => !x.inDialog).length, 'closed', !(await page.evaluate(() => !!document.querySelector('.deal-modal'))), 'focus back', (await page.evaluate(FOC)).d);
} else console.log('no .deal-handbtn');
// film: Tab reaches controls, Esc restores focus
await page.focus('#film'); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
const ft = await tabWalk(14);
console.log('film tab stops:', [...new Set(ft.map((x) => x.d))].join(' | '), 'no-ring:', ft.filter((x) => x.tag !== 'BODY' && !x.ring).map((x) => x.d).slice(0, 4));
await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
console.log('after film Esc focus:', (await page.evaluate(FOC)).d);
console.log('errors', errs.length); errs.slice(0, 10).forEach((e) => console.log('  ' + e));
await browser.close();
