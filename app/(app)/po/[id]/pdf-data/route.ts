/**
 * GET /po/[id]/pdf-data — คืนข้อมูล PO เป็น JSON สำหรับ render PDF ฝั่ง browser
 *
 * ⭐ ทำไมต้องมี route นี้: @react-pdf ใช้ `node:fs` → รันบน Cloudflare Workers ไม่ได้
 *    จึงย้ายการ render ไปทำฝั่ง client (browser build) แทน — route นี้ทำหน้าที่ตรวจสิทธิ์
 *    (auth + permission + showPrices ตาม role) แล้วส่งข้อมูลกลับ ไม่ render PDF เอง
 *
 * ทุก query เป็น DB ล้วน → ทำงานบน Workers ได้ปกติ
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPoById } from "@/lib/db/po";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CompanyInfo } from "@/lib/pdf/po-document";

export const dynamic = "force-dynamic";

async function getCompanyInfo(): Promise<CompanyInfo> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("company_settings" as never)
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const row = (data ?? {}) as Partial<CompanyInfo>;
  return {
    name: row.name ?? "Lab Parfumo",
    name_th: row.name_th ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    tax_id: row.tax_id ?? "",
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const po = await getPoById(id);
  if (!po) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Permission: requester เห็นเฉพาะของตัวเอง (เหมือน route PDF เดิม)
  if (user.role === "requester" && po.created_by !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const company = await getCompanyInfo();
  const showPrices = user.role === "admin" || user.role === "supervisor";

  return NextResponse.json(
    { po, company, showPrices },
    { headers: { "Cache-Control": "no-store" } },
  );
}
