/* Claude's Aldaba · intro.js · STUB (the cold open is built later)
   Contract: A.intro.play({to}) → Promise that resolves when the intro has handed off (or was skipped).
   It plays once over the same world, then boot.js enters the start view. A.still = no intro. */
(function () {
  'use strict';
  const A = window.A; if (!A) return;
  A.intro = { play: () => Promise.resolve(), skip() {} };
})();
