import { AiError, GenerateOpts, TextProvider, extractJson } from "../types";

interface AnthropicResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

export function createAnthropicText(apiKey: string, model: string): TextProvider {
  async function call(system: string, user: string, opts?: GenerateOpts): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        system,
        max_tokens: opts?.maxTokens ?? 4000,
        temperature: opts?.temperature ?? 0.7,
        messages: [{ role: "user", content: user }],
      }),
    });
    const body = (await res.json().catch(() => ({}))) as AnthropicResponse;
    if (!res.ok) {
      throw new AiError(
        `Anthropic API error ${res.status}: ${body.error?.message || res.statusText}`,
        res.status
      );
    }
    const text = (body.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("");
    if (!text) throw new AiError("Anthropic returned an empty response.");
    return text;
  }

  return {
    id: "anthropic",
    async generate(messages, opts) {
      const system = messages.find((m) => m.role === "system")?.content || "";
      const rest = messages.filter((m) => m.role !== "system");
      const user = rest.map((m) => m.content).join("\n\n");
      return call(system, `Conversation:\n${user}`, opts);
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
