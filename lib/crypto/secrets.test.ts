/**
 * Unit tests for secrets.ts (AES-256-GCM encryption helpers)
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  encryptSecret, decryptSecret, isEncrypted, hasEncryptionKey, resetKeyCache,
} from "./secrets";

const TEST_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64 hex chars = 32 bytes

describe("secrets — without ENCRYPTION_KEY", () => {
  beforeEach(() => {
    delete process.env.ENCRYPTION_KEY;
    resetKeyCache();
  });

  it("encryptSecret returns plaintext (degraded mode)", () => {
    expect(encryptSecret("hello")).toBe("hello");
  });

  it("decryptSecret on plaintext returns same string", () => {
    expect(decryptSecret("plaintext-pw")).toBe("plaintext-pw");
  });

  it("hasEncryptionKey returns false", () => {
    expect(hasEncryptionKey()).toBe(false);
  });

  it("encryptSecret on empty returns empty", () => {
    expect(encryptSecret("")).toBe("");
  });
});

describe("secrets — with valid ENCRYPTION_KEY", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    resetKeyCache();
  });

  it("hasEncryptionKey returns true", () => {
    expect(hasEncryptionKey()).toBe(true);
  });

  it("encryptSecret produces enc:v1: prefixed output", () => {
    const ct = encryptSecret("my-password");
    expect(ct).toMatch(/^enc:v1:/);
    expect(isEncrypted(ct)).toBe(true);
  });

  it("encrypt → decrypt roundtrip works", () => {
    const original = "Gmail-App-Password-16chars";
    const encrypted = encryptSecret(original);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(original);
  });

  it("encrypt is non-deterministic (different IV)", () => {
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
    // แต่ทั้งคู่ decrypt ได้ result เดียวกัน
    expect(decryptSecret(a)).toBe("same-input");
    expect(decryptSecret(b)).toBe("same-input");
  });

  it("encrypt is idempotent (re-encrypt skips)", () => {
    const ct = encryptSecret("password");
    const ct2 = encryptSecret(ct);
    expect(ct2).toBe(ct); // ไม่ encrypt ซ้อน
  });

  it("decrypt on legacy plaintext returns it as-is", () => {
    expect(decryptSecret("legacy-plain")).toBe("legacy-plain");
  });

  it("decrypt on tampered ciphertext returns empty", () => {
    const valid = encryptSecret("real");
    const tampered = valid.slice(0, -2) + "ff"; // mess with auth tag
    expect(decryptSecret(tampered)).toBe("");
  });

  it("decrypt on malformed prefix returns empty", () => {
    expect(decryptSecret("enc:v1:invalid")).toBe("");
  });

  it("supports unicode + Thai characters", () => {
    const original = "ทดสอบ-รหัส-🔐";
    expect(decryptSecret(encryptSecret(original))).toBe(original);
  });

  it("supports long strings", () => {
    const long = "x".repeat(10_000);
    expect(decryptSecret(encryptSecret(long))).toBe(long);
  });
});

describe("secrets — with invalid ENCRYPTION_KEY", () => {
  beforeEach(() => resetKeyCache());

  it("rejects key shorter than 32 bytes", () => {
    process.env.ENCRYPTION_KEY = "abcd"; // too short
    resetKeyCache();
    expect(hasEncryptionKey()).toBe(false);
    expect(encryptSecret("test")).toBe("test"); // degraded
  });

  it("rejects non-hex key", () => {
    process.env.ENCRYPTION_KEY = "not-hex-zzzz".repeat(8); // 96 chars but not hex
    resetKeyCache();
    // Buffer.from("not hex", "hex") returns truncated buffer — check length
    // อาจจะ valid length หรือไม่ ขึ้นกับ string — เราตรวจ length และ valid hex
    // ในที่นี้ expect ว่า key validation fail
    const result = hasEncryptionKey();
    expect(result).toBe(false);
  });
});

describe("isEncrypted helper", () => {
  it("detects valid prefix", () => {
    expect(isEncrypted("enc:v1:abc:def:123")).toBe(true);
  });

  it("rejects plain string", () => {
    expect(isEncrypted("plaintext")).toBe(false);
  });

  it("rejects empty", () => {
    expect(isEncrypted("")).toBe(false);
  });
});
