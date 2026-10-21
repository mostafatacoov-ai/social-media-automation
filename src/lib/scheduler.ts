import cron from "node-cron";
import { publishDuePosts } from "@/lib/publish";

const g = globalThis as unknown as { __ssScheduler?: boolean };

// Boots with the Next.js server (see instrumentation.ts): publishes due posts every minute.
export function startScheduler() {
  if (g.__ssScheduler) return;
  g.__ssScheduler = true;
  cron.schedule("* * * * *", async () => {
    try {
      const n = await publishDuePosts();
      if (n > 0) console.log(`[scheduler] published ${n} post(s)`);
    } catch (e) {
      console.error("[scheduler] error:", e);
    }
  });
  console.log("[scheduler] started — checking for due posts every minute");
}
