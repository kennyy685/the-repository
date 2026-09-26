#!/usr/bin/env node
/* Practice Door: the local legal backup check (legalScan / RX in pages/practice-door.html) against a fixed set of
 * lines. Every "want" line must get exactly that flag type first; every null line must stay clean. Also every line the
 * page itself tells Kenny to say (objection answers, "say instead" fixes, hints, focus lines) must stay clean.
 *
 *   node tests/js/practice_door_rx_check.js
 *
 * Exit 0 = all pass. The AI coach is the main check; this set is the backup and the regression guard.
 * v6 (2026-09-26, QA): 19 tricky phrasings + 15 compliant look-alikes added (deductible softening, "basically
 * guaranteed", acting as the claim contact, initial-in-English, a relative signing, paid referrals, resale/energy). */
"use strict";
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "..", "pages", "practice-door.html"), "utf8");
const a = src.indexOf("const RX = ["), b = src.indexOf("const localFlags");
const legalScan = new Function(src.slice(a, b) + "\nreturn legalScan;")();
const e = src.indexOf("const T = {"), f = src.indexOf("const CORE");
const T = new Function("const MAX=8;\n" + src.slice(e, f) + "\nreturn T;")();
const c = src.indexOf("const CASH_OBJ"), d = src.indexOf("const objFor");
const OBJ = new Function(src.slice(c, d) + "\nreturn OBJ;")();

/* [line, expected first flag type or null] */
const CASES = [
  /* v3-v4 set */
  ["Honestly Prairie Peak is a bunch of scammers.", 'competitor'],
  ["They're not even licensed, you know.", 'competitor'],
  ["Make sure they're not a scam before you pay anything.", null],
  ["Get three bids, compare what each includes.", null],
  ["Esos de Prairie Peak son unos estafadores.", 'competitor'],
  ["You need to sign today to get this price.", 'cancel'],
  ["No rush, you don't have to sign today.", null],
  ["If you sign today you still have 3 business days to cancel.", null],
  ["Once you sign you can't cancel.", 'cancel'],
  ["Don't worry about the 3-day cancel form.", 'cancel'],
  ["Fírmelo hoy y empezamos el lunes.", 'cancel'],
  ["No tiene que firmar hoy.", null],
  ["New siding will definitely add 20 grand to your resale.", 'guarantee'],
  ["I guarantee you'll get approved for the loan.", 'guarantee'],
  ["We have 0% interest financing.", 'guarantee'],
  ["I can't promise what a lender offers.", null],
  ["Le garantizo que su casa va a valer más.", 'guarantee'],
  ["El contrato está en inglés, pero fírmelo aquí.", 'language'],
  ["Firme aquí y luego le explico.", 'language'],
  ["No firme nada en inglés.", null],
  ["Le doy el contrato en español, no se preocupe si el otro está en inglés, fírmelo cuando quiera.", null],
  ["Just sign it, you don't need to read it.", 'language'],
  ["You can sign for the owner, that's fine.", 'authority'],
  ["You can't sign for the owner.", null],
  ["The owner doesn't need to know.", 'authority'],
  ["Usted puede firmar por el dueño.", 'authority'],
  ["Usted no puede firmar por el dueño.", null],
  ["Sure, we'll do it for less and you keep the difference.", 'fraud'],
  ["So you want to keep the difference?", null],
  ["We'll write the invoice for the full insurance amount.", 'fraud'],
  ["We never do fake invoices.", null],
  ["Se queda con la diferencia, no hay problema.", 'fraud'],
  ["La revisión es gratis, pero el techo no le va a costar nada.", null],
  ["No le va a costar nada, el seguro lo paga.", 'deductible'],
  ["Don't worry, we'll cover your deductible.", 'deductible'],
  ["I'll call them and fight the adjuster for you.", 'negotiate'],
  ["You'll get a check for sure, insurance will pay.", 'promise'],
  ["Hi, I'm Kenny with HMP, local out of Fremont. Mind if I take a quick free look?", null],
  ["The deductible is always your part.", null],
  ["The owner signs. Can I get his number?", null],
  ["Of course. Nothing to sign today. I'll take free photos now and come back when your son is here.", null],
  ["Claro que sí. Hoy no se firma nada.", null],
  ["Sign today or the price goes up.", 'cancel'],
  // v3 (2026-09-26): energy savings guarantees
  ["You'll save 30% on heating.", 'energy'],
  ["I guarantee lower bills.", 'energy'],
  ["We guarantee your heating bills go down.", 'energy'],
  ["New siding will cut your energy bill in half.", 'energy'],
  ["Your gas bill will drop, easy.", 'energy'],
  ["It saves $400 a year on heating.", 'energy'],
  ["Guaranteed energy savings with our siding.", 'energy'],
  ["Le garantizo que va a pagar menos de luz.", 'energy'],
  ["Va a ahorrar 30% en calefacción.", 'energy'],
  ["Sus recibos de gas van a bajar.", 'energy'],
  ["Insulated vinyl can add some R-value, up to about R-4, depending on your home.", null],
  ["I can't promise you'll save on your bills.", null],
  ["It might lower your heating bill a little, it depends on your home.", null],
  ["It could save up to 10% on heating, depends on your home.", null],
  ["That will save you time on painting.", null],
  ["Hardie will last 30 to 50 years.", null],
  ["Solo el vinyl con aislante agrega algo de R, depende de su casa.", null],
  ["No le puedo prometer que va a ahorrar en la luz.", null],
  // v3: "we're doing your neighbor's house" (caution: only when true)
  ["We're doing your neighbor's house next week.", 'neighbor'],
  ["We're also working on a few houses on this street.", 'neighbor'],
  ["We just finished your neighbor's siding.", 'neighbor'],
  ["Your neighbors just signed with us.", 'neighbor'],
  ["Estamos haciendo la casa de su vecino.", 'neighbor'],
  ["Estamos trabajando en otras casas de esta calle.", 'neighbor'],
  ["We're not working on any houses on this street right now.", null],
  ["Did your neighbor get new siding?", null],
  ["We do siding all over Fremont, I can show you photos.", null],
  ["No estamos trabajando en esta calle ahorita.", null],
  ["Are we doing your neighbor's house?", null],
  // v4 (QA nasty.js, 2026-09-26): natural bad phrasings a model answer might contain
  ["Yeah, we can just knock the deductible off the price for you.", 'deductible'],
  ["Don't worry about your part, we'll take care of that for you.", 'deductible'],
  ["No te preocupes por tu parte del deducible, nosotros lo cubrimos.", 'deductible'],
  ["Insurance should cover the whole thing, you probably won't owe anything.", 'promise'],
  ["Your insurance is definitely going to pay for all of it.", 'promise'],
  ["Seguramente el seguro le paga todo, no se preocupe.", 'promise'],
  ["Sure, once you're under contract I'll handle all the back and forth with your insurance company so you don't have to deal with the adjuster.", 'negotiate'],
  ["I'll take care of the claim negotiations with your insurer myself.", 'negotiate'],
  ["Yo me encargo de negociar todo con su aseguradora, usted no tiene que hablar con ellos.", 'negotiate'],
  ["If you get it signed today I can knock a few hundred off in cash for you.", 'fraud'],
  ["Sign today and I'll give you a cash discount off the top.", 'fraud'],
  ["Si firma hoy le puedo dar un descuento en efectivo aparte.", 'fraud'],
  ["Honestly at that point you don't really have a right to back out anymore.", 'cancel'],
  ["Once it's signed there's no changing your mind.", 'cancel'],
  ["Ya firmado no hay manera de cancelarlo después.", 'cancel'],
  // v4: honest look-alikes that must stay clean
  ["You won't owe anything for the inspection.", null],
  ["You don't pay anything today, I ask for no money.", null],
  ["Your insurance company decides what they cover.", null],
  ["I can't promise insurance will cover all of it.", null],
  ["No le puedo prometer que el seguro le paga todo.", null],
  ["El seguro decide qué cubre.", null],
  ["I'll meet the adjuster and show them the damage.", null],
  ["You handle the claim, and I'll be there when the adjuster comes.", null],
  ["We take cash, check or card.", null],
  ["You can change your mind within 3 business days.", null],
  ["Don't worry about your part yet, let me look at the roof first.", null],
  ["El deducible siempre lo paga usted.", null],
  /* v4 QA nasty set */
  ["Yeah, we can just knock the deductible off the price for you.", 'deductible'],
  ["Don't worry about your part, we'll take care of that for you.", 'deductible'],
  ["No te preocupes por tu parte del deducible, nosotros lo cubrimos.", 'deductible'],
  ["Insurance should cover the whole thing, you probably won't owe anything.", 'promise'],
  ["Your insurance is definitely going to pay for all of it.", 'promise'],
  ["Seguramente el seguro le paga todo, no se preocupe.", 'promise'],
  ["Sure, once you're under contract I'll handle all the back and forth with your insurance company so you don't have to deal with the adjuster.", 'negotiate'],
  ["I'll take care of the claim negotiations with your insurer myself.", 'negotiate'],
  ["Yo me encargo de negociar todo con su aseguradora, usted no tiene que hablar con ellos.", 'negotiate'],
  ["If you get it signed today I can knock a few hundred off in cash for you.", 'fraud'],
  ["Sign today and I'll give you a cash discount off the top.", 'fraud'],
  ["Si firma hoy le puedo dar un descuento en efectivo aparte.", 'fraud'],
  ["Honestly at that point you don't really have a right to back out anymore.", 'cancel'],
  ["Once it's signed there's no changing your mind.", 'cancel'],
  ["Ya firmado no hay manera de cancelarlo después.", 'cancel'],
  /* v5: license / referral / contact */
  ["We're licensed and insured.", 'license'],
  ["We're fully licensed, bonded and insured.", 'license'],
  ["HMP is licensed in Nebraska.", 'license'],
  ["Licensed and insured, here's my card.", 'license'],
  ["We have a state license.", 'license'],
  ["Somos licenciados y asegurados.", 'license'],
  ["Tenemos licencia del estado.", 'license'],
  ["We're registered with the state and insured.", null],
  ["Estamos registrados con el estado y asegurados.", null],
  ["Make sure whoever you hire is licensed and insured.", null],
  ["We're not licensed, we're registered, that's how Nebraska does it.", null],
  ["Refer a friend and get a $100 gift card.", 'referral'],
  ["If you send your sister our way I'll give you fifty bucks cash.", 'referral'],
  ["For every neighbor you send us, we'll give you a discount.", 'referral'],
  ["We pay $200 for every referral.", 'referral'],
  ["Tell your friends and I'll get you a gift card.", 'referral'],
  ["Si nos manda a su hermana le damos una tarjeta de regalo.", 'referral'],
  ["Le doy $100 por cada recomendación.", 'referral'],
  ["Thank you, that means a lot. We don't do gifts, just a real thank-you.", null],
  ["No gifts or money for referrals, just a thank-you note.", null],
  ["If you know anyone who got hit, we'd love an introduction.", null],
  ["No damos regalos ni dinero por recomendaciones, solo las gracias.", null],
  ["Muchas gracias, eso vale mucho. Si un amigo nos necesita, lo atendemos muy bien.", null],
  ["We take cash, check or card.", null],
  ["Sure, give me his cell.", 'contact'],
  ["What's the owner's personal cell?", 'contact'],
  ["Yeah, Steve's cell works.", 'contact'],
  ["Can I get the landlord's home address?", 'contact'],
  ["¿Me da su celular?", 'contact'],
  ["Deme el celular del dueño.", 'contact'],
  ["Thanks, the office line is best. Who owns the house?", null],
  ["I'd rather not take his cell, the office line is better.", null],
  ["Can I get the property manager's office number?", null],
  ["Gracias, mejor el teléfono de la oficina.", null],
  ["Don't worry about the deductible, we'll work with you on it.", 'deductible'],
  ["No se preocupe por el deducible.", 'deductible'],
  ["The deductible is always your part, I can't touch it.", null],
  /* v6 (QA 2026-09-26): tricky phrasings that must flag */
  ["Once the claim goes through, your deductible sort of disappears.", 'deductible'],
  ["Don't stress, we'll take care of the deductible for you.", 'deductible'],
  ["You'll have no out of pocket on this, trust me.", 'deductible'],
  ["No te preocupes por el deducible, eso lo vemos nosotros.", 'deductible'],
  ["Nosotros cubrimos el deducible, así usted no paga nada.", 'deductible'],
  ["With hail this size your insurance is basically guaranteed to cover it.", 'promise'],
  ["Insurance always pays for this kind of damage.", 'promise'],
  ["Seguro que el seguro lo paga, con ese granizo.", 'promise'],
  ["Let me be your point of contact with the adjuster so you don't have to deal with them.", 'negotiate'],
  ["I'll handle your claim from start to finish.", 'negotiate'],
  ["Yo negocio con la aseguradora para que le den más.", 'negotiate'],
  ["Just initial here in English, I'll explain it after.", 'language'],
  ["Your daughter can sign for you, that's fine.", 'authority'],
  ["Sign now for the discount, it goes away tomorrow.", 'cancel'],
  ["I'll give you $50 for every neighbor that signs with us.", 'referral'],
  ["Te doy dinero por cada vecino que nos mandes.", 'referral'],
  ["New siding is guaranteed to raise your resale value.", 'guarantee'],
  ["I guarantee this siding will cut your energy bills.", 'energy'],
  ["Le garantizo que va a ahorrar en la luz con este siding.", 'energy'],
  /* v6: compliant look-alikes that must stay clean */
  ["Your deductible is always your part, it doesn't disappear.", null],
  ["We can't take care of the deductible, that's always your part.", null],
  ["The inspection is free, no out of pocket for the look.", null],
  ["No te preocupes, el deducible siempre es tu parte.", null],
  ["Nosotros no cubrimos el deducible, siempre lo paga usted.", null],
  ["Nobody can guarantee insurance will cover it; they decide.", null],
  ["Insurance decides what they pay for, not me.", null],
  ["No sé si el seguro lo paga, eso lo decide la aseguradora.", null],
  ["You're the adjuster's point of contact; I'll just be there to show the damage.", null],
  ["You handle your claim, I document the damage with photos.", null],
  ["Yo no negocio con la aseguradora, usted hace el reclamo.", null],
  ["Here's the contract in Spanish, read it with your family first.", null],
  ["Only the owner can sign, so let's wait for your daughter to call you.", null],
  ["No rush to sign, and there's no discount for signing today.", null],
  ["Thanks for sending your neighbor, we don't pay for referrals, just a thank-you.", null],
  ["Free roof look?", null],
  ["Mind if I do a free roof inspection?", null],
  ["You get a free roof out of this.", 'deductible'],
];

let fails = 0;
for (const [line, want] of CASES) {
  const got = legalScan(line).map(x => x.type)[0] || null;
  if (got !== want) { fails++; console.log("FAIL", JSON.stringify(line), "want", want, "got", got); }
}
console.log(`${CASES.length - (fails)} / ${CASES.length} rx cases ok`);

const lines = [];
OBJ.forEach(o => o[1].forEach((x, i) => lines.push(["OBJ " + o[0][0] + (i ? " ES" : " EN"), x])));
for (const k of Object.keys(T)) if (/^(fh_|f_|h_)/.test(k) && Array.isArray(T[k])) T[k].forEach((x, i) => lines.push([k + (i ? " ES" : " EN"), x]));
T.canList.forEach((l, i) => l.forEach(x => lines.push(["can" + i, x])));
let lf = 0;
for (const [where, x] of lines) { const fl = legalScan(x); if (fl.length) { lf++; console.log("FLAG", where, JSON.stringify(fl)); } }
console.log(`${lines.length - lf} / ${lines.length} coaching lines clean`);
process.exit(fails || lf ? 1 : 0);
