"""Build the product-brand exploration: SVG assets, app icons, brand-tinted Now screens, landing heroes, compare page.
Usage: python3 tools/make.py [assets|icons|now|hero|compare|all]   (needs fontTools, uharfbuzz, brotli, Pillow)
Chromium renders every PNG. The Now screens come from ../v25-polish/now.html with only the accent tokens swapped."""
import os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, ".."))
V25 = os.path.normpath(os.path.join(ROOT, "..", "v25-polish"))
sys.path.insert(0, HERE)
from marks import BRANDS, INK, mark_svg, lockup_svg, wordmark_svg, icon_svg, appbar_mark  # noqa: E402
from pages import hero_html, compare_html, TOKENS_CSS  # noqa: E402

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
TMP = tempfile.mkdtemp(prefix="pbrand-")


def shot(html_path, png, w, h, scale=1, extra=110, budget=4000):
    """Screenshot a page. The headless window loses ~90px at the bottom, so render taller and crop."""
    raw = os.path.join(TMP, "raw.png")
    subprocess.run([CHROME, "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
                    f"--window-size={w},{h + extra}", f"--force-device-scale-factor={scale}",
                    f"--virtual-time-budget={budget}", f"--screenshot={raw}", "file://" + html_path],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    from PIL import Image
    im = Image.open(raw).convert("RGB")
    im.crop((0, 0, w * scale, h * scale)).save(png, optimize=True)
    return png


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


# ---------------------------------------------------------------- 1. SVG assets
def assets():
    for b in BRANDS:
        d = os.path.join(ROOT, b)
        write(os.path.join(d, "mark.svg"), mark_svg(b) + "\n")
        write(os.path.join(d, "logo.svg"), lockup_svg(b, pad=4) + "\n")
        write(os.path.join(d, "logo-reverse.svg"), lockup_svg(b, ink="#eceef1", pad=4) + "\n")
        write(os.path.join(d, "wordmark.svg"), wordmark_svg(b) + "\n")
        write(os.path.join(d, "icon.svg"), icon_svg(b) + "\n")
    print("assets ok")


# ---------------------------------------------------------------- 2. app icons (PNG, RGB, full bleed)
def icons():
    from PIL import Image
    for b in BRANDS:
        page = os.path.join(TMP, f"icon-{b}.html")
        write(page, f'<!doctype html><html><head><style>html,body{{margin:0;background:#000}}svg{{display:block}}</style></head>'
                    f'<body>{icon_svg(b, 1024)}</body></html>')
        big = shot(page, os.path.join(ROOT, b, "icon-1024.png"), 1024, 1024)
        Image.open(big).convert("RGB").resize((180, 180), Image.LANCZOS).save(os.path.join(ROOT, b, "icon-180.png"), optimize=True)
    print("icons ok")


# ---------------------------------------------------------------- 3. the v25 Now screen in each brand
def now():
    src = open(os.path.join(V25, "now.html"), encoding="utf-8").read()
    for b in BRANDS:
        work = os.path.join(TMP, f"now-{b}")
        shutil.rmtree(work, ignore_errors=True)
        shutil.copytree(V25, work, ignore=shutil.ignore_patterns("after", "before", "*.md"))
        html = src.replace('<html lang="en">', f'<html lang="en" class="brand-{b}">')
        html = html.replace('<link rel="stylesheet" href="ds.css">',
                            '<link rel="stylesheet" href="ds.css">\n<style>' + TOKENS_CSS +
                            '.legend .bar{background:linear-gradient(90deg,rgba(var(--heat),.18),rgba(var(--heat),.55),rgb(var(--heat)))}'
                            '.mark svg{width:auto;height:auto}'
                            # headless Chrome keeps a window of at least ~500px, which turns on the desktop "stage"
                            # frame; pin the phone to the top-left so the crop is exactly the 390 x 844 screen
                            'body.stage{padding:0!important;background:var(--bg)!important}'
                            '.phone{margin:0!important;border-radius:0!important;box-shadow:none!important}</style>')
        html, n = re.subn(r'<div class="mark">.*?</div>', f'<div class="mark">{appbar_mark(b)}</div>', html, count=1, flags=re.S)
        assert n == 1, "mark not found in now.html"
        write(os.path.join(work, "now.html"), html)
        shot(os.path.join(work, "now.html"), os.path.join(ROOT, b, "now.png"), 390, 844, scale=2)
    print("now ok")


# ---------------------------------------------------------------- 4. landing heroes (EN + ES)
def hero():
    for b in BRANDS:
        page = os.path.join(ROOT, b, "index.html")
        write(page, hero_html(b))
        for lang in ("en", "es"):
            tmp = os.path.join(ROOT, b, f".render-{lang}.html")
            write(tmp, hero_html(b, lang=lang))
            try:
                shot(tmp, os.path.join(ROOT, b, "hero.png" if lang == "en" else "hero-es.png"), 1440, 900, scale=1)
            finally:
                os.remove(tmp)
    print("hero ok")


# ---------------------------------------------------------------- 5. compare page + side-by-side image
def compare():
    html = compare_html()
    write(os.path.join(ROOT, "compare.html"), html)
    # the artifact page has no doctype of its own (the host adds it); render a wrapped copy next to it
    tmp = os.path.join(ROOT, ".render-compare.html")
    write(tmp, '<!doctype html><html lang="en"><head><meta charset="utf-8">'
               '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' + html + "</body></html>")
    try:
        shot(tmp, os.path.join(ROOT, "compare.png"), 1440, 1180, scale=1, budget=6000)
    finally:
        os.remove(tmp)
    print("compare ok")


if __name__ == "__main__":
    what = sys.argv[1:] or ["all"]
    steps = {"assets": assets, "icons": icons, "now": now, "hero": hero, "compare": compare}
    for w in (steps if "all" in what else what):
        steps[w]()
