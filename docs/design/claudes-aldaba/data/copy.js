/* Claude's Aldaba: copy deck. Every string is {en, es}; lists are arrays of those.
 * Exceptions (plain strings): ids, keys, statute cites (law.cite, armor[].cite), numbers.
 * Placeholders in braces, filled by the code: {n} {i} {t} {a} {p} {x} {y} {d} {c} {mi} {min}
 *   {zone} {name} {date} {start} {end} {address} {key} {outcome} {amount}.
 * Shape: deal.{labels, steps[8], armor[], homeowner} knock.{outcomes[5], card, legal, recap}
 *   now, storms, money, film.beats[12], colophon, ui.
 * ui.lang.switchTo is the label of the button that switches to the OTHER language.
 * Spanish is Latin American, "tu" in the app, "usted" on the homeowner sheet.
 * Save as UTF-8; pages need <meta charset="utf-8">. */
window.COPY = {
  "deal": {
    "labels": {
      "title": {
        "en": "Deal",
        "es": "Venta"
      },
      "subtitle": {
        "en": "One door, from first knock to a signed job",
        "es": "Una puerta, desde el primer toque hasta un trabajo firmado"
      },
      "collect": {
        "en": "Collect",
        "es": "Anota"
      },
      "law": {
        "en": "The law",
        "es": "La ley"
      },
      "also": {
        "en": "Also on this step",
        "es": "También en este paso"
      },
      "rule": {
        "en": "House rule",
        "es": "Regla de la casa"
      },
      "next": {
        "en": "Next",
        "es": "Sigue"
      },
      "doneWhen": {
        "en": "Done when",
        "es": "Listo cuando"
      },
      "armorTitle": {
        "en": "Legal armor",
        "es": "Armadura legal"
      },
      "armorNote": {
        "en": "Plain-language notes on Nebraska statutes. A Nebraska attorney should review the printed forms.",
        "es": "Notas en lenguaje sencillo sobre los estatutos de Nebraska. Un abogado de Nebraska debe revisar los formularios impresos."
      },
      "homeownerTab": {
        "en": "Homeowner sheet",
        "es": "Hoja del dueño"
      },
      "stepsTab": {
        "en": "The path",
        "es": "El camino"
      },
      "sheetSample": {
        "en": "Sample sheet. Not a signed document.",
        "es": "Hoja de muestra. No es un documento firmado."
      }
    },
    "steps": [
      {
        "id": "intro",
        "title": {
          "en": "Intro at the door",
          "es": "Presentación en la puerta"
        },
        "collect": [
          {
            "en": "Said first: your name, HMP Siding & Roofing, and that we do roofing, siding and gutters",
            "es": "Dicho primero: tu nombre, HMP Siding & Roofing y que hacemos techos, siding y canaletas"
          },
          {
            "en": "Owner or renter",
            "es": "Dueño o inquilino"
          },
          {
            "en": "A yes to an inspection: now, later today or another day",
            "es": "Un sí a una inspección: ahora, más tarde hoy u otro día"
          },
          {
            "en": "A phone number, if they choose to give one",
            "es": "Un teléfono, si quieren dártelo"
          }
        ],
        "law": {
          "cite": "Neb. Rev. Stat. 69-1602",
          "plain": {
            "en": "At the start of a home sale, say clearly your own name, the business you work for and what you sell.",
            "es": "Al empezar una venta a domicilio, di con claridad tu nombre, la empresa para la que trabajas y lo que vendes."
          }
        },
        "next": {
          "en": "With a yes, you look at the house together.",
          "es": "Con un sí, miran la casa juntos."
        },
        "done_when": {
          "en": "Name, HMP and what we sell were said first, and you have a yes, a time or a clear no.",
          "es": "Dijiste primero tu nombre, HMP y lo que vendemos, y tienes un sí, una hora o un no claro."
        }
      },
      {
        "id": "look",
        "title": {
          "en": "Look and photos",
          "es": "Vistazo y fotos"
        },
        "collect": [
          {
            "en": "House number photo first, with phone location turned on",
            "es": "Foto del número de la casa primero, con la ubicación del teléfono activada"
          },
          {
            "en": "One wide photo of each side of the house",
            "es": "Una foto amplia de cada lado de la casa"
          },
          {
            "en": "What shows from the street: gutter dents, torn screens, bent AC fins, dented vents, siding cracks",
            "es": "Lo que se ve desde la calle: canaletas abolladas, mallas rotas, aletas del A/C dobladas, ventilas abolladas, grietas en el siding"
          },
          {
            "en": "Close-ups of soft metal: vents, flashing, gutter straps",
            "es": "Fotos de cerca del metal blando: ventilas, tapajuntas, soportes de canaleta"
          },
          {
            "en": "One clean side next to the storm side, for comparison",
            "es": "Un lado sin daño junto al lado de la tormenta, para comparar"
          }
        ],
        "law": null,
        "next": {
          "en": "The homeowner sees the photos on your phone, then you set the inspection.",
          "es": "El dueño ve las fotos en tu teléfono y después se agenda la inspección."
        },
        "done_when": {
          "en": "House number, four sides and soft metals are photographed, and the homeowner has seen them.",
          "es": "El número de casa, los cuatro lados y el metal blando están fotografiados, y el dueño los vio."
        }
      },
      {
        "id": "inspection",
        "title": {
          "en": "Inspection",
          "es": "Inspección"
        },
        "collect": [
          {
            "en": "A test square on each slope you can reach safely: wide, medium, and close-up with a coin for scale. Mark it with tape or flags, never chalk",
            "es": "Un cuadro de prueba en cada lado del techo al que puedas subir con seguridad: amplia, mediana y de cerca con una moneda de referencia. Márcalo con cinta o banderitas, nunca con tiza"
          },
          {
            "en": "Siding: the storm side wide, then each hit up close with a tape or coin",
            "es": "Siding: el lado de la tormenta en amplia, luego cada golpe de cerca con una cinta o moneda"
          },
          {
            "en": "Roof unsafe to climb: ground photos of the roofline from several angles",
            "es": "Techo inseguro para subir: fotos desde el suelo de la orilla del techo, desde varios ángulos"
          },
          {
            "en": "When they noticed the damage, and their insurance company's name",
            "es": "Cuándo notaron el daño y el nombre de su aseguradora"
          },
          {
            "en": "If they already reported it, any earlier hail claim or repair, any leak now",
            "es": "Si ya lo reportaron, algún reclamo o reparación anterior por granizo, alguna gotera ahora"
          },
          {
            "en": "A signed inspection form for the next visit. It is not a contract",
            "es": "Un formulario de inspección firmado para la siguiente visita. No es un contrato"
          }
        ],
        "law": null,
        "next": {
          "en": "The homeowner reports the damage to their own insurance company. You note the adjuster's visit date.",
          "es": "El dueño reporta el daño a su propia aseguradora. Tú anotas la fecha de la visita del ajustador."
        },
        "done_when": {
          "en": "Every photo is in, the finding fits in one plain sentence, the form is signed and the next day is set.",
          "es": "Están todas las fotos, el hallazgo cabe en una frase clara, el formulario está firmado y el siguiente día está fijado."
        },
        "rule": {
          "en": "Describe what the photos show. Never predict what a claim will do or whether a storm date qualifies anyone.",
          "es": "Describe lo que muestran las fotos. Nunca anticipes lo que hará un reclamo ni si una fecha de tormenta le da derecho a alguien."
        }
      },
      {
        "id": "adjuster",
        "title": {
          "en": "Meet the adjuster",
          "es": "Reunión con el ajustador"
        },
        "collect": [
          {
            "en": "The adjuster's name, and the visit date and time",
            "es": "El nombre del ajustador, y la fecha y hora de la visita"
          },
          {
            "en": "The claim number, from the homeowner",
            "es": "El número de reclamo, que da el dueño"
          },
          {
            "en": "Photos and damage counts on hand to show what you found",
            "es": "Fotos y conteos de daños listos para mostrar lo que encontraste"
          },
          {
            "en": "The homeowner there, or their OK for you to be there",
            "es": "El dueño presente, o su permiso para que tú estés allí"
          },
          {
            "en": "The insurance company's written scope, when the homeowner shares it",
            "es": "El alcance por escrito de la aseguradora, cuando el dueño lo comparta"
          },
          {
            "en": "The mortgage company's name, if it is on the policy",
            "es": "El nombre de la compañía hipotecaria, si aparece en la póliza"
          }
        ],
        "law": {
          "cite": "Neb. Rev. Stat. 44-9204",
          "plain": {
            "en": "Negotiating a claim is public adjuster work, and HMP does not do it. HMP documents the damage and meets the adjuster. The insurance company decides the claim.",
            "es": "Negociar un reclamo es trabajo de un ajustador público, y HMP no lo hace. HMP documenta el daño y se reúne con el ajustador. La aseguradora decide el reclamo."
          }
        },
        "next": {
          "en": "The insurance company sends its decision to the homeowner, who shares it with you.",
          "es": "La aseguradora manda su decisión al dueño, y él la comparte contigo."
        },
        "done_when": {
          "en": "The visit happened and the homeowner has shared the insurance company's written scope with you.",
          "es": "La visita se hizo y el dueño compartió contigo el alcance por escrito de la aseguradora."
        }
      },
      {
        "id": "itemized",
        "title": {
          "en": "Itemized description",
          "es": "Descripción detallada"
        },
        "collect": [
          {
            "en": "The work by trade: roof, siding, gutters, soffit and fascia",
            "es": "El trabajo por oficio: techo, siding, canaletas, sofito y fascia"
          },
          {
            "en": "Materials with brand and color",
            "es": "Materiales con marca y color"
          },
          {
            "en": "Labor and fees, line by line",
            "es": "Mano de obra y cargos, línea por línea"
          },
          {
            "en": "The total amount agreed for the work",
            "es": "El monto total acordado por el trabajo"
          },
          {
            "en": "One copy to the homeowner and one to the insurance company, with the send dates",
            "es": "Una copia para el dueño y una para la aseguradora, con las fechas de envío"
          }
        ],
        "law": {
          "cite": "Neb. Rev. Stat. 44-8606",
          "plain": {
            "en": "Before any repair starts on an insurance job, the homeowner and the insurance company both get an itemized description: the work, materials, labor, fees and the total.",
            "es": "Antes de empezar cualquier reparación en un trabajo con reclamo de seguro, el dueño y la aseguradora reciben una descripción detallada: el trabajo, los materiales, la mano de obra, los cargos y el total."
          }
        },
        "next": {
          "en": "The homeowner reviews it. If they choose HMP, the contract comes next.",
          "es": "El dueño la revisa. Si elige a HMP, sigue el contrato."
        },
        "done_when": {
          "en": "Both copies are sent and dated before any repair work goes on the calendar.",
          "es": "Las dos copias están enviadas y fechadas antes de poner cualquier reparación en el calendario."
        }
      },
      {
        "id": "contract",
        "title": {
          "en": "Contract and cancel notice",
          "es": "Contrato y aviso de cancelación"
        },
        "collect": [
          {
            "en": "A signed contract: scope, price, payment schedule and start date",
            "es": "Un contrato firmado: alcance, precio, calendario de pagos y fecha de inicio"
          },
          {
            "en": "The Buyer's Right to Cancel notice, printed in the contract under its own caption",
            "es": "El aviso de Derecho del comprador a cancelar, impreso en el contrato bajo su propio título"
          },
          {
            "en": "Two cancel forms, filled in and handed over, in English and Spanish when the buyer's main language is Spanish",
            "es": "Dos formularios de cancelación, llenos y entregados, en inglés y español si el comprador habla principalmente español"
          },
          {
            "en": "The sale date written on the forms, and initials that you explained the right out loud",
            "es": "La fecha de la venta escrita en los formularios, y las iniciales de que explicaste el derecho en voz alta"
          },
          {
            "en": "HMP's name and mailing address on the notice: 2600 Laverna St, Apt 50, Fremont, NE 68025",
            "es": "El nombre y la dirección postal de HMP en el aviso: 2600 Laverna St, Apt 50, Fremont, NE 68025"
          },
          {
            "en": "Insurance job: the state's notice on rebates, signed by the homeowner",
            "es": "Trabajo con seguro: el aviso del estado sobre reembolsos, firmado por el dueño"
          },
          {
            "en": "The contractor registration number line, filled in once HMP has its number",
            "es": "La línea del número de registro de contratista, llena cuando HMP tenga su número"
          }
        ],
        "law": {
          "cite": "Neb. Rev. Stat. 69-1601, 69-1604",
          "plain": {
            "en": "Every sale made at the customer's home gets a written notice of the right to cancel within 3 business days. When the buyer's main language is Spanish, it goes in English and Spanish.",
            "es": "Toda venta hecha en la casa del cliente lleva un aviso por escrito del derecho a cancelar dentro de 3 días hábiles. Si el comprador habla principalmente español, va en inglés y en español."
          }
        },
        "next": {
          "en": "The 3-business-day cancel window opens.",
          "es": "Se abre el plazo de 3 días hábiles para cancelar."
        },
        "done_when": {
          "en": "Contract signed, both cancel forms in the homeowner's hands, sale date written, initials on the page.",
          "es": "Contrato firmado, los dos formularios de cancelación en manos del dueño, fecha de la venta escrita, iniciales en la hoja."
        },
        "also": [
          {
            "cite": "Neb. Rev. Stat. 44-8604",
            "plain": {
              "en": "Never offer, hint at, cover, waive or rebate the part of a claim the homeowner pays. HMP never pays a homeowner for a claim.",
              "es": "Nunca ofrecer, insinuar, cubrir, perdonar ni devolver la parte del reclamo que le toca pagar al dueño. HMP nunca le paga a un dueño por un reclamo."
            }
          },
          {
            "cite": "Neb. Rev. Stat. 44-8605",
            "plain": {
              "en": "Nebraska sets strict rules for signing over insurance rights. HMP takes no assignment and is never named on an insurance check.",
              "es": "Nebraska pone reglas estrictas para ceder los derechos del seguro. HMP no toma cesiones y nunca aparece en un cheque del seguro."
            }
          },
          {
            "cite": "Neb. Rev. Stat. 44-8607",
            "plain": {
              "en": "Insurance-job contracts carry the state's notice on rebates. The homeowner signs it, and a copy goes to the insurance company before any claim payment.",
              "es": "Los contratos de trabajos con seguro llevan el aviso del estado sobre reembolsos. El dueño lo firma y se manda una copia a la aseguradora antes de cualquier pago del reclamo."
            }
          }
        ]
      },
      {
        "id": "window",
        "title": {
          "en": "Cancel window",
          "es": "Plazo para cancelar"
        },
        "collect": [
          {
            "en": "The window's end on the calendar: midnight of the third business day",
            "es": "El fin del plazo en el calendario: medianoche del tercer día hábil"
          },
          {
            "en": "Insurance job: a later end date if the insurance company says in writing that any part is not covered",
            "es": "Trabajo con seguro: una fecha final posterior si la aseguradora avisa por escrito que alguna parte no está cubierta"
          },
          {
            "en": "Nothing started on the house while the window is open, on a non-insurance sale",
            "es": "Nada empezado en la casa mientras el plazo esté abierto, en una venta sin reclamo de seguro"
          },
          {
            "en": "The mail checked for a cancel notice sent inside the window. A mailed notice counts the day it is mailed",
            "es": "El correo revisado por si hay un aviso de cancelación enviado dentro del plazo. Un aviso enviado por correo cuenta el día que se manda"
          },
          {
            "en": "If a notice comes: the buyer's payments returned within 10 days",
            "es": "Si llega un aviso: los pagos del comprador devueltos en 10 días"
          }
        ],
        "law": {
          "cite": "Neb. Rev. Stat. 69-1606(5)",
          "plain": {
            "en": "Work done before a sale is canceled earns no pay. On a non-insurance sale, HMP starts nothing until the cancel window ends.",
            "es": "El trabajo hecho antes de que se cancele una venta no se cobra. En una venta sin reclamo de seguro, HMP no empieza nada hasta que termina el plazo para cancelar."
          }
        },
        "next": {
          "en": "The window closes. With no notice, the build goes on the calendar.",
          "es": "Cierra el plazo. Sin aviso de cancelación, la obra entra al calendario."
        },
        "done_when": {
          "en": "The window has closed and the mail shows no notice sent inside it.",
          "es": "El plazo cerró y el correo no muestra ningún aviso enviado dentro de él."
        },
        "also": [
          {
            "cite": "Neb. Rev. Stat. 69-1603",
            "plain": {
              "en": "The buyer can cancel until midnight of the third business day after getting the notice. Any written words work, and a mailed notice counts the day it is mailed.",
              "es": "El comprador puede cancelar hasta la medianoche del tercer día hábil después de recibir el aviso. Sirve cualquier escrito, y un aviso enviado por correo cuenta el día que se manda."
            }
          },
          {
            "cite": "Neb. Rev. Stat. 44-8603",
            "plain": {
              "en": "On an insurance job, the window also runs until midnight of the third business day after the insurance company says in writing that any part is not covered, if that date is later.",
              "es": "En un trabajo con reclamo de seguro, el plazo también corre hasta la medianoche del tercer día hábil después de que la aseguradora avise por escrito que alguna parte no está cubierta, si esa fecha es posterior."
            }
          },
          {
            "cite": "Neb. Rev. Stat. 69-1605",
            "plain": {
              "en": "If a sale is canceled, HMP returns the buyer's payments within 10 days.",
              "es": "Si se cancela una venta, HMP devuelve los pagos del comprador en un plazo de 10 días."
            }
          }
        ]
      },
      {
        "id": "build",
        "title": {
          "en": "Build",
          "es": "La obra"
        },
        "collect": [
          {
            "en": "The building permit from the city or county",
            "es": "El permiso de construcción de la ciudad o del condado"
          },
          {
            "en": "Materials, brand and color confirmed in writing",
            "es": "Materiales, marca y color confirmados por escrito"
          },
          {
            "en": "Start date and expected finish, weather allowing",
            "es": "Fecha de inicio y de término estimadas, si el clima lo permite"
          },
          {
            "en": "Every change on a signed change order, insurer-approved extras included",
            "es": "Todo cambio en una orden de cambio firmada, incluidos los extras que apruebe la aseguradora"
          },
          {
            "en": "Cleanup each work day, with a magnet over the yard and driveway",
            "es": "Limpieza cada día de trabajo, con imán sobre el patio y el driveway"
          },
          {
            "en": "A final walk-through with the homeowner, and after photos of every side",
            "es": "Un recorrido final con el dueño, y fotos del después de cada lado"
          }
        ],
        "law": {
          "cite": "Neb. Rev. Stat. 48-2104",
          "plain": {
            "en": "Nebraska contractors register with the Department of Labor before any construction work. The registration number goes on HMP's paperwork.",
            "es": "Los contratistas de Nebraska se registran en el Departamento del Trabajo antes de cualquier obra. El número de registro va en los papeles de HMP."
          }
        },
        "next": {
          "en": "The final payment follows the contract's schedule.",
          "es": "El pago final sigue el calendario del contrato."
        },
        "done_when": {
          "en": "Work complete, walk-through done, cleanup finished, after photos in.",
          "es": "Trabajo terminado, recorrido hecho, limpieza lista, fotos del después guardadas."
        }
      }
    ],
    "armor": [
      {
        "id": "intro-disclosure",
        "cite": "Neb. Rev. Stat. 69-1602",
        "title": {
          "en": "Say who you are, first",
          "es": "Di quién eres, primero"
        },
        "plain": {
          "en": "At the start of a home sale, say clearly your own name, the business you work for and what you sell.",
          "es": "Al empezar una venta a domicilio, di con claridad tu nombre, la empresa para la que trabajas y lo que vendes."
        }
      },
      {
        "id": "cancel-notice",
        "cite": "Neb. Rev. Stat. 69-1601, 69-1604",
        "title": {
          "en": "Written cancel notice",
          "es": "Aviso de cancelación por escrito"
        },
        "plain": {
          "en": "Every sale made at the customer's home gets a written notice of the right to cancel within 3 business days. When the buyer's main language is Spanish, it goes in English and Spanish.",
          "es": "Toda venta hecha en la casa del cliente lleva un aviso por escrito del derecho a cancelar dentro de 3 días hábiles. Si el comprador habla principalmente español, va en inglés y en español."
        }
      },
      {
        "id": "cancel-how",
        "cite": "Neb. Rev. Stat. 69-1603",
        "title": {
          "en": "How the buyer cancels",
          "es": "Cómo cancela el comprador"
        },
        "plain": {
          "en": "The buyer can cancel until midnight of the third business day after getting the notice. Any written words work, and a mailed notice counts the day it is mailed.",
          "es": "El comprador puede cancelar hasta la medianoche del tercer día hábil después de recibir el aviso. Sirve cualquier escrito, y un aviso enviado por correo cuenta el día que se manda."
        }
      },
      {
        "id": "no-early-work",
        "cite": "Neb. Rev. Stat. 69-1606(5)",
        "title": {
          "en": "No work before the window closes",
          "es": "Nada de trabajo antes de que cierre el plazo"
        },
        "plain": {
          "en": "Work done before a sale is canceled earns no pay. On a non-insurance sale, HMP starts nothing until the cancel window ends.",
          "es": "El trabajo hecho antes de que se cancele una venta no se cobra. En una venta sin reclamo de seguro, HMP no empieza nada hasta que termina el plazo para cancelar."
        }
      },
      {
        "id": "refund",
        "cite": "Neb. Rev. Stat. 69-1605",
        "title": {
          "en": "Money back",
          "es": "Devolución del dinero"
        },
        "plain": {
          "en": "If a sale is canceled, HMP returns the buyer's payments within 10 days.",
          "es": "Si se cancela una venta, HMP devuelve los pagos del comprador en un plazo de 10 días."
        }
      },
      {
        "id": "insurance-window",
        "cite": "Neb. Rev. Stat. 44-8603",
        "title": {
          "en": "Insurance jobs can cancel later",
          "es": "En trabajos con seguro se puede cancelar después"
        },
        "plain": {
          "en": "On an insurance job, the window also runs until midnight of the third business day after the insurance company says in writing that any part is not covered, if that date is later.",
          "es": "En un trabajo con reclamo de seguro, el plazo también corre hasta la medianoche del tercer día hábil después de que la aseguradora avise por escrito que alguna parte no está cubierta, si esa fecha es posterior."
        }
      },
      {
        "id": "itemized",
        "cite": "Neb. Rev. Stat. 44-8606",
        "title": {
          "en": "Itemized description first",
          "es": "Primero la descripción detallada"
        },
        "plain": {
          "en": "Before any repair starts on an insurance job, the homeowner and the insurance company both get an itemized description: the work, materials, labor, fees and the total.",
          "es": "Antes de empezar cualquier reparación en un trabajo con reclamo de seguro, el dueño y la aseguradora reciben una descripción detallada: el trabajo, los materiales, la mano de obra, los cargos y el total."
        }
      },
      {
        "id": "no-rebates",
        "cite": "Neb. Rev. Stat. 44-8604",
        "title": {
          "en": "No rebates, no payments",
          "es": "Sin reembolsos ni pagos"
        },
        "plain": {
          "en": "Never offer, hint at, cover, waive or rebate the part of a claim the homeowner pays. HMP never pays a homeowner for a claim.",
          "es": "Nunca ofrecer, insinuar, cubrir, perdonar ni devolver la parte del reclamo que le toca pagar al dueño. HMP nunca le paga a un dueño por un reclamo."
        }
      },
      {
        "id": "no-assignment",
        "cite": "Neb. Rev. Stat. 44-8605",
        "title": {
          "en": "No assignment of benefits",
          "es": "Sin cesión de beneficios"
        },
        "plain": {
          "en": "Nebraska sets strict rules for signing over insurance rights. HMP takes no assignment and is never named on an insurance check.",
          "es": "Nebraska pone reglas estrictas para ceder los derechos del seguro. HMP no toma cesiones y nunca aparece en un cheque del seguro."
        }
      },
      {
        "id": "state-notice",
        "cite": "Neb. Rev. Stat. 44-8607",
        "title": {
          "en": "State notice in the contract",
          "es": "Aviso del estado en el contrato"
        },
        "plain": {
          "en": "Insurance-job contracts carry the state's notice on rebates. The homeowner signs it, and a copy goes to the insurance company before any claim payment.",
          "es": "Los contratos de trabajos con seguro llevan el aviso del estado sobre reembolsos. El dueño lo firma y se manda una copia a la aseguradora antes de cualquier pago del reclamo."
        }
      },
      {
        "id": "no-negotiating",
        "cite": "Neb. Rev. Stat. 44-9204",
        "title": {
          "en": "We document, we do not negotiate",
          "es": "Documentamos, no negociamos"
        },
        "plain": {
          "en": "Negotiating a claim is public adjuster work, and HMP does not do it. HMP documents the damage and meets the adjuster. The insurance company decides the claim.",
          "es": "Negociar un reclamo es trabajo de un ajustador público, y HMP no lo hace. HMP documenta el daño y se reúne con el ajustador. La aseguradora decide el reclamo."
        }
      },
      {
        "id": "registered",
        "cite": "Neb. Rev. Stat. 48-2104",
        "title": {
          "en": "Registered contractor",
          "es": "Contratista registrado"
        },
        "plain": {
          "en": "Nebraska contractors register with the Department of Labor before any construction work. The registration number goes on HMP's paperwork.",
          "es": "Los contratistas de Nebraska se registran en el Departamento del Trabajo antes de cualquier obra. El número de registro va en los papeles de HMP."
        }
      }
    ],
    "homeowner": {
      "brand": {
        "en": "HMP Siding & Roofing",
        "es": "HMP Siding & Roofing"
      },
      "legalName": {
        "en": "HMP Siding & Roofing LLC",
        "es": "HMP Siding & Roofing LLC"
      },
      "title": {
        "en": "What happens next",
        "es": "Lo que sigue"
      },
      "greeting": {
        "en": "Thank you for having us look at your home.",
        "es": "Gracias por dejarnos revisar su casa."
      },
      "steps": [
        {
          "id": "today",
          "title": {
            "en": "Today",
            "es": "Hoy"
          },
          "body": {
            "en": "We looked at your home and took photos. You can see any of them on our phone.",
            "es": "Revisamos su casa y tomamos fotos. Puede ver cualquiera en nuestro teléfono."
          }
        },
        {
          "id": "insurer",
          "title": {
            "en": "Your insurance company",
            "es": "Su aseguradora"
          },
          "body": {
            "en": "If you want to report the damage, you contact your insurance company. Only your insurance company decides what your policy covers.",
            "es": "Si quiere reportar el daño, usted se comunica con su aseguradora. Solo su aseguradora decide lo que cubre su póliza."
          }
        },
        {
          "id": "adjuster",
          "title": {
            "en": "The adjuster's visit",
            "es": "La visita del ajustador"
          },
          "body": {
            "en": "If you ask, we come along to show what we found. We do not negotiate or settle your claim.",
            "es": "Si usted lo pide, lo acompañamos para mostrar lo que encontramos. No negociamos ni resolvemos su reclamo."
          }
        },
        {
          "id": "itemized",
          "title": {
            "en": "A written description",
            "es": "Una descripción por escrito"
          },
          "body": {
            "en": "Before any repair starts, you get an itemized description of the work: materials, labor, fees and the total. On a job tied to an insurance claim, your insurance company gets the same one.",
            "es": "Antes de empezar cualquier reparación, usted recibe una descripción detallada del trabajo: materiales, mano de obra, cargos y el total. En un trabajo ligado a un reclamo de seguro, su aseguradora recibe la misma."
          }
        },
        {
          "id": "contract",
          "title": {
            "en": "Your contract",
            "es": "Su contrato"
          },
          "body": {
            "en": "If you choose to work with HMP, you sign a written contract. You get a copy and two cancel forms.",
            "es": "Si decide trabajar con HMP, firma un contrato por escrito. Usted recibe una copia y dos formularios de cancelación."
          }
        },
        {
          "id": "window",
          "title": {
            "en": "Your 3 business days",
            "es": "Sus 3 días hábiles"
          },
          "body": {
            "en": "You can change your mind during this time. If your job is not part of an insurance claim, we start no work until this time ends.",
            "es": "Usted puede cambiar de opinión durante este tiempo. Si su trabajo no es parte de un reclamo de seguro, no empezamos ningún trabajo hasta que termine este plazo."
          }
        },
        {
          "id": "work",
          "title": {
            "en": "The work",
            "es": "El trabajo"
          },
          "body": {
            "en": "We schedule the work and get the permits. We clean up each work day and walk the finished job with you.",
            "es": "Programamos el trabajo y sacamos los permisos. Limpiamos cada día de trabajo y recorremos con usted el trabajo terminado."
          }
        }
      ],
      "cancel": {
        "title": {
          "en": "Your right to cancel",
          "es": "Su derecho a cancelar"
        },
        "lead": {
          "en": "You can cancel this agreement until midnight of the third business day after you sign it.",
          "es": "Usted puede cancelar este acuerdo hasta la medianoche del tercer día hábil después de firmarlo."
        },
        "how": {
          "en": "To cancel, mail a written note to HMP Siding & Roofing LLC, 2600 Laverna St, Apt 50, Fremont, NE 68025. Any written note that says you do not want the agreement will work. The cancel form in your contract is the easiest way. A note counts the day you mail it.",
          "es": "Para cancelar, mande por correo una nota escrita a HMP Siding & Roofing LLC, 2600 Laverna St, Apt 50, Fremont, NE 68025. Sirve cualquier nota escrita que diga que ya no quiere el acuerdo. El formulario de cancelación de su contrato es la forma más fácil. Una nota cuenta el día que la manda por correo."
        },
        "insurance": {
          "en": "If your job is paid from an insurance claim, you can also cancel until midnight of the third business day after your insurance company tells you in writing that any part is not covered, if that date is later.",
          "es": "Si su trabajo se paga con un reclamo de seguro, también puede cancelar hasta la medianoche del tercer día hábil después de que su aseguradora le avise por escrito que alguna parte no está cubierta, si esa fecha es posterior."
        },
        "refund": {
          "en": "If you cancel on time, HMP returns your payments within 10 days.",
          "es": "Si cancela a tiempo, HMP le devuelve sus pagos en un plazo de 10 días."
        },
        "endsOn": {
          "en": "Your right to cancel ends at midnight on: ____________",
          "es": "Su derecho a cancelar termina a la medianoche del: ____________"
        },
        "official": {
          "en": "Your contract carries the official notice and the cancel forms. This page is a plain summary.",
          "es": "Su contrato lleva el aviso oficial y los formularios de cancelación. Esta hoja es un resumen sencillo."
        }
      },
      "contact": {
        "mailingLabel": {
          "en": "Mailing address",
          "es": "Dirección postal"
        },
        "mailing": {
          "en": "HMP Siding & Roofing LLC, 2600 Laverna St, Apt 50, Fremont, NE 68025",
          "es": "HMP Siding & Roofing LLC, 2600 Laverna St, Apt 50, Fremont, NE 68025"
        },
        "phone": {
          "en": "Questions? Call your HMP rep on the number on this sheet.",
          "es": "¿Preguntas? Llame a su representante de HMP al número de esta hoja."
        },
        "registration": {
          "en": "Nebraska contractor registration #: ____________",
          "es": "Registro de contratista de Nebraska n.º: ____________"
        },
        "saleDate": {
          "en": "Date of sale: ____________",
          "es": "Fecha de la venta: ____________"
        },
        "rep": {
          "en": "Sales rep: ____________  Phone: ____________",
          "es": "Vendedor: ____________  Teléfono: ____________"
        }
      }
    }
  },
  "knock": {
    "title": {
      "en": "Knock",
      "es": "Puertas"
    },
    "walkTitle": {
      "en": "Your walk, in order",
      "es": "Tu ruta, en orden"
    },
    "progress": {
      "en": "Door {i} of {n}",
      "es": "Puerta {i} de {n}"
    },
    "next": {
      "en": "Next: {address}",
      "es": "Sigue: {address}"
    },
    "outcomesTitle": {
      "en": "How did the door go?",
      "es": "¿Cómo salió la puerta?"
    },
    "keys": {
      "en": "Keys N, T, I, X and B log the door. U undoes the last one.",
      "es": "Las teclas N, T, I, X y B anotan la puerta. U deshace la última."
    },
    "keyHint": {
      "en": "Press {key}",
      "es": "Pulsa {key}"
    },
    "outcomes": [
      {
        "id": "no_answer",
        "key": "N",
        "label": {
          "en": "No answer",
          "es": "No abrió"
        },
        "hint": {
          "en": "Nobody came to the door.",
          "es": "Nadie salió a la puerta."
        }
      },
      {
        "id": "talked",
        "key": "T",
        "label": {
          "en": "Talked",
          "es": "Hablamos"
        },
        "hint": {
          "en": "You spoke with someone. No inspection yet.",
          "es": "Hablaste con alguien. Todavía sin inspección."
        }
      },
      {
        "id": "inspection_set",
        "key": "I",
        "label": {
          "en": "Inspection set",
          "es": "Inspección agendada"
        },
        "hint": {
          "en": "They agreed to an inspection. Save the time.",
          "es": "Aceptaron una inspección. Guarda la hora."
        }
      },
      {
        "id": "not_interested",
        "key": "X",
        "label": {
          "en": "Not interested",
          "es": "No le interesa"
        },
        "hint": {
          "en": "A clear no. The door leaves the list.",
          "es": "Un no claro. La puerta sale de la lista."
        }
      },
      {
        "id": "come_back",
        "key": "B",
        "label": {
          "en": "Come back later",
          "es": "Regresar más tarde"
        },
        "hint": {
          "en": "They asked for another time.",
          "es": "Pidieron otra hora."
        }
      }
    ],
    "flags": {
      "noSoliciting": {
        "en": "No soliciting sign",
        "es": "Letrero de no vendedores"
      },
      "dontReturn": {
        "en": "Asked us not to come back",
        "es": "Pidió que no volvamos"
      }
    },
    "card": {
      "built": {
        "en": "Built {y}",
        "es": "Construida en {y}"
      },
      "roofAge": {
        "en": "Roof age",
        "es": "Edad del techo"
      },
      "roofAgeValue": {
        "en": "{n} yrs (estimate)",
        "es": "{n} años (estimado)"
      },
      "hail": {
        "en": "Hail at this door",
        "es": "Granizo en esta puerta"
      },
      "hailValue": {
        "en": "{x} in, radar estimate",
        "es": "{x} pulg., estimado del radar"
      },
      "hailNote": {
        "en": "Not confirmed at this address.",
        "es": "No confirmado en esta dirección."
      },
      "owner": {
        "en": "Owner lives here (sample)",
        "es": "El dueño vive aquí (muestra)"
      },
      "ownerYes": {
        "en": "Yes",
        "es": "Sí"
      },
      "ownerNo": {
        "en": "No",
        "es": "No"
      },
      "score": {
        "en": "Door score",
        "es": "Puntaje de la puerta"
      },
      "scoreValue": {
        "en": "{n} of 100",
        "es": "{n} de 100"
      },
      "sample": {
        "en": "Sample home",
        "es": "Casa de muestra"
      },
      "sampleNote": {
        "en": "Made-up address. No owner name.",
        "es": "Dirección inventada. Sin nombre del dueño."
      }
    },
    "legal": {
      "cite": "Neb. Rev. Stat. 69-1602",
      "check": {
        "en": "Said first: my name, HMP Siding & Roofing and what we sell (69-1602)",
        "es": "Dicho primero: mi nombre, HMP Siding & Roofing y lo que vendemos (69-1602)"
      },
      "sells": {
        "en": "roofing, siding, gutters",
        "es": "techos, siding, canaletas"
      },
      "why": {
        "en": "Nebraska asks for it at the start of a home sale.",
        "es": "Nebraska lo pide al empezar una venta a domicilio."
      }
    },
    "recap": {
      "title": {
        "en": "Walk recap",
        "es": "Resumen de la ruta"
      },
      "summary": {
        "en": "You knocked {n}, talked with {t} and set {i}.",
        "es": "Tocaste {n}, hablaste con {t} y agendaste {i}."
      },
      "units": {
        "doors": {
          "en": "{n} doors",
          "es": "{n} puertas",
          "one": {
            "en": "1 door",
            "es": "1 puerta"
          }
        },
        "people": {
          "en": "{n} people",
          "es": "{n} personas",
          "one": {
            "en": "1 person",
            "es": "1 persona"
          }
        },
        "inspections": {
          "en": "{n} inspections",
          "es": "{n} inspecciones",
          "one": {
            "en": "1 inspection",
            "es": "1 inspección"
          }
        }
      },
      "knocked": {
        "en": "{n} doors knocked",
        "es": "{n} puertas tocadas",
        "one": {
          "en": "1 door knocked",
          "es": "1 puerta tocada"
        }
      },
      "answered": {
        "en": "{n} answered",
        "es": "{n} abrieron",
        "one": {
          "en": "1 answered",
          "es": "1 abrió"
        }
      },
      "noAnswer": {
        "en": "{n} did not answer",
        "es": "{n} no abrieron",
        "one": {
          "en": "1 did not answer",
          "es": "1 no abrió"
        }
      },
      "talked": {
        "en": "{n} conversations",
        "es": "{n} conversaciones",
        "one": {
          "en": "1 conversation",
          "es": "1 conversación"
        }
      },
      "inspections": {
        "en": "{n} inspections set",
        "es": "{n} inspecciones agendadas",
        "one": {
          "en": "1 inspection set",
          "es": "1 inspección agendada"
        }
      },
      "back": {
        "en": "{n} to come back to",
        "es": "{n} para regresar",
        "one": {
          "en": "1 to come back to",
          "es": "1 para regresar"
        }
      },
      "notInterested": {
        "en": "{n} said no",
        "es": "{n} dijeron que no",
        "one": {
          "en": "1 said no",
          "es": "1 dijo que no"
        }
      },
      "pace": {
        "en": "{n} doors an hour",
        "es": "{n} puertas por hora",
        "one": {
          "en": "1 door an hour",
          "es": "1 puerta por hora"
        }
      },
      "time": {
        "en": "{n} min on the walk",
        "es": "{n} min de ruta"
      },
      "rate": {
        "en": "{p}% of answered doors set an inspection ({i} of {a})",
        "es": "El {p}% de las puertas que abrieron agendó una inspección ({i} de {a})"
      },
      "followups": {
        "en": "{n} doors are waiting for a follow-up",
        "es": "{n} puertas esperan seguimiento",
        "one": {
          "en": "1 door is waiting for a follow-up",
          "es": "1 puerta espera seguimiento"
        }
      },
      "sampleNote": {
        "en": "Sample homes, sample results.",
        "es": "Casas de muestra, resultados de muestra."
      }
    }
  },
  "now": {
    "title": {
      "en": "Now",
      "es": "Ahora"
    },
    "brief": {
      "en": "7 AM brief",
      "es": "Resumen de las 7 a. m."
    },
    "pick": {
      "label": {
        "en": "Aldaba's pick",
        "es": "La elección de Aldaba"
      },
      "why": {
        "en": "Why this zone",
        "es": "Por qué esta zona"
      },
      "bestTime": {
        "en": "Best time",
        "es": "Mejor hora"
      },
      "bestTimeRange": {
        "en": "{start} to {end}",
        "es": "de {start} a {end}"
      },
      "drive": {
        "en": "Drive",
        "es": "Trayecto"
      },
      "driveValue": {
        "en": "{mi} mi, about {min} min",
        "es": "{mi} mi, unos {min} min"
      },
      "doors": {
        "en": "{n} doors",
        "es": "{n} puertas"
      },
      "score": {
        "en": "Score {n}",
        "es": "Puntaje {n}"
      },
      "hail": {
        "en": "{x}-inch hail on {date}",
        "es": "Granizo de {x} pulgadas el {date}"
      },
      "hailNote": {
        "en": "Radar estimate",
        "es": "Estimado del radar"
      },
      "startAt": {
        "en": "Start at {address}",
        "es": "Empieza en {address}"
      }
    },
    "overnight": {
      "label": {
        "en": "Overnight",
        "es": "Durante la noche"
      },
      "none": {
        "en": "No new hail overnight.",
        "es": "Sin granizo nuevo durante la noche."
      },
      "some": {
        "en": "{n} new hail reports overnight.",
        "es": "{n} reportes nuevos de granizo durante la noche."
      }
    },
    "plan": {
      "title": {
        "en": "Today's plan",
        "es": "El plan de hoy"
      },
      "steps": [
        {
          "id": "brief",
          "title": {
            "en": "Brief ready",
            "es": "Resumen listo"
          },
          "detail": {
            "en": "Storms, zones and the pick are up to date.",
            "es": "Tormentas, zonas y la elección del día, al día."
          }
        },
        {
          "id": "followups",
          "title": {
            "en": "Follow-ups",
            "es": "Seguimientos"
          },
          "detail": {
            "en": "{n} doors asked you to come back.",
            "es": "{n} puertas pidieron que regreses."
          }
        },
        {
          "id": "prep",
          "title": {
            "en": "Prep door cards and cancel forms",
            "es": "Prepara tarjetas de puerta y formularios de cancelación"
          },
          "detail": {
            "en": "Ready to print, English and Spanish.",
            "es": "Listos para imprimir, en inglés y español."
          }
        },
        {
          "id": "drive",
          "title": {
            "en": "Drive to {zone}",
            "es": "Maneja a {zone}"
          },
          "detail": {
            "en": "{mi} mi, about {min} min.",
            "es": "{mi} mi, unos {min} min."
          }
        },
        {
          "id": "knock",
          "title": {
            "en": "Knock {n} doors",
            "es": "Toca {n} puertas"
          },
          "detail": {
            "en": "Best window: {start} to {end}.",
            "es": "Mejor horario: de {start} a {end}."
          }
        }
      ]
    },
    "zones": {
      "header": {
        "en": "Zones, best first",
        "es": "Zonas, las mejores primero"
      },
      "rank": {
        "en": "#{n}",
        "es": "N.º {n}"
      },
      "storm": {
        "en": "Storm zone",
        "es": "Zona de tormenta"
      },
      "everyday": {
        "en": "Everyday zone: older homes, no recent storm",
        "es": "Zona de todos los días: casas viejas, sin tormenta reciente"
      },
      "homes": {
        "en": "{n} homes",
        "es": "{n} casas"
      }
    },
    "backup": {
      "label": {
        "en": "Backup zone",
        "es": "Zona de respaldo"
      },
      "note": {
        "en": "Next best if the pick does not work out.",
        "es": "La siguiente mejor si la elección no funciona."
      }
    },
    "likelyInsured": {
      "label": {
        "en": "Likely insured",
        "es": "Probablemente asegurado"
      },
      "tag": {
        "en": "area estimate",
        "es": "estimado del área"
      },
      "explain": {
        "en": "An estimate for the whole area, built from US Census numbers (ACS 2024): how many homes are owner-occupied and residential, and how recently people moved in. It is never a fact about one home, and it says nothing about any policy.",
        "es": "Un estimado para toda el área, hecho con números del Censo de EE. UU. (ACS 2024): cuántas casas son residenciales y las habitan sus dueños, y qué tan recientemente se mudó la gente. Nunca es un dato de una casa, y no dice nada de ninguna póliza."
      }
    },
    "actions": {
      "startWalk": {
        "en": "Start the walk",
        "es": "Empezar la ruta"
      },
      "openMap": {
        "en": "Open on the map",
        "es": "Abrir en el mapa"
      }
    }
  },
  "storms": {
    "title": {
      "en": "Storms",
      "es": "Tormentas"
    },
    "timeline": {
      "label": {
        "en": "Storm timeline",
        "es": "Línea de tiempo de tormentas"
      },
      "play": {
        "en": "Play",
        "es": "Reproducir"
      },
      "pause": {
        "en": "Pause",
        "es": "Pausa"
      },
      "restart": {
        "en": "Restart",
        "es": "Reiniciar"
      },
      "scrub": {
        "en": "Drag to a storm day",
        "es": "Arrastra a un día de tormenta"
      },
      "today": {
        "en": "Today",
        "es": "Hoy"
      },
      "daysAgo": {
        "en": "{n} days ago",
        "es": "hace {n} días"
      },
      "season": {
        "en": "2026 season",
        "es": "Temporada 2026"
      }
    },
    "day": {
      "maxHail": {
        "en": "Max hail",
        "es": "Granizo máximo"
      },
      "reportMax": {
        "en": "Largest reported",
        "es": "Mayor reportado"
      },
      "radarMax": {
        "en": "Largest on radar (estimate)",
        "es": "Mayor en el radar (estimado)"
      },
      "size": {
        "en": "{x} in",
        "es": "{x} pulg."
      },
      "cells": {
        "en": "Radar cells",
        "es": "Celdas de radar"
      },
      "towns": {
        "en": "Towns",
        "es": "Pueblos"
      },
      "zones": {
        "en": "Zones touched",
        "es": "Zonas alcanzadas"
      },
      "reports": {
        "en": "Reports",
        "es": "Reportes"
      },
      "window": {
        "en": "First to last report",
        "es": "Del primer al último reporte"
      },
      "quiet": {
        "en": "Quiet day. No hail reports.",
        "es": "Día tranquilo. Sin reportes de granizo."
      }
    },
    "knockThis": {
      "en": "Knock this storm",
      "es": "Tocar puertas de esta tormenta"
    },
    "radarNote": {
      "en": "The radar sweep is decorative. Hail sizes come from NOAA and NWS reports and MRMS radar.",
      "es": "El barrido del radar es solo decoración. Los tamaños del granizo vienen de reportes de NOAA y NWS y del radar MRMS."
    },
    "sourcesLine": {
      "en": "Hail sizes: NOAA SPC and NWS local storm reports, NOAA NCEI Storm Events, MRMS radar estimates.",
      "es": "Tamaños de granizo: reportes de NOAA SPC y del NWS, NOAA NCEI Storm Events y estimados del radar MRMS."
    },
    "sizesTitle": {
      "en": "Hail size, in everyday things",
      "es": "Tamaño del granizo, en cosas de todos los días"
    },
    "sizes": [
      {
        "in": 0.75,
        "name": {
          "en": "penny",
          "es": "moneda de un centavo"
        }
      },
      {
        "in": 1.0,
        "name": {
          "en": "quarter",
          "es": "moneda de veinticinco centavos"
        }
      },
      {
        "in": 1.25,
        "name": {
          "en": "half dollar",
          "es": "moneda de cincuenta centavos"
        }
      },
      {
        "in": 1.5,
        "name": {
          "en": "ping pong ball",
          "es": "pelota de ping pong"
        }
      },
      {
        "in": 1.75,
        "name": {
          "en": "golf ball",
          "es": "pelota de golf"
        }
      },
      {
        "in": 2.0,
        "name": {
          "en": "hen egg",
          "es": "huevo de gallina"
        }
      },
      {
        "in": 2.5,
        "name": {
          "en": "tennis ball",
          "es": "pelota de tenis"
        }
      },
      {
        "in": 2.75,
        "name": {
          "en": "baseball",
          "es": "pelota de béisbol"
        }
      }
    ]
  },
  "money": {
    "title": {
      "en": "The path to $100,000",
      "es": "El camino a $100,000"
    },
    "goal": {
      "label": {
        "en": "FilthE's goal",
        "es": "La meta de FilthE"
      },
      "amount": {
        "en": "$100,000",
        "es": "$100,000"
      },
      "date": {
        "en": "December 31, 2026",
        "es": "31 de diciembre de 2026"
      },
      "line": {
        "en": "FilthE's goal: $100,000 in commission by December 31, 2026.",
        "es": "La meta de FilthE: $100,000 en comisiones para el 31 de diciembre de 2026."
      }
    },
    "funnel": {
      "title": {
        "en": "Work backward from the goal",
        "es": "De la meta hacia atrás"
      },
      "case": {
        "low": {
          "en": "Low",
          "es": "Bajo"
        },
        "typical": {
          "en": "Typical",
          "es": "Típico"
        },
        "high": {
          "en": "High",
          "es": "Alto"
        }
      },
      "stages": [
        {
          "id": "goal",
          "label": {
            "en": "Goal",
            "es": "Meta"
          },
          "rate": {
            "en": "{amount} in commission by {date}",
            "es": "{amount} en comisiones para el {date}"
          }
        },
        {
          "id": "jobs",
          "label": {
            "en": "Signed jobs",
            "es": "Trabajos firmados"
          },
          "rate": {
            "en": "{n} jobs at {c} each",
            "es": "{n} trabajos a {c} cada uno"
          }
        },
        {
          "id": "inspections",
          "label": {
            "en": "Inspections",
            "es": "Inspecciones"
          },
          "rate": {
            "en": "{p}% of inspections become signed jobs",
            "es": "{p}% de las inspecciones terminan en trabajo firmado"
          }
        },
        {
          "id": "appointments",
          "label": {
            "en": "Booked appointments",
            "es": "Citas agendadas"
          },
          "rate": {
            "en": "{p}% of booked appointments happen",
            "es": "{p}% de las citas agendadas se cumplen"
          }
        },
        {
          "id": "doors",
          "label": {
            "en": "Doors knocked",
            "es": "Puertas tocadas"
          },
          "rate": {
            "en": "{p}% of doors end in a booked inspection",
            "es": "{p}% de las puertas terminan en una inspección agendada"
          }
        },
        {
          "id": "conversations",
          "label": {
            "en": "Conversations",
            "es": "Conversaciones"
          },
          "rate": {
            "en": "{p}% of doors open and talk",
            "es": "{p}% de las puertas abren y conversan"
          }
        },
        {
          "id": "hours",
          "label": {
            "en": "Hours at the door",
            "es": "Horas en la puerta"
          },
          "rate": {
            "en": "{n} doors an hour",
            "es": "{n} puertas por hora"
          }
        }
      ]
    },
    "commission": {
      "label": {
        "en": "Example commission per job, set by HMP",
        "es": "Comisión de ejemplo por trabajo, la fija HMP"
      },
      "value": {
        "en": "{c} per job",
        "es": "{c} por trabajo"
      },
      "note": {
        "en": "Sample figure. HMP sets the real rate.",
        "es": "Cifra de muestra. HMP fija la tarifa real."
      },
      "adjust": {
        "en": "Try another example",
        "es": "Prueba otro ejemplo"
      }
    },
    "industry": {
      "avgClaim": {
        "label": {
          "en": "Average wind and hail roof claim",
          "es": "Reclamo promedio de techo por viento y granizo"
        },
        "note": {
          "en": "Industry figure. Each claim is different, and the insurance company decides it.",
          "es": "Cifra de la industria. Cada reclamo es distinto y lo decide la aseguradora."
        }
      },
      "avgSiding": {
        "label": {
          "en": "Average full-house siding job",
          "es": "Trabajo promedio de siding en toda la casa"
        },
        "note": {
          "en": "Industry figure for a cash sale.",
          "es": "Cifra de la industria para una venta de contado."
        }
      }
    },
    "week": {
      "title": {
        "en": "What it takes this week",
        "es": "Lo que hace falta esta semana"
      },
      "weeksLeft": {
        "en": "{n} weeks left until December 31, 2026",
        "es": "Faltan {n} semanas para el 31 de diciembre de 2026"
      },
      "jobsNeeded": {
        "en": "{n} signed jobs still to go",
        "es": "Faltan {n} trabajos firmados"
      },
      "jobs": {
        "en": "About {n} signed jobs a week",
        "es": "Unos {n} trabajos firmados por semana"
      },
      "inspections": {
        "en": "About {n} inspections a week",
        "es": "Unas {n} inspecciones por semana"
      },
      "doors": {
        "en": "{n} doors knocked",
        "es": "{n} puertas tocadas"
      },
      "conversations": {
        "en": "About {n} conversations",
        "es": "Unas {n} conversaciones"
      },
      "hours": {
        "en": "About {n} hours at the door",
        "es": "Unas {n} horas en la puerta"
      },
      "perDay": {
        "en": "That is {n} doors a day, {d} days a week",
        "es": "Son {n} puertas al día, {d} días a la semana"
      }
    },
    "bench": {
      "tag": {
        "en": "Industry benchmark",
        "es": "Cifra de la industria"
      },
      "note": {
        "en": "Industry benchmarks from vendor figures. They are not HMP's results.",
        "es": "Cifras de la industria tomadas de proveedores. No son resultados de HMP."
      },
      "replaced": {
        "en": "HMP's own numbers replace them after about 200 doors.",
        "es": "Los números propios de HMP las reemplazan después de unas 200 puertas."
      },
      "noPromise": {
        "en": "A plan, not a promise. Nothing here predicts what any week will bring.",
        "es": "Es un plan, no una promesa. Nada aquí predice lo que traerá cualquier semana."
      }
    }
  },
  "film": {
    "title": {
      "en": "The film",
      "es": "La película"
    },
    "length": {
      "en": "About 75 seconds. The app plays itself.",
      "es": "Unos 75 segundos. La app se muestra sola."
    },
    "controls": {
      "beat": {
        "en": "Beat {i} of {n}",
        "es": "Escena {i} de {n}"
      },
      "skipHint": {
        "en": "Press Esc or Skip to leave the film.",
        "es": "Pulsa Esc o Saltar para salir de la película."
      },
      "endCard": {
        "en": "Now try it yourself",
        "es": "Ahora pruébala tú"
      }
    },
    "beats": [
      {
        "id": "cold-open",
        "caption": {
          "en": "August 8, 2026. Hail falls on Columbus, Nebraska.",
          "es": "8 de agosto de 2026. Cae granizo sobre Columbus, Nebraska."
        },
        "kicker": {
          "en": "Real reports. Real radar.",
          "es": "Reportes reales. Radar real."
        }
      },
      {
        "id": "brief",
        "caption": {
          "en": "It is 7 AM. Aldaba has already read the storm.",
          "es": "Son las 7 a. m. Aldaba ya leyó la tormenta."
        }
      },
      {
        "id": "why-columbus",
        "caption": {
          "en": "Columbus. 1.6-inch hail, older roofs, homes where owners live.",
          "es": "Columbus. Granizo de 1.6 pulgadas, techos viejos, casas donde viven sus dueños."
        },
        "kicker": {
          "en": "1.6 inches is a radar estimate.",
          "es": "1.6 pulgadas es un estimado del radar."
        }
      },
      {
        "id": "zones",
        "caption": {
          "en": "The zones light up, best first.",
          "es": "Las zonas se encienden, las mejores primero."
        }
      },
      {
        "id": "replay",
        "caption": {
          "en": "Replay the season. Watch every storm land.",
          "es": "Revive la temporada. Mira cómo cae cada tormenta."
        }
      },
      {
        "id": "drive",
        "caption": {
          "en": "One tap starts the drive to Columbus.",
          "es": "Un toque inicia el trayecto a Columbus."
        }
      },
      {
        "id": "walk",
        "caption": {
          "en": "The walk begins. Every door, in order.",
          "es": "Empieza la ruta. Cada puerta, en orden."
        }
      },
      {
        "id": "one-tap",
        "caption": {
          "en": "One tap per door. The app keeps the record.",
          "es": "Un toque por puerta. La app lleva el registro."
        }
      },
      {
        "id": "legal",
        "caption": {
          "en": "Nebraska law rides along on every step.",
          "es": "La ley de Nebraska va contigo en cada paso."
        },
        "kicker": {
          "en": "We document the damage. The insurance company decides the claim.",
          "es": "Documentamos el daño. La aseguradora decide el reclamo."
        }
      },
      {
        "id": "homeowner-sheet",
        "caption": {
          "en": "The homeowner gets one clear page, in English and Spanish.",
          "es": "El dueño recibe una hoja clara, en inglés y español."
        }
      },
      {
        "id": "path",
        "caption": {
          "en": "Work backward from $100,000. Count the doors it takes.",
          "es": "Parte de los $100,000 hacia atrás. Cuenta las puertas que hacen falta."
        },
        "kicker": {
          "en": "Industry benchmarks for now. HMP's own numbers later.",
          "es": "Cifras de la industria por ahora. Las de HMP después."
        }
      },
      {
        "id": "sign-off",
        "caption": {
          "en": "Made by Claude, for HMP Siding & Roofing in Fremont.",
          "es": "Hecho por Claude para HMP Siding & Roofing, en Fremont."
        }
      }
    ]
  },
  "colophon": {
    "title": {
      "en": "Made by Claude",
      "es": "Hecho por Claude"
    },
    "intro": {
      "en": "This is my version of Aldaba for HMP Siding & Roofing. Here is what is real, what is sample, and how it was made.",
      "es": "Esta es mi versión de Aldaba para HMP Siding & Roofing. Aquí está lo que es real, lo que es de muestra y cómo se hizo."
    },
    "asOf": {
      "en": "Storm data as of {date}",
      "es": "Datos de tormentas al {date}"
    },
    "real": {
      "title": {
        "en": "What is real",
        "es": "Lo que es real"
      },
      "items": [
        {
          "name": {
            "en": "Hail reports",
            "es": "Reportes de granizo"
          },
          "source": {
            "en": "NOAA Storm Prediction Center, NWS local storm reports, NOAA NCEI Storm Events",
            "es": "NOAA Storm Prediction Center, reportes locales del NWS, NOAA NCEI Storm Events"
          }
        },
        {
          "name": {
            "en": "Radar hail sizes",
            "es": "Tamaños de granizo del radar"
          },
          "source": {
            "en": "NOAA MRMS radar, an estimate that can run high",
            "es": "Radar MRMS de NOAA, un estimado que puede salir alto"
          }
        },
        {
          "name": {
            "en": "Streets, rivers and town lines",
            "es": "Calles, ríos y límites de pueblos"
          },
          "source": {
            "en": "Nebraska GIS, USGS hydrography, US Census TIGER",
            "es": "GIS de Nebraska, hidrografía de USGS, TIGER del Censo de EE. UU."
          }
        },
        {
          "name": {
            "en": "Area numbers",
            "es": "Números del área"
          },
          "source": {
            "en": "US Census ACS 2024, the base for the likely insured area estimate",
            "es": "ACS 2024 del Censo de EE. UU., la base del estimado de probablemente asegurado por área"
          }
        },
        {
          "name": {
            "en": "Nebraska statutes",
            "es": "Estatutos de Nebraska"
          },
          "source": {
            "en": "Plain-language notes on the statutes HMP works under. A Nebraska attorney should review the printed forms.",
            "es": "Notas en lenguaje sencillo de los estatutos bajo los que trabaja HMP. Un abogado de Nebraska debe revisar los formularios impresos."
          }
        }
      ]
    },
    "sample": {
      "title": {
        "en": "What is sample",
        "es": "Lo que es de muestra"
      },
      "items": [
        {
          "name": {
            "en": "Homes",
            "es": "Casas"
          },
          "detail": {
            "en": "Every home is made up: fake address, no owner name. Roof ages, owner-lived flags and door scores are sample too.",
            "es": "Cada casa es inventada: dirección falsa, sin nombre del dueño. Las edades de techo, las marcas de dueño en la casa y los puntajes de puerta también son de muestra."
          }
        },
        {
          "name": {
            "en": "Commission example",
            "es": "Ejemplo de comisión"
          },
          "detail": {
            "en": "A stand-in number. HMP sets the real rate.",
            "es": "Un número de relleno. HMP fija la tarifa real."
          }
        },
        {
          "name": {
            "en": "Funnel rates",
            "es": "Tasas del embudo"
          },
          "detail": {
            "en": "Industry benchmarks from vendor figures, until HMP has about 200 doors of its own.",
            "es": "Cifras de la industria tomadas de proveedores, hasta que HMP tenga unas 200 puertas propias."
          }
        },
        {
          "name": {
            "en": "Radar sweep",
            "es": "Barrido del radar"
          },
          "detail": {
            "en": "Decoration only. It carries no data.",
            "es": "Solo decoración. No lleva datos."
          }
        }
      ]
    },
    "built": {
      "title": {
        "en": "How it was built",
        "es": "Cómo se hizo"
      },
      "items": [
        {
          "en": "Raw WebGL and Canvas2D. No frameworks.",
          "es": "WebGL y Canvas2D directos. Sin frameworks."
        },
        {
          "en": "One continuous map world. Storms, zones and streets share the same map.",
          "es": "Un solo mundo de mapa continuo. Tormentas, zonas y calles comparten el mismo mapa."
        },
        {
          "en": "One motion system. Every screen and the film share the same timing and easing.",
          "es": "Un solo sistema de movimiento. Todas las pantallas y la película comparten el mismo ritmo y las mismas curvas."
        }
      ]
    },
    "thesis": {
      "title": {
        "en": "Why one ring",
        "es": "Por qué un solo anillo"
      },
      "body": {
        "en": "I built this around one shape. An aldaba is a door knocker, and the ring in the Aldaba mark comes from that knocker. I kept the ring and let it mean more as you move through the app. It is the hail stone that lands on the map. It is the ripple that spreads where the stone hits. It is the ring drawn around a zone. It is the marker sitting on a door. It is the progress ring that fills as you knock. One motif, many meanings, so the whole app reads as one thing you can learn in a minute. I wanted a storm, a street and a door to look like the same thing seen at three sizes.",
        "es": "Construí todo esto alrededor de una sola forma. Una aldaba es la argolla con la que se toca a una puerta, y el anillo de la marca Aldaba viene de ahí. Conservé el anillo y dejé que significara más a medida que avanzas por la app. Es la piedra de granizo que cae en el mapa. Es la onda que se abre donde pega. Es el anillo dibujado alrededor de una zona. Es la marca puesta sobre una puerta. Es el anillo de progreso que se llena con cada toque. Un solo motivo, muchos significados, para que toda la app se lea como una sola cosa que se aprende en un minuto. Quise que una tormenta, una calle y una puerta se vieran como lo mismo visto en tres tamaños."
      },
      "signature": {
        "en": "Claude",
        "es": "Claude"
      }
    },
    "meanings": {
      "title": {
        "en": "The ring, five ways",
        "es": "El anillo, de cinco maneras"
      },
      "items": [
        {
          "id": "stone",
          "name": {
            "en": "Hail stone",
            "es": "Piedra de granizo"
          }
        },
        {
          "id": "ripple",
          "name": {
            "en": "Impact ripple",
            "es": "Onda de impacto"
          }
        },
        {
          "id": "zone",
          "name": {
            "en": "Zone ring",
            "es": "Anillo de zona"
          }
        },
        {
          "id": "door",
          "name": {
            "en": "Door marker",
            "es": "Marca de puerta"
          }
        },
        {
          "id": "progress",
          "name": {
            "en": "Progress ring",
            "es": "Anillo de progreso"
          }
        }
      ]
    }
  },
  "ui": {
    "brand": {
      "name": {
        "en": "Claude's Aldaba",
        "es": "Aldaba de Claude"
      },
      "tagline": {
        "en": "Where the hail fell. Which door to knock. What the law asks.",
        "es": "Dónde cayó el granizo. A qué puerta tocar. Qué pide la ley."
      },
      "forHmp": {
        "en": "For HMP Siding & Roofing, Fremont, Nebraska",
        "es": "Para HMP Siding & Roofing, Fremont, Nebraska"
      }
    },
    "tabs": {
      "now": {
        "en": "Now",
        "es": "Ahora"
      },
      "storms": {
        "en": "Storms",
        "es": "Tormentas"
      },
      "knock": {
        "en": "Knock",
        "es": "Puertas"
      },
      "deal": {
        "en": "Deal",
        "es": "Venta"
      },
      "money": {
        "en": "Money",
        "es": "Dinero"
      }
    },
    "topbar": {
      "cut": {
        "en": "Claude's cut",
        "es": "Versión de Claude"
      },
      "sample": {
        "en": "Sample homes · real storms",
        "es": "Casas de muestra · tormentas reales"
      },
      "play": {
        "en": "Play the film",
        "es": "Ver la película"
      },
      "skip": {
        "en": "Skip",
        "es": "Saltar"
      },
      "pause": {
        "en": "Pause",
        "es": "Pausa"
      },
      "resume": {
        "en": "Resume",
        "es": "Seguir"
      },
      "replay": {
        "en": "Replay",
        "es": "Repetir"
      },
      "close": {
        "en": "Close",
        "es": "Cerrar"
      },
      "madeBy": {
        "en": "Made by Claude",
        "es": "Hecho por Claude"
      }
    },
    "theme": {
      "label": {
        "en": "Theme",
        "es": "Tema"
      },
      "dark": {
        "en": "Dark",
        "es": "Oscuro"
      },
      "light": {
        "en": "Light",
        "es": "Claro"
      },
      "toDark": {
        "en": "Switch to dark",
        "es": "Cambiar a oscuro"
      },
      "toLight": {
        "en": "Switch to light",
        "es": "Cambiar a claro"
      }
    },
    "lang": {
      "label": {
        "en": "Language",
        "es": "Idioma"
      },
      "switchTo": {
        "en": "Español",
        "es": "English"
      },
      "switchHint": {
        "en": "Switch to Spanish",
        "es": "Cambiar a inglés"
      }
    },
    "tags": {
      "real": {
        "en": "Real public data",
        "es": "Datos públicos reales"
      },
      "sample": {
        "en": "Sample",
        "es": "Muestra"
      },
      "estimate": {
        "en": "Estimate",
        "es": "Estimado"
      },
      "benchmark": {
        "en": "Industry benchmark",
        "es": "Cifra de la industria"
      },
      "rule": {
        "en": "Public rule",
        "es": "Regla pública"
      }
    },
    "common": {
      "back": {
        "en": "Back",
        "es": "Atrás"
      },
      "next": {
        "en": "Next",
        "es": "Siguiente"
      },
      "undo": {
        "en": "Undo",
        "es": "Deshacer"
      },
      "print": {
        "en": "Print",
        "es": "Imprimir"
      },
      "open": {
        "en": "Open",
        "es": "Abrir"
      },
      "step": {
        "en": "Step {i} of {n}",
        "es": "Paso {i} de {n}"
      },
      "of": {
        "en": "{i} of {n}",
        "es": "{i} de {n}"
      },
      "asOf": {
        "en": "Data as of {date}",
        "es": "Datos al {date}"
      }
    },
    "toast": {
      "logged": {
        "en": "Logged: {outcome}",
        "es": "Anotado: {outcome}"
      },
      "undone": {
        "en": "Undone",
        "es": "Deshecho"
      },
      "walkDone": {
        "en": "Walk finished. Your recap is ready.",
        "es": "Ruta terminada. Tu resumen está listo."
      },
      "zone": {
        "en": "Zone set: {name}",
        "es": "Zona elegida: {name}"
      },
      "storm": {
        "en": "Showing {date}",
        "es": "Mostrando {date}"
      },
      "sampleHome": {
        "en": "Sample home. Nothing here is saved.",
        "es": "Casa de muestra. Aquí no se guarda nada."
      },
      "themeDark": {
        "en": "Dark theme",
        "es": "Tema oscuro"
      },
      "themeLight": {
        "en": "Light theme",
        "es": "Tema claro"
      },
      "langEn": {
        "en": "English",
        "es": "English"
      },
      "langEs": {
        "en": "Español",
        "es": "Español"
      },
      "filmStart": {
        "en": "The film starts",
        "es": "Empieza la película"
      },
      "filmEnd": {
        "en": "That was the film. The app is yours.",
        "es": "Eso fue la película. La app es tuya."
      },
      "sheetReady": {
        "en": "Homeowner sheet ready to print",
        "es": "Hoja del dueño lista para imprimir"
      }
    }
  }
};
