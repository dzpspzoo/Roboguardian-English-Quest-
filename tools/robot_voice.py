"""Glos AEGIS-7: ElevenLabs (PCM) + filtr robota -> WAV.
python robot_voice.py VOICE_ID poziom(1-3) wyjscie.wav "tekst"
"""
import json, pathlib, sys, urllib.request, wave
import numpy as np

HERE = pathlib.Path(__file__).parent
KEY = (HERE / "eleven labs key.txt").read_text(encoding="utf-8").strip()
SR = 24000


def tts_pcm(voice, text):
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=pcm_{SR}",
        data=json.dumps({"text": text, "model_id": "eleven_multilingual_v2",
                         "voice_settings": {"stability": 0.85, "similarity_boost": 0.7, "style": 0.0}}).encode(),
        headers={"xi-api-key": KEY, "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=90) as r:
        return np.frombuffer(r.read(), dtype="<i2").astype(np.float32) / 32768


def comb(x, delay_ms, fb):
    d = int(SR * delay_ms / 1000)
    y = x.copy()
    for i in range(d, len(y)):
        y[i] += fb * y[i - d]
    return y


def robot(x, level):
    t = np.arange(len(x)) / SR
    ring_hz, ring_mix, comb_ms, comb_fb, crush = {1: (50, .25, 6, .35, 0), 2: (60, .45, 8, .5, 10), 3: (70, .7, 10, .6, 7)}[level]
    ringed = x * np.sin(2 * np.pi * ring_hz * t)
    y = (1 - ring_mix) * x + ring_mix * ringed
    y = comb(y, comb_ms, comb_fb)                      # metaliczny rezonans
    if crush:                                           # lekka "cyfrowosc"
        q = 2 ** crush
        y = np.round(y * q) / q
    y += 0.25 * np.concatenate([np.zeros(int(SR * .045)), y[:-int(SR * .045)]])  # krotkie echo hangaru
    return y / (np.max(np.abs(y)) + 1e-6) * 0.9


def save_wav(path, y):
    path = pathlib.Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((y * 32767).astype("<i2").tobytes())


AEGIS_VOICE, AEGIS_LEVEL = "cjVigY5qzO86Huf0OWal", 2   # wybrane 17.11.2026: Eric + filtr 2


def slug(t):
    import re
    t = t.strip(); h = 5381
    for ch in t:
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    return re.sub(r"[^a-z0-9]+", "_", t.lower()).strip("_")[:50] + f"_{h:x}"


if __name__ == "__main__":
    if sys.argv[1] == "batch":   # python robot_voice.py batch frazy.txt katalog_wyjsciowy
        outdir = pathlib.Path(sys.argv[3]); n = 0
        for line in pathlib.Path(sys.argv[2]).read_text(encoding="utf-8").splitlines():
            t = line.strip()
            if not t: continue
            out = outdir / f"{slug(t)}.wav"
            if out.exists(): continue
            save_wav(out, robot(tts_pcm(AEGIS_VOICE, t), AEGIS_LEVEL)); n += 1
        print("nagrano", n)
    else:
        voice, level, out, text = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
        save_wav(out, robot(tts_pcm(voice, text), level))
        print("ok", out)
