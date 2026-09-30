import { launch, serve, watch, url, waitReady } from '../harness.mjs';
import { writeFileSync } from 'fs';
const views = (process.argv[2] || 'now,storms,knock,deal,money,now&credits=1').split(',');
const langs = (process.argv[3] || 'en,es').split(',');
const browser = await launch();
for (const view of views) for (const lang of langs) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await serve(ctx); const page = await ctx.newPage(); const errs = watch(page);
  await page.goto(url({ view, theme: 'dark', lang, still: true })); await waitReady(page); await page.waitForTimeout(2500);
  const extra = process.env.CLICK;
  if (extra) { try { await page.click(extra, { timeout: 3000 }); await page.waitForTimeout(1200); } catch (e) { console.log('click fail', e.message.slice(0,80)); } }
  const txt = await page.evaluate(() => {
    const t = document.body.innerText;
    const attrs = [...document.querySelectorAll('[data-tip],[data-tip-es],[aria-label],[title]')].map((e) => [e.getAttribute('data-tip'), e.getAttribute('data-tip-es'), e.getAttribute('aria-label'), e.getAttribute('title')].filter(Boolean).join(' || '));
    return t + '\n----ATTRS----\n' + [...new Set(attrs)].join('\n');
  });
  const f = `/home/user/the-repository/docs/design/claudes-aldaba/dev/tmp-review/${view.replace(/[&=]/g,'-')}-${lang}${process.env.TAG||''}.txt`;
  writeFileSync(f, txt); console.log(f, txt.length, errs.length ? errs : '');
  await ctx.close();
}
await browser.close();
