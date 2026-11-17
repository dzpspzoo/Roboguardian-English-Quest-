"""AEGIS-7 – bohater gry. Wzór: rendery AEGIS-7 (granat, pomarańcz, srebro, turkus).

Skala wspólna dla postaci: viewBox 400x600, podłoga y=585, środek x=200.
Każda część ma id (part-head, part-torso, ...), żeby gra mogła pokazywać
robota w trakcie składania (części brakujące = klasa .rg-missing).
"""
from lib import *

C = 200  # oś symetrii


def M(d):
    return mirror_d(d, C)


# ---------------------------------------------------------------- części
def antennas(power=True):
    return (part("M 214 70 L 250 6 L 228 74 Z", ORANGE, ORANGE_D, sw=4, k=3) +
            part("M 228 80 L 272 26 L 240 88 Z", ORANGE, ORANGE_D, sw=4, k=3))


def head(expr="calm", power=True):
    s = []
    # hełm
    s.append(part("M 156 104 C 152 58, 248 58, 244 104 L 238 136 C 224 152, 176 152, 162 136 Z", NAVY, NAVY_D, hl=NAVY_L))
    # pomarańczowy grzebień i srebrne płytki
    s.append(part("M 184 70 C 192 62, 208 62, 216 70 L 213 96 L 187 96 Z", ORANGE, ORANGE_D, sw=4, k=4))
    s.append(part("M 166 82 C 170 74, 178 70, 184 70 L 186 92 L 166 98 Z", SILVER, SILVER_D, sw=4, k=3))
    s.append(part(M("M 166 82 C 170 74, 178 70, 184 70 L 186 92 L 166 98 Z"), SILVER, SILVER_D, sw=4, k=3))
    # „uszy” – dyski z boku
    for x in (156, 244):
        s.append(circle(x, 112, 14, ORANGE, sw=4))
        s.append(circle(x, 112, 6, SILVER, sw=3))
    # wizjer
    vis = "M 168 98 L 232 98 L 227 128 L 200 139 L 173 128 Z"
    vfill = TEAL if power else "#1d3a44"
    vdark = TEAL_D if power else "#122830"
    s.append(part(vis, vfill, vdark, k=5))
    if power:
        s.append(f'<path d="M 176 103 L 200 103" stroke="{TEAL_L}" stroke-width="4" stroke-linecap="round" opacity=".8"/>')
    # oczy
    eye = TEAL_L if power else "#3b6670"
    if expr == "happy":
        s.append(line("M 179 117 Q 186 107 193 117", INK, 4.5))
        s.append(line("M 207 117 Q 214 107 221 117", INK, 4.5))
    elif expr == "off":
        s.append(line("M 179 115 L 193 115", "#0a1a1f", 4))
        s.append(line("M 207 115 L 221 115", "#0a1a1f", 4))
    elif expr == "determined":
        s.append(f'<path d="M 177 110 L 194 114 L 192 120 L 178 118 Z" fill="#fff" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>')
        s.append(f'<path d="M 223 110 L 206 114 L 208 120 L 222 118 Z" fill="#fff" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>')
    elif expr == "damaged":
        s.append(ellipse(186, 115, 7, 5, eye, sw=3))
        s.append(line("M 207 115 L 221 115", "#0a1a1f", 4))
    else:  # calm
        s.append(ellipse(186, 114, 8, 6, "#fff", sw=3))
        s.append(ellipse(214, 114, 8, 6, "#fff", sw=3))
        s.append(circle(188, 113, 2.5, TEAL_L, sw=0))
        s.append(circle(216, 113, 2.5, TEAL_L, sw=0))
    # szczęka
    s.append(part("M 176 129 L 200 141 L 224 129 L 222 144 L 200 153 L 178 144 Z", NAVY_L, NAVY, sw=4, k=3))
    return "".join(s)


def neck():
    return part("M 184 140 L 216 140 L 218 168 L 182 168 Z", NAVY_D, "#0f1a30", sw=4, k=3)


def torso(power=True):
    s = []
    s.append(part("M 138 162 C 170 150, 230 150, 262 162 L 254 232 L 240 292 L 160 292 L 146 232 Z", NAVY, NAVY_D, hl=NAVY_L))
    # boczne płyty pomarańczowe
    s.append(part("M 145 176 L 165 172 L 162 226 L 150 224 Z", ORANGE, ORANGE_D, sw=4, k=3))
    s.append(part(M("M 145 176 L 165 172 L 162 226 L 150 224 Z"), ORANGE, ORANGE_D, sw=4, k=3))
    # płyta piersiowa
    chest = "M 168 172 L 232 172 L 237 214 L 222 254 L 178 254 L 163 214 Z"
    if power:
        s.append(f'<path d="{chest}" fill="{TEAL}" opacity=".55" filter="url(#blur8)"/>')
        s.append(part(chest, TEAL, TEAL_D, k=6))
    else:
        s.append(part(chest, "#24515a", "#163238", k=6))
    s.append(line("M 175 190 L 225 190 M 172 232 L 228 232", TEAL_D if power else "#163238", 3))
    s.append(f'<g id="part-core">{core(power)}</g>')
    # brzuch
    s.append(part("M 168 290 L 232 290 L 228 320 L 172 320 Z", NAVY_D, "#0f1a30", sw=4, k=3))
    s.append(line("M 176 300 L 224 300 M 178 310 L 222 310", NAVY_L, 3))
    return "".join(s)


def core(power=True):
    if not power:
        return circle(200, 212, 14, "#2c5e66", sw=4) + circle(200, 212, 6, "#1d3a44", sw=0)
    return (circle(200, 212, 22, TEAL_L, sw=0, extra=' opacity=".7" filter="url(#blur8)"') +
            circle(200, 212, 14, TEAL_L, sw=4) + circle(200, 212, 7, "#ffffff", sw=0))


def pelvis():
    s = part("M 150 318 L 250 318 L 246 352 L 200 364 L 154 352 Z", NAVY, NAVY_D)
    s += part("M 186 322 L 214 322 L 210 354 L 200 360 L 190 354 Z", SILVER, SILVER_D, sw=4, k=3)
    return s


def thigh(side="l"):
    s = part("M 150 344 L 196 344 L 192 440 L 158 440 Z", NAVY, NAVY_D)
    s += part("M 149 352 L 184 352 L 180 418 L 155 410 Z", ORANGE, ORANGE_D, sw=4, k=4)
    return s if side == "l" else M_all(s)


def shin(side="l"):
    s = part("M 150 462 L 194 462 L 198 538 L 146 538 Z", NAVY, NAVY_D)
    s += part("M 153 430 L 193 430 L 191 462 L 173 472 L 155 462 Z", SILVER, SILVER_D, sw=4, k=3)
    s += part("M 151 490 L 192 490 L 196 532 L 148 532 Z", ORANGE, ORANGE_D, sw=4, k=4)
    # stopa
    s += part("M 134 530 L 202 530 L 206 585 L 120 585 C 116 568, 122 545, 134 530 Z", NAVY, NAVY_D)
    s += part("M 119 585 L 124 560 L 160 555 L 166 585 Z", ORANGE, ORANGE_D, sw=4, k=3)
    return s if side == "l" else M_all(s)


def upperarm(side="l"):
    s = part("M 106 194 L 144 194 L 139 287 L 109 287 Z", NAVY, NAVY_D)
    s += circle(124, 292, 16, NAVY_D, sw=4)
    return s if side == "l" else M_all(s)


def forearm(side="l", shield=False, sword=False, power=True):
    s = ""
    if sword:
        # miecz energetyczny trzymany w pięści, ostrze w górę
        blade = "M 116 395 L 108 230 L 122 200 L 136 230 L 128 395 Z"
        s += f'<path d="{blade}" fill="{TEAL}" opacity=".6" filter="url(#blur8)"/>'
        s += part(blade, TEAL_L, TEAL, sw=4, k=4)
        s += part("M 100 392 L 144 392 L 144 404 L 100 404 Z", SILVER, SILVER_D, sw=4, k=2)
    s += part("M 93 290 L 150 292 L 143 377 L 103 380 C 95 352, 91 320, 93 290 Z", ORANGE, ORANGE_D, hl=ORANGE_L)
    s += part("M 98 302 L 122 302 L 120 360 L 104 362 Z", SILVER, SILVER_D, sw=4, k=3)
    s += part("M 100 374 L 142 374 L 144 406 C 136 420, 108 420, 100 406 Z", NAVY, NAVY_D, sw=4, k=4)
    s += line("M 110 394 L 136 394", NAVY_L, 3)
    if shield:
        sh = "M 40 300 L 80 270 L 120 290 L 122 360 L 80 395 L 40 365 Z"
        s += f'<path d="{sh}" fill="{TEAL}" opacity=".35"/>'
        s += f'<path d="{sh}" fill="none" stroke="{TEAL_L}" stroke-width="6" stroke-linejoin="round" filter="url(#glow)"/>'
        s += f'<path d="M 80 285 L 80 380 M 50 312 L 110 345 M 50 352 L 110 315" stroke="{TEAL_L}" stroke-width="2.5" opacity=".7"/>'
    return s if side == "l" else M_all(s)


def pauldron(side="l"):
    s = part("M 80 186 C 80 150, 120 134, 154 150 L 162 186 C 152 212, 100 224, 80 202 Z", ORANGE, ORANGE_D, hl=ORANGE_L)
    s += part("M 90 162 C 104 146, 130 142, 150 152 L 142 172 C 126 164, 108 166, 98 178 Z", SILVER, SILVER_D, sw=4, k=3)
    return s if side == "l" else M_all(s)


def M_all(s):
    """Odbija całe fragmenty SVG (ścieżki d=, okręgi cx=)."""
    import re as _re
    s = _re.sub(r'(?<![\w-])d="([^"]+)"', lambda m: f'd="{mirror_d(m.group(1), C)}"', s)
    s = _re.sub(r'(?<![\w-])cx="([-\d.]+)"', lambda m: f'cx="{2*C - float(m.group(1)):g}"', s)
    return s


def damage_marks():
    s = line("M 150 200 L 160 212 L 154 222", INK, 3)
    s += line("M 236 300 L 244 312 L 238 318", INK, 3)
    s += line("M 170 470 L 180 480", INK, 3)
    # iskry
    for (x, y) in [(254, 236), (140, 300)]:
        s += f'<path d="M {x} {y-12} L {x+3} {y-3} L {x+12} {y} L {x+3} {y+3} L {x} {y+12} L {x-3} {y+3} L {x-12} {y} L {x-3} {y-3} Z" fill="{WARM}" stroke="{ORANGE_D}" stroke-width="2"/>'
    return s


def tp(p, c, a):
    """Obrót punktu p wokół c o kąt a (stopnie, jak rotate() w SVG)."""
    import math as _m
    r = _m.radians(a)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * _m.cos(r) - y * _m.sin(r), c[1] + x * _m.sin(r) + y * _m.cos(r))


def sword_at(x, y):
    """Miecz energetyczny: rękojeść w punkcie (x, y), ostrze w górę."""
    blade = f"M {x-9:g} {y-14:g} L {x-10:g} {y-140:g} L {x:g} {y-168:g} L {x+10:g} {y-140:g} L {x+9:g} {y-14:g} Z"
    s = f'<path d="{blade}" fill="{TEAL}" opacity=".7" filter="url(#blur8)"/>'
    s += part(blade, TEAL_L, TEAL, sw=4, k=4)
    s += part(f"M {x-24:g} {y-22:g} L {x+24:g} {y-22:g} L {x+24:g} {y-10:g} L {x-24:g} {y-10:g} Z", SILVER, SILVER_D, sw=4, k=2)
    s += part(f"M {x-6:g} {y-12:g} L {x+6:g} {y-12:g} L {x+6:g} {y+22:g} L {x-6:g} {y+22:g} Z", NAVY, NAVY_D, sw=4, k=2)
    s += circle(x, y, 17, NAVY, sw=4)
    return s


def shield_at(x, y, r=62):
    import math as _m
    pts_ = [(x + r * _m.cos(_m.radians(a)), y + r * 1.1 * _m.sin(_m.radians(a))) for a in range(-90, 270, 60)]
    d = "M " + " L ".join(f"{a:.1f} {b:.1f}" for a, b in pts_) + " Z"
    s = f'<path d="{d}" fill="{TEAL}" opacity=".32"/>'
    s += f'<path d="{d}" fill="none" stroke="{TEAL_L}" stroke-width="7" stroke-linejoin="round" filter="url(#glow)"/>'
    inner = "M " + " L ".join(f"{x+(a-x)*.55:.1f} {y+(b-y)*.55:.1f}" for a, b in pts_) + " Z"
    s += f'<path d="{inner}" fill="none" stroke="{TEAL_L}" stroke-width="3" opacity=".7"/>'
    s += circle(x, y, 9, TEAL_L, sw=0, extra=' opacity=".9"')
    return s


# ---------------------------------------------------------------- poza
def aegis(pose="idle", parts=None, with_shadow=True, hide_missing=False, tilt=None, power=None):
    """Zwraca zawartość SVG (bez znacznika <svg>) w skali 400x600.

    pose: idle | wave | guard | damaged | off
    parts: zbiór części do narysowania (None = wszystkie) – do składania robota.
    """
    if power is None:
        power = pose not in ("off", "damaged")
    expr = {"idle": "calm", "wave": "happy", "guard": "determined", "damaged": "damaged", "off": "off",
            "protect": "determined", "hug": "happy", "ready": "determined"}[pose]
    if not power:
        expr = "off" if pose != "damaged" else expr

    # kąty rąk względem barku (lewa / prawa z punktu widzenia widza)
    la, lfa, ra, rfa = 6, 0, -6, 0
    if pose == "wave":
        ra, rfa = -120, -55
    elif pose == "guard":
        la, lfa, ra, rfa = 15, 145, -14, -150
    elif pose in ("damaged", "off"):
        la, ra = 2, -2
    elif pose == "protect":
        ra, rfa = -82, -8
    elif pose == "hug":
        la, lfa, ra, rfa = 28, -30, -28, 30
    elif pose == "ready":
        la, lfa, ra, rfa = 10, 0, -10, 0
    if tilt is None:
        tilt = {"damaged": 9, "off": 12}.get(pose, 0)

    def P(name, content):
        if parts is not None and name not in parts:
            if hide_missing:
                return ""
            return f'<g id="part-{name}" class="rg-part rg-missing">{content}</g>'
        return f'<g id="part-{name}" class="rg-part">{content}</g>'

    L_sh, R_sh = (124, 186), (276, 186)
    L_el, R_el = (124, 292), (276, 292)

    left_arm = g(P("upperarm-l", upperarm("l")) +
                 g(P("forearm-l", forearm("l", power=power)), rot(lfa, *L_el)),
                 rot(la, *L_sh))
    right_arm = g(P("upperarm-r", upperarm("r")) +
                  g(P("forearm-r", forearm("r", power=power)), rot(rfa, *R_el)),
                  rot(ra, *R_sh))

    head_g = g(P("head", antennas(power) + head(expr, power)), rot(tilt, 200, 150) if tilt else None)
    out = []
    if with_shadow:
        out.append(shadow(200, 586, 110, 13))
    out.append(P("shin-l", shin("l")))
    out.append(P("shin-r", shin("r")))
    out.append(P("thigh-l", thigh("l")))
    out.append(P("thigh-r", thigh("r")))
    out.append(P("pelvis", pelvis()))
    # ręka w pozie guard z mieczem idzie przed tułów – reszta za
    out.append(P("torso", neck() + torso(power)))
    out.append(left_arm)
    out.append(right_arm)
    out.append(P("shoulder-l", pauldron("l")))
    out.append(P("shoulder-r", pauldron("r")))
    out.append(head_g)
    if pose == "guard":
        hl_ = tp(tp((112, 398), L_el, lfa), L_sh, la)
        hr_ = tp(tp((288, 398), R_el, rfa), R_sh, ra)
        out.append(sword_at(*hr_))
        out.append(shield_at(*tp(tp((122, 340), L_el, lfa), L_sh, la)))
    if pose == "damaged":
        out.append(damage_marks())
    return "".join(out)


AEGIS_PARTS = ["torso", "head", "pelvis", "thigh-l", "thigh-r", "shin-l", "shin-r",
               "upperarm-l", "forearm-l", "upperarm-r", "forearm-r", "shoulder-l", "shoulder-r"]
