/**
 * Password verification — รองรับทั้ง bcrypt (current) และ SHA-256 (legacy)
 * เหมือน Python verify_user — auto-upgrade ตอน login สำเร็จ
 */
import bcrypt from "bcryptjs";
import { createHash } from "crypto";

export function isLegacySha256(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash) && !hash.startsWith("$2");
}

export function verifyLegacySha256(password: string, hash: string): boolean {
  const computed = createHash("sha256").update(password, "utf8").digest("hex");
  return computed === hash;
}

export async function verifyBcrypt(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export async function hashBcrypt(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export interface PasswordValidation {
  ok: boolean;
  message: string;
}

export function validatePassword(pwd: string, username = ""): PasswordValidation {
  const MIN = 8;
  if (!pwd || pwd.length < MIN) {
    return { ok: false, message: `รหัสผ่านต้องยาวอย่างน้อย ${MIN} ตัวอักษร` };
  }
  if (username && pwd.toLowerCase() === username.toLowerCase()) {
    return { ok: false, message: "รหัสผ่านห้ามเหมือน username" };
  }
  if (!/[A-Za-z]/.test(pwd)) {
    return { ok: false, message: "ต้องมีตัวอักษรอย่างน้อย 1 ตัว" };
  }
  if (!/[0-9]/.test(pwd)) {
    return { ok: false, message: "ต้องมีตัวเลขอย่างน้อย 1 ตัว" };
  }
  const weak = ["password", "12345678", "qwerty", "admin123",
                "staff123", "password1", "password123", "letmein"];
  if (weak.includes(pwd.toLowerCase())) {
    return { ok: false, message: "รหัสผ่านนี้อ่อนแอเกินไป" };
  }
  return { ok: true, message: "OK" };
}
