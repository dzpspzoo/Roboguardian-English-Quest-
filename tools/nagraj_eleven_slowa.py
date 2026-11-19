"""Nagrywa słówka i zdania gry głosem ElevenLabs (zamiast edge-tts).
Te same pliki co nagraj_edge_tts.py: assets/audio/words/en/<slug>.mp3 i en-slow/<slug>.mp3 (nadpisuje).

python nagraj_eleven_slowa.py liczenie frazy-ch1.txt [frazy-kalibracja.txt ...]   -> ile znaków (kredytów) zużyje, nic nie nagrywa
python nagraj_eleven_slowa.py probka VOICE_ID cat ship sheep                       -> 3 próbki do probki-slow/ (do odsłuchu przed całością)
python nagraj_eleven_slowa.py nagraj VOICE_ID frazy-ch1.txt [...] ../assets/audio/words
python nagraj_eleven_slowa.py nagraj-normalne VOICE_ID frazy.txt [...] wyjscie   -> tylko en/ (połowa kredytów); en-slow robi się potem lokalnie (ffmpeg atempo)

Klucz: plik 'eleven labs key.txt' obok skryptu (nigdy nie wypisywany, nigdy w repo).
Wolne tempo: parametr speed=0.7 ElevenLabs (ten sam głos, bez przeciągania dźwięku jak w edge-tts -40%).
"""
import json, pathlib, re, sys, time, urllib.request, urllib.error


def slug(t):  # identyczne z src/core/say.js i nagraj_edge_tts.py
    t = t.strip(); h = 5381
    for ch in t:
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    return re.sub(r"[^a-z0-9]+", "_", t.lower()).strip("_")[:50] + f"_{h:x}"

HERE = pathlib.Path(__file__).parent
API = "https://api.elevenlabs.io"
MODEL = "eleven_multilingual_v2"
SETTINGS = {"stability": 0.75, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True}
SPEED = {"en": 1.0, "en-slow": 0.7}


def key():
    return (HERE / "eleven labs key.txt").read_text(encoding="utf-8").strip()


def phrases(files):
    out = []
    for f in files:
        for line in pathlib.Path(f).read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            lang, _, text = line.partition("|") if "|" in line else ("en", "", line)
            if lang == "en" and text.strip() and text.strip() not in out:
                out.append(text.strip())
    return out


def tts(voice, text, speed):
    # Pojedyncze słowo z kropką brzmi jak spokojne, wyraźne słowo słownikowe, bez pytającej intonacji.
    say = text if text[-1] in ".!?" else text + "."
    body = {"text": say, "model_id": MODEL, "voice_settings": dict(SETTINGS, speed=speed)}
    req = urllib.request.Request(f"{API}/v1/text-to-speech/{voice}?output_format=mp3_44100_96", data=json.dumps(body).encode(),
                                 headers={"xi-api-key": key(), "Content-Type": "application/json"}, method="POST")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:200]
            if e.code in (429, 500, 502, 503):
                time.sleep(3 * (attempt + 1)); continue
            raise RuntimeError(f"{e.code} {msg}")
        except Exception:
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"nie udało się: {text}")


def main():
    cmd = sys.argv[1]
    if cmd == "liczenie":
        p = phrases(sys.argv[2:])
        chars = sum(len(x) + 1 for x in p)
        print(f"fraz: {len(p)}, znaków na tempo: {chars}, razem (normalne + wolne): {2 * chars}")
    elif cmd == "probka":
        voice, words = sys.argv[2], sys.argv[3:]
        out = HERE / "probki-slow"; out.mkdir(exist_ok=True)
        for w in words:
            for d, sp in SPEED.items():
                (out / f"{w}_{d}.mp3").write_bytes(tts(voice, w, sp))
        print("próbki w", out)
    elif cmd == "nagraj-normalne":
        voice, files, outdir = sys.argv[2], sys.argv[3:-1], pathlib.Path(sys.argv[-1])
        p = phrases(files); n = 0
        for text in p:
            f = outdir / "en" / f"{slug(text)}.mp3"; f.parent.mkdir(parents=True, exist_ok=True)
            if f.exists() and f.stat().st_size > 1000:
                continue  # wznowienie po przerwie bez ponownego zużycia kredytów
            f.write_bytes(tts(voice, text, 1.0)); n += 1
            print("ok", text)
        print(f"nagrano {n} plików ({len(p)} fraz)")
    elif cmd == "nagraj":
        voice, files, outdir = sys.argv[2], sys.argv[3:-1], pathlib.Path(sys.argv[-1])
        p = phrases(files); n = 0
        for text in p:
            for d, sp in SPEED.items():
                f = outdir / d / f"{slug(text)}.mp3"; f.parent.mkdir(parents=True, exist_ok=True)
                f.write_bytes(tts(voice, text, sp)); n += 1
            print("ok", text)
        print(f"nagrano {n} plików ({len(p)} fraz)")


if __name__ == "__main__":
    main()
