"""Wycina AEGIS-7 z pelnego renderu (usuwa tlo) -> PNG z przezroczystoscia.
python wytnij_robota.py render.webp wyjscie.png [x0 y0 x1 y1 w ulamkach]"""
import sys
from PIL import Image
from rembg import remove, new_session

src, out = sys.argv[1], sys.argv[2]
box = [float(v) for v in sys.argv[3:7]] if len(sys.argv) >= 7 else [0.22, 0.0, 0.78, 1.0]
im = Image.open(src).convert("RGB")
W, H = im.size
im = im.crop((int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)))
im.thumbnail((1400, 1400))
cut = remove(im, session=new_session("isnet-general-use"))
cut = cut.crop(cut.getbbox())
cut.thumbnail((700, 700))
cut.save(out)
print("ok", out, cut.size)
