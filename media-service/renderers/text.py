"""Arabic-aware text rendering helpers for Pillow."""

import os
import re

import arabic_reshaper
from bidi.algorithm import get_display
from PIL import ImageFont

ARABIC_RE = re.compile(r"[\u0600-\u06FF]")

FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fonts")


def _candidate_paths(name: str):
    local = os.path.join(FONT_DIR, name)
    if os.path.exists(local):
        return [local]
    # Windows system font fallbacks (Tahoma/Segoe render Arabic acceptably)
    windir = os.environ.get("WINDIR", r"C:\Windows")
    return [
        os.path.join(windir, "Fonts", "tahoma.ttf"),
        os.path.join(windir, "Fonts", "segoeui.ttf"),
        os.path.join(windir, "Fonts", "arial.ttf"),
    ]


def load_font(size: int, weight: int = 700, arabic: bool = False):
    """Loads Cairo (Arabic+Latin) or Inter (Latin) with a variable-weight override if possible."""
    name = "Cairo.ttf" if arabic else "Inter.ttf"
    for path in _candidate_paths(name):
        try:
            font = ImageFont.truetype(path, size)
            try:
                font.set_variation_by_axes([0, weight] if "Cairo" in path else [size, weight])
            except Exception:
                pass  # static font or variation unsupported — default weight is fine
            return font
        except OSError:
            continue
    return ImageFont.load_default()


def shape(text: str) -> str:
    """Reshape + reorder Arabic text for correct rendering; leaves Latin untouched."""
    if not ARABIC_RE.search(text):
        return text
    return get_display(arabic_reshaper.reshape(text))


def is_arabic(text: str) -> bool:
    return bool(ARABIC_RE.search(text))


def wrap_text(draw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Word-wraps a line to max_width (measures the shaped form of each candidate line)."""
    words = text.split()
    lines: list[str] = []
    current = ""
    for w in words:
        candidate = (current + " " + w).strip()
        if draw.textlength(shape(candidate), font=font) <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def fit_font(draw, text: str, max_width: int, start_size: int, min_size: int, weight: int, arabic: bool):
    """Returns the largest font size <= start_size whose single-line width fits max_width."""
    size = start_size
    while size > min_size:
        font = load_font(size, weight, arabic)
        if draw.textlength(shape(text), font=font) <= max_width:
            return font
        size -= 4
    return load_font(min_size, weight, arabic)
