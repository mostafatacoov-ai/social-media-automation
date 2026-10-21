import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { mediaAbsPath } from "@/lib/media";
import { getPublisher, PublishMedia } from "@/lib/social";

// Publish orchestration: loads a post, runs the platform adapter, records the result.

export async function publishPost(postId: string): Promise<{ status: string; message?: string }> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      account: true,
      medias: { orderBy: { order: "asc" }, include: { mediaAsset: true } },
    },
  });
  if (!post) throw new Error("Post not found");
  if (post.status === "publishing" || post.status === "published") {
    return { status: post.status };
  }
  if (!post.account) {
    await prisma.post.update({
      where: { id: postId },
      data: { status: "failed", error: "No connected account for this platform — connect one in Settings → Connections." },
    });
    await prisma.publishLog.create({
      data: { postId, platform: post.platform, status: "failed", message: "No connected account" },
    });
    return { status: "failed", message: "No connected account" };
  }

  await prisma.post.update({ where: { id: postId }, data: { status: "publishing", error: null } });

  const publicBase = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
  const medias: PublishMedia[] = post.medias.map((m) => ({
    absPath: mediaAbsPath(m.mediaAsset.filePath),
    publicUrl: `${publicBase}/api/media/${m.mediaAsset.filePath}`,
    mimeType: m.mediaAsset.mimeType,
  }));

  const caption = [post.caption, post.hashtags].filter(Boolean).join("\n\n");

  try {
    const publisher = getPublisher(post.platform);
    const result = await publisher.publish({
      caption,
      medias,
      contentType: post.contentType,
      account: {
        accountName: post.account.accountName,
        externalId: post.account.externalId,
        accessToken: decrypt(post.account.accessToken),
        refreshToken: decrypt(post.account.refreshToken),
        tokenExpiresAt: post.account.tokenExpiresAt,
        meta: JSON.parse(post.account.meta || "{}"),
      },
    });

    if (result.manual) {
      await prisma.post.update({
        where: { id: postId },
        data: { status: "needs_manual", externalId: result.externalId, error: null, publishedAt: new Date() },
      });
      await prisma.publishLog.create({
        data: { postId, platform: post.platform, status: "needs_manual", message: result.message },
      });
      return { status: "needs_manual", message: result.message };
    }

    await prisma.post.update({
      where: { id: postId },
      data: {
        status: "published",
        publishedAt: new Date(),
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        error: null,
      },
    });
    await prisma.publishLog.create({
      data: { postId, platform: post.platform, status: "published", message: result.message || "OK" },
    });
    return { status: "published" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown publish error";
    await prisma.post.update({
      where: { id: postId },
      data: { status: "failed", error: message.slice(0, 1000), retryCount: { increment: 1 } },
    });
    await prisma.publishLog.create({
      data: { postId, platform: post.platform, status: "failed", message: message.slice(0, 1000) },
    });
    return { status: "failed", message };
  }
}

// Used by the in-process cron and the external cron endpoint.
export async function publishDuePosts(): Promise<number> {
  const due = await prisma.post.findMany({
    where: { status: "scheduled", scheduledAt: { lte: new Date() } },
    select: { id: true },
  });
  let count = 0;
  for (const p of due) {
    await publishPost(p.id);
    count++;
  }
  return count;
}
