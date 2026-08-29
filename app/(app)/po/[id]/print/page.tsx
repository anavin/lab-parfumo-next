/**
 * Print-friendly PO view — เปิดแล้ว Ctrl+P พิมพ์ได้เลย
 *
 * ใช้ HTML ปกติ (ไม่ใช่ PDF) → เร็วกว่า /api/po/[id]/pdf และสามารถ
 * แก้ไข style ตอนพิมพ์ผ่าน browser print dialog ได้
 *
 * Permission: เหมือนหน้า detail (staff เห็นเฉพาะของตัวเอง / >= สั่งซื้อแล้ว)
 */
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getPoById } from "@/lib/db/po";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PoStatus, PoItem } from "@/lib/types/db";
import { PrintTrigger } from "./_print-trigger";

export const dynamic = "force-dynamic";

interface CompanyInfo {
  name: string;
  name_th: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
}

async function getCompanyInfo(): Promise<CompanyInfo> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("company_settings" as never)
    .select("name, name_th, address, phone, email, tax_id")
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

const STATUS_TONE: Record<PoStatus, { bg: string; text: string }> = {
  "รอจัดซื้อดำเนินการ": { bg: "#FEF3C7", text: "#92400E" },
  "สั่งซื้อแล้ว":       { bg: "#D1FAE5", text: "#065F46" },
  "กำลังขนส่ง":         { bg: "#E0E7FF", text: "#3730A3" },
  "รับของแล้ว":         { bg: "#CFFAFE", text: "#155E75" },
  "มีปัญหา":            { bg: "#FEE2E2", text: "#991B1B" },
  "เสร็จสมบูรณ์":       { bg: "#DCFCE7", text: "#166534" },
  "ยกเลิก":             { bg: "#F1F5F9", text: "#475569" },
};

function fmtMoney(n: number | null | undefined): string {
  return `฿${(n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function PrintPoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [po, company] = await Promise.all([getPoById(id), getCompanyInfo()]);
  if (!po) notFound();

  // Permission — เหมือนหน้า detail
  const isPrivileged = user.role === "admin" || user.role === "supervisor";
  const STAFF_VIEWABLE: PoStatus[] = [
    "สั่งซื้อแล้ว", "กำลังขนส่ง", "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์",
  ];
  if (!isPrivileged && po.created_by !== user.id && !STAFF_VIEWABLE.includes(po.status)) {
    redirect("/po");
  }

  const showPrices = isPrivileged;
  const items: PoItem[] = po.items ?? [];
  const statusTone = STATUS_TONE[po.status] ?? STATUS_TONE["รอจัดซื้อดำเนินการ"];

  return (
    <>
      <PrintTrigger />
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          body { margin: 0; }
          .no-print { display: none !important; }
          /* Hide AppHeader + main padding/gradient from (app) layout */
          header, nav { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          body, .min-h-screen { background: #fff !important; }
          .print-page { box-shadow: none !important; border: none !important; padding: 0 !important; }
          /* Preserve background colors of status chips + table headers
             โดย default browser strip background graphics ตอนพิมพ์ →
             status pill กลายเป็น white on white อ่านไม่ออก */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
        }
        .print-page {
          background: #fff;
          color: #0f172a;
          font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          max-width: 210mm;
          margin: 0 auto;
          padding: 14mm 12mm;
          box-sizing: border-box;
        }
        .print-page table { border-collapse: collapse; width: 100%; }
        .print-page th, .print-page td { padding: 6px 8px; text-align: left; vertical-align: top; }
        .print-page thead th { background: #F1F5F9; font-weight: 700; font-size: 11px; }
        .print-page tbody tr { border-bottom: 1px solid #E2E8F0; }
        .print-page .num { text-align: right; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* Print bar — hidden when printing */}
      <div
        className="no-print"
        style={{
          background: "#0F172A", color: "#fff", padding: "8px 16px",
          fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 8,
        }}
      >
        <span>🖨️ พรีวิวสำหรับพิมพ์ — กด Ctrl/Cmd+P หรือปุ่มขวา</span>
        <span style={{ display: "flex", gap: 8 }}>
          <a href={`/po/${po.id}`} style={{ color: "#A8C0E0", textDecoration: "underline" }}>
            ← กลับหน้า PO
          </a>
          <a
            href={`/api/po/${po.id}/pdf`}
            style={{
              background: "#3A5A8C", color: "#fff", padding: "4px 12px",
              borderRadius: 6, textDecoration: "none", fontWeight: 600,
            }}
          >
            ดาวน์โหลด PDF
          </a>
        </span>
      </div>

      <div className="print-page">
        {/* Header — company info */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1E293B", paddingBottom: 12, marginBottom: 16, gap: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B" }}>
              {company.name_th || company.name}
            </div>
            {company.name_th && company.name && company.name !== company.name_th && (
              <div style={{ fontSize: 12, color: "#475569" }}>{company.name}</div>
            )}
            {company.address && (
              <div style={{ fontSize: 11, color: "#475569", whiteSpace: "pre-line", marginTop: 4 }}>
                {company.address}
              </div>
            )}
            <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
              {company.phone && <span>โทร {company.phone}</span>}
              {company.phone && company.email && <span> · </span>}
              {company.email && <span>{company.email}</span>}
              {company.tax_id && (
                <div>เลขผู้เสียภาษี: <strong>{company.tax_id}</strong></div>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 }}>
              Purchase Order
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: "#1E293B", marginTop: 2 }}>
              {po.po_number}
            </div>
            <div
              style={{
                display: "inline-block", marginTop: 6,
                padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700,
                background: statusTone.bg, color: statusTone.text,
              }}
            >
              {po.status}
            </div>
          </div>
        </header>

        {/* Two-column info */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              ผู้ขาย (Supplier)
            </div>
            <div style={{ fontWeight: 700, color: "#1E293B" }}>{po.supplier_name ?? "—"}</div>
            {po.supplier_contact && (
              <div style={{ fontSize: 11, color: "#475569", whiteSpace: "pre-line", marginTop: 2 }}>
                {po.supplier_contact}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
              วันที่
            </div>
            <table style={{ fontSize: 11 }}>
              <tbody>
                <tr><td style={{ padding: "2px 0", color: "#64748B" }}>สร้างเมื่อ</td><td style={{ padding: "2px 0" }}>{fmtDate(po.created_at)} โดย {po.created_by_name ?? "—"}</td></tr>
                <tr><td style={{ padding: "2px 0", color: "#64748B" }}>สั่งซื้อ</td><td style={{ padding: "2px 0" }}>{fmtDate(po.ordered_date)}</td></tr>
                <tr><td style={{ padding: "2px 0", color: "#64748B" }}>คาดว่าจะได้รับ</td><td style={{ padding: "2px 0" }}>{fmtDate(po.expected_date)}</td></tr>
                {po.received_date && (
                  <tr><td style={{ padding: "2px 0", color: "#64748B" }}>รับของ</td><td style={{ padding: "2px 0" }}>{fmtDate(po.received_date)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Items table */}
        <table style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>รายการ</th>
              <th className="num" style={{ width: 60 }}>จำนวน</th>
              <th style={{ width: 60 }}>หน่วย</th>
              {showPrices && <th className="num" style={{ width: 90 }}>ราคา/หน่วย</th>}
              {showPrices && <th className="num" style={{ width: 100 }}>รวม</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={showPrices ? 6 : 4} style={{ textAlign: "center", color: "#94A3B8", padding: 16 }}>
                  ไม่มีรายการ
                </td>
              </tr>
            ) : items.map((it, i) => {
              const line = (it.subtotal ?? ((it.qty ?? 0) * (it.unit_price ?? 0))) || 0;
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{it.name}</td>
                  <td className="num">{(it.qty ?? 0).toLocaleString("th-TH")}</td>
                  <td>{it.unit ?? ""}</td>
                  {showPrices && <td className="num">{fmtMoney(it.unit_price)}</td>}
                  {showPrices && <td className="num">{fmtMoney(line)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals — admin/supervisor only */}
        {showPrices && (
          <section style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <table style={{ width: 280, fontSize: 12 }}>
              <tbody>
                <tr><td style={{ color: "#64748B" }}>ยอดรวม</td><td className="num">{fmtMoney(po.subtotal)}</td></tr>
                {po.discount && po.discount > 0 ? (
                  <tr><td style={{ color: "#64748B" }}>ส่วนลด</td><td className="num" style={{ color: "#DC2626" }}>-{fmtMoney(po.discount)}</td></tr>
                ) : null}
                {po.shipping_fee && po.shipping_fee > 0 ? (
                  <tr><td style={{ color: "#64748B" }}>ค่าจัดส่ง</td><td className="num">{fmtMoney(po.shipping_fee)}</td></tr>
                ) : null}
                {po.vat && po.vat > 0 ? (
                  <tr><td style={{ color: "#64748B" }}>VAT</td><td className="num">{fmtMoney(po.vat)}</td></tr>
                ) : null}
                <tr style={{ borderTop: "2px solid #1E293B" }}>
                  <td style={{ fontWeight: 800, fontSize: 14, paddingTop: 6 }}>รวมทั้งสิ้น</td>
                  <td className="num" style={{ fontWeight: 800, fontSize: 14, paddingTop: 6 }}>{fmtMoney(po.total)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* Notes */}
        {po.notes && (
          <section style={{ marginBottom: 12, fontSize: 11 }}>
            <div style={{ fontWeight: 700, color: "#64748B", marginBottom: 2 }}>หมายเหตุ</div>
            <div style={{ whiteSpace: "pre-line", color: "#1E293B" }}>{po.notes}</div>
          </section>
        )}

        {/* Signature row */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 40, fontSize: 11 }}>
          {["ผู้ขอซื้อ", "ผู้อนุมัติ", "ผู้รับของ"].map((label) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ borderTop: "1px solid #94A3B8", paddingTop: 6, color: "#64748B" }}>
                ({label})
              </div>
            </div>
          ))}
        </section>

        {/* Footer */}
        <footer style={{ marginTop: 32, paddingTop: 8, borderTop: "1px solid #E2E8F0", fontSize: 10, color: "#94A3B8", textAlign: "center" }}>
          พิมพ์เมื่อ {fmtDateTime(new Date().toISOString())} · {company.name_th || company.name}
        </footer>
      </div>
    </>
  );
}
