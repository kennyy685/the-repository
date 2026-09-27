"""The three product-brand candidates: marks, lockups and app icons as SVG strings.
Everything is drawn on a 48-unit grid; the wordmarks are font outlines (tools/wordmark.py), so no SVG here needs a font.
Run tools/make.py to write the files; this module only builds strings."""
import math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from wordmark import outline  # noqa: E402

FONTS = os.path.join(HERE, "..", "fonts")

INK = "#18191c"
PAPER = "#f6f7f8"
SILVER = "#eceef1"

BRANDS = {
    "aldaba": {
        "name": "Aldaba", "say": "al-DAH-bah",
        "font": ("BricolageGrotesque-var.woff2", {"wght": 700, "opsz": 96}, -0.025, "aldaba"),
        "accent": "#f5883a", "icon_bg": "#18191c",
    },
    "paso": {
        "name": "Paso", "say": "PAH-so",
        "font": ("Archivo-var.woff2", {"wght": 800, "wdth": 125}, 0.012, "PASO"),
        "accent": "#ffc21a", "icon_bg": "#ffc21a",
    },
    "ronda": {
        "name": "Ronda", "say": "RON-dah",
        "font": ("Unbounded-var.woff2", {"wght": 600}, -0.03, "ronda"),
        "accent": "#c8288f", "icon_bg": "#c8288f",
    },
}


def _pt(cx, cy, r, deg):
    a = math.radians(deg)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def _arc(cx, cy, r, a0, a1):
    x0, y0 = _pt(cx, cy, r, a0)
    x1, y1 = _pt(cx, cy, r, a1)
    large = 1 if (a1 - a0) % 360 > 180 else 0
    return f"M{x0:.2f} {y0:.2f}A{r} {r} 0 {large} 1 {x1:.2f} {y1:.2f}"


# ---------------------------------------------------------------- marks (48 grid)
def mark_inner(brand, ink=INK, accent=None, knock=None):
    """The mark's shapes without an <svg> wrapper. ink = the dark parts, accent = the brand color parts."""
    acc = accent or BRANDS[brand]["accent"]
    if brand == "aldaba":
        # a door knocker: the roof line is the mount, the ring hangs from a pin
        return (f'<path d="M9 19 24 8 39 19" fill="none" stroke="{ink}" stroke-width="5" stroke-linecap="round" '
                f'stroke-linejoin="round"/><circle cx="24" cy="17" r="3" fill="{ink}"/>'
                f'<circle cx="24" cy="31.5" r="10" fill="none" stroke="{acc}" stroke-width="5"/>')
    if brand == "paso":
        # three steps that climb into the roof line: the sale, step by step
        return (f'<path d="M5 42H12V35H19V28H26V19.5M17 20 29.5 8 42 20" fill="none" stroke="{ink}" '
                f'stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
    if brand == "ronda":
        # the day's round of doors around the hail core; the dot is the next door
        dx, dy = _pt(24, 24, 16, -65)
        return (f'<path d="{_arc(24, 24, 16, -40, 250)}" fill="none" stroke="{ink}" stroke-width="5" '
                f'stroke-linecap="round"/><circle cx="{dx:.2f}" cy="{dy:.2f}" r="3.6" fill="{knock or acc}"/>'
                f'<circle cx="24" cy="24" r="6.5" fill="{acc}"/>')
    raise KeyError(brand)


def mark_svg(brand, ink=INK, size=None, title=True):
    """Standalone mark. Paso's mark sits on its yellow tile."""
    b = BRANDS[brand]
    wh = f' width="{size}" height="{size}"' if size else ""
    t = f"<title>{b['name']}</title>" if title else ""
    if brand == "paso":
        inner = (f'<rect width="48" height="48" rx="11" fill="{b["accent"]}"/>'
                 f'<g transform="translate(24 24) scale(.72) translate(-24 -25)">{mark_inner(brand, INK)}</g>')
    else:
        inner = mark_inner(brand, ink)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"{wh} role="img">{t}{inner}</svg>'


# ---------------------------------------------------------------- wordmark + lockup
def wordmark_path(brand, fill):
    fname, axes, track, text = BRANDS[brand]["font"]
    d, x0, y0, w, h = outline(os.path.join(FONTS, fname), text, axes=axes, size=100, track=track)
    return d, x0, y0, w, h


def wordmark_svg(brand, fill=INK, height=None):
    d, x0, y0, w, h = wordmark_path(brand, fill)
    hh = f' height="{height}"' if height else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.1f} {h:.1f}"{hh} role="img">'
            f'<title>{BRANDS[brand]["name"]}</title><path transform="translate({-x0:.2f} {-y0:.2f})" '
            f'fill="{fill}" d="{d}"/></svg>')


def lockup_svg(brand, ink=INK, word=None, height=None, pad=0):
    """Mark + wordmark, side by side, vertically centered on the mark. word = wordmark color (defaults to ink)."""
    word = word or ink
    d, x0, y0, w, h = wordmark_path(brand, word)
    # wordmark size relative to the 48-unit mark
    target = {"aldaba": 31.0, "paso": 24.0, "ronda": 28.0}[brand]
    s = target / h
    gap = {"aldaba": 11, "paso": 13, "ronda": 12}[brand]
    cy = {"aldaba": 26.5, "paso": 24, "ronda": 24}[brand]
    # lowercase words with ascenders: center the x-height region a little lower so the baseline sits on the ring
    ty = cy - h * s / 2 + (1.5 if brand == "aldaba" else 0)
    W = 48 + gap + w * s + pad * 2
    if brand == "paso":
        mark = (f'<rect width="48" height="48" rx="11" fill="{BRANDS[brand]["accent"]}"/>'
                f'<g transform="translate(24 24) scale(.72) translate(-24 -25)">{mark_inner(brand, INK)}</g>')
    else:
        mark = mark_inner(brand, ink)
    hh = f' height="{height}"' if height else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {-pad} {W:.1f} {48 + pad * 2}"{hh} role="img">'
            f'<title>{BRANDS[brand]["name"]}</title>{mark}'
            f'<g transform="translate({48 + gap} {ty:.2f}) scale({s:.4f}) translate({-x0:.2f} {-y0:.2f})" fill="{word}">'
            f'<path d="{d}"/></g></svg>')


def appbar_mark(brand, ink=INK):
    """Small stacked mark for the app's top bar (replaces the HMP chevron + letters in the Now mockup)."""
    d, x0, y0, w, h = wordmark_path(brand, ink)
    wh = 7.2 if brand != "paso" else 6.4
    s = wh / h
    ww = w * s
    W = max(ww, 22)
    mk = 20
    if brand == "paso":
        mark = (f'<rect x="{(W - mk) / 2:.2f}" y="0" width="{mk}" height="{mk}" rx="5" fill="{BRANDS[brand]["accent"]}"/>'
                f'<g transform="translate({W / 2:.2f} 10) scale({mk / 48 * .72:.4f}) translate(-24 -25)">{mark_inner(brand, INK)}</g>')
    else:
        mark = f'<g transform="translate({(W - mk) / 2:.2f} 0) scale({mk / 48:.4f})">{mark_inner(brand, ink)}</g>'
    H = mk + 3 + wh
    return (f'<svg viewBox="0 0 {W:.2f} {H:.2f}" width="{W:.2f}" height="{H:.2f}" aria-label="{BRANDS[brand]["name"]}">{mark}'
            f'<g transform="translate({(W - ww) / 2:.2f} {mk + 3}) scale({s:.4f}) translate({-x0:.2f} {-y0:.2f})" fill="{ink}">'
            f'<path d="{d}"/></g></svg>')


# ---------------------------------------------------------------- app icon (1024, full bleed, safe inside the center circle)
def icon_svg(brand, size=1024):
    b = BRANDS[brand]
    gid = f"{brand}-icon-{size}"  # unique per inline copy, or several icons on one page share one gradient
    if brand == "aldaba":
        bg = (f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26272b"/>'
              f'<stop offset="1" stop-color="#141517"/></linearGradient></defs><rect width="48" height="48" fill="url(#{gid})"/>')
        art = f'<g transform="translate(24 24.6) scale(.64) translate(-24 -26)">{mark_inner(brand, SILVER)}</g>'
    elif brand == "paso":
        bg = f'<rect width="48" height="48" fill="{b["accent"]}"/>'
        # tape-measure ticks along the bottom edge: a job-site detail, kept outside the safe circle on purpose
        ticks = "".join(
            f'<path d="M{x:.2f} 48v-{2.6 if i % 4 else 4.2}" stroke="{INK}" stroke-opacity=".22" stroke-width=".55"/>'
            for i, x in enumerate([2 + j * 2.2 for j in range(21)]))
        art = ticks + f'<g transform="translate(24 24) scale(.66) translate(-23.5 -25)">{mark_inner(brand, INK)}</g>'
    elif brand == "ronda":
        bg = (f'<defs><radialGradient id="{gid}" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#d4379c"/>'
              f'<stop offset="1" stop-color="#b01f7c"/></radialGradient></defs><rect width="48" height="48" fill="url(#{gid})"/>'
              + "".join(f'<circle cx="24" cy="24" r="{r}" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width=".5"/>'
                        for r in (20.5, 26, 31.5)))
        art = f'<g transform="translate(24 24) scale(.66) translate(-24 -24)">{mark_inner(brand, "#ffffff", "#ffffff")}</g>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="{size}" height="{size}">'
            f'<title>{b["name"]} app icon</title>{bg}{art}</svg>')
