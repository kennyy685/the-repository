/* Claude's Aldaba · boot.js
   Runs last: wires the chrome, starts the world, plays the intro (unless still), then enters the start view.
   A.ready turns true (and 'ready' fires) once the first view has settled. */
(function () {
  'use strict';
  const A = window.A;
  if (!A || !A.view) { console.warn('[aldaba] core.js did not load'); return; }
  async function boot() {
    A.safe('chrome', () => A.ui.mountChrome());
    A.safe('world', () => A.world && A.world.init(document.getElementById('world')));
    const start = A.view.fromHash() || 'now';
    if (!A.still && A.intro && typeof A.intro.play === 'function') {
      try { await A.intro.play({ to: start }); } catch (e) { console.warn('[aldaba] intro failed:', e); }
    }
    A.ui.chrome(true); // whatever the intro did, the chrome comes back
    try { await A.view.go(start, { instant: A.still, force: true }); } catch (e) { console.warn('[aldaba] first view failed:', e); }
    A.ready = true;
    document.documentElement.classList.add('is-ready');
    A.emit('ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
