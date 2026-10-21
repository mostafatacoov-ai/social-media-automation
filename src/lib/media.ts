import fs from "fs";
import path from "path";
import crypto from "crypto";

// Media storage + Python media-service client.

export const MEDIA_DIR = path.resolve(process.cwd(), process.env.MEDIA_DIR || "./data/media");
export const MEDIA_SERVICE_URL =
  process.env.MEDIA_SERVICE_URL || "http://127.0.0.1:8000";

export function ensureMediaDir(subdir = "") {
  const dir = subdir ? path.join(MEDIA_DIR, subdir) : MEDIA_DIR;
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function mediaUrl(relativePath: string) {
  return `/api/media/${relativePath.split(path.sep).join("/")}`;
}

export function mediaAbsPath(relativePath: string) {
  return path.join(MEDIA_DIR, relativePath);
}

export function saveMediaBuffer(
  buffer: Buffer,
  subdir: string,
  ext: string
): { relativePath: string } {
  ensureMediaDir(subdir);
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${ext}`;
  const relativePath = `${subdir}/${name}`;
  fs.writeFileSync(path.join(MEDIA_DIR, relativePath), buffer);
  return { relativePath };
}

export async function mediaService<T = unknown>(
  route: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs = 300000, ...rest } = init || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${MEDIA_SERVICE_URL}${route}`, {
      ...rest,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(rest.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        `Media service error ${res.status}: ${(body as { detail?: string }).detail || res.statusText}`
      );
    }
    return body as T;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Media service timed out. Is it running? (npm run media)");
    }
    if (e instanceof TypeError) {
      throw new Error(
        "Cannot reach the Python media service. Start it with: npm run media"
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkMediaService(): Promise<boolean> {
  try {
    const res = await fetch(`${MEDIA_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
