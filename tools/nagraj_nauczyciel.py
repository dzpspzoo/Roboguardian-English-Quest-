"""Nagrania Nauczyciela AEGIS-7 w kilku glosach (trening na wielu glosach). Uzycie:
python tools/nagraj_nauczyciel.py            (czyta tools/frazy-nauczyciel.txt, zapisuje assets/audio/teacher/v1..v3/)
Glos 0 (biblioteka slowek gry) nagrywa zwykly skrypt:
python tools/nagraj_edge_tts.py tools/frazy-nauczyciel.txt assets/audio/words
Liste fraz odswiezysz: node -e "import('./src/teacher/curriculum.js').then(m=>require('fs').writeFileSync('tools/frazy-nauczyciel.txt', m.phrases().map(p=>'en|'+p).join('\\n')+'\\n'))"
"""
import asyncio, pathlib, sys
import edge_tts
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from nagraj_edge_tts import slug, SAY_AS  # ta sama nazwa pliku co w grze

VOICES = {"v1": "en-US-AnaNeural", "v2": "en-GB-SoniaNeural", "v3": "en-US-GuyNeural"}
ROOT = pathlib.Path(__file__).resolve().parent.parent


async def one(text, voice, out):
    if out.exists() and out.stat().st_size > 0:
        return False
    out.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(4):
        try:
            await edge_tts.Communicate(SAY_AS.get(text, text), voice, rate="-10%").save(str(out))
            return True
        except Exception as e:
            print("retry", text, e)
            await asyncio.sleep(2 * (attempt + 1))
    raise RuntimeError(text)


async def main():
    lines = (ROOT / "tools" / "frazy-nauczyciel.txt").read_text(encoding="utf-8").splitlines()
    texts = [l.split("|", 1)[1].strip() for l in lines if l.startswith("en|")]
    sem = asyncio.Semaphore(4)

    async def run(t, d, v):
        async with sem:
            return await one(t, v, ROOT / "assets" / "audio" / "teacher" / d / f"{slug(t)}.mp3")

    done = await asyncio.gather(*(run(t, d, v) for t in texts for d, v in VOICES.items()))
    print(f"nagrano {sum(done)} nowych z {len(done)}")


if __name__ == "__main__":
    asyncio.run(main())
