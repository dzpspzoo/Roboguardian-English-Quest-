"""Generuje całą grafikę gry do assets/gfx/ i ilustracje historii do assets/story/img/.

Uruchom z katalogu repo:  python tools/gfx/build.py
Wymaga: Python 3.10+, fonttools, brotli (pip install fonttools brotli).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import svg  # noqa: E402
from aegis import aegis  # noqa: E402
from humans import human, FAMILY, item_tablet, item_wrench, item_ball  # noqa: E402
from aliens import kraken, drone  # noqa: E402
from backgrounds import BACKGROUNDS, W, H, FLOOR, hangar, manta  # noqa: E402
from scenes import SCENES, place, RS  # noqa: E402
import ui  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GFX = os.path.join(ROOT, "assets", "gfx")
STORY = os.path.join(ROOT, "assets", "story", "img")
manifest = {"version": 1, "scale": "Postacie: viewBox 400x600, podłoga y=585, środek x=200 (wspólna skala). Tła i sceny: 1920x1080.",
            "characters": {}, "backgrounds": {}, "story": {}, "icons": {}, "parts": {}, "ui": {}}


def write(rel_base, rel, content, group=None, key=None):
    path = os.path.join(rel_base, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    rel_repo = os.path.relpath(path, ROOT).replace(os.sep, "/")
    if group:
        manifest[group][key] = rel_repo
    return rel_repo


# ------------------------------------------------------------- AEGIS-7
for pose in ["idle", "wave", "guard", "protect", "ready", "hug", "damaged", "off"]:
    write(GFX, f"characters/aegis7/{pose}.svg", svg(aegis(pose), title=f"AEGIS-7 {pose}"), "characters", f"aegis7.{pose}")
write(GFX, "characters/aegis7/assembly.svg",
      svg(aegis("idle"), title="AEGIS-7 do składania: części mają id part-*; brakujące dostają klasę rg-missing"),
      "characters", "aegis7.assembly")

# ------------------------------------------------------------- rodzina Nova
items = {"mom": item_tablet, "dad": item_wrench, "leo": item_ball, "mia": item_ball}
for who, spec in FAMILY.items():
    for pose, expr in [("idle", None), ("happy", "happy"), ("wave", None), ("scared", None), ("point", None), ("hold", "happy")]:
        p = "idle" if pose == "happy" else pose
        it = items[who] if pose == "hold" else None
        if pose == "hold" and who in ("mom", "dad"):
            p = "idle"
        write(GFX, f"characters/{who}/{pose}.svg", svg(human(spec, p, expr, item=it), title=f"{who} {pose}"), "characters", f"{who}.{pose}")

# ------------------------------------------------------------- wszyscy razem (porównanie skali)
_line = aegis("idle")
for i, (who, dx) in enumerate([("mom", 250), ("dad", 470), ("leo", 680), ("mia", 850)]):
    _line += f'<g transform="translate({dx} 0)">' + human(FAMILY[who], "idle", "happy") + "</g>"
write(GFX, "characters/lineup.svg", svg(_line, 1250, 600, "AEGIS-7 i rodzina Nova"), "characters", "lineup")

# ------------------------------------------------------------- Krakeni
for pose in ["idle", "aim", "stunned"]:
    write(GFX, f"characters/kraken/{pose}.svg", svg(kraken("soldier", pose), title=f"Kraken {pose}"), "characters", f"kraken.{pose}")
for pose in ["idle", "aim"]:
    write(GFX, f"characters/kraken-commander/{pose}.svg", svg(kraken("commander", pose), title=f"Dowódca Krakenów {pose}"), "characters", f"kraken-commander.{pose}")
write(GFX, "characters/drone/idle.svg", svg(drone(), title="Dron Krakenów"), "characters", "drone.idle")
write(GFX, "characters/kraken-ship/idle.svg", svg(manta(300, 160, .95), 600, 300, "Statek Krakenów"), "characters", "kraken-ship.idle")

# ------------------------------------------------------------- tła
for key, fn in BACKGROUNDS.items():
    c, d = fn()
    write(GFX, f"backgrounds/{key}.svg", svg(c, W, H, key, d), "backgrounds", key)
c, d = hangar()
c += place(aegis("idle", with_shadow=False), 960, sc=RS)
write(GFX, "backgrounds/start.svg", svg(c, W, H, "Ekran startowy", d), "backgrounds", "start")

# ------------------------------------------------------------- historia
for key, fn in SCENES.items():
    c, d = fn()
    write(STORY, f"{key}.svg", svg(c, W, H, key, d), "story", key)

# ------------------------------------------------------------- interfejs
for name, body in ui.ICONS.items():
    write(GFX, f"ui/icons/{name}.svg", ui.icon(body), "icons", name)
for name in ui.PART_ICONS:
    write(GFX, f"ui/parts/{name}.svg", ui.part_icon(name), "parts", name)
for name in ["engines", "wings", "shield", "sword"]:
    write(GFX, f"ui/parts/{name}.svg", ui.extra_icon_svg(name), "parts", name)
write(GFX, "ui/logo.svg", ui.logo(), "ui", "logo")
manifest["ui"]["theme"] = "assets/gfx/theme.css"

with open(os.path.join(GFX, "manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)

big = []
for base in (GFX, STORY):
    for dp, _, fs in os.walk(base):
        for fn in fs:
            p = os.path.join(dp, fn)
            if os.path.getsize(p) > 400_000:
                big.append((p, os.path.getsize(p)))
print("Gotowe:", sum(len(v) for v in manifest.values() if isinstance(v, dict)), "plików")
if big:
    print("UWAGA, pliki > 400 KB:", big)
