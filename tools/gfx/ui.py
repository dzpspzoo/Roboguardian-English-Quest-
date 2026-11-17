"""Interfejs: ikony (24x24, kolor przez currentColor), ikony części robota,
logo gry."""
from lib import *
from aegis import aegis, sword_at, shield_at
from textpath import text_path


def icon(body, fill=False):
    f = 'fill="currentColor" stroke="none"' if fill else 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" {f}>{body}</svg>\n'


ICONS = {
    "play": '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
    "pause": '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    "load": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9 13l3 3 3-3"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>',
    "parent": '<circle cx="8" cy="6" r="2.5"/><path d="M4 20v-6a4 4 0 0 1 8 0v6"/><circle cx="17" cy="10" r="2"/><path d="M14 20v-3.5a3 3 0 0 1 6 0V20"/>',
    "profile": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "sound-on": '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    "sound-off": '<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    "music": '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    "listen": '<path d="M6 10a6 6 0 1 1 12 0c0 3-2 4-3 5.5S14 19 12 20a2.5 2.5 0 0 1-3-2"/><path d="M9.5 10a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3.5"/>',
    "replay": '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M10 9.5v5l4-2.5z" fill="currentColor"/>',
    "slow": '<path d="M3 16h15a3 3 0 0 0 3-3v-1"/><path d="M5 16a6 6 0 0 1 12 0"/><circle cx="20" cy="10" r="1.8"/><path d="M7 16v2.5M15 16v2.5"/><path d="M8 13l2-3 2 3 2-3"/>',
    "mic": '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    "keyboard": '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M6 13.5h.01M18 13.5h.01M9 14h6"/>',
    "pen": '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>',
    "star": '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    "star-filled": '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor"/>',
    "check": '<path d="M4.5 12.5l5 5L19.5 7"/>',
    "close": '<path d="M6 6l12 12M18 6L6 18"/>',
    "hint": '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    "home": '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    "back": '<path d="M15 5l-7 7 7 7"/>',
    "next": '<path d="M9 5l7 7-7 7"/>',
    "lock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    "unlock": '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    "trophy": '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 21h8M9.5 17h5"/>',
    "printer3d": '<path d="M4 3h16v4H4zM6 7v14M18 7v14M4 21h16"/><path d="M12 7v3M10 10h4l-2 3z"/><path d="M9 17h6v4H9z"/>',
    "fuel": '<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M3 21h14M5 10h10"/><path d="M15 8l3 2v7a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
    "shield": '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    "map": '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    "robot": '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5M3 12v3M21 12v3"/><circle cx="12" cy="3.5" r="1"/>',
    "chat": '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    "chart": '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    "download": '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    "heart": '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    "rocket": '<path d="M12 3c3 2 5 5.5 5 10l-2 3H9l-2-3c0-4.5 2-8 5-10z"/><circle cx="12" cy="10" r="2"/><path d="M9 16l-2.5 4M15 16l2.5 4M12 17v4"/>',
}


# ---------------------------------------------------------------- części robota (kolorowe)
PART_ICONS = {
    # nazwa: (części, viewBox)
    "head": ({"head"}, "120 -6 170 170"),
    "torso": ({"torso"}, "120 140 160 190"),
    "core": (None, "170 182 60 60"),
    "pelvis": ({"pelvis"}, "130 300 140 80"),
    "arm-left": ({"upperarm-l", "forearm-l", "shoulder-l"}, "50 128 140 300"),
    "arm-right": ({"upperarm-r", "forearm-r", "shoulder-r"}, "210 128 140 300"),
    "leg-left": ({"thigh-l", "shin-l"}, "90 335 140 260"),
    "leg-right": ({"thigh-r", "shin-r"}, "170 335 140 260"),
}


def part_icon(name):
    parts, vb = PART_ICONS[name]
    if name == "core":
        from aegis import core
        content = core(True)
    else:
        content = aegis("idle", parts=parts, hide_missing=True, with_shadow=False)
    x, y, w, h = map(float, vb.split())
    side = max(w, h)
    x -= (side - w) / 2
    y -= (side - h) / 2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:g} {y:g} {side:g} {side:g}" width="256" height="256">'
            f'<defs>{glow_defs()}</defs>{content}</svg>\n')


def extra_icon(name):
    """Części dodatkowe (nagrody): silniki, skrzydła, tarcza, miecz."""
    if name == "engines":
        s = ""
        for x in (150, 250):
            s += f'<path d="M {x-26} 300 L {x} 380 L {x+26} 300 Z" fill="{ORANGE_L}" filter="url(#glow)"/>'
            s += f'<path d="M {x-14} 300 L {x} 350 L {x+14} 300 Z" fill="#fff6c8"/>'
            s += part(f"M {x-40} 140 C {x-40} 110, {x+40} 110, {x+40} 140 L {x+34} 280 L {x-34} 280 Z", NAVY, NAVY_D)
            s += part(f"M {x-40} 150 L {x+40} 150 L {x+38} 190 L {x-38} 190 Z", ORANGE, ORANGE_D, sw=4, k=3)
            s += part(f"M {x-30} 276 L {x+30} 276 L {x+36} 304 L {x-36} 304 Z", SILVER, SILVER_D, sw=4, k=3)
        s += part("M 186 160 L 214 160 L 214 250 L 186 250 Z", NAVY_D, "#0f1a30", sw=4, k=2)
        return s, "80 90 240 300"
    if name == "wings":
        s = ""
        for sx in (-1, 1):
            d = f"M 200 200 L {200 + sx*160} 120 L {200 + sx*170} 150 L {200 + sx*120} 240 L {200 + sx*40} 260 Z"
            s += part(d, ORANGE, ORANGE_D, hl=ORANGE_L)
            s += part(f"M {200 + sx*60} 210 L {200 + sx*150} 150 L {200 + sx*110} 225 Z", SILVER, SILVER_D, sw=4, k=3)
            s += line(f"M {200 + sx*50} 245 L {200 + sx*130} 205", TEAL, 5, ' filter="url(#glow)"')
        s += circle(200, 225, 26, NAVY, sw=5)
        return s, "20 60 360 260"
    if name == "shield":
        return shield_at(200, 200, 110), "70 60 260 280"
    if name == "sword":
        return sword_at(200, 360), "120 170 160 230"
    raise KeyError(name)


def extra_icon_svg(name):
    content, vb = extra_icon(name)
    x, y, w, h = map(float, vb.split())
    side = max(w, h)
    x -= (side - w) / 2
    y -= (side - h) / 2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x:g} {y:g} {side:g} {side:g}" width="256" height="256">'
            f'<defs>{glow_defs()}</defs>{content}</svg>\n')


# ---------------------------------------------------------------- logo
def logo():
    Wl, Hl = 1200, 420
    s = []
    d1, w1 = text_path("ROBOGUARDIAN", 600, 210, 150, 700, spacing=0.01)
    s.append(f'<path d="{d1}" fill="{TEAL}" opacity=".55" filter="url(#blur20)"/>')
    s.append(f'<path d="{d1}" fill="none" stroke="{INK}" stroke-width="30" stroke-linejoin="round"/>')
    s.append(f'<path d="{d1}" fill="none" stroke="{NAVY}" stroke-width="20" stroke-linejoin="round"/>')
    s.append(f'<path d="{d1}" fill="url(#lgOr)"/>')
    # wstęga
    s.append(part("M 260 248 L 940 248 L 980 290 L 940 332 L 260 332 L 220 290 Z", NAVY, NAVY_D, sw=8, k=6))
    s.append(part("M 180 270 L 230 270 L 214 290 L 230 310 L 180 310 Z", ORANGE, ORANGE_D, sw=6, k=3))
    s.append(part("M 1020 270 L 970 270 L 986 290 L 970 310 L 1020 310 Z", ORANGE, ORANGE_D, sw=6, k=3))
    d2, w2 = text_path("ENGLISH QUEST", 600, 310, 64, 600, spacing=0.08)
    s.append(f'<path d="{d2}" fill="{TEAL_L}" filter="url(#glow)"/>')
    s.append(f'<path d="{d2}" fill="{TEAL_L}"/>')
    defs = (f'<linearGradient id="lgOr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{ORANGE_L}"/>'
            f'<stop offset=".55" stop-color="{ORANGE}"/><stop offset="1" stop-color="{ORANGE_D}"/></linearGradient>')
    return svg("".join(s), Wl, Hl, "Roboguardian English Quest", defs)
