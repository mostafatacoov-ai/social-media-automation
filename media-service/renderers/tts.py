"""Free text-to-speech via Microsoft Edge TTS (Arabic + English voices, no API key)."""

import asyncio

import edge_tts


def synthesize(text: str, voice: str, out_path: str) -> str:
    """Synthesizes speech to an mp3 file. Raises on empty text."""

    async def run():
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(out_path)

    text = (text or "").strip()
    if not text:
        raise ValueError("TTS requested but the voiceover script is empty")
    asyncio.run(run())
    return out_path
