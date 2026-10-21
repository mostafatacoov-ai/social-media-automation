import path from "path";
import { prisma } from "@/lib/db";
import { getImageProvider, ImageSize } from "@/lib/ai";
import { mediaAbsPath, mediaService, MEDIA_DIR, saveMediaBuffer } from "@/lib/media";

// Shared visual-generation helpers used by the API routes, the Designer
// agent's quick task, and the Autopilot pipeline.

export type TemplateId = "quote" | "stat" | "announcement" | "showcase" | "tip";
export type Aspect = "square" | "portrait" | "story";

const TEMPLATE_SIZES: Record<Aspect, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

export async function renderTemplateImage(
  company: { id: string; name: string; primaryColor: string; secondaryColor: string; website: string; logoPath: string },
  fields: { template: TemplateId; aspect: Aspect; headline: string; subline?: string; badge?: string; footer?: string }
) {
  const size = TEMPLATE_SIZES[fields.aspect || "square"];
  const result = await mediaService<{ file_path: string; width: number; height: number }>(
    "/render/image",
    {
      method: "POST",
      body: JSON.stringify({
        template: fields.template,
        size,
        brand: {
          name: company.name,
          primary: company.primaryColor,
          secondary: company.secondaryColor,
          website: company.website,
          logo_path: company.logoPath ? mediaAbsPath(company.logoPath) : null,
        },
        fields: {
          headline: fields.headline || "",
          subline: fields.subline || "",
          badge: fields.badge || "",
          footer: fields.footer || company.website || "",
        },
        media_dir: MEDIA_DIR,
        out_subdir: "templates",
      }),
    }
  );
  const rel = path.relative(MEDIA_DIR, mediaAbsPath(result.file_path)).split(path.sep).join("/");
  return prisma.mediaAsset.create({
    data: {
      companyId: company.id,
      kind: "template_image",
      filePath: rel,
      mimeType: "image/png",
      width: result.width || size.width,
      height: result.height || size.height,
      meta: JSON.stringify({ template: fields.template }),
    },
  });
}

const AI_SIZES: Record<Aspect, ImageSize> = {
  square: "1024x1024",
  portrait: "1024x1536",
  story: "1024x1536",
};

export async function generateAiImage(companyId: string, prompt: string, aspect: Aspect = "square") {
  const provider = await getImageProvider();
  const { base64, mimeType } = await provider.generateImage(prompt, { size: AI_SIZES[aspect] });
  const ext = mimeType.includes("jpeg") ? "jpg" : "png";
  const { relativePath } = saveMediaBuffer(Buffer.from(base64, "base64"), "ai", ext);
  const dims = { square: [1024, 1024], portrait: [1024, 1536], story: [1024, 1536] }[aspect];
  return prisma.mediaAsset.create({
    data: {
      companyId,
      kind: "ai_image",
      filePath: relativePath,
      mimeType,
      width: dims[0],
      height: dims[1],
      meta: JSON.stringify({ prompt: prompt.slice(0, 500) }),
    },
  });
}

export function attachMedia(postId: string, mediaAssetId: string, order = 0) {
  return prisma.postMedia.create({ data: { postId, mediaAssetId, order } });
}
