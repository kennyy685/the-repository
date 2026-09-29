/* Claude's Aldaba · js/lib/funnel.js · window.Funnel
   "What it takes": turns a money goal into doors per day, backwards through the door-knocking funnel.
   Pure functions, no DOM. NOT a forecast and never a promise of earnings: every rate below is an industry
   benchmark from vendor figures (data/benchmarks.json, as of 2026-09-26) until HMP has its own numbers.

     Funnel.bench                         the low/typical/high figures (copied from data/benchmarks.json)
     Funnel.plan({goal, today, end, commissionPerJob, knockDaysPerWeek, hoursPerDay, rates, rep, skip})
     Funnel.sensitivity(opts)             the same plan at low / typical / high rates
     Funnel.rates(rates, rep)             the resolved chain (fractions) with sources
     Funnel.knockDays(today, end, perWeek, skip)

   Run `node js/lib/funnel.js` to self-test and print the typical plan. */
(function (root) {
  'use strict';

  var NOTE = {
    en: "Industry benchmarks from vendor figures; replace with HMP's own after ~200 doors.",
    es: 'Referencias de la industria (cifras de proveedores); cámbialas por las de HMP después de ~200 puertas.'
  };

  // Copied from data/benchmarks.json (as_of 2026-09-26). Units as in the file: % unless noted.
  var bench = {
    _note: NOTE,
    _as_of: '2026-09-26',
    _file: 'data/benchmarks.json',
    doors_to_conversation: { low: 20, typical: 30, high: 40, unit: '%', source: 'spotio.com, theroofstrategist.com' },
    doors_per_hour: { low: 10, typical: 12, high: 15, unit: 'doors/h', source: 'rookie knocking benchmarks (research round 6)' },
    doors_to_qualified_inspection_new_rep: { low: 0.5, typical: 1, high: 2, unit: '%', source: 'ilroofinginstitute.com, new rep, first 30 days' },
    doors_to_qualified_inspection_experienced: { low: 2, typical: 3.5, high: 5, unit: '%', source: 'ilroofinginstitute.com, top performers' },
    doors_to_appointment_company_median: { low: 6, typical: 9, high: 16, unit: '%', source: 'subcontractorhub.com, whole-company funnel' },
    appointment_to_inspection: { low: 58, typical: 71, high: 84, unit: '%', source: 'subcontractorhub.com' },
    inspection_to_signed_contract: { low: 40, typical: 58, high: 74, unit: '%', source: 'subcontractorhub.com' },
    overall_close_rate_exclusive_leads: { low: 25, typical: 30, high: 35, unit: '%', source: 'subcontractorhub.com; spotio.com' },
    avg_hail_wind_insurance_payout: { low: 9000, typical: 13000, high: 18000, unit: 'USD', source: 'insuranceclaimrecoverysupport.com, nwclaimsmanagement.com' }
  };

  /* THE CHAIN (why this one):
     doors -> booked inspection (appointment) at the NEW-REP door rate (1% typical, ilroofinginstitute)
           -> inspection actually happens (71%) -> signed contract (58%) -> paid job (1:1, see below).
     - Not doors_to_appointment_company_median (9%): that is a whole-company funnel that "may include other lead
       sources" (referrals, inbound calls), so for one new knocker on cold doors it would overstate appointments ~9x.
     - Not doors -> conversation -> appointment: the file has no conversation->appointment rate. Conversations are
       shown as a display step only (doors x 30%); the implied 1% / 30% = 3.3% of conversations book is plausible.
     - Cross-check: booked -> signed = 71% x 58% = 41%, next to "well-run teams close 30-40% of qualified inspection
       leads" (spotio, fetched) and 25-35% for exclusive leads (subcontractorhub). Same order of magnitude.
     - signed -> paid job is assumed 1:1 (no benchmark; an insurance claim can still be denied). Override with
       rates.signed_to_job (in %) once HMP knows its own number.
     - rep:'experienced' swaps in 3.5% doors->inspection when HMP's own numbers justify it. */
  var CHAIN = [
    { id: 'doors_to_conversation', key: 'doors_to_conversation' },
    { id: 'doors_to_appointment', key: 'doors_to_qualified_inspection_new_rep', exp: 'doors_to_qualified_inspection_experienced' },
    { id: 'appointment_to_inspection', key: 'appointment_to_inspection' },
    { id: 'inspection_to_signed_contract', key: 'inspection_to_signed_contract' },
    { id: 'signed_to_job', fixed: 100, source: 'assumed 1:1 until HMP has data (no benchmark)' },
    { id: 'doors_per_hour', key: 'doors_per_hour' }
  ];

  var LABELS = {
    doors: { en: 'Doors knocked', es: 'Puertas tocadas' },
    conversations: { en: 'Conversations', es: 'Conversaciones' },
    appointments: { en: 'Inspections booked', es: 'Inspecciones agendadas' },
    inspections: { en: 'Inspections done', es: 'Inspecciones hechas' },
    signed: { en: 'Contracts signed', es: 'Contratos firmados' },
    jobs: { en: 'Paid jobs', es: 'Trabajos pagados' }
  };
  var SCEN = {
    low: { en: 'Tough rates', es: 'Tasas difíciles' },
    typical: { en: 'Typical rates', es: 'Tasas típicas' },
    high: { en: 'Strong rates', es: 'Tasas fuertes' }
  };

  function num(v, d) { v = +v; return isFinite(v) ? v : d; }
  function ceil(x) { return Math.ceil(x - 1e-9) || 0; }        // float-safe: 188 / 0.01 must stay 18800
  function r1(x) { return Math.round(x * 10) / 10; }
  function ceil1(x) { return Math.ceil(x * 10 - 1e-9) / 10; }

  // Resolve a rate set: 'low'|'typical'|'high', or {base:'typical', <id or benchmark key>: value in the file's units}.
  function rates(which, rep) {
    var o = which && typeof which === 'object' ? which : {};
    var base = typeof which === 'string' ? which : (o.base || 'typical');
    if (base !== 'low' && base !== 'high') base = 'typical';
    var out = { base: base, rep: rep === 'experienced' ? 'experienced' : 'new' };
    CHAIN.forEach(function (c) {
      var key = c.exp && out.rep === 'experienced' ? c.exp : c.key;
      var b = key ? bench[key] : null;
      var v = c.fixed != null ? c.fixed : b[base];
      var src = c.source || (b && b.source);
      var over = o[c.id] != null ? o[c.id] : key && o[key] != null ? o[key] : null;
      if (over != null && isFinite(+over) && +over > 0) { v = +over; src = 'override'; }
      out[c.id] = { rate: c.id === 'doors_per_hour' ? v : v / 100, value: v, key: key || c.id, source: src };
    });
    return out;
  }

  function parseDay(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    if (!m) { var d = new Date(); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }
    return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  }
  function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function thanksgiving(y) { var d = new Date(Date.UTC(y, 10, 1)).getUTCDay(); return Date.UTC(y, 10, 1 + ((4 - d + 7) % 7) + 21); }
  function holidays(y0, y1) {                              // default days off: Thanksgiving, Christmas, New Year's Day
    var out = [];
    for (var y = y0; y <= y1; y++) out.push(iso(Date.UTC(y, 0, 1)), iso(thanksgiving(y)), iso(Date.UTC(y, 11, 25)));
    return out;
  }
  // Knock days from today through end (both counted): the first N weekdays of Mon..Sun, minus skipped dates.
  function knockDays(today, end, perWeek, skip) {
    var a = parseDay(today), b = parseDay(end), n = Math.max(1, Math.min(7, Math.round(num(perWeek, 5))));
    var order = [1, 2, 3, 4, 5, 6, 0].slice(0, n), off = {};
    (skip || holidays(new Date(a).getUTCFullYear(), new Date(b).getUTCFullYear())).forEach(function (d) { off[String(d).slice(0, 10)] = 1; });
    var days = 0, cal = 0, skipped = [];
    for (var t = a; t <= b; t += 864e5) {
      cal++;
      if (order.indexOf(new Date(t).getUTCDay()) < 0) continue;
      if (off[iso(t)]) { skipped.push(iso(t)); continue; }
      days++;
    }
    return { daysLeft: cal, knockDays: days, skipped: skipped };
  }

  function plan(o) {
    o = o || {};
    var goal = Math.max(0, num(o.goal, 100000));
    var today = o.today || iso(parseDay());
    var end = o.end || today.slice(0, 4) + '-12-31';
    var perWeek = Math.max(1, Math.min(7, Math.round(num(o.knockDaysPerWeek, 5))));
    var hoursAvail = Math.max(0, num(o.hoursPerDay, 3.5));
    var R = rates(o.rates, o.rep);
    var example = o.commissionPerJob == null;
    var commission = example ? Math.round(bench.avg_hail_wind_insurance_payout.typical * 0.10) : Math.max(1, num(o.commissionPerJob, 1));
    var cal = knockDays(today, end, perWeek, o.skip);

    // Backwards from the goal. ceil at every step: you cannot book 0.4 of an inspection.
    var jobs = ceil(goal / commission);
    var signed = ceil(jobs / R.signed_to_job.rate);
    var inspections = ceil(signed / R.inspection_to_signed_contract.rate);
    var appointments = ceil(inspections / R.appointment_to_inspection.rate);
    var doors = ceil(appointments / R.doors_to_appointment.rate);
    var conversations = Math.round(doors * R.doors_to_conversation.rate);   // display step: expected, not required
    var dph = R.doors_per_hour.rate;
    var kd = cal.knockDays;
    var doorsPerDay = kd ? ceil(doors / kd) : null;
    var hoursPerDay = kd ? ceil1(doorsPerDay / dph) : null;
    var weeks = kd / perWeek;
    var capDay = Math.floor(hoursAvail * dph), capDoors = capDay * kd;

    var steps = [
      { id: 'doors', of: null, value: doors, rate: null, source: null },
      { id: 'conversations', of: 'doors', value: conversations, r: R.doors_to_conversation },
      { id: 'appointments', of: 'doors', value: appointments, r: R.doors_to_appointment },
      { id: 'inspections', of: 'appointments', value: inspections, r: R.appointment_to_inspection },
      { id: 'signed', of: 'inspections', value: signed, r: R.inspection_to_signed_contract },
      { id: 'jobs', of: 'signed', value: jobs, r: R.signed_to_job }
    ].map(function (s) {
      return { id: s.id, label: LABELS[s.id], value: s.value, of: s.of, rate: s.r ? s.r.rate : s.rate,
        key: s.r ? s.r.key : null, source: s.r ? s.r.source : s.source };
    });

    var out = {
      kind: 'what-it-takes',
      note: { en: 'What it takes at ' + R.base + ' industry rates, not a forecast or a promise of earnings.',
              es: 'Lo que se necesita con tasas ' + { low: 'bajas', typical: 'típicas', high: 'altas' }[R.base] + ' de la industria; no es un pronóstico ni una promesa de ganancias.' },
      benchNote: NOTE,
      goal: goal, today: today, end: end,
      commission: { value: commission, example: example,
        label: example ? { en: 'Example, set by HMP: 10% of a typical $13,000 hail/wind claim.', es: 'Ejemplo, lo fija HMP: 10% de un reclamo típico de $13,000 por granizo/viento.' }
                       : { en: 'Commission per job, set by HMP.', es: 'Comisión por trabajo, la fija HMP.' } },
      rates: R.base, rep: R.rep,
      daysLeft: cal.daysLeft, knockDays: kd, knockDaysPerWeek: perWeek, skipped: cal.skipped,
      jobs: jobs, signed: signed, inspections: inspections, appointments: appointments,
      conversations: conversations, doors: doors,
      doorsPerJob: jobs ? Math.round(doors / jobs) : null,
      doorsPerDay: doorsPerDay,
      hoursPerDay: hoursPerDay,                          // knocking hours per knock day the goal takes
      totalHours: ceil(doors / dph),
      perWeek: kd ? {
        doors: doorsPerDay * perWeek,
        conversations: Math.round(doorsPerDay * perWeek * R.doors_to_conversation.rate),
        appointments: ceil(appointments / weeks),
        inspections: ceil(inspections / weeks),
        signed: ceil(signed / weeks),
        hours: r1(hoursPerDay * perWeek)
      } : null,
      // What the hours he has cover: a share of the need, never a dollar figure.
      capacity: { hoursPerDay: hoursAvail, doorsPerDay: capDay, doors: capDoors,
        pctOfNeed: doors ? Math.round(capDoors / doors * 100) : 100, fits: kd ? doorsPerDay <= capDay : false },
      steps: steps,
      notes: []
    };
    if (!kd) out.notes.push({ id: 'no_days', en: 'No knock days left before the end date.', es: 'No quedan días para tocar antes de la fecha final.' });
    else if (!out.capacity.fits) out.notes.push({ id: 'over_hours',
      en: 'At these rates the goal takes ' + hoursPerDay + ' h of knocking a day; ' + hoursAvail + ' h covers ' + out.capacity.pctOfNeed + '% of it.',
      es: 'Con estas tasas la meta pide ' + hoursPerDay + ' h de tocar puertas al día; ' + hoursAvail + ' h cubren el ' + out.capacity.pctOfNeed + '%.' });
    return out;
  }

  function sensitivity(o) {
    var out = { note: { en: 'Same goal and commission; only the benchmark rates change (low = tough, high = strong).',
                        es: 'Misma meta y comisión; solo cambian las tasas de referencia (baja = difícil, alta = fuerte).' } };
    ['low', 'typical', 'high'].forEach(function (k) {
      var base = o && o.rates && typeof o.rates === 'object' ? Object.assign({}, o.rates, { base: k }) : k;
      var p = plan(Object.assign({}, o || {}, { rates: base }));
      out[k] = { label: SCEN[k], doorsPerDay: p.doorsPerDay, hoursPerDay: p.hoursPerDay, doors: p.doors,
                 jobs: p.jobs, doorsPerJob: p.doorsPerJob, pctOfNeed: p.capacity.pctOfNeed };
    });
    return out;
  }

  var Funnel = { bench: bench, plan: plan, sensitivity: sensitivity, rates: rates, knockDays: knockDays, holidays: holidays };
  root.Funnel = Funnel;
  if (typeof module !== 'undefined' && module.exports) module.exports = Funnel;

  // ---- self-test: `node js/lib/funnel.js` ----
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var assert = require('assert');
    var p = plan({ goal: 100000, today: '2026-09-29', end: '2026-12-31' });
    assert.strictEqual(p.commission.value, 1300); assert.ok(p.commission.example);
    assert.strictEqual(p.daysLeft, 94);                         // Sep 29 .. Dec 31, both counted
    assert.strictEqual(p.knockDays, 66);                        // 68 weekdays minus Thanksgiving + Christmas
    assert.deepStrictEqual(p.skipped, ['2026-11-26', '2026-12-25']);
    assert.strictEqual(p.jobs, 77);                             // ceil(100000 / 1300)
    assert.strictEqual(p.signed, 77);
    assert.strictEqual(p.inspections, 133);                     // ceil(77 / .58)
    assert.strictEqual(p.appointments, 188);                    // ceil(133 / .71)
    assert.strictEqual(p.doors, 18800);                         // ceil(188 / .01), float-safe
    assert.strictEqual(p.conversations, 5640);
    assert.strictEqual(p.doorsPerDay, 285);                     // ceil(18800 / 66)
    assert.strictEqual(p.hoursPerDay, 23.8);                    // 285 / 12 doors an hour
    assert.strictEqual(p.capacity.doorsPerDay, 42);
    assert.strictEqual(p.capacity.fits, false);
    assert.strictEqual(p.steps.length, 6); assert.ok(p.steps.every(function (s) { return s.label.en && s.label.es; }));
    // monotonic: better rates never need more doors
    var s = sensitivity({ goal: 100000, today: '2026-09-29', end: '2026-12-31' });
    assert.ok(s.low.doorsPerDay > s.typical.doorsPerDay && s.typical.doorsPerDay > s.high.doorsPerDay);
    // overrides in the file's units; commission input; experienced rep
    var q = plan({ goal: 100000, today: '2026-09-29', end: '2026-12-31', commissionPerJob: 2000, rates: { doors_to_appointment: 2 } });
    assert.strictEqual(q.jobs, 50); assert.strictEqual(q.doors, ceil(ceil(ceil(50 / .58) / .71) / .02));
    assert.ok(plan({ today: '2026-09-29', end: '2026-12-31', rep: 'experienced' }).doors < p.doors);
    // no days left, zero goal
    assert.strictEqual(plan({ today: '2027-01-02', end: '2026-12-31' }).doorsPerDay, null);
    assert.strictEqual(plan({ goal: 0, today: '2026-09-29', end: '2026-12-31' }).doors, 0);
    // never a dollar forecast in the output
    assert.ok(!/\$\d/.test(JSON.stringify(p.notes)));
    console.log('funnel self-test: ok');
    console.log('typical plan:', JSON.stringify({ goal: p.goal, commission: p.commission.value, daysLeft: p.daysLeft, knockDays: p.knockDays,
      jobs: p.jobs, signed: p.signed, inspections: p.inspections, appointments: p.appointments, conversations: p.conversations,
      doors: p.doors, doorsPerJob: p.doorsPerJob, doorsPerDay: p.doorsPerDay, hoursPerDay: p.hoursPerDay, perWeek: p.perWeek, capacity: p.capacity }));
    console.log('sensitivity doors/day:', s.low.doorsPerDay, '/', s.typical.doorsPerDay, '/', s.high.doorsPerDay,
      '  hours/day:', s.low.hoursPerDay, '/', s.typical.hoursPerDay, '/', s.high.hoursPerDay);
    console.log('experienced rep, typical:', JSON.stringify((function (e) { return { doors: e.doors, doorsPerDay: e.doorsPerDay, hoursPerDay: e.hoursPerDay }; })(plan({ today: '2026-09-29', end: '2026-12-31', rep: 'experienced' }))));
  }
})(typeof window !== 'undefined' ? window : globalThis);
