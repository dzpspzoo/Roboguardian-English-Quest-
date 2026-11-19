"""Składa wszystkie filmy fabularne gry w jeden plik MP4 do obejrzenia: wideo scen,
lektor, muzyka (ściszana pod lektorem), efekty i wypalone polskie napisy.
Taki sam rytm jak w src/story/player.js (wejście sceny, przerwy między zdaniami).

python tools/montaz_filmow.py WYJŚCIE.mp4 [intro meanwhile review quiz finale]
Wymaga ffmpeg i numpy. Uruchamiać z katalogu gry.
"""
import json, pathlib, subprocess, sys, tempfile
import numpy as np

ROOT = pathlib.Path.cwd()
SR = 48000
LEAD, GAP, TAIL = 1.1, 0.6, 0.9          # jak SCENE_LEAD / LINE_GAP / SCENE_GAP w player.js
CARD = 3.0                               # plansza tytułowa filmu (s)
MUSIC_GAIN, DUCK, SFX_GAIN, FADE = 0.8 * 0.49, 0.35, 0.64, 1.2
TITLES = {"intro": "Intro: AEGIS-7", "meanwhile": "Tymczasem…", "review": "Misja specjalna: podsumowanie",
          "quiz": "Misja specjalna: przed kartkówką", "finale": "Finał rozdziału 1"}

out = pathlib.Path(sys.argv[1])
films = sys.argv[2:] or ["intro", "meanwhile", "review", "quiz", "finale"]
manifest = json.loads((ROOT / "assets/audio/manifest.json").read_text(encoding="utf-8"))
tmp = pathlib.Path(tempfile.mkdtemp(prefix="montaz_"))


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def dur(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]))


def ass_time(t):
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def ass_text(t):
    return t.replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ")


# ---- oś czasu ----
segments, lines, sfx_events, music_spans, subs = [], [], [], [], []
t = 0.0
for film in films:
    data = json.loads((ROOT / f"src/story/{film}.json").read_text(encoding="utf-8"))
    segments.append(("card", None, CARD)); subs.append((t + 0.3, t + CARD - 0.3, "Tytul", TITLES.get(film, film)))
    t += CARD
    for s in data["scenes"]:
        start = t; cur = t + LEAD
        for l in s["lines"]:
            a = ROOT / l["audio"]
            d = dur(a) if a.exists() else len(l["en"]) / 15 + 0.5
            if a.exists(): lines.append((cur, a))
            style = "Aegis" if l["speaker"] == "aegis" else "Napis"
            txt = ("AEGIS-7: " if l["speaker"] == "aegis" else "") + l["pl"]
            subs.append((cur, cur + d, style, txt))
            cur += d + GAP
        end = cur - GAP + TAIL
        for e in s.get("sfx", []):
            if e["id"] in manifest["sfx"]:
                sfx_events.append((start + (0 if e.get("loop") else e.get("at", 0) / 1000), e["id"], end if e.get("loop") else None))
        if s.get("music"):
            if music_spans and music_spans[-1][0] == s["music"] and abs(music_spans[-1][2] - start) < 1e-6:
                music_spans[-1][2] = end
            else:
                music_spans.append([s["music"], start, end])
        video = ROOT / s.get("video", "")
        segments.append(("video" if s.get("video") and video.exists() else "image", video if s.get("video") and video.exists() else ROOT / s["image"], end - start))
        t = end
total = t
print(f"długość: {total/60:.1f} min, scen: {sum(1 for s in segments if s[0] != 'card')}, zdań z lektorem: {len(lines)}")

# ---- obraz ----
parts = []
for i, (kind, src, d) in enumerate(segments):
    p = tmp / f"v{i:03d}.mp4"
    common = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "24", str(p)]
    fade = f"fade=t=in:st=0:d=0.4,fade=t=out:st={max(0, d - 0.4):.3f}:d=0.4"
    if kind == "card":
        cmd = ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=black:s=1280x720:r=24:d={d:.3f}"] + common
    elif kind == "video":
        cmd = ["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vf",
               f"scale=1280:720,fps=24,tpad=stop_mode=clone:stop_duration={d:.3f},trim=duration={d:.3f},setpts=PTS-STARTPTS,{fade}"] + common
    else:
        cmd = ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", str(src), "-t", f"{d:.3f}", "-vf",
               f"scale=1280:720,zoompan=z='1+0.08*on/({d:.3f}*24)':d=1:s=1280x720:fps=24,{fade}"] + common
    subprocess.run(cmd, check=True)
    parts.append(p)
(tmp / "lista.txt").write_text("".join(f"file '{p}'\n" for p in parts))
subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(tmp / "lista.txt"), "-c", "copy", str(tmp / "obraz.mp4")], check=True)

# ---- dźwięk ----
N = int(total * SR) + SR
mix_music = np.zeros((N, 2), np.float32); mix_rest = np.zeros((N, 2), np.float32)
cache = {}
def buf(kind, id_):
    if (kind, id_) not in cache:
        cache[(kind, id_)] = decode(ROOT / "assets/audio" / manifest[kind][id_]["file"])
    return cache[(kind, id_)]

for id_, a, b in music_spans:
    a0, b1 = max(0, a - FADE / 2), b + FADE / 2
    n = int((b1 - a0) * SR); src = buf("music", id_)
    reps = int(np.ceil(n / len(src))) + 1
    seg = np.tile(src, (reps, 1))[:n] * manifest["music"][id_].get("volume", 1) * MUSIC_GAIN
    f = min(int(FADE * SR), n // 2); env = np.ones(n, np.float32)
    env[:f] = np.linspace(0, 1, f); env[-f:] = np.linspace(1, 0, f)
    i0 = int(a0 * SR); m = min(n, N - i0); mix_music[i0:i0 + m] += (seg * env[:, None])[:m]

duck = np.ones(N, np.float32)
for st, a in lines:
    x = decode(a); i0 = int(st * SR); m = min(len(x), N - i0); mix_rest[i0:i0 + m] += x[:m]
    duck[i0:i0 + m] = DUCK
k = int(0.35 * SR); duck = np.convolve(duck, np.ones(k) / k, mode="same").astype(np.float32)  # płynne ściszanie
for st, id_, loop_end in sfx_events:
    x = buf("sfx", id_) * manifest["sfx"][id_].get("volume", 1) * SFX_GAIN
    if loop_end:
        n = int((loop_end - st) * SR); x = np.tile(x, (int(np.ceil(n / len(x))) + 1, 1))[:n]
    i0 = int(st * SR); m = min(len(x), N - i0); mix_rest[i0:i0 + m] += x[:m]
mix = mix_music * duck[:, None] + mix_rest
peak = np.abs(mix).max()
if peak > 0.98: mix *= 0.98 / peak
mix.astype(np.float32).tofile(tmp / "dzwiek.f32")

# ---- napisy ----
ass = ["[Script Info]", "ScriptType: v4.00+", "PlayResX: 1280", "PlayResY: 720", "",
       "[V4+ Styles]",
       "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
       "Style: Napis,DejaVu Sans,34,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,1,0,0,0,100,100,0,0,3,10,0,2,80,80,36,1",
       "Style: Aegis,DejaVu Sans,34,&H00E0E040,&H00E0E040,&H00000000,&HA0000000,1,0,0,0,100,100,0,0,3,10,0,2,80,80,36,1",
       "Style: Tytul,DejaVu Sans,54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,80,80,0,1",
       "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
ass += [f"Dialogue: 0,{ass_time(a)},{ass_time(b)},{st},,0,0,0,,{ass_text(x)}" for a, b, st, x in subs]
(tmp / "napisy.ass").write_text("\n".join(ass) + "\n", encoding="utf-8")

subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(tmp / "obraz.mp4"),
                "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", str(tmp / "dzwiek.f32"),
                "-vf", f"subtitles={tmp / 'napisy.ass'}", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:v", "libx264", "-preset", "medium", "-crf", "24",
                "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(out)], check=True)
print("gotowe:", out, f"{out.stat().st_size / 1e6:.0f} MB")
