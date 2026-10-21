import { AiSettings, getAiSettings } from "@/lib/settings";
import { AiError, ImageProvider, TextProvider } from "./types";
import { createOpenAICompatibleText } from "./providers/openai-compatible";
import { createAnthropicText } from "./providers/anthropic";
import { createGoogleText } from "./providers/google";
import { createGoogleImage, createOpenAIImage } from "./providers/images";

// Resolve the configured text provider, verifying the API key exists.
export async function getTextProvider(settings?: AiSettings): Promise<TextProvider> {
  const s = settings || (await getAiSettings());
  const cfg = s.providers[s.textProvider];
  if (!cfg?.apiKey) {
    throw new AiError(
      `No API key configured for text provider "${s.textProvider}". Add it in Settings → AI.`
    );
  }
  switch (s.textProvider) {
    case "openai":
      return createOpenAICompatibleText("openai", cfg.apiKey, "https://api.openai.com/v1", s.textModel);
    case "openrouter":
      return createOpenAICompatibleText(
        "openrouter",
        cfg.apiKey,
        "https://openrouter.ai/api/v1",
        s.textModel
      );
    case "anthropic":
      return createAnthropicText(cfg.apiKey, s.textModel);
    case "google":
      return createGoogleText(cfg.apiKey, s.textModel);
    default:
      throw new AiError(`Unknown text provider: ${s.textProvider}`);
  }
}

export async function getImageProvider(settings?: AiSettings): Promise<ImageProvider> {
  const s = settings || (await getAiSettings());
  if (s.imageProvider === "none") {
    throw new AiError(
      "No image provider configured. Choose one in Settings → AI (OpenAI or Google keys support image generation)."
    );
  }
  const cfg = s.providers[s.imageProvider];
  if (!cfg?.apiKey) {
    throw new AiError(
      `No API key configured for image provider "${s.imageProvider}". Add it in Settings → AI.`
    );
  }
  if (s.imageProvider === "openai") return createOpenAIImage(cfg.apiKey, s.imageModel);
  return createGoogleImage(cfg.apiKey, s.imageModel);
}

export { AiError };
export * from "./types";
