import { AiError, GenerateOpts, TextProvider, extractJson } from "../types";

// Google Gemini — text via generateContent.

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export function createGoogleText(apiKey: string, model: string): TextProvider {
  async function call(system: string, user: string, opts?: GenerateOpts): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          maxOutputTokens: opts?.maxTokens ?? 4000,
          temperature: opts?.temperature ?? 0.7,
        },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) {
      throw new AiError(
        `Google API error ${res.status}: ${body.error?.message || res.statusText}`,
        res.status
      );
    }
    const text = (body.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("");
    if (!text) throw new AiError("Google returned an empty response.");
    return text;
  }

  return {
    id: "google",
    async generate(messages, opts) {
      const system = messages.find((m) => m.role === "system")?.content || "";
      const rest = messages.filter((m) => m.role !== "system");
      return call(system, rest.map((m) => m.content).join("\n\n"), opts);
    },
    async generateJSON<T>(system, user, opts) {
      const raw = await call(system, user, {
        ...opts,
        temperature: opts?.temperature ?? 0.4,
      });
      return extractJson<T>(raw);
    },
  };
}
