/**
 * Secret encryption helpers — AES-256-GCM
 *
 * ใช้ encrypt sensitive values ที่เก็บใน DB (เช่น SMTP password)
 *
 * Key: ENCRYPTION_KEY env var (hex string 64 chars = 32 bytes)
 *   - Generate: `openssl rand -hex 32`
 *   - ตั้งใน Vercel: Settings → Environment Variables
 *
 * Format ของ ciphertext:
 *   "enc:v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>"
 *
 * Backward compat:
 *   - input ไม่ขึ้นต้น "enc:v1:" → legacy plaintext (return เดิม)
 *   - ENCRYPTION_KEY ไม่ตั้ง → encryptSecret() return plaintext (degraded)
 *
 * Server-only — อย่า import ใน client component
 */
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;            // GCM recommended IV length
const KEY_LENGTH = 32;           // AES-256
const PREFIX = "enc:v1:";

let _keyCache: Buffer | null = null;
let _warnedNoKey = false;

function getKey(): Buffer | null {
  if (_keyCache) return _keyCache;
  const hex = process.env.ENCRYPTION_KEY?.trim();
  if (!hex) {
    if (!_warnedNoKey) {
      console.warn(
        "[crypto] ENCRYPTION_KEY not set — secrets stored as plaintext. " +
        "Generate: `openssl rand -hex 32` and set in env.",
      );
      _warnedNoKey = true;
    }
    return null;
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(hex, "hex");
  } catch {
    console.error("[crypto] ENCRYPTION_KEY is not valid hex");
    return null;
  }
  if (buf.length !== KEY_LENGTH) {
    console.error(
      `[crypto] ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars), got ${buf.length} bytes`,
    );
    return null;
  }
  _keyCache = buf;
  return buf;
}

/** สำหรับ test — รีเซ็ต cache */
export function resetKeyCache() {
  _keyCache = null;
  _warnedNoKey = false;
}

/**
 * Encrypt plaintext → "enc:v1:..." format
 * - ไม่มี key → return plaintext (graceful degradation)
 * - input ว่าง → return ""
 * - input encrypted แล้ว → return เดิม (idempotent)
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  if (plaintext.startsWith(PREFIX)) return plaintext;
  const key = getKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

/**
 * Decrypt "enc:v1:..." → plaintext
 * - ไม่ขึ้นต้น prefix → return เดิม (legacy plaintext)
 * - key หายไป / decrypt fail → return "" + log error
 */
export function decryptSecret(ciphertext: string): string {
  if (!ciphertext) return "";
  if (!ciphertext.startsWith(PREFIX)) return ciphertext;

  const key = getKey();
  if (!key) {
    console.error("[crypto] cannot decrypt — ENCRYPTION_KEY missing");
    return "";
  }

  try {
    const parts = ciphertext.slice(PREFIX.length).split(":");
    if (parts.length !== 3) throw new Error("invalid format");
    const [ivHex, tagHex, ctHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const ct = Buffer.from(ctHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch (e) {
    console.error("[crypto] decrypt failed:", e);
    return "";
  }
}

/** True ถ้า value ดูเป็น encrypted */
export function isEncrypted(value: string): boolean {
  return !!value && value.startsWith(PREFIX);
}

/** True ถ้า ENCRYPTION_KEY ถูกตั้งและ valid */
export function hasEncryptionKey(): boolean {
  return getKey() !== null;
}
