/**
 * Unit tests for password.ts (validation + bcrypt + legacy SHA-256)
 */
import { describe, it, expect } from "vitest";
import {
  validatePassword, isLegacySha256, verifyLegacySha256,
  hashBcrypt, verifyBcrypt,
} from "./password";

describe("validatePassword", () => {
  it("accepts strong password", () => {
    expect(validatePassword("MySecure123").ok).toBe(true);
    expect(validatePassword("HelloWorld42").ok).toBe(true);
  });

  it("rejects too short", () => {
    const r = validatePassword("Ab1");
    expect(r.ok).toBe(false);
    expect(r.message).toContain("8");
  });

  it("rejects no letters", () => {
    expect(validatePassword("12345678").ok).toBe(false);
  });

  it("rejects no digits", () => {
    expect(validatePassword("OnlyLetters").ok).toBe(false);
  });

  it("rejects same as username", () => {
    expect(validatePassword("johnsmith", "johnsmith").ok).toBe(false);
    expect(validatePassword("JohnSmith", "johnsmith").ok).toBe(false); // case-insensitive
  });

  it("rejects weak common passwords", () => {
    expect(validatePassword("password").ok).toBe(false);
    expect(validatePassword("admin123").ok).toBe(false);
    expect(validatePassword("staff123").ok).toBe(false);
    expect(validatePassword("12345678").ok).toBe(false); // also fails "no letters"
  });

  it("accepts password with special chars", () => {
    expect(validatePassword("Pass@word1").ok).toBe(true);
  });
});

describe("isLegacySha256", () => {
  it("detects SHA-256 hex hash (64 chars)", () => {
    const sha = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    expect(isLegacySha256(sha)).toBe(true);
  });

  it("rejects bcrypt hash", () => {
    expect(isLegacySha256("$2a$12$abcdefghijklmnopqrstuvwxyz")).toBe(false);
    expect(isLegacySha256("$2b$14$xyz")).toBe(false);
  });

  it("rejects too short", () => {
    expect(isLegacySha256("abc")).toBe(false);
  });

  it("rejects non-hex chars", () => {
    expect(isLegacySha256("z".repeat(64))).toBe(false);
  });
});

describe("verifyLegacySha256", () => {
  it("verifies correct password against SHA-256 hash", () => {
    // SHA-256("test123") in hex
    const hash = "ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae";
    expect(verifyLegacySha256("test123", hash)).toBe(true);
  });

  it("rejects wrong password", () => {
    const hash = "ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae";
    expect(verifyLegacySha256("wrong", hash)).toBe(false);
  });
});

// bcrypt 14 rounds takes ~1s/op — set higher timeout for whole suite
describe("hashBcrypt + verifyBcrypt — roundtrip", { timeout: 30_000 }, () => {
  it("hashes and verifies a password", async () => {
    const pwd = "TestPass123";
    const hash = await hashBcrypt(pwd);
    expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
    expect(await verifyBcrypt(pwd, hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashBcrypt("RealPass1");
    expect(await verifyBcrypt("WrongPass1", hash)).toBe(false);
  });

  it("uses cost factor 14 (audit fix)", async () => {
    const hash = await hashBcrypt("dummy123");
    // bcrypt format: $2X$NN$... where NN = cost factor
    const match = hash.match(/^\$2[ab]\$(\d{2})\$/);
    expect(match).toBeTruthy();
    expect(parseInt(match![1], 10)).toBe(14);
  });

  it("verifyBcrypt returns false on empty inputs", async () => {
    expect(await verifyBcrypt("", "any")).toBe(false);
    expect(await verifyBcrypt("any", "")).toBe(false);
  });

  it("verifyBcrypt returns false on malformed hash", async () => {
    expect(await verifyBcrypt("password", "not-a-bcrypt-hash")).toBe(false);
  });
});
