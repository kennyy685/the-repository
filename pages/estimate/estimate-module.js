/* ================= T52 quick estimate (EstimateScreen) =================
   A porch screen for the HMP App: pick the job, the size and the shape, get a low-high range, text it, save it to
   the lead. No math lives here: prices + rules come from the db doc `system/prices` (hh.py estimate --export-rules)
   and the math from docs/app/estimate.js, pasted as-is inside a wrapper: HMPEstimateMath = {estimate, selfCheck, RULES_VERSION}.
   If selfCheck(rules) finds any miss, the screen hides the estimate and says "Price rules out of date".

   const ctl = EstimateScreen.create({lang, rules, estimate, selfCheck, lead, canSave, save});
     rules     the system/prices doc; undefined = still loading, null = missing (calm "not loaded yet" state)
     estimate  estimate(job, rules) -> {low, high, lines, ...}; throws on a bad job (default HMPEstimateMath.estimate)
     selfCheck selfCheck(rules) -> [] when the JS matches hh.py (default HMPEstimateMath.selfCheck)
     lead      optional {id, address, city, first_name, phone, lang, type, estimate} (opened from a lead)
     canSave   true when this viewer may write leads
     save      optional async (est) => 'saved' | 'queued'; default EstimateScreen.saveToLead(db, lead.id, est)
     db        used by the default save
   ctl.el is the screen's own element: re-append it after a re-render, it keeps its state.
   ctl.setLang(l) · ctl.setRules(r) · ctl.setLead(l) · ctl.setCanSave(b) · ctl.current() · ctl.destroy()
   EstimateScreen.saveToLead(db, leadId, est) writes lead.estimate = {low, high, job, at, using_reference}.
   Nothing here mentions deductibles or says insurance will pay (Nebraska 44-8604). */
const EstimateScreen = (() => {
  'use strict';
  const SUPPORTED_RULES = 1;
  const STR = {
    en: {
      jobH: 'What job?', jobs: {siding: ['Siding', 'vinyl or James Hardie'], roof: ['Roof', 'shingles, tear-off'], gutters: ['Gutters', 'seamless, per foot'], mixed: ['Mixed', 'siding + roof + gutters']},
      mat: {vinyl: 'Vinyl', hardie: 'James Hardie'}, matL: 'Siding type',
      sizeH: 'How big?', modeSq: 'I know the size', modeRough: "I don't know", modeRoughS: 'rough from house size', modeSqS: 'squares / feet',
      siding: ['Siding', 'squares of wall · 100 sq ft each'], roof: ['Roof', 'squares · 100 sq ft each'], gutter: ['Gutters', 'feet along the eaves'],
      foot: ['House footprint', 'ground floor, sq ft · a 40 x 35 house is 1,400'], storiesL: 'Stories',
      roughTag: 'ROUGH', roughOut: (s, r) => [s ? `${s} siding sq` : '', r ? `${r} roof sq` : ''].filter(Boolean).join(' · '),
      roughFrom: (f, n) => `from ${f} sq ft, ${n} ${n === 1 ? 'story' : 'stories'}`, gutterHint: 'Gutters are by the foot: pace the eaves, about the outline of the house.',
      shapeH: 'Roof and walls', pitchL: 'Roof pitch', pitch: {low: 'Low', std: 'Standard', steep: 'Steep'},
      pitchS: (lo, hi) => ({low: `under ${lo}/12`, std: `${lo}-${hi}/12`, steep: `over ${hi}/12`}), layersL: 'Old layers to tear off', layer1: 'normal',
      minus: n => `minus ${n}`, plus: n => `plus ${n}`,
      resEb: 'Estimate range', refT: "Market prices: HMP's own prices not set yet",
      refAll: 'OK to share as an estimate range, never as a final price.',
      refSomeT: "Some prices are market prices, not HMP's", refSome: items => `Market prices for: ${items}. OK to share as an estimate range, never as a final price.`, own: d => `HMP's own prices${d ? ' · updated ' + d : ''}`,
      notFinal: 'Estimate range, not a final price. Final price after we measure and inspect.',
      insFallback: "For insurance jobs, the insurer's approved scope sets the price.",
      roughNote: 'Rough: from the house size. Measure before you give a firm number.',
      math: 'See the math', mkt: 'MARKET', sumItems: 'Items add up to', minRow: 'Minimum job applies', totRow: 'Estimate range', rounded: r => `rounded out to the nearest $${r}`,
      each: 'each', storiesAdd: n => `${n} stories`, steepAdd: 'steep',
      loadingH: 'Loading prices…', loadingP: 'The price sheet is on its way from the app. This takes a second.',
      missingH: 'Prices not loaded yet', missingP: 'The price sheet loads into the app by itself. Nothing for you to do: check back in a little while.',
      versionH: 'Prices need an app update', versionP: 'The price sheet is newer than this screen. Claude Code will update the app; nothing for you to do.',
      staleH: 'Price rules out of date', staleP: "The prices on this screen don't match the price sheet, so no number is shown. Claude Code will fix it; nothing for you to do.",
      needSize: 'Add the size to see a range.', oops: 'This one did not add up. Check the size and try again.',
      what: {siding: (m, q) => `${m} siding · ${q} sq`, roof: q => `Shingle roof · ${q} sq`, gutter: q => `Gutters · ${q} ft`, soffit: q => `Soffit + fascia · ${q} ft`},
      shape: {stories: n => `${n} ${n === 1 ? 'story' : 'stories'}`, pitch: {low: 'low pitch', std: 'standard pitch', steep: 'steep pitch'}, layers: n => `${n} old layers`},
      textH: 'Text this estimate', textLang: 'Text language', open: 'Open in Messages', copy: 'Copy text', copied: 'Copied',
      textNote: 'Your phone opens with the text ready. You press send. If nothing opens, copy it.', copySel: 'Selected: press copy on your phone.',
      saveH: 'Save to lead', saveBtn: 'Save to lead', saving: 'Saving…', saved: 'Saved to the lead.', queued: 'Saved on this phone. It goes out when the signal comes back.',
      saveFail: "Couldn't save. Try again in a moment.", readOnly: "View only: this page can't save to leads.",
      before: (r, d) => `Saved before: ${r}${d ? ' · ' + d : ''}`, lastSaved: (r, d) => `On the lead now: ${r}${d ? ' · ' + d : ''}`,
      peek: 'estimate range', mktShort: 'market prices',
      jobName: {siding: 'Siding', roof: 'Roof', gutters: 'Gutters', mixed: 'Mixed'}
    },
    es: {
      jobH: '¿Qué trabajo?', jobs: {siding: ['Siding', 'vinil o James Hardie'], roof: ['Techo', 'teja, quitar y poner'], gutters: ['Canaletas', 'sin costura, por pie'], mixed: ['Mixto', 'siding + techo + canaletas']},
      mat: {vinyl: 'Vinil', hardie: 'James Hardie'}, matL: 'Tipo de siding',
      sizeH: '¿Qué tamaño?', modeSq: 'Sé el tamaño', modeRough: 'No lo sé', modeRoughS: 'aproximado por la casa', modeSqS: 'cuadros / pies',
      siding: ['Siding', 'cuadros de pared · 100 pies² cada uno'], roof: ['Techo', 'cuadros · 100 pies² cada uno'], gutter: ['Canaletas', 'pies a lo largo del alero'],
      foot: ['Tamaño de la casa', 'planta baja, pies² · una casa de 40 x 35 son 1,400'], storiesL: 'Pisos',
      roughTag: 'APROX.', roughOut: (s, r) => [s ? `${s} cuadros de siding` : '', r ? `${r} cuadros de techo` : ''].filter(Boolean).join(' · '),
      roughFrom: (f, n) => `de ${f} pies², ${n} ${n === 1 ? 'piso' : 'pisos'}`, gutterHint: 'Las canaletas van por pie: mide el alero a pasos, más o menos el contorno de la casa.',
      shapeH: 'Techo y paredes', pitchL: 'Pendiente del techo', pitch: {low: 'Baja', std: 'Normal', steep: 'Alta'},
      pitchS: (lo, hi) => ({low: `menos de ${lo}/12`, std: `${lo}-${hi}/12`, steep: `más de ${hi}/12`}), layersL: 'Capas viejas que quitar', layer1: 'normal',
      minus: n => `menos ${n}`, plus: n => `más ${n}`,
      resEb: 'Rango estimado', refT: 'Precios del mercado: HMP todavía no pone sus propios precios',
      refAll: 'Se puede dar como rango estimado, nunca como precio final.',
      refSomeT: 'Algunos precios son del mercado, no de HMP', refSome: items => `Precios del mercado para: ${items}. Se puede dar como rango estimado, nunca como precio final.`, own: d => `Precios propios de HMP${d ? ' · actualizados ' + d : ''}`,
      notFinal: 'Rango estimado, no es precio final. El precio final después de medir e inspeccionar.',
      insFallback: 'Para trabajos de seguro, el alcance aprobado por la aseguradora fija el precio.',
      roughNote: 'Aproximado: por el tamaño de la casa. Mide antes de dar un número firme.',
      math: 'Ver las cuentas', mkt: 'MERCADO', sumItems: 'Todo suma', minRow: 'Se aplica el trabajo mínimo', totRow: 'Rango estimado', rounded: r => `redondeado a los $${r} más cercanos`,
      each: 'c/u', storiesAdd: n => `${n} pisos`, steepAdd: 'pendiente alta',
      loadingH: 'Cargando precios…', loadingP: 'La lista de precios viene de la app. Tarda un segundo.',
      missingH: 'Los precios todavía no cargan', missingP: 'La lista de precios se carga sola en la app. No tienes que hacer nada: revisa en un rato.',
      versionH: 'Los precios necesitan una actualización', versionP: 'La lista de precios es más nueva que esta pantalla. Claude Code va a actualizar la app; no tienes que hacer nada.',
      staleH: 'Reglas de precios desactualizadas', staleP: 'Los precios de esta pantalla no cuadran con la lista de precios, así que no se muestra ningún número. Claude Code lo arregla; no tienes que hacer nada.',
      needSize: 'Pon el tamaño para ver el rango.', oops: 'Esto no cuadró. Revisa el tamaño y vuelve a intentar.',
      what: {siding: (m, q) => `Siding ${m} · ${q} cuadros`, roof: q => `Techo de teja · ${q} cuadros`, gutter: q => `Canaletas · ${q} pies`, soffit: q => `Sofito + fascia · ${q} pies`},
      shape: {stories: n => `${n} ${n === 1 ? 'piso' : 'pisos'}`, pitch: {low: 'poca pendiente', std: 'pendiente normal', steep: 'pendiente alta'}, layers: n => `${n} capas viejas`},
      textH: 'Mandar este estimado por texto', textLang: 'Idioma del texto', open: 'Abrir en Mensajes', copy: 'Copiar texto', copied: 'Copiado',
      textNote: 'Tu teléfono abre con el texto listo. Tú le das enviar. Si no abre nada, cópialo.', copySel: 'Seleccionado: dale copiar en tu teléfono.',
      saveH: 'Guardar en el prospecto', saveBtn: 'Guardar en el prospecto', saving: 'Guardando…', saved: 'Guardado en el prospecto.', queued: 'Guardado en este teléfono. Se manda cuando vuelva la señal.',
      saveFail: 'No se pudo guardar. Intenta otra vez en un momento.', readOnly: 'Solo lectura: esta página no puede guardar en prospectos.',
      before: (r, d) => `Guardado antes: ${r}${d ? ' · ' + d : ''}`, lastSaved: (r, d) => `En el prospecto ahora: ${r}${d ? ' · ' + d : ''}`,
      peek: 'rango estimado', mktShort: 'precios del mercado',
      jobName: {siding: 'Siding', roof: 'Techo', gutters: 'Canaletas', mixed: 'Mixto'}
    }
  };
  // The homeowner text. Same voice as the app's other texts (EN from Kenny, ES from Alex, "tú"). It always says
  // estimate range, not a final price. No deductible talk, no promise that insurance pays.
  const MSG = {
    en: {hi: n => n ? `Hi ${n}, this is Kenny with HMP Siding & Roofing.` : 'Hi, this is Kenny with HMP Siding & Roofing.',
         range: (p, lo, hi, w, typical) => `Here's an estimate range for ${p}${typical ? ', based on typical local prices' : ''}: ${lo} to ${hi} for ${w}.`, home: 'your home', rough: "It's a rough number from the size of the house.",
         notFinal: "It's an estimate range, not a final price. Final price after we measure and inspect.",
         ins: "For insurance jobs, the insurer's approved scope sets the price.", end: 'Any questions, just text me here.',
         siding: (m, q) => `new ${m === 'hardie' ? 'James Hardie' : 'vinyl'} siding (about ${q} squares)`, roof: q => `a new shingle roof (about ${q} squares)`,
         gutter: q => `new seamless gutters (about ${q} ft)`, soffit: q => `new soffit and fascia (about ${q} ft)`, and: ' and '},
    es: {hi: n => n ? `Hola ${n}, soy Alex de HMP Siding & Roofing.` : 'Hola, soy Alex de HMP Siding & Roofing.',
         range: (p, lo, hi, w, typical) => `Este es un rango estimado para ${p}${typical ? ', según precios típicos de la zona' : ''}: ${lo} a ${hi} por ${w}.`, home: 'tu casa', rough: 'Es un número aproximado por el tamaño de la casa.',
         notFinal: 'Es un rango estimado, no un precio final. El precio final se da después de medir e inspeccionar.',
         ins: 'En trabajos de seguro, el alcance aprobado por la aseguradora fija el precio.', end: 'Cualquier pregunta, escríbeme aquí.',
         siding: (m, q) => `siding nuevo ${m === 'hardie' ? 'James Hardie' : 'de vinil'} (unos ${q} cuadros)`, roof: q => `un techo nuevo de teja (unos ${q} cuadros)`,
         gutter: q => `canaletas nuevas sin costura (unos ${q} pies)`, soffit: q => `sofito y fascia nuevos (unos ${q} pies)`, and: ' y '}
  };
  const STEP = {siding: {step: 1, big: 5, max: 250, dec: 1}, roof: {step: 1, big: 5, max: 250, dec: 1}, gutter: {step: 5, big: 20, max: 2000, dec: 0}, foot: {step: 50, big: 200, max: 12000, dec: 0}};
  const DEFAULTS = {job: 'roof', material: 'vinyl', mode: 'sq', siding: 20, roof: 24, gutter: 140, foot: 1400, stories: 1, pitch: 'std', layers: 1};

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const usd = x => '$' + Math.round(Number(x) || 0).toLocaleString('en-US');
  const n1 = x => String(Math.round(Number(x) * 10) / 10);
  const fmtNum = x => Math.round(Number(x) || 0).toLocaleString('en-US');
  const pct = (lo, hi) => { const a = Math.round(lo * 100), b = Math.round(hi * 100); return a === b ? `+${a}%` : `+${a}-${b}%`; };
  const day = (iso, lang) => { const t = Date.parse(iso); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', {month: 'short', day: 'numeric'}); } catch (e) { return ''; } };
  const listJoin = (a, and) => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + and + a[a.length - 1];

  /* ---------- the one write: lead.estimate ---------- */
  async function saveToLead(db, leadId, est, by){
    if (!db || typeof db.doc !== 'function') throw Object.assign(new Error('no database'), {code: 'offline'});
    if (!leadId || !est || !Number.isFinite(est.low) || !Number.isFinite(est.high)) throw Object.assign(new Error('nothing to save'), {code: 'invalid_argument'});
    const at = est.at || new Date().toISOString();
    // every job key is written (null when unused): update() merges nested objects, so an old footprint can't linger
    const estimate = {low: est.low, high: est.high, job: Object.assign(blankJob(), est.job || {}), at, using_reference: !!est.using_reference};
    return db.doc('leads/' + leadId).update({estimate, updated_at: at, updated_by: by || 'Quick estimate'});
  }
  // the app's outbox as a db handle: EstimateScreen.saveToLead(EstimateScreen.outboxDb(save), id, est)
  const outboxDb = save => ({doc: path => ({update: body => save({op: 'update', path, body}), set: body => save({op: 'set', path, body})})});
  function watchRules(db, cb){
    try { return db.doc('system/prices').onSnapshot(s => cb(s.exists ? s.data() : null), () => cb(null)); }
    catch (e) { cb(null); return () => {}; }
  }
  // one line for the lead sheet: "$10,950 – $13,550 · Roof · Sep 26 · market prices"
  function savedLine(est, lang){
    if (!est || !Number.isFinite(Number(est.low))) return '';
    const T = STR[lang === 'es' ? 'es' : 'en'], job = est.job || {};
    return [`${usd(est.low)} – ${usd(est.high)}`, T.jobName[job.type] || '', job.footprint_sqft ? T.roughTag : '', day(est.at, lang), est.using_reference ? T.mktShort : ''].filter(Boolean).join(' · ');
  }
  // per-case table for a test page: rules.test_cases (real hh.py results) through estimate.js (no math here)
  function runTests(rules, fn){
    const out = [];
    for (const t of (rules && rules.test_cases) || []) {
      let got = null, err = '';
      try { got = fn(t.job, rules); } catch (e) { err = e.message || String(e); }
      const e = t.expect || {}, keys = got ? got.lines.map(l => l.key) : [];
      const ok = !!got && got.low === e.low && got.high === e.high && (e.using_reference == null || got.using_reference === e.using_reference)
        && (!e.line_keys || JSON.stringify(keys) === JSON.stringify(e.line_keys)) && (e.minimum === undefined || ((got.minimum_applied || {}).key || null) === e.minimum);
      out.push({name: t.name || JSON.stringify(t.job), job: t.job, expect: e, got: got && {low: got.low, high: got.high}, ok, err});
    }
    return out;
  }
  function blankJob(){ return {type: null, material: null, siding_squares: null, roof_squares: null, gutter_ft: null, footprint_sqft: null, stories: null, pitch: null, layers: null}; }

  /* ---------- the screen ---------- */
  function create(opts){
    opts = opts || {};
    const el = document.createElement('div'); el.className = 'est';
    let lang = opts.lang === 'es' ? 'es' : 'en', rules = opts.rules, lead = opts.lead || null, canSave = !!opts.canSave;
    const s = Object.assign({}, DEFAULTS, {msgLang: null, mathOpen: false, save: null});
    let result = null, problem = '', io = null, dead = false, copyT = 0;
    const lib = () => (typeof HMPEstimateMath !== 'undefined' ? HMPEstimateMath : {});
    const engine = () => opts.estimate || lib().estimate || null;
    const checker = () => opts.selfCheck || lib().selfCheck || null;
    const wantVersion = () => Number(opts.rulesVersion || lib().RULES_VERSION || SUPPORTED_RULES);
    let checkedRules = null, checkFails = [];   // selfCheck runs once per rules doc, not on every tap
    function checkRules(){
      if (rules === checkedRules) return checkFails;
      checkedRules = rules; const fn = checker();
      try { checkFails = fn ? fn(rules) : []; } catch (e) { checkFails = ['selfCheck: ' + (e.message || e)]; }
      if (checkFails.length && typeof console !== 'undefined') console.warn('[estimate] price rules out of date:', checkFails);
      return checkFails;
    }
    const T = () => STR[lang];

    function prefill(){   // opened from a lead with an estimate on it: start from that job
      const j = lead && lead.estimate && lead.estimate.job; if (!j || !j.type) return;
      s.job = ['siding', 'roof', 'gutters', 'mixed'].includes(j.type) ? j.type : s.job;
      if (j.material === 'hardie' || j.material === 'vinyl') s.material = j.material;
      if (j.footprint_sqft) { s.mode = 'rough'; s.foot = Number(j.footprint_sqft) || s.foot; } else s.mode = 'sq';
      if (j.siding_squares) s.siding = Number(j.siding_squares); if (j.roof_squares) s.roof = Number(j.roof_squares); if (j.gutter_ft) s.gutter = Number(j.gutter_ft);
      if ([1, 2, 3].includes(Number(j.stories))) s.stories = Number(j.stories);
      if (['low', 'std', 'steep'].includes(j.pitch)) s.pitch = j.pitch;
      if ([1, 2, 3].includes(Number(j.layers))) s.layers = Number(j.layers);
    }
    prefill();

    const has = k => ({siding: ['siding', 'mixed'], roof: ['roof', 'mixed'], gutter: ['gutters', 'mixed']}[k].includes(s.job));
    const rough = () => s.mode === 'rough' && s.job !== 'gutters';
    function job(){
      const j = blankJob();
      Object.assign(j, {type: s.job, stories: s.stories, layers: s.layers, pitch: has('roof') || rough() ? s.pitch : 'std',
                        material: has('siding') ? s.material : null});
      if (rough()) j.footprint_sqft = s.foot;
      else { if (has('siding')) j.siding_squares = s.siding; if (has('roof')) j.roof_squares = s.roof; }
      if (has('gutter')) j.gutter_ft = s.gutter;
      return j;
    }
    function compute(){
      result = null; problem = '';
      if (rules === undefined) { problem = 'loading'; return; }
      if (!rules || typeof rules !== 'object' || !rules.prices) { problem = 'missing'; return; }
      if (Number(rules.version) !== wantVersion()) { problem = 'version'; return; }
      const fn = engine(); if (!fn) { problem = 'missing'; return; }
      if (checkRules().length) { problem = 'stale'; return; }
      const j = job();
      const size = rough() ? s.foot : (has('siding') ? s.siding : 0) + (has('roof') ? s.roof : 0) + (has('gutter') ? s.gutter : 0);
      if (!(size > 0)) { problem = 'size'; return; }
      try { result = fn(j, rules); } catch (e) { problem = /needs|more than 0/.test(e.message || '') ? 'size' : 'oops'; result = null; }
    }

    /* pieces */
    const seg = (key, items, cur, label) => `<div class="est-seg" role="group" aria-label="${esc(label)}">${items.map(([v, t, sm]) => `<button type="button" data-k="${key}:${v}" data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${esc(t)}${sm ? `<small>${esc(sm)}</small>` : ''}</button>`).join('')}</div>`;
    function stepper(key, label, sub){
      const c = STEP[key], v = s[key], L = T();
      return `<div class="est-step"><div class="est-what"><b id="est-l-${key}">${esc(label)}</b><span>${esc(sub)}</span></div>
        <div class="est-ctl" role="group" aria-labelledby="est-l-${key}">
          <button type="button" class="big" data-k="${key}:-b" data-step="${key}" data-d="${-c.big}" aria-label="${esc(L.minus(c.big))}" ${v <= 0 ? 'disabled' : ''}>−${c.big}</button>
          <button type="button" data-k="${key}:-" data-step="${key}" data-d="${-c.step}" aria-label="${esc(L.minus(c.step))}" ${v <= 0 ? 'disabled' : ''}>−</button>
          <input id="est-in-${key}" data-k="${key}:in" data-in="${key}" inputmode="decimal" autocomplete="off" value="${esc(c.dec ? n1(v) : fmtNum(v))}" aria-labelledby="est-l-${key}">
          <button type="button" data-k="${key}:+" data-step="${key}" data-d="${c.step}" aria-label="${esc(L.plus(c.step))}">+</button>
          <button type="button" class="big" data-k="${key}:+b" data-step="${key}" data-d="${c.big}" aria-label="${esc(L.plus(c.big))}">+${c.big}</button>
        </div></div>`;
    }
    function whatLine(r){
      const L = T(), q = r.quantities || {}, a = r.adders || {}, parts = [];
      if (q.siding_squares) parts.push(L.what.siding(L.mat[q.material] || '', n1(q.siding_squares)));
      if (q.roof_squares) parts.push(L.what.roof(n1(q.roof_squares)));
      if (q.soffit_ft) parts.push(L.what.soffit(fmtNum(q.soffit_ft)));
      if (q.gutter_ft) parts.push(L.what.gutter(fmtNum(q.gutter_ft)));
      const shape = [L.shape.stories(a.stories || s.stories)];
      if (q.roof_squares) shape.push(L.shape.pitch[a.pitch || s.pitch]);
      if ((a.layers || 1) > 1) shape.push(L.shape.layers(a.layers));
      return parts.join(' + ') + ' · ' + shape.join(', ');
    }
    function priceName(k){ const p = rules && rules.prices && rules.prices[k]; return p ? (p[lang] || p.en || k) : k; }
    function mathHtml(r){
      const L = T(), st = (r.adders && r.adders.stories_all) || {low: 0, high: 0}, n = (r.adders && r.adders.stories) || 1;
      const rows = r.lines.map(l => {
        const why = [];
        if (l.adder && (l.adder.low || l.adder.high)) {
          // the adder is the stories share (every item but the permit) plus the steep share (roof items)
          const byStories = l.key !== 'permit' && (st.low || st.high), steepLo = l.adder.low - (byStories ? st.low : 0), steepHi = l.adder.high - (byStories ? st.high : 0);
          const reasons = [byStories ? L.storiesAdd(n) : '', steepLo > 1e-9 || steepHi > 1e-9 ? L.steepAdd : ''].filter(Boolean);
          why.push(`${pct(l.adder.low, l.adder.high)}${reasons.length ? ' ' + reasons.join(' + ') : ''}`);
        }
        const unit = lang === 'es' ? l.unit_es : l.unit_en;
        const rate = l.rate.low === l.rate.high ? usd(l.rate.low) : `${usd(l.rate.low)}-${usd(l.rate.high)}`;
        const h = l.unit === 'job' ? rate : `${n1(l.qty)} ${unit} × ${rate} ${L.each}`;
        return `<div class="est-line"><span class="n">${esc(l[lang] || l.en)}${l.reference ? `<span class="mk">${esc(L.mkt)}</span>` : ''}</span><span class="a">${esc(usd(l.low))} – ${esc(usd(l.high))}</span><span class="h">${esc([h, ...why].join(' · '))}</span></div>`;
      });
      const sumLo = r.lines.reduce((a, l) => a + l.low, 0), sumHi = r.lines.reduce((a, l) => a + l.high, 0);
      rows.push(`<div class="est-line"><span class="n">${esc(L.sumItems)}</span><span class="a">${esc(usd(sumLo))} – ${esc(usd(sumHi))}</span></div>`);
      const m = r.minimum_applied;
      if (m) rows.push(`<div class="est-line min"><span class="n">${esc(L.minRow)}${m.reference ? `<span class="mk">${esc(L.mkt)}</span>` : ''}</span><span class="a">${esc(usd(m.low))} – ${esc(usd(m.high))}</span><span class="h">${esc(priceName(m.key))}</span></div>`);
      const R = (rules.adders && rules.adders.round_to) || 50;
      rows.push(`<div class="est-line tot"><span class="n">${esc(L.totRow)}</span><span class="a">${esc(usd(r.low))} – ${esc(usd(r.high))}</span><span class="h">${esc(L.rounded(R))}</span></div>`);
      return `<details class="est-math" id="est-math"${s.mathOpen ? ' open' : ''}><summary data-k="math">${esc(L.math)}</summary><div class="est-lines">${rows.join('')}</div></details>`;
    }
    function refBanner(r){
      const L = T();
      if (!r.using_reference) return `<div class="est-own">${esc(L.own(day(rules.updated_at, lang)))}</div>`;
      const allLines = r.lines.every(l => l.reference);
      const sub = allLines ? L.refAll : L.refSome(r.reference_items.map(priceName).join(', '));
      return `<div class="est-ref" role="note"><b>${esc(allLines ? L.refT : L.refSomeT)}</b><span>${esc(sub)}</span></div>`;
    }
    function message(r, ml){
      const M = MSG[ml], q = r.quantities || {}, w = [];
      if (q.siding_squares) w.push(M.siding(q.material, Math.round(q.siding_squares)));
      if (q.roof_squares) w.push(M.roof(Math.round(q.roof_squares)));
      if (q.soffit_ft) w.push(M.soffit(fmtNum(q.soffit_ft)));
      if (q.gutter_ft) w.push(M.gutter(fmtNum(q.gutter_ft)));
      const name = lead && typeof lead.first_name === 'string' ? lead.first_name.trim() : '';
      const place = lead && typeof lead.address === 'string' && lead.address.trim() ? lead.address.trim() : M.home;
      const parts = [M.hi(name), M.range(place, usd(r.low), usd(r.high), listJoin(w, M.and), !!r.using_reference)];
      if (r.rough_squares) parts.push(M.rough);
      parts.push(M.notFinal);
      if (!lead || lead.type !== 'cash') parts.push(M.ins);   // an everyday (cash) job skips the insurance sentence
      parts.push(M.end);
      return parts.join(' ');
    }
    function calm(h, p){ return `<section class="est-calm" data-res="1" role="status"><h3>${esc(h)}</h3>${p ? `<p>${esc(p)}</p>` : ''}</section>`; }

    function render(){
      if (dead) return;
      compute();
      const L = T(), a = document.activeElement, fk = a && el.contains(a) && a.dataset ? a.dataset.k : null;
      const parts = [];
      // 1 · job
      parts.push(`<section class="est-sec"><h3 class="est-h">${esc(L.jobH)}</h3><div class="est-jobs" role="group" aria-label="${esc(L.jobH)}">${['siding', 'roof', 'gutters', 'mixed'].map(j => `<button type="button" class="est-job" data-k="job:${j}" data-set="job" data-v="${j}" aria-pressed="${s.job === j}"><b>${esc(L.jobs[j][0])}</b><span>${esc(L.jobs[j][1])}</span></button>`).join('')}</div>
        ${has('siding') ? `<div class="est-row"><span class="est-lbl">${esc(L.matL)}</span>${seg('material', [['vinyl', L.mat.vinyl], ['hardie', L.mat.hardie]], s.material, L.matL)}</div>` : ''}</section>`);
      // 2 · size
      const sz = [];
      if (s.job !== 'gutters') sz.push(seg('mode', [['sq', L.modeSq, L.modeSqS], ['rough', L.modeRough, L.modeRoughS]], s.mode, L.sizeH));
      const steps = [];
      if (rough()) steps.push(stepper('foot', L.foot[0], L.foot[1]));
      else { if (has('siding')) steps.push(stepper('siding', L.siding[0], L.siding[1])); if (has('roof')) steps.push(stepper('roof', L.roof[0], L.roof[1])); }
      if (has('gutter')) steps.push(stepper('gutter', L.gutter[0], L.gutter[1]));
      sz.push(`<div>${steps.join('')}</div>`);
      if (rough() && result && result.rough_squares) {
        const q = result.quantities || {}, rs = result.rough_squares;
        sz.push(`<div class="est-roughout"><span class="est-tag">${esc(L.roughTag)}</span><b>≈ ${esc(L.roughOut(has('siding') ? n1(q.siding_squares) : '', has('roof') ? n1(q.roof_squares) : ''))}</b><span>${esc(L.roughFrom(fmtNum(rs.footprint_sqft), rs.stories))}</span></div>`);
      }
      if (s.job === 'gutters') sz.push(`<p class="est-hint">${esc(L.gutterHint)}</p>`);
      sz.push(`<div class="est-row"><span class="est-lbl">${esc(L.storiesL)}</span>${seg('stories', [[1, '1'], [2, '2'], [3, '3']], s.stories, L.storiesL)}</div>`);
      parts.push(`<section class="est-sec"><h3 class="est-h">${esc(L.sizeH)}</h3>${sz.join('')}</section>`);
      // 3 · shape (roof pitch, old layers)
      if (s.job !== 'gutters') {
        const sp = rules && rules.adders && rules.adders.steep_pitch, ps = L.pitchS(sp ? sp.low_under : 4, sp ? sp.steep_over : 6), sh = [];
        if (has('roof') || (rough() && has('roof'))) sh.push(`<div class="est-row"><span class="est-lbl">${esc(L.pitchL)}</span>${seg('pitch', ['low', 'std', 'steep'].map(p => [p, L.pitch[p], ps[p]]), s.pitch, L.pitchL)}</div>`);
        sh.push(`<div class="est-row"><span class="est-lbl">${esc(L.layersL)}</span>${seg('layers', [[1, '1', L.layer1], [2, '2'], [3, '3']], s.layers, L.layersL)}</div>`);
        parts.push(`<section class="est-sec"><h3 class="est-h">${esc(L.shapeH)}</h3>${sh.join('')}</section>`);
      }
      // 4 · result
      if (problem === 'loading') parts.push(calm(L.loadingH, L.loadingP));
      else if (problem === 'missing') parts.push(calm(L.missingH, L.missingP));
      else if (problem === 'version') parts.push(calm(L.versionH, L.versionP));
      else if (problem === 'stale') parts.push(calm(L.staleH, L.staleP));
      else if (problem === 'size') parts.push(calm(L.needSize, ''));
      else if (problem === 'oops' || !result) parts.push(calm(L.oops, ''));
      else {
        const r = result, ins = (rules.insurance_note && rules.insurance_note[lang]) || L.insFallback;
        parts.push(`<section class="est-res" data-res="1" aria-live="polite">${refBanner(r)}<div class="est-res-in">
          <div class="est-res-top"><span class="est-lbl">${esc(L.resEb)}</span>${r.rough_squares ? `<span class="est-tag">${esc(L.roughTag)}</span>` : ''}</div>
          <p class="est-range"><span>${esc(usd(r.low))}</span><i>–</i><span>${esc(usd(r.high))}</span></p>
          <p class="est-what-line">${esc(whatLine(r))}</p>
          ${r.rough_squares ? `<p class="est-rough-note">${esc(L.roughNote)}</p>` : ''}
          <p class="est-notfinal">${esc(L.notFinal)}</p>
          <p class="est-ins">${esc(ins)}</p>
          ${mathHtml(r)}</div></section>`);
        // 5 · text it
        const ml = s.msgLang || (lead && (lead.lang === 'es' || lead.language === 'es') ? 'es' : lead && lead.lang === 'en' ? 'en' : lang);
        const text = message(r, ml), num = lead && typeof lead.phone === 'string' ? lead.phone.replace(/[^\d+]/g, '') : '';
        parts.push(`<section class="est-sec"><h3 class="est-h">${esc(L.textH)}</h3>
          <div class="est-row"><span class="est-lbl">${esc(L.textLang)}</span><div class="est-mlang" role="group" aria-label="${esc(L.textLang)}"><button type="button" data-k="ml:en" data-set="msgLang" data-v="en" aria-pressed="${ml === 'en'}" lang="en">English</button><button type="button" data-k="ml:es" data-set="msgLang" data-v="es" aria-pressed="${ml === 'es'}" lang="es">Español</button></div></div>
          <p class="est-msg" id="est-msg" lang="${ml}">${esc(text)}</p>
          <div class="est-acts"><a class="est-btn${lead ? '' : ' go'}" href="sms:${esc(num)}?&amp;body=${encodeURIComponent(text)}">${esc(L.open)}</a><button type="button" class="est-btn" data-k="copy" data-act="copy">${esc(L.copy)}</button></div>
          <p class="est-small">${esc(L.textNote)}</p></section>`);
        // 6 · save to the lead
        if (lead && lead.id) {
          const prev = lead.estimate && Number.isFinite(Number(lead.estimate.low)) ? lead.estimate : null, sv = s.save;
          const status = sv === 'saving' ? `<p class="est-small">${esc(L.saving)}</p>` : sv === 'saved' ? `<p class="est-ok" role="status">${esc(L.saved)}</p>` : sv === 'queued' ? `<p class="est-ok" role="status">${esc(L.queued)}</p>` : sv === 'fail' ? `<p class="est-err" role="alert">${esc(L.saveFail)}</p>` : sv === 'ro' ? `<p class="est-err" role="alert">${esc(L.readOnly)}</p>` : '';
          parts.push(`<section class="est-sec"><h3 class="est-h">${esc(L.saveH)}</h3>
            <div class="est-lead"><b>${esc(lead.address || lead.id)}</b><span>${esc([lead.city, lead.first_name].filter(x => typeof x === 'string' && x.trim()).join(' · '))}</span></div>
            ${prev ? `<p class="est-small">${esc((sv === 'saved' || sv === 'queued' ? L.lastSaved : L.before)(`${usd(prev.low)} – ${usd(prev.high)}`, day(prev.at, lang)))}</p>` : ''}
            ${canSave ? `<div class="est-acts"><button type="button" class="est-btn go" data-k="save" data-act="save" ${sv === 'saving' ? 'disabled' : ''}>${esc(L.saveBtn)} · ${esc(usd(r.low))} – ${esc(usd(r.high))}</button></div>` : `<p class="est-small">${esc(L.readOnly)}</p>`}
            ${status}</section>`);
        }
      }
      // phone: the range stays in sight while scrolling the inputs
      if (result) parts.push(`<button type="button" class="est-peek${result.using_reference ? ' ref' : ''}" data-k="peek" data-act="peek" hidden><span><b>${esc(usd(result.low))} – ${esc(usd(result.high))}</b></span><span>${result.rough_squares ? `<span class="est-tag">${esc(L.roughTag)}</span> ` : ''}${esc(L.peek)} ↓</span></button>`);
      el.innerHTML = parts.join('');
      if (fk) { const n = el.querySelector(`[data-k="${CSS.escape(fk)}"]`); if (n && !n.disabled) n.focus({preventScroll: true}); }
      watchPeek();
    }
    function watchPeek(){
      if (io) { io.disconnect(); io = null; }
      const peek = el.querySelector('.est-peek'), res = el.querySelector('[data-res]');
      if (!peek || !res || typeof IntersectionObserver !== 'function') return;
      io = new IntersectionObserver(es => { for (const e of es) peek.hidden = e.isIntersecting || e.boundingClientRect.bottom < 0; }, {threshold: 0});
      io.observe(res);
    }

    /* events */
    function setVal(key, v){
      const c = STEP[key]; let x = Number(String(v).replace(/[,\s]/g, ''));
      if (!Number.isFinite(x)) x = s[key];
      x = Math.min(c.max, Math.max(0, x)); s[key] = c.dec ? Math.round(x * 10) / 10 : Math.round(x);
      s.save = null; render();
    }
    el.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b || !el.contains(b)) return;
      if (b.dataset.set) {
        const k = b.dataset.set, v = b.dataset.v;
        s[k] = ['stories', 'layers'].includes(k) ? Number(v) : v;
        if (k !== 'msgLang') s.save = null;
        render(); return;
      }
      if (b.dataset.step) { const k = b.dataset.step; setVal(k, (Number(s[k]) || 0) + Number(b.dataset.d)); return; }
      if (b.dataset.act === 'peek') { const r = el.querySelector('[data-res]'); if (r) r.scrollIntoView({block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); return; }
      if (b.dataset.act === 'copy') {
        const p = el.querySelector('#est-msg'); const text = p ? p.textContent : '', L = T();
        const sel = () => { const rg = document.createRange(); rg.selectNodeContents(p); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(rg); b.textContent = L.copySel; };
        const ok = () => { b.textContent = L.copied; clearTimeout(copyT); copyT = setTimeout(() => { if (b.isConnected) b.textContent = T().copy; }, 1600); };
        try { navigator.clipboard.writeText(text).then(ok, sel); } catch (e) { sel(); }
        return;
      }
      if (b.dataset.act === 'save') { doSave(); return; }
    });
    el.addEventListener('change', ev => { const i = ev.target.closest('input[data-in]'); if (i) setVal(i.dataset.in, i.value); });
    el.addEventListener('keydown', ev => { const i = ev.target.closest('input[data-in]'); if (i && ev.key === 'Enter') { ev.preventDefault(); setVal(i.dataset.in, i.value); } });
    el.addEventListener('toggle', ev => { if (ev.target.id === 'est-math') s.mathOpen = ev.target.open; }, true);

    function current(){
      if (!result) return null;
      return {low: result.low, high: result.high, job: job(), at: new Date().toISOString(), using_reference: !!result.using_reference};
    }
    async function doSave(){
      const est = current(); if (!est || !lead || !lead.id || s.save === 'saving') return;
      s.save = 'saving'; render();
      try {
        const how = opts.save ? await opts.save(est, lead) : await saveToLead(opts.db, lead.id, est);
        s.save = how === 'queued' ? 'queued' : 'saved';
        lead = Object.assign({}, lead, {estimate: est});
      } catch (e) {
        const refused = e && ['invalid_argument', 'not_granted', 'revoked'].includes(e.code);
        s.save = refused ? 'ro' : 'fail'; if (refused) canSave = false;
      }
      render();
    }

    render();
    return {
      el,
      setLang(l){ lang = l === 'es' ? 'es' : 'en'; render(); },
      setRules(r){ rules = r; render(); },
      setLead(l){ const changed = !lead || !l || l.id !== lead.id; lead = l || null; if (changed) { s.save = null; s.msgLang = null; prefill(); } render(); },
      setCanSave(b){ canSave = !!b; render(); },
      current,
      problem: () => problem,
      selfCheckFails: () => checkFails.slice(),
      destroy(){ dead = true; if (io) io.disconnect(); el.remove(); }
    };
  }

  return {create, saveToLead, outboxDb, watchRules, savedLine, runTests, STR, SUPPORTED_RULES};
})();
if (typeof window !== 'undefined') window.EstimateScreen = EstimateScreen;
