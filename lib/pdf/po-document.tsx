/**
 * PO PDF document — premium B2B design
 * ภาษาไทย ใช้ฟอนต์ Sarabun
 */
import path from "path";
import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";
import type { PurchaseOrder, PoStatus } from "@/lib/types/db";

// ==================================================================
// Fonts
// ==================================================================
const FONTS_DIR = path.join(process.cwd(), "public", "fonts");

let fontRegistered = false;
function registerFontOnce() {
  if (fontRegistered) return;
  Font.register({
    family: "Sarabun",
    fonts: [
      { src: path.join(FONTS_DIR, "Sarabun-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(FONTS_DIR, "Sarabun-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  fontRegistered = true;
}

// ==================================================================
// Color tokens
// ==================================================================
const C = {
  ink: "#0F172A",        // primary text
  body: "#1E293B",       // body text
  muted: "#64748B",      // secondary
  faint: "#94A3B8",      // tertiary
  border: "#E2E8F0",     // borders
  bgSoft: "#F8FAFC",     // soft bg
  bgTinted: "#F1F5F9",   // tinted bg

  brand: "#1E3A5F",      // primary brand
  brandLight: "#3A5A8C", // brand light
  brandPale: "#EFF3F9",  // brand pale tint

  accent: "#D97706",     // accent (warning/notes)
  accentPale: "#FEF3C7",
  emerald: "#059669",
  emeraldPale: "#D1FAE5",
  red: "#DC2626",
  redPale: "#FEE2E2",
  amber: "#D97706",
  amberPale: "#FEF3C7",
  blue: "#2563EB",
  bluePale: "#DBEAFE",
  indigo: "#4F46E5",
  indigoPale: "#E0E7FF",
  cyan: "#0891B2",
  cyanPale: "#CFFAFE",
};

// ==================================================================
// Status visuals
// ==================================================================
const STATUS_COLOR: Record<PoStatus, { fg: string; bg: string }> = {
  "รอจัดซื้อดำเนินการ": { fg: C.amber, bg: C.amberPale },
  "สั่งซื้อแล้ว":      { fg: C.blue, bg: C.bluePale },
  "กำลังขนส่ง":         { fg: C.indigo, bg: C.indigoPale },
  "รับของแล้ว":         { fg: C.cyan, bg: C.cyanPale },
  "มีปัญหา":            { fg: C.red, bg: C.redPale },
  "เสร็จสมบูรณ์":       { fg: C.emerald, bg: C.emeraldPale },
  "ยกเลิก":             { fg: C.muted, bg: C.bgTinted },
};

// ==================================================================
// Styles
// ==================================================================
const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    fontSize: 10,
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
    color: C.body,
    backgroundColor: "#FFFFFF",
  },

  // ===== Top accent bar =====
  topBar: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 6,
    backgroundColor: C.brand,
  },

  // ===== Header =====
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  brandRow: { flexDirection: "column" },
  companyName: {
    fontSize: 18,
    fontWeight: "bold",
    color: C.ink,
    marginBottom: 4,
  },
  companyMeta: {
    fontSize: 9,
    color: C.muted,
    marginBottom: 1,
    lineHeight: 1.4,
  },

  docTitleBlock: { alignItems: "flex-end" },
  docTitleEyebrow: {
    fontSize: 8,
    color: C.muted,
    fontWeight: "bold",
    letterSpacing: 1.5,
    marginBottom: 10,
    paddingBottom: 2,
  },
  docTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: C.brand,
    lineHeight: 1.3,
    marginBottom: 8,
  },
  docNumber: {
    fontSize: 13,
    fontWeight: "bold",
    color: C.body,
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
    fontSize: 9,
    fontWeight: "bold",
  },

  // ===== Divider line =====
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 18,
  },

  // ===== Info grid =====
  infoGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  infoCard: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
  },
  // English-only eyebrow (uppercase, with tracking)
  infoEyebrow: {
    fontSize: 8,
    color: C.muted,
    fontWeight: "bold",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  // Thai eyebrow — NO letter spacing (would break tone marks)
  infoEyebrowTh: {
    fontSize: 9,
    color: C.muted,
    fontWeight: "bold",
    marginBottom: 6,
  },
  infoStrong: {
    fontSize: 11,
    fontWeight: "bold",
    color: C.ink,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 9,
    color: C.body,
    marginBottom: 1,
    lineHeight: 1.45,
  },
  infoMuted: {
    fontSize: 9,
    color: C.muted,
  },
  // Date row inside card
  dateRow: {
    flexDirection: "row",
    fontSize: 9,
    marginBottom: 3,
  },
  dateLabel: {
    width: 56,
    color: C.muted,
    fontSize: 9,
  },
  dateValue: {
    color: C.body,
    fontWeight: "bold",
    fontSize: 9,
    flex: 1,
  },

  // ===== Items table =====
  tableWrap: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    overflow: "hidden",
  },
  thead: {
    flexDirection: "row",
    backgroundColor: C.brand,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  th: {
    color: "white",
    fontWeight: "bold",
    fontSize: 9,
    letterSpacing: 0.3,
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  trAlt: {
    backgroundColor: C.bgSoft,
  },
  td: { color: C.body, fontSize: 10 },
  tdMuted: { color: C.muted, fontSize: 8.5, marginTop: 2 },
  // Columns
  colNo:        { width: 24, textAlign: "center" },
  colName:      { flex: 1 },
  colQty:       { width: 56, textAlign: "right" },
  colUnit:      { width: 42, textAlign: "center" },
  colPrice:     { width: 70, textAlign: "right" },
  colSubtotal:  { width: 84, textAlign: "right", fontWeight: "bold" },

  // ===== Totals panel =====
  totalsPanel: {
    alignSelf: "flex-end",
    width: "55%",
    marginBottom: 14,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 10,
  },
  totalsRowAlt: {
    backgroundColor: C.bgSoft,
  },
  totalsLabel: { color: C.muted, fontSize: 10 },
  totalsValue: { color: C.body, fontSize: 10, fontWeight: "bold" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: C.brand,
    color: "white",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginTop: 4,
  },
  grandLabel: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
  },
  grandValue: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },

  // ===== Notes box (neutral, clean) =====
  notesBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  notesContent: { flex: 1 },
  notesLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: C.muted,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 10,
    color: C.body,
    lineHeight: 1.5,
  },

  // ===== Signatures =====
  signGrid: {
    flexDirection: "row",
    gap: 18,
    marginTop: 20,
  },
  signBox: {
    flex: 1,
    paddingTop: 26,
    fontSize: 9,
  },
  signLine: {
    borderTopWidth: 1,
    borderTopColor: C.body,
    paddingTop: 6,
    fontSize: 9,
    color: C.body,
    fontWeight: "bold",
    textAlign: "center",
  },
  signRole: {
    fontSize: 8.5,
    color: C.muted,
    textAlign: "center",
    marginTop: 1,
  },
  signName: {
    fontSize: 8,
    color: C.faint,
    textAlign: "center",
    marginTop: 4,
  },

  // ===== Footer =====
  footer: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: C.faint,
  },
  footerLeft: { color: C.muted, fontWeight: "bold" },
  footerCenter: { color: C.faint },
  footerRight: { color: C.muted },
});

// ==================================================================
// Component
// ==================================================================
export interface CompanyInfo {
  name: string;
  name_th: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
}

export interface PoDocumentProps {
  po: PurchaseOrder;
  company: CompanyInfo;
  showPrices: boolean;
}

export function PoDocument({ po, company, showPrices }: PoDocumentProps) {
  registerFontOnce();
  const items = po.items ?? [];
  const statusColor = STATUS_COLOR[po.status as PoStatus] ?? STATUS_COLOR["รอจัดซื้อดำเนินการ"];
  const docDate = new Date().toLocaleDateString("th-TH", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const docTime = new Date().toLocaleTimeString("th-TH", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <Document
      title={`${po.po_number}.pdf`}
      author={company.name}
      creator="Lab Parfumo PO Pro"
      subject={`ใบสั่งซื้อ ${po.po_number}`}
    >
      <Page size="A4" style={styles.page} wrap>
        {/* Top accent bar */}
        <View style={styles.topBar} fixed />

        {/* Header — company info left, doc info right */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.companyName}>{company.name || "Lab Parfumo"}</Text>
            {company.name_th && (
              <Text style={styles.companyMeta}>{company.name_th}</Text>
            )}
            {company.address && (
              <Text style={styles.companyMeta}>{company.address}</Text>
            )}
            {company.phone && (
              <Text style={styles.companyMeta}>โทร {company.phone}</Text>
            )}
            {company.email && (
              <Text style={styles.companyMeta}>{company.email}</Text>
            )}
            {company.tax_id && (
              <Text style={styles.companyMeta}>เลขผู้เสียภาษี {company.tax_id}</Text>
            )}
          </View>

          <View style={styles.docTitleBlock}>
            <Text style={styles.docTitleEyebrow}>PURCHASE ORDER</Text>
            <Text style={styles.docTitle}>ใบสั่งซื้อ</Text>
            <Text style={styles.docNumber}>{po.po_number}</Text>
            <Text
              style={[
                styles.statusBadge,
                { color: statusColor.fg, backgroundColor: statusColor.bg },
              ]}
            >
              {po.status}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Info grid: Supplier · Dates · Buyer */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <Text style={styles.infoEyebrow}>SUPPLIER</Text>
            {showPrices && po.supplier_name ? (
              <>
                <Text style={styles.infoStrong}>{po.supplier_name}</Text>
                {po.supplier_contact && (
                  <Text style={styles.infoText}>{po.supplier_contact}</Text>
                )}
              </>
            ) : (
              <Text style={styles.infoMuted}>—</Text>
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoEyebrowTh}>วันที่</Text>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>สร้าง</Text>
              <Text style={styles.dateValue}>{fmtDate(po.created_at)}</Text>
            </View>
            {po.ordered_date && (
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>สั่ง</Text>
                <Text style={styles.dateValue}>{fmtDate(po.ordered_date)}</Text>
              </View>
            )}
            {po.expected_date && (
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>คาด</Text>
                <Text style={styles.dateValue}>{fmtDate(po.expected_date)}</Text>
              </View>
            )}
            {po.received_date && (
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>รับ</Text>
                <Text style={styles.dateValue}>{fmtDate(po.received_date)}</Text>
              </View>
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoEyebrowTh}>ผู้สั่ง</Text>
            <Text style={styles.infoStrong}>{po.created_by_name || "—"}</Text>
            {po.tracking_number && (
              <Text style={styles.infoText}>Tracking: {po.tracking_number}</Text>
            )}
          </View>
        </View>

        {/* Items table */}
        <View style={styles.tableWrap}>
          <View style={styles.thead}>
            <Text style={[styles.colNo, styles.th]}>#</Text>
            <Text style={[styles.colName, styles.th]}>รายการ</Text>
            <Text style={[styles.colQty, styles.th]}>จำนวน</Text>
            <Text style={[styles.colUnit, styles.th]}>หน่วย</Text>
            {showPrices && (
              <>
                <Text style={[styles.colPrice, styles.th]}>ราคา/หน่วย</Text>
                <Text style={[styles.colSubtotal, styles.th]}>รวม</Text>
              </>
            )}
          </View>
          {items.map((it, i) => (
            <View
              key={i}
              style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]}
              wrap={false}
            >
              <Text style={[styles.colNo, styles.td]}>{i + 1}</Text>
              <View style={styles.colName}>
                <Text style={styles.td}>{it.name}</Text>
                {it.notes && (
                  <Text style={styles.tdMuted}>{it.notes}</Text>
                )}
              </View>
              <Text style={[styles.colQty, styles.td]}>
                {(it.qty ?? 0).toLocaleString("th-TH")}
              </Text>
              <Text style={[styles.colUnit, styles.td]}>{it.unit || "ชิ้น"}</Text>
              {showPrices && (
                <>
                  <Text style={[styles.colPrice, styles.td]}>
                    {(it.unit_price ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.colSubtotal, styles.td, { fontWeight: "bold" }]}>
                    {(it.subtotal ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </Text>
                </>
              )}
            </View>
          ))}
        </View>

        {/* Totals */}
        {showPrices && po.total != null && po.total > 0 && (
          <View style={styles.totalsPanel}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>ยอดรวม</Text>
              <Text style={styles.totalsValue}>
                ฿{(po.subtotal ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </Text>
            </View>
            {(po.discount ?? 0) > 0 && (
              <View style={[styles.totalsRow, styles.totalsRowAlt]}>
                <Text style={styles.totalsLabel}>ส่วนลด</Text>
                <Text style={[styles.totalsValue, { color: C.red }]}>
                  -฿{(po.discount ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
            {(po.shipping_fee ?? 0) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>ค่าจัดส่ง</Text>
                <Text style={styles.totalsValue}>
                  ฿{(po.shipping_fee ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
            {(po.vat ?? 0) > 0 && (
              <View style={[styles.totalsRow, styles.totalsRowAlt]}>
                <Text style={styles.totalsLabel}>ภาษีมูลค่าเพิ่ม (VAT 7%)</Text>
                <Text style={styles.totalsValue}>
                  ฿{(po.vat ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>ยอดสุทธิ</Text>
              <Text style={styles.grandValue}>
                ฿{(po.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </View>
        )}

        {/* Notes */}
        {po.notes && (
          <View style={styles.notesBox} wrap={false}>
            <Text style={styles.notesLabel}>หมายเหตุ</Text>
            <Text style={styles.notesText}>{po.notes}</Text>
          </View>
        )}

        {po.procurement_notes && showPrices && (
          <View style={styles.notesBox} wrap={false}>
            <Text style={styles.notesLabel}>หมายเหตุจัดซื้อ</Text>
            <Text style={styles.notesText}>{po.procurement_notes}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signGrid} wrap={false}>
          <View style={styles.signBox}>
            <Text style={styles.signLine}>ผู้สั่งซื้อ</Text>
            <Text style={styles.signRole}>Buyer</Text>
            <Text style={styles.signName}>({po.created_by_name || "..............."})</Text>
          </View>
          <View style={styles.signBox}>
            <Text style={styles.signLine}>ผู้อนุมัติ</Text>
            <Text style={styles.signRole}>Approver</Text>
            <Text style={styles.signName}>(...............)</Text>
          </View>
          {showPrices && (
            <View style={styles.signBox}>
              <Text style={styles.signLine}>Supplier</Text>
              <Text style={styles.signRole}>ผู้รับใบสั่งซื้อ</Text>
              <Text style={styles.signName}>({po.supplier_name || "..............."})</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>{po.po_number}</Text>
          <Text style={styles.footerCenter}>
            สร้างโดย Lab Parfumo PO Pro · {docDate} {docTime}
          </Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) =>
              `หน้า ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return String(d);
  }
}
