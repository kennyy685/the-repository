/* Shared sheets for the 3 layout mockups: Sale Guide step 1, Translate help, Quick price, New lead, More.
   Same content in every option; the options differ in WHERE these open from. */
(function(){
  const X = '<button class="x" data-close aria-label="Close">✕</button>';
  const MIC = '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  const html = `
<div class="sheet" id="sg"><div class="in"><div class="grab"></div>
  <div class="top"><div class="grow"><div class="eb o" data-es="Paso 1 de 8 · Seguro">Step 1 of 8 · Insurance</div>
    <div class="h1" data-es="En la puerta">At the door</div><div class="small">101 E 4th St · <span data-es="granizo 1.5&quot; el 10 sep">1.5" hail Sep 10</span></div></div>
    <button class="flip" data-flip data-es="EN ⇄">ES ⇄</button>${X}</div>
  <div class="step"><i class="d"></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <div class="blk law"><div class="eb" data-es="Primero, por ley">First, by law</div><span data-es="Di tu nombre, HMP y qué vendes, antes que nada.">Say your name, HMP, and what you sell, first thing.</span></div>
  <div class="blk"><div class="eb"><span data-es="Di">Say</span></div>
    <q data-es="Hola, soy Kenny de HMP Siding &amp; Roofing, contratista registrado aquí en Fremont. La tormenta del 10 de septiembre pasó por esta calle. Estamos haciendo inspecciones gratis a los vecinos. ¿Puedo revisar su techo y siding?">Hi, I'm Kenny with HMP Siding &amp; Roofing, a registered contractor here in Fremont. The Sep 10 storm came through this street. We're doing free inspections for the neighbors. Can I take a quick look at your roof and siding?</q></div>
  <div class="blk"><div class="eb" data-es="Pregunta">Ask</div><ul>
    <li data-es="¿Ha visto goteras, canaletas golpeadas o siding roto desde la tormenta?">Seen leaks, dented gutters or cracked siding since the storm?</li>
    <li data-es="¿Qué día y hora le queda para una revisión de 20 minutos?">What day and time works for a 20-minute look?</li>
    <li data-es="¿Quién más decide? ¿Estará aquí?">Who else decides? Will they be here?</li></ul></div>
  <div class="eb" style="margin:12px 0 2px" data-es="Anota">Collect</div>
  <div class="chk"><i></i><span data-es="Primer nombre">First name</span></div>
  <div class="chk"><i></i><span data-es="Mejor hora">Best time</span></div>
  <div class="chk"><i></i><span data-es="Teléfono (se pide, nunca se compra)">Phone (asked, never bought)</span></div>
  <button class="big-cta" data-close data-es="Listo → Inspección agendada">Done → Inspection set</button>
</div></div>

<div class="sheet" id="tr"><div class="in"><div class="grab"></div>
  <div class="top"><div class="grow"><div class="eb o" data-es="Ayuda en vivo">Live help</div><div class="h1" data-es="¿Cómo se dice?">Help me say it</div></div>${X}</div>
  <div class="inp"><div data-es="Escribe o habla, en inglés o español">Type or talk, English or Spanish</div><span class="mic">${MIC}</span></div>
  <div class="tr"><div class="en">"Your insurance company decides what it pays. You file the claim."</div><div class="es">"Su aseguradora decide cuánto paga. Usted presenta el reclamo."</div></div>
  <div class="tr"><div class="en">"The adjuster is coming Tuesday. I'll be there to show the damage."</div><div class="es">"El ajustador viene el martes. Yo estaré ahí para mostrar el daño."</div></div>
  <div class="eb" style="margin-top:12px" data-es="Palabras fijas (siempre igual)">Fixed words (always the same)</div>
  <div class="gl"><span>deductible = <b>deducible</b></span><span>adjuster = <b>ajustador</b></span><span>depreciation = <b>depreciación</b></span><span>claim = <b>reclamo</b></span><span>registered = <b>registrado</b></span><span>ACV / RCV</span></div>
  <div class="lock"><b>🔒</b><span data-es="Contrato, aviso de cancelación de 3 días y aviso del deducible: solo el texto fijo en inglés y español, nunca traducido en vivo.">Contract, 3-day cancel notice and deductible notice: fixed English + Spanish text only, never live-translated.</span></div>
</div></div>

<div class="sheet" id="qp"><div class="in"><div class="grab"></div>
  <div class="top"><div class="grow"><div class="eb o" data-es="Precio rápido">Quick price</div><div class="h1">101 E 4th St</div></div>${X}</div>
  <div class="eb" data-es="Trabajo">Job</div>
  <div class="seg"><button class="on" data-es="Siding">Siding</button><button data-es="Techo">Roof</button><button data-es="Ambos">Both</button><button data-es="Canaletas">Gutters</button></div>
  <div class="eb" data-es="Tamaño (del condado)">Size (from the county)</div>
  <div class="seg"><button class="on">~1,400 ft²</button><button data-es="1 piso">1 story</button><button data-es="2 pisos">2 stories</button></div>
  <div class="card"><div class="eb" data-es="Rango estimado, no final">Estimate range, not final</div><div class="range">$10,200 – $21,850</div>
  <div class="small" data-es="Precios del mercado, no de HMP todavía. Mide antes de cotizar. En seguros, el alcance aprobado fija el precio.">Market prices, not HMP's yet. Measure before quoting. For insurance, the approved scope sets the price.</div></div>
  <div class="row" style="gap:8px"><button class="ghost" data-close data-es="Mostrar al dueño">Show homeowner</button><button class="ghost" data-close data-es="Mandar texto">Text it</button><button class="ghost" data-close data-es="Guardar">Save</button></div>
</div></div>

<div class="sheet" id="nl"><div class="in"><div class="grab"></div>
  <div class="top"><div class="grow"><div class="eb o" data-es="Nuevo">New</div><div class="h1" data-es="Nuevo cliente">New lead</div></div>${X}</div>
  <div class="field"><small data-es="Dirección">Address</small>2210 N Clarkson St</div>
  <div class="field"><small data-es="Primer nombre (opcional)">First name (optional)</small>Rosa</div>
  <div class="eb" data-es="¿De dónde vino?">Where from?</div>
  <div class="seg"><button data-es="Tormenta">Storm</button><button data-es="Casa vieja">Old house</button><button class="on" data-es="Referido">Referral</button><button data-es="Llamó">Called us</button></div>
  <div class="eb" data-es="Tipo">Type</div>
  <div class="seg"><button class="on" data-es="Seguro">Insurance</button><button data-es="Contado">Cash</button></div>
  <button class="big-cta" data-close data-es="Guardar y abrir la guía">Save + open the Sale Guide</button>
  <p class="small" style="margin-top:10px" data-es="O dile a la Mano Derecha: “nuevo cliente en 2210 Clarkson, Rosa, referido”.">Or tell the Right Hand: "new lead at 2210 Clarkson, Rosa, referral".</p>
</div></div>

<div class="sheet" id="rh"><div class="in"><div class="grab"></div>
  <div class="top"><div class="grow"><div class="eb o" data-es="Tu Mano Derecha">Your Right Hand</div><div class="h1" data-es="Dilo, yo lo anoto">Say it, I'll log it</div></div>${X}</div>
  <div class="tr"><div class="small" data-es="Tú">You</div><div class="en" data-es="toqué 20, hablé con 4, inspección en 1418 Irving el martes 3pm">knocked 20, talked to 4, inspection at 1418 Irving Tuesday 3pm</div></div>
  <div class="tr" style="border-left:3px solid var(--ok)"><div class="small" data-es="Mano Derecha">Right Hand</div><div data-es="Anoté 20 puertas y 4 pláticas. 1418 Irving: inspección mar 29, 3 PM.">Logged 20 doors and 4 talks. 1418 Irving: inspection Tue Sep 29, 3 PM.</div></div>
  <div class="inp"><div data-es="Escribe o habla, en inglés o español">Type or talk, English or Spanish</div><span class="mic">${MIC}</span></div>
  <div class="seg"><button data-sheet="tr" data-es="¿Cómo se dice…?">How do I say…?</button><button data-sheet="nl" data-es="Nuevo cliente">New lead</button></div>
</div></div>

<div class="sheet" id="more"><div class="in"><div class="grab"></div>
  <div class="top"><div class="grow"><div class="h1" data-es="Más">More</div></div>${X}</div>
  <div class="li"><div class="t"><b data-es="Vista del jefe">Boss view</b><span data-es="Resumen en español para el jefe">Spanish summary for the boss</span></div><span class="go">›</span></div>
  <div class="li"><div class="t"><b data-es="Practicar la puerta">Practice Door</b><span data-es="Ensayo con un dueño de casa AI">Role-play with an AI homeowner</span></div><span class="go">›</span></div>
  <div class="li"><div class="t"><b data-es="Imprimir la ruta de hoy">Print today's walk</b><span data-es="Respaldo en papel">Paper backup</span></div><span class="go">›</span></div>
  <div class="li"><div class="t"><b data-es="Precios y número de registro">Prices + registration #</b><span data-es="Se configuran una vez">Set once</span></div><span class="go">›</span></div>
  <div class="li"><div class="t"><b data-es="Cómo funciona un reclamo">How a claim works</b><span>RCV · ACV · <span data-es="depreciación">depreciation</span></span></div><span class="go">›</span></div>
</div></div>
<div class="toast"></div>`;
  document.querySelector('.phone').insertAdjacentHTML('beforeend', html);
})();
