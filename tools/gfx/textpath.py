"""Tekst -> ścieżka SVG (font Fredoka, licencja OFL), żeby logo i napisy na
ilustracjach nie zależały od fontów zainstalowanych u gracza."""
import os
from functools import lru_cache
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = [os.path.join(HERE, "..", "..", "assets", "gfx", "fonts", f) for f in ("fredoka-latin.woff2", "fredoka-latin-ext.woff2")]


@lru_cache(None)
def _font(path, wght):
    f = TTFont(path)
    return instancer.instantiateVariableFont(f, {"wght": wght})


def text_path(text, x, y, size, wght=700, anchor="middle", spacing=0.0):
    """Zwraca (d, szerokość). y = linia bazowa."""
    fonts = [_font(p, wght) for p in FONTS]
    upm = fonts[0]["head"].unitsPerEm
    sc = size / upm
    glyphs = []
    total = 0
    for ch in text:
        for f in fonts:
            cmap = f.getBestCmap()
            if ord(ch) in cmap:
                gn = cmap[ord(ch)]
                adv = f["hmtx"][gn][0]
                glyphs.append((f, gn, total))
                total += adv + spacing * upm
                break
    total -= spacing * upm
    w = total * sc
    x0 = x - (w / 2 if anchor == "middle" else (w if anchor == "end" else 0))
    d = []
    for f, gn, off in glyphs:
        gs = f.getGlyphSet()
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}")
        tp = TransformPen(pen, (sc, 0, 0, -sc, x0 + off * sc, y))
        gs[gn].draw(tp)
        d.append(pen.getCommands())
    return " ".join(d), w
