export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateOpts {
  maxTokens?: number;
  temperature?: number;
}

export interface TextProvider {
  id: string;
  generate(messages: ChatMessage[], opts?: GenerateOpts): Promise<string>;
  generateJSON<T>(system: string, user: string, opts?: GenerateOpts): Promise<T>;
}

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

export interface ImageProvider {
  id: string;
  generateImage(
    prompt: string,
    opts?: { size?: ImageSize }
  ): Promise<{ base64: string; mimeType: string }>;
}

export class AiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "AiError";
  }
}

// Extract the first JSON object/array from a model response.
export function extractJson<T>(raw: string): T {
  let text = raw.trim();
  // strip markdown code fences
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(text) as T;
  } catch {
    /* fall through */
  }
  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  let start = -1;
  if (firstObj >= 0 && firstArr >= 0) start = Math.min(firstObj, firstArr);
  else start = Math.max(firstObj, firstArr);
  if (start >= 0) {
    const lastObj = text.lastIndexOf("}");
    const lastArr = text.lastIndexOf("]");
    const end = Math.max(lastObj, lastArr);
    if (end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
  }
  throw new AiError("Model did not return valid JSON. Try again or switch model. Response started with: " + raw.slice(0, 120));
}
