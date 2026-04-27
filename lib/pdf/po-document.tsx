/**
 * PO PDF document — ภาษาไทย ใช้ฟอนต์ Sarabun
 * Render เป็น PDF buffer ใน server / API route
 */
import path from "path";
import {
  Document, Page, Text, View, StyleSheet, Font,
} from "@react-pdf/renderer";
import type { PurchaseOrder } from "@/lib/types/db";

// ==================================================================
// Font registration (Sarabun — Thai)
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
// Styles
// ==================================================================
const styles = StyleSheet.create({
  page: {
    fontFamily: "Sarabun",
    fontSize: 10,
    padding: 30,
    color: "#1E293B",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 12,
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: "#3A5A8C",
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandLogo: {
    width: 36, height: 36,
    backgroundColor: "#3A5A8C",
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    paddingTop: 8,
    marginRight: 10,
    borderRadius: 8,
  },
  companyName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0F172A",
  },
  companyMeta: {
    fontSize: 9,
    color: "#64748B",
  },
  poTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#3A5A8C",
    textAlign: "right",
  },
  poNumber: {
    fontSize: 14,
    color: "#475569",
    textAlign: "right",
    marginTop: 2,
    fontWeight: "bold",
  },
  poStatus: {
    fontSize: 9,
    color: "#475569",
    textAlign: "right",
    marginTop: 4,
  },
  // Sections
  twoCol: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  card: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    border: "1px solid #E2E8F0",
    borderRadius: 6,
    padding: 10,
  },
  cardTitle: {
    fontSize: 9,
    color: "#64748B",
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardText: {
    fontSize: 10,
    color: "#1E293B",
  },
  cardTextBold: {
    fontSize: 11,
    color: "#0F172A",
    fontWeight: "bold",
  },
  // Items table
  table: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 4,
  },
  thead: {
    flexDirection: "row",
    backgroundColor: "#3A5A8C",
    color: "white",
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 9,
    fontWeight: "bold",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  th: { color: "white", fontWeight: "bold" },
  td: { color: "#1E293B" },
  colNo: { width: 22, textAlign: "center" },
  colName: { flex: 3 },
  colQty: { width: 60, textAlign: "right" },
  colUnit: { width: 40, textAlign: "center" },
  colPrice: { width: 70, textAlign: "right" },
  colSubtotal: { width: 80, textAlign: "right" },
  // Totals
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 3,
  },
  totalsLabel: {
    fontSize: 10,
    color: "#475569",
    width: 100,
    textAlign: "right",
    paddingRight: 8,
  },
  totalsValue: {
    fontSize: 10,
    color: "#1E293B",
    width: 100,
    textAlign: "right",
  },
  grandTotal: {
    backgroundColor: "#3A5A8C",
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  grandTotalLabel: { color: "white", fontWeight: "bold" },
  grandTotalValue: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
    minWidth: 100,
    textAlign: "right",
  },
  // Footer
  footer: {
    marginTop: 28,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    fontSize: 8,
    color: "#94A3B8",
    textAlign: "center",
  },
  signRow: {
    flexDirection: "row",
    gap: 30,
    marginTop: 30,
  },
  signBox: {
    flex: 1,
    paddingTop: 30,
    borderTopWidth: 1,
    borderTopColor: "#94A3B8",
    fontSize: 9,
    color: "#475569",
    textAlign: "center",
  },
  notes: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#FFFBEB",
    borderLeft: "3px solid #D97706",
    fontSize: 9,
    color: "#451A03",
  },
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
  showPrices: boolean;  // false = staff PDF (no prices)
}

export function PoDocument({ po, company, showPrices }: PoDocumentProps) {
  registerFontOnce();
  const items = po.items ?? [];

  return (
    <Document
      title={`${po.po_number}.pdf`}
      author={company.name}
      creator="Lab Parfumo PO Pro"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.brandLogo}>📦</Text>
            <View>
              <Text style={styles.companyName}>{company.name || "Lab Parfumo"}</Text>
              {company.name_th && <Text style={styles.companyMeta}>{company.name_th}</Text>}
              {company.address && <Text style={styles.companyMeta}>{company.address}</Text>}
              {company.phone && <Text style={styles.companyMeta}>โทร: {company.phone}</Text>}
              {company.tax_id && <Text style={styles.companyMeta}>เลขผู้เสียภาษี: {company.tax_id}</Text>}
            </View>
          </View>
          <View>
            <Text style={styles.poTitle}>ใบสั่งซื้อ</Text>
            <Text style={styles.poNumber}>{po.po_number}</Text>
            <Text style={styles.poStatus}>สถานะ: {po.status}</Text>
          </View>
        </View>

        {/* Two-column info */}
        <View style={styles.twoCol}>
          {showPrices && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>SUPPLIER</Text>
              <Text style={styles.cardTextBold}>{po.supplier_name || "—"}</Text>
              {po.supplier_contact && (
                <Text style={styles.cardText}>{po.supplier_contact}</Text>
              )}
            </View>
          )}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>วันที่</Text>
            <Text style={styles.cardText}>สร้าง: {fmtDate(po.created_at)}</Text>
            {po.ordered_date && <Text style={styles.cardText}>สั่ง: {fmtDate(po.ordered_date)}</Text>}
            {po.expected_date && <Text style={styles.cardText}>คาด: {fmtDate(po.expected_date)}</Text>}
            {po.received_date && <Text style={styles.cardText}>รับของ: {fmtDate(po.received_date)}</Text>}
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ผู้สั่ง</Text>
            <Text style={styles.cardTextBold}>{po.created_by_name || "—"}</Text>
            {po.tracking_number && (
              <Text style={styles.cardText}>Tracking: {po.tracking_number}</Text>
            )}
          </View>
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.thead}>
            <Text style={[styles.colNo, styles.th]}>#</Text>
            <Text style={[styles.colName, styles.th]}>รายการ</Text>
            <Text style={[styles.colQty, styles.th]}>จำนวน</Text>
            <Text style={[styles.colUnit, styles.th]}>หน่วย</Text>
            {showPrices && (
              <>
                <Text style={[styles.colPrice, styles.th]}>ราคา</Text>
                <Text style={[styles.colSubtotal, styles.th]}>รวม</Text>
              </>
            )}
          </View>
          {items.map((it, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.colNo, styles.td]}>{i + 1}</Text>
              <View style={styles.colName}>
                <Text style={styles.td}>{it.name}</Text>
                {it.notes && (
                  <Text style={{ fontSize: 8, color: "#64748B", marginTop: 1 }}>
                    {it.notes}
                  </Text>
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
                  <Text style={[styles.colSubtotal, styles.td]}>
                    {(it.subtotal ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </Text>
                </>
              )}
            </View>
          ))}
        </View>

        {/* Totals */}
        {showPrices && po.total != null && po.total > 0 && (
          <>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>ยอดรวม:</Text>
              <Text style={styles.totalsValue}>
                ฿{(po.subtotal ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </Text>
            </View>
            {(po.discount ?? 0) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>ส่วนลด:</Text>
                <Text style={styles.totalsValue}>
                  -฿{(po.discount ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
            {(po.shipping_fee ?? 0) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>ค่าส่ง:</Text>
                <Text style={styles.totalsValue}>
                  ฿{(po.shipping_fee ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
            {(po.vat ?? 0) > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>VAT:</Text>
                <Text style={styles.totalsValue}>
                  ฿{(po.vat ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}
            <View style={styles.grandTotal}>
              <Text style={styles.grandTotalLabel}>ยอดสุทธิ:</Text>
              <Text style={styles.grandTotalValue}>
                ฿{(po.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          </>
        )}

        {/* Notes */}
        {po.notes && (
          <View style={styles.notes}>
            <Text style={{ fontWeight: "bold" }}>หมายเหตุ:</Text>
            <Text>{po.notes}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.signRow}>
          <View style={styles.signBox}>
            <Text>ผู้สั่งซื้อ / Buyer</Text>
            <Text style={{ fontSize: 8, color: "#94A3B8", marginTop: 2 }}>
              ({po.created_by_name || "—"})
            </Text>
          </View>
          <View style={styles.signBox}>
            <Text>ผู้อนุมัติ / Approver</Text>
            <Text style={{ fontSize: 8, color: "#94A3B8", marginTop: 2 }}>(................)</Text>
          </View>
          {showPrices && (
            <View style={styles.signBox}>
              <Text>Supplier</Text>
              <Text style={{ fontSize: 8, color: "#94A3B8", marginTop: 2 }}>
                ({po.supplier_name || "—"})
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          สร้างโดย Lab Parfumo PO Pro • {new Date().toLocaleString("th-TH")}
        </Text>
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
