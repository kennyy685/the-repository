/* HMP App job tracker (T199): research round 56's 14-step runbook for an insurance job HMP runs itself, from the signed
 * contingency agreement to the handwritten thank-you note (docs/research/2026-09-27-round-56.md).
 *
 *   HMPJobTrack.model(claim, opts)      -> {steps[14], current, next, doneN, fin, gates, reminders}
 *   HMPJobTrack.tapPatch(claim, key, opts) -> {patch, undo, step} | {blocked: [{en, es}]}   (one tap = today's date)
 *   HMPJobTrack.checkWrite(old, next, opts) -> null | {en, es}   (the Right Hand chat's update_claim runs this)
 *   HMPJobTrack.gates(claim, opts)      -> {work: {ok, missing[], cancelEnd, startOn}, materials: {ok, missing[]}}
 *   HMPJobTrack.reminders(claim, opts)  -> [{key, step, due, level: "due" (amber) | "late" (red), text{en, es}}]
 *   HMPJobTrack.cancelEnd(day)          -> the last day of the 3-business-day cancel window (Sundays and federal holidays
 *                                          don't count: the same rule as the app's cancelByDay)
 * opts = {today: "YYYY-MM-DD", leadSigned: lead.signed_on (the contingency, from the Sale Guide), reviewSent: the day the
 * lead's review text went out, fmt(day, "en"|"es") -> a short date}. Every string is {en, es}; the page picks one.
 *
 * Data: the claim's existing fields are reused (scope_date, acv, mortgage, materials, install, completion_sent,
 * depreciation_check, stage); the new per-step dates live in claim.job (SHAPE below, additive only). Old claims render:
 * a step with no date counts as done once the claim's stage is past it, except the legal ones (1, 5, 9, 14), which
 * only a logged date closes.
 *
 * Hard stops (round 56 pre-mortem): tear-off / install can't be logged until the itemized description went to the
 * homeowner AND the insurer (NE 44-8606) and the contract's 3-day cancel window has ended (69-1601); materials can't be
 * logged as ordered until the ACV check is deposited or a supplier account is approved.
 * Pro tool: what, who, paper, when, the legal line. No sales coaching. Nothing about covering, waiving or rebating a
 * deductible (44-8604), no promise of what insurance pays, no assignment of benefits (44-8605), "registered" only.
 * No dependencies; one closure; sets window.HMPJobTrack (and module.exports under node).
 */
(function (root) {
"use strict";
var JOBTRACK_VERSION = 1;
var CLAIM_STEPS = ["inspected", "claim_filed", "adjuster_set", "scope_in", "signed", "supplement", "materials_ordered", "installed", "depreciation_requested", "paid"];

/* ---------- small helpers (dates are "YYYY-MM-DD" strings, math in UTC so the phone's zone never shifts a day) ---------- */
function str(v) { return v === null || v === undefined ? "" : typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : ""; }
function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
function obj(v) { return isObj(v) ? v : {}; }
function day(v) {
  if (typeof v !== "string") return null;
  var s = v.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  var d = new Date(s + "T00:00:00Z");
  return isNaN(d) || d.toISOString().slice(0, 10) !== s ? null : s;
}
function yes(v) { return v === true || (typeof v === "string" && v.trim() !== "" && !/^(false|no|0)$/i.test(v.trim())); }
function num(v) { if (typeof v === "number" && isFinite(v)) return v; if (typeof v === "string") { var s = v.replace(/[$,\s]/g, ""); if (s !== "" && isFinite(+s)) return +s; } return null; }
function addDays(d, n) { var x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
function diff(a, b) { return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000); }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function get(o, path) { for (var i = 0; i < path.length; i++) { if (!isObj(o)) return undefined; o = o[path[i]]; } return o; }
function stageIdx(s) { return CLAIM_STEPS.indexOf(s); }
var MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var MON_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDefault(d, lg) { return lg === "es" ? (+d.slice(8, 10)) + " " + MON_ES[+d.slice(5, 7) - 1] : MON_EN[+d.slice(5, 7) - 1] + " " + (+d.slice(8, 10)); }
function both(f) { return { en: f("en"), es: f("es") }; }

/* ---------- the 3-day cancel: 3 business days after signing; Sundays and federal holidays (and their observed days) don't count ---------- */
var HOLI = {};
function fedHolidays(y) {
  if (HOLI[y]) return HOLI[y];
  var ymd = function (m, d) { return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10); };
  var dow = function (s) { return new Date(s + "T00:00:00Z").getUTCDay(); };
  var nth = function (m, w, n) { var c = 0; for (var d = 1; d <= 31; d++) { var s = ymd(m, d); if (dow(s) === w && ++c === n) return s; } return null; };
  var last = function (m, w) { for (var d = 31; d >= 1; d--) { var s = ymd(m, d); if (+s.slice(5, 7) === m + 1 && dow(s) === w) return s; } return null; };
  var out = {};
  [[0, 1], [5, 19], [6, 4], [10, 11], [11, 25]].forEach(function (md) {
    var s = ymd(md[0], md[1]), w = dow(s); out[s] = 1;
    if (w === 6) out[addDays(s, -1)] = 1; else if (w === 0) out[addDays(s, 1)] = 1;
  });
  if (new Date(Date.UTC(y + 1, 0, 1)).getUTCDay() === 6) out[y + "-12-31"] = 1;
  [nth(0, 1, 3), nth(1, 1, 3), last(4, 1), nth(8, 1, 1), nth(9, 1, 2), nth(10, 4, 4)].forEach(function (s) { if (s) out[s] = 1; });
  HOLI[y] = out;
  return out;
}
function cancelEnd(signed) {
  var d = day(signed); if (!d) return null;
  var n = 0;
  while (n < 3) { d = addDays(d, 1); if (new Date(d + "T00:00:00Z").getUTCDay() !== 0 && !fedHolidays(+d.slice(0, 4))[d]) n++; }
  return d;
}

/* ---------- words (EN + ES, usted) ---------- */
var T = {
  gHo: { en: "Itemized description sent to the homeowner", es: "Descripción detallada enviada al dueño" },
  gIns: { en: "Itemized description sent to the insurer", es: "Descripción detallada enviada a la aseguradora" },
  gContract: { en: "Contract signing date logged (step 4)", es: "Fecha de firma del contrato anotada (paso 4)" },
  gCancel: function (end, f) { return both(function (lg) { return lg === "es" ? "Termina el plazo de cancelación de 3 días (medianoche del " + f(end, lg) + ")" : "3-day cancel window over (ends midnight " + f(end, lg) + ")"; }); },
  gMat: { en: "ACV check deposited, or a supplier account approved", es: "Cheque ACV depositado, o cuenta con proveedor aprobada" },
  lockWork: { en: "Tear-off locked until", es: "Quitar lo viejo, bloqueado hasta" },
  lockMat: { en: "Materials order locked until", es: "Pedido de material, bloqueado hasta" },
  cancelInfo: function (end, f) { return both(function (lg) { return lg === "es" ? "Cancelación de 3 días: hasta la medianoche del " + f(end, lg) + ". La obra puede empezar el " + f(addDays(end, 1), lg) + "." : "3-day cancel ends midnight " + f(end, lg) + ". Work can start " + f(addDays(end, 1), lg) + "."; }); },
  noDate: { en: "Signed (date not logged)", es: "Firmado (sin fecha anotada)" },
  adjSet: function (d, f) { return both(function (lg) { return lg === "es" ? "Cita puesta: " + f(d, lg) : "Meeting set: " + f(d, lg); }); },
  acvAmt: function (a) { return both(function (lg) { return (lg === "es" ? "Cheque ACV: $" : "ACV check: $") + Math.round(a).toLocaleString("en-US"); }); },
  mortCo: function (co) { return both(function (lg) { return (lg === "es" ? "Banco hipotecario: " : "Mortgage company: ") + co; }); },
  supplier: function (s) { return both(function (lg) { return (lg === "es" ? "Proveedor: " : "Supplier: ") + s; }); },
  crewInfo: function (name, start, f) { return both(function (lg) { return [name ? (lg === "es" ? "Cuadrilla: " : "Crew: ") + name : "", start ? (lg === "es" ? "Inicio: " : "Start: ") + f(start, lg) : ""].filter(Boolean).join(" · "); }); },
  permitInfo: function (no, city) { return both(function (lg) { return [no ? (lg === "es" ? "Permiso #" : "Permit #") + no : "", city].filter(Boolean).join(" · "); }); },
  warrantyBy: function (d, f) { return both(function (lg) { return lg === "es" ? "Registre la garantía del fabricante a más tardar el " + f(d, lg) + " (muchas marcas dan 30 a 60 días)." : "Register the manufacturer warranty by " + f(d, lg) + " (many brands allow 30 to 60 days)."; }); },
  suppOpen: function (n) { return both(function (lg) { return lg === "es" ? n + (n === 1 ? " suplemento sin respuesta" : " suplementos sin respuesta") : n + (n === 1 ? " supplement waiting on an answer" : " supplements waiting on an answer"); }); },
  depHeld: function (a) { return both(function (lg) { return (lg === "es" ? "Depreciación retenida: $" : "Depreciation held: $") + Math.round(a).toLocaleString("en-US"); }); },
  rMort: function (co, d, f) { return both(function (lg) { return lg === "es" ? "Endoso con " + co + ": el cheque ACV llegó el " + f(d, lg) + ". El dueño llama hoy al departamento de reclamos (loss draft)." : "Mortgage endorsement with " + co + ": the ACV check came " + f(d, lg) + ". The homeowner calls the loss-draft department today."; }); },
  rMort0: function (d, f) { return both(function (lg) { return lg === "es" ? "Cheque ACV recibido el " + f(d, lg) + ": si trae un banco hipotecario, el endoso empieza hoy; si no, deposítelo." : "ACV check in " + f(d, lg) + ": if a mortgage company is on it, the endorsement starts today; if not, deposit it."; }); },
  rDep: function (d, f) { return both(function (lg) { return lg === "es" ? "Solicitud de depreciación (factura final + fecha de terminado): el trabajo terminó el " + f(d, lg) + "." : "Depreciation request (final invoice + completion date): the job finished " + f(d, lg) + "."; }); },
  rRev: function (d, f) { return both(function (lg) { return lg === "es" ? "Enlace de reseña al dueño a más tardar el " + f(d, lg) + " (24 horas después de terminar)." : "Review link to the homeowner by " + f(d, lg) + " (24 hours after completion)."; }); },
  rWar: function (d, f) { return both(function (lg) { return lg === "es" ? "Registro de la garantía del fabricante a más tardar el " + f(d, lg) + "." : "Manufacturer warranty registration due " + f(d, lg) + "."; }); },
  short: { mortgage: { en: "Mortgage endorsement", es: "Endoso del banco" }, depreciation: { en: "Depreciation request", es: "Pedir depreciación" },
    review: { en: "Review link", es: "Enlace de reseña" }, warranty: { en: "Warranty registration", es: "Registro de garantía" }, build: { en: "Build day: tear-off locked", es: "Día de obra: bloqueado" } },
  rBuild: function (d, f) { return both(function (lg) { return lg === "es" ? "Día de obra " + f(d, lg) + ": quitar lo viejo sigue bloqueado (paso 10)." : "Build day " + f(d, lg) + ": tear-off is still locked (step 10)."; }); }
};

/* ---------- the 14 steps (round 56). papers: kit = a piece in docs/print/ (the Print Kit page), else a paper that comes from
   someone else. parts: what one tap logs (path = where the date lives in the claim), need(c) = "req" | "opt" | "hide",
   gate = a hard stop, bump = the claim stage this moves the claim up to (never back), tell = logged through the chat
   (a money amount comes with it). infer = the claim stage past which an undated step still counts as done (old claims). ---------- */
var P = {
  contingency: { en: "Contingency agreement", es: "Acuerdo contingente", kit: true },
  cancel: { en: "Cancel notice (2 copies, EN + ES)", es: "Aviso de cancelación (2 copias, inglés y español)", kit: true },
  adjuster: { en: "Adjuster meeting", es: "Cita con el ajustador", kit: true },
  supplement: { en: "Supplement checklist", es: "Lista de suplementos", kit: true },
  inspection: { en: "Inspection report (photos)", es: "Reporte de inspección (fotos)", kit: true },
  scope: { en: "The insurer's written scope", es: "El alcance escrito de la aseguradora", kit: false },
  contract: { en: "Job contract (deductible notice inside)", es: "Contrato de trabajo (con el aviso del deducible)", kit: true },
  itemized: { en: "Estimate packet (itemized: work, materials, labor, fees, total)", es: "Paquete de presupuesto (detallado: trabajo, materiales, mano de obra, cargos, total)", kit: true },
  acvCheck: { en: "The ACV check", es: "El cheque ACV", kit: false },
  loss: { en: "Mortgage company loss-draft forms", es: "Formularios de reclamo (loss draft) del banco", kit: false },
  credit: { en: "Supplier credit application", es: "Solicitud de crédito del proveedor", kit: false },
  order: { en: "Material order list (in the app)", es: "Lista de material (en la app)", kit: false },
  permit: { en: "City permit application", es: "Solicitud de permiso de la ciudad", kit: false },
  photos: { en: "Photos of all 4 sides: before, during, after", es: "Fotos de los 4 lados: antes, durante, después", kit: false },
  sidingScope: { en: "Siding scope sheet", es: "Hoja de alcance de siding", kit: true },
  certificate: { en: "Completion certificate", es: "Certificado de terminación", kit: true },
  lien: { en: "Lien waiver", es: "Renuncia de gravamen", kit: true },
  warranty: { en: "Manufacturer warranty registration", es: "Registro de la garantía del fabricante", kit: false },
  invoice: { en: "Final invoice + completion date", es: "Factura final + fecha de terminado", kit: false },
  yardSign: { en: "Yard sign", es: "Letrero de jardín", kit: true },
  note: { en: "Handwritten thank-you note", es: "Nota de agradecimiento escrita a mano", kit: false }
};
var REQ = function () { return "req"; }, OPT = function () { return "opt"; };
var STEPS = [
  { id: "contingency", n: 1, legal: true,
    title: { en: "Contingency agreement signed", es: "Acuerdo contingente firmado" },
    short: { en: "Contingency", es: "Acuerdo contingente" },
    who: { en: "You + the homeowner, after the free inspection", es: "Usted + el dueño, después de la inspección gratis" },
    papers: [P.contingency, P.cancel],
    when: { en: "Day 0, the same visit as the inspection", es: "Día 0, en la misma visita de la inspección" },
    law: { en: "3-day cancel form in English and Spanish (69-1601, 69-1604). Deductible notice (44-8607). Nothing charged before the cancel window ends (69-1606(5)). A written claim denial opens another 3-business-day cancel right (44-8603). No assignment of benefits (44-8605).",
      es: "Formulario de cancelación de 3 días en inglés y español (69-1601, 69-1604). Aviso del deducible (44-8607). No se cobra nada antes de que termine el plazo de cancelación (69-1606(5)). Una negación escrita del reclamo abre otro derecho de cancelar de 3 días hábiles (44-8603). Sin cesión de beneficios (44-8605)." },
    money: { en: "$0", es: "$0" },
    parts: [{ k: "contingency", path: ["job", "contingency_signed"], en: "Contingency signed", es: "Acuerdo firmado", need: REQ }] },
  { id: "adjuster", n: 2, infer: "scope_in",
    title: { en: "Adjuster meeting", es: "Cita con el ajustador" },
    short: { en: "Adjuster meeting", es: "Cita con el ajustador" },
    who: { en: "You + the homeowner, with the insurer's adjuster", es: "Usted + el dueño, con el ajustador de la aseguradora" },
    papers: [P.adjuster, P.supplement, P.inspection],
    when: { en: "Usually day 7 to 30", es: "Normalmente del día 7 al 30" },
    law: { en: "Document the damage only. Never negotiate the claim: that is public-adjuster work and needs a license (44-9204). Never promise what insurance pays.",
      es: "Solo documente el daño. Nunca negocie el reclamo: eso es trabajo de ajustador público y requiere licencia (44-9204). Nunca prometa lo que paga el seguro." },
    money: { en: "$0", es: "$0" },
    parts: [{ k: "adjuster", path: ["job", "adjuster_met"], en: "Meeting done", es: "Cita hecha", need: REQ, bump: "adjuster_set" }] },
  { id: "scope", n: 3, infer: "scope_in",
    title: { en: "Claim approved + scope in", es: "Reclamo aprobado + alcance recibido" },
    short: { en: "Approval + scope", es: "Aprobación + alcance" },
    who: { en: "The insurer sends it; you check it the same day", es: "La aseguradora lo manda; usted lo revisa el mismo día" },
    papers: [P.scope, P.supplement],
    when: { en: "Usually day 14 to 45", es: "Normalmente del día 14 al 45" },
    law: { en: "Anything missing goes to the insurer in writing, with photos.", es: "Lo que falte va a la aseguradora por escrito, con fotos." },
    money: { en: "The ACV check often comes in this window", es: "El cheque ACV suele llegar en estas fechas" },
    parts: [{ k: "scope", path: ["scope_date"], en: "Approval + scope in", es: "Aprobación + alcance recibido", need: REQ, bump: "scope_in" }] },
  { id: "contract", n: 4, infer: "signed",
    title: { en: "Job contract signed + 3-day cancel", es: "Contrato firmado + cancelación de 3 días" },
    short: { en: "Contract + 3-day cancel", es: "Contrato + cancelación" },
    who: { en: "You + every buyer; an HMP rep signs", es: "Usted + cada comprador; firma un representante de HMP" },
    papers: [P.contract, P.cancel],
    when: { en: "After approval, usually day 15 to 50", es: "Después de la aprobación, normalmente del día 15 al 50" },
    law: { en: "Written contract only. Deductible notice signed (44-8607). 2 cancel forms, English and Spanish, buyer initials (69-1601, 69-1604(3)). No work before the cancel window ends.",
      es: "Solo contrato por escrito. Aviso del deducible firmado (44-8607). 2 formularios de cancelación, en inglés y español, con iniciales del comprador (69-1601, 69-1604(3)). Ningún trabajo antes de que termine el plazo de cancelación." },
    money: { en: "Deposit per the contract (§5). Bank it after the cancel window ends.", es: "Depósito según el contrato (§5). Deposítelo después de que termine el plazo de cancelación." },
    parts: [{ k: "contract", path: ["job", "contract_signed"], en: "Contract signed", es: "Contrato firmado", need: REQ, bump: "signed" }] },
  { id: "itemized", n: 5, legal: true, stop: true,
    title: { en: "Itemized description to the homeowner AND the insurer", es: "Descripción detallada al dueño Y a la aseguradora" },
    short: { en: "Itemized description", es: "Descripción detallada" },
    who: { en: "You send both copies", es: "Usted manda las dos copias" },
    papers: [P.itemized],
    when: { en: "Before tear-off starts", es: "Antes de empezar a quitar lo viejo" },
    law: { en: "NE 44-8606: work, materials, labor, fees and the total, to BOTH before any repair work starts. 44-8608: a violation voids the contract. Keep proof of both sends.",
      es: "NE 44-8606: trabajo, materiales, mano de obra, cargos y el total, a LOS DOS antes de empezar cualquier reparación. 44-8608: una violación anula el contrato. Guarde prueba de los dos envíos." },
    money: { en: "$0", es: "$0" },
    parts: [{ k: "itemized_ho", path: ["job", "itemized_sent", "homeowner"], en: "Sent to the homeowner", es: "Enviada al dueño", need: REQ },
      { k: "itemized_ins", path: ["job", "itemized_sent", "insurer"], en: "Sent to the insurer", es: "Enviada a la aseguradora", need: REQ }] },
  { id: "acv", n: 6, infer: "paid",
    title: { en: "ACV check + mortgage endorsement", es: "Cheque ACV + endoso del banco hipotecario" },
    short: { en: "ACV check + mortgage", es: "Cheque ACV + banco" },
    who: { en: "The insurer issues it; the homeowner calls the mortgage company's loss-draft department; you follow up", es: "La aseguradora lo emite; el dueño llama al departamento de reclamos (loss draft) de su banco; usted da seguimiento" },
    papers: [P.acvCheck, P.loss],
    when: { en: "The endorsement starts the day the check arrives. 1 to 3 weeks; longer on big claims.", es: "El endoso empieza el día que llega el cheque. De 1 a 3 semanas; más en reclamos grandes." },
    law: { en: "The check is the homeowner's. HMP is not named on it and takes no assignment of benefits (44-8605).", es: "El cheque es del dueño. HMP no aparece en el cheque y no acepta cesión de beneficios (44-8605)." },
    money: { en: "Money in: ACV = RCV − depreciation − deductible", es: "Entra: ACV = RCV − depreciación − deducible" },
    parts: [{ k: "acv_in", path: ["acv", "received"], en: "Check in", es: "Cheque recibido", need: REQ },
      { k: "mort_out", path: ["mortgage", "check_sent"], en: "Sent to the mortgage company", es: "Enviado al banco hipotecario", need: function (c) { return str(obj(c.mortgage).company) ? "req" : "opt"; } },
      { k: "mort_back", path: ["mortgage", "check_returned"], en: "Back from the mortgage company", es: "Regresó del banco hipotecario", need: function (c) { return yes(obj(c.mortgage).check_sent) ? "req" : "hide"; } },
      { k: "acv_dep", path: ["acv", "deposited"], en: "Deposited", es: "Depositado", need: REQ }] },
  { id: "materials", n: 7, infer: "materials_ordered", stop: true,
    title: { en: "Supplier account + materials ordered", es: "Cuenta con proveedor + material pedido" },
    short: { en: "Materials", es: "Material" },
    who: { en: "The boss or you apply; you order", es: "El jefe o usted aplica; usted pide" },
    papers: [P.credit, P.order],
    when: { en: "Apply before the job is signed", es: "Aplique antes de firmar el trabajo" },
    law: { en: "Hard stop: no order until the ACV check is deposited or a supplier account is approved. No fronting cash.", es: "Alto: no se pide material hasta depositar el cheque ACV o tener aprobada una cuenta con proveedor. No se adelanta dinero." },
    money: { en: "Money out: materials, about 22 to 28% of the job", es: "Sale: material, cerca del 22 al 28% del trabajo" },
    parts: [{ k: "supplier", path: ["job", "supplier_account", "approved"], en: "Supplier account approved", es: "Cuenta con proveedor aprobada", need: OPT },
      { k: "ordered", path: ["materials", "ordered"], en: "Materials ordered", es: "Material pedido", need: REQ, gate: "materials", bump: "materials_ordered" }] },
  { id: "crew", n: 8, infer: "installed",
    title: { en: "Crew scheduled", es: "Cuadrilla programada" },
    short: { en: "Crew", es: "Cuadrilla" },
    who: { en: "The boss", es: "El jefe" },
    papers: [],
    when: { en: "Before the contract's start date. Shingles seal at about 40°F and up, vinyl turns brittle under about 40°F, Hardie ColorPlus caulk needs 30°F and up.", es: "Antes de la fecha de inicio del contrato. Las tejas sellan desde unos 40°F, el vinil se pone quebradizo bajo unos 40°F, el sellador de Hardie ColorPlus necesita 30°F o más." },
    law: null,
    money: { en: "Money out: crew labor", es: "Sale: mano de obra" },
    parts: [{ k: "crew", path: ["job", "crew", "scheduled"], en: "Crew + start day set", es: "Cuadrilla y día de inicio puestos", need: REQ }] },
  { id: "permit", n: 9, legal: true,
    title: { en: "Permit pulled", es: "Permiso sacado" },
    short: { en: "Permit", es: "Permiso" },
    who: { en: "HMP, the registered contractor", es: "HMP, el contratista registrado" },
    papers: [P.permit],
    when: { en: "Before tear-off, ideally at contract signing", es: "Antes de quitar lo viejo; mejor al firmar el contrato" },
    law: { en: "Permit before work starts. Fremont: roof and siding need a permit and inspection, plus HMP's city contractor registration (Res. 2019-049). Other towns: call the permit desk first.",
      es: "Permiso antes de empezar. Fremont: techo y siding necesitan permiso e inspección, y el registro de HMP como contratista en la ciudad (Res. 2019-049). Otras ciudades: llame antes a la oficina de permisos." },
    money: { en: "Money out: the permit fee", es: "Sale: el costo del permiso" },
    parts: [{ k: "permit", path: ["job", "permit", "pulled"], en: "Permit pulled", es: "Permiso sacado", need: REQ }] },
  { id: "build", n: 10, infer: "installed", stop: true,
    title: { en: "Dumpster, tear-off, install, final inspection", es: "Contenedor, quitar lo viejo, instalar, inspección final" },
    short: { en: "Build", es: "Obra" },
    who: { en: "The crew; the city inspector signs off", es: "La cuadrilla; el inspector de la ciudad aprueba" },
    papers: [P.photos, P.sidingScope],
    when: { en: "Usually day 20 to 75", es: "Normalmente del día 20 al 75" },
    law: { en: "Hard stop: tear-off starts only after both itemized sends (44-8606) and after the 3-day cancel window ends (69-1601). City final inspection before close-out.",
      es: "Alto: quitar lo viejo empieza solo después de los dos envíos de la descripción detallada (44-8606) y de que termine el plazo de cancelación de 3 días (69-1601). Inspección final de la ciudad antes de cerrar." },
    money: { en: "Money out: dumpster or trailer", es: "Sale: contenedor o tráiler" },
    parts: [{ k: "dumpster", path: ["job", "dumpster"], en: "Dumpster or trailer set", es: "Contenedor o tráiler puesto", need: OPT },
      { k: "tear_off", path: ["install", "start"], en: "Tear-off started", es: "Empezó a quitar lo viejo", need: REQ, gate: "work" },
      { k: "installed", path: ["install", "done"], en: "Install done", es: "Instalación terminada", need: REQ, gate: "work", bump: "installed" },
      { k: "final_insp", path: ["job", "final_inspection"], en: "City final inspection passed", es: "Inspección final de la ciudad aprobada", need: REQ }] },
  { id: "completion", n: 11, infer: "depreciation_requested",
    title: { en: "Completion certificate + packet", es: "Certificado de terminación + paquete" },
    short: { en: "Completion", es: "Terminación" },
    who: { en: "You, at the final walk-through with the homeowner", es: "Usted, en el recorrido final con el dueño" },
    papers: [P.certificate, P.lien, P.photos, P.warranty],
    when: { en: "The day the job finishes", es: "El día que se termina el trabajo" },
    law: null,
    money: { en: "Starts the depreciation request (step 12)", es: "Activa la solicitud de depreciación (paso 12)" },
    parts: [{ k: "cert", path: ["completion_sent"], en: "Certificate signed + sent to the insurer", es: "Certificado firmado + enviado a la aseguradora", need: REQ },
      { k: "pk_photos", path: ["job", "packet", "photos"], en: "Before/after photos to the homeowner", es: "Fotos de antes y después al dueño", need: OPT },
      { k: "pk_lien", path: ["job", "packet", "lien_waiver"], en: "Lien waiver given", es: "Renuncia de gravamen entregada", need: OPT },
      { k: "pk_warranty", path: ["job", "packet", "warranty"], en: "Manufacturer warranty registered", es: "Garantía del fabricante registrada", need: OPT }] },
  { id: "depreciation", n: 12, infer: "depreciation_requested",
    title: { en: "Depreciation request + supplements", es: "Solicitud de depreciación + suplementos" },
    short: { en: "Depreciation request", es: "Pedir depreciación" },
    who: { en: "You", es: "Usted" },
    papers: [P.invoice, P.supplement],
    when: { en: "The same day the install is done", es: "El mismo día que se termina la instalación" },
    law: { en: "Supplements go in writing, with photos. HMP never negotiates the settlement (44-9204).", es: "Los suplementos van por escrito, con fotos. HMP nunca negocia el acuerdo (44-9204)." },
    money: { en: "Money in: depreciation (check 2), if the policy pays it back", es: "Entra: la depreciación (cheque 2), si la póliza la devuelve" },
    parts: [{ k: "dep_req", path: ["job", "depreciation_requested"], en: "Depreciation requested", es: "Depreciación solicitada", need: REQ, bump: "depreciation_requested" }] },
  { id: "final", n: 13, infer: "paid",
    title: { en: "Final check in + job closed", es: "Cheque final + trabajo cerrado" },
    short: { en: "Final check", es: "Cheque final" },
    who: { en: "You", es: "Usted" },
    papers: [],
    when: { en: "Usually by day 90", es: "Normalmente para el día 90" },
    law: { en: "The deductible is the homeowner's to pay: HMP never covers, waives or rebates it (44-8604).", es: "El deducible lo paga el dueño: HMP nunca lo cubre, lo perdona ni lo rebaja (44-8604)." },
    money: { en: "Money in: the rest. The mortgage company may need to endorse check 2 too.", es: "Entra: el resto. Puede que el banco también tenga que endosar el cheque 2." },
    parts: [{ k: "final_check", path: ["depreciation_check", "date"], en: "Final check deposited", es: "Cheque final depositado", tell: true, need: function (c) { return num(c.depreciation_held) === 0 ? "hide" : "req"; } },
      { k: "closed", path: ["job", "closed"], en: "Job closed (paid)", es: "Trabajo cerrado (pagado)", need: REQ, bump: "paid" }] },
  { id: "closeout", n: 14, legal: true,
    title: { en: "Yard sign, review link, thank-you note", es: "Letrero, enlace de reseña, nota de agradecimiento" },
    short: { en: "Sign, review, note", es: "Letrero, reseña, nota" },
    who: { en: "You", es: "Usted" },
    papers: [P.yardSign, P.note],
    when: { en: "Review link within 24 hours of completion", es: "Enlace de reseña dentro de 24 horas de terminar" },
    law: { en: "Nothing of value for a review or a referral (FTC, Google). Referral thanks: a handwritten note only, no gifts or money.", es: "Nada de valor a cambio de una reseña o una recomendación (FTC, Google). Agradecimiento por una recomendación: solo una nota escrita a mano, sin regalos ni dinero." },
    money: { en: "Money out: the yard sign", es: "Sale: el letrero" },
    parts: [{ k: "yard_sign", path: ["job", "yard_sign"], en: "Yard sign up", es: "Letrero puesto", need: REQ },
      { k: "review", path: ["job", "review_requested"], en: "Review link sent", es: "Enlace de reseña enviado", need: REQ },
      { k: "thanks", path: ["job", "thank_you_note"], en: "Handwritten thank-you note sent", es: "Nota de agradecimiento escrita a mano enviada", need: REQ }] }
];
var PART = {};
STEPS.forEach(function (s) { s.parts.forEach(function (p) { PART[p.k] = { step: s, part: p }; }); });

/* the claim.job fields the Right Hand chat may write (d = date, s = text); every one is optional */
var SHAPE = {
  contingency_signed: "d", adjuster_met: "d", contract_signed: "d", cancel_by: "d",
  itemized_sent: { homeowner: "d", insurer: "d" },
  supplier_account: { name: "s", number: "s", approved: "d" },
  crew: { name: "s", scheduled: "d", start: "d" },
  permit: { pulled: "d", number: "s", city: "s" },
  dumpster: "d", final_inspection: "d",
  packet: { photos: "d", lien_waiver: "d", warranty: "d" },
  depreciation_requested: "d", closed: "d", yard_sign: "d", review_requested: "d", thank_you_note: "d"
};

/* which step each claim.job field belongs to (the chat's receipt names the step) */
var JOB_STEP = { contingency_signed: 1, adjuster_met: 2, contract_signed: 4, cancel_by: 4, itemized_sent: 5, supplier_account: 7, crew: 8, permit: 9,
  dumpster: 10, final_inspection: 10, packet: 11, depreciation_requested: 12, closed: 13, yard_sign: 14, review_requested: 14, thank_you_note: 14 };

function opt(o) { o = o || {}; return { today: day(o.today) || new Date().toISOString().slice(0, 10), leadSigned: day(o.leadSigned), reviewSent: day(o.reviewSent) || (yes(o.reviewSent) ? true : null), fmt: typeof o.fmt === "function" ? o.fmt : fmtDefault }; }

/* ---------- hard stops ---------- */
function gates(c, o) {
  o = opt(o); c = obj(c);
  var job = obj(c.job), it = obj(job.itemized_sent), t = o.today, f = o.fmt;
  var signed = day(job.contract_signed), end = signed ? cancelEnd(signed) : null;
  if (day(job.cancel_by) && (!end || job.cancel_by > end)) end = day(job.cancel_by);
  var miss = [];
  var sentOk = function (v) { var d = day(v); return !!d && d <= t; };
  if (!sentOk(it.homeowner)) miss.push(T.gHo);
  if (!sentOk(it.insurer)) miss.push(T.gIns);
  if (!end) miss.push(T.gContract); else if (!(t > end)) miss.push(T.gCancel(end, f));
  var matOk = yes(obj(c.acv).deposited) || !!day(obj(job.supplier_account).approved);
  return { work: { ok: !miss.length, missing: miss, cancelEnd: end, startOn: end ? addDays(end, 1) : null },
    materials: { ok: matOk, missing: matOk ? [] : [T.gMat] } };
}

/* ---------- due reminders: amber (level "due") on the day, red (level "late") after ---------- */
function reminders(c, o) {
  o = opt(o); c = obj(c);
  if (c.stage === "lost" || c.stage === "paid") return [];
  var t = o.today, f = o.fmt, out = [];
  var acv = obj(c.acv), mort = obj(c.mortgage), job = obj(c.job), inst = obj(c.install);
  var add = function (key, step, due, text, from) { if (t < (from || due)) return; out.push({ key: key, step: step, due: due, level: t > due ? "late" : "due", text: text, short: T.short[key] }); };
  var rec = day(acv.received);
  if (rec && !yes(mort.check_sent) && !yes(acv.deposited)) add("mortgage", 6, rec, str(mort.company) ? T.rMort(str(mort.company), rec, f) : T.rMort0(rec, f));
  var fin = [day(inst.done), day(c.completion_sent)].filter(Boolean).sort()[0] || null;
  if (fin && !day(job.depreciation_requested) && !yes(job.depreciation_requested) && stageIdx(c.stage) < stageIdx("depreciation_requested") && num(c.depreciation_held) !== 0)
    add("depreciation", 12, fin, T.rDep(fin, f));
  if (fin && !yes(job.review_requested) && !o.reviewSent) add("review", 14, addDays(fin, 1), T.rRev(addDays(fin, 1), f), fin);
  var done = day(inst.done);
  if (done && !yes(obj(job.packet).warranty)) add("warranty", 11, addDays(done, 30), T.rWar(addDays(done, 30), f), addDays(done, 23));
  var start = day(obj(job.crew).start);
  if (start && !yes(inst.start) && !gates(c, o).work.ok) add("build", 10, start, T.rBuild(start, f), addDays(start, -3));
  return out.sort(function (a, b) { return (a.level === b.level ? 0 : a.level === "late" ? -1 : 1) || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0); });
}

/* ---------- the model: every step's parts, status and facts; the current step = the first open one ---------- */
function model(c, o) {
  o = opt(o); c = obj(c);
  var t = o.today, f = o.fmt, g = gates(c, o), si = stageIdx(c.stage), fin = c.stage === "paid" || c.stage === "lost";
  var job = obj(c.job), steps = [];
  STEPS.forEach(function (s) {
    var parts = [];
    s.parts.forEach(function (p) {
      var need = p.need(c); if (need === "hide") return;
      var v = get(c, p.path);
      if (p.k === "contingency" && !yes(v) && o.leadSigned) v = o.leadSigned;
      if (p.k === "review" && !yes(v) && o.reviewSent) v = o.reviewSent;
      var on = yes(v), lock = null;
      if (!on && p.gate && !g[p.gate].ok) lock = [p.gate === "work" ? T.lockWork : T.lockMat].concat(g[p.gate].missing);
      parts.push({ k: p.k, en: p.en, es: p.es, need: need, tell: !!p.tell, val: on ? (day(v) || true) : null, state: on ? "done" : lock ? "locked" : "open", lock: lock });
    });
    var req = parts.filter(function (p) { return p.need === "req"; });
    var reqDone = req.filter(function (p) { return p.state === "done"; }).length;
    var logged = req.length > 0 && reqDone === req.length;
    var inferred = !logged && !!s.infer && si >= 0 && si >= stageIdx(s.infer);
    var dates = parts.filter(function (p) { return p.need === "req" && typeof p.val === "string"; }).map(function (p) { return p.val; }).sort();
    var info = [];
    if (s.id === "adjuster" && day(c.adjuster_date)) info.push(T.adjSet(day(c.adjuster_date), f));
    if (s.id === "contract" && g.work.cancelEnd) info.push(T.cancelInfo(g.work.cancelEnd, f));
    if (s.id === "contract" && inferred) info.push(T.noDate);
    if (s.id === "acv" && num(obj(c.acv).amount) != null) info.push(T.acvAmt(num(obj(c.acv).amount)));
    if (s.id === "acv" && str(obj(c.mortgage).company)) info.push(T.mortCo(str(obj(c.mortgage).company)));
    if (s.id === "materials") { var sa = obj(job.supplier_account), ms = str(obj(c.materials).supplier) || str(sa.name); if (ms || str(sa.number)) info.push(T.supplier([ms, str(sa.number) ? "#" + str(sa.number) : ""].filter(Boolean).join(" "))); }
    if (s.id === "crew" && (str(obj(job.crew).name) || day(obj(job.crew).start))) info.push(T.crewInfo(str(obj(job.crew).name), day(obj(job.crew).start), f));
    if (s.id === "permit" && (str(obj(job.permit).number) || str(obj(job.permit).city))) info.push(T.permitInfo(str(obj(job.permit).number), str(obj(job.permit).city)));
    if (s.id === "completion" && day(obj(c.install).done) && !yes(obj(job.packet).warranty)) info.push(T.warrantyBy(addDays(day(obj(c.install).done), 30), f));
    if (s.id === "depreciation") { var sp = (Array.isArray(c.supplements) ? c.supplements : []).filter(function (x) { return isObj(x) && (x.approved == null || x.approved === ""); }).length; if (sp) info.push(T.suppOpen(sp)); }
    if (s.id === "final" && num(c.depreciation_held)) info.push(T.depHeld(num(c.depreciation_held)));
    steps.push({ id: s.id, n: s.n, title: s.title, short: s.short, who: s.who, papers: s.papers, when: s.when, law: s.law, money: s.money, stop: !!s.stop, legal: !!s.legal,
      parts: parts, reqN: req.length, reqDone: reqDone, done: logged || inferred, inferred: inferred, doneOn: logged ? dates[dates.length - 1] || null : null, info: info, status: "" });
  });
  var by = {}; steps.forEach(function (s) { by[s.id] = s; });
  steps.forEach(function (s) {
    if (s.done) s.status = "done";
    else if (fin || (s.id === "contingency" && by.contract.done) || (s.id === "adjuster" && by.scope.done)) s.status = "skipped";   // passed: the later paper supersedes it
    else s.status = "open";
  });
  var open = steps.filter(function (s) { return s.status === "open"; });
  return { version: JOBTRACK_VERSION, steps: steps, current: open.length ? open[0].id : null, next: open.length > 1 ? open[1].id : null,
    doneN: steps.filter(function (s) { return s.status !== "open"; }).length, fin: fin, lost: c.stage === "lost", gates: g, reminders: reminders(c, o) };
}

/* ---------- one tap: today's date on that part (the whole sub-object is written, so a queued merge never drops a sibling) ---------- */
function tapPatch(c, key, o) {
  o = opt(o); c = obj(c);
  var hit = PART[key]; if (!hit) return { blocked: [{ en: "Unknown step", es: "Paso desconocido" }] };
  var p = hit.part, g = gates(c, o), t = o.today;
  if (p.gate && !g[p.gate].ok) return { blocked: [p.gate === "work" ? T.lockWork : T.lockMat].concat(g[p.gate].missing) };
  var top = p.path[0], patch = {};
  if (p.path.length === 1) patch[top] = t;
  else {
    var root0 = isObj(c[top]) ? clone(c[top]) : {}, o2 = root0;
    for (var i = 1; i < p.path.length - 1; i++) { o2[p.path[i]] = isObj(o2[p.path[i]]) ? o2[p.path[i]] : {}; o2 = o2[p.path[i]]; }
    o2[p.path[p.path.length - 1]] = t;
    if (key === "contract") root0.cancel_by = cancelEnd(t);
    patch[top] = root0;
  }
  if (p.bump && c.stage !== "lost" && stageIdx(c.stage) < stageIdx(p.bump)) patch.stage = p.bump;
  var undo = {}; Object.keys(patch).forEach(function (k) { undo[k] = c[k] === undefined ? null : clone(c[k]); });
  return { patch: patch, undo: undo, step: hit.step.n };
}

/* ---------- the chat's check: a write may not start the work or order materials past a hard stop ---------- */
function checkWrite(old, next, o) {
  o = opt(o); old = obj(old); next = obj(next);
  var from = stageIdx(old.stage), to = stageIdx(next.stage), g = gates(next, o);
  var newly = function (path) { return !yes(get(old, path)) && yes(get(next, path)); };
  var past = function (s) { return to >= stageIdx(s) && from < stageIdx(s) && next.stage !== "paid"; };
  var say = function (head, miss) { return { en: head.en + ": " + miss.map(function (m) { return m.en; }).join("; "), es: head.es + ": " + miss.map(function (m) { return m.es; }).join("; ") }; };
  if ((newly(["install", "start"]) || newly(["install", "done"]) || past("installed")) && !g.work.ok) return say(T.lockWork, g.work.missing);
  if ((newly(["materials", "ordered"]) || past("materials_ordered")) && !g.materials.ok) return say(T.lockMat, g.materials.missing);
  return null;
}

/* ---------- self-check: a few fixed cases (tests/js/jobtrack_check.js runs these and more) ---------- */
function selfCheck() {
  var bad = [];
  var eq = function (name, a, b) { if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(name + ": got " + JSON.stringify(a) + ", want " + JSON.stringify(b)); };
  eq("cancel Fri", cancelEnd("2026-09-25"), "2026-09-29");
  eq("cancel over Columbus Day", cancelEnd("2026-10-09"), "2026-10-14");
  eq("14 steps", STEPS.length, 14);
  var c = { stage: "signed", job: { contract_signed: "2026-09-25", itemized_sent: { homeowner: "2026-09-26" } } };
  eq("work locked", gates(c, { today: "2026-09-30" }).work.ok, false);
  c.job.itemized_sent.insurer = "2026-09-27";
  eq("work open", gates(c, { today: "2026-09-30" }).work.ok, true);
  eq("work locked in window", gates(c, { today: "2026-09-29" }).work.ok, false);
  return bad;
}

var api = { JOBTRACK_VERSION: JOBTRACK_VERSION, STEPS: STEPS, SHAPE: SHAPE, JOB_STEP: JOB_STEP, CLAIM_STEPS: CLAIM_STEPS, model: model, gates: gates, reminders: reminders,
  tapPatch: tapPatch, checkWrite: checkWrite, cancelEnd: cancelEnd, selfCheck: selfCheck };
root.HMPJobTrack = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
