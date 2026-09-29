/* Claude's Aldaba · now.js · STUB (placeholder until the Now builder replaces it)
   #now = the 7 AM brief: map + hot zones + Aldaba's pick + why + today's plan + what changed overnight.
   Keep the register() shape; everything inside enter() is yours. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;
  A.view.register('now', {
    title: { en: 'Now', es: 'Ahora' }, key: '1',
    camera: () => ({ bounds: A.world.presets.region, pad: { t: 50, r: 60, b: 70, l: 60 } }),
    enter(ctx) {
      const p = ctx.data.pick || {}, U = A.ui, F = A.fmt;
      ctx.el('left', `<div class="stub">
          <span class="stub__tag">${A.L('Placeholder · now.js', 'Marcador · now.js')}</span>
          <p class="eyebrow eyebrow--acc">${A.L("Aldaba's pick", 'La elección de Aldaba')} · <b>${A.L('rank 1 of ' + ctx.data.zones.length, 'lugar 1 de ' + ctx.data.zones.length)}</b></p>
          <h1 class="t-title">${A.esc(p.name)}</h1>
          <p class="t-lead">${A.L(A.esc(p.why.en), A.esc(p.why.es))}</p></div>`, 'pane');
      ctx.el('left', `<div class="stats">
          <div class="stat"><span class="stat__k">${A.L('Hail', 'Granizo')} ${U.srcTag('mrms')}</span><span class="stat__v" data-h="${U.hailKey(p.hail_in)}">${F.num(p.hail_in, 2)}<span class="stat__u">${A.L('in', 'pulg')}</span></span></div>
          <div class="stat"><span class="stat__k">${A.L('Storm', 'Tormenta')} ${U.srcTag('spc')}</span><span class="stat__v">${A.both(() => F.date(p.storm_day))}</span></div>
          <div class="stat"><span class="stat__k">${A.L('Drive', 'Manejo')} ${U.srcTag('engine')}</span><span class="stat__v">${F.num(p.dist_mi, 1)}<span class="stat__u">mi</span></span></div>
          <div class="stat"><span class="stat__k">${A.L('Doors', 'Puertas')} ${U.sampleTag()}</span><span class="stat__v">${p.doors}</span></div></div>`, 'pane pane--tight');
      ctx.el('left', `<p class="sec">${A.L('This view will hold', 'Esta vista tendrá')}</p><ul class="stub__list">
          <li>${A.L('The 7 AM brief: what changed overnight, with sources', 'El resumen de las 7 AM: qué cambió anoche, con fuentes')}</li>
          <li>${A.L('Hot zones on the map, ranked', 'Zonas calientes en el mapa, en orden')}</li>
          <li>${A.L("Aldaba's pick, why, and the backup", 'La elección de Aldaba, el porqué y la alternativa')}</li>
          <li>${A.L("Today's plan, 7 AM to 7:30 PM", 'El plan de hoy, de 7 a. m. a 7:30 p. m.')}</li></ul>`, 'pane');
      ctx.pin('now-pick', [p.center.lon, p.center.lat], A.h('<div class="mk-ring mk-ring--pulse" data-tip="Rank 1 zone" data-tip-es="Zona número 1"><b>1</b></div>'));
    }
  });
})();
