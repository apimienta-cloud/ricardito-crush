"""
Genera los assets del juego a partir del material de marca en /imagenes.

Uso (desde la raíz del proyecto):
    python tools/build_assets.py

Requiere: Pillow y PyMuPDF (pip install pillow pymupdf)

Produce en /assets:
  logo.png                 logo vectorial "Ricardito" (desde Logos-Feed-Story.ai)
  bg_rays.jpg, bg_light.jpg, bg_spiral.jpg   fondos (desde Ricardito_Bases.ai)
  tile_<sabor>.png         fichas: recorte del Ricardito Menta con el merengue recoloreado
  caja_*.png, logo_*.png, uruguay_noma.png, ricardito_*.png   decoraciones
"""
import os
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps
import pymupdf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "imagenes")
OUT = os.path.join(ROOT, "assets")
os.makedirs(OUT, exist_ok=True)

# Color del merengue por sabor (None = dejar el verde menta original)
FLAVORS = {
    "clasico":   (255, 250, 236),
    "menta":     (120, 230, 150),
    "pasion":    (255, 110, 150),
    "halloween": (255, 140, 40),
    "celeste":   (110, 195, 255),
    "dubai":     (185, 220, 30),
}


def logo():
    doc = pymupdf.open(os.path.join(IMG, "Logos-Feed-Story.ai"))
    pix = doc[0].get_pixmap(dpi=288, alpha=True)
    im = Image.frombytes("RGBA", (pix.width, pix.height), pix.samples)
    top = im.crop((0, 0, im.width, im.height // 2))
    bb = top.split()[3].getbbox()
    top.crop((bb[0] - 12, bb[1] - 12, bb[2] + 12, bb[3] + 12)).save(os.path.join(OUT, "logo.png"))


def backgrounds():
    doc = pymupdf.open(os.path.join(IMG, "Ricardito_Bases.ai"))
    for page, name in [(6, "bg_rays.jpg"), (7, "bg_light.jpg"), (8, "bg_spiral.jpg")]:
        pix = doc[page].get_pixmap(dpi=72, alpha=False)
        Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(os.path.join(OUT, name), quality=82)


def tiles():
    base = Image.open(os.path.join(IMG, "Ricardito-Solo-Final-MentaV2.png"))
    base = base.crop(base.split()[3].getbbox())
    # 240 px alcanza para fichas de hasta ~80 px en pantallas 3x y usa menos memoria de GPU en celulares
    base.thumbnail((240, 240), Image.LANCZOS)
    size = max(base.size) + 12
    sq = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sq.paste(base, ((size - base.width) // 2, (size - base.height) // 2))
    base = sq
    alpha = base.split()[3]
    # máscara del merengue: tonos verdes claros
    h, s, v = base.convert("RGB").convert("HSV").split()
    mask = ImageChops.multiply(ImageChops.multiply(
        h.point(lambda x: 255 if 42 <= x <= 128 else 0),
        s.point(lambda x: 255 if x > 15 else 0)),
        v.point(lambda x: 255 if x > 90 else 0))
    mask = mask.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.2))
    gray = ImageOps.autocontrast(base.convert("L"), cutoff=1).point(lambda x: min(255, int(x * 1.25 + 20)))
    rgb = base.convert("RGB")
    # sombra horneada en el PNG (más barato que filter: drop-shadow en cada ficha del tablero)
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sh_alpha = alpha.filter(ImageFilter.GaussianBlur(4)).point(lambda x: int(x * 0.45))
    shadow.putalpha(sh_alpha)
    shadow = ImageChops.offset(shadow, 0, 6)
    for name, col in FLAVORS.items():
        tinted = ImageChops.multiply(Image.merge("RGB", (gray, gray, gray)), Image.new("RGB", base.size, col))
        out = Image.composite(tinted, rgb, mask).convert("RGBA")
        out.putalpha(alpha)
        final = shadow.copy()
        final.alpha_composite(out)
        final.save(os.path.join(OUT, f"tile_{name}.png"))


def rgba_small(src, dst, w):
    im = Image.open(os.path.join(IMG, src)).convert("RGBA")
    im = im.crop(im.split()[3].getbbox())
    im.thumbnail((w, w), Image.LANCZOS)
    im.save(os.path.join(OUT, dst))


def white_to_alpha(src, dst, w):
    im = Image.open(os.path.join(IMG, src)).convert("RGB")
    im.thumbnail((w, w), Image.LANCZOS)
    a = im.convert("L").point(lambda x: 0 if x > 240 else 255).filter(ImageFilter.GaussianBlur(0.6))
    out = im.convert("RGBA"); out.putalpha(a); out = out.crop(a.getbbox())
    out.save(os.path.join(OUT, dst))


def corner_fill(src, dst, w, tol=40):
    """Vuelve transparente el fondo conectado a los bordes (para JPG con fondo claro)."""
    im = Image.open(os.path.join(IMG, src)).convert("RGB")
    im.thumbnail((w, w), Image.LANCZOS)
    tmp = im.copy(); W, H = im.size
    for p in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1), (W // 2, 0), (W // 2, H - 1), (0, H // 2), (W - 1, H // 2)]:
        ImageDraw.floodfill(tmp, p, (255, 0, 255), thresh=tol)
    m = Image.new("L", im.size, 0); px = tmp.load(); mp = m.load()
    for y in range(H):
        for x in range(W):
            mp[x, y] = 0 if px[x, y] == (255, 0, 255) else 255
    m = m.filter(ImageFilter.GaussianBlur(0.7))
    out = im.convert("RGBA"); out.putalpha(m); out = out.crop(m.getbbox())
    out.save(os.path.join(OUT, dst))


def decorations():
    rgba_small("Ricardito_SIN_OCTOGONOS.png", "caja_clasica.png", 420)
    rgba_small("Ricardito--Celeste SIN OCTOGONOS.png", "caja_celeste.png", 520)
    rgba_small("Ricardito-Box_Mockup-pasión_Sin-Octogono-Frontal.png", "caja_pasion.png", 520)
    rgba_small("Ricardito-Box_Mockup-sin fondo.png", "caja_3d.png", 520)
    rgba_small("Pasión logo.png", "logo_pasion.png", 500)
    corner_fill("WhatsApp Image 2026-04-20 at 5.34.07 PM (1).jpeg", "uruguay_noma.png", 600)
    corner_fill("WhatsApp Image 2026-04-20 at 5.34.08 PM (1).jpeg", "logo_celeste.png", 500, tol=30)
    white_to_alpha("Ricardito Halloween PNG.png", "ricardito_halloween.png", 500)
    white_to_alpha("Gemini_Generated_Image_1jgx6c1jgx6c1jgx.png", "ricardito_pasion.png", 500)


if __name__ == "__main__":
    logo(); backgrounds(); tiles(); decorations()
    print("Assets generados en", OUT)
