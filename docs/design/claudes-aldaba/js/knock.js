/* Claude's Aldaba · knock.js · STUB (placeholder until the Knock builder replaces it)
   #knock = the pick's block-level walk: 25 sample doors, the route, one tap per door. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;
  A.view.register('knock', {
    title: { en: 'Knock', es: 'Tocar' }, key: '3', ambient: false,
    camera: () => {
      const N = A.data, pts = (N.homes || []).map((h) => h.p);
      (N.walk && N.walk.s || []).forEach((s) => s.p.forEach((p) => pts.push(p)));
      return { points: pts, pad: 110, maxZoom: 17.6 };
    },
    enter(ctx) {
      const H = ctx.data.homes || [], U = A.ui, w = ctx.data.walk || {};
      const rows = H.slice(0, 5).map((h) => `<div class="row"><span class="row__lead">${h.rank}</span>
          <span class="row__main"><span class="row__t">${A.esc(h.addr)} ${U.sampleTag()}</span><span class="row__s">${A.L('Built ' + h.built + ' · roof ' + h.roof + ' yrs', 'Construida en ' + h.built + ' · techo de ' + h.roof + ' años')}</span></span>
          <span class="row__trail">${h.score}${U.srcTag('engine')}</span></div>`).join('');
      ctx.el('left', `<div class="stub"><span class="stub__tag">${A.L('Placeholder · knock.js', 'Marcador · knock.js')}</span>
          <h1 class="t-title">${A.L(H.length + ' sample doors', H.length + ' puertas de muestra')}</h1>
          <p class="t-body">${A.L('Park at ' + A.esc((w.pn || []).join(' & ')) + '. The builder adds the route and one tap per door.', 'Estaciónate en ' + A.esc((w.pn || []).join(' y ')) + '. Quien construya esta vista agrega la ruta y un toque por puerta.')}</p></div>`, 'pane');
      ctx.el('left', `<div class="rows rows--lined">${rows}</div>`, 'pane pane--tight');
      H.forEach((h) => ctx.pin('door-' + h.rank, h.p, A.h(`<div class="mk-door${h.rank <= 5 ? ' mk-door--hot' : ''}">${h.rank}</div>`), { minZoom: 14.5 }));
    }
  });
})();
