"""Reel renderer — composes a branded 1080x1920 video with MoviePy 2.x.

Pipeline: TTS voiceover (optional) -> per-scene frames (AI image or brand
gradient + burned-in text overlay) -> Ken Burns motion -> intro/outro brand
cards -> music bed (optional) -> h264 mp4.
"""

import os
import random

import numpy as np
from moviepy import (
    AudioFileClip,
    CompositeAudioClip,
    CompositeVideoClip,
    ImageClip,
    afx,
    concatenate_videoclips,
)
from PIL import Image, ImageDraw

from .image_designer import _decorative, _hex_rgb, gradient_bg
from .text import is_arabic, load_font, shape, wrap_text
from . import tts as tts_mod

W, H = 1080, 1920


def _cover_crop(img: Image.Image, w: int, h: int) -> Image.Image:
    """Scales + center-crops an image to exactly (w, h)."""
    img = img.convert("RGB")
    ratio = max(w / img.width, h / img.height)
    img = img.resize((int(img.width * ratio) + 1, int(img.height * ratio) + 1), Image.LANCZOS)
    x = (img.width - w) // 2
    y = (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def _scene_base(scene, brand) -> Image.Image:
    image_path = scene.get("image_path")
    if image_path and os.path.exists(str(image_path)):
        try:
            img = Image.open(image_path)
            try:
                from PIL import ImageOps

                img = ImageOps.exif_transpose(img)
            except Exception:
                pass
            return _cover_crop(img, W, H)
        except Exception:
            pass
    primary = _hex_rgb(brand.get("primary"))
    secondary = _hex_rgb(brand.get("secondary"), (15, 23, 42))
    seed = random.randint(0, 2)
    if seed == 0:
        return gradient_bg((W, H), primary, secondary)
    if seed == 1:
        return gradient_bg((W, H), secondary, primary)
    return _decorative(gradient_bg((W, H), secondary, primary), primary)


def _text_overlay(text: str, is_hook: bool, arabic: bool) -> Image.Image:
    """Renders scene text onto a transparent 1080x1920 PNG (PIL shapes Arabic correctly)."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    margin = int(W * 0.1)
    max_w = W - margin * 2
    size = 88 if is_hook else 64
    f = load_font(size, 800, arabic)
    lines = wrap_text(d, text, f, max_w)
    # shrink until total block fits
    while len(lines) * (f.size + 14) > H * 0.4 and f.size > 34:
        size -= 6
        f = load_font(size, 800, arabic)
        lines = wrap_text(d, text, f, max_w)
    line_h = f.size + 14
    block_h = len(lines) * line_h
    y = int(H * (0.42 if is_hook else 0.62)) - block_h // 2
    for line in lines:
        tw = d.textlength(shape(line), font=f)
        d.text(
            ((W - tw) / 2, y),
            shape(line),
            font=f,
            fill=(255, 255, 255, 255),
            stroke_width=max(2, f.size // 28),
            stroke_fill=(0, 0, 0, 110),
        )
        y += line_h
    return img


def _dim_bottom(img: Image.Image) -> Image.Image:
    """Adds a bottom-to-top dark gradient so text stays readable over photos."""
    overlay = Image.new("L", (1, H), 0)
    for i in range(H):
        t = i / H
        overlay.putpixel((0, i), int(200 * max(0.0, (t - 0.35) / 0.65) ** 1.4))
    mask = overlay.resize((W, H))
    black = Image.new("RGB", (W, H), (0, 0, 0))
    img = img.convert("RGB")
    img.paste(black, (0, 0), mask)
    return img


def _rgba_clip(pil_img: Image.Image) -> ImageClip:
    """ImageClip with proper alpha mask (RGBA PNG)."""
    arr = np.array(pil_img)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3].astype("float64") / 255.0
    clip = ImageClip(rgb)
    return clip.with_mask(ImageClip(alpha, is_mask=True))


def _brand_card(brand, headline: str, sub: str) -> Image.Image:
    primary = _hex_rgb(brand.get("primary"))
    secondary = _hex_rgb(brand.get("secondary"), (15, 23, 42))
    img = _decorative(gradient_bg((W, H), secondary, primary), primary)
    d = ImageDraw.Draw(img)
    margin = int(W * 0.12)
    max_w = W - margin * 2
    y = int(H * 0.36)
    logo_path = brand.get("logo_path")
    name = brand.get("name") or ""
    if logo_path and os.path.exists(str(logo_path)) and headline:
        try:
            logo = Image.open(str(logo_path)).convert("RGBA")
            if logo.width > 340:
                logo = logo.resize((340, int(logo.height * 340 / logo.width)), Image.LANCZOS)
            img.paste(logo, ((W - logo.width) // 2, y), logo)
            y += logo.height + 40
        except Exception:
            pass
    arabic = is_arabic(headline + name + sub)
    if headline:
        f = load_font(84, 800, arabic)
        for line in wrap_text(d, headline, f, max_w):
            tw = d.textlength(shape(line), font=f)
            d.text(((W - tw) / 2, y), shape(line), font=f, fill=(255, 255, 255))
            y += f.size + 14
        y += 20
    if name and not headline:
        f = load_font(64, 800, arabic)
        tw = d.textlength(shape(name), font=f)
        d.text(((W - tw) / 2, y), shape(name), font=f, fill=(255, 255, 255))
        y += f.size + 16
    if sub:
        f = load_font(38, 500, arabic)
        for line in wrap_text(d, sub, f, max_w):
            tw = d.textlength(shape(line), font=f)
            d.text(((W - tw) / 2, y), shape(line), font=f, fill=(255, 255, 255, 200))
            y += f.size + 10
    return img


def render_reel(payload: dict, out_path: str, progress_cb=None) -> str:
    def report(p: float):
        if progress_cb:
            try:
                progress_cb(int(p * 100))
            except Exception:
                pass

    brand = payload.get("brand") or {}
    scenes = payload.get("scenes") or []
    if not scenes:
        raise ValueError("No scenes to render")
    template = payload.get("template", "minimal")
    cta = (payload.get("cta") or "").strip()
    show_text = payload.get("subtitles", True)
    language = payload.get("language", "en")

    # 1) Voiceover
    voice_path = None
    voice_clip = None
    vo = payload.get("voiceover")
    if vo and vo.get("text") and vo.get("voice"):
        report(0.05)
        import tempfile

        voice_path = os.path.join(tempfile.gettempdir(), f"ss_vo_{random.randint(0, 1 << 30)}.mp3")
        tts_mod.synthesize(vo["text"], vo["voice"], voice_path)
        voice_clip = AudioFileClip(voice_path)

    report(0.15)

    # 2) Scene durations (stretch to match a longer voiceover)
    durations = [max(1.5, min(8.0, float(s.get("duration_sec") or 4))) for s in scenes]
    scenes_total = sum(durations)
    if voice_clip is not None and voice_clip.duration > scenes_total:
        factor = voice_clip.duration / scenes_total
        durations = [d * factor for d in durations]

    intro_dur, outro_dur = 1.4, 2.4
    total = intro_dur + sum(durations) + outro_dur

    # 3) Build clips
    intro_img = _brand_card(brand, "", brand.get("name") or "")
    intro = ImageClip(np.array(intro_img)).with_duration(intro_dur)

    scene_clips = []
    for i, (scene, dur) in enumerate(zip(scenes, durations)):
        base = _dim_bottom(_scene_base(scene, brand))
        clip = ImageClip(np.array(base)).with_duration(dur)
        clip = clip.resized(lambda t, d=dur: 1 + 0.06 * (t / d))  # subtle Ken Burns
        clip = clip.with_position(("center", "center"))
        layers = [clip]
        text = (scene.get("text") or "").strip()
        if show_text and text:
            overlay = _rgba_clip(_text_overlay(text, i == 0, is_arabic(text) or language == "ar"))
            layers.append(overlay.with_duration(dur))
        comp = CompositeVideoClip(layers, size=(W, H)).with_duration(dur)
        scene_clips.append(comp)
        report(0.15 + 0.4 * (i + 1) / len(scenes))

    outro_text = cta or brand.get("name") or ""
    outro_img = _brand_card(brand, outro_text, brand.get("website") or "")
    outro = ImageClip(np.array(outro_img)).with_duration(outro_dur)

    video = concatenate_videoclips([intro, *scene_clips, outro], method="compose")
    report(0.6)

    # 4) Audio
    audio_layers = []
    if voice_clip is not None:
        audio_layers.append(voice_clip.with_start(intro_dur + 0.2))
    music_path = payload.get("music_path")
    if music_path and os.path.exists(str(music_path)):
        try:
            music = AudioFileClip(str(music_path)).with_effects([afx.MultiplyVolume(0.15)])
            music = music.with_effects([afx.AudioLoop(duration=total)]).with_duration(total)
            audio_layers.append(music)
        except Exception:
            pass
    if audio_layers:
        final_audio = CompositeAudioClip(audio_layers).with_duration(video.duration)
        video = video.with_audio(final_audio)

    report(0.65)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    video.write_videofile(
        out_path,
        fps=24,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        threads=os.cpu_count() or 2,
        logger=None,
    )
    report(0.98)

    # cleanup temp audio handle
    if voice_clip is not None:
        try:
            voice_clip.close()
        except Exception:
            pass
        try:
            os.remove(voice_path)
        except Exception:
            pass

    report(1.0)
    return out_path
