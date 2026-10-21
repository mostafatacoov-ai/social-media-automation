import { AiError, ImageProvider, ImageSize } from "../types";

const OPENAI_SIZES: ImageSize[] = ["1024x1024", "1024x1536", "1536x1024"];

// OpenAI Images API (gpt-image-1 family) — returns base64 PNG.
export function createOpenAIImage(apiKey: string, model: string): ImageProvider {
  return {
    id: "openai",
    async generateImage(prompt, opts) {
      const size = opts?.size && OPENAI_SIZES.includes(opts.size) ? opts.size : "1024x1024";
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, prompt, size, n: 1 }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new AiError(
          `OpenAI image error ${res.status}: ${body?.error?.message || res.statusText}`,
          res.status
        );
      }
      const b64 = body?.data?.[0]?.b64_json;
      if (!b64) throw new AiError("OpenAI image response contained no image data.");
      return { base64: b64, mimeType: "image/png" };
    },
  };
}

// Google Gemini image generation (e.g. gemini-2.5-flash-image) via generateContent.
export function createGoogleImage(apiKey: string, model: string): ImageProvider {
  return {
    id: "google",
    async generateImage(prompt) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new AiError(
          `Google image error ${res.status}: ${body?.error?.message || res.statusText}`,
          res.status
        );
      }
      const parts = body?.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find((p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data);
      if (!imgPart?.inlineData?.data) {
        throw new AiError("Google image response contained no image data.");
      }
      return {
        base64: imgPart.inlineData.data,
        mimeType: imgPart.inlineData.mimeType || "image/png",
      };
    },
  };
}
