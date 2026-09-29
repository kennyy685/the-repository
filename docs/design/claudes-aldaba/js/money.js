/* Claude's Aldaba · money.js · STUB (placeholder until the Money builder replaces it)
   #money = the path to $100k by the end of 2026 as a reverse funnel from real benchmarks. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;
  A.view.register('money', {
    title: { en: 'Money', es: 'Dinero' }, key: '5', dim: 0.55, hail: 0.35, ambient: false,
    camera: () => ({ bounds: A.world.presets.state, pad: 0 }),
    enter(ctx) {
      const card = ctx.el('center', `<div class="stub"><span class="stub__tag">${A.L('Placeholder · money.js', 'Marcador · money.js')}</span>
          <p class="eyebrow eyebrow--acc">${A.L('The goal', 'La meta')} ${A.ui.srcTag('goal')}</p>
          <p class="t-hero num" id="money-goal">$100,000</p>
          <p class="t-lead">${A.L('by December 31, 2026. The builder adds the reverse funnel: doors, talks, inspections, signed jobs.', 'para el 31 de diciembre de 2026. Quien construya esta vista agrega el embudo inverso: puertas, pláticas, inspecciones, trabajos firmados.')}</p></div>`, 'float pane');
      card.style.maxWidth = '560px'; card.style.marginTop = '8vh';
      A.motion.countUp(card.querySelector('#money-goal'), 100000, { format: (v) => A.fmt.money(v), ms: 1400, delay: 250 });
    }
  });
})();
