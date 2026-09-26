/* HMP App material takeoff: a JavaScript copy of `hh.py takeoff` (hailhunter/takeoff.py), O7 phase D.
 *
 * The page never hard-codes a rule or a word. It reads the rules doc `system/takeoff`, made by
 *   python3 hh.py takeoff --export-rules --out takeoff-rules.json
 * and calls takeoff(job, rules). compute() below follows the Python step for step (same float steps, same
 * round-up with a 1e-9 noise guard), so both give the same order list and text.
 * Self-check on load: selfCheck(rules) runs rules.test_cases (real Python results) and returns the failures;
 * if it's not empty the page should say "Material rules out of date" and not show the list.
 *
 * job = {kind: roof|siding|gutters|mixed, name,
 *        roof {squares, eave_ft, rake_ft, ridge_ft, hip_ft, valley_ft, penetrations, roof_type, pitch, overhang_in,
 *              ridge_vent},
 *        siding {material, wall_sqft | squares, openings | opening_perimeter_ft, wall_height_ft, outside_corners,
 *                inside_corners, bottom_ft, rake_ft, exposure_in},
 *        gutters {feet, runs, corners, snow (default true), height_ft}}
 * Returns {version, kind, name, material, lines[], groups[], ask_supplier[], assumptions[], text{en,es}}.
 * Throws Error on a bad job (same cases as the Python ValueError). Materials only: no prices. No dependencies.
 */
var TAKEOFF_RULES_VERSION = 1;
var EPS = 1e-9;

function up(x) { return Math.ceil(x - EPS) + 0; }            // + 0 turns -0 into 0

function pyRound(x) {                                        // Python round(x): exact .5 goes to the even one
  var r = Math.round(x);
  if (Math.abs(x % 1) === 0.5) r = 2 * Math.round(x / 2);
  return r;
}

function fmt(x) { return String(Number(x)); }                 // same as Python fmt() (shortest repr, 12.0 -> "12")

function pct(frac) { return fmt(pyRound(frac * 1000) / 10); }

function fill(tpl, vals) {
  Object.keys(vals).forEach(function (k) { tpl = tpl.split("{" + k + "}").join(vals[k]); });
  return tpl;
}

function truthy(v) {                                          // Python truthiness for JSON values
  if (v === null || v === undefined || v === false || v === 0 || v === "" || (typeof v === "number" && isNaN(v))) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

function has(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

function num(v, name, dflt) {
  if (v === null || v === undefined || v === "") return dflt === undefined ? 0 : dflt;
  if (typeof v === "object") throw new Error(name + " must be a number, got " + JSON.stringify(v));
  var x = typeof v === "boolean" ? (v ? 1 : 0) : Number(typeof v === "string" ? v.trim() : v);
  if (typeof v === "string" && v.trim() === "") x = NaN;
  if (typeof x !== "number" || !isFinite(x)) throw new Error(name + " must be a number, got " + JSON.stringify(v));
  if (x < 0) throw new Error(name + " can't be negative");
  return x;
}

function section(job, key) {
  var s = job[key];
  if (s === null || s === undefined) return null;
  if (typeof s !== "object" || Array.isArray(s)) throw new Error(key + " must be an object like {\"feet\": 120}");
  return s;
}

function riseOf(pitch, rules) {
  if (pitch === null || pitch === undefined || pitch === "") return null;
  var s = String(pitch).trim().toLowerCase();
  var words = rules.config.pitch_words;
  if (s === "standard" || s === "normal") s = "std";
  if (has(words, s)) return Number(words[s]);
  var m = /^(\d+(?:\.\d+)?)\s*(?:[\/:]\s*12)?$/.exec(s);
  if (!m) throw new Error("pitch must be low, std, steep or a rise per 12 like 7/12, got " + JSON.stringify(pitch));
  return parseFloat(m[1]);
}

function compute(job, rules) {
  if (!job || typeof job !== "object" || Array.isArray(job)) throw new Error("job must be an object");
  var kind = String(truthy(job.kind) ? job.kind : truthy(job.type) ? job.type : "").trim().toLowerCase();
  if (rules.kinds.indexOf(kind) < 0) throw new Error("kind must be roof, siding, gutters or mixed");
  var c = rules.config, T = rules.items;
  var lines = [], ask = [], assume = [Object.assign({}, rules.assume.rounded)];

  function add(key, qty, vals) {
    if (qty <= 0) return;
    var it = T[key], u = rules.units[T[key].unit];
    lines.push({group: it.group, item: key, en: fill(it.en, vals), es: fill(it.es, vals), qty: qty, unit: it.unit,
                unit_en: qty === 1 ? u[0] : u[1], unit_es: qty === 1 ? u[2] : u[3],
                how: {en: fill(it.how_en, vals), es: fill(it.how_es, vals)}});
  }
  function note(key, vals) {
    var a = rules.assume[key];
    assume.push({en: fill(a.en, vals), es: fill(a.es, vals)});
  }
  function askFor(key, vals) {
    var a = rules.ask[key];
    ask.push({item: key, en: a.en, es: a.es, why: {en: fill(a.why_en, vals), es: fill(a.why_es, vals)}});
  }

  var want = kind === "mixed" ? rules.kinds.slice(0, 3) : [kind];
  var roof = want.indexOf("roof") >= 0 ? section(job, "roof") : null;
  var siding = want.indexOf("siding") >= 0 ? section(job, "siding") : null;
  var gutters = want.indexOf("gutters") >= 0 ? section(job, "gutters") : null;
  if (kind !== "mixed" && (kind === "roof" ? roof : kind === "siding" ? siding : gutters) === null)
    throw new Error("a " + kind + " job needs a \"" + kind + "\" object with measurements");
  if (roof === null && siding === null && gutters === null)
    throw new Error("a mixed job needs at least one of roof, siding, gutters");

  var v, w, roofRake = 0;
  if (roof !== null) {
    var sq = num(roof.squares, "roof.squares");
    var eave = num(roof.eave_ft, "roof.eave_ft");
    var rake = num(roof.rake_ft, "roof.rake_ft");
    roofRake = rake;
    var ridge = num(roof.ridge_ft, "roof.ridge_ft");
    var hip = num(roof.hip_ft, "roof.hip_ft");
    var valley = num(roof.valley_ft, "roof.valley_ft");
    var pen = up(num(roof.penetrations, "roof.penetrations"));
    var rtRaw = roof.roof_type, rtype, rtGiven;
    if (rtRaw === null || rtRaw === undefined || rtRaw === "") {
      rtype = hip > 0 ? "hip" : "gable";
      rtGiven = false;
    } else {
      rtype = String(rtRaw).trim().toLowerCase().replace(/[\s_-]+/g, "");
      rtGiven = true;
      if (!has(rules.roof_types, rtype)) throw new Error("roof_type must be gable, hip or cutup, got " + JSON.stringify(rtRaw));
    }
    var rise = riseOf(roof.pitch, rules);
    var pitchGiven = rise !== null;
    if (rise === null) rise = Number(c.default_pitch);
    var overhang = num(roof.overhang_in, "roof.overhang_in", Number(c.ice_water_overhang_in));
    w = c.waste[rtype];
    var names = rules.roof_types[rtype];
    v = {sq: fmt(sq), waste: pct(w), type_en: names[0], type_es: names[1],
         eave: fmt(eave), rake: fmt(rake), ridge: fmt(ridge), hip: fmt(hip), valley: fmt(valley)};
    if (sq > 0) {
      v.bps = fmt(c.bundles_per_square);
      add("shingles", up(sq * (1 + w) * c.bundles_per_square), v);
    }
    v.per = fmt(c.starter_ft_per_bundle);
    add("starter", up((eave + rake) / c.starter_ft_per_bundle), v);
    v.per = fmt(c.ridge_cap_ft_per_bundle);
    add("ridge_cap", up((ridge + hip) / c.ridge_cap_ft_per_bundle), v);
    v.extra = pct(c.drip_edge_extra);
    v.stick = fmt(c.drip_edge_stick_ft);
    add("drip_edge", up((eave + rake) * (1 + c.drip_edge_extra) / c.drip_edge_stick_ft), v);
    if (sq > 0) {
      v.per = fmt(c.underlayment_sq_per_roll);
      add("underlayment", up(sq / c.underlayment_sq_per_roll), v);
    }
    var width = c.ice_water_width_in;
    var stripIn = (overhang + c.ice_water_inside_wall_in) * Math.sqrt(1 + (rise / 12) * (rise / 12));
    var rows = 1 + up(Math.max(0, stripIn - width) / (width - c.ice_water_lap_in));
    Object.assign(v, {rows: fmt(rows), width: fmt(width), inside: fmt(c.ice_water_inside_wall_in),
                      overhang: fmt(overhang), pitch: fmt(rise), roll: fmt(c.ice_water_roll_ft)});
    add("ice_water", up((eave * rows + valley) / c.ice_water_roll_ft), v);
    if (sq > 0) {
      v.nps = fmt(c.nails_per_square);
      v.per = fmt(c.nails_per_box);
      add("roof_nails", up(sq * (1 + w) * c.nails_per_square / c.nails_per_box), v);
    }
    v.n = fmt(pen);
    add("pipe_boots", pen, v);
    if (truthy(roof.ridge_vent)) add("ridge_vent", up(ridge), v);
    var wv = {g: pct(c.waste.gable), h: pct(c.waste.hip), c: pct(c.waste.cutup), type_en: names[0], type_es: names[1],
              w: pct(w), nps: fmt(c.nails_per_square), inside: fmt(c.ice_water_inside_wall_in), pitch: fmt(rise)};
    if (sq > 0) { note("waste", wv); note("nails", wv); } else note("no_squares", wv);
    if (!rtGiven) note("roof_type", wv);
    if (!pitchGiven && (eave > 0 || valley > 0)) note("pitch", wv);
    if (eave > 0 || valley > 0) note("ice_water", wv);
  }

  var material = null;
  if (siding !== null) {
    var mRaw = siding.material;
    material = (mRaw === null || mRaw === undefined || mRaw === "") ? "vinyl"
      : String(mRaw).trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (has(rules.material_aliases, material)) material = rules.material_aliases[material];
    if (!has(rules.materials, material))
      throw new Error("siding.material must be vinyl, insulated_vinyl or hardie, got " + JSON.stringify(mRaw));
    var area = num(siding.wall_sqft, "siding.wall_sqft");
    if (area === 0) area = num(siding.squares, "siding.squares") * 100;
    var nOpen = up(num(siding.openings, "siding.openings"));
    var openFt = num(siding.opening_perimeter_ft, "siding.opening_perimeter_ft");
    var fromCount = openFt === 0 && nOpen > 0;
    if (fromCount) openFt = nOpen * c.ft_per_opening;
    var h = num(siding.wall_height_ft, "siding.wall_height_ft");
    var hGiven = h > 0;
    if (!hGiven) h = Number(c.default_wall_height_ft);
    var outside = up(num(siding.outside_corners, "siding.outside_corners"));
    var inside = up(num(siding.inside_corners, "siding.inside_corners"));
    var bottom = num(siding.bottom_ft, "siding.bottom_ft");
    var sRake = num(siding.rake_ft, "siding.rake_ft", roofRake);
    w = c.siding_waste[material];
    var hardie = material === "hardie";
    var mnames = rules.materials[material];
    v = {area: fmt(area), waste: pct(w), open: fmt(openFt), rake: fmt(sRake), h: fmt(h), bottom: fmt(bottom),
         extra: pct(c.trim_extra)};
    var planks = 0;
    if (hardie) {
      var exposure = num(siding.exposure_in, "siding.exposure_in", Number(c.hardie_exposure_in));
      if (exposure <= 0) throw new Error("siding.exposure_in must be more than 0");
      var cov = exposure * c.hardie_plank_ft / 12;
      Object.assign(v, {exposure: fmt(exposure), len: fmt(c.hardie_plank_ft), cov: fmt(cov)});
      planks = up(area * (1 + w) / cov);
      add("hardie_planks", planks, v);
      v.planks = fmt(planks);
      v.per = fmt(c.hardie_nails_per_plank);
      add("hardie_nails", planks * c.hardie_nails_per_plank, v);
    } else {
      add(material + "_siding", up(area * (1 + w) / 100), v);
    }
    v.per = fmt(c.house_wrap_roll_sqft);
    v.extra = pct(c.house_wrap_extra);
    add("house_wrap", up(area * (1 + c.house_wrap_extra) / c.house_wrap_roll_sqft), v);
    v.extra = pct(c.trim_extra);
    var trimLen = hardie ? c.hardie_trim_ft : c.j_channel_ft;
    v.len = fmt(trimLen);
    var trim = up((openFt + sRake) * (1 + c.trim_extra) / trimLen);
    add(hardie ? "hardie_trim" : "j_channel", trim, v);
    var cornerLen = hardie ? c.hardie_corner_ft : c.corner_post_ft;
    var per = up(h / cornerLen);
    Object.assign(v, {len: fmt(cornerLen), per: fmt(per), n: fmt(outside)});
    add(hardie ? "hardie_outside_corners" : "outside_corners", outside * per * (hardie ? 2 : 1), v);
    v.n = fmt(inside);
    add(hardie ? "hardie_inside_corners" : "inside_corners", inside * per, v);
    v.len = fmt(c.starter_strip_ft);
    add("starter_strip", up(bottom / c.starter_strip_ft), v);
    var av = {w: pct(w), mat_en: mnames[0], mat_es: mnames[1], h: fmt(h), n: fmt(nOpen), per: fmt(c.ft_per_opening)};
    note("siding_waste", av);
    if (area === 0) note("no_area", av);
    if (!hGiven && (outside > 0 || inside > 0)) note("wall_height", av);
    if (fromCount) note("openings", av);
    if (hardie) {
      askFor("hardie_caulk", {planks: fmt(planks), trim: fmt(trim)});
      askFor("hardie_paint", {planks: fmt(planks)});
    } else if (area > 0) {
      askFor("vinyl_nails", {sq: fmt(up(area * (1 + w) / 100))});
    }
  }

  if (gutters !== null) {
    var feet = num(gutters.feet, "gutters.feet");
    var runs = up(num(gutters.runs, "gutters.runs", 1));
    if (feet > 0 && runs < 1) runs = 1;
    var corners = up(num(gutters.corners, "gutters.corners"));
    var snowRaw = gutters.snow;
    var snow = (snowRaw === null || snowRaw === undefined) ? true : truthy(snowRaw);
    var sp = c.hanger_spacing_in[snow ? "snow" : "no_snow"];
    var sn = rules.snow[snow ? "true" : "false"];
    var gh = num(gutters.height_ft, "gutters.height_ft");
    if (gh === 0 && siding !== null) gh = num(siding.wall_height_ft, "siding.wall_height_ft");
    v = {feet: fmt(feet), runs: fmt(runs), n: fmt(corners), sp: fmt(sp), snow_en: sn[0], snow_es: sn[1], h: fmt(gh),
         per: fmt(c.gutter_ft_per_downspout)};
    if (feet > 0) {
      add("gutter", up(feet), v);
      var d = Math.max(runs, up(feet / c.gutter_ft_per_downspout));
      add("downspouts", d, v);
      v.d = fmt(d);
      add("downspout_pipe", up(d * gh), v);
      v.per = fmt(c.elbows_per_downspout);
      add("elbows", d * c.elbows_per_downspout, v);
      add("outlets", d, v);
      add("hangers", up(feet * 12 / sp) + runs, v);
      add("end_caps", 2 * runs, v);
      add("miters", corners, v);
      note("hangers", v);
      if (gh === 0) note("no_height", v);
      askFor("gutter_sealant", {runs: fmt(runs), caps: fmt(2 * runs), miters: fmt(corners)});
    }
  }

  if (!lines.length)
    throw new Error("nothing to count: give measurements (roof squares/eave ft, siding wall_sqft, gutter feet)");

  var nameRaw = truthy(job.name) ? job.name : job.address;
  var name = (nameRaw === null || nameRaw === undefined || nameRaw === "") ? "" : String(nameRaw).trim();
  var groups = [];
  rules.groups.forEach(function (g) {
    var n = lines.filter(function (ln) { return ln.group === g.key; }).length;
    if (!n) return;
    var gg = {key: g.key, en: g.en, es: g.es, count: n};
    if (g.key === "siding") {
      gg.en = g.en + " (" + rules.materials[material][0] + ")";
      gg.es = g.es + " (" + rules.materials[material][1] + ")";
    }
    groups.push(gg);
  });
  var tx = rules.text, text = {};
  ["en", "es"].forEach(function (lang) {
    var out = [fill(tx["title_" + lang], {company: rules.company})];
    if (name) out.push(fill(tx["job_" + lang], {name: name}));
    groups.forEach(function (g) {
      out.push("");
      out.push(g[lang]);
      lines.forEach(function (ln) {
        if (ln.group === g.key) out.push("- " + fmt(ln.qty) + " " + ln["unit_" + lang] + " " + ln[lang]);
      });
    });
    if (ask.length) {
      out.push("");
      out.push(fill(tx["ask_" + lang], {items: ask.map(function (a) { return a[lang]; }).join(", ")}));
    }
    out.push("");
    out.push(tx["end_" + lang]);
    text[lang] = out.join("\n");
  });
  return {version: rules.version, kind: kind, name: name, material: material, lines: lines, groups: groups,
          ask_supplier: ask, assumptions: assume, text: text};
}

function takeoff(job, rules) {
  if (!rules || rules.version !== TAKEOFF_RULES_VERSION) throw new Error("material rules doc is missing or a different version");
  return compute(job, rules);
}

function canon(x) {                                           // key-order-free JSON for comparing results
  if (Array.isArray(x)) return "[" + x.map(canon).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).sort().map(function (k) { return JSON.stringify(k) + ":" + canon(x[k]); }).join(",") + "}";
  return JSON.stringify(x);
}

/* Runs rules.test_cases through takeoff(); returns [] when the JS matches Python exactly, else one message per miss. */
function selfCheck(rules) {
  var fails = [];
  (rules.test_cases || []).forEach(function (t) {
    var r;
    try { r = takeoff(t.job, rules); } catch (err) { fails.push(t.name + ": error " + err.message); return; }
    if (canon(r) === canon(t.expect)) return;
    var x = t.expect;
    if (canon(r.lines) !== canon(x.lines)) fails.push(t.name + ": lines differ");
    if (canon(r.text) !== canon(x.text)) fails.push(t.name + ": text differs");
    if (canon(r.assumptions) !== canon(x.assumptions)) fails.push(t.name + ": assumptions differ");
    if (canon(r.ask_supplier) !== canon(x.ask_supplier)) fails.push(t.name + ": ask_supplier differs");
    if (!fails.length || fails[fails.length - 1].indexOf(t.name + ":") !== 0) fails.push(t.name + ": result differs");
  });
  return fails;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {takeoff: takeoff, compute: compute, selfCheck: selfCheck, up: up, fmt: fmt, canon: canon,
                    TAKEOFF_RULES_VERSION: TAKEOFF_RULES_VERSION};
}
