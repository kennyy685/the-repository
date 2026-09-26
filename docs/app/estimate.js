/* HMP App quick estimate: a JavaScript copy of `hh.py estimate` (hailhunter/estimate.py).
 *
 * The page never hard-codes a price. It reads the rules doc `system/prices`, made by
 *   python3 hh.py estimate --export-rules --out prices.json
 * and calls estimate(job, rules). The math matches the Python exactly (same float steps, same rounding:
 * Python's round() goes half-to-even, JavaScript's Math.round does not, so pyRound below copies Python).
 * Self-check on load: selfCheck(rules) runs rules.test_cases (real Python results) and returns the failures.
 *
 * job = {type: siding|roof|gutters|mixed, siding_squares, roof_squares, gutter_ft, soffit_ft,
 *        material: vinyl|hardie, pitch: low|std|steep or rise per 12 ("7/12"), stories: 1-3,
 *        layers: old layers (1 = normal), house_wrap (default true), permit (default true), footprint_sqft}
 * Returns {low, high, lines[], warnings[{en,es}], summary{en,es}, using_reference, minimum_applied, ...}.
 * Throws Error on a bad job (same cases as the Python ValueError).
 *
 * Ranges only. No deductible text (Nebraska 44-8604) and never "insurance will pay": the insurer's approved
 * scope sets the price on insurance jobs (rules.insurance_note). No dependencies.
 */
var RULES_VERSION = 1;
var TYPES = ["siding", "roof", "gutters", "mixed"];

function pyRound(x) {                         // Python round(x): nearest integer, exact .5 goes to the even one
  var r = Math.round(x);
  if (Math.abs(x % 1) === 0.5) r = 2 * Math.round(x / 2);
  return r;
}

function pyRound1(x) {                        // Python round(x, 1): correctly rounded, exact ties to even
  if (!isFinite(x)) return x;
  if (Number.isInteger(x * 4) && Math.abs(x * 4) % 2 === 1) {   // exact x.x5 tie (x ends in .25 or .75)
    var lo = Math.floor(x * 10), hi = lo + 1;
    return (lo % 2 === 0 ? lo : hi) / 10;
  }
  return parseFloat(x.toFixed(1));            // toFixed rounds the exact binary value, like Python
}

function truthy(v) {                          // Python truthiness for JSON values
  if (v === null || v === undefined || v === false || v === 0 || v === "" || (typeof v === "number" && isNaN(v))) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

function fmtG(x) {                            // Python f"{x:g}" for everyday sizes
  var e = x === 0 ? 0 : Math.floor(Math.log10(Math.abs(x)));
  if (e < -4 || e >= 6) {
    var s = x.toExponential(5).replace(/\.?0+e/, "e");
    return s.replace(/e([+-])(\d)$/, function (_, sign, d) { return "e" + sign + "0" + d; });
  }
  return String(Number(x.toPrecision(6)));
}

function money(x) {                           // Python f"${x:,.0f}"
  var s = String(pyRound(x));
  return "$" + s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function num(v, name, dflt) {
  if (v === null || v === undefined || v === "") return dflt === undefined ? 0 : dflt;
  if (typeof v === "object") throw new Error(name + " must be a number, got " + JSON.stringify(v));
  var x = typeof v === "boolean" ? (v ? 1 : 0) : Number(typeof v === "string" ? v.trim() : v);
  if (typeof v === "string" && v.trim() === "") x = NaN;
  if (typeof x !== "number" || isNaN(x)) throw new Error(name + " must be a number, got " + JSON.stringify(v));
  if (x < 0) throw new Error(name + " can't be negative");
  return x;
}

function pitchClass(pitch, rules) {
  var a = rules.adders.steep_pitch;
  if (pitch === null || pitch === undefined || pitch === "") return "std";
  var s = String(pitch).trim().toLowerCase();
  if (s === "standard" || s === "normal") return "std";
  if (s === "low" || s === "std" || s === "steep") return s;
  var m = /^(\d+(?:\.\d+)?)\s*(?:[\/:]\s*12)?$/.exec(s);
  if (!m) throw new Error("pitch must be low, std, steep or a rise per 12 like 7/12, got " + JSON.stringify(pitch));
  var rise = parseFloat(m[1]);
  return rise > a.steep_over ? "steep" : rise < a.low_under ? "low" : "std";
}

function stories(v) {
  var n = pyRound(num(v, "stories", 1));
  if (n < 1 || n > 3) throw new Error("stories must be 1, 2 or 3");
  return n;
}

function squaresFromFootprint(footprint, n, pc, rules) {
  var h = rules.rough_helper;
  var area = num(footprint, "footprint_sqft");
  if (area <= 0) throw new Error("footprint_sqft must be more than 0");
  var perimeter = 4 * Math.sqrt(area) * h.perimeter_factor;
  var wall = perimeter * h.story_height_ft * n * (1 - h.openings);
  return {siding_squares: pyRound1(wall / 100), roof_squares: pyRound1(area * h.pitch_factor[pc] / 100),
          perimeter_ft: pyRound(perimeter), wall_sqft: pyRound(wall), footprint_sqft: area, stories: n,
          pitch: pc, rough: true, note: {en: rules.rough_note.en, es: rules.rough_note.es}};
}

function rate(key, rules) {                   // {low, high, ref}; low null = no price anywhere
  var p = key === "min_job" || key === "min_job_roof" ? rules.adders[key] : rules.prices[key];
  if (!p) return {low: null, high: null, ref: true};
  return {low: p.low, high: p.high, ref: p.source !== "hmp"};
}

function estimate(job, rules) {
  if (!rules || rules.version !== RULES_VERSION) throw new Error("price rules missing or wrong version (re-export system/prices)");
  if (!job || typeof job !== "object" || Array.isArray(job)) throw new Error("job must be a JSON object");
  var ad = rules.adders;
  var jtype = String(truthy(job.type) ? job.type : "").trim().toLowerCase();
  if (TYPES.indexOf(jtype) < 0) throw new Error("type must be one of " + TYPES.join(", ") + ", got " + JSON.stringify(job.type === undefined ? null : job.type));
  var material = String(truthy(job.material) ? job.material : "vinyl").trim().toLowerCase();
  if (["hardie", "james hardie", "fiber cement", "fibercement"].indexOf(material) >= 0) material = "hardie";
  else if (["shingle", "architectural", "architectural shingle"].indexOf(material) >= 0) material = "vinyl";
  if (!Object.prototype.hasOwnProperty.call(rules.materials, material)) throw new Error("material must be vinyl or hardie (roofs are architectural shingle), got " + JSON.stringify(job.material));
  var pc = pitchClass(job.pitch, rules), n = stories(job.stories);
  var layers = pyRound(num(job.layers, "layers", 1)) || 1;
  var siding = num(job.siding_squares, "siding_squares"), roof = num(job.roof_squares, "roof_squares");
  var gutter = num(job.gutter_ft, "gutter_ft"), soffit = num(job.soffit_ft, "soffit_ft");
  var warnings = [], rough = null;
  var wantsSiding = jtype === "siding" || jtype === "mixed", wantsRoof = jtype === "roof" || jtype === "mixed";

  if (truthy(job.footprint_sqft) && ((wantsSiding && !siding) || (wantsRoof && !roof))) {
    rough = squaresFromFootprint(job.footprint_sqft, n, pc, rules);
    if (wantsSiding && !siding) siding = rough.siding_squares;
    if (wantsRoof && !roof) roof = rough.roof_squares;
    warnings.push({en: rules.rough_note.en, es: rules.rough_note.es});
  }
  var tn = rules.type_notes;
  if (jtype === "siding" && roof) { roof = 0; warnings.push({en: tn.siding.en, es: tn.siding.es}); }
  if (jtype === "roof" && siding) { siding = 0; warnings.push({en: tn.roof.en, es: tn.roof.es}); }
  if (jtype === "gutters" && (siding || roof)) { siding = roof = 0; warnings.push({en: tn.gutters.en, es: tn.gutters.es}); }
  var need = {siding: siding, roof: roof, gutters: gutter, mixed: siding || roof || gutter || soffit}[jtype];
  if (!need) {
    var what = {siding: "siding_squares (or footprint_sqft)", roof: "roof_squares (or footprint_sqft)", gutters: "gutter_ft",
                mixed: "at least one of siding_squares, roof_squares, gutter_ft, soffit_ft"};
    throw new Error("a " + jtype + " job needs " + what[jtype]);
  }

  var story = ad.stories.story_adders[String(n)], steep = ad.steep_pitch.pitch_adders[pc];
  var lines = [], refItems = [];

  function add(key, qty, unit, en, es, roofItem, scale) {
    if (scale === undefined) scale = true;
    var r = rate(key, rules);
    if (r.low === null) throw new Error("no price for " + key + " in prices or prices_reference");
    if (r.ref) refItems.push(key);
    var aLo = (scale ? story.low : 0) + (roofItem ? steep.low : 0);
    var aHi = (scale ? story.high : 0) + (roofItem ? steep.high : 0);
    lines.push({key: key, en: en, es: es, qty: pyRound1(qty), unit: unit,
                unit_en: rules.units[unit].en, unit_es: rules.units[unit].es,
                rate: {low: r.low, high: r.high}, adder: {low: aLo, high: aHi},
                low: pyRound(qty * r.low * (1 + aLo)), high: pyRound(qty * r.high * (1 + aHi)), reference: r.ref});
  }
  function item(key) { return rules.prices[key] || {en: key, es: key}; }

  var extra = Math.max(0, layers - 1);
  var xl = item("extra_layer_sq");
  if (siding) {
    var mat = rules.materials[material];
    add(mat.item, siding, "sq", mat.en, mat.es);
    if (!("house_wrap" in job) || job.house_wrap === undefined || truthy(job.house_wrap))
      add("house_wrap_sq", siding, "sq", item("house_wrap_sq").en, item("house_wrap_sq").es);
    if (extra && !roof)
      add("extra_layer_sq", siding * extra, "sq", xl.en + " (walls, x" + extra + ")", xl.es + " (paredes, x" + extra + ")");
  }
  if (roof) {
    add("shingle_roof_sq", roof, "sq", item("shingle_roof_sq").en, item("shingle_roof_sq").es, true);
    if (extra)
      add("extra_layer_sq", roof * extra, "sq", xl.en + " (roof, x" + extra + ")", xl.es + " (techo, x" + extra + ")", true);
  }
  if (soffit) add("soffit_fascia_ft", soffit, "ft", item("soffit_fascia_ft").en, item("soffit_fascia_ft").es);
  if (gutter) add("gutters_ft", gutter, "ft", item("gutters_ft").en, item("gutters_ft").es);
  if (!("permit" in job) || job.permit === undefined || truthy(job.permit))
    add("permit", 1, "job", item("permit").en, item("permit").es, false, false);

  var low = 0, high = 0;
  lines.forEach(function (ln) { low += ln.low; high += ln.high; });
  // Roof jobs use the roof minimum, unless HMP set a general minimum but no roof one (then HMP's wins).
  var roofMin = rate("min_job_roof", rules), anyMin = rate("min_job", rules);
  var useRoof = !!roof && roofMin.low !== null && (!roofMin.ref || anyMin.ref);
  var minKey = useRoof ? "min_job_roof" : "min_job", m = useRoof ? roofMin : anyMin, minimum = null;
  if (m.low !== null && (low < m.low || high < m.high)) {
    minimum = {key: minKey, low: m.low, high: m.high, reference: m.ref};
    low = Math.max(low, m.low); high = Math.max(high, m.high);
    if (m.ref) refItems.push(minKey);
  }
  var step = ad.round_to;
  low = Math.floor(low / step) * step;
  high = Math.ceil(high / step) * step;

  refItems = refItems.filter(function (k, i) { return refItems.indexOf(k) === i; }).sort();
  var usingRef = refItems.length > 0;
  if (usingRef) {
    var allRef = lines.every(function (ln) { return ln.reference; });
    var w = {};
    ["en", "es"].forEach(function (lang) {
      var forItems = allRef ? "" : rules.reference_for_items[lang].replace("{items}", refItems.join(", "));
      w[lang] = rules.reference_warning_template[lang].replace("{for_items}", forItems);
    });
    warnings.unshift(w);
  }

  var pEn = [], pEs = [], hardie = material === "hardie";
  if (siding) { pEn.push((hardie ? "James Hardie" : "vinyl") + " siding (" + fmtG(siding) + " squares)");
                pEs.push("siding " + (hardie ? "James Hardie" : "de vinil") + " (" + fmtG(siding) + " cuadros)"); }
  if (roof) { pEn.push("shingle roof (" + fmtG(roof) + " squares)"); pEs.push("techo de teja (" + fmtG(roof) + " cuadros)"); }
  if (soffit) { pEn.push("soffit + fascia (" + fmtG(soffit) + " ft)"); pEs.push("sofito + fascia (" + fmtG(soffit) + " pies)"); }
  if (gutter) { pEn.push("gutters (" + fmtG(gutter) + " ft)"); pEs.push("canaletas (" + fmtG(gutter) + " pies)"); }
  var sEn = [n + " stor" + (n === 1 ? "y" : "ies")], sEs = [n + " piso" + (n === 1 ? "" : "s")];
  if (roof) {
    sEn.push({low: "low pitch", std: "standard pitch", steep: "steep pitch"}[pc]);
    sEs.push({low: "poca pendiente", std: "pendiente normal", steep: "pendiente alta"}[pc]);
  }
  if (extra) { sEn.push(layers + " old layers"); sEs.push(layers + " capas viejas"); }
  var leadEn = usingRef ? "Rough estimate with MARKET REFERENCE prices (not HMP's)" : "Quick estimate";
  var leadEs = usingRef ? "Estimado aproximado con precios de REFERENCIA del mercado (no de HMP)" : "Estimado rápido";
  var summary = {
    en: leadEn + ": " + money(low) + " - " + money(high) + " for " + pEn.join(", ") + "; " + sEn.join(", ") +
        ". Final price after we measure and inspect. " + rules.insurance_note.en,
    es: leadEs + ": " + money(low) + " - " + money(high) + " por " + pEs.join(", ") + "; " + sEs.join(", ") +
        ". El precio final después de medir e inspeccionar. " + rules.insurance_note.es};
  if (minimum) {
    summary.en += " (Minimum job " + money(m.low) + " - " + money(m.high) + " applied.)";
    summary.es += " (Se aplicó el trabajo mínimo " + money(m.low) + " - " + money(m.high) + ".)";
  }
  return {low: low, high: high, currency: rules.currency || "USD", type: jtype,
          using_reference: usingRef, reference_items: refItems,
          reference_label: usingRef ? rules.reference_label : null,
          warnings: warnings, lines: lines, minimum_applied: minimum,
          adders: {pitch: pc, pitch_roof: steep, stories: n, stories_all: story, layers: layers},
          quantities: {siding_squares: siding, roof_squares: roof, gutter_ft: gutter, soffit_ft: soffit, material: material},
          rough_squares: rough, summary: summary, insurance_note: {en: rules.insurance_note.en, es: rules.insurance_note.es}};
}

/* Runs rules.test_cases through estimate(); returns [] when the JS matches Python, else one message per miss.
 * The page should show "Price rules out of date" and hide the estimate if this is not empty. */
function selfCheck(rules) {
  var fails = [];
  (rules.test_cases || []).forEach(function (t) {
    var r;
    try { r = estimate(t.job, rules); } catch (err) { fails.push(t.name + ": error " + err.message); return; }
    var x = t.expect;
    if (r.low !== x.low || r.high !== x.high) fails.push(t.name + ": got " + r.low + "-" + r.high + ", expected " + x.low + "-" + x.high);
    if (x.using_reference !== undefined && r.using_reference !== x.using_reference) fails.push(t.name + ": using_reference differs");
    if (x.line_keys && r.lines.map(function (l) { return l.key; }).join() !== x.line_keys.join()) fails.push(t.name + ": lines differ");
    if (x.minimum !== undefined && ((r.minimum_applied || {}).key || null) !== x.minimum) fails.push(t.name + ": minimum differs");
    if (x.summary && (r.summary.en !== x.summary.en || r.summary.es !== x.summary.es)) fails.push(t.name + ": summary differs");
    if (x.warnings && JSON.stringify(r.warnings) !== JSON.stringify(x.warnings)) fails.push(t.name + ": warnings differ");
  });
  return fails;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {estimate: estimate, selfCheck: selfCheck, pitchClass: pitchClass, pyRound: pyRound,
                    pyRound1: pyRound1, fmtG: fmtG, RULES_VERSION: RULES_VERSION};
}
