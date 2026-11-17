"""Automatyczne generowanie kart postaci, scen historii (obrazy) i klipów (wideo)
przez API OpenAI. Uruchamiane lokalnie u rodzica – klucz nigdy nie trafia do repo.

Instalacja:   pip install openai pillow
Klucz:        jedna linia w pliku (domyślnie ..\\narzedzia\\openai_key.txt) albo zmienna OPENAI_API_KEY

Przykłady:
  python generuj_media.py --karty karty-postaci.md --sceny prompty-scen.md --render AEGIS-7_v2_3-4.png --out media --plan
  python generuj_media.py ... --out media --yes                 # karty + 10 obrazów
  python generuj_media.py ... --out media --yes --video         # + klipy Sora
  python generuj_media.py ... --only s03 --force --yes          # powtórz jedną scenę
  python generuj_media.py ... --region "East Asian family, light-medium skin" --out media-asia --yes

Gotowe pliki są pomijane (można przerwać i wznowić). Każde wywołanie jest zapisywane w media/log.jsonl.
"""
import argparse
import base64
import json
import os
import re
import sys
import time

CONSISTENCY = "Use the attached character sheets exactly. Same faces, hair, skin tone, clothes and robot design as in the sheets."
SAFE = "Keep the bottom 20% of the frame free of important content (subtitles go there). No text, no letters, no logos, no watermark. No blood, no gore."


# ------------------------------------------------------------------ wczytanie promptów
def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def parse_sheets(md, region=None):
    style = re.search(r"STYLE:\s*(.+)", md).group(1).strip()
    sheets = {}
    for m in re.finditer(r"^## ([A-D])\. [^\n]*\n(.*?)(?=^## |\Z)", md, re.S | re.M):
        body = m.group(2)
        body = re.sub(r"STYLE:.*", "", body).strip()
        if region:
            body = re.sub(r"ETHNICITY:.*", f"ETHNICITY: {region}.", body)
        sheets[m.group(1)] = body + "\n\n" + style
    return sheets, style


def parse_scenes(md):
    scenes = {}
    for m in re.finditer(r"^### (s\d\d)\.[^\n]*\n(.*?)(?=^### |\Z)", md, re.S | re.M):
        body = m.group(2)
        img = re.search(r"\*\*Obraz:\*\*\s*```\s*(.*?)```", body, re.S)
        mov = re.search(r"\*\*Ruch[^*]*\*\*\s*```\s*(.*?)```", body, re.S)
        scenes[m.group(1)] = {"image": img.group(1).strip() if img else "", "motion": mov.group(1).strip() if mov else ""}
    return scenes


# ------------------------------------------------------------------ API
def client_from_key(key_path):
    from openai import OpenAI
    key = os.environ.get("OPENAI_API_KEY")
    if not key and key_path and os.path.exists(key_path):
        key = read(key_path).strip()
    if not key:
        sys.exit(f"Brak klucza. Zapisz go jako jedną linię w {key_path} albo ustaw OPENAI_API_KEY.")
    return OpenAI(api_key=key)


def log(out, entry):
    with open(os.path.join(out, "log.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def save_b64(resp, path):
    data = resp.data[0].b64_json
    with open(path, "wb") as f:
        f.write(base64.b64decode(data))


def gen_image(cl, args, prompt, refs, path):
    t = time.time()
    kw = dict(model=args.image_model, prompt=prompt, size=args.size, quality=args.quality, n=1)
    if refs:
        files = [open(r, "rb") for r in refs]
        try:
            resp = cl.images.edit(image=files, **kw)
        finally:
            for f in files:
                f.close()
    else:
        resp = cl.images.generate(**kw)
    save_b64(resp, path)
    log(args.out, {"t": time.time(), "kind": "image", "file": os.path.basename(path), "refs": [os.path.basename(r) for r in refs], "sec": round(time.time() - t, 1)})
    print(f"  zapisano {path} ({time.time() - t:.0f} s)")


def gen_video(cl, args, prompt, still, path):
    from PIL import Image
    w, h = map(int, args.video_size.split("x"))
    ref = path.replace(".mp4", "_ref.png")
    Image.open(still).convert("RGB").resize((w, h), Image.LANCZOS).save(ref)
    t = time.time()
    with open(ref, "rb") as f:
        job = cl.videos.create(model=args.video_model, prompt=prompt, size=args.video_size, seconds=str(args.seconds), input_reference=f)
    while job.status in ("queued", "in_progress"):
        time.sleep(10)
        job = cl.videos.retrieve(job.id)
        print(f"  {job.status} {getattr(job, 'progress', '')}")
    if job.status != "completed":
        print(f"  NIEUDANE: {getattr(job, 'error', job.status)}")
        log(args.out, {"t": time.time(), "kind": "video", "file": os.path.basename(path), "status": job.status})
        return
    content = cl.videos.download_content(job.id, variant="video")
    content.write_to_file(path)
    os.remove(ref)
    log(args.out, {"t": time.time(), "kind": "video", "file": os.path.basename(path), "sec": round(time.time() - t, 1)})
    print(f"  zapisano {path} ({time.time() - t:.0f} s)")


# ------------------------------------------------------------------ main
def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser()
    ap.add_argument("--karty", required=True)
    ap.add_argument("--sceny", required=True)
    ap.add_argument("--render", required=True, help="render AEGIS-7 jako wzór robota")
    ap.add_argument("--out", default="media")
    ap.add_argument("--key", default=os.path.join(here, "..", "narzedzia", "openai_key.txt"))
    ap.add_argument("--region", help="podmienia linijkę ETHNICITY w kartach rodziny")
    ap.add_argument("--only", help="np. s03 albo A,B,s05")
    ap.add_argument("--force", action="store_true", help="nadpisz istniejące pliki")
    ap.add_argument("--video", action="store_true", help="również klipy wideo")
    ap.add_argument("--plan", action="store_true", help="pokaż co powstanie, bez wywołań API")
    ap.add_argument("--yes", action="store_true", help="potwierdzenie uruchomienia płatnych wywołań")
    ap.add_argument("--image-model", default="gpt-image-1")
    ap.add_argument("--video-model", default="sora-2")
    ap.add_argument("--size", default="1536x1024")
    ap.add_argument("--quality", default="high")
    ap.add_argument("--video-size", default="1280x720")
    ap.add_argument("--seconds", type=int, default=8)
    args = ap.parse_args()

    sheets, style = parse_sheets(read(args.karty), args.region)
    scenes = parse_scenes(read(args.sceny))
    only = set(args.only.split(",")) if args.only else None
    os.makedirs(os.path.join(args.out, "karty"), exist_ok=True)

    def wanted(k, path):
        if only and k not in only:
            return False
        return args.force or not os.path.exists(path)

    jobs = []
    sheet_path = {k: os.path.join(args.out, "karty", f"{k}.png") for k in sheets}
    for k, p in sheets.items():
        refs = [args.render] if k == "A" else []
        if k in ("B", "C"):
            refs = []
        if wanted(k, sheet_path[k]):
            jobs.append(("image", k, sheets[k], refs, sheet_path[k]))
    for s, sc in sorted(scenes.items()):
        refs = [sheet_path["A"], sheet_path["B"], sheet_path["C"], args.render]
        if s in ("s05", "s06", "s07", "s08"):
            refs.append(sheet_path["D"])
        prompt = f"{sc['image']}\n\n{CONSISTENCY}\n{SAFE}\n\n{style}"
        p = os.path.join(args.out, f"{s}.png")
        if wanted(s, p):
            jobs.append(("image", s, prompt, refs, p))
        if args.video and sc["motion"]:
            pv = os.path.join(args.out, f"{s}.mp4")
            if wanted(s, pv):
                jobs.append(("video", s, sc["motion"] + "\n" + "Keep characters exactly as in the first frame. No text.", None, pv))

    n_img = sum(1 for j in jobs if j[0] == "image")
    n_vid = sum(1 for j in jobs if j[0] == "video")
    print(f"Do zrobienia: {n_img} obrazów, {n_vid} klipów wideo ({args.seconds} s).")
    for kind, k, _, refs, p in jobs:
        print(f"  {kind:5} {k:4} -> {p}" + (f"  wzory: {', '.join(os.path.basename(r) for r in refs)}" if refs else ""))
    if args.plan or not jobs:
        return
    if not args.yes:
        sys.exit("To są płatne wywołania. Uruchom ponownie z --yes, żeby potwierdzić.")

    cl = client_from_key(args.key)
    for kind, k, prompt, refs, p in jobs:
        print(f"[{k}] {kind}")
        try:
            if kind == "image":
                missing = [r for r in refs if not os.path.exists(r)]
                if missing:
                    print(f"  pomijam, brak wzorów: {missing}")
                    continue
                gen_image(cl, args, prompt, refs, p)
            else:
                still = p.replace(".mp4", ".png")
                if not os.path.exists(still):
                    print("  pomijam, brak obrazu sceny")
                    continue
                gen_video(cl, args, prompt, still, p)
        except Exception as e:  # jedna nieudana scena nie zatrzymuje reszty
            print(f"  BŁĄD: {e}")
            log(args.out, {"t": time.time(), "kind": kind, "file": os.path.basename(p), "error": str(e)[:500]})


if __name__ == "__main__":
    main()
