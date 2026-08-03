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

  // Permission: requester เห็นเฉพาะของตัวเอง
  if (user.role === "requester" && po.created_by !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const company = await getCompanyInfo();
  const showPrices = (user.role === "admin" || user.role === "supervisor");

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
