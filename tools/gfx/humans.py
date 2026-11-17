"""Rodzina Nova: mama i tata naukowcy, Leo i Mia (ok. 10 lat).

Ta sama skala co AEGIS-7 (400x600, podłoga y=585). Dorosły ~480 px, dziecko ~385 px,
robot ~580 px, więc postacie można stawiać obok siebie bez skalowania.
"""
import math
from lib import *

SKIN_A = ("#f4cfae", "#d9a283")   # jasna
SKIN_B = ("#c48a62", "#9a6441")   # śniada
COAT = ("#f4f7fb", "#c4cfdc")


def eye_pair(cx, cy, r, expr, sep=0.42):
    s = []
    ex = r * sep
    ey = cy - r * 0.02
    for sx in (-1, 1):
        x = cx + sx * ex
        if expr == "happy":
            s.append(line(f"M {x - r*.15:g} {ey + r*.02:g} Q {x:g} {ey - r*.16:g} {x + r*.15:g} {ey + r*.02:g}", INK, r * 0.09))
        else:
            s.append(ellipse(x, ey, r * 0.11, r * 0.15, INK, sw=0))
            s.append(circle(x + r * 0.04, ey - r * 0.05, r * 0.04, "#fff", sw=0))
        # brwi
        if expr == "scared":
            s.append(line(f"M {x - sx*r*.18:g} {ey - r*.24:g} L {x + sx*r*.14:g} {ey - r*.3:g}", INK, r * 0.07))
        elif expr == "determined":
            s.append(line(f"M {x - sx*r*.18:g} {ey - r*.32:g} L {x + sx*r*.14:g} {ey - r*.24:g}", INK, r * 0.07))
        else:
            s.append(line(f"M {x - r*.15:g} {ey - r*.27:g} Q {x:g} {ey - r*.34:g} {x + r*.15:g} {ey - r*.27:g}", INK, r * 0.065))
    return "".join(s)


def mouth(cx, cy, r, expr):
    y = cy + r * 0.42
    if expr == "happy":
        return f'<path d="M {cx - r*.22:g} {y - r*.04:g} Q {cx:g} {y + r*.26:g} {cx + r*.22:g} {y - r*.04:g} Z" fill="#7a2730" stroke="{INK}" stroke-width="{r*.06:g}" stroke-linejoin="round"/>'
    if expr == "scared":
        return ellipse(cx, y + r * .04, r * .1, r * .13, "#7a2730", sw=r * .06)
    if expr == "determined":
        return line(f"M {cx - r*.16:g} {y + r*.04:g} L {cx + r*.16:g} {y + r*.02:g}", INK, r * .07)
    return line(f"M {cx - r*.18:g} {y:g} Q {cx:g} {y + r*.14:g} {cx + r*.18:g} {y:g}", INK, r * .07)


def face(cx, cy, r, skin, expr, freckles=False, glasses=None, beard=None):
    s = []
    s.append(eye_pair(cx, cy, r, expr))
    # nos
    s.append(line(f"M {cx - r*.02:g} {cy + r*.08:g} Q {cx + r*.08:g} {cy + r*.2:g} {cx - r*.04:g} {cy + r*.22:g}", skin[1], r * .07))
    # rumieńce
    for sx in (-1, 1):
        s.append(ellipse(cx + sx * r * .58, cy + r * .25, r * .14, r * .08, "#ff8f7a", sw=0, extra=' opacity=".45"'))
    if freckles:
        for sx in (-1, 1):
            for (dx, dy) in [(.5, .12), (.62, .18), (.55, .24)]:
                s.append(circle(cx + sx * r * dx, cy + r * dy, r * .025, "#b0704a", sw=0))
    if beard:
        s.append(f'<path d="M {cx - r*.78:g} {cy + r*.05:g} C {cx - r*.75:g} {cy + r*1.05:g}, {cx + r*.75:g} {cy + r*1.05:g}, {cx + r*.78:g} {cy + r*.05:g} '
                 f'C {cx + r*.55:g} {cy + r*.35:g}, {cx + r*.3:g} {cy + r*.3:g}, {cx:g} {cy + r*.32:g} C {cx - r*.3:g} {cy + r*.3:g}, {cx - r*.55:g} {cy + r*.35:g}, {cx - r*.78:g} {cy + r*.05:g} Z" '
                 f'fill="{beard}" stroke="{INK}" stroke-width="{SW-1}" stroke-linejoin="round"/>')
    if beard:
        s.append(ellipse(cx, cy + r * .45, r * .3, r * .17, skin[0], sw=0))
    s.append(mouth(cx, cy, r, expr))
    if glasses:
        for sx in (-1, 1):
            s.append(circle(cx + sx * r * .42, cy - r * .02, r * .27, "none", sw=r * .07, stroke=glasses))
        s.append(line(f"M {cx - r*.15:g} {cy - r*.04:g} L {cx + r*.15:g} {cy - r*.04:g}", glasses, r * .07))
    return "".join(s)


def head(cx, cy, r, skin, expr="calm", hair_back="", hair_front="", **kw):
    s = [hair_back]
    for sx in (-1, 1):
        s.append(ellipse(cx + sx * r * .98, cy + r * .1, r * .17, r * .22, skin[0], sw=SW - 1))
    s.append(part(f"M {cx - r:g} {cy - r*.1:g} C {cx - r:g} {cy - r*1.15:g}, {cx + r:g} {cy - r*1.15:g}, {cx + r:g} {cy - r*.1:g} "
                  f"C {cx + r:g} {cy + r*.75:g}, {cx + r*.5:g} {cy + r:g}, {cx:g} {cy + r:g} C {cx - r*.5:g} {cy + r:g}, {cx - r:g} {cy + r*.75:g}, {cx - r:g} {cy - r*.1:g} Z",
                  skin[0], skin[1], k=r * .12))
    s.append(face(cx, cy, r, skin, expr, **kw))
    s.append(hair_front)
    return "".join(s)


def arm_pts(shoulder, upper, lower, a_up, a_low):
    """Zwraca łokieć i dłoń; kąty w stopniach od pionu (dodatnie = na zewnątrz w lewo)."""
    sx, sy = shoulder
    ex = sx - upper * math.sin(math.radians(a_up))
    ey = sy + upper * math.cos(math.radians(a_up))
    hx = ex - lower * math.sin(math.radians(a_low))
    hy = ey + lower * math.cos(math.radians(a_low))
    return (ex, ey), (hx, hy)


ARM_POSES = {
    # (lewy: górne, dolne), (prawy: górne, dolne) – kąty od pionu, dodatni = w stronę zewnętrzną
    "idle": ((10, 5), (10, 5)),
    "wave": ((10, 5), (120, 170)),
    "scared": ((35, 150), (35, 150)),
    "point": ((10, 5), (85, 95)),
    "hold": ((20, -60), (20, -60)),
    "hug": ((50, 80), (50, 80)),
    "reach": ((150, 165), (150, 165)),
}


def human(spec, pose="idle", expr=None, item=None):
    """spec: słownik z proporcjami i kolorami postaci (patrz niżej)."""
    expr = expr or {"wave": "happy", "scared": "scared", "point": "determined"}.get(pose, spec.get("expr", "calm"))
    k = spec["k"]                 # 1.0 = dorosły, ~0.8 = dziecko
    cx = 200
    ground = 585
    H = spec["height"]
    top = ground - H
    hr = spec["head_r"]
    hcy = top + hr * 1.05
    sh_y = hcy + hr + 14 * k
    hip_y = sh_y + spec["torso"]
    shw = spec["shoulder_w"]
    legw = spec["leg_w"]
    s = []
    s.append(shadow(200, 586, 70 * k + 20, 10))

    # nogi
    for sx in (-1, 1):
        x = cx + sx * (legw * .62)
        s.append(limb(x, hip_y, x + sx * 2, ground - 22, legw, *spec["legs"]))
        # but
        bx = x + sx * 6
        s.append(part(f"M {bx - 22*k:g} {ground - 30:g} L {bx + 18*k:g} {ground - 30:g} C {bx + 32*k:g} {ground - 24:g}, {bx + 34*k:g} {ground - 4:g}, {bx + 26*k:g} {ground - 2:g} L {bx - 24*k:g} {ground - 2:g} Z"
                      if sx > 0 else
                      f"M {bx + 22*k:g} {ground - 30:g} L {bx - 18*k:g} {ground - 30:g} C {bx - 32*k:g} {ground - 24:g}, {bx - 34*k:g} {ground - 4:g}, {bx - 26*k:g} {ground - 2:g} L {bx + 24*k:g} {ground - 2:g} Z",
                      *spec["shoes"], sw=SW - 1, k=4))
    # ręce – za tułowiem
    lpose, rpose = ARM_POSES[pose]
    arms = []
    for sx, (au, al) in ((-1, lpose), (1, rpose)):
        shx = cx + sx * (shw / 2 - 10 * k)
        sh = (shx, sh_y + 10 * k)
        if sx > 0:
            au, al = -au, -al
        el, ha = arm_pts(sh, spec["arm_up"], spec["arm_low"], au, al)
        a = limb(sh[0], sh[1], el[0], el[1], spec["arm_w"], *spec["sleeve"])
        a += limb(el[0], el[1], ha[0], ha[1], spec["arm_w"] * .92, *spec["sleeve"])
        a += circle(ha[0], ha[1], spec["arm_w"] * .55, spec["skin"][0], sw=SW - 1)
        arms.append((a, ha))
    front_arms = pose in ("scared", "hold", "hug")
    if not front_arms:
        s.extend(a for a, _ in arms)
    # tułów
    s.append(spec["torso_fn"](cx, sh_y, hip_y, shw, k))
    if front_arms:
        s.extend(a for a, _ in arms)
    # szyja + głowa
    s.append(limb(cx, hcy + hr * .7, cx, sh_y + 4, hr * .42, *spec["skin"]))
    s.append(spec["collar_fn"](cx, sh_y, k) if spec.get("collar_fn") else "")
    s.append(head(cx, hcy, hr, spec["skin"], expr, spec["hair_back"](cx, hcy, hr), spec["hair_front"](cx, hcy, hr), **spec.get("face", {})))
    if item:
        s.append(item(arms))
    return "".join(s)


# ---------------------------------------------------------------- stroje
def coat_torso(inner, inner_d):
    def f(cx, sy, hy, w, k):
        hw = w / 2
        s = part(f"M {cx - hw:g} {sy + 8:g} C {cx - hw*.6:g} {sy - 6:g}, {cx + hw*.6:g} {sy - 6:g}, {cx + hw:g} {sy + 8:g} "
                 f"L {cx + hw + 6:g} {hy + 95:g} L {cx - hw - 6:g} {hy + 95:g} Z", *COAT)
        s += part(f"M {cx - 22:g} {sy - 2:g} L {cx + 22:g} {sy - 2:g} L {cx + 16:g} {hy + 10:g} L {cx - 16:g} {hy + 10:g} Z", inner, inner_d, sw=4, k=4)
        s += line(f"M {cx - 22:g} {sy:g} L {cx - 6:g} {sy + 70:g} M {cx + 22:g} {sy:g} L {cx + 6:g} {sy + 70:g}", INK, 4)
        s += line(f"M {cx - hw + 14:g} {hy - 10:g} L {cx - hw + 40:g} {hy - 10:g}", COAT[1], 4)
        s += line(f"M {cx + hw - 40:g} {hy - 10:g} L {cx + hw - 14:g} {hy - 10:g}", COAT[1], 4)
        # identyfikator
        s += part(f"M {cx + 30:g} {sy + 30:g} L {cx + 52:g} {sy + 30:g} L {cx + 52:g} {sy + 58:g} L {cx + 30:g} {sy + 58:g} Z", TEAL, TEAL_D, sw=3, k=2)
        return s
    return f


def hoodie_torso(col, col_d, emblem=True):
    def f(cx, sy, hy, w, k):
        hw = w / 2
        s = part(f"M {cx - hw:g} {sy + 8:g} C {cx - hw*.6:g} {sy - 8:g}, {cx + hw*.6:g} {sy - 8:g}, {cx + hw:g} {sy + 8:g} "
                 f"L {cx + hw - 4:g} {hy + 6:g} C {cx + hw*.4:g} {hy + 14:g}, {cx - hw*.4:g} {hy + 14:g}, {cx - hw + 4:g} {hy + 6:g} Z", col, col_d)
        s += line(f"M {cx - hw + 8:g} {hy - 4:g} L {cx + hw - 8:g} {hy - 4:g}", col_d, 5)
        if emblem:
            r = 14 * k + 4
            p_ = [(cx + r * math.cos(math.radians(a)), sy + 45 * k + r * math.sin(math.radians(a))) for a in range(-90, 270, 60)]
            s += f'<path d="{pts(*p_)}" fill="{TEAL}" stroke="{INK}" stroke-width="4" stroke-linejoin="round"/>'
            s += circle(cx, sy + 45 * k, r * .38, TEAL_L, sw=0)
        return s
    return f


def jacket_torso(col, col_d, stripe):
    def f(cx, sy, hy, w, k):
        hw = w / 2
        s = part(f"M {cx - hw:g} {sy + 8:g} C {cx - hw*.6:g} {sy - 8:g}, {cx + hw*.6:g} {sy - 8:g}, {cx + hw:g} {sy + 8:g} "
                 f"L {cx + hw - 2:g} {hy + 8:g} L {cx - hw + 2:g} {hy + 8:g} Z", col, col_d)
        s += line(f"M {cx:g} {sy + 4:g} L {cx:g} {hy + 6:g}", INK, 3.5)
        s += line(f"M {cx - hw + 6:g} {sy + 40:g} L {cx - hw + 6:g} {hy:g} M {cx + hw - 6:g} {sy + 40:g} L {cx + hw - 6:g} {hy:g}", stripe, 6)
        s += part(f"M {cx - 26:g} {sy - 4:g} L {cx:g} {sy + 18:g} L {cx + 26:g} {sy - 4:g} L {cx + 20:g} {sy + 8:g} L {cx:g} {sy + 26:g} L {cx - 20:g} {sy + 8:g} Z", col_d, col_d, sw=4)
        return s
    return f


# ---------------------------------------------------------------- fryzury
def hair_mom(cx, cy, r):
    back = part(f"M {cx - r*1.08:g} {cy:g} C {cx - r*1.2:g} {cy - r*1.3:g}, {cx + r*1.2:g} {cy - r*1.3:g}, {cx + r*1.08:g} {cy:g} L {cx + r*1.05:g} {cy + r*.9:g} L {cx - r*1.05:g} {cy + r*.9:g} Z", "#4a2a1c", "#2e1a12")
    back += circle(cx, cy - r * 1.18, r * .42, "#4a2a1c", sw=SW)
    front = part(f"M {cx - r*1.02:g} {cy - r*.05:g} C {cx - r*1.05:g} {cy - r*1.15:g}, {cx + r*.4:g} {cy - r*1.35:g}, {cx + r*1.02:g} {cy - r*.4:g} "
                 f"C {cx + r*.5:g} {cy - r*.75:g}, {cx - r*.1:g} {cy - r*.55:g}, {cx - r*.35:g} {cy - r*.85:g} C {cx - r*.55:g} {cy - r*.5:g}, {cx - r*.8:g} {cy - r*.4:g}, {cx - r*1.02:g} {cy - r*.05:g} Z", "#5c3524", "#3a2116")
    return back, front


def hair_dad(cx, cy, r):
    back = ""
    front = part(f"M {cx - r*1.02:g} {cy - r*.05:g} C {cx - r*1.1:g} {cy - r*1.3:g}, {cx + r*1.1:g} {cy - r*1.3:g}, {cx + r*1.02:g} {cy - r*.05:g} "
                 f"C {cx + r*.85:g} {cy - r*.55:g}, {cx + r*.5:g} {cy - r*.62:g}, {cx:g} {cy - r*.6:g} C {cx - r*.5:g} {cy - r*.62:g}, {cx - r*.85:g} {cy - r*.55:g}, {cx - r*1.02:g} {cy - r*.05:g} Z", "#a07a45", "#6e5230")
    # gogle na czole
    front += part(f"M {cx - r*.95:g} {cy - r*.62:g} L {cx + r*.95:g} {cy - r*.62:g} L {cx + r*.95:g} {cy - r*.42:g} L {cx - r*.95:g} {cy - r*.42:g} Z", ORANGE, ORANGE_D, sw=4, k=2)
    for sx in (-1, 1):
        front += ellipse(cx + sx * r * .38, cy - r * .58, r * .26, r * .2, TEAL, sw=4)
        front += circle(cx + sx * r * .38 - r * .08, cy - r * .63, r * .06, TEAL_L, sw=0)
    return back, front


def hair_leo(cx, cy, r):
    spikes = []
    n = 7
    for i in range(n + 1):
        a = math.radians(200 + i * (140 / n))
        rr = r * (1.25 if i % 2 else 1.02)
        spikes.append((cx + rr * math.cos(a), cy - r * .15 + rr * math.sin(a)))
    d = "M " + f"{cx - r*1.03:g} {cy + r*.05:g} " + " ".join(f"L {x:.1f} {y:.1f}" for x, y in spikes) + \
        f" L {cx + r*1.03:g} {cy + r*.05:g} C {cx + r*.8:g} {cy - r*.45:g}, {cx + r*.3:g} {cy - r*.55:g}, {cx - r*.1:g} {cy - r*.42:g} C {cx - r*.5:g} {cy - r*.6:g}, {cx - r*.9:g} {cy - r*.4:g}, {cx - r*1.03:g} {cy + r*.05:g} Z"
    return "", part(d, "#7a4626", "#4f2b15")


def hair_mia(cx, cy, r):
    back = part(f"M {cx + r*.7:g} {cy - r*.7:g} C {cx + r*1.9:g} {cy - r*.9:g}, {cx + r*1.8:g} {cy + r*.9:g}, {cx + r*1.35:g} {cy + r*1.5:g} "
                f"C {cx + r*1.3:g} {cy + r*.6:g}, {cx + r*1.1:g} {cy - r*.1:g}, {cx + r*.7:g} {cy - r*.3:g} Z", "#c1592a", "#8a3a17")
    back += circle(cx + r * .95, cy - r * .68, r * .16, TEAL, sw=4)
    front = part(f"M {cx - r*1.03:g} {cy + r*.1:g} C {cx - r*1.15:g} {cy - r*1.3:g}, {cx + r*1.15:g} {cy - r*1.3:g}, {cx + r*1.03:g} {cy + r*.05:g} "
                 f"C {cx + r*.7:g} {cy - r*.55:g}, {cx + r*.1:g} {cy - r*.45:g}, {cx - r*.2:g} {cy - r*.7:g} C {cx - r*.4:g} {cy - r*.35:g}, {cx - r*.8:g} {cy - r*.35:g}, {cx - r*1.03:g} {cy + r*.1:g} Z", "#d0632f", "#9a4119")
    # gogle na głowie
    front += part(f"M {cx - r*.9:g} {cy - r*.82:g} C {cx - r*.4:g} {cy - r*1.1:g}, {cx + r*.4:g} {cy - r*1.1:g}, {cx + r*.9:g} {cy - r*.82:g} L {cx + r*.85:g} {cy - r*.66:g} C {cx + r*.4:g} {cy - r*.92:g}, {cx - r*.4:g} {cy - r*.92:g}, {cx - r*.85:g} {cy - r*.66:g} Z", NAVY, NAVY_D, sw=4, k=2)
    for sx in (-1, 1):
        front += ellipse(cx + sx * r * .36, cy - r * .9, r * .24, r * .17, ORANGE, sw=4)
    return back, front


def _hb(fn):
    return lambda cx, cy, r: fn(cx, cy, r)[0]


def _hf(fn):
    return lambda cx, cy, r: fn(cx, cy, r)[1]


# ---------------------------------------------------------------- przedmioty
def item_tablet(arms):
    (_, ha) = arms[1]
    x, y = ha
    return (part(f"M {x - 34:g} {y - 46:g} L {x + 10:g} {y - 52:g} L {x + 14:g} {y + 6:g} L {x - 30:g} {y + 12:g} Z", NAVY_D, "#0b1424", sw=4, k=2) +
            f'<path d="M {x - 27:g} {y - 39:g} L {x + 4:g} {y - 43:g} L {x + 7:g} {y - 1:g} L {x - 24:g} {y + 3:g} Z" fill="{TEAL}" opacity=".9"/>' +
            line(f"M {x - 20:g} {y - 28:g} L {x:g} {y - 31:g} M {x - 19:g} {y - 18:g} L {x - 4:g} {y - 20:g}", TEAL_L, 3) +
            circle(x, y, 13, SKIN_A[0], sw=4))


def item_wrench(arms):
    (_, ha) = arms[1]
    x, y = ha
    return (f'<g transform="rotate(-30 {x:g} {y:g})">' +
            part(f"M {x - 7:g} {y - 70:g} L {x + 7:g} {y - 70:g} L {x + 7:g} {y + 18:g} L {x - 7:g} {y + 18:g} Z", SILVER, SILVER_D, sw=4, k=3) +
            part(f"M {x - 20:g} {y - 92:g} L {x - 8:g} {y - 92:g} L {x - 6:g} {y - 80:g} L {x + 6:g} {y - 80:g} L {x + 8:g} {y - 92:g} L {x + 20:g} {y - 92:g} L {x + 16:g} {y - 66:g} L {x - 16:g} {y - 66:g} Z", SILVER, SILVER_D, sw=4, k=3) +
            '</g>' + circle(x, y, 13, SKIN_A[0], sw=4))


def item_ball(arms):
    (_, ha) = arms[1]
    x, y = ha[0] + 8, ha[1] - 30
    return (circle(x, y, 30, "#ff5a6e", sw=SW) +
            f'<path d="M {x - 30:g} {y:g} C {x - 10:g} {y - 12:g}, {x + 10:g} {y + 12:g}, {x + 30:g} {y:g}" fill="none" stroke="#fff" stroke-width="7"/>' +
            f'<path d="M {x - 30:g} {y:g} C {x - 10:g} {y - 12:g}, {x + 10:g} {y + 12:g}, {x + 30:g} {y:g}" fill="none" stroke="{INK}" stroke-width="2" opacity=".3"/>' +
            circle(ha[0], ha[1], 11, SKIN_A[0], sw=4))


# ---------------------------------------------------------------- postacie
MOM = dict(k=1.0, height=480, head_r=44, torso=135, shoulder_w=112, leg_w=30, arm_w=24, arm_up=82, arm_low=78,
           skin=SKIN_A, legs=(NAVY_L, NAVY), shoes=(ORANGE, ORANGE_D), sleeve=COAT,
           torso_fn=coat_torso(TEAL, TEAL_D), hair_back=_hb(hair_mom), hair_front=_hf(hair_mom),
           face=dict(glasses=TEAL_D))
DAD = dict(k=1.05, height=500, head_r=46, torso=140, shoulder_w=128, leg_w=34, arm_w=27, arm_up=86, arm_low=80,
           skin=SKIN_A, legs=("#5b6b84", "#3e4b60"), shoes=(NAVY_L, NAVY), sleeve=COAT,
           torso_fn=coat_torso(ORANGE, ORANGE_D), hair_back=_hb(hair_dad), hair_front=_hf(hair_dad),
           face=dict(beard="#8a6a3e"))
LEO = dict(k=0.82, height=385, head_r=48, torso=98, shoulder_w=96, leg_w=27, arm_w=22, arm_up=58, arm_low=54,
           skin=SKIN_A, legs=(NAVY_L, NAVY), shoes=("#f4f7fb", "#b9c5d3"), sleeve=(ORANGE, ORANGE_D),
           torso_fn=hoodie_torso(ORANGE, ORANGE_D), hair_back=_hb(hair_leo), hair_front=_hf(hair_leo),
           face=dict(freckles=True))
MIA = dict(k=0.8, height=375, head_r=47, torso=95, shoulder_w=92, leg_w=25, arm_w=21, arm_up=56, arm_low=52,
           skin=("#ecc09b", "#cf9472"), legs=(NAVY_L, NAVY), shoes=(ORANGE, ORANGE_D), sleeve=(TEAL, TEAL_D),
           torso_fn=jacket_torso(TEAL, TEAL_D, ORANGE), hair_back=_hb(hair_mia), hair_front=_hf(hair_mia))

FAMILY = {"mom": MOM, "dad": DAD, "leo": LEO, "mia": MIA}
