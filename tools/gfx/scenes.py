"""10 ilustracji do historii początkowej (1920x1080).
Kluczowe postacie w górnych 80% kadru, dół zostaje na polskie napisy."""
from lib import *
from aegis import aegis
from humans import human, MOM, DAD, LEO, MIA, item_tablet, item_wrench, item_ball
from aliens import kraken, drone
from backgrounds import (W, H, FLOOR, hangar, home_lab, terrace_night, city_night, manta, assembly_stand, crate)

RS = 1.12   # skala robota w scenach
HS = 1.0    # skala ludzi


def place(content, x, floor=FLOOR, sc=1.0, flip=False, extra=""):
    if flip:
        return f'<g transform="translate({x + 200*sc:g} {floor - 585*sc:g}) scale({-sc:g} {sc:g})"{extra}>{content}</g>'
    return f'<g transform="translate({x - 200*sc:g} {floor - 585*sc:g}) scale({sc:g})"{extra}>{content}</g>'


def vignette(op=.45, col="#000"):
    return (f'<radialGradient id="vig"><stop offset=".55" stop-color="{col}" stop-opacity="0"/><stop offset="1" stop-color="{col}" stop-opacity="{op}"/></radialGradient>'
            f'<rect width="{W}" height="{H}" fill="url(#vig)"/>')


def sparkle(x, y, r=14, col=TEAL_L):
    return f'<path d="M {x} {y-r} L {x+r*.25} {y-r*.25} L {x+r} {y} L {x+r*.25} {y+r*.25} L {x} {y+r} L {x-r*.25} {y+r*.25} L {x-r} {y} L {x-r*.25} {y-r*.25} Z" fill="{col}" filter="url(#glow)"/>'


def core_pos(x, floor=FLOOR, sc=RS):
    return x - 200 * sc + 200 * sc, floor - 585 * sc + 212 * sc


# --------------------------------------------------------------------- s01
def s01():
    bg, defs = home_lab()
    parts = {"torso", "head", "pelvis", "thigh-l", "thigh-r", "shin-l", "shin-r", "upperarm-l", "forearm-l", "shoulder-l", "shoulder-r"}
    c = [bg, assembly_stand(960, 150, FLOOR)]
    c.append(place(aegis("off", parts=parts, hide_missing=True, tilt=0, with_shadow=False), 960, sc=RS))
    # brakująca ręka leży na stole
    c.append(f'<g transform="translate({250 - 276*.6:g} {612 - 290*.6:g}) scale(.6) rotate(90 276 290)">' + aegis("off", parts={"upperarm-r", "forearm-r"}, hide_missing=True, with_shadow=False) + '</g>')
    c.append(place(human(MOM, "idle", item=item_tablet), 560))
    c.append(place(human(DAD, "idle", "determined", item=item_wrench), 1340))
    c.append(place(human(LEO, "point", "happy"), 300, flip=True))
    c.append(place(human(MIA, "idle", "happy"), 1590))
    c.append(sparkle(1215, 380, 18, WARM))
    c.append(sparkle(1240, 410, 10, WARM))
    return "".join(c), defs


# --------------------------------------------------------------------- s02
def s02():
    bg, defs = home_lab()
    c = [bg, assembly_stand(960, 150, FLOOR)]
    cx, cy = core_pos(960)
    c.append(f'<circle cx="{cx}" cy="{cy}" r="420" fill="{TEAL}" opacity=".22" filter="url(#blur20)"/>')
    for a in range(0, 360, 30):
        c.append(f'<path d="M {cx} {cy} L {cx + 900*__import__("math").cos(__import__("math").radians(a)):.0f} {cy + 900*__import__("math").sin(__import__("math").radians(a)):.0f}" stroke="{TEAL_L}" stroke-width="30" opacity=".08"/>')
    c.append(place(aegis("idle", with_shadow=False), 960, sc=RS))
    c.append(place(human(MOM, "scared", "happy"), 520))
    c.append(place(human(DAD, "idle", "happy", item=item_wrench), 1400))
    c.append(place(human(LEO, "wave", "happy"), 300, flip=True))
    c.append(place(human(MIA, "reach", "happy"), 1620))
    for (x, y) in [(860, 300), (1080, 260), (1110, 470), (820, 520)]:
        c.append(sparkle(x, y, 16))
    return "".join(c), defs


# --------------------------------------------------------------------- s03
def s03():
    bg, defs = home_lab()
    c = [bg]
    c.append(place(aegis("idle", tilt=-8), 700, sc=RS))
    c.append(place(human(LEO, "hold", "happy", item=item_ball), 1000))
    c.append(place(human(MIA, "point", "happy"), 1240))
    # dymek z „ball?”
    c.append(bubble(820, 150, "ball?"))
    return "".join(c), defs


def bubble(x, y, text):
    from textpath import text_path
    d, w = text_path(text, x, y + 12, 52, 600)
    bw = w + 70
    s = part(f"M {x - bw/2} {y - 46} L {x + bw/2} {y - 46} C {x + bw/2 + 22} {y - 46}, {x + bw/2 + 22} {y + 46}, {x + bw/2} {y + 46} L {x - 10} {y + 46} L {x - 40} {y + 80} L {x - 36} {y + 46} L {x - bw/2} {y + 46} C {x - bw/2 - 22} {y + 46}, {x - bw/2 - 22} {y - 46}, {x - bw/2} {y - 46} Z", "#fff", "#dfe7f0", k=5)
    return s + f'<path d="{d}" fill="{NAVY}"/>'


# --------------------------------------------------------------------- s04
def s04():
    bg, defs = terrace_night()
    c = [bg]
    c.append(place(aegis("hug"), 960, FLOOR - 20, sc=RS))
    c.append(place(human(LEO, "idle", "happy"), 860, FLOOR + 20))
    c.append(place(human(MIA, "idle", "happy"), 1070, FLOOR + 20))
    c.append(place(human(MOM, "idle", "happy"), 600, FLOOR - 10))
    c.append(place(human(DAD, "idle", "happy"), 1340, FLOOR - 10))
    c.append(sparkle(1250, 120, 12, "#fff"))
    return "".join(c), defs


# --------------------------------------------------------------------- s05
def s05():
    bg, defs = city_night(attack=True)
    c = [bg]
    c.append(manta(520, 200, .9))
    c.append(manta(1300, 140, 1.3))
    c.append(manta(1700, 330, .6))
    c.append(manta(240, 380, .45))
    c.append(place(aegis("ready"), 960, sc=RS * 1.05))
    return "".join(c), defs


# --------------------------------------------------------------------- s06
def s06():
    bg, defs = city_night(attack=True)
    c = [bg]
    c.append(manta(1350, 120, 1.1, beam=True, beam_len=640))
    c.append(place(human(MOM, "scared"), 330, FLOOR - 30, .92))
    c.append(place(human(DAD, "scared"), 500, FLOOR - 30, .92))
    c.append(place(human(LEO, "scared"), 410, FLOOR + 10, .92))
    c.append(place(human(MIA, "scared"), 590, FLOOR + 10, .92))
    c.append(place(aegis("protect"), 820, sc=RS))
    c.append(place(kraken("soldier", "aim"), 1300, FLOOR - 20, 1.0, flip=True))
    c.append(place(kraken("soldier", "idle"), 1560, FLOOR - 50, .85, flip=True))
    c.append(place(drone(), 1700, FLOOR - 330, .7))
    return "".join(c), defs


# --------------------------------------------------------------------- s07
def s07():
    bg, defs = city_night(attack=True)
    c = [bg]
    c.append(manta(1500, 110, .8))
    c.append(place(human(MOM, "scared"), 230, FLOOR - 40, .8))
    c.append(place(human(LEO, "scared"), 330, FLOOR, .8))
    c.append(place(human(MIA, "scared"), 440, FLOOR - 10, .8))
    c.append(place(human(DAD, "scared"), 140, FLOOR, .8))
    c.append(place(aegis("guard"), 760, sc=RS * 1.05))
    # strzały w tarczę
    for (x0, y0, x1, y1) in [(1250, 470, 660, 470), (1500, 300, 680, 430), (1400, 600, 680, 520)]:
        c.append(f'<path d="M {x0} {y0} L {x1} {y1}" stroke="{ACID}" stroke-width="10" stroke-linecap="round" filter="url(#glow)" opacity=".9"/>')
        c.append(f'<path d="M {x0} {y0} L {x1} {y1}" stroke="#f6ffe0" stroke-width="3" stroke-linecap="round"/>')
        c.append(sparkle(x1, y1, 22, ACID))
    c.append(place(kraken("soldier", "aim"), 1250, FLOOR - 20, 1.0, flip=True))
    c.append(place(kraken("commander", "idle"), 1580, FLOOR - 60, .95, flip=True))
    c.append(place(kraken("soldier", "aim"), 1820, FLOOR - 40, .8, flip=True))
    for (x, y, s_) in [(1450, 330, .55), (1700, 220, .5), (1150, 220, .45), (1820, 400, .45)]:
        c.append(place(drone(), x, y, s_))
    return "".join(c), defs


# --------------------------------------------------------------------- s08
def s08():
    bg, defs = city_night(attack=True)
    c = [bg]
    c.append(manta(1350, 150, 1.2, beam=True, beam_len=420))
    # rodzina unoszona w wiązce (mała, w oddali)
    for (x, y, who) in [(1290, 470, MOM), (1340, 500, LEO), (1385, 480, MIA), (1430, 455, DAD)]:
        c.append(place(human(who, "reach", "scared"), x, y, .28, extra=' opacity=".9"'))
    c.append(f'<rect x="1150" y="300" width="400" height="400" fill="{ACID}" opacity=".08"/>')
    # rozrzucone części robota
    off = lambda parts: aegis("off", parts=set(parts), hide_missing=True, with_shadow=False, tilt=0)
    c.append(shadow_ellipse(760, FLOOR + 6, 260, 26))
    c.append(f'<g transform="translate(520 400) scale({RS}) rotate(80 200 250)">' + off(["torso", "pelvis", "shoulder-l", "shoulder-r"]) + '</g>')
    c.append(f'<g transform="translate(880 590) scale(.95) rotate(-25 200 100)">' + off(["head"]) + '</g>')
    c.append(f'<g transform="translate(160 640) scale(.9) rotate(-95 124 290)">' + off(["upperarm-l", "forearm-l"]) + '</g>')
    c.append(f'<g transform="translate(1000 520) scale(.9) rotate(70 276 290)">' + off(["upperarm-r", "forearm-r"]) + '</g>')
    c.append(f'<g transform="translate(200 230) scale(.95) rotate(-70 170 460)">' + off(["thigh-l", "shin-l"]) + '</g>')
    c.append(f'<g transform="translate(330 260) scale(.95) rotate(-100 230 460)">' + off(["thigh-r", "shin-r"]) + '</g>')
    for (x, y) in [(640, 700), (950, 660), (420, 760)]:
        c.append(f'<circle cx="{x}" cy="{y}" r="60" fill="#2a2236" opacity=".6" filter="url(#blur20)"/>')
    c.append(vignette(.55))
    return "".join(c), defs


def shadow_ellipse(x, y, rx, ry, op=.4):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#000" opacity="{op}"/>'


def parts_on_floor(y=FLOOR, weak_core=False, ghost=False):
    off = lambda parts: aegis("off", parts=set(parts), hide_missing=True, with_shadow=False, tilt=0)
    c = []
    items = [
        (330, ["head"], .9, 0, (200, 100)),
        (560, ["torso", "pelvis", "shoulder-l", "shoulder-r"], .9, 0, (200, 260)),
        (1370, ["upperarm-l", "forearm-l"], .85, -90, (124, 290)),
        (1600, ["upperarm-r", "forearm-r"], .85, 90, (276, 290)),
        (1450, ["thigh-l", "shin-l"], .8, -90, (170, 460)),
        (1680, ["thigh-r", "shin-r"], .8, 90, (230, 460)),
    ]
    for (x, parts, sc, rotd, piv) in items:
        bottom = {"head": 155, "torso": 365}.get(parts[0], 0)
        if rotd == 0:
            ty = y - bottom * sc
            c.append(shadow_ellipse(x, y + 4, 120 * sc, 14))
            c.append(f'<g transform="translate({x - 200*sc:g} {ty:g}) scale({sc})">' + off(parts) + '</g>')
        else:
            row = 0 if "thigh" in parts[0] else 1
            yy = y - 30 - row * 80
            c.append(f'<g transform="translate({x - piv[0]*sc:g} {yy - piv[1]*sc:g}) scale({sc}) rotate({rotd} {piv[0]} {piv[1]})">' + off(parts) + '</g>')
    if weak_core:
        cx, cy = 560, y - 365 * .9 + 212 * .9
        c.append(f'<circle cx="{cx}" cy="{cy}" r="40" fill="{TEAL}" opacity=".5" filter="url(#blur8)"/>')
        c.append(circle(cx, cy, 8, TEAL_L, sw=0, extra=' filter="url(#glow)"'))
    return "".join(c)


# --------------------------------------------------------------------- s09
def s09():
    bg, defs = hangar(gate_open=False, frame=False, dim=True)
    c = [bg, parts_on_floor(FLOOR + 40, weak_core=True)]
    c.append(f'<path d="M 960 0 L 760 {FLOOR + 60} L 1160 {FLOOR + 60} Z" fill="#fff3d0" opacity=".06"/>')
    c.append(vignette(.6))
    return "".join(c), defs


# --------------------------------------------------------------------- s10
def s10():
    bg, defs = hangar()
    c = [bg]
    # hologram AEGIS-7 w stelażu
    holo = aegis("idle", with_shadow=False)
    c.append(f'<g opacity=".55" style="mix-blend-mode:screen">' + place(f'<g class="holo">{holo}</g>', 960, sc=RS) + '</g>')
    c.append(f'<style>.holo *{{fill:{TEAL}!important;fill-opacity:.12!important;stroke:{TEAL_L}!important;filter:none!important}}</style>')
    c.append(parts_on_floor(FLOOR + 60))
    for (x, y) in [(330, 650), (560, 520), (1450, 700), (1680, 700)]:
        c.append(sparkle(x, y, 14))
    return "".join(c), defs


SCENES = {"s01": s01, "s02": s02, "s03": s03, "s04": s04, "s05": s05,
          "s06": s06, "s07": s07, "s08": s08, "s09": s09, "s10": s10}
