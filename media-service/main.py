"""Social Studio — Python media service.

Renders branded post images (Pillow), reels with voiceover (MoviePy + edge-tts),
and exposes a tiny job API used by the Next.js app.

Run from the project root:  npm run media
  (or directly:  uvicorn main:app --port 8000)
"""

import os
import threading
import time
import traceback
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from renderers.image_designer import render_post
from renderers.reel_renderer import render_reel

app = FastAPI(title="Social Studio Media Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()


class ImageRequest(BaseModel):
    template: str = "quote"
    size: dict = {"width": 1080, "height": 1080}
    brand: dict = {}
    fields: dict = {}
    media_dir: str
    out_subdir: str = "templates"


class ReelRequest(BaseModel):
    template: str = "minimal"
    size: dict = {"width": 1080, "height": 1920}
    brand: dict = {}
    language: str = "en"
    scenes: list[dict] = []
    cta: str = ""
    subtitles: bool = True
    voiceover: Optional[dict] = None
    music_path: Optional[str] = None
    media_dir: str
    out_subdir: str = "reels"


@app.get("/health")
def health():
    return {"ok": True, "service": "social-studio-media"}


def _out_path(media_dir: str, subdir: str, ext: str) -> str:
    name = f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}.{ext}"
    return os.path.join(os.path.abspath(media_dir), subdir, name)


@app.post("/render/image")
def render_image(req: ImageRequest):
    size = (int(req.size.get("width", 1080)), int(req.size.get("height", 1080)))
    out = _out_path(req.media_dir, req.out_subdir, "png")
    try:
        path, w, h = render_post(req.template, size, req.brand, req.fields, out)
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Image render failed: {e}") from e
    return {"file_path": _relative(req.media_dir, path), "width": w, "height": h}


@app.post("/render/reel/start")
def start_reel(req: ReelRequest):
    if not req.scenes:
        raise HTTPException(status_code=400, detail="No scenes provided")
    job_id = uuid.uuid4().hex[:12]
    out = _out_path(req.media_dir, req.out_subdir, "mp4")
    with JOBS_LOCK:
        JOBS[job_id] = {"status": "processing", "progress": 2, "file_path": None, "error": None}

    def work():
        try:
            render_reel(
                req.model_dump(exclude={"media_dir", "out_subdir"}),
                out,
                progress_cb=lambda p: _update(job_id, progress=p),
            )
            _update(job_id, status="done", file_path=_relative(req.media_dir, out), progress=100)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            _update(job_id, status="failed", error=str(e))

    threading.Thread(target=work, daemon=True).start()
    return {"job_id": job_id}


@app.get("/render/reel/status/{job_id}")
def reel_status(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Unknown job")
    return job


def _update(job_id: str, **kw):
    with JOBS_LOCK:
        if job_id in JOBS:
            JOBS[job_id].update(kw)


def _relative(media_dir: str, path: str) -> str:
    """Path relative to the shared media dir, forward slashes."""
    rel = os.path.relpath(os.path.abspath(path), os.path.abspath(media_dir))
    return rel.replace("\\", "/")
