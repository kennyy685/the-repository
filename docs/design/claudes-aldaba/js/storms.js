/* Claude's Aldaba · storms.js · STUB (placeholder until the Storms builder replaces it)
   #storms = 18 real 2026 storm days, a timeline scrubber replaying swaths with WebGL hail. */
(function () {
  'use strict';
  const A = window.A; if (!A || !A.view) return;
  A.view.register('storms', {
    title: { en: 'Storms', es: 'Tormentas' }, key: '2',
    camera: () => ({ bounds: A.world.presets.state, pad: 28 }),
    enter(ctx) {
      const S = ctx.data.storms || [], U = A.ui, F = A.fmt;
      const rows = S.slice(0, 6).map((s) => `<div class="row"><span class="row__lead row__lead--ring" style="border-color:var(${U.hailTok(s.max)})"></span>
          <span class="row__main"><span class="row__t">${A.both(() => F.date(s.date, 'day'))}</span><span class="row__s">${A.L(s.days + ' days ago', 'hace ' + s.days + ' días')}</span></span>
          <span class="row__trail"><span data-h="${U.hailKey(s.max)}">${F.num(s.max, 2)} ${A.L('in', 'pulg')}</span>${U.srcTag('storms')}</span></div>`).join('');
      ctx.el('left', `<div class="stub"><span class="stub__tag">${A.L('Placeholder · storms.js', 'Marcador · storms.js')}</span>
          <h1 class="t-title">${A.L(S.length + ' storm days in 2026', S.length + ' días de tormenta en 2026')}</h1>
          <p class="t-body">${A.L('Newest first. The builder adds the replay and the scrubber.', 'Los más recientes primero. Quien construya esta vista agrega la repetición y la línea de tiempo.')}</p></div>`, 'pane');
      ctx.el('left', `<div class="rows rows--lined">${rows}</div>`, 'pane pane--tight');
      ctx.el('bottom', `<div class="stub"><span class="stub__tag">${A.L('Placeholder · timeline dock', 'Marcador · línea de tiempo')}</span>
          <p class="t-small">${A.L('Scrub Mar 6 to Sep 13; each storm day replays its swath on the map.', 'Recorre del 6 de mar al 13 de sep; cada día de tormenta repite su franja en el mapa.')}</p></div>`, 'pane pane--tight');
    }
  });
})();
