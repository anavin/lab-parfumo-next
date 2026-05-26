/**
 * Soft-delete filter tolerance
 *
 * The new "ถังขยะ" feature adds a `deleted_at` column to purchase_orders +
 * suppliers via migration 202605_soft_delete.sql. If the migration hasn't
 * run yet (or the column is gone for any reason), every read query that
 * filters `is("deleted_at", null)` would error and return empty data —
 * making it look like ALL records disappeared.
 *
 * This module exposes:
 *   - `runWithSoftDeleteFallback(...)`: try the query with the filter;
 *     on undefined_column error retry without it.
 *   - `markTrashColumnMissing(err)`: remember the missing-column state
 *     across requests so we stop retrying once we know it's missing.
 *
 * Once the admin runs the migration, the next deploy / server restart
 * picks up the column and queries resume filtering normally.
 */

// TTL-cached state — กัน Vercel hot function instance ที่จำ "missing"
// จากตอนก่อนรัน migration → หลัง migration แล้วยังไม่ apply filter
// 60 วินาที = ทุกครั้งจะ retry ครั้งสุด ภายใน 1 นาทีเปลี่ยน state
const STATE_TTL_MS = 60_000;
let _state: "missing" | "ok" | "unknown" = "unknown";
let _stateExpiresAt = 0;

function currentState(): "missing" | "ok" | "unknown" {
  if (Date.now() > _stateExpiresAt) {
    return "unknown"; // re-test next call (cache miss/expired)
  }
  return _state;
}
function setState(s: "missing" | "ok") {
  _state = s;
  _stateExpiresAt = Date.now() + STATE_TTL_MS;
}

interface PostgrestError {
  code?: string;
  message?: string;
}

/** Detect "undefined column" error — Postgres SQLSTATE 42703 */
export function markTrashColumnMissing(err: unknown): boolean {
  if (!err) return false;
  const e = err as PostgrestError;
  if (e.code === "42703" || (e.message ?? "").toLowerCase().includes("deleted_at")) {
    if (currentState() !== "missing") {
      console.warn(
        "[soft-delete] column 'deleted_at' missing — RUN migrations/202605_soft_delete.sql in Supabase. " +
          "Falling back to unfiltered queries (will re-check in 60s).",
      );
    }
    setState("missing");
    return true;
  }
  return false;
}

export function isTrashColumnAvailable(): boolean {
  return currentState() !== "missing";
}

/** Mark column as available — called from runWithSoftDeleteFallback on successful filtered query */
function markTrashColumnAvailable() {
  if (_state !== "ok") {
    console.log("[soft-delete] column 'deleted_at' detected — filtering enabled");
  }
  setState("ok");
}

/**
 * Helper for read queries — encapsulates try-with-filter / retry-without
 *
 * @param withFilter   builder ที่ใช้ `.is("deleted_at", null)`
 * @param withoutFilter builder ที่ไม่มี filter (fallback)
 *
 * Note: Supabase query builders เป็น PromiseLike (thenable) ไม่ใช่ Promise
 *       ตรงๆ — เราจึง `await` ผ่าน thenable interface ตามปกติ
 */
type ThenableResult<T> = PromiseLike<{ data: T | null; error: unknown }>;

export async function runWithSoftDeleteFallback<T>(
  withFilter: () => ThenableResult<T>,
  withoutFilter: () => ThenableResult<T>,
): Promise<{ data: T | null; error: unknown }> {
  // Skip filter เฉพาะตอน state cache บอกว่า "missing" (within TTL)
  // นอกนั้นพยายาม filter เสมอ → ถ้า migration เพิ่งรัน → filter ทำงาน → mark ok
  if (!isTrashColumnAvailable()) {
    return await withoutFilter();
  }
  const r = await withFilter();
  if (r.error && markTrashColumnMissing(r.error)) {
    return await withoutFilter();
  }
  // Success — mark column as available (reset TTL)
  if (!r.error) {
    markTrashColumnAvailable();
  }
  return r;
}
