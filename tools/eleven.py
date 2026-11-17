"""Pomocnik ElevenLabs. Klucz czytany z 'eleven labs key.txt' (nigdy nie wypisywany).
python eleven.py info                 -> plan, kredyty, lista glosow
python eleven.py sample VOICE_ID plik.mp3 "tekst"
"""
import json, pathlib, sys, urllib.request, urllib.error

HERE = pathlib.Path(__file__).parent
KEY = (HERE / "eleven labs key.txt").read_text(encoding="utf-8").strip()
API = "https://api.elevenlabs.io"


def call(path, body=None, raw=False):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body else None,
                                 headers={"xi-api-key": KEY, "Content-Type": "application/json"},
                                 method="POST" if body else "GET")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
            return data if raw else json.loads(data)
    except urllib.error.HTTPError as e:
        return {"error": e.code, "detail": e.read().decode(errors="replace")[:300]}


if sys.argv[1] == "info":
    sub = call("/v1/user/subscription")
    if "error" in sub:
        print("subscription:", sub)
    else:
        print("plan:", sub.get("tier"), "credits used/limit:", sub.get("character_count"), "/", sub.get("character_limit"),
              "reset:", sub.get("next_character_count_reset_unix"))
    v = call("/v1/voices")
    if "error" in v:
        print("voices:", v)
    else:
        for x in v.get("voices", []):
            l = x.get("labels", {})
            print(x["voice_id"], "|", x["name"], "|", x.get("category"), "|", l.get("gender"), l.get("age"), l.get("accent"), l.get("description") or l.get("descriptive"), l.get("use_case"))
elif sys.argv[1] == "sample":
    vid, out, text = sys.argv[2], sys.argv[3], sys.argv[4]
    audio = call(f"/v1/text-to-speech/{vid}?output_format=mp3_44100_128",
                 {"text": text, "model_id": "eleven_multilingual_v2",
                  "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.3}}, raw=True)
    if isinstance(audio, dict):
        print("error", audio)
    else:
        pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)
        pathlib.Path(out).write_bytes(audio)
        print("ok", out, len(audio))
