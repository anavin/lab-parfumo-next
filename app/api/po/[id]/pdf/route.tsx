/**
 * GET /api/po/[id]/pdf — Download PO as PDF
 * - Auth check via session cookie
 * - Returns PDF buffer with proper Content-Disposition
 */
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentUser } from "@/lib/auth/session";
import { getPoById } from "@/lib/db/po";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { PoDocument, type CompanyInfo } from "@/lib/pdf/po-document";
import type { PoStatus } from "@/lib/types/db";

// Staff เห็น PO ของทีมได้เมื่อ status >= สั่งซื้อแล้ว
// (ตรงกับ /po/[id] และ /po/[id]/print gates)
const STAFF_VIEWABLE_STATUSES: PoStatus[] = [
  "สั่งซื้อแล้ว", "กำลังขนส่ง", "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์",
];

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // ใช้ Node runtime (ไม่ใช่ Edge) เพราะ @react-pdf ใช้ FS

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
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const po = await getPoById(id);
  if (!po) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Permission — ต้องตรงกับ /po/[id] และ /po/[id]/print gates:
  //   privileged | creator | team-visible status (สั่งซื้อแล้ว+)
  // ก่อน: ตัด staff ที่ดู team-visible → 403 เมื่อกด PDF
  const isPrivileged = user.role === "admin" || user.role === "supervisor";
  const canView =
    isPrivileged ||
    po.created_by === user.id ||
    STAFF_VIEWABLE_STATUSES.includes(po.status);
  if (!canView) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const company = await getCompanyInfo();
  const showPrices = isPrivileged;

  try {
    const buffer = await renderToBuffer(
      <PoDocument po={po} company={company} showPrices={showPrices} />,
    );

    // แปลง Node Buffer → Uint8Array (BodyInit-compatible) ก่อนส่ง
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${po.po_number}.pdf"`,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[pdf] render failed:", e);
    return new NextResponse("PDF render failed", { status: 500 });
  }
}
