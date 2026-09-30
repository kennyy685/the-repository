import { join } from 'path';
import { ROOT, args, launch, serve, watch, url, waitReady } from '../harness.mjs';
const o = args(process.argv.slice(2), { view: 'knock', w: 400, h: 860, theme: 'dark', lang: 'en' });
const browser = await launch();
for (const view of String(o.view).split(',')) {
  const ctx = await browser.newContext({ viewport: { width: +o.w, height: +o.h }, colorScheme: o.theme });
  await serve(ctx); const page = await ctx.newPage(); const errs = watch(page);
  await page.goto(url({ view, theme: o.theme, lang: o.lang, still: true })); await waitReady(page); await page.waitForTimeout(1500);
  const f = join(ROOT, 'dev/tmp-review', `full-${view}-${o.theme}-${o.lang}-${o.w}.png`);
  await page.screenshot({ path: f, fullPage: true });
  console.log(f, errs.join('|'));
  await ctx.close();
}
await browser.close();
