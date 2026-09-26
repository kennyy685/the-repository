/* HMP App - homeowner screen MOCKUP copy (EN/ES), shared by option-a/b/c.html.
   Everything here is SAMPLE data for the design review: a made-up address, stand-in photos (img/, generated,
   not real), and price ranges built from docs/research/2026-09-26-market-prices.md (market, not HMP's prices).
   Legal guardrails (CLAUDE.md): no deductible talk, never "insurance will pay", no financing, no reviews,
   "registered" (never "licensed"), registration # left blank until the boss gives it. */
window.HS = {
  home: { name: { en: "The Garcia home", es: "Casa Garcia" }, address: "1418 Irving St, Fremont NE",
          inspected: { en: "Inspected Sept 26, 2026 by Kenny Cruz", es: "Inspección: 26 sept 2026, Kenny Cruz" } },
  ui: {
    view: { en: "Homeowner view", es: "Vista del cliente" },
    sample: { en: "Sample photo", es: "Foto de muestra" },
    tabs: [ { en: "Your home", es: "Su casa" }, { en: "Options", es: "Opciones" }, { en: "Next steps", es: "Pasos" } ],
    s1: { en: "Your home, today", es: "Su casa, hoy" },
    s1sub: { en: "What we found on the roof and walls", es: "Lo que encontramos en el techo y las paredes" },
    s2: { en: "Your options", es: "Sus opciones" },
    s2sub: { en: "New siding and roof, three ways", es: "Revestimiento y techo nuevos, de tres maneras" },
    s3: { en: "Next steps", es: "Próximos pasos" },
    s3sub: { en: "Nothing is final until you sign a written contract", es: "Nada es final hasta que firme un contrato por escrito" },
    included: { en: "What's included", es: "Qué incluye" },
    recommended: { en: "Recommended for your home", es: "Recomendado para su casa" },
    range: { en: "Estimate range, not a final price", es: "Rango estimado, no es precio final" },
    rangeNote: { en: "Your final price comes after we measure.", es: "El precio final se da después de medir." },
    colors: { en: "Try colors on a house like yours", es: "Pruebe colores en una casa como la suya" },
    colorsWhere: { en: "James Hardie Designer (free, opens their site)", es: "James Hardie Designer (gratis, abre su página)" },
    questions: { en: "Questions? Call us", es: "¿Preguntas? Llámenos" },
    next: { en: "Next", es: "Siguiente" }
  },
  photos: [
    { img: "img/photo-roof.jpg", marks: [[31.3, 41.7, 7.6], [58.3, 58.3, 6.4], [71.9, 34.7, 7]],
      title: { en: "North roof slope", es: "Techo, lado norte" },
      cap: { en: "3 hail hits: the granules are knocked off and the black mat shows.",
             es: "3 golpes de granizo: se cayó el granulado y se ve la base negra." } },
    { img: "img/photo-testsquare.jpg", marks: [], square: true,
      title: { en: "Test square, 10 × 10 ft", es: "Cuadro de prueba, 10 × 10 pies" },
      cap: { en: "9 hits marked in chalk inside one 10 × 10 ft square.",
             es: "9 golpes marcados con gis dentro de un cuadro de 10 × 10 pies." } },
    { img: "img/photo-vent.jpg", marks: [[39.6, 38.9, 8.1], [58.3, 34.7, 6.5], [49, 58.3, 9.2], [66.7, 62.5, 6]],
      title: { en: "Roof vent", es: "Ventila del techo" },
      cap: { en: "Round dents in the soft metal show the size of the hail.",
             es: "Las abolladuras redondas en el metal muestran el tamaño del granizo." } },
    { img: "img/photo-gutter.jpg", marks: [[26, 48.6, 11.3], [43.8, 45.8, 8.7], [62.5, 51.4, 10]],
      title: { en: "Front gutter", es: "Canaleta del frente" },
      cap: { en: "Dents along the face of the gutter.", es: "Abolladuras a lo largo de la canaleta." } },
    { img: "img/photo-siding.jpg", marks: [[54, 44, 16], [68.5, 67, 7]],
      title: { en: "West wall siding", es: "Revestimiento, pared oeste" },
      cap: { en: "A crack and a hole in the vinyl panels.", es: "Una grieta y un agujero en los paneles de vinil." } }
  ],
  hail: {
    title: { en: "Hail near your home", es: "Granizo cerca de su casa" },
    size: "1.75", sizeUnit: { en: "in", es: "pulg" },
    sizeLabel: { en: "Estimated hail at your address", es: "Granizo estimado en su dirección" },
    sizeLike: { en: "about golf-ball size", es: "como una pelota de golf" },
    date: { en: "Sun, Sept 14, 2026", es: "dom 14 sept 2026" }, dateLabel: { en: "Storm date", es: "Fecha de la tormenta" },
    report: { en: "1.50 in hail, 0.8 mi north", es: "Granizo de 1.50 pulg, a 0.8 millas al norte" },
    reportLabel: { en: "Nearest official report", es: "Reporte oficial más cercano" },
    reportSrc: { en: "National Weather Service storm report", es: "Reporte de tormenta del Servicio Meteorológico Nacional" },
    source: { en: "Source: NOAA radar (MRMS) checked against National Weather Service reports.",
              es: "Fuente: radar de NOAA (MRMS) comparado con reportes del Servicio Meteorológico Nacional." },
    caveat: { en: "Weather data, not proof of damage. The photos show what we found.",
              es: "Datos del clima, no prueba de daño. Las fotos muestran lo que encontramos." }
  },
  insurer: {
    head: { en: "Your insurance company decides what your policy covers.",
            es: "Su aseguradora decide qué cubre su póliza." },
    body: { en: "If you choose to file a claim, you file it. We can be there when the adjuster visits to show what we found.",
            es: "Si usted decide presentar un reclamo, usted lo presenta. Podemos estar presentes cuando venga el ajustador para mostrarle lo que encontramos." }
  },
  tiers: [
    { key: "good", name: { en: "Good", es: "Buena" }, siding: { en: "Vinyl siding", es: "Revestimiento de vinil" },
      roof: { en: "Architectural shingle roof", es: "Techo de tejas arquitectónicas" },
      price: "$25,000 – $32,000", short: "$25k–32k",
      inc: [ { en: "Tear-off and haul-away of old siding and roof", es: "Quitamos y nos llevamos el revestimiento y techo viejo" },
             { en: "New house wrap under the siding", es: "Barrera nueva contra aire y agua (house wrap)" },
             { en: "Vinyl siding with new trim", es: "Revestimiento de vinil con molduras nuevas" },
             { en: "Architectural shingles, underlayment, drip edge", es: "Tejas arquitectónicas, membrana y borde de goteo" },
             { en: "Daily cleanup and magnet sweep for nails", es: "Limpieza diaria e imán para recoger clavos" } ] },
    { key: "better", rec: true, name: { en: "Better", es: "Mejor" }, siding: { en: "Insulated vinyl siding", es: "Vinil con aislante" },
      roof: { en: "Architectural shingles + ice & water shield", es: "Tejas arquitectónicas + protección contra hielo y agua" },
      price: "$29,000 – $37,000", short: "$29k–37k",
      inc: [ { en: "Everything in Good", es: "Todo lo de la opción Buena" },
             { en: "Foam-backed vinyl: stiffer, straighter walls, quieter", es: "Vinil con espuma: más firme, paredes más rectas, menos ruido" },
             { en: "Ice & water shield at the eaves and valleys", es: "Protección contra hielo y agua en aleros y valles" } ] },
    { key: "best", name: { en: "Best", es: "Superior" }, siding: { en: "James Hardie fiber cement", es: "Fibrocemento James Hardie" },
      roof: { en: "Class 4 impact-rated shingles", es: "Tejas resistentes a impacto, Clase 4" },
      price: "$36,000 – $48,000", short: "$36k–48k",
      inc: [ { en: "Everything in Better, with Hardie instead of vinyl", es: "Todo lo de Mejor, con Hardie en lugar de vinil" },
             { en: "Fiber cement with a factory-baked color finish", es: "Fibrocemento con color horneado de fábrica" },
             { en: "Shingles tested for hail impact (UL 2218 Class 4)", es: "Tejas probadas contra impacto de granizo (UL 2218 Clase 4)" } ] }
  ],
  warranty: { en: "Warranty: the manufacturer's product warranty plus HMP's workmanship warranty, both written in your contract.",
              es: "Garantía: la del fabricante del producto más la garantía de mano de obra de HMP, las dos por escrito en su contrato." },
  colorUrl: "https://www.jameshardie.com/hardie-designer",
  steps: [
    { title: { en: "We measure", es: "Medimos" },
      body: { en: "Every wall and roof slope, so your price is exact. About 1 hour.",
              es: "Cada pared y cada lado del techo, para darle el precio exacto. Como 1 hora." } },
    { title: { en: "Written contract", es: "Contrato por escrito" },
      body: { en: "Price, materials, colors and warranty, all in writing. Never a handshake.",
              es: "Precio, materiales, colores y garantía, todo por escrito. Nunca de palabra." },
      cancel: { en: "3-day right to cancel: you can cancel until midnight of the third business day after you sign. We explain it out loud and leave you 2 copies of the cancel form.",
                es: "Derecho a cancelar en 3 días: puede cancelar hasta la medianoche del tercer día hábil después de firmar. Se lo explicamos en persona y le dejamos 2 copias del formulario de cancelación." } },
    { title: { en: "Pick your date", es: "Escoja la fecha" },
      body: { en: "Choose the start day that works for you. We call the day before to confirm.",
              es: "Escoja el día de inicio que le convenga. Le llamamos un día antes para confirmar." } }
  ],
  contacts: [
    { name: "Kenny Cruz", lang: { en: "English", es: "Inglés" }, phone: "402-936-2709", tel: "+14029362709" },
    { name: "Alex Mendez", lang: { en: "Español", es: "Español" }, phone: "402-889-3385", tel: "+14028893385" }
  ],
  company: { en: "HMP Siding & Roofing LLC · Fremont, NE · Registered Nebraska contractor #",
             es: "HMP Siding & Roofing LLC · Fremont, NE · Contratista registrado en Nebraska #" }
};
/* tiny helpers every option uses */
window.HS.lang = (new URLSearchParams(location.search).get("lang") === "es") ? "es" : "en";
window.t = (o) => (o && typeof o === "object" && "en" in o) ? o[window.HS.lang] : o;
window.HS.setLang = (l) => { const u = new URL(location.href); u.searchParams.set("lang", l); location.href = u.toString(); };
