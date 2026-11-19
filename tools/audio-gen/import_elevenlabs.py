"""Wstawia muzykę i efekty wygenerowane w ElevenLabs do assets/audio/ i aktualizuje manifest.

Pętle: koniec utworu przenika (crossfade) w jego początek, a plik dostaje zakładkę 0,5 s przed
loopStart i 1,5 s po loopEnd, więc gra bez przerwy w Web Audio (jak w build.py).

Użycie (z katalogu repo):
    python tools/audio-gen/import_elevenlabs.py <katalog z music/ i sfx/> [<katalog z theme_main.mp3, story_family.mp3>]
"""
import json
import os
import subprocess
import sys

import numpy as np

SR = 44100
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "audio")

# id: (tytuł, pętla, głośność w grze)
MUSIC = {
    "theme_main": ("Motyw główny AEGIS-7", True, 0.8),
    "story_creation": ("Stworzenie robota", True, 0.8),
    "story_family": ("Życie z rodziną", True, 0.8),
    "story_attack": ("Atak", True, 0.8),
    "story_crash": ("Rozbicie", True, 0.8),
    "story_hangar": ("Hangar – odbudowa", True, 0.8),
    "mission_calm": ("Misja – spokojnie", True, 0.55),
    "mission_action": ("Misja – akcja", True, 0.55),
    "assembly": ("Składanie części", True, 0.75),
    "reward_fanfare": ("Nagroda", False, 0.85),
    "level_complete": ("Misja ukończona", False, 0.85),
    "try_again": ("Spróbuj jeszcze raz", False, 0.8),
    "assembly_complete": ("Część zamontowana", False, 0.85),
}
SFX = {
    "click": ("Kliknięcie", 0.6), "correct": ("Dobra odpowiedź", 0.8), "wrong": ("Zła odpowiedź (łagodnie)", 0.7),
    "star": ("Gwiazdka", 0.8), "part_attach": ("Montaż części", 0.9), "power_up": ("Zasilanie", 0.8),
    "robot_beep": ("AEGIS-7 piszczy", 0.7), "whoosh": ("Przejście", 0.6), "unlock": ("Odblokowanie", 0.8),
    "level_up": ("Nowy poziom", 0.9), "typing": ("Pisanie tekstu", 0.4),
    "crash_impact": ("Uderzenie statku", 0.9), "alarm": ("Alarm (pętla)", 0.6),
    "signal_space": ("Sygnał z kosmosu", 0.8), "screw_drill": ("Wkrętarka", 0.8), "welding": ("Spawanie", 0.7),
    "metal_clank": ("Stuk metalu", 0.8), "servo": ("Serwo ramienia", 0.8),
    "hangar_ambience": ("Tło hangaru (pętla)", 0.5),
}
SFX_LOOPS = {"alarm", "hangar_ambience"}

XFADE = 3.0   # s, przenikanie końca w początek pętli
PRE, POST = 0.5, 1.5


def decode(path, ch=2):
    r = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", str(ch), "-ar", str(SR), "-"],
                       capture_output=True, check=True)
    return np.frombuffer(r.stdout, "<f4").reshape(-1, ch).T.copy()


def encode(x, path, bitrate):
    x = np.clip(x, -1, 1)
    pcm = (x.T * 32767).astype("<i2").tobytes()
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SR), "-ac", str(x.shape[0]),
                    "-i", "pipe:0", "-c:a", "libmp3lame", "-b:a", bitrate, path], input=pcm, check=True)


def trim(x, thr=10 ** (-50 / 20)):
    e = np.max(np.abs(x), axis=0)
    idx = np.nonzero(e > thr)[0]
    if not len(idx):
        return x
    return x[:, max(0, idx[0] - 200): idx[-1] + 1]


def trim_tail_for_loop(x, thr_db=-40.0, keep=0.4):
    """Utnij długie wybrzmienie na końcu, żeby pętla nie miała dziury ciszy."""
    w = int(0.25 * SR)
    m = x.mean(axis=0) ** 2
    env = 10 * np.log10(np.convolve(m, np.ones(w) / w, mode="same") + 1e-12)
    idx = np.nonzero(env > thr_db)[0]
    if not len(idx):
        return x
    end = min(x.shape[1], idx[-1] + int(keep * SR))
    start = max(0, idx[0] - int(0.05 * SR)) if env[: int(2 * SR)].max() > thr_db else 0
    return x[:, start:end]


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def make_loop(x, xfade=XFADE):
    n = x.shape[1]
    c = int(xfade * SR)
    t = np.linspace(0, np.pi / 2, c)
    fin, fout = np.sin(t), np.cos(t)  # równa moc (fragmenty nieskorelowane)
    body = x[:, : n - c].copy()
    body[:, :c] = x[:, :c] * fin + x[:, n - c:] * fout
    L = body.shape[1]
    ps, qs = int(PRE * SR), int(POST * SR)
    out = np.concatenate([body[:, L - ps:], body, body[:, :qs]], axis=1)
    return out, ps / SR, (ps + L) / SR


def main():
    src = sys.argv[1]
    extra = sys.argv[2] if len(sys.argv) > 2 else None
    man_path = os.path.join(OUT, "manifest.json")
    manifest = {"version": 2, "music": {}, "sfx": {}}
    # wspólna głośność muzyki: dopasuj do głośności motywu głównego
    for mid, (title, loop, vol) in MUSIC.items():
        p = os.path.join(src, "music", f"{mid}.mp3")
        if not os.path.exists(p) and extra:
            p = os.path.join(extra, f"{mid}.mp3")
        x = trim(decode(p))
        target = -16.0 if not loop else (-20.0 if mid.startswith("mission") else -18.0)
        x = x * 10 ** ((target - rms_db(x)) / 20)
        peak = np.max(np.abs(x))
        if peak > 0.95:
            x *= 0.95 / peak
        e = dict(file=f"music/{mid}.mp3", kind="music", title=title, loop=loop, volume=vol)
        if loop:
            x = trim_tail_for_loop(x)
            x, ls, le = make_loop(x, xfade=2.5)
            e.update(loopStart=round(ls, 6), loopEnd=round(le, 6))
        else:
            f = int(0.3 * SR)
            x[:, -f:] *= np.linspace(1, 0, f)
        e["duration"] = round(x.shape[1] / SR, 3)
        encode(x, os.path.join(OUT, "music", f"{mid}.mp3"), "128k")
        manifest["music"][mid] = e
        print(f"music {mid:18s} {x.shape[1] / SR:6.1f}s loop={loop}")
    for sid, (title, vol) in SFX.items():
        x = decode(os.path.join(src, "sfx", f"{sid}.mp3"))
        if sid not in SFX_LOOPS:
            x = trim(x, 10 ** (-55 / 20))
        x = x * (0.7 / (np.max(np.abs(x)) + 1e-9))
        e = dict(file=f"sfx/{sid}.mp3", kind="sfx", title=title, volume=vol)
        if sid in SFX_LOOPS:
            x, ls, le = make_loop(x, xfade=min(1.0, x.shape[1] / SR / 4))
            e.update(loop=True, loopStart=round(ls, 6), loopEnd=round(le, 6))
        else:
            f = min(int(0.02 * SR), x.shape[1])
            x[:, -f:] *= np.linspace(1, 0, f)
        e["duration"] = round(x.shape[1] / SR, 3)
        encode(x, os.path.join(OUT, "sfx", f"{sid}.mp3"), "96k")
        manifest["sfx"][sid] = e
        print(f"sfx   {sid:18s} {x.shape[1] / SR:6.2f}s")
    manifest["license"] = ("Muzyka i efekty wygenerowane w ElevenLabs (Eleven Music / Sound Effects) na planie Starter "
                           "na potrzeby darmowej gry Roboguardian English Quest. Nie do ponownej dystrybucji osobno.")
    with open(man_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("manifest:", man_path)


if __name__ == "__main__":
    main()
