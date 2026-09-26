/* HMP App layout mockups (T75): tabs, sheets, EN/ES, door taps. Static, no data. */
(function(){
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const phone = $('.phone');
  function go(id){
    $$('.scr', phone).forEach(s => s.classList.toggle('on', s.id === id));
    $$('[data-go]', phone).forEach(b => { if (b.closest('.nav') || b.closest('.modes')) b.classList.toggle('on', (b.dataset.group || b.dataset.go).split(' ').includes(id)); });
    const s = $('#' + id); if (s) s.scrollTop = 0;
    $$('[data-show-on]', phone).forEach(e => { e.style.display = e.dataset.showOn.split(' ').includes(id) ? '' : 'none'; });
    $$('[data-hide-on]', phone).forEach(e => { e.style.display = e.dataset.hideOn.split(' ').includes(id) ? 'none' : ''; });
  }
  function sheet(id){ $$('.sheet', phone).forEach(s => s.classList.toggle('on', s.id === id)); }
  let lang = 'en';
  function setLang(l){
    lang = l;
    $$('[data-es]').forEach(e => { if (e.dataset.en === undefined) e.dataset.en = e.innerHTML; e.innerHTML = l === 'es' ? e.dataset.es : e.dataset.en; });
    $$('.lang button').forEach(b => b.classList.toggle('on', b.dataset.l === l));
    document.documentElement.lang = l;
  }
  let tt = 0;
  function toast(msg){ const t = $('.toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1400); }
  phone.addEventListener('click', ev => {
    const g = ev.target.closest('[data-go]'); if (g) { sheet(null); go(g.dataset.go); return; }
    const sh = ev.target.closest('[data-sheet]'); if (sh) { sheet(sh.dataset.sheet); return; }
    if (ev.target.closest('[data-close]') || ev.target.classList.contains('sheet')) { sheet(null); return; }
    const l = ev.target.closest('.lang button'); if (l) { setLang(l.dataset.l); return; }
    const d = ev.target.closest('.d4 button'); if (d) {
      $$('button', d.parentNode).forEach(b => b.classList.remove('tapped')); d.classList.add('tapped');
      toast((lang === 'es' ? 'Guardado · ' : 'Saved · ') + d.firstChild.textContent.trim() + (lang === 'es' ? ' · Deshacer' : ' · Undo'));
      return;
    }
    const s = ev.target.closest('.seg button'); if (s) { $$('button', s.parentNode).forEach(b => b.classList.remove('on')); s.classList.add('on'); return; }
    const c = ev.target.closest('.chk i'); if (c) { c.classList.toggle('y'); return; }
    const f = ev.target.closest('[data-flip]'); if (f) { setLang(lang === 'en' ? 'es' : 'en'); return; }
  });
  const q = new URLSearchParams(location.search);
  go(q.get('s') || $('.scr').id);
  if (q.get('l') === 'es') setLang('es');
  if (q.get('sh')) sheet(q.get('sh'));
})();
