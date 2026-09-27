"""Turn a word into SVG outline paths (so logos need no font).
Usage from Python: outline(font_path, text, axes={"wght":700}, size=100, track=-0.02) -> (d, x0, y0, w, h)
Coordinates: baseline at y=0 before cropping; the returned path is cropped to its ink box at (0,0)."""
import io
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import uharfbuzz as hb

_cache = {}

def _static(font_path, axes):
    key = (font_path, tuple(sorted(axes.items())))
    if key in _cache:
        return _cache[key]
    f = TTFont(font_path)
    if "fvar" in f:
        pin = {a.axisTag: axes.get(a.axisTag, a.defaultValue) for a in f["fvar"].axes}
        f = instancer.instantiateVariableFont(f, pin)
    buf = io.BytesIO()
    f.flavor = None
    f.save(buf)
    data = buf.getvalue()
    _cache[key] = (TTFont(io.BytesIO(data)), data)
    return _cache[key]

def outline(font_path, text, axes=None, size=100.0, track=0.0, extra=None):
    """extra: {index: dx_em} adds space after a glyph (optical kerning fixes)."""
    axes = axes or {}
    font, data = _static(font_path, axes)
    upm = font["head"].unitsPerEm
    face = hb.Face(data)
    hbf = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbf, buf, {"kern": True, "liga": True})
    gs = font.getGlyphSet()
    order = font.getGlyphOrder()
    s = size / upm
    x = 0.0
    pen = SVGPathPen(gs)
    bpen = BoundsPen(gs)
    for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        name = order[info.codepoint]
        t = (s, 0, 0, -s, x + pos.x_offset * s, -pos.y_offset * s)
        gs[name].draw(TransformPen(pen, t))
        gs[name].draw(TransformPen(bpen, t))
        x += pos.x_advance * s + track * size
        if extra and i in extra:
            x += extra[i] * size
    xmin, ymin, xmax, ymax = bpen.bounds
    return pen.getCommands(), xmin, ymin, xmax - xmin, ymax - ymin

def cropped(font_path, text, **kw):
    """Path translated so its ink box starts at 0,0. Returns (d, w, h, baseline_y)."""
    d, x0, y0, w, h = outline(font_path, text, **kw)
    return f'<path transform="translate({-x0:.2f} {-y0:.2f})" d="{d}"/>', w, h, -y0
