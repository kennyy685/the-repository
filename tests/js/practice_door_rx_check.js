#!/usr/bin/env node
/* Practice Door: the local legal backup check (legalScan / RX in pages/practice-door.html) against a fixed set of
 * lines. Every "want" line must get exactly that flag type first; every null line must stay clean. Also every line the
 * page itself tells Kenny to say (objection answers, "say instead" fixes, hints, focus lines) must stay clean.
 *
 *   node tests/js/practice_door_rx_check.js
 *
 * Exit 0 = all pass. The AI coach is the main check; this set is the backup and the regression guard.
 * v6 (2026-09-26, QA): 19 tricky phrasings + 15 compliant look-alikes added (deductible softening, "basically
 * guaranteed", acting as the claim contact, initial-in-English, a relative signing, paid referrals, resale/energy).
 * v10 (2026-09-27): the insurance-rate promise (round 47) and "licencia" said about HMP in Spanish (round 49), each with
 * compliant look-alikes; the pro lines and the Spanish playbook must equal their data files; taught Spanish keeps "usted".
 * v11 (2026-09-28): offering to call the insurer or file the claim "for you", free extras for the deductible, a
 * different storm date, and a reward for a review (each with compliant look-alikes); every line Kenny is taught
 * (openers, answers, drills, pro lines, playbook) must also pass dedTalk, and every drill's model answers must pass
 * that drill's own local check. */
"use strict";
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "..", "pages", "practice-door.html"), "utf8");
const a = src.indexOf("const RX = ["), b = src.indexOf("const localFlags");
const { legalScan, tuUsed, dedTalk } = new Function(src.slice(a, b) + "\nreturn { legalScan, tuUsed: typeof tuUsed === 'undefined' ? null : tuUsed, dedTalk };")();
const e = src.indexOf("const T = {"), f = src.indexOf("const CORE");
const T = new Function("const MAX=8;\n" + src.slice(e, f) + "\nreturn T;")();
const c = src.indexOf("const CASH_OBJ"), d = src.indexOf("const objFor");
/* v11: the homeowners (for their "open" lines). */
const P = new Function(src.slice(src.indexOf("const P = {"), src.indexOf("const ORDER")) + "\nreturn P;")();
const { OBJ, SKILL, PRO, PRO_ON_HOLD, PLAY } = new Function(src.slice(c, d) + "\nreturn { OBJ, SKILL, PRO: typeof PRO === 'undefined' ? null : PRO, PRO_ON_HOLD: typeof PRO_ON_HOLD === 'undefined' ? null : PRO_ON_HOLD, PLAY: typeof PLAY === 'undefined' ? null : PLAY };")();

/* [line, expected first flag type or null, optional legalScan context] */
const HOA = { hoa: true }, PHONE = { phone: true };
const CASES = [
  /* v9 (T153, round 36): already signed with another roofer - never coach a cancel, never disparage */
  ["You should cancel with them today.", 'coach_cancel'],
  ["I'd back out of that contract if I were you.", 'coach_cancel'],
  ["Call them tomorrow and cancel, you still have time.", 'coach_cancel'],
  ["Here's a letter you can send to cancel with Apex.", 'coach_cancel'],
  ["Get out of that contract while you can.", 'coach_cancel'],
  ["We can help you cancel it.", 'coach_cancel'],
  ["Cancélelo hoy, todavía tiene tiempo.", 'coach_cancel'],
  ["Yo que usted lo cancelaría.", 'coach_cancel'],
  ["Le ayudo a cancelar con ellos.", 'coach_cancel'],
  ["I'm not here to talk you out of anything.", null],
  ["If you signed in the last 3 business days, Nebraska gives you the right to cancel, and that's your call.", null],
  ["I'm not telling you to cancel, that's your decision.", null],
  ["You can cancel within 3 business days if you ever want to.", null],
  ["No le digo que lo cancele, eso lo decide usted.", null],
  ["Si firmó en los últimos 3 días hábiles, tiene derecho a cancelar.", null],
  ["That contract probably isn't even binding.", 'disparage'],
  ["Your contract is worthless.", 'disparage'],
  ["They'll disappear with your deposit.", 'disparage'],
  ["Those out-of-town crews always skip town.", 'disparage'],
  ["Storm chasers are all crooks.", 'disparage'],
  ["Ese contrato no vale nada.", 'disparage'],
  ["Esos se van a desaparecer con su depósito.", 'disparage'],
  ["I can't tell you whether that contract is binding, that's between you and them.", null],
  ["Ask them who handles the warranty in 6 months.", null],
  ["I won't tell you your contract isn't valid.", null],
  ["Pregúnteles quién atiende la garantía.", null],
  /* v9: no damage found - never manufacture damage */
  ["There's always something an adjuster will find.", 'fraud'],
  ["Let's file it anyway and see.", 'fraud'],
  ["We can call the normal wear hail damage.", 'fraud'],
  ["The adjuster won't know the difference.", 'fraud'],
  ["Siempre hay algo que el ajustador paga.", 'fraud'],
  ["Lo reportamos como daño de granizo.", 'fraud'],
  ["I'm not going to file it anyway, there's no damage.", null],
  ["I won't call normal wear hail damage.", null],
  ["I didn't find hail or wind damage, here are the photos.", null],
  ["If a neighbor asks who checked your roof, I'd appreciate the introduction.", null],
  ["No encontré daño de granizo, aquí están las fotos.", null],
  /* v9 (T150): HOA / condo unit owner - the association's master policy decides */
  ["Your HO-6 policy will cover the roof.", 'hoa_claim'],
  ["Don't wait for the HOA, file it yourself.", 'hoa_claim'],
  ["File the roof claim on your own policy.", 'hoa_claim'],
  ["We can cover your share of the special assessment.", 'hoa_claim'],
  ["Su póliza de su unidad cubre el techo.", 'hoa_claim'],
  ["No necesita esperar a la asociación.", 'hoa_claim'],
  ["You should file the roof claim yourself.", 'hoa_claim', HOA],
  ["Just file a claim with your insurance.", 'hoa_claim', HOA],
  ["Usted haga el reclamo con su seguro.", 'hoa_claim', HOA],
  ["Your share will probably be about $2,000.", 'hoa_claim', HOA],
  ["The deductible is probably two thousand dollars.", 'hoa_claim', HOA],
  ["Su parte del deducible va a ser como 2,000 dólares.", 'hoa_claim', HOA],
  ["You can sign the authorization for the board.", 'hoa_claim', HOA],
  ["That's the association's claim, not yours.", null, HOA],
  ["You don't file the roof claim, the HOA does.", null, HOA],
  ["I can't guess your share, the board decides.", null, HOA],
  ["I won't guess a number like $2,000 for your deductible.", null, HOA],
  ["I can give the board a written roof report.", null, HOA],
  ["Can I get the management company's office number?", null, HOA],
  ["The look on your part of the building is free and takes 10 minutes.", null, HOA],
  ["Ese reclamo le toca a la asociación, no a usted.", null, HOA],
  ["You file the claim. I meet the adjuster and show them the damage.", null],
  /* v9 (price_objections.json): no firm number sight-unseen, never beat any price, never talk them out of bids */
  ["It'll be $9,000 for the whole roof.", 'quote', PHONE],
  ["I can do it for eight grand.", 'quote', PHONE],
  ["Le sale en 9,000 dólares.", 'quote', PHONE],
  ["A rough range is $8,000 to $14,000, not final.", null, PHONE],
  ["Somewhere between 8 and 14 thousand, just a range.", null, PHONE],
  ["I'd rather not guess a number like $9,000 over the phone.", null, PHONE],
  ["The look is free, about 20 minutes.", null, PHONE],
  ["We'll beat any price they give you.", 'quote'],
  ["I'll match whatever they quote.", 'quote'],
  ["Le ganamos a cualquier precio.", 'quote'],
  ["We won't beat any price, we compare scope.", null],
  ["You don't need other bids.", 'bids'],
  ["Don't waste your time with the other guys.", 'bids'],
  ["Skip the other bids, we're the best.", 'bids'],
  ["Why bother getting more quotes?", 'bids'],
  ["No necesita pedir más cotizaciones.", 'bids'],
  ["No pierda su tiempo con otras cotizaciones.", 'bids'],
  ["Smart, get them, I'd do the same.", null],
  ["I'd never tell you to skip the other bids.", null],
  ["When you have all three, compare scope and warranty.", null],
  ["Sí, pídalas, yo haría lo mismo.", null],
  ["You don't need to get other quotes, trust me.", 'bids'],
  ["You don't want the cheapest bid, you want the right scope.", null],
  ["You don't need to decide today, get the other bids too.", null],
  /* v7 (T135, round 30): spouse / co-owner pressure flags; the title-holder question stays clean */
  ["Both of you need to be here or there's no deal.", 'pressure'],
  ["Your husband has to sit in on this or the price goes away.", 'pressure'],
  ["Your husband has to sit in on this or the deal is off.", 'pressure'],
  ["No deal unless both spouses are here.", 'pressure'],
  ["Los dos tienen que estar aquí o no hay trato.", 'pressure'],
  ["No hay trato si no están los dos.", 'pressure'],
  ["Whose name is on the house?", null],
  ["If your wife is on the title too, I can come back Saturday at 10.", null],
  ["It's not a deal-breaker if your wife can't make it.", null],
  ["¿A nombre de quién está la casa?", null],
  ["Si su esposa también aparece en la escritura, regreso cuando ella esté.", null],
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
  /* v10 (2026-09-27, round 47): the insurance-rate promise. Never say their rate won't go up, that they can't be
     dropped, or that a hail / "act of God" claim won't count against them. The only approved answer is T.f_rate. */
  ["Your rates won't go up.", 'rate'],
  ["Your insurance rate can't go up for a hail claim.", 'rate'],
  ["Filing won't raise your premium.", 'rate'],
  ["Don't worry, your insurance won't go up.", 'rate'],
  ["A claim won't affect your rates.", 'rate'],
  ["It's an act of God, so they can't raise your rates.", 'rate'],
  ["They can't drop you or raise your rates for a storm claim.", 'rate'],
  ["By law they can't raise your premium for hail.", 'rate'],
  ["Insurance companies can't raise rates on acts of God.", 'rate'],
  ["Hail claims don't count against you.", 'rate'],
  ["There's no rate increase for weather claims.", 'rate'],
  ["Don't worry about your rates going up.", 'rate'],
  ["Your policy won't be cancelled over this.", 'rate'],
  ["No le va a subir el seguro.", 'rate'],
  ["El seguro no le puede subir la cuota por granizo.", 'rate'],
  ["No le suben la prima por un reclamo de granizo.", 'rate'],
  ["Por ley no le pueden subir el seguro.", 'rate'],
  ["No le van a cancelar la póliza por esto.", 'rate'],
  ["Su seguro no va a subir.", 'rate'],
  ["Es un acto de Dios, no le pueden subir.", 'rate'],
  ["Un reclamo por granizo no le afecta el seguro.", 'rate'],
  ["La aseguradora no lo puede dar de baja por esto.", 'rate'],
  ["No se preocupe de que le suban el seguro.", 'rate'],
  /* v10: compliant look-alikes that must stay clean */
  ["I can't promise your rate won't go up; that's between you and your insurer.", null],
  ["Whether your rate goes up is between you and your insurance company.", null],
  ["Some folks worry their rates will go up. That's a fair question for your agent.", null],
  ["Nobody can promise your premium won't change.", null],
  ["I won't tell you your rates won't go up. Ask your agent.", null],
  ["Documenting the damage doesn't mean you have to file anything.", null],
  ["A free look doesn't change your coverage, it's just photos.", null],
  ["They won't touch your roof without your OK.", null],
  ["No le puedo prometer que no le suba el seguro.", null],
  ["No sé si le sube el seguro; eso pregúntelo a su agente.", null],
  ["Eso es entre usted y su aseguradora, no le puedo decir si sube.", null],
  ["No le quito mucho tiempo, son 10 minutos.", null],
  ["No le va a subir el precio del trabajo.", null],
  /* v10 (round 49): "licencia" said about HMP in Spanish is the same hard flag as "licensed". Answer: "registrados". */
  ["HMP tiene licencia del estado.", 'license'],
  ["Somos una compañía con licencia.", 'license'],
  ["Estamos licenciados en Nebraska.", 'license'],
  ["Somos contratistas con licencia y seguro.", 'license'],
  ["Contamos con licencia para techos.", 'license'],
  ["Sí, tenemos todas las licencias.", 'license'],
  ["HMP es una empresa licenciada.", 'license'],
  ["Nuestra compañía está licenciada y asegurada.", 'license'],
  ["Sí, con licencia y todo.", 'license'],
  ["Soy contratista licenciado.", 'license'],
  ["Nuestra licencia de contratista es del estado.", 'license'],
  /* v10: compliant look-alikes (a driver's license, the title "licenciado", correcting the term) stay clean */
  ["El seguro exige una licencia de manejo.", null],
  ["¿Me enseña su licencia de manejo?", null],
  ["Mi hijo sacó su licencia de manejo.", null],
  ["Hablé con el licenciado Pérez, el abogado de la asociación.", null],
  ["No somos licenciados, somos registrados; así funciona en Nebraska.", null],
  ["Nebraska no da licencias de contratista para este tipo de trabajo, da registro.", null],
  ["En Texas piden licencia; aquí en Nebraska es registro.", null],
  ["Asegúrese de que el contratista esté registrado, no importa si dice que tiene licencia.", null],
  ["Nunca decimos que tenemos licencia: estamos registrados.", null],
  ["Somos contratistas registrados en Nebraska.", null],
  /* v11 (2026-09-28): calling the insurer or filing the claim FOR the homeowner (it is their claim and their call) */
  ["I can call your insurance and file it for you.", 'negotiate'],
  ["I'll call your insurance company for you.", 'negotiate'],
  ["No stress, we can file the claim for you.", 'negotiate'],
  ["Yo le llamo a su aseguradora y lo presento por usted.", 'negotiate'],
  ["It's your claim and your call: if you file, you call them, and I can meet the adjuster.", null],
  ["I can't file it for you; it's your claim.", null],
  ["You call your insurance company, and I'll meet the adjuster and show the damage.", null],
  ["Call your insurance company when you're ready; the decision is yours.", null],
  ["El reclamo es suyo y usted decide: si lo presenta, usted les llama.", null],
  /* v11: free extras or any allowance to make up for the deductible (44-8604) */
  ["I'll throw in free gutters to make up for the deductible.", 'deductible'],
  ["Instead of the deductible, we'll throw in the gutters for free.", 'deductible'],
  ["Le regalo las canaletas por lo del deducible.", 'deductible'],
  ["I can't throw in free gutters for the deductible.", null],
  ["The deductible is always your part, so I can't throw in anything free.", null],
  ["El deducible siempre es su parte; no le regalamos nada para cubrirlo.", null],
  /* v11: a different storm date on the report (date-of-loss fraud) */
  ["We'll say it happened in the newer storm.", 'fraud'],
  ["Let's just say the damage was from the recent storm.", 'fraud'],
  ["Decimos que fue en la tormenta más reciente.", 'fraud'],
  ["My report only uses the real storm date.", null],
  ["I can't say it was from the newer storm; the report uses the real date.", null],
  ["The hail report shows which storms hit this address.", null],
  ["Some policy limits are short, so check yours or call your insurer this week.", null],
  /* v11: a reward for a review (FTC 16 CFR 465.4; to an insured also 44-8604) */
  ["Leave us five stars and we'll knock $200 off.", 'referral'],
  ["We give a $50 gift card for every 5-star review.", 'referral'],
  ["Post a 5-star review and I'll take 10% off your bill.", 'referral'],
  ["Le damos $100 de descuento por una reseña de 5 estrellas.", 'referral'],
  ["Just a big thank-you. An honest review, whatever you think, helps families like yours find us.", null],
  ["No gifts or discounts for reviews, just an honest one if you want.", null],
  ["Could you leave us an honest review? It really helps.", null],
  ["Please leave a 5-star review if you're happy.", null],
  ["Solo un gran agradecimiento; una reseña honesta nos ayuda mucho.", null],
];

let fails = 0;
for (const [line, want, ctx] of CASES) {
  const got = legalScan(line, ctx).map(x => x.type)[0] || null;
  if (got !== want) { fails++; console.log("FAIL", JSON.stringify(line), "want", want, "got", got); }
}
console.log(`${CASES.length - (fails)} / ${CASES.length} rx cases ok`);

const lines = [];
OBJ.forEach(o => o[1].forEach((x, i) => lines.push(["OBJ " + o[0][0] + (i ? " ES" : " EN"), x])));
for (const k of Object.keys(T)) if (/^(fh_|f_|h_)/.test(k) && Array.isArray(T[k])) T[k].forEach((x, i) => lines.push([k + (i ? " ES" : " EN"), x]));
T.canList.forEach((l, i) => l.forEach(x => lines.push(["can" + i, x])));
/* v7 (T131): the 10 skill drills' model answers and "to pass" lines, plus the first-3-seconds line. */
if (!Array.isArray(SKILL) || SKILL.length !== 17) { console.log("FAIL expected 17 skill drills (v11), got", SKILL && SKILL.length); process.exit(1); }
SKILL.forEach(k => { k.a.forEach((x, i) => lines.push(["SKILL " + k.id + (i ? " ES" : " EN"), x])); k.g.forEach((x, i) => lines.push(["SKILL goal " + k.id + (i ? " ES" : " EN"), x])); });
T.first3.forEach((x, i) => lines.push(["first3" + (i ? " ES" : " EN"), x]));
/* v9: HOA and phone-quote answers must also stay clean under their scenario's extra rules. */
OBJ.forEach(o => { const who = [].concat(o[2] || []); if (who.includes('hoa')) o[1].forEach((x, i) => lines.push(["OBJ(hoa) " + o[0][0] + (i ? " ES" : " EN"), x, HOA])); if (who.includes('phonequote')) o[1].forEach((x, i) => lines.push(["OBJ(phone) " + o[0][0] + (i ? " ES" : " EN"), x, PHONE])); });
lines.push(["f_hoa_claim EN (HOA)", T.f_hoa_claim[0], HOA], ["f_hoa_claim ES (HOA)", T.f_hoa_claim[1], HOA], ["h_hoa EN (HOA)", T.h_hoa[0], HOA], ["h_hoa ES (HOA)", T.h_hoa[1], HOA]);
/* v10 (round 47): the pro-line library must equal data/door_lines_pro.json word for word ({name} = Kenny), and every
   line, the first-3-seconds tips and the approved rate answer must stay clean. */
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "data", "door_lines_pro.json"), "utf8"));
let pf = 0;
if (!Array.isArray(PRO) || PRO.length !== DATA.length) { pf++; console.log("FAIL PRO has", PRO && PRO.length, "lines, data file has", DATA.length); }
for (const x of DATA) {
  const p = (PRO || []).find(y => y.id === x.id);
  if (!p) { pf++; console.log("FAIL PRO is missing", x.id); continue; }
  if (p.a[0] !== x.en.replace(/\{name\}/g, "Kenny") || p.a[1] !== x.es.replace(/\{name\}/g, "Kenny")) { pf++; console.log("FAIL PRO text differs from the data file:", x.id); }
  if (!p.l || !p.l[0] || !p.l[1]) { pf++; console.log("FAIL PRO label missing:", x.id); }
}
for (const id of (PRO_ON_HOLD || [])) if (!DATA.some(x => x.id === id)) { pf++; console.log("FAIL PRO_ON_HOLD names an unknown line:", id); }
const ok47 = DATA.find(x => x.id === "objection-insurance-claim-hesitation");
if (T.f_rate[0] !== `“${ok47.en}”` || T.f_rate[1] !== `“${ok47.es}”`) { pf++; console.log("FAIL f_rate is not the approved rate answer, word for word"); }
(PRO || []).forEach(p => p.a.forEach((x, i) => lines.push(["PRO " + p.id + (i ? " ES" : " EN"), x])));
T.first3tips.forEach((l, i) => l.forEach(x => lines.push(["first3tips" + (i ? " ES" : " EN"), x])));
console.log(`${DATA.length} pro lines match the data file${pf ? ` - ${pf} problem(s)` : ""}`);
/* v10 (round 49): the Spanish sale playbook must equal data/spanish_sale_playbook.json word for word ({name} = Kenny)
   and stay clean; every Spanish line the page teaches keeps "usted"; the "tú" check itself works both ways. */
const PB = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "data", "spanish_sale_playbook.json"), "utf8"));
if (!Array.isArray(PLAY) || PLAY.length !== PB.length) { pf++; console.log("FAIL PLAY has", PLAY && PLAY.length, "lines, data file has", PB.length); }
PB.forEach((x, i) => { const p = (PLAY || [])[i]; if (!p || p.es !== x.es.replace(/\{name\}/g, "Kenny") || !p.l || !p.l[0] || !p.l[1]) { pf++; console.log("FAIL PLAY entry differs from the data file:", i, x.moment); } });
(PLAY || []).forEach((p, i) => lines.push(["PLAY " + i, p.es]));
if (typeof tuUsed !== "function") { pf++; console.log("FAIL tuUsed is missing"); } else {
  const U = x => ({ role: "user", content: x }), H = x => ({ role: "assistant", content: x });
  const TU = [
    [[U("Hola, soy Kenny de HMP Siding & Roofing. ¿Le puedo quitar un minuto?")], false],
    [[U("¿Te parece el sábado a las 10?")], true],
    [[U("¿Tienes tiempo ahorita?")], true],
    [[U("Mira, tu techo tiene golpes.")], true],
    [[U("Oye, ¿quieres que revise?")], true],
    [[U("Estás en buenas manos.")], true],
    [[U("Buenas tardes. ¿Vos sabés si granizó aquí?")], true],
    [[U("It won't cost you a dime to look.")], false],
    [[U("Buenas tardes, disculpe la molestia. Soy Kenny, de HMP."), H("Háblame de tú, mijo."), U("Claro, ¿te parece si reviso tu techo?")], false],
    [[U("¿Prefiere que le hable de tú o de usted?")], false],
    [[U("Venga conmigo a ver el techo, así lo ve usted mismo.")], false],
    [[U("Fue un gusto conocerlo. Muchas gracias por su tiempo.")], false],
  ];
  for (const [turns, want] of TU) if (tuUsed(turns) !== want) { pf++; console.log("FAIL tú check", want ? "missed" : "false hit", JSON.stringify(turns.map(x => x.content))); }
  const taught = [];
  OBJ.forEach(o => taught.push(["OBJ " + o[0][0], o[1][1]]));
  for (const k of Object.keys(T)) if (/^f_/.test(k) && Array.isArray(T[k])) taught.push([k, T[k][1]]);
  SKILL.forEach(k => taught.push(["SKILL " + k.id, k.a[1]]));
  (PRO || []).forEach(p => taught.push(["PRO " + p.id, p.a[1]]));
  (PLAY || []).forEach((p, i) => taught.push(["PLAY " + i, p.es]));
  for (const [where, x] of taught) if (tuUsed([U(x)])) { pf++; console.log("FAIL taught Spanish line uses tú:", where); }
  console.log(`${PB.length} playbook lines match the data file; ${taught.length} taught Spanish lines keep "usted"`);
}
/* v11: the homeowners' opener lines (shown as "Opener" on the cheat sheet) stay clean too. */
for (const k of Object.keys(P)) if (P[k].open) P[k].open.forEach((x, i) => lines.push(["open " + k + (i ? " ES" : " EN"), x, { hoa: !!P[k].hoa, phone: !!P[k].phone }]));
/* v11: every line Kenny is taught must also pass dedTalk (the scorecard's "deductible talk" backup), or the page would
   fail him for saying it; and every drill's model answers must pass that drill's own local check (skillLocal). */
{
  const DT = [["The deductible is always the owner's part.", false], ["El deducible siempre es la parte del dueño.", false], ["The deductible is always your part.", false],
    ["El deducible siempre es su parte.", false], ["We'll work something out on the deductible.", true], ["Del deducible nos arreglamos después.", true]];
  for (const [x, want] of DT) if (dedTalk(x) !== want) { pf++; console.log("FAIL dedTalk", want ? "missed" : "false hit", JSON.stringify(x)); }
  const taughtDed = [];
  OBJ.forEach(o => o[1].forEach((x, i) => taughtDed.push(["OBJ " + o[0][0] + (i ? " ES" : " EN"), x])));
  SKILL.forEach(k => k.a.forEach((x, i) => taughtDed.push(["SKILL " + k.id + (i ? " ES" : " EN"), x])));
  (PRO || []).forEach(p => p.a.forEach((x, i) => taughtDed.push(["PRO " + p.id + (i ? " ES" : " EN"), x])));
  (PLAY || []).forEach((p, i) => { if (p.es.split(/\s+/).length > 1) taughtDed.push(["PLAY " + i, p.es]); });
  for (const k of Object.keys(P)) if (P[k].open) P[k].open.forEach((x, i) => taughtDed.push(["open " + k + (i ? " ES" : " EN"), x]));
  for (const k of Object.keys(T)) if (/^f_/.test(k) && Array.isArray(T[k])) T[k].forEach((x, i) => taughtDed.push([k + (i ? " ES" : " EN"), x]));
  for (const [where, x] of taughtDed) if (dedTalk(x)) { pf++; console.log("FAIL taught line fails dedTalk:", where); }
  const g = src.indexOf("const PUSH_RX"), h = src.indexOf("async function skillCheck");
  const skillLocal = new Function("T", src.slice(a, b) + "\nconst Li = () => 0;\n" + src.slice(g, h) + "\nreturn skillLocal;")(T);
  SKILL.forEach(k => k.a.forEach((x, i) => { const r = skillLocal(k, x); if (r) { pf++; console.log("FAIL drill model answer fails its own check:", k.id, i ? "ES" : "EN", r[0]); } }));
  console.log(`${taughtDed.length} taught lines pass dedTalk; ${SKILL.length} drills' model answers pass their own checks`);
}
let lf = 0;
for (const [where, x, ctx] of lines) { const fl = legalScan(x, ctx); if (fl.length) { lf++; console.log("FLAG", where, JSON.stringify(fl)); } }
console.log(`${lines.length - lf} / ${lines.length} coaching lines clean`);
process.exit(fails || lf || pf ? 1 : 0);
