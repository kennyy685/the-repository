/* Aldaba desktop mockups: shared sample data, EN/ES words, the drawn maps and the view/lang/theme switches.
   SAMPLE DATA ONLY (made-up addresses on real Fremont street names; no owner names, per CLAUDE.md). Money is "$ —"
   everywhere on purpose: the boss's price sheet is pending. URL: #now | #knock | #job, ?lang=es, ?theme=light. */
(function () {
  const W = window;
  const L = {
    en: {
      now: 'Now', knock: 'Knock', pipeline: 'Pipeline', jobs: 'Jobs', money: 'Money', calls: 'Calls', leads: 'Leads',
      search: 'Search doors, leads, jobs…', today: 'Sun, Sep 27', storm: 'Storm Watch 6:54 AM · 5 hot zones',
      hotZones: 'Hot zones', bestZone: 'Best zone today', startKnock: 'Start knocking', drive: 'Drive',
      hail: 'hail', homes: 'homes', mi: 'mi', away: 'away', doorsLeft: 'doors left', stormOn: 'Storm',
      oldRoofs: 'Older roofs, most homes owner-lived', rank: 'Rank', zone: 'Zone', score: 'Score',
      pipe: 'Pipeline', pipeVal: 'Pipeline value', pricesPending: 'Prices pending', open: 'open',
      nextActions: 'Next actions', due: 'Due today', seeAll: 'See all',
      walk: 'Ranked walk', of: 'of', knocked: 'knocked', talked: 'talked', insp: 'inspections set',
      doorNow: 'At this door', sayFirst: 'Say first (69-1602): your name · HMP Siding & Roofing · roofing and siding',
      noAnswer: 'No answer', talkedB: 'Talked', setInsp: 'Set inspection', notInt: 'Not interested', noKnock: 'Do not knock', more: 'more', inspSet: 'Inspection set',
      built: 'Built', roof: 'Roof age', ownerLived: 'Owner-lived', recentSale: 'Sold', yrs: 'yrs', why: 'Why this door',
      nextDoor: 'Next door', photos: 'Photos', note: 'Note', walked: 'Walked',
      job: 'Job', insurance: 'Insurance', cash: 'Cash', roofGut: 'Roof + gutters', step: 'Step', of10: 'of 10',
      tracker: 'Job tracker', papers: 'Papers', moneyH: 'Money', timeline: 'Timeline', nextStep: 'Next step',
      jobValue: 'Job value', acv: 'First check (ACV)', dep: 'Depreciation check', deduct: 'Deductible · paid by homeowner', comm: 'Your commission',
      adjMeet: 'Meet the adjuster', adjWhen: 'Tue, Sep 29 · 10:00 AM', addCal: 'Add to calendar', openMap: 'Directions',
      p1: 'Inspection photos + measurements', p2: '3-day cancel form, EN + ES (69-1604)', p3: 'Itemized description to homeowner + insurer (44-8606)', p4: 'Signed contract', p5: 'Certificate of completion',
      signedOn: 'Signed Sep 25', sentOn: 'Sent Sep 26', needed: 'Needed before work', later: 'Later',
      stageNew: 'New', stageInsp: 'Inspected', stageSigned: 'Signed', stageProd: 'In production', stagePaid: 'Paid',
      legalBox: 'Homeowner files their own claim. HMP documents damage and meets the adjuster. No deductible help of any kind (44-8604).',
      registered: 'Registered NE contractor #', sample: 'Sample data · prices pending',
      week: 'This week', doors: 'Doors', convos: 'Talks', inspections: 'Inspections', signed: 'Signed',
      filterAll: 'All', filterIns: 'Insurance', filterCash: 'Cash', sortBy: 'Sorted by next due',
      address: 'Address', stage: 'Stage', value: 'Value', next: 'Next', leadToJob: 'Lead to signed job',
      calls3: 'calls', insp2: 'inspections', adj1: 'adjuster', today2: 'Today', lead: 'Lead', town: 'Town',
      openJob: 'Open job', back: 'Back', from: 'from Fremont', walkIn: 'Walk in zone 1', mapHint: 'Click a zone to see its walk'
    },
    es: {
      now: 'Ahora', knock: 'Tocar', pipeline: 'Embudo', jobs: 'Trabajos', money: 'Dinero', calls: 'Llamadas', leads: 'Prospectos',
      search: 'Buscar puertas, clientes, trabajos…', today: 'dom, 27 sep', storm: 'Vigía de tormentas 6:54 AM · 5 zonas',
      hotZones: 'Zonas calientes', bestZone: 'Mejor zona hoy', startKnock: 'Empezar a tocar', drive: 'Manejar',
      hail: 'granizo', homes: 'casas', mi: 'mi', away: 'de distancia', doorsLeft: 'puertas faltan', stormOn: 'Tormenta',
      oldRoofs: 'Techos viejos, casi todos viven los dueños', rank: 'Lugar', zone: 'Zona', score: 'Puntos',
      pipe: 'Embudo', pipeVal: 'Valor del embudo', pricesPending: 'Precios pendientes', open: 'abiertos',
      nextActions: 'Lo que sigue', due: 'Para hoy', seeAll: 'Ver todo',
      walk: 'Recorrido', of: 'de', knocked: 'tocadas', talked: 'hablaron', insp: 'inspecciones',
      doorNow: 'En esta puerta', sayFirst: 'Di primero (69-1602): tu nombre · HMP Siding & Roofing · techos y siding',
      noAnswer: 'No abrió', talkedB: 'Hablamos', setInsp: 'Agendar inspección', notInt: 'No le interesa', noKnock: 'No tocar', more: 'más', inspSet: 'Inspección',
      built: 'Construida', roof: 'Edad del techo', ownerLived: 'Vive el dueño', recentSale: 'Vendida', yrs: 'años', why: 'Por qué esta puerta',
      nextDoor: 'Siguiente puerta', photos: 'Fotos', note: 'Nota', walked: 'Caminado',
      job: 'Trabajo', insurance: 'Seguro', cash: 'Contado', roofGut: 'Techo + canaletas', step: 'Paso', of10: 'de 10',
      tracker: 'Seguimiento', papers: 'Papeles', moneyH: 'Dinero', timeline: 'Historial', nextStep: 'Siguiente paso',
      jobValue: 'Valor del trabajo', acv: 'Primer cheque (ACV)', dep: 'Cheque de depreciación', deduct: 'Deducible · lo paga el dueño', comm: 'Tu comisión',
      adjMeet: 'Cita con el ajustador', adjWhen: 'mar, 29 sep · 10:00 AM', addCal: 'Al calendario', openMap: 'Cómo llegar',
      p1: 'Fotos de inspección + medidas', p2: 'Aviso de cancelación de 3 días, EN + ES (69-1604)', p3: 'Descripción detallada al dueño + aseguradora (44-8606)', p4: 'Contrato firmado', p5: 'Certificado de terminado',
      signedOn: 'Firmado 25 sep', sentOn: 'Enviado 26 sep', needed: 'Antes de trabajar', later: 'Después',
      stageNew: 'Nuevos', stageInsp: 'Inspeccionados', stageSigned: 'Firmados', stageProd: 'En producción', stagePaid: 'Pagados',
      legalBox: 'El dueño presenta su propio reclamo. HMP documenta el daño y se reúne con el ajustador. Nada de ayuda con el deducible (44-8604).',
      registered: 'Contratista registrado en NE #', sample: 'Datos de ejemplo · precios pendientes',
      week: 'Esta semana', doors: 'Puertas', convos: 'Pláticas', inspections: 'Inspecciones', signed: 'Firmados',
      filterAll: 'Todos', filterIns: 'Seguro', filterCash: 'Contado', sortBy: 'Por fecha',
      address: 'Dirección', stage: 'Etapa', value: 'Valor', next: 'Sigue', leadToJob: 'De cliente a trabajo firmado',
      calls3: 'llamadas', insp2: 'inspecciones', adj1: 'ajustador', today2: 'Hoy', lead: 'Cliente', town: 'Pueblo',
      openJob: 'Abrir trabajo', back: 'Atrás', from: 'desde Fremont', walkIn: 'Recorrido zona 1', mapHint: 'Toca una zona para ver su recorrido'
    }
  };
  const ZONES = [
    {id: 1, name: 'N Clarkson St & E 9th St', town: 'Fremont', hail: '1.75', homes: 64, dist: '0.8', storm: 'Sep 24', score: 96, x: 570, y: 200},
    {id: 2, name: 'N Linden Ave & 16th St', town: 'Fremont', hail: '1.50', homes: 48, dist: '1.4', storm: 'Sep 24', score: 91, x: 760, y: 320},
    {id: 3, name: 'N Nye Ave & 23rd St', town: 'Fremont', hail: '1.25', homes: 71, dist: '2.1', storm: 'Sep 24', score: 84, x: 330, y: 110},
    {id: 4, name: 'Main St & 5th St', town: 'Hooper', hail: '1.00', homes: 38, dist: '14', storm: 'Sep 21', score: 72, x: 890, y: 120},
    {id: 5, name: '3rd St & Elm St', town: 'Arlington', hail: '1.00', homes: 29, dist: '19', storm: 'Sep 21', score: 66, x: 880, y: 470}
  ];
  const DOORS = [
    {n: 1, addr: '1402 N Clarkson St', built: 1958, roof: 22, owner: 1, sold: '', s: 'talk'},
    {n: 2, addr: '1410 N Clarkson St', built: 1961, roof: 21, owner: 1, sold: '', s: 'na'},
    {n: 3, addr: '1418 N Clarkson St', built: 1957, roof: 24, owner: 1, sold: '', s: 'insp'},
    {n: 4, addr: '1426 N Clarkson St', built: 1962, roof: 19, owner: 1, sold: '', s: 'next'},
    {n: 5, addr: '1434 N Clarkson St', built: 1959, roof: 23, owner: 1, sold: '2024', s: ''},
    {n: 6, addr: '1442 N Clarkson St', built: 1964, roof: 18, owner: 1, sold: '', s: ''},
    {n: 7, addr: '1503 N Clarkson St', built: 1955, roof: 25, owner: 1, sold: '', s: ''},
    {n: 8, addr: '1511 N Clarkson St', built: 1960, roof: 20, owner: 0, sold: '', s: ''},
    {n: 9, addr: '1519 N Clarkson St', built: 1963, roof: 17, owner: 1, sold: '2023', s: ''},
    {n: 10, addr: '941 E 9th St', built: 1956, roof: 22, owner: 1, sold: '', s: ''},
    {n: 11, addr: '953 E 9th St', built: 1958, roof: 21, owner: 1, sold: '', s: ''},
    {n: 12, addr: '1005 E 9th St', built: 1966, roof: 16, owner: 1, sold: '', s: ''}
  ];
  const STAGES = [
    {k: 'new', t: 'stageNew', count: 23}, {k: 'insp', t: 'stageInsp', count: 9}, {k: 'signed', t: 'stageSigned', count: 4},
    {k: 'prod', t: 'stageProd', count: 2}, {k: 'paid', t: 'stagePaid', count: 1}
  ];
  const X = (en, es) => ({en, es});
  const PIPE = {
    new: [
      {a: '1802 N Clarkson St', type: 'ins', next: X('Call back to set the inspection', 'Llamar para agendar la inspección'), due: 'today', src: X('Storm', 'Tormenta')},
      {a: '2210 N Nye Ave', type: 'cash', next: X('Estimate visit Wed 5:30 PM', 'Presupuesto mié 5:30 PM'), due: 'wed', src: X('Old house', 'Casa vieja')},
      {a: '1426 N Clarkson St', type: 'ins', next: X('Knock again after 5 PM', 'Volver a tocar después de 5 PM'), due: 'today', src: X('Storm', 'Tormenta')}
    ],
    insp: [
      {a: '615 N Linden Ave', type: 'ins', next: X('Inspection today 4:00 PM', 'Inspección hoy 4:00 PM'), due: 'today', src: X('Storm', 'Tormenta')},
      {a: '1418 N Irving St', type: 'ins', next: X('Adjuster meeting Tue 10:00 AM', 'Cita con ajustador mar 10:00 AM'), due: 'tue', src: X('Storm', 'Tormenta')},
      {a: '720 E 16th St', type: 'ins', next: X('Homeowner files claim (their call)', 'El dueño presenta el reclamo (le toca a él)'), due: 'wait', src: X('Referral', 'Referido')}
    ],
    signed: [
      {a: '941 E 9th St', type: 'ins', next: X('Send itemized description to homeowner + insurer', 'Mandar descripción detallada al dueño + aseguradora'), due: 'today', src: X('Storm', 'Tormenta')},
      {a: '1150 N Park Ave', type: 'cash', next: X('Cancel window ends Thu. No work before.', 'La cancelación vence el jue. Nada de trabajo antes.'), due: 'thu', src: X('Old house', 'Casa vieja')}
    ],
    prod: [
      {a: '330 W 11th St', type: 'ins', next: X('Materials arrive Tue', 'El material llega el mar'), due: 'tue', src: X('Storm', 'Tormenta')}
    ],
    paid: [
      {a: '2044 N Broad St', type: 'ins', next: X('Ask for a review + yard sign OK', 'Pedir reseña + permiso de letrero'), due: 'today', src: X('Storm', 'Tormenta')}
    ]
  };
  const ACTIONS = [
    {time: '10:30', ic: 'phone', t: X('Call back to set the inspection', 'Llamar para agendar la inspección'), a: '1802 N Clarkson St', late: 1},
    {time: '1:00', ic: 'send', t: X('Send itemized description to homeowner + insurer', 'Mandar descripción detallada al dueño + aseguradora'), a: '941 E 9th St'},
    {time: '4:00', ic: 'ruler', t: X('Inspection · bring the ladder', 'Inspección · llevar la escalera'), a: '615 N Linden Ave'},
    {time: '5:30', ic: 'door', t: X('Knock again, no answer at noon', 'Volver a tocar, no abrió al mediodía'), a: '1426 N Clarkson St'},
    {time: 'Tue', ic: 'user', t: X('Meet the adjuster', 'Cita con el ajustador'), a: '1418 N Irving St'}
  ];
  const STEPS = ['inspected', 'claim_filed', 'adjuster_set', 'scope_in', 'signed', 'supplement', 'materials_ordered', 'installed', 'depreciation_requested', 'paid'];
  const STEPN = {
    inspected: X('Inspected', 'Inspeccionado'), claim_filed: X('Claim filed', 'Reclamo presentado'), adjuster_set: X('Adjuster set', 'Ajustador agendado'),
    scope_in: X('Scope in', 'Alcance recibido'), signed: X('Signed', 'Contrato firmado'), supplement: X('Supplement', 'Suplemento'),
    materials_ordered: X('Materials ordered', 'Material pedido'), installed: X('Installed', 'Instalado'),
    depreciation_requested: X('Depreciation requested', 'Depreciación pedida'), paid: X('Paid', 'Pagado')
  };
  const STEPD = ['Sep 25', 'Sep 26', 'Sep 29', '', '', '', '', '', '', ''];
  const JOB = {a: '1418 N Irving St', town: 'Fremont, NE 68025', cur: 2};
  const TL = [
    {d: 'Sep 29', t: X('Adjuster meeting set · 10:00 AM', 'Cita con ajustador · 10:00 AM'), ic: 'cal'},
    {d: 'Sep 26', t: X('Homeowner filed claim with their insurer', 'El dueño presentó el reclamo con su aseguradora'), ic: 'file'},
    {d: 'Sep 25', t: X('Inspection: 24 photos, hail hits on 3 slopes, gutters dented', 'Inspección: 24 fotos, granizo en 3 aguas, canaletas golpeadas'), ic: 'camera'},
    {d: 'Sep 25', t: X('3-day cancel form signed, EN + ES', 'Aviso de cancelación firmado, EN + ES'), ic: 'pen'},
    {d: 'Sep 24', t: X('Knocked · zone 1 walk, door 3', 'Tocado · recorrido zona 1, puerta 3'), ic: 'door'}
  ];

  let lang = 'en';
  const T = k => (L[lang][k] != null ? L[lang][k] : L.en[k] || k);
  const tx = o => (o && typeof o === 'object' ? o[lang] || o.en : o);
  const ic = (n, c) => (W.HMPIcons ? W.HMPIcons.svg(n, c) : '');
  const MONEY = '<span class="ph" title="Prices pending">$ —</span>';
  const MARK = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 19 24 8 39 19" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="17" r="3" fill="currentColor"/><circle cx="24" cy="31.5" r="10" fill="none" stroke="#f5883a" stroke-width="5"/></svg>';

  /* ---- the drawn city map (hot zones) ---- */
  function cityMap(opt) {
    opt = opt || {};
    const w = 1000, h = 620, pick = opt.pick || 1, fs = opt.fs || 12, vb = opt.vb || `0 0 ${w} ${h}`;
    let s = `<svg class="map" viewBox="${vb}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-label="Map of hot zones"><defs>`;
    ZONES.forEach(z => { s += `<radialGradient id="hz${z.id}"><stop offset="0" stop-color="rgb(var(--heat))" stop-opacity="${(z.score - 50) / 100}"/><stop offset=".55" stop-color="rgb(var(--heat))" stop-opacity="${(z.score - 50) / 260}"/><stop offset="1" stop-color="rgb(var(--heat))" stop-opacity="0"/></radialGradient>`; });
    s += `</defs><rect width="${w}" height="${h}" fill="var(--map-land)"/>`;
    for (let x = -20; x < w; x += 58) for (let y = -10; y < h; y += 44) s += `<rect x="${x + 4}" y="${y + 4}" width="50" height="36" rx="3" fill="var(--map-lot)"/>`;
    s += `<path d="M0 548 C160 520 300 575 470 556 S780 520 1000 560 L1000 620 L0 620Z" fill="var(--map-water)"/>`;
    s += `<rect x="512" y="318" width="120" height="84" rx="6" fill="var(--map-park)"/>`;
    for (let x = -20; x < w; x += 58) s += `<path d="M${x + 2} 0V${h}" stroke="var(--map-street)" stroke-width="2.5"/>`;
    for (let y = -10; y < h; y += 44) s += `<path d="M0 ${y + 2}H${w}" stroke="var(--map-street)" stroke-width="2.5"/>`;
    s += `<path d="M0 312 L1000 268" stroke="var(--map-major)" stroke-width="11"/><path d="M458 0 L470 620" stroke="var(--map-major)" stroke-width="9"/>`;
    s += `<text x="24" y="300" font-size="${fs - 1}" font-family="Geist,sans-serif" fill="var(--map-label)" transform="rotate(-2.5 24 300)">Military Ave</text>`;
    s += `<text x="478" y="40" font-size="${fs - 1}" font-family="Geist,sans-serif" fill="var(--map-label)" transform="rotate(88 478 40)">N Broad St</text>`;
    s += `<text x="40" y="596" font-size="${fs - 1}" font-family="Geist,sans-serif" fill="var(--map-label)" font-style="italic">Platte River</text>`;
    ZONES.forEach(z => { const r = 60 + z.homes * 1.4; s += `<ellipse cx="${z.x}" cy="${z.y}" rx="${r * 1.2}" ry="${r}" fill="url(#hz${z.id})"/>`; });
    ZONES.forEach(z => {
      const on = z.id === pick;
      s += `<g class="zpin" data-zone="${z.id}" style="cursor:pointer">`;
      if (on) s += `<circle cx="${z.x}" cy="${z.y}" r="26" fill="none" stroke="#f5883a" stroke-opacity=".35" stroke-width="10"/>`;
      s += `<circle cx="${z.x}" cy="${z.y}" r="${on ? 15 : 12}" fill="${on ? '#f5883a' : 'var(--card)'}" stroke="${on ? '#1b1206' : 'var(--line-2)'}" stroke-width="1.5"/>`;
      s += `<text x="${z.x}" y="${z.y + 4.5}" text-anchor="middle" font-size="${on ? 14 : 12}" font-weight="700" font-family="Bricolage Grotesque,Geist,sans-serif" fill="${on ? '#1b1206' : 'var(--ink)'}">${z.id}</text>`;
      if (opt.labels !== false) s += `<text x="${z.x + 22}" y="${z.y - 12}" font-size="${fs}" font-weight="600" font-family="Geist,sans-serif" fill="var(--ink)" paint-order="stroke" stroke="var(--map-land)" stroke-width="${fs / 3}">${z.town === 'Fremont' ? z.name : z.town} · ${z.hail}″</text>`;
      s += `</g>`;
    });
    s += `<g><circle cx="470" cy="330" r="7" fill="var(--you)" stroke="#fff" stroke-width="2.5"/><circle cx="470" cy="330" r="16" fill="var(--you)" opacity=".18"/></g>`;
    return s + `</svg>`;
  }

  /* ---- the drawn walk map (one zone, doors + route) ---- */
  function walkMap(opt) {
    opt = opt || {};
    const w = 1000, h = 800, cur = opt.cur || 4;
    const cols = [-60, 200, 460, 720, 980, 1240], rows = [-160, 100, 360, 620, 880];
    let s = `<svg class="map" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-label="Walk map"><defs><radialGradient id="wh"><stop offset="0" stop-color="rgb(var(--heat))" stop-opacity=".26"/><stop offset="1" stop-color="rgb(var(--heat))" stop-opacity="0"/></radialGradient></defs>`;
    s += `<rect width="${w}" height="${h}" fill="var(--map-land)"/>`;
    for (let ci = 0; ci < cols.length - 1; ci++) for (let ri = 0; ri < rows.length - 1; ri++) {
      const bx = cols[ci] + 16, by = rows[ri] + 16, bw = cols[ci + 1] - cols[ci] - 32, bh = rows[ri + 1] - rows[ri] - 32;
      s += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8" fill="var(--map-lot)"/>`;
      for (let y = by + 10; y + 36 < by + bh; y += 50) { s += `<rect x="${bx + 10}" y="${y}" width="46" height="34" rx="3" fill="var(--line)"/><rect x="${bx + bw - 56}" y="${y}" width="46" height="34" rx="3" fill="var(--line)"/>`; }
    }
    s += `<ellipse cx="500" cy="380" rx="420" ry="340" fill="url(#wh)"/>`;
    cols.forEach(x => { s += `<path d="M${x} 0V${h}" stroke="var(--map-street)" stroke-width="30"/>`; });
    rows.forEach(y => { s += `<path d="M0 ${y}H${w}" stroke="var(--map-street)" stroke-width="30"/>`; });
    const lab = (x, y, t, r) => `<text x="${x}" y="${y}" font-size="14" font-family="Geist,sans-serif" fill="var(--map-label)"${r ? ` transform="rotate(90 ${x} ${y})"` : ''}>${t}</text>`;
    s += lab(466, 650, 'N Clarkson St', 1) + lab(726, 650, 'N Irving St', 1) + lab(206, 650, 'N Nye Ave', 1) + lab(760, 614, 'E 9th St') + lab(760, 354, 'E 10th St') + lab(760, 94, 'E 11th St');
    const P = [];
    [127, 177, 227, 277].forEach(y => P.push([436, y]));
    [387, 437, 487, 537, 587].forEach(y => P.push([436, y]));
    [510, 580, 650].forEach(x => P.push([x, 598]));
    s += `<path d="M${P.map(p => p.join(' ')).join(' L')}" fill="none" stroke="var(--route)" stroke-opacity=".3" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/>`;
    s += `<path d="M${P.slice(0, cur).map(p => p.join(' ')).join(' L')}" fill="none" stroke="#f5883a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
    P.forEach((p, i) => {
      const d = DOORS[i], on = i + 1 === cur, past = i + 1 < cur;
      const fill = on ? '#f5883a' : past ? (d.s === 'insp' ? '#4cc38a' : 'var(--line-2)') : 'var(--card)';
      if (on) s += `<circle cx="${p[0]}" cy="${p[1]}" r="30" fill="#f5883a" opacity=".2"/>`;
      s += `<circle cx="${p[0]}" cy="${p[1]}" r="${on ? 18 : 14}" fill="${fill}" stroke="${on ? '#1b1206' : 'var(--line-2)'}" stroke-width="1.5"/>`;
      s += `<text x="${p[0]}" y="${p[1] + 5}" text-anchor="middle" font-size="${on ? 16 : 13}" font-weight="700" font-family="Bricolage Grotesque,Geist,sans-serif" fill="${on ? '#1b1206' : past ? 'var(--ink)' : 'var(--ink)'}">${i + 1}</text>`;
    });
    s += `<circle cx="470" cy="${P[cur - 1][1] + 22}" r="8" fill="var(--you)" stroke="#fff" stroke-width="3"/>`;
    return s + `</svg>`;
  }

  /* ---- switches ---- */
  const q = new URLSearchParams(location.search);
  if (q.get('lang') === 'es') lang = 'es';
  if (q.get('theme') === 'light') document.documentElement.dataset.theme = 'light';
  function view() { const v = (location.hash || '#now').slice(1); document.body.dataset.view = ['now', 'knock', 'job'].includes(v) ? v : 'now'; document.querySelectorAll('[data-go]').forEach(b => b.setAttribute('aria-current', b.dataset.go === document.body.dataset.view ? 'page' : 'false')); }
  function paint() {
    document.documentElement.lang = lang; view();
    document.querySelectorAll('[data-t]').forEach(n => { n.textContent = T(n.dataset.t); });
    if (W.render) W.render();
    document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
    document.querySelectorAll('[data-theme-btn]').forEach(b => b.setAttribute('aria-pressed', (document.documentElement.dataset.theme || 'dark') === b.dataset.themeBtn));
    view();
  }
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { location.hash = g.dataset.go; }
    const l = e.target.closest('[data-lang]'); if (l) { lang = l.dataset.lang; paint(); }
    const t = e.target.closest('[data-theme-btn]'); if (t) { document.documentElement.dataset.theme = t.dataset.themeBtn; paint(); }
  });
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || /input|textarea/i.test(e.target.tagName)) return;
    const m = {n: 'now', k: 'knock', j: 'job'}[e.key.toLowerCase()]; if (m) location.hash = m;
  });
  W.addEventListener('hashchange', view);
  W.MB = {L, T, tx, ic, ZONES, DOORS, STAGES, PIPE, ACTIONS, STEPS, STEPN, STEPD, JOB, TL, MONEY, MARK, cityMap, walkMap, paint, get lang() { return lang; }};
  document.addEventListener('DOMContentLoaded', paint);
})();
