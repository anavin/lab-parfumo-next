/**
 * Cleanup cron — รัน 03:00 AM ICT ทุกวัน (vercel.json crons)
 *
 * ตัดข้อมูลเก่าออกจากตาราง log ที่โตไม่จำกัด — กัน storage/perf พัง:
 *   1) login_attempts        — เก็บ 90 วันหลังสุด (เก่ากว่าลบ)
 *   2) po_activities         — เก็บ 365 วันหลังสุด
 *   3) notifications (read)  — เก็บ 180 วันหลังสุด (unread ไม่แตะ)
 *   4) user_sessions idle    — last_activity_at < NOW() - 24h → ลบทิ้ง
 *      (SESSION_IDLE_MIN คือ 60 นาที; 24 ชม = margin เผื่อ user มีหลายอุปกรณ์)
 *
 * Security: Bearer Authorization header (CRON_SECRET)
 *
 * Idempotent + safe: best-effort ต่อ table (ถ้า table หายเพราะ migration
 * ยังไม่รัน → log แล้วข้าม ไม่ crash whole cron)
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { captureError } from "@/lib/observability/capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// ครั้งแรก log ที่สะสมมาก อาจ prune หลายหมื่นแถว
export const maxDuration = 60;

function authorize(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn(
      "[cron/cleanup] CRON_SECRET not set — rejecting all requests for safety.",
    );
    return false;
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${cronSecret}`;
}

type Result = { table: string; deleted: number; ok: boolean; error?: string };

// deno-lint-ignore-file no-explicit-any -- Supabase typed client not generated
async function pruneOlder(
  sb: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  column: string,
  cutoff: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraFilter?: (q: any) => any,
): Promise<Result> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = sb.from(table as never).delete({ count: "exact" }).lt(column, cutoff);
    if (extraFilter) q = extraFilter(q);
    const { count, error } = await q;
    if (error) return { table, deleted: 0, ok: false, error: error.message };
    return { table, deleted: count ?? 0, ok: true };
  } catch (e) {
    return {
      table,
      deleted: 0,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const now = Date.now();
  const day = 86_400_000;

  const cutoff90d = new Date(now - 90 * day).toISOString();
  const cutoff180d = new Date(now - 180 * day).toISOString();
  const cutoff365d = new Date(now - 365 * day).toISOString();
  const cutoffSession = new Date(now - day).toISOString(); // 24h idle → prune

  const results: Result[] = [];

  // 1) login_attempts > 90d
  results.push(
    await pruneOlder(sb, "login_attempts", "created_at", cutoff90d),
  );

  // 2) po_activities > 365d
  results.push(
    await pruneOlder(sb, "po_activities", "created_at", cutoff365d),
  );

  // 3) notifications: read AND > 180d (unread ไม่แตะ)
  results.push(
    await pruneOlder(
      sb, "notifications", "created_at", cutoff180d,
      (q) => q.eq("is_read", true),
    ),
  );

  // 4) user_sessions — idle > 24h (last_activity_at เก่ากว่านี้ = ตาย)
  //    schema จริงไม่มี expires_at → เช็ค activity แทน (ตรงกับ SESSION_IDLE_MIN)
  results.push(
    await pruneOlder(sb, "user_sessions", "last_activity_at", cutoffSession),
  );

  const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
  const anyError = results.some((r) => !r.ok);

  // ถ้ามี table ใดล้มเหลว — capture ให้ Sentry เห็น (log ยังคงอยู่)
  if (anyError) {
    const failures = results.filter((r) => !r.ok);
    captureError(
      new Error(`cron/cleanup partial failure: ${failures.map((f) => f.table).join(", ")}`),
      "cron/cleanup",
      { failures },
    );
  }

  console.log(
    `[cron/cleanup] pruned ${totalDeleted} rows across ${results.length} tables`,
    results,
  );

  return NextResponse.json({
    ok: !anyError,
    totalDeleted,
    results,
    ranAt: new Date().toISOString(),
  });
}
