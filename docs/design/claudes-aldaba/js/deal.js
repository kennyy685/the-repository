/* Claude's Aldaba · deal.js · STUB (placeholder until the Deal builder replaces it)
   #deal = one door's path to a signed job with the Nebraska legal armor, plus the homeowner-facing HMP sheet. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;
  A.view.register('deal', {
    title: { en: 'Deal', es: 'Trato' }, key: '4', ambient: false,
    camera: () => { const h = (A.data.homes || [])[0]; return { center: h ? h.p : A.data.hq, zoom: 18.4 }; },
    enter(ctx) {
      const h = (ctx.data.homes || [])[0] || {}, U = A.ui;
      ctx.el('left', `<div class="stub"><span class="stub__tag">${A.L('Placeholder · deal.js', 'Marcador · deal.js')}</span>
          <p class="eyebrow">${A.L('Door 1', 'Puerta 1')} ${U.sampleTag()}</p>
          <h1 class="t-title">${A.esc(h.addr || '')}</h1>
          <p class="t-body">${A.L('From first knock to a signed job, step by step.', 'Del primer toque a un trabajo firmado, paso a paso.')}</p></div>`, 'pane');
      ctx.el('left', `<p class="sec">${A.L('Legal armor', 'Protección legal')} ${U.srcTag('law')}</p><ul class="stub__list">
          <li>${A.L('Say your name, HMP and what we sell first (69-1602)', 'Di tu nombre, HMP y lo que vendemos primero (69-1602)')}</li>
          <li>${A.L('3-day cancel form with every sale, EN and ES (69-1604)', 'Formulario de cancelación de 3 días en cada venta, EN y ES (69-1604)')}</li>
          <li>${A.L('Itemized description to homeowner and insurer (44-8606)', 'Descripción detallada al dueño y a la aseguradora (44-8606)')}</li></ul>`, 'pane');
      ctx.el('right', `<div class="stub"><span class="stub__tag">${A.L('Placeholder · homeowner sheet', 'Marcador · hoja para el dueño')}</span>
          <p class="t-head">HMP Siding &amp; Roofing</p>
          <p class="t-small">${A.L('What the homeowner sees. Branded HMP, never Aldaba.', 'Lo que ve el dueño de la casa. Con la marca HMP, nunca Aldaba.')}</p></div>`, 'pane');
      if (h.p) ctx.pin('deal-home', h.p, A.h('<div class="mk-ring"><b>1</b></div>'));
    }
  });
})();
