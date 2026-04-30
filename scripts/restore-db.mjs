/**
 * Database restore script — restore JSON backup กลับไป Supabase
 *
 * ⚠️ WARNING: ทำลาย data ปัจจุบัน — ใช้ในกรณีฉุกเฉินเท่านั้น
 *
 * Usage:
 *   node scripts/restore-db.mjs backups/2026-04-30_01-59-29
 *   node scripts/restore-db.mjs <folder> --dry-run     # ดูเฉยๆ ไม่เขียน DB
 *   node scripts/restore-db.mjs <folder> --tables=users,equipment    # restore เฉพาะ table
 *   node scripts/restore-db.mjs <folder> --skip-confirm    # ข้าม confirm prompt
 *
 * วิธีทำงาน:
 *   1. อ่าน manifest.json → ดู table list + counts
 *   2. ขอ confirm จาก user
 *   3. สำหรับแต่ละ table:
 *      - DELETE rows เดิมทั้งหมด
 *      - INSERT rows จาก JSON
 *
 * ⚠️ ลำดับสำคัญ — restore parent ก่อน child (FK constraint)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.resolve(ROOT, ".env.local");

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
  console.error("❌ Missing env vars");
  process.exit(1);
}

// === Args ===
const folder = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
const skipConfirm = process.argv.includes("--skip-confirm");
const tablesArg = process.argv.find((a) => a.startsWith("--tables="));
const onlyTables = tablesArg ? tablesArg.split("=")[1].split(",") : null;

if (!folder) {
  console.error("❌ Usage: node scripts/restore-db.mjs <backup-folder>");
  console.error("   เช่น:  node scripts/restore-db.mjs backups/2026-04-30_01-59-29");
  process.exit(1);
}

const backupDir = path.isAbsolute(folder) ? folder : path.join(ROOT, folder);
if (!fs.existsSync(backupDir)) {
  console.error(`❌ Folder ไม่พบ: ${backupDir}`);
  process.exit(1);
}

const manifestPath = path.join(backupDir, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error(`❌ ไม่พบ manifest.json ใน ${backupDir}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// === Restore order — parent ก่อน child (FK constraint safety) ===
// เรียง: lookup tables → master data → transactional
const RESTORE_ORDER = [
  "users",                  // referenced by เกือบทุก table
  "company_settings",
  "equipment_categories",
  "equipment",              // referenced by withdrawals, po_items
  "purchase_orders",        // referenced by po_deliveries, po_activities, po_comments
  "po_deliveries",
  "po_activities",
  "po_comments",
  "withdrawals",
  "budget_periods",
  "notifications",          // references po_id + user_id
  "user_sessions",
  "login_attempts",
];

// === Print summary ===
console.log("\n📋 Restore Plan");
console.log("═".repeat(70));
console.log(`Source:     ${path.relative(ROOT, backupDir)}`);
console.log(`Backed up:  ${manifest.backupAt}`);
console.log(`Target:     ${SUPABASE_URL}`);
console.log(`Mode:       ${dryRun ? "🔍 DRY-RUN (ไม่เขียน DB)" : "⚠️  WRITE (ทำลาย data ปัจจุบัน)"}`);
console.log("");
console.log("Tables ที่จะ restore:");

const willRestore = RESTORE_ORDER.filter((t) => {
  const meta = manifest.tables?.[t];
  if (!meta || meta.error) return false;
  if (onlyTables && !onlyTables.includes(t)) return false;
  return true;
});

for (const t of willRestore) {
  const meta = manifest.tables[t];
  console.log(`  • ${t.padEnd(25)} ${meta.count.toString().padStart(5)} rows`);
}

if (willRestore.length === 0) {
  console.log("\n❌ ไม่มี table ให้ restore");
  process.exit(1);
}

console.log("═".repeat(70));

// === Confirm ===
if (!dryRun && !skipConfirm) {
  console.log("\n⚠️  WARNING: จะลบ data ทุก row ใน table ข้างบน + replace ด้วย backup");
  console.log("   ถ้ามี data ใหม่หลัง backup → จะ**หาย**");
  console.log("");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirm = await new Promise((resolve) => {
    rl.question('พิมพ์ "RESTORE" (ตัวพิมพ์ใหญ่) เพื่อยืนยัน: ', (ans) => {
      rl.close();
      resolve(ans);
    });
  });

  if (confirm !== "RESTORE") {
    console.log("❌ ยกเลิก");
    process.exit(0);
  }
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("\n🚀 เริ่ม restore...\n");

for (const table of willRestore) {
  process.stdout.write(`  📤 ${table.padEnd(25)}... `);

  const filePath = path.join(backupDir, `${table}.json`);
  if (!fs.existsSync(filePath)) {
    console.log("⚠️  ไม่พบไฟล์ — skip");
    continue;
  }

  const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(rows)) {
    console.log("❌ JSON format ผิด");
    continue;
  }

  if (dryRun) {
    console.log(`✓ ${rows.length} rows (dry-run)`);
    continue;
  }

  try {
    // Delete all existing rows
    const { error: delErr } = await sb.from(table).delete().not("id", "is", null);
    if (delErr) {
      // table อาจไม่มี id column (เช่น login_attempts) — ลอง pattern อื่น
      const { error: delErr2 } = await sb.from(table).delete().gt(
        Object.keys(rows[0] ?? {})[0] ?? "id", "00000000-0000-0000-0000-000000000000"
      );
      if (delErr2) {
        console.log(`⚠️  delete fail: ${delErr.message}`);
      }
    }

    // Insert in batches of 500 (avoid request size limit)
    if (rows.length > 0) {
      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error: insErr } = await sb.from(table).insert(batch);
        if (insErr) {
          console.log(`❌ insert fail (batch ${i / BATCH + 1}): ${insErr.message}`);
          break;
        }
      }
    }

    console.log(`✅ restored ${rows.length} rows`);
  } catch (e) {
    console.log(`❌ ${e.message}`);
  }
}

console.log("\n" + "═".repeat(70));
if (dryRun) {
  console.log("🔍 DRY-RUN สำเร็จ — ไม่ได้เขียน DB");
} else {
  console.log("✅ Restore เสร็จ — ตรวจสอบข้อมูลในแอป");
  console.log("\n💡 ถ้าต้องการ logout user ทั้งหมด (เพื่อให้ session ใหม่):");
  console.log("   เปิด Supabase Dashboard → user_sessions → DELETE ALL");
}
console.log("═".repeat(70));
