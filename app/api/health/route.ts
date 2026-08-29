/**
 * Health-check endpoint — public, no auth
 *
 * Vercel LB / uptime monitor / smoke test สามารถ hit ได้:
 *   200 { ok: true, db: "up", ... }   → app OK, DB reachable
 *   200 { ok: false, db: "down", err }  → app up but DB unreachable (retry-friendly)
 *   500                                → app itself crashed
 *
 * ไม่รั่วข้อมูลสำคัญ (แค่ boolean + error message truncate 100 chars)
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

  // Lightweight DB ping — SELECT 1 row from a small table (users limit 1)
  let dbStatus: "up" | "down" = "up";
  let dbErr: string | null = null;
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("users").select("id").limit(1);
    if (error) {
      dbStatus = "down";
      dbErr = (error.message ?? "unknown").slice(0, 100);
    }
  } catch (e) {
    dbStatus = "down";
    dbErr = (e instanceof Error ? e.message : String(e)).slice(0, 100);
  }

  const elapsedMs = Date.now() - startedAt;

  return NextResponse.json(
    {
      ok: dbStatus === "up",
      db: dbStatus,
      dbError: dbErr,
      elapsedMs,
      commit: commitSha,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }, // always 200 — LB should read `ok` field, not HTTP code
  );
}
