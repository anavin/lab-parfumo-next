/**
 * Daily digest cron endpoint
 *
 * Runs at 8:00 AM ICT (Asia/Bangkok) — see vercel.json `crons` config.
 * Sends a summary email to all admins covering yesterday's activity.
 *
 * Security: Vercel Cron sends a secret header — we verify it.
 * Manual runs allowed only with ?token=$CRON_SECRET.
 */
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendDailyDigest, type DigestData } from "@/lib/email";
import type { PurchaseOrder, PoItem } from "@/lib/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  // Vercel Cron sets this header automatically
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // dev — allow without secret
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${cronSecret}`) return true;
  // Allow manual trigger via ?token=
  const url = new URL(req.url);
  if (url.searchParams.get("token") === cronSecret) return true;
  return false;
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  // Yesterday's bounds (Asia/Bangkok)
  const now = new Date();
  const startOfTodayICT = new Date(now.getTime() + 7 * 3600_000);
  startOfTodayICT.setUTCHours(0, 0, 0, 0);
  const startUtc = new Date(startOfTodayICT.getTime() - 7 * 3600_000 - 86400_000);
  const endUtc = new Date(startUtc.getTime() + 86400_000);

  // Pull POs that touched activity today
  const { data: posRaw } = await sb
    .from("purchase_orders")
    .select("*")
    .or(`created_at.gte.${startUtc.toISOString()},updated_at.gte.${startUtc.toISOString()}`);
  const pos = (posRaw ?? []) as PurchaseOrder[];

  const newPoCount = pos.filter((p) => p.created_at >= startUtc.toISOString() && p.created_at < endUtc.toISOString()).length;
  const shippedToday = pos.filter((p) => p.status === "กำลังขนส่ง").length;
  const receivedToday = pos.filter((p) =>
    p.status === "รับของแล้ว" &&
    p.received_date && p.received_date >= startUtc.toISOString().slice(0, 10),
  ).length;

  // Overdue: expected < today and status not received/done/cancel
  const today = startOfTodayICT.toISOString().slice(0, 10);
  const overdueCount = pos.filter((p) =>
    p.expected_date && p.expected_date < today &&
    !["รับของแล้ว", "เสร็จสมบูรณ์", "ยกเลิก", "มีปัญหา"].includes(p.status),
  ).length;

  // Total value of POs created today
  const totalValueToday = pos
    .filter((p) => p.created_at >= startUtc.toISOString() && p.created_at < endUtc.toISOString())
    .reduce((s, p) => s + (p.total ?? 0), 0);

  // Top items
  const itemMap = new Map<string, number>();
  for (const p of pos) {
    if (p.created_at < startUtc.toISOString() || p.created_at >= endUtc.toISOString()) continue;
    for (const it of (p.items ?? []) as PoItem[]) {
      itemMap.set(it.name, (itemMap.get(it.name) ?? 0) + (it.qty ?? 0));
    }
  }
  const topItems = Array.from(itemMap.entries())
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty);

  // Pending equipment approval
  const { count: pendingApprovalCount } = await sb
    .from("equipment")
    .select("*", { count: "exact", head: true })
    .eq("approval_status", "pending");

  const data: DigestData = {
    newPoCount,
    shippedToday,
    receivedToday,
    overdueCount,
    pendingApprovalCount: pendingApprovalCount ?? 0,
    totalValueToday,
    topItems,
  };

  // Get all admins with email
  const { data: admins } = await sb
    .from("users")
    .select("full_name, email")
    .eq("role", "admin")
    .eq("is_active", true)
    .not("email", "is", null);

  // Get company name
  const { data: company } = await sb
    .from("company_settings" as never)
    .select("name, name_th")
    .eq("id", 1)
    .maybeSingle();
  const companyName =
    (company as { name_th?: string; name?: string } | null)?.name_th ||
    (company as { name_th?: string; name?: string } | null)?.name ||
    "Lab Parfumo";

  const dateStr = new Date(startUtc.getTime() + 7 * 3600_000).toLocaleDateString("th-TH", {
    day: "numeric", month: "long", year: "numeric",
  });

  // Send to each admin (parallel, best-effort)
  const recipients = (admins ?? []).filter((a: { email: string | null }) => a.email);
  const results = await Promise.allSettled(
    recipients.map((a: { full_name: string; email: string | null }) =>
      sendDailyDigest({
        to: a.email!,
        recipientName: a.full_name,
        data, companyName, date: dateStr,
      }),
    ),
  );
  const sent = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;

  return NextResponse.json({
    ok: true,
    date: dateStr,
    recipients: recipients.length,
    sent,
    summary: data,
  });
}
