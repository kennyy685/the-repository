// Hub Observatory "Shipped this week": only real publishes count (QA 2026-09-29, finding 4).
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../pages/crew-hq.html'), 'utf8');
const line = src.split('\n').find(l => l.startsWith('const SHIP_RX = '));
if (!line) { console.error('FAIL: SHIP_RX line not found'); process.exit(1); }
const { SHIP_RX, NOT_SHIP_RX } = new Function(line.replace(/^const /, 'var ') + '; return {SHIP_RX, NOT_SHIP_RX};')();
const counts = t => SHIP_RX.test(t) && !NOT_SHIP_RX.test(t);
const no = ['QA PASS: ready to publish', 'Ready to publish v28.1 once you say yes', 'Will publish after QA', 'publish held for your OK',
  'Nothing shipped yet this week', 'No publish until FilthE approves', 'checks passed; awaiting publish', 'the page is live, ok',
  'Not published yet', 'Publish pending QA'];
const yes = ['Published hub v28.0 to the same URL', 'Engine PR merged into main', 'Hub v28.1 went live (Version 32)', 'Open map v5 is now live', 'Shipped the Practice Door v12'];
let bad = 0;
for (const t of no) if (counts(t)) { console.error('counted but should not: ' + t); bad++; }
for (const t of yes) if (!counts(t)) { console.error('missed: ' + t); bad++; }
if (bad) { console.error('FAIL: ' + bad); process.exit(1); }
console.log('PASS: hub shipped counter (' + (no.length + yes.length) + ' lines)');
