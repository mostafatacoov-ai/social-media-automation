import crypto from "crypto";

// AES-256-GCM encryption for API keys and OAuth tokens at rest.

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY || "";
  if (raw.length !== 64 || !/^[0-9a-f]+$/i.test(raw)) {
    // Fallback derived key so the app never crashes — but warn loudly.
    console.warn(
      "[crypto] APP_ENCRYPTION_KEY is missing/invalid (expected 64 hex chars). Deriving a key from SESSION_SECRET."
    );
    return crypto
      .createHash("sha256")
      .update(process.env.SESSION_SECRET || "social-studio-dev")
      .digest();
  }
  return Buffer.from(raw, "hex");
}

export function encrypt(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(stored: string): string {
  if (!stored) return "";
  if (!stored.startsWith("enc:v1:")) return stored; // plaintext fallback (legacy)
  try {
    const [, , ivB64, tagB64, dataB64] = stored.split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  } catch {
    return "";
  }
}
