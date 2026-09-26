/* HMP Translate: EN <-> ES for the door, the claim and the job site.
 *
 * Self-contained: no imports, no network of its own. In a page: <script src="translate.js"></script> (or paste it
 * inline) gives window.HMPTranslate. In node: require("./translate.js") (used by tests/js/translate_check.js).
 *
 *   HMPTranslate.init({glossary})           optional: a newer data/glossary_en_es.json; the embedded copy is the default
 *   await HMPTranslate.sayIt(text, "en", "es", {check:true, simpler:false})
 *        -> {ok, text, from, to, terms:[en...], back?, flags:[], blocked?, legal?}
 *        Uses the page's `sample` capability, glossary forced into the prompt. Any deductible or cancel-rights
 *        sentence is BLOCKED before any AI call and points to readLegal instead (44-8604, 69-1601).
 *   await HMPTranslate.backCheck(translated, "es", "en")   the back-translation on its own
 *   await HMPTranslate.simpler(text, "es")                  same language, shorter plainer words
 *   HMPTranslate.readLegal(id, lang, {speak, deadline})     FIXED, pre-verified notice text only. Never AI.
 *        ids: "cancel_right" (69-1601 statement), "cancel_notice" (notice of cancellation form),
 *             "deductible_notice" (44-8607, 5 sentences). lang "en" | "es".
 *   HMPTranslate.speak(text, lang, {rate}) / stopSpeaking() / voicesFor(lang)
 *   HMPTranslate.listen(lang) -> {done: Promise<string>, stop()} or null when the browser has no dictation
 *   HMPTranslate.checkRisk(text) -> {blocked, flags[], reason{en,es}, legal}
 *
 * Legal text lives in LEGAL below, copied word for word from docs/print/cancel-notice.html and
 * docs/print/contract-draft(-es).html. tests/js/translate_check.js fails if they ever drift apart.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HMPTranslate = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  // ---------- glossary (embedded copy of data/glossary_en_es.json; the check keeps them equal) ----------
  /* GLOSSARY:START */
  const GLOSSARY_DEFAULT = {"version":"2026-09-26","source":"docs/research/2026-09-26-round-13.md (draft; FilthE sanity-checks against real conversations)","rules":{"en":"These pairs are fixed. Every translation uses exactly these words. Never pair 'deducible' with cubrir, eliminar, rebajar, pagar or regalar (Neb. 44-8604). Say 'registered' contractor, never 'licensed'.","es":"Estas parejas son fijas. Cada traducción usa exactamente estas palabras. Nunca junte 'deducible' con cubrir, eliminar, rebajar, pagar o regalar (Neb. 44-8604). Diga contratista 'registrado', nunca 'licenciado'."},"terms":[{"cat":"roof","en":"roof","es":"techo","note":"Standard everywhere."},{"cat":"roof","en":"shingle","es":"teja asfáltica","note":"Mexico often says teja asfáltica; 'teja' alone can mean clay tile.","region":"MX"},{"cat":"roof","en":"metal roofing","es":"lámina","note":"Mexico favors lámina for metal roof panels.","region":"MX"},{"cat":"roof","en":"flashing","es":"tapajuntas","note":"Some crews say contra-techo.","region":"MX"},{"cat":"roof","en":"underlayment","es":"membrana","note":"The layer under the shingles."},{"cat":"roof","en":"gutter","es":"canaleta","note":"Also canalón in some countries."},{"cat":"roof","en":"downspout","es":"bajante","note":"The pipe that brings gutter water down."},{"cat":"roof","en":"soffit","es":"sofito","note":"Under the eaves."},{"cat":"roof","en":"fascia","es":"fascia","note":"Same word in both."},{"cat":"roof","en":"furring strip","es":"listón","note":"The 1x4 strips behind siding."},{"cat":"roof","en":"siding","es":"siding","note":"Siding is a common loanword in Mexican Spanish; revestimiento is the formal word. Use siding at the door.","region":"MX"},{"cat":"roof","en":"hail","es":"granizo","note":"Standard everywhere."},{"cat":"roof","en":"hail damage","es":"daño por granizo","note":""},{"cat":"roof","en":"wind damage","es":"daño por viento","note":""},{"cat":"roof","en":"tear-off","es":"quitar el techo viejo","note":"Crew word; describe it, don't invent a noun."},{"cat":"claim","en":"adjuster","es":"ajustador","note":"HMP standard. 'Perito' is used in some countries; don't use it."},{"cat":"claim","en":"claim","es":"reclamo","note":""},{"cat":"claim","en":"claim number","es":"número de reclamo","note":""},{"cat":"claim","en":"insurance company","es":"aseguradora","note":""},{"cat":"claim","en":"deductible","es":"deducible","note":"The homeowner pays it. Never say cubrir, eliminar, rebajar, pagar or regalar near this word (44-8604). Deductible sentences come only from the fixed notice."},{"cat":"claim","en":"depreciation","es":"depreciación","note":""},{"cat":"claim","en":"ACV (actual cash value)","es":"valor real en efectivo (ACV)","note":"The first check."},{"cat":"claim","en":"RCV (replacement cost value)","es":"costo de reemplazo (RCV)","note":"The full value."},{"cat":"claim","en":"supplement","es":"suplemento","note":"Extra items the insurer approves in writing."},{"cat":"claim","en":"scope of work","es":"alcance del trabajo","note":""},{"cat":"claim","en":"date of loss","es":"fecha del daño","note":"The storm date on the claim."},{"cat":"claim","en":"mortgage company","es":"compañía hipotecaria","note":"Often on the insurance check."},{"cat":"sale","en":"inspection","es":"inspección","note":""},{"cat":"sale","en":"free inspection","es":"inspección gratis","note":""},{"cat":"sale","en":"no obligation","es":"sin compromiso","note":""},{"cat":"sale","en":"estimate","es":"estimado","note":""},{"cat":"sale","en":"contract","es":"contrato","note":""},{"cat":"sale","en":"cancellation","es":"cancelación","note":"The 3-day right to cancel: read the fixed notice, never translate it live."},{"cat":"sale","en":"change order","es":"orden de cambio","note":"Matches the contract draft."},{"cat":"sale","en":"registered contractor","es":"contratista registrado","note":"Never 'licenciado': HMP is registered, not licensed."},{"cat":"sale","en":"homeowner","es":"dueño de casa","note":"Also propietario (more formal)."},{"cat":"sale","en":"warranty","es":"garantía","note":""},{"cat":"sale","en":"permit","es":"permiso","note":"Building permit = permiso de construcción."},{"cat":"roof","en":"drip edge","es":"gotero","note":"Metal strip at the roof edge that sheds water into the gutter."},{"cat":"roof","en":"ice and water shield","es":"membrana contra hielo y agua","note":"Sticky membrane at eaves and valleys; many crews just say 'ice and water'."},{"cat":"roof","en":"decking","es":"entablado","note":"The roof boards (OSB/plywood) under the underlayment; also 'tablas del techo'."},{"cat":"roof","en":"ridge cap","es":"caballete","note":"Shingles that cover the roof peak; also 'cumbrera'."},{"cat":"roof","en":"starter strip","es":"tira de arranque","note":"First row of shingles (or siding starter) at the bottom edge."},{"cat":"roof","en":"valley","es":"limahoya","note":"Where two roof slopes meet in a V; crews often say 'valle'."},{"cat":"roof","en":"vent","es":"ventila","note":"Roof or wall vent; soft metal that shows hail dents."},{"cat":"roof","en":"hail bruise","es":"golpe de granizo","note":"Soft spot on a shingle where hail cracked the mat; press it to feel it."},{"cat":"roof","en":"granule loss","es":"pérdida de gránulos","note":"Shingle granules knocked off; a hail sign when it's in fresh round spots."},{"cat":"siding","en":"J-channel","es":"canal J","note":"Trim that holds siding ends around windows and doors; also 'moldura J'."},{"cat":"siding","en":"house wrap","es":"barrera de aire y agua","note":"Wrap under the siding (Tyvek); crews often just say 'house wrap' or 'Tyvek'."},{"cat":"siding","en":"lap siding","es":"siding de traslape","note":"Horizontal boards that overlap (e.g. James Hardie lap)."},{"cat":"siding","en":"caulk","es":"sellador","note":"Also 'calafateo'; 'masilla' in some countries."},{"cat":"claim","en":"actual cash value (ACV) check","es":"cheque del valor real en efectivo","note":"First insurance check; depreciation is held back until the work is done."},{"cat":"claim","en":"registered","es":"registrado","note":"HMP is a REGISTERED contractor in Nebraska. Never say 'licensed' / 'licenciado' / 'con licencia'."},{"cat":"safety","en":"harness","es":"arnés","note":"Fall-protection harness; wear it on every roof."},{"cat":"safety","en":"tie off","es":"amarrarse","note":"Clip the harness to the anchor; 'amárrate' as an order."},{"cat":"safety","en":"ladder","es":"escalera","note":"Extension ladder; tie it off and keep 3 points of contact."},{"cat":"safety","en":"watch out!","es":"¡cuidado!","note":"Short warning shout; also '¡aguas!' (Mexico, very common on job sites).","region":"MX"},{"cat":"safety","en":"watch the edge","es":"cuidado con la orilla","note":"Roof edge warning."},{"cat":"safety","en":"hard hat","es":"casco","note":"Required when working under others."},{"cat":"safety","en":"safety glasses","es":"lentes de seguridad","note":"Also 'gafas de seguridad'."},{"cat":"safety","en":"gloves","es":"guantes","note":""},{"cat":"safety","en":"power line","es":"cable de luz","note":"Overhead electric line; keep ladders and metal away."}]};
  /* GLOSSARY:END */
  let glossary = GLOSSARY_DEFAULT;

  // ---------- fixed legal text (never generated, never translated live) ----------
  const BUSINESS_ADDRESS = "2600 Laverna St, Apt 50, Fremont, NE 68025";
  const LEGAL = {
    cancel_right: {
      law: "Neb. Rev. Stat. 69-1601",
      source: "docs/print/cancel-notice.html",
      title: { en: "Buyer's right to cancel", es: "Derecho del comprador a cancelar" },
      paras: {
        en: ["You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the attached notice of cancellation form for an explanation of this right."],
        es: ["Usted, el comprador, puede cancelar esta transacción en cualquier momento antes de la medianoche del tercer día hábil después de la fecha de esta transacción. Vea el formulario de aviso de cancelación adjunto para una explicación de este derecho."]
      }
    },
    cancel_notice: {
      law: "Neb. Rev. Stat. 69-1601 to 69-1604",
      source: "docs/print/cancel-notice.html",
      title: { en: "Notice of cancellation", es: "Aviso de cancelación" },
      paras: {
        en: [
          "YOU MAY CANCEL THIS TRANSACTION, WITHOUT ANY PENALTY OR OBLIGATION, WITHIN THREE BUSINESS DAYS FROM THE ABOVE DATE. IF THIS CONTRACT WILL BE PAID IN WHOLE OR IN PART FROM A PROPERTY OR CASUALTY INSURANCE CLAIM, YOU MAY ALSO CANCEL UNTIL MIDNIGHT OF THE THIRD BUSINESS DAY AFTER YOU RECEIVE WRITTEN NOTICE FROM YOUR INSURER THAT ALL OR PART OF THE CLAIM IS NOT COVERED, IF THAT IS LATER.",
          "IF YOU CANCEL, ANY PROPERTY TRADED IN, ANY PAYMENTS MADE BY YOU UNDER THE CONTRACT OR SALE, AND ANY NEGOTIABLE INSTRUMENT EXECUTED BY YOU WILL BE RETURNED WITHIN 10 DAYS FOLLOWING RECEIPT BY THE SELLER OF YOUR CANCELLATION NOTICE, AND ANY SECURITY INTEREST ARISING OUT OF THE TRANSACTION WILL BE CANCELLED.",
          "IF YOU CANCEL, YOU MUST MAKE AVAILABLE TO THE SELLER AT YOUR RESIDENCE, IN SUBSTANTIALLY AS GOOD CONDITION AS WHEN RECEIVED, ANY GOODS DELIVERED TO YOU UNDER THIS CONTRACT OR SALE, OR YOU MAY, IF YOU WISH, COMPLY WITH THE INSTRUCTIONS OF THE SELLER REGARDING THE RETURN SHIPMENT OF THE GOODS AT THE SELLER'S EXPENSE AND RISK.",
          "IF YOU DO MAKE THE GOODS AVAILABLE TO THE SELLER AND THE SELLER DOES NOT PICK THEM UP WITHIN 20 DAYS OF THE DATE OF YOUR NOTICE OF CANCELLATION, YOU MAY RETAIN OR DISPOSE OF THE GOODS WITHOUT ANY FURTHER OBLIGATION. IF YOU FAIL TO MAKE THE GOODS AVAILABLE TO THE SELLER, OR IF YOU AGREE TO RETURN THE GOODS TO THE SELLER AND FAIL TO DO SO, THEN YOU REMAIN LIABLE FOR PERFORMANCE OF ALL OBLIGATIONS UNDER THE CONTRACT.",
          "TO CANCEL THIS TRANSACTION, MAIL OR DELIVER A SIGNED AND DATED COPY OF THIS CANCELLATION NOTICE, OR ANY OTHER WRITTEN NOTICE, TO HMP SIDING & ROOFING LLC, AT {ADDRESS} NOT LATER THAN MIDNIGHT OF {DEADLINE} (OR OF THE LATER INSURANCE DATE ABOVE, IF IT APPLIES).",
          "I HEREBY CANCEL THIS TRANSACTION."
        ],
        es: [
          "USTED PUEDE CANCELAR ESTA TRANSACCIÓN, SIN NINGUNA MULTA NI OBLIGACIÓN, DENTRO DE TRES DÍAS HÁBILES A PARTIR DE LA FECHA DE ARRIBA. SI ESTE CONTRATO SE PAGARÁ TOTAL O PARCIALMENTE CON UN RECLAMO DE SEGURO DE PROPIEDAD O DE DAÑOS, TAMBIÉN PUEDE CANCELAR HASTA LA MEDIANOCHE DEL TERCER DÍA HÁBIL DESPUÉS DE RECIBIR UN AVISO POR ESCRITO DE SU ASEGURADORA DE QUE TODO O PARTE DEL RECLAMO NO ESTÁ CUBIERTO, SI ESA FECHA ES POSTERIOR.",
          "SI USTED CANCELA, CUALQUIER BIEN ENTREGADO COMO PARTE DEL PAGO, CUALQUIER PAGO HECHO POR USTED BAJO EL CONTRATO O VENTA, Y CUALQUIER INSTRUMENTO NEGOCIABLE FIRMADO POR USTED LE SERÁN DEVUELTOS DENTRO DE 10 DÍAS DESPUÉS DE QUE EL VENDEDOR RECIBA SU AVISO DE CANCELACIÓN, Y CUALQUIER GARANTÍA PRENDARIA QUE SURJA DE LA TRANSACCIÓN SERÁ CANCELADA.",
          "SI USTED CANCELA, DEBE PONER A DISPOSICIÓN DEL VENDEDOR EN SU CASA, EN CONDICIONES SUSTANCIALMENTE TAN BUENAS COMO CUANDO LOS RECIBIÓ, CUALQUIER BIEN QUE SE LE HAYA ENTREGADO BAJO ESTE CONTRATO O VENTA; O, SI LO DESEA, PUEDE SEGUIR LAS INSTRUCCIONES DEL VENDEDOR PARA DEVOLVER LOS BIENES POR ENVÍO, A COSTO Y RIESGO DEL VENDEDOR.",
          "SI USTED PONE LOS BIENES A DISPOSICIÓN DEL VENDEDOR Y EL VENDEDOR NO LOS RECOGE DENTRO DE 20 DÍAS DE LA FECHA DE SU AVISO DE CANCELACIÓN, USTED PUEDE QUEDARSE CON ELLOS O DESHACERSE DE ELLOS SIN NINGUNA OTRA OBLIGACIÓN. SI NO PONE LOS BIENES A DISPOSICIÓN DEL VENDEDOR, O SI ACEPTA DEVOLVERLOS Y NO LO HACE, USTED SIGUE OBLIGADO A CUMPLIR TODAS LAS OBLIGACIONES DEL CONTRATO.",
          "PARA CANCELAR ESTA TRANSACCIÓN, ENVÍE POR CORREO O ENTREGUE UNA COPIA FIRMADA Y FECHADA DE ESTE AVISO DE CANCELACIÓN, O CUALQUIER OTRO AVISO POR ESCRITO, A HMP SIDING & ROOFING LLC, EN {ADDRESS} A MÁS TARDAR A LA MEDIANOCHE DEL {DEADLINE} (O DE LA FECHA POSTERIOR DE SEGURO DE ARRIBA, SI APLICA).",
          "POR MEDIO DE LA PRESENTE CANCELO ESTA TRANSACCIÓN."
        ]
      }
    },
    deductible_notice: {
      law: "Neb. Rev. Stat. 44-8607",
      source: "docs/print/contract-draft.html, docs/print/contract-draft-es.html",
      title: { en: "Deductible notice", es: "Aviso sobre el deducible" },
      paras: {
        en: ["IT IS A VIOLATION OF THE INSURANCE LAWS OF NEBRASKA TO REBATE ANY PORTION OF AN INSURANCE DEDUCTIBLE AS AN INDUCEMENT TO THE INSURED TO ACCEPT A RESIDENTIAL CONTRACTOR'S PROPOSAL TO REPAIR DAMAGED PROPERTY. REBATE OF A DEDUCTIBLE INCLUDES GRANTING ANY ALLOWANCE OR OFFERING ANY DISCOUNT AGAINST THE FEES TO BE CHARGED FOR WORK TO BE PERFORMED OR PAYING THE INSURED HOMEOWNER THE DEDUCTIBLE AMOUNT SET FORTH IN THE INSURANCE POLICY. THE INSURED HOMEOWNER IS PERSONALLY RESPONSIBLE FOR PAYMENT OF THE DEDUCTIBLE. THE INSURANCE FRAUD ACT AND NEBRASKA CRIMINAL STATUTES PROHIBIT THE INSURED HOMEOWNER FROM ACCEPTING FROM A RESIDENTIAL CONTRACTOR A REBATE OF THE DEDUCTIBLE OR OTHERWISE ACCEPTING ANY ALLOWANCE OR DISCOUNT FROM THE RESIDENTIAL CONTRACTOR TO COVER THE COST OF THE DEDUCTIBLE. VIOLATIONS MAY BE PUNISHABLE BY CIVIL OR CRIMINAL PENALTIES."],
        es: ["ES UNA VIOLACIÓN DE LAS LEYES DE SEGUROS DE NEBRASKA REEMBOLSAR CUALQUIER PARTE DE UN DEDUCIBLE DE SEGURO COMO INCENTIVO PARA QUE EL ASEGURADO ACEPTE LA PROPUESTA DE UN CONTRATISTA RESIDENCIAL PARA REPARAR UNA PROPIEDAD DAÑADA. REEMBOLSAR UN DEDUCIBLE INCLUYE OTORGAR CUALQUIER BONIFICACIÓN U OFRECER CUALQUIER DESCUENTO SOBRE LOS CARGOS POR EL TRABAJO A REALIZAR, O PAGARLE AL DUEÑO ASEGURADO EL MONTO DEL DEDUCIBLE QUE FIJA LA PÓLIZA DE SEGURO. EL DUEÑO ASEGURADO ES PERSONALMENTE RESPONSABLE DE PAGAR EL DEDUCIBLE. LA LEY DE FRAUDE DE SEGUROS (INSURANCE FRAUD ACT) Y LAS LEYES PENALES DE NEBRASKA PROHÍBEN QUE EL DUEÑO ASEGURADO ACEPTE DE UN CONTRATISTA RESIDENCIAL UN REEMBOLSO DEL DEDUCIBLE, O CUALQUIER BONIFICACIÓN O DESCUENTO DEL CONTRATISTA PARA CUBRIR EL COSTO DEL DEDUCIBLE. LAS VIOLACIONES PUEDEN CASTIGARSE CON SANCIONES CIVILES O PENALES."]
      },
      // The Spanish contract prints the official English text under the Spanish one; the law's wording is the English.
      official: "en"
    }
  };
  Object.values(LEGAL).forEach(function (d) { Object.freeze(d.paras.en); Object.freeze(d.paras.es); Object.freeze(d.paras); Object.freeze(d); });
  Object.freeze(LEGAL);

  // ---------- risk guard (44-8604: never offer to cover a deductible; never promise insurance pays) ----------
  const RISK = [
    { id: "deductible", legal: "deductible_notice", block: true,
      // Any deductible sentence: the AI never writes one (44-8604 / 44-8607). The fixed notice says it.
      re: /\b(deductib\w*|deducible\w*)/i,
      reason: { en: "Deductible talk is never translated live. Read the fixed deductible notice instead.",
                es: "Lo del deducible nunca se traduce en vivo. Lea el aviso fijo del deducible." } },
    { id: "insurance_promise", legal: null, block: false,
      re: /\b(insurance|insurer|seguro|aseguradora)\b[^.?!]{0,40}\b(will|is going to|gonna|va a|van a|pagar[áa]n?)\b[^.?!]{0,20}\b(pay|cover|approve|pagar|cubrir|aprobar)/i,
      reason: { en: "Sounds like a promise that insurance will pay. Say 'the adjuster decides'.",
                es: "Suena a promesa de que el seguro pagará. Diga 'el ajustador decide'." } },
    { id: "cancel_terms", legal: "cancel_notice", block: true,
      re: /\b(right to cancel|cancel (?:this|the) (?:contract|transaction)|three business days|3 business days|derecho a cancelar|cancelar (?:el|este) contrato|tres días hábiles|3 días hábiles)\b/i,
      reason: { en: "Cancel rights are read from the fixed notice, not translated live.",
                es: "El derecho a cancelar se lee del aviso fijo, no se traduce en vivo." } },
    { id: "licensed", legal: null, block: false,
      re: /\b(licensed|licenciado|con licencia)\b/i,
      reason: { en: "HMP is a registered contractor. Don't say licensed.",
                es: "HMP es contratista registrado. No diga licenciado." } }
  ];

  function checkRisk(text) {
    const s = String(text || "");
    const flags = [];
    let blocked = null;
    for (const r of RISK) {
      if (r.re.test(s)) {
        flags.push(r.id);
        if (r.block && !blocked) blocked = r;
      }
    }
    const first = blocked || RISK.find(function (r) { return flags[0] === r.id; });
    return { blocked: !!blocked, flags: flags, reason: first ? first.reason : null, legal: blocked ? blocked.legal : null };
  }

  // ---------- glossary helpers ----------
  function init(opts) {
    if (opts && opts.glossary && Array.isArray(opts.glossary.terms) && opts.glossary.terms.length) glossary = opts.glossary;
    return api;
  }
  function getGlossary() { return glossary; }
  function termsIn(text, lang) {
    const s = " " + String(text || "").toLowerCase() + " ";
    return glossary.terms.filter(function (t) {
      const w = String(t[lang] || "").toLowerCase().replace(/\s*\(.*\)\s*/, "");
      return w && s.indexOf(w) !== -1;
    }).map(function (t) { return t.en; });
  }
  function glossaryBlock() {
    return glossary.terms.map(function (t) { return "- " + t.en + " = " + t.es + (t.note ? "  (" + t.note + ")" : ""); }).join("\n");
  }
  const NAMES = { en: "English", es: "Spanish (Mexican / US Latino, plain and polite, usted)" };

  function buildPrompt(text, from, to, opts) {
    opts = opts || {};
    return [
      "You translate for HMP Siding & Roofing, a roofing and siding company in Fremont, Nebraska, talking with a homeowner or a crew member.",
      "Translate the message from " + NAMES[from] + " to " + NAMES[to] + ".",
      opts.simpler ? "Use short, plain, everyday words a person hears at the door. One or two short sentences." : "Keep the meaning exact and the tone friendly. Spoken style, not formal writing.",
      "",
      "GLOSSARY: these word pairs are fixed. When the message uses one of these ideas, use exactly this word:",
      glossaryBlock(),
      "",
      "Rules:",
      "- Translate only. Do not add advice, promises, prices or anything that is not in the message.",
      "- Never add words about covering, waiving, discounting or paying a deductible. Never say insurance will pay.",
      "- Say 'registered contractor' / 'contratista registrado', never licensed.",
      "- Keep numbers, addresses, names and claim numbers exactly as written.",
      "",
      'Reply with only JSON: {"text": "<the translation>"}',
      "",
      "MESSAGE:",
      String(text)
    ].join("\n");
  }

  // ---------- Claude (page `sample` capability) ----------
  let samplePromise = null;
  function getSample() {
    if (!samplePromise) {
      const c = typeof window !== "undefined" ? window.claude : null;
      samplePromise = c && typeof c.use === "function" ? c.use("sample").catch(function () { return null; }) : Promise.resolve(null);
    }
    return samplePromise;
  }
  function errOut(e) {
    const code = (e && e.code) || "upstream_error";
    const msg = {
      not_granted: { en: "Claude isn't allowed on this page. Type or use the fixed phrases.", es: "Claude no tiene permiso en esta página. Escriba o use las frases fijas." },
      rate_limited: { en: "Too many requests. Wait a minute and try again.", es: "Demasiadas solicitudes. Espere un minuto y vuelva a intentar." },
      refused: { en: "Claude wouldn't translate that. Say it another way.", es: "Claude no tradujo eso. Dígalo de otra forma." },
      unavailable: { en: "Translation isn't available here.", es: "La traducción no está disponible aquí." }
    };
    return { ok: false, code: code, error: msg[code] || { en: "Translation failed. Try again.", es: "Falló la traducción. Intente otra vez." } };
  }
  async function ask(prompt, signal) {
    const sample = await getSample();
    if (!sample) throw { code: "unavailable" };
    const out = await sample.json(prompt, { modelTier: "quick", signal: signal, cache: false });
    const t = out && typeof out.text === "string" ? out.text.trim() : "";
    if (!t) throw { code: "empty_completion" };
    return t;
  }

  function normLang(l) { l = String(l || "").slice(0, 2).toLowerCase(); if (l !== "en" && l !== "es") throw new Error("lang must be en or es"); return l; }

  async function sayIt(text, from, to, opts) {
    opts = opts || {};
    from = normLang(from); to = normLang(to);
    const src = String(text || "").trim();
    if (!src) return { ok: false, code: "empty", error: { en: "Nothing to translate.", es: "No hay nada que traducir." } };
    const risk = checkRisk(src);
    if (risk.blocked) {
      return { ok: false, blocked: true, code: "blocked", flags: risk.flags, error: risk.reason, legal: risk.legal };
    }
    try {
      const out = await ask(buildPrompt(src, from, to, opts), opts.signal);
      const outRisk = checkRisk(out);
      const res = { ok: true, text: out, from: from, to: to, source: src, terms: termsIn(src, from),
                    flags: risk.flags.concat(outRisk.flags.filter(function (f) { return risk.flags.indexOf(f) === -1; })),
                    warn: outRisk.flags.length ? outRisk.reason : (risk.flags.length ? risk.reason : null) };
      if (outRisk.blocked) {
        // The model added risky words the source did not have: don't show it.
        return { ok: false, blocked: true, code: "blocked_output", flags: outRisk.flags, error: outRisk.reason, legal: outRisk.legal };
      }
      if (opts.check) {
        const b = await backCheck(out, to, from, opts);
        res.back = b.ok ? b.text : null;
      }
      return res;
    } catch (e) {
      return errOut(e);
    }
  }

  // Back-translation: translate the result back on its own, so FilthE can see whether the meaning held.
  async function backCheck(translated, lang, back, opts) {
    opts = opts || {};
    try {
      const t = await ask(buildPrompt(translated, normLang(lang), normLang(back), {}) + "\n", opts.signal);
      return { ok: true, text: t };
    } catch (e) { return errOut(e); }
  }

  async function simpler(text, lang, opts) {
    opts = opts || {};
    lang = normLang(lang);
    const src = String(text || "").trim();
    const risk = checkRisk(src);
    if (risk.blocked) return { ok: false, blocked: true, code: "blocked", flags: risk.flags, error: risk.reason, legal: risk.legal };
    const prompt = [
      "Rewrite this " + NAMES[lang] + " message for HMP Siding & Roofing in shorter, plainer words, same language, same meaning.",
      "One or two short sentences. Keep numbers, names and addresses exactly. Add nothing new.",
      "Never add words about a deductible or promise that insurance pays.",
      "Use these fixed words when the idea comes up:",
      glossaryBlock(),
      "",
      'Reply with only JSON: {"text": "<the simpler message>"}',
      "",
      "MESSAGE:",
      src
    ].join("\n");
    try {
      const out = await ask(prompt, opts.signal);
      if (checkRisk(out).blocked) return { ok: false, blocked: true, code: "blocked_output", error: checkRisk(out).reason };
      return { ok: true, text: out };
    } catch (e) { return errOut(e); }
  }

  // ---------- fixed legal text ----------
  function formatDeadline(iso, lang) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
    const d = new Date(iso + "T12:00:00");
    try { return d.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); }
    catch (e) { return iso; }
  }
  function readLegal(id, lang, opts) {
    opts = opts || {};
    const doc = LEGAL[id];
    if (!doc) throw new Error("Unknown legal text: " + id + ". Only " + Object.keys(LEGAL).join(", ") + ".");
    lang = normLang(lang);
    const deadline = formatDeadline(opts.deadline, lang);
    const fill = function (p, forSpeech) {
      return p.replace("{ADDRESS}", BUSINESS_ADDRESS)
              .replace("{DEADLINE}", deadline || (forSpeech ? "…" : "________"));
    };
    const paras = doc.paras[lang].map(function (p) { return fill(p, false); });
    const res = {
      id: id, lang: lang, law: doc.law, source: doc.source, title: doc.title[lang], fixed: true,
      paras: paras, text: paras.join("\n\n"),
      speakText: doc.paras[lang].map(function (p) { return fill(p, true); }).join(" "),
      official_en: doc.official === "en" && lang === "es" ? doc.paras.en.join("\n\n") : null
    };
    if (opts.speak) res.speaking = speak(res.speakText, lang, { rate: opts.rate || 0.9 });
    return res;
  }
  function legalIds() { return Object.keys(LEGAL); }

  // ---------- speech out / in (browser APIs; may be missing inside app webviews) ----------
  function synth() { return typeof window !== "undefined" && window.speechSynthesis ? window.speechSynthesis : null; }
  function voicesFor(lang) {
    const s = synth(); if (!s) return [];
    lang = normLang(lang);
    const all = s.getVoices() || [];
    const pref = lang === "es" ? ["es-MX", "es-US", "es-419", "es"] : ["en-US", "en"];
    const out = [];
    pref.forEach(function (p) { all.forEach(function (v) { if (String(v.lang).replace("_", "-").indexOf(p) === 0 && out.indexOf(v) === -1) out.push(v); }); });
    return out;
  }
  function speak(text, lang, opts) {
    opts = opts || {};
    const s = synth();
    if (!s || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve({ ok: false, code: "no_speech" });
    lang = normLang(lang);
    return new Promise(function (resolve) {
      try {
        s.cancel();
        const u = new SpeechSynthesisUtterance(String(text));
        u.lang = lang === "es" ? "es-MX" : "en-US";
        const v = voicesFor(lang)[0]; if (v) u.voice = v;
        u.rate = opts.rate || 1;
        let done = false;
        const fin = function (r) { if (!done) { done = true; resolve(r); } };
        u.onend = function () { fin({ ok: true, voice: v ? v.name : null }); };
        u.onerror = function (e) { fin({ ok: false, code: (e && e.error) || "error" }); };
        s.speak(u);
      } catch (e) { resolve({ ok: false, code: "error" }); }
    });
  }
  function stopSpeaking() { const s = synth(); if (s) s.cancel(); }

  function recognizer() {
    if (typeof window === "undefined") return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  // Hold-to-talk: call listen() on press, .stop() on release; .done resolves with the words heard ("" if none).
  function listen(lang) {
    const R = recognizer(); if (!R) return null;
    lang = normLang(lang);
    const rec = new R();
    rec.lang = lang === "es" ? "es-MX" : "en-US";
    rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
    let finalText = "", interim = "";
    const ctl = { onInterim: null };
    ctl.done = new Promise(function (resolve, reject) {
      rec.onresult = function (e) {
        interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript + " "; else interim += r[0].transcript;
        }
        if (ctl.onInterim) ctl.onInterim((finalText + interim).trim());
      };
      rec.onerror = function (e) { const c = e && e.error; if (c === "no-speech" || c === "aborted") resolve((finalText + interim).trim()); else reject({ code: c || "error" }); };
      rec.onend = function () { resolve((finalText + interim).trim()); };
    });
    try { rec.start(); } catch (e) { return null; }
    ctl.stop = function () { try { rec.stop(); } catch (e) { /* already stopped */ } };
    return ctl;
  }

  const api = {
    init: init, getGlossary: getGlossary, termsIn: termsIn, buildPrompt: buildPrompt,
    sayIt: sayIt, backCheck: backCheck, simpler: simpler, checkRisk: checkRisk,
    readLegal: readLegal, legalIds: legalIds, BUSINESS_ADDRESS: BUSINESS_ADDRESS,
    speak: speak, stopSpeaking: stopSpeaking, voicesFor: voicesFor, listen: listen,
    canListen: function () { return !!recognizer(); }, canSpeak: function () { return !!synth(); }
  };
  return api;
});
