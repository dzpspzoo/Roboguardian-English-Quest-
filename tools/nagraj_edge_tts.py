"""Nagrywa frazy gry jako MP3 (edge-tts). Uzycie:
python nagraj_edge_tts.py frazy.txt katalog_audio
Plik fraz: linie 'en|tekst' lub 'pl|tekst'. Nazwy plikow = slug() z gry (musi sie zgadzac z index.html).
"""
import asyncio, re, sys, pathlib
import edge_tts

VOICE_EN = "en-US-ChristopherNeural"   # niski, spokojny glos meski (AEGIS-7 / narrator)
VOICE_PL = "pl-PL-MarekNeural"
SAY_AS = {"PE": "P.E.", "I, my": "I... my", "you, your": "you... your", "he, his": "he... his",
          "she, her": "she... her", "it, its": "it... its", "we, our": "we... our", "they, their": "they... their"}


def slug(t: str) -> str:
    t = t.strip()
    h = 5381
    for ch in t:  # wszystkie znaki z BMP -> jak charCodeAt w JS
        h = (h * 33 + ord(ch)) & 0xFFFFFFFF
    s = re.sub(r"[^a-z0-9]+", "_", t.lower()).strip("_")[:50]
    return f"{s}_{h:x}"


async def one(text, voice, rate, out: pathlib.Path):
    if out.exists() and out.stat().st_size > 0:
        return False
    out.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            await edge_tts.Communicate(SAY_AS.get(text, text), voice, rate=rate).save(str(out))
            return True
        except Exception as e:  # siec / limit
            print("retry", text, e)
            await asyncio.sleep(2 * (attempt + 1))
    raise RuntimeError(f"nie udalo sie: {text}")


async def main(phr, outdir):
    out = pathlib.Path(outdir)
    lines = [l.split("|", 1) for l in pathlib.Path(phr).read_text(encoding="utf-8").splitlines() if "|" in l]
    jobs = []
    for lang, text in lines:
        text = text.strip()
        if lang == "en":
            jobs.append((text, VOICE_EN, "-8%", out / "en" / f"{slug(text)}.mp3"))
            jobs.append((text, VOICE_EN, "-40%", out / "en-slow" / f"{slug(text)}.mp3"))
        else:
            jobs.append((text, VOICE_PL, "+0%", out / "pl" / f"{slug(text)}.mp3"))
    sem = asyncio.Semaphore(4)

    async def run(j):
        async with sem:
            return await one(*j)

    done = await asyncio.gather(*(run(j) for j in jobs))
    print(f"nagrano {sum(done)} nowych, razem {len(jobs)} plikow")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1], sys.argv[2]))
