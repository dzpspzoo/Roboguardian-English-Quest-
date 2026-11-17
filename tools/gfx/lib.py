"""Wspólne narzędzia i paleta grafiki Roboguardian English Quest.

Cała grafika gry powstaje z kodu (SVG), więc jest w 100% własna i można ją
publikować bez ograniczeń licencyjnych.
"""
import math
import re

# ---------------------------------------------------------------- paleta
INK = "#0d1424"          # kontur wszystkich postaci
NAVY = "#22345a"
NAVY_D = "#16213a"
NAVY_L = "#34507f"
ORANGE = "#f08a24"
ORANGE_D = "#bf5f14"
ORANGE_L = "#ffb764"
SILVER = "#d3dae3"
SILVER_D = "#97a3b3"
TEAL = "#3fe0d0"
TEAL_D = "#14998f"
TEAL_L = "#b9fff7"
WARM = "#ffcf6b"         # ciepłe światło domu
WARM_D = "#e39a3b"
ALIEN = "#6b2fa0"        # Krakeni
ALIEN_D = "#43186e"
ALIEN_L = "#9a5fd6"
ACID = "#9cff3a"         # oczy i broń Krakenów
ACID_D = "#4fa012"
METAL_A = "#2b2638"      # zbroja Krakenów
METAL_A_L = "#4a4360"
DANGER = "#ff4d5e"
SKY_NIGHT = "#0b1226"

SW = 5  # grubość konturu w skali postaci (400x600)

_uid = [0]


def uid(prefix="c"):
    _uid[0] += 1
    return f"{prefix}{_uid[0]}"


def reset_uid():
    _uid[0] = 0


# ---------------------------------------------------------------- ścieżki
_num = re.compile(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?")
_tok = re.compile(r"[MLCQSTHVZmlcqsthvz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?")


def mirror_d(d, cx=200):
    """Odbicie lustrzane ścieżki (tylko komendy absolutne M L C Q S T H V Z)."""
    out = []
    cmd = None
    nums = []

    def flush():
        if cmd is None:
            return
        if cmd in "MLCQST":
            for i in range(0, len(nums), 2):
                nums[i] = 2 * cx - nums[i]
        elif cmd == "H":
            for i in range(len(nums)):
                nums[i] = 2 * cx - nums[i]
        out.append(cmd + " " + " ".join(f"{n:g}" for n in nums))

    for t in _tok.findall(d):
        if t.isalpha():
            flush()
            if t.islower() and t != "z":
                raise ValueError("mirror_d obsługuje tylko komendy absolutne: " + t)
            cmd = t.upper()
            nums = []
        else:
            nums.append(float(t))
    flush()
    return " ".join(out)


def shift_d(d, dx, dy):
    out = []
    cmd = None
    nums = []

    def flush():
        if cmd is None:
            return
        if cmd in "MLCQST":
            for i in range(0, len(nums), 2):
                nums[i] += dx
                nums[i + 1] += dy
        elif cmd == "H":
            nums[:] = [n + dx for n in nums]
        elif cmd == "V":
            nums[:] = [n + dy for n in nums]
        out.append(cmd + " " + " ".join(f"{n:g}" for n in nums))

    for t in _tok.findall(d):
        if t.isalpha():
            flush()
            cmd = t.upper()
            nums = []
        else:
            nums.append(float(t))
    flush()
    return " ".join(out)


def pts(*p):
    """Wielokąt z punktów -> d."""
    return "M " + " L ".join(f"{x:g} {y:g}" for x, y in p) + " Z"


# ---------------------------------------------------------------- kształty
def part(d, light, dark=None, sw=SW, k=7, hl=None, extra=""):
    """Kształt z cieniowaniem 'cel shading': ciemny brzeg z prawej-dołu,
    jasny środek, kontur na wierzchu. Światło zawsze z lewej-góry."""
    if dark is None:
        return f'<path d="{d}" fill="{light}" stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round"{extra}/>'
    cid = uid()
    s = [f'<clipPath id="{cid}"><path d="{d}"/></clipPath>',
         f'<g clip-path="url(#{cid})"><path d="{d}" fill="{dark}"/>',
         f'<path d="{shift_d(d, -k, -k)}" fill="{light}"/>']
    if hl:
        s.append(f'<path d="{shift_d(d, -k * 2.4, -k * 2.4)}" fill="none" stroke="{hl}" stroke-width="{k*0.9:g}" opacity=".55" transform="translate({k*1.2:g} {k*1.2:g})"/>')
    s.append('</g>')
    s.append(f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round"{extra}/>')
    return "".join(s)


def limb(x1, y1, x2, y2, w, light, dark, sw=SW):
    """Kończyna jako gruba kreska z zaokrąglonymi końcami i konturem."""
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1
    nx, ny = dy / L, -dx / L  # normalna (w prawo od kierunku)
    o = w * 0.16
    return (f'<path d="M {x1:g} {y1:g} L {x2:g} {y2:g}" stroke="{INK}" stroke-width="{w + 2*sw:g}" stroke-linecap="round"/>'
            f'<path d="M {x1:g} {y1:g} L {x2:g} {y2:g}" stroke="{dark}" stroke-width="{w:g}" stroke-linecap="round"/>'
            f'<path d="M {x1 - abs(nx)*o - o*.3:g} {y1 - o*.3:g} L {x2 - abs(nx)*o - o*.3:g} {y2 - o*.3:g}" stroke="{light}" stroke-width="{w*0.62:g}" stroke-linecap="round"/>')


def line(d, color=INK, w=3, extra=""):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"{extra}/>'


def circle(cx, cy, r, fill, sw=SW, stroke=INK, extra=""):
    st = f' stroke="{stroke}" stroke-width="{sw}"' if sw else ""
    return f'<circle cx="{cx:g}" cy="{cy:g}" r="{r:g}" fill="{fill}"{st}{extra}/>'


def ellipse(cx, cy, rx, ry, fill, sw=SW, stroke=INK, extra=""):
    st = f' stroke="{stroke}" stroke-width="{sw}"' if sw else ""
    return f'<ellipse cx="{cx:g}" cy="{cy:g}" rx="{rx:g}" ry="{ry:g}" fill="{fill}"{st}{extra}/>'


def g(content, transform=None, extra=""):
    t = f' transform="{transform}"' if transform else ""
    return f"<g{t}{extra}>{content}</g>"


def rot(angle, cx, cy):
    return f"rotate({angle:g} {cx:g} {cy:g})"


def glow_defs():
    """Filtry świecenia wspólne dla wszystkich plików."""
    return ('<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">'
            '<feGaussianBlur stdDeviation="6" result="b"/>'
            '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
            '<filter id="blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>'
            '<filter id="blur20" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>')


def svg(content, w=400, h=600, title="", defs=""):
    t = f"<title>{title}</title>" if title else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{t}'
            f'<defs>{glow_defs()}{defs}</defs>{content}</svg>\n')


def shadow(cx=200, cy=585, rx=95, ry=12, op=0.35):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#000" opacity="{op}"/>'
