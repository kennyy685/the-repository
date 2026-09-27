"""HTML for the three landing heroes and the compare page (content EN + ES)."""
import html as H
from marks import BRANDS, INK, lockup_svg, icon_svg, mark_inner

# ---------------------------------------------------------------- the accent swap: Ledger (ds.css) tokens per brand
# Put class="brand-<name>" on <html>, load after ds.css. Aldaba keeps Ledger's orange, so it has no block.
TOKENS_CSS = """
html.brand-paso{--hmp:#ffc21a;--hmp-press:#f0ad00;--hmp-ink:#6b4f00;--hmp-bg:#fff3c4;--on-hmp:#18191c;--warn:#a4520f;--warn-bg:#fdf1e7;--heat:240,166,0}
html.brand-ronda{--hmp:#c8288f;--hmp-press:#ad1f7a;--hmp-ink:#a11c74;--hmp-bg:#fbe9f4;--on-hmp:#ffffff;--heat:200,40,143}
@media (prefers-color-scheme:dark){
html.brand-paso:not([data-theme="light"]){--hmp-ink:#ffd45c;--hmp-bg:rgba(255,194,26,.14);--warn:#ffa766;--warn-bg:rgba(245,136,58,.14)}
html.brand-ronda:not([data-theme="light"]){--hmp:#d23a9c;--hmp-press:#b82a85;--hmp-ink:#ff8ad0;--hmp-bg:rgba(210,58,156,.18)}}
html.brand-paso[data-theme="dark"]{--hmp-ink:#ffd45c;--hmp-bg:rgba(255,194,26,.14);--warn:#ffa766;--warn-bg:rgba(245,136,58,.14)}
html.brand-ronda[data-theme="dark"]{--hmp:#d23a9c;--hmp-press:#b82a85;--hmp-ink:#ff8ad0;--hmp-bg:rgba(210,58,156,.18)}
"""

GOOGLE = ("https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900"
          "&family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Geist:wght@400;500;600"
          "&family=Geist+Mono:wght@500&family=Unbounded:wght@200..900&display=swap")


def font_faces(prefix):
    """Local copies under a second family name, so the page works offline and when Google Fonts is blocked."""
    p = prefix
    return f"""
@font-face{{font-family:"Geist L";src:url({p}Geist-400.woff2) format("woff2");font-weight:400;font-display:swap}}
@font-face{{font-family:"Geist L";src:url({p}Geist-500.woff2) format("woff2");font-weight:500;font-display:swap}}
@font-face{{font-family:"Geist L";src:url({p}Geist-600.woff2) format("woff2");font-weight:600;font-display:swap}}
@font-face{{font-family:"Geist Mono L";src:url({p}GeistMono-500.woff2) format("woff2");font-weight:500;font-display:swap}}
@font-face{{font-family:"Bricolage L";src:url({p}BricolageGrotesque-var.woff2) format("woff2");font-weight:200 800;font-display:swap}}
@font-face{{font-family:"Archivo L";src:url({p}Archivo-var.woff2) format("woff2");font-weight:100 900;font-stretch:62% 125%;font-display:swap}}
@font-face{{font-family:"Unbounded L";src:url({p}Unbounded-var.woff2) format("woff2");font-weight:200 900;font-display:swap}}
"""


FACES = {
    "aldaba": ('"Bricolage Grotesque","Bricolage L",system-ui,sans-serif', "font-weight:700;font-variation-settings:'opsz' 96"),
    "paso": ('"Archivo","Archivo L",system-ui,sans-serif', "font-weight:800;font-stretch:125%"),
    "ronda": ('"Unbounded","Unbounded L",system-ui,sans-serif', "font-weight:600"),
}
FACE_NAMES = {"aldaba": "Bricolage Grotesque 700", "paso": "Archivo Expanded 800", "ronda": "Unbounded 600"}

# icons from the v25 set (24 grid, 1.75 stroke)
ICON = {
    "hail": '<path d="M7.2 15.2a4 4 0 0 1-.5-8 5.4 5.4 0 0 1 10.4 1 3.5 3.5 0 0 1 .2 7z"/><path d="M8.5 18.6h.01M12 20.3h.01M15.5 18.6h.01" stroke-width="2.6"/>',
    "say": '<path d="M4 6.2c0-1 .8-1.7 1.7-1.7h12.6c1 0 1.7.8 1.7 1.7v8.6c0 1-.8 1.7-1.7 1.7H9.5L5 20v-3.5c-.6-.2-1-.8-1-1.5z"/><path d="M8 9h8M8 12.3h5"/>',
    "shield": '<path d="M12 3.5 5.5 6v5.3c0 4.3 2.8 7.6 6.5 9.2 3.7-1.6 6.5-4.9 6.5-9.2V6z"/><path d="m9.2 12.2 2 2 3.8-3.9"/>',
    "x": '<path d="M6 6l12 12M18 6 6 18"/>',
    "open": '<path d="M14 4.5h5.5V10M19.5 4.5 11 13"/><path d="M18 14v4.5c0 .8-.7 1.5-1.5 1.5h-11c-.8 0-1.5-.7-1.5-1.5v-11C4 6.7 4.7 6 5.5 6H10"/>',
    "expand": '<path d="M4.5 9.5v-5h5M19.5 14.5v5h-5M4.5 4.5l6 6M19.5 19.5l-6-6"/>',
}


def ic(name, cls="i"):
    return f'<svg class="{cls}" viewBox="0 0 24 24" aria-hidden="true">{ICON[name]}</svg>'


def t(en, es, tag="span", cls=""):
    c = f" {cls}" if cls else ""
    return f'<{tag} class="en{c}">{en}</{tag}><{tag} class="es{c}" lang="es">{es}</{tag}>'


# ---------------------------------------------------------------- shared copy
COPY = {
    "eyebrow": ("For roofing and siding crews", "Para cuadrillas de techos y siding"),
    "cta": ("Get early access", "Quiero acceso anticipado"),
    "cta2": ("See how it works", "Mira cómo funciona"),
    "proof": ("Built in the field with HMP Siding &amp; Roofing, Fremont, Nebraska.",
              "Hecho en el campo con HMP Siding &amp; Roofing, de Fremont, Nebraska."),
    "nav": [("Product", "Producto"), ("How it works", "Cómo funciona"), ("Pricing", "Precios"), ("Sign in", "Entrar")],
    "benefits": [
        ("hail", ("Hot zones, ranked", "Zonas calientes, en orden"),
         ("This week's hail near you, block by block. Drive to the best one and start knocking.",
          "El granizo de esta semana cerca de ti, cuadra por cuadra. Maneja a la mejor y empieza a tocar.")),
        ("say", ("A guide for every step", "Una guía en cada paso"),
         ("What to say, what to ask and what to collect, from the door to getting paid. Practice with an AI homeowner first.",
          "Qué decir, qué preguntar y qué juntar, de la puerta hasta el cobro. Practica antes con un cliente de IA.")),
        ("shield", ("English and Spanish, with guardrails", "Inglés y español, con reglas claras"),
         ("Scripts in both languages, the required notices at the right moment, and no promises about what insurance will pay.",
          "Guiones en los dos idiomas, los avisos obligatorios en el momento justo y ninguna promesa sobre lo que pagará el seguro.")),
    ],
}

HERO = {
    "aldaba": {
        "h1": ("Every door, the right&nbsp;words.", "En cada puerta, las palabras justas."),
        "sub": ("Aldaba is the field-sales and claims assistant for roofing and siding contractors. It shows the storm-hit "
                "blocks near you, walks you door to door, and tells you what to say and what to ask for at every step, "
                "in English and Spanish.",
                "Aldaba es el asistente de ventas y reclamos para contratistas de techos y siding. Te muestra las cuadras "
                "con daño de tormenta cerca de ti, te lleva puerta por puerta y te dice qué decir y qué pedir en cada "
                "paso, en inglés y en español."),
    },
    "paso": {
        "h1": ("The sale, step by&nbsp;step.", "La venta, paso a&nbsp;paso."),
        "sub": ("From the hail map to the signed job, Paso tells your reps where to knock, what to ask and what the "
                "paperwork needs, one step at a time. In English and Spanish.",
                "Del mapa de granizo al trabajo firmado, Paso le dice a tu equipo dónde tocar, qué preguntar y qué "
                "papeles faltan, un paso a la vez. En inglés y en español."),
    },
    "ronda": {
        "h1": ("Know where to knock&nbsp;today.", "Hoy ya sabes dónde&nbsp;tocar."),
        "sub": ("Ronda ranks the storm-hit blocks near you, puts the doors in walking order and coaches every "
                "conversation, in English and Spanish.",
                "Ronda ordena las cuadras con daño de tormenta cerca de ti, pone las puertas en orden para caminar y te "
                "guía en cada conversación, en inglés y en español."),
    },
}

# the 8 Sale Guide steps (docs/orders/o7-sale-guide.md), short, for Paso's tape measure
STEPS = [("At the door", "En la puerta"), ("Set the visit", "La cita"), ("Inspect", "Inspección"),
         ("At the table", "En la mesa"), ("Paperwork", "Papeles"), ("Claim", "Reclamo"),
         ("Build", "Obra"), ("Get paid", "Cobro")]

LANG_JS = """<script>
(function(){var r=document.documentElement;
function set(l){r.setAttribute('data-lang',l);r.lang=l;
document.querySelectorAll('[data-set]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-set')===l))});
try{localStorage.setItem('pb-lang',l)}catch(e){}}
var s=null;try{s=localStorage.getItem('pb-lang')}catch(e){}
set(!r.hasAttribute('data-fixed')&&(s==='es'||s==='en')?s:(r.getAttribute('data-lang')||'en'));
document.querySelectorAll('[data-set]').forEach(function(b){b.addEventListener('click',function(){set(b.getAttribute('data-set'))})});
})();
</script>"""

STATUS_SVG = ('<svg viewBox="0 0 64 12" aria-hidden="true"><g fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/>'
              '<rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="3" width="3" height="8" rx="1"/>'
              '<rect x="13.5" y="1" width="3" height="10" rx="1"/></g>'
              '<path d="M22.5 4.6a7.6 7.6 0 0 1 10 0M24.6 6.9a4.6 4.6 0 0 1 5.8 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
              '<circle cx="27.5" cy="9.4" r="1.2" fill="currentColor"/>'
              '<rect x="39.5" y=".75" width="21" height="10.5" rx="3" fill="none" stroke="currentColor" stroke-opacity=".45"/>'
              '<rect x="41.3" y="2.5" width="15.5" height="7" rx="1.6" fill="currentColor"/>'
              '<path d="M62.3 4.2v3.6" stroke="currentColor" stroke-opacity=".45" stroke-width="1.4" stroke-linecap="round"/></svg>')


def phone(img="now.png"):
    return (f'<div class="phone"><div class="screen"><div class="status"><span class="clock">9:41</span>'
            f'<span class="island"></span><span class="sys">{STATUS_SVG}</span></div>'
            f'<img src="{img}" width="390" height="844" alt="The Now screen: today\'s best hail zone on a map, '
            f'its hail size, homes and distance, with Drive and Start knocking."></div></div>')


def motif(brand):
    if brand == "aldaba":
        # the knocker, big, behind the phone: roof-line mount, pin, ring
        return ('<svg class="motif" viewBox="0 0 600 780" aria-hidden="true">'
                '<path d="M28 236 300 58 572 236" fill="none" stroke="#d9dce1" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>'
                '<circle cx="300" cy="455" r="258" fill="none" stroke="#f5883a" stroke-width="30"/></svg>')
    if brand == "ronda":
        dash = ' stroke-dasharray="3 7"'
        rings = "".join(f'<circle cx="320" cy="400" r="{r}" fill="none" stroke="#d6d8de" stroke-width="1.2"'
                        f'{dash if r == 380 else ""}/>' for r in (200, 290, 380))
        import math
        dots = ""
        for k, a in enumerate([236, 222, 208, 194, 180, 166, 152, 138, 124]):
            x = 320 + 290 * math.cos(math.radians(a))
            y = 400 + 290 * math.sin(math.radians(a))
            hot = k == 3
            fo = "" if hot else ' fill-opacity=".28"'
            dots += (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{10 if hot else 6}" fill="{"#c8288f" if hot else "#18191c"}"{fo}/>')
            if hot:
                dots += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="19" fill="none" stroke="#c8288f" stroke-opacity=".35" stroke-width="2"/>'
        return ('<svg class="motif" viewBox="0 0 640 800" aria-hidden="true"><defs><radialGradient id="core" cx=".5" cy=".5" r=".5">'
                '<stop offset="0" stop-color="#c8288f" stop-opacity=".38"/><stop offset=".55" stop-color="#c8288f" stop-opacity=".12"/>'
                '<stop offset="1" stop-color="#c8288f" stop-opacity="0"/></radialGradient></defs>'
                f'<circle cx="170" cy="330" r="220" fill="url(#core)"/>{rings}{dots}</svg>')
    return ""


def tape():
    items = "".join(f'<li><b>{i + 1}</b>{t(en, es)}</li>' for i, (en, es) in enumerate(STEPS))
    return (f'<div class="tape" aria-label="The eight steps of the sale"><i class="hook"></i>'
            f'<ol>{items}</ol></div>')


HERO_CSS = """
*{box-sizing:border-box}
html,body{margin:0}
:root:not([data-lang="es"]) .es,[data-lang="es"] .en{display:none!important}
body{font-family:"Geist","Geist L",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--page);color:var(--text);-webkit-font-smoothing:antialiased;font-size:15px;line-height:1.45}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
.i{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none}
:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.site{position:relative;min-height:100vh;display:flex;flex-direction:column;padding:0 64px;overflow:hidden}
.nav{position:relative;z-index:3;height:84px;display:flex;align-items:center;gap:40px;flex:none}
.logo svg{display:block;height:34px;width:auto}
.links{display:flex;gap:28px;font-size:15px;font-weight:500;color:var(--text-2)}
.right{margin-left:auto;display:flex;align-items:center;gap:14px}
.lang{display:inline-flex;padding:3px;border:1px solid var(--rule);border-radius:10px}
.lang button{height:28px;padding:0 10px;border-radius:7px;font:500 12px "Geist Mono","Geist Mono L",ui-monospace,monospace;color:var(--muted)}
.lang button[aria-pressed="true"]{background:var(--chip);color:var(--text)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:54px;padding:0 26px;border-radius:12px;font-weight:600;font-size:16px;white-space:nowrap}
.btn.pri{background:var(--acc);color:var(--on-acc)}
.btn.sec{border:1px solid var(--rule-2);color:var(--text)}
.nav .btn{height:42px;padding:0 18px;font-size:14px}
.hero{position:relative;z-index:2;flex:1;display:grid;grid-template-columns:minmax(0,1fr) 470px;grid-template-areas:"copy device" "benefits device";grid-template-rows:1fr auto;column-gap:72px;padding-bottom:var(--pb,52px)}
.copy{grid-area:copy;align-self:center;max-width:720px}
.eyebrow{margin:0 0 22px;font:500 12px/1.2 "Geist Mono","Geist Mono L",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
h1{margin:0;font-family:var(--display);text-wrap:balance;color:var(--text)}
.sub{margin:26px 0 0;font-size:19px;line-height:1.55;color:var(--text-2);max-width:37em}
.ctas{display:flex;gap:12px;margin-top:34px}
.proof{margin:18px 0 0;font-size:14px;color:var(--muted)}
.benefits{grid-area:benefits;list-style:none;margin:0;padding:26px 0 0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:32px;border-top:1px solid var(--rule)}
.benefits li{display:grid;gap:8px;align-content:start}
.benefits .tile{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;background:var(--acc-bg);color:var(--acc-ink);margin-bottom:4px}
.benefits b{font-size:16px;font-weight:600;letter-spacing:-.01em;color:var(--text)}
.benefits p{margin:0;font-size:14px;line-height:1.5;color:var(--text-2)}
.device{grid-area:device;position:relative;display:grid;place-items:center}
.motif{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:var(--mw,600px);height:auto;z-index:0;pointer-events:none}
.phone{position:relative;z-index:1;width:320px;padding:10px;border-radius:54px;background:#0c0d0f;box-shadow:inset 0 0 0 1.5px #34363b,0 50px 90px -40px rgba(12,13,15,.55),0 18px 36px -18px rgba(12,13,15,.35)}
.screen{position:relative;border-radius:44px;overflow:hidden;background:#f6f7f8}
.status{height:36px;display:flex;align-items:center;justify-content:space-between;padding:4px 24px 0 30px;color:#18191c;font-weight:600;font-size:13.5px;letter-spacing:-.01em}
.status .sys svg{width:54px;height:11px;display:block}
.island{position:absolute;left:50%;top:9px;width:92px;height:25px;border-radius:14px;background:#0c0d0f;transform:translateX(-50%)}
.screen img{display:block;width:100%;height:auto}
@media (prefers-reduced-motion:no-preference){.phone{animation:rise .7s cubic-bezier(.2,.8,.2,1) both}@keyframes rise{from{transform:translateY(14px)}to{transform:none}}}

/* ---------- Aldaba: graphite, one orange knocker ---------- */
.brand-aldaba{--page:#111214;--text:#f1f2f4;--text-2:#b8bbc2;--muted:#868991;--rule:#2a2c30;--rule-2:#3a3c42;--chip:#26272b;
  --acc:#f5883a;--on-acc:#1b1206;--acc-bg:rgba(245,136,58,.14);--acc-ink:#ffa766;--display:"Bricolage Grotesque","Bricolage L",system-ui,sans-serif;--mw:560px}
.brand-aldaba h1{font-weight:700;font-variation-settings:"opsz" 96;font-size:82px;line-height:1;letter-spacing:-.03em}
.brand-aldaba .phone{box-shadow:inset 0 0 0 1.5px #3a3c42,0 50px 100px -30px rgba(0,0,0,.8)}

/* ---------- Paso: paper, tape-measure yellow ---------- */
.brand-paso{--page:#f6f7f8;--text:#18191c;--text-2:#3d3f45;--muted:#6c6f77;--rule:#e3e5e8;--rule-2:#d3d6db;--chip:#e9ebee;
  --acc:#ffc21a;--on-acc:#18191c;--acc-bg:#fff3c4;--acc-ink:#6b4f00;--display:"Archivo","Archivo L",system-ui,sans-serif;--pb:150px}
.brand-paso h1{font-weight:800;font-stretch:125%;font-size:70px;line-height:1.02;letter-spacing:-.025em}
.brand-paso .btn.pri{box-shadow:inset 0 -2px 0 rgba(24,25,28,.18)}
.tape{position:absolute;z-index:1;left:0;right:0;bottom:44px;height:74px;background:
  repeating-linear-gradient(90deg,rgba(24,25,28,.5) 0 1.5px,transparent 1.5px 12px) 64px 0/100% 11px no-repeat,
  repeating-linear-gradient(90deg,rgba(24,25,28,.8) 0 2px,transparent 2px 120px) 64px 0/100% 20px no-repeat,
  #ffc21a;box-shadow:inset 0 -3px 0 rgba(24,25,28,.1)}
.tape .hook{position:absolute;left:52px;top:-6px;width:12px;height:86px;border-radius:3px;background:linear-gradient(90deg,#8c9097,#c9ccd1 45%,#7b7f86)}
.tape ol{list-style:none;margin:0;padding:0 0 0 64px;display:grid;grid-template-columns:repeat(8,120px);height:100%;align-items:end}
.tape li{display:flex;align-items:baseline;gap:7px;padding:0 0 13px 8px;font:600 13px/1.1 "Archivo","Archivo L",sans-serif;font-stretch:100%;color:#18191c;white-space:nowrap}
.tape li b{font-weight:800;font-stretch:125%;font-size:20px}

/* ---------- Ronda: paper, radar rings, magenta core ---------- */
.brand-ronda{--page:#f7f7f9;--text:#18191c;--text-2:#3d3f45;--muted:#6c6f77;--rule:#e3e5e8;--rule-2:#d3d6db;--chip:#e9ebee;
  --acc:#c8288f;--on-acc:#ffffff;--acc-bg:#fbe9f4;--acc-ink:#a11c74;--display:"Unbounded","Unbounded L",system-ui,sans-serif;--mw:680px}
.brand-ronda h1{font-weight:600;font-size:60px;line-height:1.06;letter-spacing:-.03em}
"""


def hero_html(brand, lang=None):
    b = BRANDS[brand]
    h = HERO[brand]
    fixed = f' data-lang="{lang}" data-fixed' if lang else ' data-lang="en"'
    ink = "#eceef1" if brand == "aldaba" else INK
    nav = "".join(f'<a href="#">{t(en, es)}</a>' for en, es in COPY["nav"][:3])
    bens = "".join(
        f'<li><span class="tile">{ic(icon)}</span><b>{t(*title)}</b><p>{t(*body)}</p></li>'
        for icon, title, body in COPY["benefits"])
    return f"""<!doctype html>
<html lang="{lang or 'en'}" class="brand-{brand}"{fixed}>
<head>
<meta charset="utf-8"><meta name="viewport" content="width=1440">
<title>{b['name']} landing hero</title>
<link rel="stylesheet" href="{GOOGLE}">
<style>{font_faces('../fonts/')}{HERO_CSS}</style>
</head>
<body>
<div class="site">
  <header class="nav">
    <a class="logo" href="#" aria-label="{b['name']} home">{lockup_svg(brand, ink=ink)}</a>
    <nav class="links">{nav}</nav>
    <div class="right">
      <div class="lang" role="group" aria-label="Language"><button data-set="en" aria-pressed="true">EN</button><button data-set="es" aria-pressed="false">ES</button></div>
      <a class="btn sec" href="#">{t(*COPY['nav'][3])}</a>
      <a class="btn pri" href="#">{t(*COPY['cta'])}</a>
    </div>
  </header>
  <main class="hero">
    <div class="copy">
      <p class="eyebrow">{t(*COPY['eyebrow'])}</p>
      <h1>{t(*h['h1'])}</h1>
      <p class="sub">{t(*h['sub'])}</p>
      <div class="ctas"><a class="btn pri" href="#">{t(*COPY['cta'])}</a><a class="btn sec" href="#">{t(*COPY['cta2'])}</a></div>
      <p class="proof">{t(*COPY['proof'])}</p>
    </div>
    <ul class="benefits">{bens}</ul>
    <div class="device">{motif(brand)}{phone()}</div>
  </main>
  {tape() if brand == 'paso' else ''}
</div>
{LANG_JS}
</body>
</html>
"""


# ---------------------------------------------------------------- compare page
NAMES = [
    # name, say, status, top3, meaning (en, es), found (en, es), sources [(label, url)]
    ("Aldaba", "al-DAH-bah", "clear", True,
     ("The iron door knocker on old Spanish and Mexican doors. The app is built around the knock.",
      "La aldaba de hierro de las puertas antiguas. La app gira alrededor del toque en la puerta."),
     ("An IT consultancy in Spain, an open-source port-knocking security tool, a Spanish job-search app. Nothing in roofing or field-sales software.",
      "Una consultora de TI en España, una herramienta de seguridad de código abierto y una app de empleo. Nada en software de techos ni de ventas de campo."),
     [("aldaba.es", "https://www.aldaba.es/en/"), ("aldabaknocking.com", "http://www.aldabaknocking.com/")]),
    ("Paso", "PAH-so", "clear", True,
     ("A step. Paso a paso through the sale, and the steps from one door to the next.",
      "Paso a paso por la venta, y los pasos de una puerta a la siguiente."),
     ("A timeline-planner app, a banking app (Paso Bancario), an IT firm in Austria. Nothing in roofing or field sales, but it is a very common word.",
      "Una app de agenda, una app bancaria (Paso Bancario) y una empresa de TI en Austria. Nada en techos ni ventas de campo, pero es una palabra muy común."),
     [("paso.to", "https://paso.to/"), ("PASO Solutions", "https://www.crunchbase.com/organization/paso-solutions")]),
    ("Ronda", "RON-dah", "clear", True,
     ("The round. Hacer la ronda: the doors a rep walks each day, in order.",
      "Hacer la ronda: las puertas que el vendedor camina cada día, en orden."),
     ("Ronda Technologies (IT services), Ronda AI (a teaching assistant), a UK vet-staffing site. Nothing in roofing or field sales. Also a town in Spain and a first name.",
      "Ronda Technologies (servicios de TI), Ronda AI (asistente para maestros) y un sitio de veterinarios en Reino Unido. Nada en techos ni ventas. También es un pueblo de España y un nombre."),
     [("rondatechnologies.com", "https://rondatechnologies.com/"), ("Ronda AI", "https://github.com/ronda-ai/ronda-app")]),
    ("Diestro", "dee-ES-tro", "watch", False,
     ("Right-handed and skilled: the salesman's right hand.", "Hábil y de mano derecha: la mano derecha del vendedor."),
     ("A Mexican company, a design studio and a staffing app called Destro. Nothing in roofing. In Spanish, “el diestro” is also the bullfighter.",
      "Una empresa mexicana, un estudio de diseño y una app de personal llamada Destro. Nada en techos. En español, “el diestro” también es el torero."),
     [("diestro.studio", "https://diestro.studio/"), ("Destro app", "https://play.google.com/store/apps/details?id=com.mobile.app.destro")]),
    ("Alero", "ah-LEH-ro", "watch", False,
     ("The eave: the edge of the roof that keeps the rain off the wall.", "El alero: el borde del techo que protege la pared."),
     ("Alero Technology (San Diego) sells document and e-signature software; Alero Software is an app studio. E-signing is close to what the app will do.",
      "Alero Technology (San Diego) vende software de documentos y firma electrónica; Alero Software es un estudio de apps. La firma electrónica está cerca de lo que hará la app."),
     [("Alero Technology", "https://www.crunchbase.com/organization/alero-technology"), ("alerosoftware.com", "https://alerosoftware.com/about/")]),
    ("Pórtico", "POR-tee-ko", "watch", False,
     ("The porch, where every sale starts. Same word in English (portico).", "El pórtico, donde empieza cada venta. Misma palabra en inglés."),
     ("Portico HR software, the Portico education platform (it has a CRM), and portico.run, a client portal for service businesses with e-signatures and payments.",
      "Software de personal Portico, la plataforma educativa Portico (con CRM) y portico.run, un portal de clientes para negocios de servicio con firmas y pagos."),
     [("portico.run", "https://www.portico.run/client-portal-software"), ("Portico on Capterra", "https://www.capterra.com/p/250804/Portico/")]),
    ("Mano", "MAH-no", "watch", False,
     ("Hand. La mano derecha: the right hand.", "La mano derecha."),
     ("ManoMano Pro, a European tools-and-materials app for contractors. Close in sound and in buyer.",
      "ManoMano Pro, app europea de herramientas y materiales para contratistas. Se parece en sonido y en cliente."),
     [("ManoMano Pro", "https://www.manomano.co.uk/pro")]),
    ("Cuadra", "KWAH-drah", "conflict", False,
     ("A city block in Latin American Spanish: the block you knock.", "La cuadra que vas a tocar."),
     ("Quadra, quoting and estimating software for contractors, made by Cuadra Associates. Same sound, same buyers.",
      "Quadra, software de cotizaciones para contratistas, de Cuadra Associates. Mismo sonido, mismos clientes."),
     [("Quadra on Capterra", "https://www.capterra.com/p/183438/Quadra/")]),
    ("Trato", "TRAH-toh", "conflict", False,
     ("The deal (trato hecho), and treating people fairly.", "Trato hecho, y el buen trato."),
     ("TRATO, contract-management and e-signature software from Mexico City.",
      "TRATO, software de contratos y firma electrónica de la Ciudad de México."),
     [("trato.io", "https://trato.io/")]),
    ("Brío", "BREE-oh", "conflict", False,
     ("Drive and energy. The same word in English (brio).", "Energía y empuje. Misma palabra en inglés."),
     ("Brio Sales by Briostack, a door-to-door sales app for pest-control and lawn companies.",
      "Brio Sales de Briostack, app de ventas puerta a puerta para control de plagas y jardinería."),
     [("Brio Sales", "https://play.google.com/store/apps/details?id=com.briostack.sales")]),
]

DROPPED = [
    ("Aplomo", "aplomo.app, office software for construction firms.", "aplomo.app, software de oficina para constructoras.", "https://aplomo.app/"),
    ("Rumbo", "RUMBO IA, an AI CRM for small businesses in Latin America, and Rumo, a sales-team app.",
     "RUMBO IA, un CRM con IA para pequeños negocios de Latinoamérica, y Rumo, una app para equipos de venta.", "https://github.com/RUMBO-IA/Rumbo"),
    ("Techo", "TECHO, a large Latin American housing nonprofit, and roofing companies named Techo.",
     "TECHO, una organización de vivienda grande en Latinoamérica, y compañías de techos llamadas Techo.", ""),
    ("Toc Toc", "TocToc Doors (a construction app) plus delivery and real-estate apps.",
     "TocToc Doors (app de construcción) y apps de reparto y de bienes raíces.", "https://play.google.com/store/apps/details?id=fr.toctoc.mydev.app"),
    ("Nivel", "Level, a job-costing app for contractors.", "Level, una app de costos de obra para contratistas.", "https://www.checkthelevel.com/?lang=en"),
    ("Sendero", "Sendero Consulting (a CRM consultancy); in Latin America it also recalls Sendero Luminoso.",
     "Sendero Consulting (consultora de CRM); en Latinoamérica también recuerda a Sendero Luminoso.", "https://senderoconsulting.com/"),
]

STATUS = {"clear": ("No conflict found", "Sin conflicto", "ok"),
          "watch": ("Watch", "Cuidado", "warn"),
          "conflict": ("Conflict", "Conflicto", "late")}

OPTIONS = {
    "aldaba": {
        "plate": "dark",
        "meaning": ("The iron door knocker. Every sale starts with a knock.", "La aldaba de la puerta. Cada venta empieza con un toque."),
        "tag": ("Every door, the right words.", "En cada puerta, las palabras justas."),
        "palette": [("Knocker orange", "Naranja aldaba", "#f5883a", "the “do this” color", "el color de “haz esto”"),
                    ("Ink", "Tinta", "#18191c", "text, logo", "texto, logo"),
                    ("Graphite", "Grafito", "#111214", "marketing ground", "fondo de la web"),
                    ("Silver", "Plata", "#eceef1", "logo on dark", "logo en oscuro")],
        "good": [("Most ownable of the three: an unusual word, and nothing found in the category.",
                  "La más propia de las tres: palabra poco común y nada encontrado en el rubro."),
                 ("The app keeps its orange. Only the logo changes.", "La app se queda con su naranja. Solo cambia el logo."),
                 ("It tells the story: the knock is the product.", "Cuenta la historia: el toque en la puerta es el producto.")],
        "watch": [("English speakers have to learn it once (three syllables).", "Quien habla inglés tiene que aprenderla una vez (tres sílabas)."),
                  ("Easy to mishear on the phone; spell it out.", "Se puede oír mal por teléfono; hay que deletrearla.")],
        "app": ("Nothing but the logo. Orange stays the “do this” color.", "Solo el logo. El naranja sigue siendo el color de “haz esto”."),
    },
    "paso": {
        "plate": "tape",
        "meaning": ("A step. The sale, one step at a time.", "Un paso. La venta, un paso a la vez."),
        "tag": ("The sale, step by step.", "La venta, paso a paso."),
        "palette": [("Tape yellow", "Amarillo cinta", "#ffc21a", "the “do this” color", "el color de “haz esto”"),
                    ("Ink", "Tinta", "#18191c", "text, logo, text on yellow", "texto, logo, texto sobre amarillo"),
                    ("Gold ink", "Oro oscuro", "#6b4f00", "text on yellow tints", "texto sobre tonos amarillos"),
                    ("Paper", "Papel", "#f6f7f8", "background", "fondo")],
        "good": [("Easiest to say in both languages: two syllables everyone knows.", "La más fácil en los dos idiomas: dos sílabas que todos conocen."),
                 ("The name is the Sale Guide: paso a paso.", "El nombre es la Guía de venta: paso a paso."),
                 ("Job-site yellow (tape measure, safety vest) stands out on any phone.", "Amarillo de obra (cinta métrica, chaleco) resalta en cualquier teléfono.")],
        "watch": [("A very common word: harder to own the name and a web address.", "Palabra muy común: más difícil quedarse con el nombre y el dominio."),
                  ("Yellow needs dark text, and the app's “waiting” chips must change color.", "El amarillo pide texto oscuro, y las etiquetas de “esperando” deben cambiar de color.")],
        "app": ("Orange becomes tape yellow with dark text; “waiting” chips turn clay-orange so they don't look like the brand.",
                "El naranja pasa a amarillo con texto oscuro; las etiquetas de “esperando” pasan a naranja barro para no confundirse con la marca."),
    },
    "ronda": {
        "plate": "radar",
        "meaning": ("The round: the doors you walk today, in order.", "La ronda: las puertas que caminas hoy, en orden."),
        "tag": ("Know where to knock today.", "Hoy ya sabes dónde tocar."),
        "palette": [("Radar magenta", "Magenta radar", "#c8288f", "the “do this” color", "el color de “haz esto”"),
                    ("Ink", "Tinta", "#18191c", "text, logo", "texto, logo"),
                    ("Deep magenta", "Magenta oscuro", "#a11c74", "text on magenta tints", "texto sobre tonos magenta"),
                    ("Paper", "Papel", "#f6f7f8", "background", "fondo")],
        "good": [("Easy in both languages; “making the rounds” means the same in English.", "Fácil en los dos idiomas; “making the rounds” significa lo mismo en inglés."),
                 ("Magenta is the color radar gives the biggest hail. No roofing app uses it.", "El magenta es el color que el radar da al granizo más grande. Ninguna app de techos lo usa."),
                 ("Round letters feel friendly at the door.", "Letras redondas, amables en la puerta.")],
        "watch": [("Some English speakers will read it as the name Rhonda.", "Algunos en inglés lo leerán como el nombre Rhonda."),
                  ("The biggest change from HMP's orange.", "El cambio más grande frente al naranja de HMP.")],
        "app": ("Orange becomes radar magenta with white text; the hail heat on the map turns magenta too.",
                "El naranja pasa a magenta radar con texto blanco; el calor del granizo en el mapa también se vuelve magenta."),
    },
}


def plate(brand):
    kind = OPTIONS[brand]["plate"]
    if kind == "dark":
        return f'<div class="plate p-dark">{lockup_svg(brand, ink="#eceef1")}</div>'
    if kind == "tape":
        return f'<div class="plate p-tape">{lockup_svg(brand)}<i class="ticks" aria-hidden="true"></i></div>'
    rings = "".join(f'<circle cx="300" cy="84" r="{r}" fill="none" stroke="currentColor" stroke-opacity=".13"/>' for r in (70, 120, 170, 220))
    return (f'<div class="plate p-radar"><svg class="rings" viewBox="0 0 600 168" preserveAspectRatio="xMidYMid slice" '
            f'aria-hidden="true">{rings}</svg>{lockup_svg(brand)}</div>')


def swatches(brand):
    out = []
    for en, es, hexv, ren, res in OPTIONS[brand]["palette"]:
        out.append(f'<li><i style="background:{hexv}"></i><span><b>{t(en, es)}</b><code>{hexv}</code>'
                   f'<small>{t(ren, res)}</small></span></li>')
    return "".join(out)


def option_card(brand, n):
    b = BRANDS[brand]
    o = OPTIONS[brand]
    fam, style = FACES[brand]
    good = "".join(f"<li>{t(en, es)}</li>" for en, es in o["good"])
    watch = "".join(f"<li>{t(en, es)}</li>" for en, es in o["watch"])
    nm = next(x for x in NAMES if x[0] == b["name"])
    pick = (f'<span class="pick">{t("Designer’s pick", "Recomendada")}</span>' if brand == "aldaba" else "")
    return f"""
<article class="opt" id="{brand}" aria-labelledby="{brand}-h">
  {plate(brand)}
  <div class="sec head">
    <div class="nm"><h2 id="{brand}-h">{b['name']}</h2><span class="say">{b['say']}</span>{pick}</div>
    <p>{t(*o['meaning'])}</p>
  </div>
  <div class="sec iconrow">
    <div class="appicon big">{icon_svg(brand, 96)}</div>
    <div class="appicon small">{icon_svg(brand, 48)}</div>
    <p class="note">{t("App icon · 1024 and 180 px PNG, full-bleed square (the phone rounds the corners)", "Ícono · PNG de 1024 y 180 px, cuadrado completo (el teléfono redondea las esquinas)")}</p>
  </div>
  <div class="sec"><p class="lab">{t("Color", "Color")}</p><ul class="sw">{swatches(brand)}</ul></div>
  <div class="sec type">
    <p class="lab">{t("Type", "Letra")}</p>
    <p class="spec" style='font-family:{fam};{style}'>{t(*o['tag'])}</p>
    <p class="note">{t(f"{FACE_NAMES[brand]} for the logo and headlines · Geist stays in the app", f"{FACE_NAMES[brand]} para el logo y los títulos · Geist se queda en la app")}</p>
  </div>
  <div class="sec">
    <p class="lab">{t("Landing page", "Página de inicio")}</p>
    <button class="thumb" type="button" data-brand="{brand}" aria-label="{b['name']}: open the landing hero">
      <img class="en" src="{brand}/hero.png" alt="{b['name']} landing hero in English" loading="lazy" width="1440" height="900">
      <img class="es" src="{brand}/hero-es.png" alt="{b['name']} landing hero in Spanish" loading="lazy" width="1440" height="900">
      <span class="zoom">{ic("expand", "i i-sm")}</span>
    </button>
    <a class="live" href="{brand}/index.html">{ic("open", "i i-sm")}{t("Open the live mockup", "Abrir la maqueta")}</a>
  </div>
  <div class="sec pc">
    <div><p class="lab good">{t("Good", "A favor")}</p><ul>{good}</ul></div>
    <div><p class="lab bad">{t("Watch out", "Ojo")}</p><ul>{watch}</ul></div>
  </div>
  <div class="sec foot">
    <p><b>{t("In the app:", "En la app:")}</b> {t(*o['app'])}</p>
    <p><b>{t("Web check:", "Búsqueda web:")}</b> {t(*nm[5])}</p>
  </div>
</article>"""


COMPARE_CSS = """
:root{
  --bg:#f6f7f8;--card:#ffffff;--soft:#eff1f3;--line:#e3e5e8;--line-2:#d3d6db;
  --ink:#18191c;--ink-2:#3d3f45;--muted:#6c6f77;--faint:#9a9da4;
  --ok:#1f7a4d;--ok-bg:#e7f4ed;--warn:#8a5a00;--warn-bg:#fbf2dc;--late:#c2362b;--late-bg:#fdecea;--you:#2f6fde;
  --e1:0 1px 2px rgba(24,25,28,.05);--e2:0 16px 40px -12px rgba(24,25,28,.28),0 2px 6px rgba(24,25,28,.06);
  --scrim:rgba(17,18,20,.72);--plate:#f6f7f8;--plate-line:#e3e5e8;--wall-a:#c9b8a6;--wall-b:#6f7d8c;
  --f:"Geist","Geist L",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:"Geist Mono","Geist Mono L",ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  color-scheme:dark;--bg:#101113;--card:#191a1d;--soft:#232428;--line:#2b2d31;--line-2:#3a3c42;
  --ink:#f1f2f4;--ink-2:#c9cbd0;--muted:#8f929a;--faint:#6b6e75;
  --ok:#4cc38a;--ok-bg:rgba(76,195,138,.13);--warn:#f0b54a;--warn-bg:rgba(240,181,74,.12);--late:#ff7166;--late-bg:rgba(255,113,102,.13);--you:#5b8ff0;
  --e1:0 0 0 rgba(0,0,0,0);--e2:0 18px 48px -12px rgba(0,0,0,.7),0 0 0 1px #2b2d31;--scrim:rgba(0,0,0,.8);
  --plate:#eef0f2;--plate-line:#dcdfe3;--wall-a:#5a4c40;--wall-b:#22303d;}}
:root[data-theme="dark"]{
  color-scheme:dark;--bg:#101113;--card:#191a1d;--soft:#232428;--line:#2b2d31;--line-2:#3a3c42;
  --ink:#f1f2f4;--ink-2:#c9cbd0;--muted:#8f929a;--faint:#6b6e75;
  --ok:#4cc38a;--ok-bg:rgba(76,195,138,.13);--warn:#f0b54a;--warn-bg:rgba(240,181,74,.12);--late:#ff7166;--late-bg:rgba(255,113,102,.13);--you:#5b8ff0;
  --e1:0 0 0 rgba(0,0,0,0);--e2:0 18px 48px -12px rgba(0,0,0,.7),0 0 0 1px #2b2d31;--scrim:rgba(0,0,0,.8);
  --plate:#eef0f2;--plate-line:#dcdfe3;--wall-a:#5a4c40;--wall-b:#22303d;}
*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--f);font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
:root:not([data-lang="es"]) .es,[data-lang="es"] .en{display:none!important}
h1,h2,h3,p,ul,ol{margin:0}
ul{padding:0;list-style:none}
a{color:inherit}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
:focus-visible{outline:2px solid var(--you);outline-offset:2px;border-radius:4px}
.i{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none}
.i-sm{width:16px;height:16px}
.wrap{max-width:1320px;margin:0 auto;padding-inline:clamp(16px,4vw,48px);padding-block:40px 72px}
.lab{font:500 11px/1.2 var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}

/* header */
.top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px 32px;align-items:start;margin-bottom:28px}
.top h1{font-size:clamp(30px,4.4vw,44px);font-weight:600;letter-spacing:-.035em;line-height:1.08;text-wrap:balance;margin-top:10px}
.top .intro{grid-column:1;max-width:66ch;color:var(--ink-2);font-size:16px}
.langsw{display:inline-flex;padding:3px;border:1px solid var(--line);border-radius:10px;background:var(--card)}
.langsw button{height:30px;padding:0 12px;border-radius:7px;font:500 12px var(--mono);color:var(--muted)}
.langsw button[aria-pressed="true"]{background:var(--ink);color:var(--bg)}
.tm{grid-column:1 / -1;display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:12px;background:var(--warn-bg);color:var(--ink-2);font-size:14px;max-width:880px}
.tm .i{color:var(--warn);margin-top:1px}

/* option cards: subgrid keeps every section on one line across the three */
.options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(8,auto);column-gap:20px;row-gap:0}
.opt{grid-row:span 8;display:grid;grid-template-rows:subgrid;background:var(--card);border:1px solid var(--line);border-radius:18px;box-shadow:var(--e1);overflow:hidden}
.sec{padding:18px 20px;border-top:1px solid var(--line);display:grid;gap:10px;align-content:start}
.plate{height:168px;display:grid;place-items:center;position:relative;overflow:hidden;padding:0 24px}
.plate > svg{height:52px;width:auto;max-width:100%;position:relative}
.p-dark{background:#111214}
.p-tape{background:var(--plate)}
.p-tape .ticks{position:absolute;left:0;right:0;bottom:0;height:22px;background:
  repeating-linear-gradient(90deg,rgba(24,25,28,.5) 0 1.5px,transparent 1.5px 10px) 0 0/100% 9px no-repeat,
  repeating-linear-gradient(90deg,rgba(24,25,28,.8) 0 2px,transparent 2px 50px) 0 0/100% 15px no-repeat,#ffc21a}
.p-radar{background:var(--plate);color:#c8288f}
.p-radar .rings{position:absolute;inset:0;width:100%;height:100%}
.head .nm{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.head h2{font-size:24px;font-weight:600;letter-spacing:-.025em}
.say{font:500 13px var(--mono);color:var(--muted)}
.pick{margin-left:auto;align-self:center;display:inline-flex;height:24px;align-items:center;padding:0 9px;border-radius:8px;background:var(--ink);color:var(--bg);font-size:12px;font-weight:600}
.head p{color:var(--ink-2)}
.iconrow{grid-template-columns:auto auto 1fr;align-items:end;gap:16px}
.appicon svg{display:block}
.appicon.big svg{width:96px;height:96px;border-radius:21.5px}
.appicon.small svg{width:48px;height:48px;border-radius:11px}
.appicon{filter:drop-shadow(0 6px 12px rgba(24,25,28,.16))}
.note{font-size:12.5px;color:var(--muted);line-height:1.4}
.sw{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}
.sw li{display:flex;gap:10px;align-items:flex-start;min-width:0}
.sw i{width:34px;height:34px;border-radius:9px;flex:none;box-shadow:inset 0 0 0 1px rgba(128,128,128,.25)}
.sw span{display:grid;min-width:0}
.sw b{font-size:13px;font-weight:600;line-height:1.25}
.sw code{font:500 11.5px var(--mono);color:var(--ink-2)}
.sw small{font-size:11.5px;color:var(--muted);line-height:1.3}
.spec{font-size:25px;line-height:1.12;letter-spacing:-.02em;color:var(--ink);text-wrap:balance}
.thumb{position:relative;display:block;width:100%;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:var(--soft)}
.thumb img{display:block;width:100%;height:auto;aspect-ratio:16/10}
.thumb .zoom{position:absolute;right:8px;bottom:8px;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:rgba(24,25,28,.72);color:#fff}
.thumb:hover img{filter:brightness(.97)}
.live{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:var(--ink-2);text-decoration:none;justify-self:start}
.live:hover{color:var(--ink);text-decoration:underline}
.pc{grid-template-columns:1fr 1fr;gap:16px}
.pc ul{display:grid;gap:8px;margin-top:8px}
.pc li{font-size:13.5px;line-height:1.4;color:var(--ink-2);padding-left:14px;position:relative}
.pc li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:var(--faint)}
.lab.good{color:var(--ok)}.lab.bad{color:var(--warn)}
.pc div:first-child li::before{background:var(--ok)}.pc div:last-child li::before{background:var(--warn)}
.foot p{font-size:13.5px;color:var(--ink-2);line-height:1.45}
.foot b{color:var(--ink);font-weight:600}

/* home screen */
.block{margin-top:44px}
.block > h2{font-size:22px;font-weight:600;letter-spacing:-.02em;margin-bottom:6px}
.block > p.lede{color:var(--ink-2);max-width:70ch;margin-bottom:16px}
.home{border-radius:20px;padding:28px clamp(16px,4vw,40px);background:linear-gradient(160deg,var(--wall-a),var(--wall-b));display:flex;gap:clamp(18px,4vw,44px);flex-wrap:wrap;justify-content:center}
.home figure{margin:0;display:grid;justify-items:center;gap:7px}
.home svg,.home img{width:64px;height:64px;border-radius:14.5px;display:block;box-shadow:0 8px 18px -8px rgba(0,0,0,.45)}
.home figcaption{font-size:12px;font-weight:500;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4)}

/* names table */
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:16px;background:var(--card);box-shadow:var(--e1)}
table{border-collapse:collapse;width:100%;min-width:760px}
th,td{text-align:left;vertical-align:top;padding:13px 16px;border-top:1px solid var(--line);font-size:14px;line-height:1.45}
thead th{border-top:0;font:500 11px var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);background:var(--soft)}
td.nm b{font-size:16px;font-weight:600;letter-spacing:-.01em;display:block}
td.nm span{font:500 12px var(--mono);color:var(--muted)}
td .src{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;font-size:12.5px}
td .src a{color:var(--muted)}
.chip{display:inline-flex;align-items:center;height:24px;padding:0 8px;border-radius:8px;font-size:12px;font-weight:500;white-space:nowrap}
.chip.ok{background:var(--ok-bg);color:var(--ok)}.chip.warn{background:var(--warn-bg);color:var(--warn)}.chip.late{background:var(--late-bg);color:var(--late)}
.chip.top{background:var(--ink);color:var(--bg);margin-top:6px}
.dropped{margin-top:14px;display:grid;gap:6px;font-size:13.5px;color:var(--ink-2)}
.dropped b{color:var(--ink)}
.next{margin-top:44px;display:grid;gap:8px;padding:20px 22px;border-radius:16px;border:1px solid var(--line);background:var(--card)}
.next h2{font-size:18px;font-weight:600;letter-spacing:-.015em}
.next p{color:var(--ink-2);max-width:78ch}

/* lightbox */
.lb{position:fixed;inset:0;z-index:10;background:var(--scrim);display:grid;place-items:center;padding:clamp(12px,3vw,40px)}
.lb img{max-width:100%;max-height:calc(100vh - 80px);border-radius:12px;box-shadow:var(--e2);background:#fff}
.lb .x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 14px);right:14px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;display:grid;place-items:center}

@media (max-width:1060px){
  .options{grid-template-columns:minmax(0,1fr);grid-template-rows:none;row-gap:20px}
  .opt{grid-row:auto;grid-template-rows:none}
  .top{grid-template-columns:1fr}
}
@media (max-width:460px){
  .pc{grid-template-columns:1fr}
  .sw{grid-template-columns:1fr}
  .iconrow{grid-template-columns:auto auto;}
  .iconrow .note{grid-column:1 / -1}
}
"""

COMPARE_JS = """<script>
(function(){
var r=document.documentElement;
function set(l){r.setAttribute('data-lang',l);
document.querySelectorAll('[data-set]').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-set')===l))});
try{localStorage.setItem('pb-lang',l)}catch(e){}}
var s=null;try{s=localStorage.getItem('pb-lang')}catch(e){}
set(s==='es'?'es':'en');
document.querySelectorAll('[data-set]').forEach(function(b){b.addEventListener('click',function(){set(b.getAttribute('data-set'))})});
var lb=document.getElementById('lb'),img=document.getElementById('lb-img'),last=null;
function close(){lb.hidden=true;img.removeAttribute('src');if(last)last.focus()}
document.querySelectorAll('.thumb').forEach(function(t){t.addEventListener('click',function(){
  var es=r.getAttribute('data-lang')==='es',b=t.getAttribute('data-brand');last=t;
  img.src=b+(es?'/hero-es.png':'/hero.png');img.alt=t.getAttribute('aria-label');lb.hidden=false;lb.querySelector('.x').focus()})});
lb.addEventListener('click',function(e){if(e.target!==img)close()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!lb.hidden)close()});
})();
</script>"""


def names_table():
    rows = []
    for name, say, status, top, meaning, found, srcs in NAMES:
        en, es, cls = STATUS[status]
        src = "".join(f'<a href="{u}" target="_blank" rel="noopener">{H.escape(lbl)}</a>' for lbl, u in srcs)
        topchip = f'<br><span class="chip top">{t("Top 3", "Top 3")}</span>' if top else ""
        rows.append(f'<tr><td class="nm"><b>{name}</b><span>{say}</span>{topchip}</td><td>{t(*meaning)}</td>'
                    f'<td>{t(*found)}<div class="src">{src}</div></td><td><span class="chip {cls}">{t(en, es)}</span></td></tr>')
    return "".join(rows)


def compare_html():
    cards = "".join(option_card(b, i) for i, b in enumerate(BRANDS))
    home = "".join(f'<figure>{icon_svg(b, 64).replace(f"{b}-icon-64", f"{b}-home-64")}<figcaption>{BRANDS[b]["name"]}</figcaption></figure>' for b in BRANDS)
    home += ('<figure><img src="ref/hmp-app-icon-180.png" alt="" width="64" height="64">'
             f'<figcaption>{t("HMP (today)", "HMP (hoy)")}</figcaption></figure>')
    dropped = "".join(f'<p><b>{n}</b>: {t(en, es)}' + (f' <a href="{u}" target="_blank" rel="noopener">{t("source", "fuente")}</a>' if u else "") + "</p>"
                      for n, en, es, u in DROPPED)
    return f"""<title>Aldaba, Paso or Ronda</title>
<link rel="stylesheet" href="{GOOGLE}">
<style>{font_faces('fonts/')}{COMPARE_CSS}</style>
<div class="wrap">
  <header class="top">
    <div>
      <p class="lab">{t("HMP App · product name", "HMP App · nombre del producto")}</p>
      <h1>{t("Pick a name for the app", "Elige un nombre para la app")}</h1>
    </div>
    <div class="langsw" role="group" aria-label="Language / Idioma"><button data-set="en" aria-pressed="true">EN</button><button data-set="es" aria-pressed="false">ES</button></div>
    <p class="intro">{t("HMP stays the first customer. To sell the app to other roofers, it needs its own name. Here are three directions, each with a logo, an app icon, colors, type and a landing page. All three keep the Ledger app design; only the accent color and the headline font change.",
                        "HMP sigue siendo el primer cliente. Para vender la app a otros contratistas de techos, necesita su propio nombre. Aquí hay tres direcciones, cada una con logo, ícono, colores, letra y página de inicio. Las tres mantienen el diseño Ledger de la app; solo cambian el color de acento y la letra de los títulos.")}</p>
    <p class="tm"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 5.5 6v5.3c0 4.3 2.8 7.6 6.5 9.2 3.7-1.6 6.5-4.9 6.5-9.2V6z"/><path d="M12 8.5v4M12 15.6h.01"/></svg>
      {t("Before committing to a name: run a trademark search (USPTO, then a lawyer) and check the .com and .app addresses. Neither has been done; the web check below only looked for obvious clashes in roofing and field-sales software.",
         "Antes de quedarse con un nombre: hacer una búsqueda de marca (USPTO y luego un abogado) y revisar los dominios .com y .app. Nada de eso se ha hecho; la búsqueda de abajo solo buscó choques obvios en software de techos y de ventas de campo.")}</p>
  </header>

  <section class="options" aria-label="{t('The three options', 'Las tres opciones')}">{cards}
  </section>

  <section class="block" aria-labelledby="home-h">
    <h2 id="home-h">{t("On a phone's home screen", "En la pantalla del teléfono")}</h2>
    <p class="lede">{t("The icons at their real size next to today's HMP App icon.", "Los íconos a su tamaño real junto al ícono de la HMP App de hoy.")}</p>
    <div class="home">{home}</div>
  </section>

  <section class="block" aria-labelledby="names-h">
    <h2 id="names-h">{t("All 10 names and what the web search found", "Los 10 nombres y lo que encontró la búsqueda")}</h2>
    <p class="lede">{t("One quick search per name for software with the same or a similar name, looking hardest at roofing, contractor and field-sales apps. None of the apps from the round 42 teardown were used as names.",
                       "Una búsqueda rápida por nombre de software con el mismo nombre o uno parecido, sobre todo apps de techos, contratistas y ventas de campo. Ningún nombre de las apps de la ronda 42 se usó.")}</p>
    <div class="tw"><table>
      <thead><tr><th>{t("Name", "Nombre")}</th><th>{t("Meaning", "Significado")}</th><th>{t("Web check", "Búsqueda web")}</th><th>{t("Status", "Estado")}</th></tr></thead>
      <tbody>{names_table()}</tbody>
    </table></div>
    <div class="dropped"><p class="lab">{t("Also searched and dropped", "También buscados y descartados")}</p>{dropped}</div>
  </section>

  <section class="next" aria-labelledby="next-h">
    <h2 id="next-h">{t("How to pick", "Cómo elegir")}</h2>
    <p>{t("Tell Claude the name you like, or “none of these”. Designer's pick: Aldaba, because it is the most ownable name and the app keeps its orange; Paso is the runner-up if easy-to-say matters most. After you pick: trademark search, web-address check, then the full brand kit for that one name.",
          "Dile a Claude el nombre que te gusta, o “ninguno”. Recomendación del diseñador: Aldaba, porque es el nombre más propio y la app se queda con su naranja; Paso es la segunda si lo más importante es que sea fácil de decir. Después de elegir: búsqueda de marca, revisar dominios y luego el kit completo de marca para ese nombre.")}</p>
  </section>
</div>
<div class="lb" id="lb" hidden role="dialog" aria-modal="true" aria-label="Landing hero">
  <button class="x" type="button" aria-label="Close">{ic("x")}</button>
  <img id="lb-img" alt="">
</div>
{COMPARE_JS}
"""
