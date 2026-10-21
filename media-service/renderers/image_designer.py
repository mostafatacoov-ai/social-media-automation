"""Branded post image templates rendered with Pillow."""

import os

from PIL import Image, ImageDraw, ImageFilter

from .text import fit_font, is_arabic, load_font, shape, wrap_text


def _hex_rgb(hexc: str, fallback=(109, 40, 217)):
    hexc = (hexc or "").strip().lstrip("#")
    if len(hexc) == 6:
        try:
            return tuple(int(hexc[i : i + 2], 16) for i in (0, 2, 4))
        except ValueError:
            pass
    return fallback


def gradient_bg(size, top, bottom):
    w, h = size
    img = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        img.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img.resize((w, h))


def _decorative(img, primary):
    """Soft translucent circles for depth."""
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    w, h = img.size
    color = (255, 255, 255, 14)
    d.ellipse([w * 0.55, -h * 0.15, w * 1.35, h * 0.35], fill=color)
    d.ellipse([-w * 0.35, h * 0.7, w * 0.3, h * 1.3], fill=color)
    img = img.convert("RGBA")
    img.alpha_composite(overlay)
    return img.convert("RGB")


def _paste_logo(img, logo_path, y):
    try:
        logo = Image.open(logo_path).convert("RGBA")
    except Exception:
        return y
    max_w = 260
    if logo.width > max_w:
        ratio = max_w / logo.width
        logo = logo.resize((max_w, int(logo.height * ratio)), Image.LANCZOS)
    if logo.height > 120:
        ratio = 120 / logo.height
        logo = logo.resize((int(logo.width * ratio), 120), Image.LANCZOS)
    x = (img.width - logo.width) // 2
    img.paste(logo, (x, y), logo)
    return y + logo.height + 16


def _footer(img, brand, draw_y_start):
    d = ImageDraw.Draw(img)
    y = draw_y_start
    logo_path = brand.get("logo_path")
    if logo_path and os.path.exists(str(logo_path)):
        y = _paste_logo(img, str(logo_path), y)
    else:
        name = brand.get("name") or ""
        if name:
            f = load_font(34, 800, True)
            d.text(((img.width - d.textlength(shape(name), font=f)) / 2, y), shape(name), font=f, fill=(255, 255, 255, 230))
            y += 56
    site = brand.get("website") or ""
    if site:
        f = load_font(24, 500)
        d.text(((img.width - d.textlength(site, font=f)) / 2, y), site, font=f, fill=(255, 255, 255, 160))
    return img


def render_post(template, size, brand, fields, out_path):
    """Renders a branded post image. Returns (out_path, width, height)."""
    w, h = size
    primary = _hex_rgb(brand.get("primary"))
    secondary = _hex_rgb(brand.get("secondary"), (15, 23, 42))
    img = _decorative(gradient_bg(size, primary, secondary), primary)
    d = ImageDraw.Draw(img)

    margin = int(w * 0.09)
    max_w = w - margin * 2
    cx = w // 2

    badge = (fields.get("badge") or "").strip()
    headline = (fields.get("headline") or "").strip()
    subline = (fields.get("subline") or "").strip()
    is_ar = is_arabic(headline + subline)

    # Top badge pill
    y = int(h * 0.1)
    if badge:
        f = load_font(30, 700, is_ar)
        tw = d.textlength(shape(badge), font=f)
        pad_x, pad_y = 26, 12
        d.rounded_rectangle(
            [cx - tw / 2 - pad_x, y, cx + tw / 2 + pad_x, y + 30 + pad_y * 2],
            radius=24,
            fill=(255, 255, 255, 255),
        )
        d.text((cx - tw / 2, y + pad_y - 2), shape(badge), font=f, fill=secondary)
        y += 30 + pad_y * 2 + 40

    # Headline / stat
    if template == "stat":
        num_font = fit_font(d, headline, max_w, 260, 90, 900, is_ar)
        d.text(((w - d.textlength(shape(headline), font=num_font)) / 2, y), shape(headline), font=num_font, fill=(255, 255, 255))
        y += num_font.size + 18
        label = subline
        if label:
            lf = fit_font(d, label, max_w, 56, 30, 700, True)
            for line in wrap_text(d, label, lf, max_w):
                d.text(((w - d.textlength(shape(line), font=lf)) / 2, y), shape(line), font=lf, fill=(255, 255, 255))
                y += lf.size + 12
    else:
        if headline:
            hf = fit_font(d, headline, max_w, 96 if h <= 1350 else 110, 34, 800, True)
            for line in wrap_text(d, headline, hf, max_w):
                d.text(((w - d.textlength(shape(line), font=hf)) / 2, y), shape(line), font=hf, fill=(255, 255, 255))
                y += hf.size + 14
            y += 18
        if subline:
            sf = fit_font(d, subline, max_w, 44, 24, 500, True)
            for line in wrap_text(d, subline, sf, max_w):
                d.text(((w - d.textlength(shape(line), font=sf)) / 2, y), shape(line), font=sf, fill=(255, 255, 255, 210))
                y += sf.size + 10

    # Footer pinned to the bottom area
    img = _footer(img, brand, int(h * 0.78))

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    img.save(out_path, "PNG")
    return out_path, w, h
