/* HMP App icon set (v25): one family, 24x24 grid, 1.75 stroke, round caps/joins, no fills except tiny dots.
   Use: <svg class="i"><use href="#i-door"/></svg>. The builder pastes the <symbol>s into the app once. */
(function () {
  const I = {
    pin: '<path d="M12 21s-6.5-5.8-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    door: '<path d="M6.5 20.5V4.8c0-.7.6-1.3 1.3-1.3h8.4c.7 0 1.3.6 1.3 1.3v15.7"/><path d="M4 20.5h16"/><circle cx="14.6" cy="12.2" r=".9" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    leads: '<path d="M9 6.5h11M9 12h11M9 17.5h7"/><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" stroke-width="2.6"/>',
    money: '<path d="M12 3.5v17"/><path d="M16.3 7.6c-.8-1.2-2.3-1.9-4.3-1.9-2.5 0-4.3 1.2-4.3 3 0 4.2 8.8 2.2 8.8 6.4 0 1.9-1.9 3.1-4.5 3.1-2.1 0-3.8-.8-4.6-2.2"/>',
    mic: '<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"/>',
    phone: '<path d="M5.2 3.8h3.2l1.6 4.1-2.1 1.3a10.8 10.8 0 0 0 5.9 5.9l1.3-2.1 4.1 1.6v3.2c0 .9-.7 1.6-1.6 1.5C10.3 18.9 5.1 13.7 4.6 6.4c-.1-.9.6-1.6 1.5-1.6z"/>',
    text: '<path d="M4 6.2c0-1 .8-1.7 1.7-1.7h12.6c1 0 1.7.8 1.7 1.7v8.6c0 1-.8 1.7-1.7 1.7H9.5L5 20v-3.5c-.6-.2-1-.8-1-1.5z"/>',
    say: '<path d="M4 6.2c0-1 .8-1.7 1.7-1.7h12.6c1 0 1.7.8 1.7 1.7v8.6c0 1-.8 1.7-1.7 1.7H9.5L5 20v-3.5c-.6-.2-1-.8-1-1.5z"/><path d="M8 9h8M8 12.3h5"/>',
    nav: '<path d="M4 11.2 20 4l-7.2 16-1.9-6.9z"/>',
    car: '<path d="M5 17v-4.5L6.8 7.6c.2-.6.8-1.1 1.5-1.1h7.4c.7 0 1.3.5 1.5 1.1L19 12.5V17"/><path d="M3.5 17h17M5 12.5h14"/><path d="M6 17v2M18 17v2"/><path d="M8 14.8h.01M16 14.8h.01" stroke-width="2.4"/>',
    camera: '<path d="M4 8.7c0-.8.7-1.5 1.5-1.5H8l1.5-2.4h5L16 7.2h2.5c.8 0 1.5.7 1.5 1.5v9.1c0 .8-.7 1.5-1.5 1.5h-13c-.8 0-1.5-.7-1.5-1.5z"/><circle cx="12" cy="13" r="3.4"/>',
    x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    check: '<path d="m5 12.6 4.3 4.3L19 7.4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.6V12l2.9 1.9"/>',
    cal: '<rect x="4" y="5.2" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3.3v3.6M15.5 3.3v3.6"/>',
    hail: '<path d="M7.2 15.2a4 4 0 0 1-.5-8 5.4 5.4 0 0 1 10.4 1 3.5 3.5 0 0 1 .2 7z"/><path d="M8.5 18.6h.01M12 20.3h.01M15.5 18.6h.01" stroke-width="2.6"/>',
    home: '<path d="M4 11.2 12 4.5l8 6.7"/><path d="M6.2 9.6v10h11.6v-10"/><path d="M10.2 19.6v-5h3.6v5"/>',
    built: '<path d="M4 20h16"/><path d="M6 20V9l6-4.5L18 9v11"/><path d="M10 13h4"/>',
    key: '<circle cx="8.5" cy="12" r="3.8"/><path d="M12.3 12H20M17 12v3M20 12v2"/>',
    chev: '<path d="m9.5 6 6 6-6 6"/>',
    chevd: '<path d="m6 9.5 6 6 6-6"/>',
    more: '<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="2.8"/>',
    flag: '<path d="M5.5 21V4.2M5.5 4.5h11.2l-2.2 4 2.2 4H5.5"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.2"/><path d="M12 7.8h.01" stroke-width="2.4"/>',
    star: '<path d="m12 4.2 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.6 7.2 19.1l.9-5.4-3.9-3.8 5.4-.8z"/>',
    ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
    shield: '<path d="M12 3.5 5.5 6v5.3c0 4.3 2.8 7.6 6.5 9.2 3.7-1.6 6.5-4.9 6.5-9.2V6z"/><path d="m9.2 12.2 2 2 3.8-3.9"/>',
    skip: '<path d="M6 6.5v11l8-5.5z"/><path d="M17.5 6.5v11"/>',
    user: '<circle cx="12" cy="8.3" r="3.8"/><path d="M4.8 20c.8-3.6 3.7-5.6 7.2-5.6s6.4 2 7.2 5.6"/>',
    file: '<path d="M6.5 3.8h7.3l3.7 3.7v12.7h-11z"/><path d="M13.5 3.8v4h4M9 12.5h6M9 16h4"/>',
    clip: '<rect x="5.5" y="4.5" width="13" height="16" rx="2"/><path d="M9 4.5V3.3h6v1.2M9 10h6M9 13.5h6M9 17h3.5"/>',
    pen: '<path d="M4.5 19.5 5.6 15 15.8 4.8a2 2 0 0 1 2.8 2.8L8.4 17.8z"/><path d="M13.8 6.8l2.8 2.8"/>',
    hammer: '<path d="M13.4 6.3 17.7 10.6M11 8.7l-6.7 6.7a1.8 1.8 0 0 0 2.6 2.6l6.7-6.7"/><path d="M12.2 4.7l3.1-1.2 5.2 5.2-1.2 3.1-2.2-.3-5.2-5.2z"/>',
    bank: '<path d="M3.8 9.2 12 4.5l8.2 4.7"/><path d="M5.5 10v7.5M9.8 10v7.5M14.2 10v7.5M18.5 10v7.5M3.8 20h16.4"/>',
    check2: '<circle cx="12" cy="12" r="8.5"/><path d="m8.3 12.3 2.5 2.5 5-5.1"/>',
    locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4"/>',
    layers: '<path d="m12 4 8.5 4.5L12 13 3.5 8.5z"/><path d="m3.5 12.4 8.5 4.5 8.5-4.5M3.5 16.2 12 20.7l8.5-4.5"/>',
    sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3"/>',
    moon: '<path d="M19.5 14.3A7.8 7.8 0 0 1 9.7 4.5a7.8 7.8 0 1 0 9.8 9.8z"/>',
    send: '<path d="M5 12 19.5 5l-4.8 14.5-3-6z"/><path d="m11.7 13.5 7.8-8.5"/>',
    list: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
    map: '<path d="M9 4.5 3.8 6.5v13L9 17.5l6 2 5.2-2v-13L15 6.5z"/><path d="M9 4.5v13M15 6.5v13"/>',
    swap: '<path d="M7 7.5h11.5l-3-3M17 16.5H5.5l3 3"/>',
    alert: '<path d="M12 4.2 20.5 19H3.5z"/><path d="M12 10v4"/><path d="M12 16.6h.01" stroke-width="2.4"/>',
    photo: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 17.5 5-4.5 3.5 3 2.5-2 4 3.5"/>',
    note: '<path d="M5.5 4.5h13v11l-4 4h-9z"/><path d="M14.5 19.5v-4h4M9 9h6M9 12.5h4"/>'
  };
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0" aria-hidden="true">' +
    Object.entries(I).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join('') + '</svg>';
  document.body.insertAdjacentHTML('afterbegin', svg);
  // mockup states from the #hash: dark, light, es, loading, empty, late (joined with "-", e.g. #dark-empty)
  const h = (location.hash || '').slice(1).split('-');
  if (h.includes('dark')) document.documentElement.setAttribute('data-theme', 'dark');
  if (h.includes('light')) document.documentElement.setAttribute('data-theme', 'light');
  ['es', 'loading', 'empty', 'late'].forEach(k => document.documentElement.classList.toggle('st-' + k, h.includes(k)));
  window.addEventListener('hashchange', () => location.reload());
})();
