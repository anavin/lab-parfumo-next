"use client";

/**
 * ปุ่มดาวน์โหลด PDF — render ฝั่ง browser
 *
 * ⭐ @react-pdf รันบน Cloudflare Workers ไม่ได้ (ใช้ node:fs) จึง render ในเบราว์เซอร์แทน:
 *   1) fetch ข้อมูล PO (JSON) จาก /po/[id]/pdf-data (ตรวจสิทธิ์ฝั่ง server)
 *   2) dynamic import @react-pdf (browser build) + PoDocument → สร้าง Blob
 *   3) trigger ดาวน์โหลด
 *
 * dynamic import ทำให้ bundle @react-pdf (~1MB) โหลดเฉพาะตอนกดปุ่ม (code-split)
 */
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

export function PdfDownloadButton({
  poId,
  poNumber,
  className,
  children,
}: {
  poId: string;
  poNumber: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/po/${poId}/pdf-data`);
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(
          detail?.error === "forbidden"
            ? "คุณไม่มีสิทธิ์ดู PDF ของ PO นี้"
            : `โหลดข้อมูลไม่สำเร็จ (${res.status})`,
        );
      }
      const { po, company, showPrices } = await res.json();

      // โหลด @react-pdf + PoDocument เฉพาะตอนใช้ (code-split)
      const [{ pdf }, { PoDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/po-document"),
      ]);

      const blob = await pdf(
        <PoDocument po={po} company={company} showPrices={showPrices} />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${poNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[pdf] client render failed:", e);
      toast.error(e instanceof Error ? e.message : "สร้าง PDF ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={handleDownload} disabled={loading} className={className}>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {children ?? (loading ? "กำลังสร้าง…" : "ดาวน์โหลด PDF")}
    </button>
  );
}
