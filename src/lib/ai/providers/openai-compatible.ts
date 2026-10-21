import {
  AiError,
  ChatMessage,
  GenerateOpts,
  TextProvider,
  extractJson,
} from "../types";

// Shared implementation for OpenAI-compatible chat APIs (OpenAI + OpenRouter).

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export function createOpenAICompatibleText(
  id: string,
  apiKey: string,
  baseUrl: string,
  model: string
): TextProvider {
  async function call(messages: ChatMessage[], opts?: GenerateOpts): Promise<string> {
    const res = await fetch(baseUrl + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts?.maxTokens ?? 4000,
        temperature: opts?.temperature ?? 0.7,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as ChatResponse;
    if (!res.ok) {
      throw new AiError(
        `${id} API error ${res.status}: ${body.error?.message || res.statusText}`,
        res.status
      );
    }
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new AiError(`${id} returned an empty response.`);
    return content;
  }

  return {
    id,
    async generate(messages, opts) {
      return call(messages, opts);
    },
    async generateJSON<T>(system, user, opts) {
      const raw = await call(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { ...opts, temperature: opts?.temperature ?? 0.4 }
      );
      return extractJson<T>(raw);
    },
  };
}
