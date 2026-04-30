/**
 * Database backup script — export ทุก table เป็น JSON
 *
 * Usage:
 *   node scripts/backup-db.mjs
 *   node scripts/backup-db.mjs --output ./custom-backup-folder
 *
 * Reads from .env.local — ต้องมี:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Output:
 *   backups/YYYY-MM-DD_HH-MM/
 *     ├─ manifest.json       (metadata + counts)
 *     ├─ users.json
 *     ├─ purchase_orders.json
 *     ├─ equipment.json
 *     ├─ withdrawals.json
 *     ├─ budgets.json
 *     ├─ po_deliveries.json
 *     ├─ po_activities.json
 *     ├─ po_comments.json
 *     ├─ notifications.json
 *     ├─ company_settings.json
 *     └─ ...
 *
 * ⚠️ Backup folder อยู่ใน .gitignore — ไม่ commit ขึ้น git
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.resolve(ROOT, ".env.local");

// === Load .env.local manually ===
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

// === Args ===
const argIdx = process.argv.indexOf("--output");
const customOut = argIdx > 0 ? process.argv[argIdx + 1] : null;

// === Tables ที่ backup ===
// เรียงตาม priority — ตัวสำคัญก่อน
const TABLES = [
  "users",
  "company_settings",
  "purchase_orders",
  "equipment",
  "equipment_categories",
  "po_deliveries",
  "po_activities",
  "po_comments",
  "withdrawals",
  "budget_periods",
  "notifications",
  "user_sessions",
  "login_attempts",
];

// === Output folder ===
const now = new Date();
const stamp = now.toISOString()
  .replace(/T/, "_")
  .replace(/:/g, "-")
  .replace(/\..+$/, "");
const outDir = customOut || path.join(ROOT, "backups", stamp);
fs.mkdirSync(outDir, { recursive: true });

console.log(`🗄️  Backup → ${path.relative(ROOT, outDir)}\n`);

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const manifest = {
  backupAt: now.toISOString(),
  supabaseUrl: SUPABASE_URL,
  tables: {},
  totalRows: 0,
  totalFiles: 0,
  version: "1.0",
};

let hasError = false;

for (const table of TABLES) {
  process.stdout.write(`  📥 ${table.padEnd(25)}... `);

  try {
    // Supabase max 1000 rows per query — paginate
    const PAGE_SIZE = 1000;
    let page = 0;
    let allRows = [];
    let done = false;

    while (!done) {
      const { data, error, count } = await sb
        .from(table)
        .select("*", { count: page === 0 ? "exact" : null })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        // Table อาจไม่มี — log แต่ไม่ stop
        console.log(`⚠️  ${error.message}`);
        manifest.tables[table] = { count: 0, error: error.message };
        break;
      }

      allRows = allRows.concat(data ?? []);
      if (!data || data.length < PAGE_SIZE) {
        done = true;
      } else {
        page++;
      }
    }

    if (manifest.tables[table]?.error) continue;

    const filename = `${table}.json`;
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, JSON.stringify(allRows, null, 2));

    const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
    console.log(`✅ ${allRows.length} rows (${sizeMb} MB)`);

    manifest.tables[table] = {
      count: allRows.length,
      file: filename,
      sizeBytes: fs.statSync(outPath).size,
    };
    manifest.totalRows += allRows.length;
    manifest.totalFiles++;
  } catch (e) {
    console.log(`❌ ${e.message}`);
    manifest.tables[table] = { count: 0, error: e.message };
    hasError = true;
  }
}

// === Write manifest ===
const manifestPath = path.join(outDir, "manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// === Summary ===
console.log("\n" + "═".repeat(70));
console.log(`✅ Backup ${manifest.totalFiles}/${TABLES.length} tables`);
console.log(`📊 Total: ${manifest.totalRows.toLocaleString()} rows`);
console.log(`📁 Folder: ${path.relative(ROOT, outDir)}`);
console.log("═".repeat(70));

if (hasError) {
  console.log("\n⚠️  มี table ที่ error — ดู manifest.json");
  process.exit(1);
}

console.log(`\n💡 Restore (ฉุกเฉิน):
   1. Stop application (block writes)
   2. Run restore script: node scripts/restore-db.mjs ${path.relative(ROOT, outDir)}
   3. หรือ import manual ผ่าน Supabase Dashboard → Table → Import CSV/JSON
`);
