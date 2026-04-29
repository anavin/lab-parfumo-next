/**
 * One-time script: เพิ่ม user หลายคนพร้อมกัน
 *
 * Usage:
 *   node scripts/add-users.mjs
 *
 * Reads from .env.local — ต้องมี:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * แต่ละ user จะได้:
 *   - Random temp password (12 chars alphanumeric, รองรับเกณฑ์ validatePassword)
 *   - must_change_password = true (บังคับเปลี่ยนเมื่อ login ครั้งแรก)
 *   - role = "requester" (Staff)
 *
 * ⚠️ Display temp passwords ใน console — copy ส่งให้ user เอง
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "..", ".env.local");

// === Load .env.local manually (ไม่ pull dotenv) ===
function loadEnv(file) {
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnv(ENV_PATH);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing env: NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// === Users ที่จะเพิ่ม ===
const USERS = [
  {
    fullName: "อนันตชัย จันทศรี",
    username: "jom",
    email: "jomanantachai2542@gmail.com",
    role: "requester",
  },
  {
    fullName: "กิตติพันธ์ บุราคร",
    username: "art",
    email: "Kittipan.burakorn@gmail.com",
    role: "requester",
  },
  {
    fullName: "อนุพงศ์ สีสุวรรณ",
    username: "note",
    email: "anupong254117@gmail.com",
    role: "requester",
  },
];

// === Password generator ===
// 12 ตัว: ผสม upper + lower + digits — ผ่านเกณฑ์ validatePassword
function generatePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // ตัด I, O เพื่อกัน confusion
  const lower = "abcdefghijkmnpqrstuvwxyz";   // ตัด l, o
  const digits = "23456789";                  // ตัด 0, 1
  const all = upper + lower + digits;

  // บังคับให้มีอย่างน้อย 1 ตัวอักษร + 1 ตัวเลข (ตามเกณฑ์ validatePassword)
  let pwd = "";
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  for (let i = pwd.length; i < 12; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  // shuffle
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
}

// === Main ===
const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("🔐 เริ่มเพิ่ม users — ใช้ bcrypt rounds 14 (~1s/hash)\n");

const results = [];

for (const u of USERS) {
  const password = generatePassword();
  const hash = await bcrypt.hash(password, 14);

  process.stdout.write(`  ⏳ ${u.username.padEnd(8)} ${u.fullName}... `);

  const { data, error } = await sb
    .from("users")
    .insert({
      username: u.username,
      password_hash: hash,
      full_name: u.fullName.trim(),
      role: u.role,
      email: u.email.trim(),
      must_change_password: true,
      is_active: true,
    })
    .select()
    .maybeSingle();

  if (error) {
    const isDup = String(error.message || "").toLowerCase().includes("duplicate");
    console.log(isDup ? "⚠️  มีอยู่แล้ว (skip)" : `❌ ${error.message}`);
    results.push({ ...u, password, status: isDup ? "duplicate" : "error", error: error.message });
  } else {
    console.log(`✅ id: ${data.id.slice(0, 8)}...`);
    results.push({ ...u, password, status: "created", id: data.id });
  }
}

// === Summary ===
console.log("\n" + "═".repeat(80));
console.log("📋 สรุป — Temp Passwords (Copy ส่งให้ user)");
console.log("═".repeat(80));
console.log("");
console.log("⚠️  user จะถูกบังคับเปลี่ยน password ตอน login ครั้งแรก");
console.log("");

const created = results.filter((r) => r.status === "created");
const dupes = results.filter((r) => r.status === "duplicate");
const errors = results.filter((r) => r.status === "error");

if (created.length > 0) {
  console.log("✅ สร้างสำเร็จ:");
  console.log("");
  for (const r of created) {
    console.log(`   ${r.fullName}`);
    console.log(`   • Username:  ${r.username}`);
    console.log(`   • Password:  ${r.password}`);
    console.log(`   • Email:     ${r.email}`);
    console.log("");
  }
}

if (dupes.length > 0) {
  console.log("⚠️  Username ซ้ำ (ไม่ได้สร้าง):");
  for (const r of dupes) console.log(`   • ${r.username} — ${r.fullName}`);
  console.log("");
}

if (errors.length > 0) {
  console.log("❌ Error:");
  for (const r of errors) console.log(`   • ${r.username} — ${r.error}`);
  console.log("");
}

console.log("═".repeat(80));
console.log(`สร้าง ${created.length}/${USERS.length} • duplicate ${dupes.length} • error ${errors.length}`);
console.log("═".repeat(80));
