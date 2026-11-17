"""Tła 1920x1080. Postacie stawiamy na linii podłogi FLOOR (górne 80% kadru
zostaje na akcję, dolne 20% na polskie napisy)."""
import math
import random
from lib import *
from textpath import text_path

W, H = 1920, 1080
FLOOR = 850
BSW = 3.5  # cieńszy kontur tła, żeby postacie były wyraźniejsze


def grad(id_, stops, x1=0, y1=0, x2=0, y2=1):
    st = "".join(f'<stop offset="{o}" stop-color="{c}"{"" if op is None else f" stop-opacity={chr(34)}{op}{chr(34)}"}/>' for o, c, op in
                 [(s + (None,))[:3] if len(s) == 2 else s for s in stops])
    return f'<linearGradient id="{id_}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{st}</linearGradient>'


def rgrad(id_, stops, cx=.5, cy=.5, r=.5):
    st = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{op}"/>' for o, c, op in stops)
    return f'<radialGradient id="{id_}" cx="{cx}" cy="{cy}" r="{r}">{st}</radialGradient>'


def stars(n, x0, y0, x1, y1, seed=1, big=0.08):
    rnd = random.Random(seed)
    s = []
    for _ in range(n):
        x, y = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
        r = rnd.choice([1, 1.2, 1.5, 2]) if rnd.random() > big else 3
        op = rnd.uniform(.4, 1)
        if r == 3:
            s.append(f'<path d="M {x:.0f} {y-9:.0f} L {x+2:.0f} {y-2:.0f} L {x+9:.0f} {y:.0f} L {x+2:.0f} {y+2:.0f} L {x:.0f} {y+9:.0f} L {x-2:.0f} {y+2:.0f} L {x-9:.0f} {y:.0f} L {x-2:.0f} {y-2:.0f} Z" fill="#fff" opacity="{op:.2f}"/>')
        else:
            s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r}" fill="#fff" opacity="{op:.2f}"/>')
    return "".join(s)


def bpart(d, light, dark=None, k=8):
    return part(d, light, dark, sw=BSW, k=k)


def rect(x, y, w, h, fill, dark=None, k=6):
    return bpart(f"M {x:g} {y:g} L {x+w:g} {y:g} L {x+w:g} {y+h:g} L {x:g} {y+h:g} Z", fill, dark, k)


def label(text, x, y, size, fill=ORANGE, stroke=INK, sw=6, wght=700, glow=None):
    d, w = text_path(text, x, y, size, wght)
    s = ""
    if glow:
        s += f'<path d="{d}" fill="{glow}" filter="url(#glow)" opacity=".8"/>'
    s += f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"/>'
    s += f'<path d="{d}" fill="{fill}"/>'
    return s


# ======================================================================= HANGAR
def hangar(gate_open=True, frame=True, lights=True, dim=False):
    defs = (grad("hgWall", [(0, "#1a2a4c"), (1, "#0f1a33")]) +
            grad("hgFloor", [(0, "#2c3e63"), (1, "#0d1528")]) +
            grad("hgSky", [(0, "#070c1c"), (.7, "#1b2b55"), (1, "#3a3f7a")]) +
            rgrad("hgCone", [(0, "#fff3d0", .38), (1, "#fff3d0", 0)], .5, 0, 1) +
            rgrad("hgTeal", [(0, TEAL, .35), (1, TEAL, 0)]))
    s = [f'<rect width="{W}" height="{H}" fill="url(#hgWall)"/>']
    # wrota w głębi
    gx0, gx1, gy0, gy1 = 620, 1300, 150, 640
    if gate_open:
        s.append(f'<path d="M {gx0} {gy1} L {gx0} {gy0 + 120} Q {(gx0+gx1)/2} {gy0 - 60} {gx1} {gy0 + 120} L {gx1} {gy1} Z" fill="url(#hgSky)"/>')
        s.append(stars(120, gx0, gy0 - 20, gx1, gy1 - 60, seed=7))
        s.append(circle(1150, 290, 46, "#c9d4ff", sw=0, extra=' opacity=".9"'))
        s.append(circle(1135, 280, 46, "#2a3768", sw=0, extra=' opacity=".9"'))
        # odległe góry / horyzont
        s.append(f'<path d="M {gx0} {gy1} L {gx0} 560 L 720 520 L 800 560 L 900 500 L 1010 555 L 1100 515 L 1200 560 L {gx1} 530 L {gx1} {gy1} Z" fill="#141f3d"/>')
    else:
        s.append(f'<path d="M {gx0} {gy1} L {gx0} {gy0 + 120} Q {(gx0+gx1)/2} {gy0 - 60} {gx1} {gy0 + 120} L {gx1} {gy1} Z" fill="#22345a"/>')
        for x in range(gx0 + 40, gx1, 80):
            s.append(f'<path d="M {x} {gy0 + 40} L {x} {gy1}" stroke="#16213a" stroke-width="6"/>')
    s.append(f'<path d="M {gx0} {gy1} L {gx0} {gy0 + 120} Q {(gx0+gx1)/2} {gy0 - 60} {gx1} {gy0 + 120} L {gx1} {gy1}" fill="none" stroke="{SILVER_D}" stroke-width="22"/>')
    s.append(f'<path d="M {gx0} {gy1} L {gx0} {gy0 + 120} Q {(gx0+gx1)/2} {gy0 - 60} {gx1} {gy0 + 120} L {gx1} {gy1}" fill="none" stroke="{INK}" stroke-width="4"/>')
    # ściany boczne w perspektywie
    s.append(f'<path d="M 0 0 L 520 120 L 520 660 L 0 860 Z" fill="#132242" stroke="{INK}" stroke-width="{BSW}"/>')
    s.append(f'<path d="M {W} 0 L 1400 120 L 1400 660 L {W} 860 Z" fill="#101d3a" stroke="{INK}" stroke-width="{BSW}"/>')
    for i in range(1, 5):
        t = i / 5
        s.append(f'<path d="M {520*t:.0f} {120*t:.0f} L {520*t:.0f} {860 - 200*t:.0f}" stroke="#1d3157" stroke-width="10"/>')
        s.append(f'<path d="M {W - 520*t:.0f} {120*t:.0f} L {W - 520*t:.0f} {860 - 200*t:.0f}" stroke="#1a2b4f" stroke-width="10"/>')
    # tylna ściana – panele
    s.append(f'<path d="M 520 120 L 1400 120 L 1400 150 L 520 150 Z" fill="#16213a"/>')
    for x in (560, 1360):
        s.append(rect(x - 24, 150, 48, 510, NAVY, NAVY_D))
    # kratownica sufitu
    for i in range(6):
        x = 520 + i * 176
        s.append(f'<path d="M {x} 120 L {x + 88} 40 L {x + 176} 120" fill="none" stroke="#2a3d66" stroke-width="10"/>')
    s.append(f'<path d="M 0 0 L {W} 0 L 1400 120 L 520 120 Z" fill="#0b1428" opacity=".9"/>')
    # podłoga
    s.append(f'<path d="M 0 860 L 520 660 L 1400 660 L {W} 860 L {W} {H} L 0 {H} Z" fill="url(#hgFloor)" stroke="{INK}" stroke-width="{BSW}"/>')
    for i in range(-6, 7):
        s.append(f'<path d="M {960 + i*80} 660 L {960 + i*330} {H}" stroke="#1b2947" stroke-width="3"/>')
    for y in (700, 760, 840, 950):
        s.append(f'<path d="M 0 {y + (860-y)*0} L {W} {y}" stroke="#1b2947" stroke-width="3" opacity=".7"/>')
    # pas ostrzegawczy przy wrotach
    s.append(f'<clipPath id="hz"><path d="M 600 652 L 1320 652 L 1330 676 L 590 676 Z"/></clipPath>')
    s.append(f'<g clip-path="url(#hz)"><rect x="580" y="640" width="760" height="40" fill="{WARM}"/>' +
             "".join(f'<path d="M {x} 690 L {x + 24} 640 L {x + 44} 640 L {x + 20} 690 Z" fill="{INK}"/>' for x in range(560, 1360, 44)) + '</g>')
    # turkusowe pasy świetlne w podłodze
    for sx in (-1, 1):
        s.append(f'<path d="M {960 + sx*330} 670 L {960 + sx*900} {H}" stroke="{TEAL}" stroke-width="6" opacity=".75" filter="url(#glow)"/>')
    # rekwizyty: skrzynie, wózek, monitory
    s.append(crate(150, 760, 170, 120))
    s.append(crate(240, 690, 120, 80, ORANGE, ORANGE_D))
    s.append(crate(1640, 770, 190, 130))
    s.append(monitors(1480, 420))
    s.append(crane(250, 160))
    # stelaż AEGIS-7
    if frame:
        s.append(gantry(960, 170, FLOOR, 440))
    # lampy
    if lights:
        for x in (480, 960, 1440):
            s.append(f'<path d="M {x - 70} 70 L {x + 70} 70 L {x + 420} {H} L {x - 420} {H} Z" fill="url(#hgCone)" opacity="{.35 if dim else .8}"/>')
            s.append(bpart(f"M {x - 50} 50 L {x + 50} 50 L {x + 34} 74 L {x - 34} 74 Z", "#3a4c74", "#22345a"))
            s.append(f'<rect x="{x - 32}" y="72" width="64" height="6" fill="#fff6d8"/>')
    if dim:
        s.append(f'<rect width="{W}" height="{H}" fill="#050a18" opacity=".45"/>')
    return "".join(s), defs


def crate(x, y, w, h, col=NAVY_L, dark=NAVY):
    s = rect(x, y, w, h, col, dark)
    s += line(f"M {x+8:g} {y+8:g} L {x+w-8:g} {y+h-8:g} M {x+w-8:g} {y+8:g} L {x+8:g} {y+h-8:g}", dark, 6)
    s += f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" fill="none" stroke="{INK}" stroke-width="{BSW}"/>'
    return s


def monitors(x, y):
    s = rect(x, y, 240, 150, "#0f1a33", "#0a1224")
    s += f'<rect x="{x+14}" y="{y+14}" width="212" height="122" fill="{TEAL}" opacity=".18"/>'
    for i, h in enumerate([40, 70, 55, 90, 64, 80]):
        s += f'<rect x="{x + 30 + i*30}" y="{y + 120 - h}" width="18" height="{h}" fill="{TEAL}" opacity=".85"/>'
    s += line(f"M {x+30} {y+40} L {x+90} {y+30} L {x+140} {y+55} L {x+210} {y+28}", TEAL_L, 3)
    s += rect(x + 100, y + 150, 40, 120, NAVY, NAVY_D)
    return s


def crane(x, y):
    s = bpart(f"M {x-30} 0 L {x+30} 0 L {x+30} {y} L {x-30} {y} Z", ORANGE, ORANGE_D)
    s += bpart(f"M {x-10} {y} L {x+10} {y} L {x+10} {y+130} L {x-10} {y+130} Z", SILVER_D, "#6c7787")
    s += bpart(f"M {x-36} {y+130} L {x+36} {y+130} L {x+24} {y+170} L {x-24} {y+170} Z", NAVY_L, NAVY)
    s += line(f"M {x-20} {y+170} L {x-30} {y+210} M {x+20} {y+170} L {x+30} {y+210}", SILVER, 8)
    return s


def gantry(cx, top, floor, width):
    x0, x1 = cx - width / 2, cx + width / 2
    s = ""
    for x in (x0, x1):
        s += bpart(f"M {x-26} {top} L {x+26} {top} L {x+26} {floor} L {x-26} {floor} Z", NAVY_L, NAVY)
        for y in range(int(top) + 60, int(floor) - 20, 80):
            s += line(f"M {x-20} {y} L {x+20} {y+40}", NAVY_D, 6)
        s += f'<rect x="{x - 8}" y="{top + 40}" width="16" height="{floor - top - 80}" fill="{TEAL}" opacity=".5" filter="url(#glow)"/>'
        s += bpart(f"M {x-50} {floor - 26} L {x+50} {floor - 26} L {x+58} {floor + 6} L {x-58} {floor + 6} Z", ORANGE, ORANGE_D)
    s += bpart(f"M {x0-60} {top-70} L {x1+60} {top-70} L {x1+60} {top} L {x0-60} {top} Z", NAVY, NAVY_D)
    s += label("AEGIS-7", cx, top - 18, 56, ORANGE, glow=ORANGE)
    # platforma
    s += bpart(f"M {x0-40} {floor - 6} L {x1+40} {floor - 6} L {x1+80} {floor + 40} L {x0-80} {floor + 40} Z", "#3a4c74", "#22345a")
    s += f'<path d="M {x0-20} {floor + 16} L {x1+20} {floor + 16}" stroke="{TEAL}" stroke-width="5" filter="url(#glow)"/>'
    return s


# ================================================================= DOM-LABORATORIUM
def home_lab(evening=False):
    sky = [(0, "#7ec8ff"), (1, "#d8f1ff")] if not evening else [(0, "#3b3a8a"), (.6, "#e0708a"), (1, "#ffc27a")]
    defs = (grad("hlWall", [(0, "#f1dfc2"), (1, "#e2c79f")]) +
            grad("hlFloor", [(0, "#c98a57"), (1, "#8f5a34")]) +
            grad("hlSky", sky) +
            rgrad("hlSun", [(0, "#fff7d6", .9), (1, "#fff7d6", 0)]) +
            rgrad("hlLamp", [(0, WARM, .55), (1, WARM, 0)]))
    s = [f'<rect width="{W}" height="{H}" fill="url(#hlWall)"/>']
    # listwa i panele ściany
    for x in range(0, W, 240):
        s.append(f'<path d="M {x} 0 L {x} {FLOOR - 120}" stroke="#d9bd93" stroke-width="4"/>')
    # okno z widokiem
    wx, wy, ww, wh = 1180, 140, 560, 420
    s.append(f'<rect x="{wx}" y="{wy}" width="{ww}" height="{wh}" fill="url(#hlSky)"/>')
    s.append(f'<circle cx="{wx + 420}" cy="{wy + 120}" r="160" fill="url(#hlSun)"/>')
    s.append(circle(wx + 420, wy + 120, 44, "#fff2b0", sw=0))
    s.append(f'<path d="M {wx} {wy + 330} Q {wx + 150} {wy + 270} {wx + 300} {wy + 320} Q {wx + 430} {wy + 280} {wx + ww} {wy + 310} L {wx + ww} {wy + wh} L {wx} {wy + wh} Z" fill="#6fbf73"/>')
    s.append(f'<path d="M {wx} {wy + 370} Q {wx + 200} {wy + 330} {wx + ww} {wy + 380} L {wx + ww} {wy + wh} L {wx} {wy + wh} Z" fill="#4fa257"/>')
    # drzewo za oknem
    tx = wx + 150
    s.append(bpart(f"M {tx - 12} {wy + 380} L {tx + 12} {wy + 380} L {tx + 8} {wy + 250} L {tx - 8} {wy + 250} Z", "#8a5a33", "#6a4224"))
    for (dx, dy, r) in [(0, 190, 80), (-60, 230, 60), (60, 235, 62), (0, 140, 55)]:
        s.append(circle(tx + dx, wy + dy, r, "#3f9a4e", sw=BSW))
    for (dx, dy, r) in [(-20, 170, 30), (40, 210, 22)]:
        s.append(circle(tx + dx, wy + dy, r, "#6cc56f", sw=0))
    # rama okna
    s.append(f'<rect x="{wx}" y="{wy}" width="{ww}" height="{wh}" fill="none" stroke="#f9f4ea" stroke-width="22"/>')
    s.append(f'<path d="M {wx + ww/2} {wy} L {wx + ww/2} {wy + wh} M {wx} {wy + wh/2} L {wx + ww} {wy + wh/2}" stroke="#f9f4ea" stroke-width="14"/>')
    s.append(f'<rect x="{wx - 11}" y="{wy - 11}" width="{ww + 22}" height="{wh + 22}" fill="none" stroke="{INK}" stroke-width="{BSW}"/>')
    s.append(rect(wx - 40, wy + wh + 8, ww + 80, 26, "#f9f4ea", "#d8cdb8"))
    # półki z książkami i gadżetami
    for (sx_, sy_) in [(120, 200), (120, 380)]:
        s.append(rect(sx_, sy_, 420, 22, "#9a6338", "#6e4426"))
        x = sx_ + 20
        rnd = random.Random(sy_)
        while x < sx_ + 380:
            bw = rnd.randint(18, 34)
            bh = rnd.randint(70, 110)
            col = rnd.choice([ORANGE, TEAL, NAVY_L, "#e05a6a", "#ffd25e", "#7a6cf0"])
            s.append(rect(x, sy_ - bh, bw, bh, col, None))
            x += bw + rnd.randint(2, 8)
            if rnd.random() < .18:
                x += 30
    # model planety i robocik na półce
    s.append(circle(470, 140, 34, "#7a6cf0", sw=BSW))
    s.append(f'<ellipse cx="470" cy="140" rx="58" ry="12" fill="none" stroke="{WARM_D}" stroke-width="6"/>')
    # tablica z rysunkami robota
    s.append(rect(620, 160, 420, 280, "#22345a", "#16213a"))
    s.append(f'<g opacity=".85" stroke="{TEAL_L}" stroke-width="3" fill="none">'
             '<path d="M 760 210 L 900 210 L 890 300 L 770 300 Z"/><circle cx="830" cy="250" r="18"/>'
             '<path d="M 790 190 L 870 190 L 860 210 L 800 210 Z"/><path d="M 770 300 L 760 400 M 890 300 L 900 400"/>'
             '<path d="M 660 220 L 720 220 M 660 250 L 710 250 M 660 280 L 730 280 M 950 380 L 1010 380 M 950 400 L 990 400"/></g>')
    # stół warsztatowy
    s.append(rect(80, 640, 520, 30, "#9a6338", "#6e4426"))
    s.append(rect(100, 670, 26, 180, "#7a4c2a", "#5a361c"))
    s.append(rect(554, 670, 26, 180, "#7a4c2a", "#5a361c"))
    s.append(f'<path d="M 150 640 L 170 600 L 230 600 L 250 640 Z" fill="{TEAL}" stroke="{INK}" stroke-width="{BSW}"/>')
    s.append(rect(300, 585, 120, 55, NAVY_L, NAVY))
    s.append(f'<rect x="312" y="596" width="96" height="32" fill="{TEAL}" opacity=".8"/>')
    s.append(line("M 460 630 L 520 600 M 470 640 L 540 620", SILVER_D, 8))
    # lampa
    s.append(f'<circle cx="1000" cy="560" r="300" fill="url(#hlLamp)"/>')
    # roślina
    s.append(bpart("M 1790 850 L 1870 850 L 1860 760 L 1800 760 Z", ORANGE, ORANGE_D))
    for a in (-40, -15, 10, 35):
        s.append(f'<path d="M 1830 760 Q {1830 + a*2} {660} {1830 + a*3} 620" fill="none" stroke="#3f9a4e" stroke-width="14" stroke-linecap="round"/>')
    # podłoga
    s.append(f'<path d="M 0 {FLOOR - 120} L {W} {FLOOR - 120} L {W} {H} L 0 {H} Z" fill="url(#hlFloor)" stroke="{INK}" stroke-width="{BSW}"/>')
    for y in (FLOOR - 60, FLOOR + 20, FLOOR + 120):
        s.append(f'<path d="M 0 {y} L {W} {y}" stroke="#7a4a2a" stroke-width="3" opacity=".6"/>')
    s.append(f'<ellipse cx="960" cy="{FLOOR + 10}" rx="620" ry="70" fill="#e98f47" opacity=".55" stroke="{INK}" stroke-width="{BSW}"/>')
    s.append(f'<ellipse cx="960" cy="{FLOOR + 10}" rx="540" ry="52" fill="none" stroke="#ffd29a" stroke-width="6" opacity=".7"/>')
    if evening:
        s.append(f'<rect width="{W}" height="{H}" fill="#3b2a6a" opacity=".18"/>')
    return "".join(s), defs


def assembly_stand(cx, top, floor):
    """Stanowisko montażowe w laboratorium (ramiona z kablami)."""
    s = ""
    for sx in (-1, 1):
        x = cx + sx * 250
        s += bpart(f"M {x-18} {top} L {x+18} {top} L {x+18} {floor} L {x-18} {floor} Z", SILVER_D, "#6c7787")
        s += bpart(f"M {x-40} {floor-16} L {x+40} {floor-16} L {x+46} {floor+8} L {x-46} {floor+8} Z", NAVY_L, NAVY)
        s += f'<path d="M {x} {top + 120} Q {x - sx*80} {top + 220} {x - sx*150} {top + 210}" fill="none" stroke="{INK}" stroke-width="12"/>'
        s += f'<path d="M {x} {top + 120} Q {x - sx*80} {top + 220} {x - sx*150} {top + 210}" fill="none" stroke="{ORANGE}" stroke-width="6"/>'
        s += f'<path d="M {x} {top + 300} Q {x - sx*70} {top + 360} {x - sx*130} {top + 340}" fill="none" stroke="{INK}" stroke-width="12"/>'
        s += f'<path d="M {x} {top + 300} Q {x - sx*70} {top + 360} {x - sx*130} {top + 340}" fill="none" stroke="{TEAL}" stroke-width="6"/>'
    s += bpart(f"M {cx-290} {top-30} L {cx+290} {top-30} L {cx+290} {top} L {cx-290} {top} Z", NAVY_L, NAVY)
    s += bpart(f"M {cx-200} {floor-4} L {cx+200} {floor-4} L {cx+230} {floor+30} L {cx-230} {floor+30} Z", "#3a4c74", "#22345a")
    return s


# ======================================================================= TARAS NOCĄ
def terrace_night():
    defs = (grad("tnSky", [(0, "#060b1d"), (.65, "#1a2a5a"), (1, "#3d3f7d")]) +
            rgrad("tnWin", [(0, WARM, .7), (1, WARM, 0)]) +
            grad("tnDeck", [(0, "#8a5a3a"), (1, "#4f321f")]))
    s = [f'<rect width="{W}" height="{H}" fill="url(#tnSky)"/>', stars(260, 0, 0, W, 560, seed=3)]
    # droga mleczna
    s.append(f'<path d="M 0 360 C 500 180, 1300 120, {W} 40 L {W} 160 C 1300 230, 500 300, 0 470 Z" fill="#9fb4ff" opacity=".08"/>')
    s.append(circle(1600, 170, 60, "#f2f4ff", sw=0, extra=' filter="url(#glow)"'))
    s.append(circle(1585, 160, 12, "#d8dcf0", sw=0))
    s.append(circle(1618, 186, 8, "#d8dcf0", sw=0))
    # wzgórza i światła miasta
    s.append(f'<path d="M 0 600 Q 400 520 800 590 Q 1200 640 1500 560 Q 1750 520 {W} 580 L {W} {H} L 0 {H} Z" fill="#141d3b"/>')
    rnd = random.Random(5)
    for _ in range(90):
        x = rnd.uniform(500, 1900)
        y = rnd.uniform(600, 660)
        s.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{rnd.choice([1.5, 2, 2.5])}" fill="{rnd.choice([WARM, "#fff", TEAL_L])}" opacity=".85"/>')
    # ściana domu z lewej
    s.append(bpart("M 0 120 L 360 160 L 360 900 L 0 900 Z", "#3a3550", "#2a263c"))
    s.append(f'<circle cx="190" cy="460" r="260" fill="url(#tnWin)"/>')
    s.append(bpart("M 90 320 L 290 330 L 290 600 L 90 600 Z", WARM, WARM_D))
    s.append(line("M 190 325 L 190 600 M 90 460 L 290 465", "#7a4a2a", 10))
    # dach
    s.append(bpart("M -20 140 L 420 190 L 400 120 L -20 60 Z", "#5a2f2a", "#3d1f1c"))
    # pokład tarasu
    s.append(f'<path d="M 0 {FLOOR - 60} L {W} {FLOOR - 60} L {W} {H} L 0 {H} Z" fill="url(#tnDeck)" stroke="{INK}" stroke-width="{BSW}"/>')
    for y in range(FLOOR - 30, H, 50):
        s.append(f'<path d="M 0 {y} L {W} {y}" stroke="#3b2516" stroke-width="3"/>')
    # balustrada
    s.append(bpart(f"M 360 {FLOOR - 230} L {W} {FLOOR - 230} L {W} {FLOOR - 206} L 360 {FLOOR - 206} Z", "#9a6a46", "#6b452b"))
    for x in range(400, W, 90):
        s.append(bpart(f"M {x} {FLOOR - 206} L {x + 14} {FLOOR - 206} L {x + 14} {FLOOR - 60} L {x} {FLOOR - 60} Z", "#8a5a3a", "#6b452b", k=3))
    # lampki
    s.append(f'<path d="M 360 300 Q 900 380 {W} 280" fill="none" stroke="{INK}" stroke-width="3"/>')
    for i in range(1, 16):
        t = i / 16
        x = 360 + (W - 360) * t
        y = (1 - t) ** 2 * 300 + 2 * (1 - t) * t * 380 + t * t * 280
        s.append(circle(x, y + 10, 8, rnd.choice([WARM, TEAL_L, ORANGE_L]), sw=2.5, extra=' filter="url(#glow)"'))
    return "".join(s), defs


# ======================================================================= MIASTO NOCĄ
def city_night(attack=False, street=True):
    sky = [(0, "#05060f"), (.55, "#2a0f3a"), (1, "#7a1f3a")] if attack else [(0, "#060b1d"), (.6, "#1b2552"), (1, "#3d3a78")]
    defs = (grad("cnSky", sky) + grad("cnStreet", [(0, "#2a2f45"), (1, "#0e111d")]) +
            rgrad("cnRed", [(0, DANGER, .55), (1, DANGER, 0)]))
    s = [f'<rect width="{W}" height="{H}" fill="url(#cnSky)"/>', stars(140, 0, 0, W, 420, seed=11)]
    if attack:
        s.append(f'<ellipse cx="960" cy="640" rx="1100" ry="300" fill="url(#cnRed)"/>')
    # sylwetki budynków – 3 plany
    rnd = random.Random(21)
    for layer, (base, col, wincol, hmin, hmax) in enumerate([(640, "#1a1d3d", "#3a3f7a", 160, 380), (700, "#141632", WARM, 120, 330), (760, "#0e1026", WARM, 90, 260)]):
        x = -40
        while x < W:
            bw = rnd.randint(90, 190)
            bh = rnd.randint(hmin, hmax)
            top = base - bh
            d = f"M {x} {base + 200} L {x} {top} L {x + bw} {top} L {x + bw} {base + 200} Z"
            s.append(f'<path d="{d}" fill="{col}" stroke="{INK}" stroke-width="{2 if layer < 2 else BSW}"/>')
            if rnd.random() < .3:
                s.append(f'<path d="M {x + bw/2} {top} L {x + bw/2} {top - 40}" stroke="{col}" stroke-width="6"/>')
                s.append(circle(x + bw / 2, top - 42, 4, DANGER, sw=0, extra=' filter="url(#glow)"'))
            for wy in range(top + 20, base + 40, 34):
                for wx in range(x + 14, x + bw - 18, 28):
                    if rnd.random() < (.35 if layer else .2):
                        s.append(f'<rect x="{wx}" y="{wy}" width="12" height="16" fill="{wincol}" opacity="{.5 + .4*rnd.random():.2f}"/>')
            x += bw + rnd.randint(-10, 20)
    if street:
        s.append(f'<path d="M 0 {FLOOR - 70} L {W} {FLOOR - 70} L {W} {H} L 0 {H} Z" fill="url(#cnStreet)" stroke="{INK}" stroke-width="{BSW}"/>')
        s.append(f'<path d="M 0 {FLOOR - 70} L {W} {FLOOR - 70} L {W} {FLOOR - 50} L 0 {FLOOR - 50} Z" fill="#5a6078" stroke="{INK}" stroke-width="{BSW}"/>')
        for x in range(60, W, 260):
            s.append(f'<path d="M {x} {FLOOR + 90} L {x + 140} {FLOOR + 90}" stroke="{WARM}" stroke-width="10" opacity=".55"/>')
        # latarnie
        for x in (240, 1680):
            s.append(bpart(f"M {x - 8} {FLOOR - 70} L {x + 8} {FLOOR - 70} L {x + 8} 420 L {x - 8} 420 Z", "#3a3f5a", "#262a40", k=3))
            s.append(bpart(f"M {x - 8} 420 Q {x + 40} 380 {x + 70} 410 L {x + 62} 420 Q {x + 40} 398 {x - 8} 436 Z", "#3a3f5a", "#262a40", k=2))
            s.append(f'<path d="M {x + 52} 418 L {x + 0} {FLOOR - 70} L {x + 140} {FLOOR - 70} L {x + 82} 418 Z" fill="{WARM}" opacity=".16"/>')
            s.append(circle(x + 66, 418, 10, WARM, sw=3, extra=' filter="url(#glow)"'))
    if attack:
        # dym
        for (x, y, r) in [(380, 560, 90), (460, 520, 70), (1500, 580, 100), (1590, 540, 70)]:
            s.append(circle(x, y, r, "#2a2236", sw=0, extra=' opacity=".75" filter="url(#blur20)"'))
    return "".join(s), defs


def manta(x, y, sc=1.0, beam=False, beam_len=500):
    """Statek Krakenów – kształt manty."""
    s = ""
    if beam:
        s += f'<path d="M {x - 40*sc} {y + 40*sc} L {x - 160*sc} {y + beam_len} L {x + 160*sc} {y + beam_len} L {x + 40*sc} {y + 40*sc} Z" fill="{ACID}" opacity=".22"/>'
        s += f'<path d="M {x - 25*sc} {y + 40*sc} L {x - 90*sc} {y + beam_len} L {x + 90*sc} {y + beam_len} L {x + 25*sc} {y + 40*sc} Z" fill="{ACID}" opacity=".2" filter="url(#blur8)"/>'
    d = (f"M {x - 300*sc} {y + 10*sc} L {x - 120*sc} {y - 40*sc} L {x - 40*sc} {y - 80*sc} L {x + 40*sc} {y - 80*sc} L {x + 120*sc} {y - 40*sc} "
         f"L {x + 300*sc} {y + 10*sc} L {x + 140*sc} {y + 30*sc} L {x + 60*sc} {y + 60*sc} L {x - 60*sc} {y + 60*sc} L {x - 140*sc} {y + 30*sc} Z")
    s += part(d, METAL_A_L, METAL_A, sw=4, k=10 * sc)
    s += part(f"M {x - 60*sc} {y - 50*sc} C {x - 40*sc} {y - 110*sc}, {x + 40*sc} {y - 110*sc}, {x + 60*sc} {y - 50*sc} Z", ALIEN, ALIEN_D, sw=4, k=6 * sc)
    for dx in (-220, -150, -80, 80, 150, 220):
        s += circle(x + dx * sc, y + (10 - abs(dx) * .05) * sc, 7 * sc, ACID, sw=0, extra=' filter="url(#glow)"')
    for dx in (-24, 0, 24):
        s += circle(x + dx * sc, y - 62 * sc, 6 * sc, ACID, sw=0, extra=' filter="url(#glow)"')
    for sx in (-1, 1):
        s += part(f"M {x + sx*120*sc} {y - 40*sc} L {x + sx*170*sc} {y - 100*sc} L {x + sx*150*sc} {y - 30*sc} Z", SILVER, SILVER_D, sw=3, k=3)
    return s


# ======================================================================= STACJA KOSMICZNA
def space_station():
    defs = grad("ssSpace", [(0, "#03050c"), (1, "#0d1530")]) + rgrad("ssEarth", [(0, "#5ec8ff", 1), (.7, "#2a6fd0", 1), (1, "#0d2a6a", 1)], .5, .3, .7)
    s = [f'<rect width="{W}" height="{H}" fill="url(#ssSpace)"/>', stars(300, 0, 0, W, H, seed=9)]
    s.append(f'<ellipse cx="960" cy="1700" rx="1500" ry="900" fill="#7fdcff" opacity=".35" filter="url(#blur20)"/>')
    s.append(f'<ellipse cx="960" cy="1700" rx="1450" ry="870" fill="url(#ssEarth)"/>')
    for (x, y, rx, ry) in [(600, 900, 220, 60), (1300, 880, 260, 50), (1000, 960, 300, 40)]:
        s.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#3fa65a" opacity=".8"/>')
        s.append(f'<ellipse cx="{x+60}" cy="{y-20}" rx="{rx*.6}" ry="{ry*.5}" fill="#fff" opacity=".35"/>')
    # stacja
    cx, cy = 1180, 380
    s.append(bpart(f"M {cx - 420} {cy - 10} L {cx + 420} {cy - 10} L {cx + 420} {cy + 10} L {cx - 420} {cy + 10} Z", SILVER_D, "#6c7787"))
    for sx in (-1, 1):
        px = cx + sx * 330
        s.append(bpart(f"M {px - 70} {cy - 150} L {px + 70} {cy - 150} L {px + 70} {cy + 150} L {px - 70} {cy + 150} Z", "#2a4c9a", "#1a3270"))
        for i in range(1, 6):
            s.append(f'<path d="M {px - 70} {cy - 150 + i*50} L {px + 70} {cy - 150 + i*50}" stroke="#7fa8ff" stroke-width="2" opacity=".6"/>')
        s.append(f'<path d="M {px} {cy - 150} L {px} {cy + 150}" stroke="#7fa8ff" stroke-width="2" opacity=".6"/>')
    s.append(f'<ellipse cx="{cx}" cy="{cy}" rx="200" ry="70" fill="none" stroke="{INK}" stroke-width="40"/>')
    s.append(f'<ellipse cx="{cx}" cy="{cy}" rx="200" ry="70" fill="none" stroke="{SILVER}" stroke-width="30"/>')
    s.append(bpart(f"M {cx - 80} {cy - 70} L {cx + 80} {cy - 70} L {cx + 80} {cy + 70} L {cx - 80} {cy + 70} Z", SILVER, SILVER_D))
    s.append(bpart(f"M {cx - 50} {cy - 120} L {cx + 50} {cy - 120} L {cx + 50} {cy - 70} L {cx - 50} {cy - 70} Z", ORANGE, ORANGE_D))
    for dx in (-50, 0, 50):
        s.append(circle(cx + dx, cy, 14, TEAL, sw=3, extra=' filter="url(#glow)"'))
    # zielona klatka Krakenów wokół stacji
    s.append(f'<ellipse cx="{cx}" cy="{cy}" rx="480" ry="240" fill="none" stroke="{ACID}" stroke-width="5" stroke-dasharray="30 18" opacity=".7" filter="url(#glow)"/>')
    return "".join(s), defs


BACKGROUNDS = {
    "hangar": lambda: hangar(),
    "hangar_closed": lambda: hangar(gate_open=False, frame=False),
    "home_lab": lambda: home_lab(),
    "home_lab_evening": lambda: home_lab(evening=True),
    "terrace_night": terrace_night,
    "city_night": lambda: city_night(),
    "city_attack": lambda: city_night(attack=True),
    "space_station": space_station,
}
