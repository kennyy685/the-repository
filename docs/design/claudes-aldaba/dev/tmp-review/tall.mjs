import { ROOT, args, launch, serve, watch, url, waitReady } from '../harness.mjs';
const o = args(process.argv.slice(2), { view: 'deal', w: 400, h: 860, h2: 2600 });
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: +o.w, height: +o.h }, colorScheme: 'dark' });
await serve(ctx); const page = await ctx.newPage(); const errs = watch(page);
await page.goto(url({ view: o.view, theme: 'dark', lang: 'en', still: true })); await waitReady(page); await page.waitForTimeout(1000);
const m = () => page.evaluate(() => ({ heap: Math.round(performance.memory.usedJSHeapSize/1e6), sh: document.scrollingElement.scrollHeight, cv: [...document.querySelectorAll('canvas')].map(c=>c.width+'x'+c.height+(c.className?'.'+c.className:'')).join(' ') }));
console.log('before', await m());
await page.setViewportSize({ width: +o.w, height: +o.h2 });
for (let i=0;i<5;i++){ await page.waitForTimeout(800); try { console.log('t'+i, await m()); } catch(e){ console.log('err', e.message.slice(0,100)); break; } }
console.log(errs.slice(0,5));
await browser.close();
