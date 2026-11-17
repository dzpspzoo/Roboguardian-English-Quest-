"""Generuje całą muzykę i efekty do assets/audio/ oraz manifest.

Użycie (z katalogu repo):  python tools/audio-gen/build.py [id ...]
Wymaga: python3, numpy, scipy, ffmpeg (z libmp3lame).
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import synth as S  # noqa: E402
import music  # noqa: E402
import sfx  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "audio")

# głośność bazowa (RMS docelowe w dBFS) i domyślna głośność w grze
MUSIC_INFO = {
    "theme_main": dict(rms=-18, volume=0.8, title="Motyw główny AEGIS-7"),
    "story_creation": dict(rms=-20, volume=0.8, title="Stworzenie robota"),
    "story_family": dict(rms=-20, volume=0.8, title="Życie z rodziną"),
    "story_attack": dict(rms=-18, volume=0.8, title="Atak"),
    "story_crash": dict(rms=-21, volume=0.8, title="Rozbicie"),
    "story_hangar": dict(rms=-20, volume=0.8, title="Hangar – odbudowa"),
    "mission_calm": dict(rms=-21, volume=0.6, title="Misja – spokojnie"),
    "mission_action": dict(rms=-20, volume=0.6, title="Misja – akcja"),
    "reward_fanfare": dict(rms=-17, volume=0.9, title="Nagroda"),
    "level_complete": dict(rms=-17, volume=0.9, title="Misja ukończona"),
    "try_again": dict(rms=-19, volume=0.8, title="Spróbuj jeszcze raz"),
}
SFX_INFO = {
    "click": ("Kliknięcie", 0.6), "correct": ("Dobra odpowiedź", 0.8), "wrong": ("Zła odpowiedź (łagodnie)", 0.7),
    "star": ("Gwiazdka", 0.8), "part_attach": ("Montaż części", 0.9), "power_up": ("Zasilanie", 0.8),
    "robot_beep": ("AEGIS-7 piszczy", 0.7), "whoosh": ("Przejście", 0.6), "unlock": ("Odblokowanie", 0.8),
    "level_up": ("Nowy poziom", 0.9), "typing": ("Pisanie tekstu", 0.4),
    "crash_impact": ("Uderzenie statku", 0.9), "alarm": ("Alarm (pętla)", 0.6),
    "signal_space": ("Sygnał z kosmosu", 0.8),
}


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def write_mp3(x, path, bitrate="128k", mono=False):
    x = np.clip(x, -1, 1)
    if mono and x.ndim == 2:
        x = x.mean(axis=0)
    if x.ndim == 1:
        x = x[None, :]
    pcm = (x.T * 32767).astype("<i2").tobytes()
    ch = x.shape[0]
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(S.SR), "-ac", str(ch),
           "-i", "pipe:0", "-c:a", "libmp3lame", "-b:a", bitrate, path]
    subprocess.run(cmd, input=pcm, check=True)


def build_music(ids):
    entries = {}
    for mid in ids:
        song, loop = music.SONGS[mid]()
        x, ls, le = song.render(loop=loop)
        info = MUSIC_INFO[mid]
        # normalizacja do RMS i miękki limiter (bez pamięci, więc pętla zostaje okresowa)
        x = x * 10 ** ((info["rms"] - rms_db(x)) / 20)
        x = S.soft_limit(x, 0.93)
        if not loop:
            fade = S.nsamp(0.004)
            x[:, :fade] *= np.linspace(0, 1, fade)
        path = os.path.join(OUT, "music", f"{mid}.mp3")
        write_mp3(x, path, "128k")
        e = dict(file=f"music/{mid}.mp3", kind="music", title=info["title"], loop=loop,
                 volume=info["volume"], duration=round(x.shape[1] / S.SR, 3))
        if loop:
            e.update(loopStart=round(ls, 6), loopEnd=round(le, 6), bpm=song.bpm)
        entries[mid] = e
        print(f"music {mid:16s} {x.shape[1] / S.SR:6.1f}s  peak {np.max(np.abs(x)):.2f}  rms {rms_db(x):.1f} dB")
    return entries


def build_sfx(ids):
    entries = {}
    for sid in ids:
        x = sfx.SFX[sid]()
        if x.ndim == 1:
            x = x[None, :]
        peak = np.max(np.abs(x))
        x = x * (0.7 / peak)
        # przytnij ciszę na końcu (poniżej -60 dBFS)
        idx = np.nonzero(np.max(np.abs(x), axis=0) > 0.001)[0]
        x = x[:, : idx[-1] + 1]  # szczyt ok. -3 dBFS
        fade = min(S.nsamp(0.01), x.shape[1])
        x[:, -fade:] *= np.linspace(1, 0, fade)
        stereo_out = x.shape[0] == 2
        path = os.path.join(OUT, "sfx", f"{sid}.mp3")
        write_mp3(x, path, "96k" if stereo_out else "64k")
        title, vol = SFX_INFO[sid]
        e = dict(file=f"sfx/{sid}.mp3", kind="sfx", title=title, volume=vol,
                 duration=round(x.shape[1] / S.SR, 3))
        if sid == "alarm":
            e["loop"] = True
        entries[sid] = e
        print(f"sfx   {sid:16s} {x.shape[1] / S.SR:6.2f}s")
    return entries


def main():
    want = set(sys.argv[1:])
    os.makedirs(os.path.join(OUT, "music"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "sfx"), exist_ok=True)
    man_path = os.path.join(OUT, "manifest.json")
    manifest = {"version": 1, "music": {}, "sfx": {}}
    if os.path.exists(man_path):
        with open(man_path, encoding="utf-8") as f:
            manifest = json.load(f)
    mids = [m for m in music.SONGS if not want or m in want]
    sids = [s for s in sfx.SFX if not want or s in want]
    manifest["music"].update(build_music(mids))
    manifest["sfx"].update(build_sfx(sids))
    manifest["music"] = {k: manifest["music"][k] for k in music.SONGS if k in manifest["music"]}
    manifest["sfx"] = {k: manifest["sfx"][k] for k in sfx.SFX if k in manifest["sfx"]}
    manifest["license"] = "Muzyka i efekty skomponowane i wygenerowane dla Roboguardian English Quest (tools/audio-gen). CC BY 4.0."
    with open(man_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("manifest:", man_path)


if __name__ == "__main__":
    main()
