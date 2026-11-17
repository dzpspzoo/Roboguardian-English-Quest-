"""Krakeni – najeźdźcy. Ośmiornice w ciężkich zbrojach: groźni, ale bez krwi.
Ta sama skala co reszta postaci (400x600, podłoga y=585)."""
import math
from lib import *


def tentacle(x0, y0, x1, y1, curl, w, col=ALIEN, col_d=ALIEN_D):
    cx1, cy1 = x0 + (x1 - x0) * .2 + curl * .4, y0 + (y1 - y0) * .5
    cx2, cy2 = x1 - curl * .6, y1 - 20
    ex, ey = x1 + curl * .5, y1 - 14
    d = f"M {x0:g} {y0:g} C {cx1:g} {cy1:g}, {cx2:g} {cy2:g}, {x1:g} {y1:g} Q {ex + curl*.3:g} {y1 + 8:g} {ex:g} {ey:g}"
    s = f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w + 2*SW}" stroke-linecap="round" stroke-linejoin="round"/>'
    s += f'<path d="{d}" fill="none" stroke="{col_d}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>'
    s += f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w*.55:g}" stroke-linecap="round" stroke-linejoin="round" transform="translate(-3 -2)"/>'
    # przyssawki
    for t in (.35, .55, .75):
        px = (1 - t) ** 3 * x0 + 3 * (1 - t) ** 2 * t * cx1 + 3 * (1 - t) * t * t * cx2 + t ** 3 * x1
        py = (1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * cy1 + 3 * (1 - t) * t * t * cy2 + t ** 3 * y1
        s += circle(px + 3, py, w * .16, ALIEN_L, sw=0)
    return s


def eyes(cx, cy, n, spread, r=9):
    s = f'<path d="M {cx - spread - 26:g} {cy - 18:g} L {cx + spread + 26:g} {cy - 18:g} L {cx + spread + 18:g} {cy + 16:g} L {cx - spread - 18:g} {cy + 16:g} Z" fill="#05070d" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>'
    xs = [cx - spread + i * (2 * spread / (n - 1)) for i in range(n)]
    for i, x in enumerate(xs):
        yy = cy + (abs(i - (n - 1) / 2) * 3)
        s += f'<path d="M {x - r*1.3:g} {yy - r*.4:g} L {x + r*1.3:g} {yy - r*.9:g} L {x + r*.9:g} {yy + r*.7:g} L {x - r*.9:g} {yy + r*.5:g} Z" fill="{ACID}" filter="url(#glow)"/>'
        s += circle(x, yy, r * .3, "#f6ffe0", sw=0)
    return s


def blaster(x, y, ang=-20, big=False):
    L = 120 if big else 96
    s = f'<g transform="rotate({ang} {x} {y})">'
    s += part(f"M {x - 20:g} {y - 18:g} L {x + L:g} {y - 12:g} L {x + L:g} {y + 12:g} L {x - 20:g} {y + 22:g} Z", METAL_A_L, METAL_A)
    s += part(f"M {x + 20:g} {y - 26:g} L {x + 64:g} {y - 22:g} L {x + 60:g} {y - 10:g} L {x + 22:g} {y - 12:g} Z", ALIEN, ALIEN_D, sw=4, k=2)
    s += circle(x + L + 4, y, 10, ACID, sw=4, extra=' filter="url(#glow)"')
    s += '</g>'
    return s


def kraken(kind="soldier", pose="idle"):
    """kind: soldier | commander. pose: idle | aim | stunned"""
    big = kind == "commander"
    s = []
    s.append(f'<ellipse cx="200" cy="572" rx="110" ry="18" fill="{ACID}" opacity=".35" filter="url(#blur8)"/>')
    # dysk antygrawitacyjny
    s.append(part("M 110 548 C 140 530, 260 530, 290 548 C 260 568, 140 568, 110 548 Z", METAL_A_L, METAL_A))
    s.append(f'<path d="M 140 552 L 260 552" stroke="{ACID}" stroke-width="4" stroke-linecap="round" filter="url(#glow)"/>')
    # peleryna dowódcy
    if big:
        s.append(part("M 128 250 C 90 360, 80 470, 100 540 L 300 540 C 320 470, 310 360, 272 250 Z", "#8a1a35", "#540d20"))
    # macki
    for (x0, x1, curl, w) in [(160, 120, -40, 26), (185, 170, -25, 28), (215, 232, 25, 28), (240, 282, 40, 26)]:
        s.append(tentacle(x0, 400, x1, 528, curl, w))
    # tułów w zbroi
    s.append(part("M 128 262 C 150 240, 250 240, 272 262 L 262 360 C 250 405, 150 405, 138 360 Z", METAL_A_L, METAL_A, hl="#6b6385"))
    s.append(part("M 176 286 L 224 286 L 232 336 L 200 356 L 168 336 Z", ALIEN, ALIEN_D, sw=4, k=4))
    s.append(circle(200, 318, 13, ACID, sw=4, extra=' filter="url(#glow)"'))
    # naramienniki z kolcami
    for sx in (-1, 1):
        bx = 200 + sx * 78
        s.append(part(f"M {bx - 34:g} 266 C {bx - 30:g} 236, {bx + 30:g} 236, {bx + 34:g} 266 L {bx + 26:g} 290 L {bx - 26:g} 290 Z", METAL_A_L, METAL_A, sw=4, k=4))
        for dx in (-16, 0, 16):
            s.append(part(f"M {bx + dx - 7:g} 246 L {bx + dx + sx*4:g} {222 - (8 if dx == 0 else 0)} L {bx + dx + 7:g} 246 Z", SILVER, SILVER_D, sw=3, k=2))
    # ramiona i broń
    if pose == "aim":
        s.append(limb(270, 280, 300, 340, 24, ALIEN, ALIEN_D))
        s.append(blaster(296, 336, -28, big))
        s.append(limb(130, 280, 116, 360, 24, ALIEN, ALIEN_D))
        s.append(circle(116, 364, 15, ALIEN_L, sw=4))
    elif pose == "stunned":
        s.append(limb(270, 280, 330, 230, 24, ALIEN, ALIEN_D))
        s.append(limb(130, 280, 70, 230, 24, ALIEN, ALIEN_D))
    else:
        s.append(limb(270, 280, 292, 372, 24, ALIEN, ALIEN_D))
        s.append(blaster(286, 380, 70 if not big else 80, big))
        s.append(limb(130, 280, 110, 372, 24, ALIEN, ALIEN_D))
        s.append(circle(110, 376, 15, ALIEN_L, sw=4))
    if big:
        # berło dowódcy w lewej ręce
        s.append(part("M 104 120 L 116 120 L 118 540 L 102 540 Z", METAL_A_L, METAL_A, sw=4, k=3))
        s.append(circle(110, 108, 22, ACID, sw=5, extra=' filter="url(#glow)"'))
    # krótkie macki "brody"
    for (x0, x1, c) in [(178, 166, -10), (192, 188, -6), (208, 212, 6), (222, 234, 10)]:
        s.append(tentacle(x0, 232, x1, 290, c, 12))
    # głowa – płaszcz ośmiornicy
    top = 20 if big else 62
    s.append(part(f"M 132 222 C 110 {top + 60}, 150 {top}, 200 {top} C 250 {top}, 290 {top + 60}, 268 222 C 250 250, 150 250, 132 222 Z", ALIEN, ALIEN_D, hl=ALIEN_L, k=10))
    for (x, y, r) in [(168, top + 50, 9), (236, top + 70, 12), (214, top + 32, 6), (150, top + 100, 7)]:
        s.append(circle(x, y, r, ALIEN_D, sw=0, extra=' opacity=".8"'))
    # hełm-przyłbica
    s.append(part("M 136 176 C 160 160, 240 160, 264 176 L 258 222 C 240 238, 160 238, 142 222 Z", METAL_A_L, METAL_A))
    s.append(eyes(200, 198, 4 if big else 3, 40 if big else 30))
    # groźne brwi zbroi
    s.append(part("M 140 172 L 196 184 L 200 172 L 204 184 L 260 172 L 262 160 L 200 168 L 138 160 Z", SILVER, SILVER_D, sw=4, k=2))
    if big:
        # korona z kolców
        for i, x in enumerate([150, 175, 200, 225, 250]):
            h = 46 if i == 2 else 30
            s.append(part(f"M {x - 10:g} {top + 34 + abs(i-2)*8:g} L {x:g} {top - h + 34 + abs(i-2)*8:g} L {x + 10:g} {top + 34 + abs(i-2)*8:g} Z", ACID, ACID_D, sw=4, k=3))
    if pose == "stunned":
        for (x, y) in [(150, 120), (250, 110), (200, 90)]:
            s.append(f'<path d="M {x} {y-12} L {x+3} {y-3} L {x+12} {y} L {x+3} {y+3} L {x} {y+12} L {x-3} {y+3} L {x-12} {y} L {x-3} {y-3} Z" fill="{TEAL_L}" stroke="{TEAL_D}" stroke-width="2"/>')
    return "".join(s)


def drone(eye_col=ACID):
    s = []
    s.append(f'<ellipse cx="200" cy="420" rx="50" ry="14" fill="{eye_col}" opacity=".35" filter="url(#blur8)"/>')
    # płetwy
    for a in (-35, 35, 180):
        s.append(f'<g transform="rotate({a} 200 300)">' + part("M 186 236 L 200 170 L 214 236 Z", METAL_A_L, METAL_A, sw=4, k=3) + '</g>')
    s.append(part("M 140 300 C 140 222, 260 222, 260 300 C 260 378, 140 378, 140 300 Z", METAL_A_L, METAL_A, hl="#6b6385", k=10))
    s.append(part("M 150 286 L 250 286 L 246 312 L 154 312 Z", ALIEN, ALIEN_D, sw=4, k=3))
    s.append(circle(200, 300, 30, "#05070d", sw=5))
    s.append(circle(200, 300, 20, eye_col, sw=0, extra=' filter="url(#glow)"'))
    s.append(circle(206, 294, 6, "#f6ffe0", sw=0))
    # dysza
    s.append(part("M 180 368 L 220 368 L 214 392 L 186 392 Z", METAL_A_L, METAL_A, sw=4, k=2))
    s.append(f'<path d="M 188 394 L 200 418 L 212 394 Z" fill="{eye_col}" opacity=".8" filter="url(#glow)"/>')
    return "".join(s)


def ship(w=520):
    """Statek Krakenów (widok z boku, viewBox 600x300)."""
    s = []
    s.append(f'<path d="M 300 210 L 220 300 L 380 300 Z" fill="{ACID}" opacity=".18"/>')
    s.append(part("M 40 150 C 120 90, 480 90, 560 150 C 480 200, 120 200, 40 150 Z", METAL_A_L, METAL_A, hl="#6b6385", k=10))
    s.append(part("M 200 120 C 220 60, 380 60, 400 120 Z", ALIEN, ALIEN_D, k=8))
    for x in range(90, 540, 60):
        s.append(circle(x, 156, 8, ACID, sw=3, extra=' filter="url(#glow)"'))
    for x in (120, 300, 480):
        s.append(part(f"M {x - 30} 186 L {x - 8} 230 L {x + 8} 230 L {x + 30} 186 Z", METAL_A_L, METAL_A, sw=4, k=3))
    s.append(part("M 276 100 L 324 100 L 318 120 L 282 120 Z", "#05070d", "#05070d", sw=4))
    for x in (288, 300, 312):
        s.append(circle(x, 110, 4, ACID, sw=0, extra=' filter="url(#glow)"'))
    return "".join(s)
