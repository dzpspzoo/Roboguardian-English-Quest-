"""Nagrywa narrację historii początkowej z src/story/intro.json.
Narrator: ElevenLabs "Father Ambrose" (wybrany 18.11.2026), wersja B: wolno, spokojne emocje. AEGIS-7: głos i filtr z robot_voice.py (robot 2).
Klucz czytany z tools/'eleven labs key.txt' (nigdy nie wypisywany, nigdy w repo).

python tools/nagraj_historie.py                 -> nagrywa brakujące pliki do assets/audio/story/
python tools/nagraj_historie.py s03_02 s09_04   -> nagrywa ponownie tylko te zdania
python tools/nagraj_historie.py --koszt         -> tylko liczy znaki (kredyty), nic nie wysyła
"""
import json, pathlib, shutil, subprocess, sys, urllib.request

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent
STORY = json.loads((ROOT / "src/story/intro.json").read_text(encoding="utf-8"))
NARRATOR_ID = "gRPwZFYxBbXTrxXJzU6u"  # Father Ambrose (biblioteka ElevenLabs, dodany do konta)
NARRATOR_SETTINGS = {"stability": 0.4, "similarity_boost": 0.8, "style": 0.55, "use_speaker_boost": True, "speed": 0.8}

lines = [l for s in STORY["scenes"] for l in s["lines"]]
only = [a for a in sys.argv[1:] if not a.startswith("--")]
if only:
    lines = [l for l in lines if pathlib.Path(l["audio"]).stem in only]

if "--koszt" in sys.argv:
    print("zdań:", len(lines), "znaków (kredytów):", sum(len(l["en"]) for l in lines))
    sys.exit()

KEY = (HERE / "eleven labs key.txt").read_text(encoding="utf-8").strip()


def api(path, body=None):
    req = urllib.request.Request("https://api.elevenlabs.io" + path,
                                 data=json.dumps(body).encode() if body else None,
                                 headers={"xi-api-key": KEY, "Content-Type": "application/json"},
                                 method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def narrator_id():
    return NARRATOR_ID


def to_mp3(wav, mp3):
    if shutil.which("ffmpeg"):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1", "-b:a", "96k", str(mp3)], check=True)
        wav.unlink()
        return mp3
    try:
        import lameenc, wave
        with wave.open(str(wav)) as w:
            enc = lameenc.Encoder(); enc.set_bit_rate(96); enc.set_in_sample_rate(w.getframerate())
            enc.set_channels(1); enc.set_quality(2)
            data = enc.encode(w.readframes(w.getnframes())) + enc.flush()
        mp3.write_bytes(data); wav.unlink()
        return mp3
    except ImportError:
        print("  (brak ffmpeg i lameenc: zostawiam WAV)", wav.name)
        return wav


nid = None
done = 0
for l in lines:
    out = ROOT / l["audio"]
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists() and not only:
        continue
    if l["speaker"] == "aegis":
        sys.path.insert(0, str(HERE))
        import robot_voice as rv
        wav = out.with_suffix(".wav")
        rv.save_wav(wav, rv.robot(rv.tts_pcm(rv.AEGIS_VOICE, l["en"]), rv.AEGIS_LEVEL))
        res = to_mp3(wav, out)
    else:
        nid = nid or narrator_id()
        audio = api(f"/v1/text-to-speech/{nid}?output_format=mp3_44100_96",
                    {"text": l.get("tts", l["en"]), "model_id": "eleven_multilingual_v2", "voice_settings": NARRATOR_SETTINGS})
        out.write_bytes(audio)
        res = out
    done += 1
    print("ok", res.name, "|", l["en"])
print("nagrano", done, "z", len(lines))
