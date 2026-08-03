"use client";

/**
 * Triggers window.print() once on mount — so opening /po/[id]/print
 * pops the browser print dialog immediately
 */
import { useEffect } from "react";

export function PrintTrigger() {
  useEffect(() => {
    // Wait one frame to ensure layout settled
    const t = setTimeout(() => {
      if (typeof window !== "undefined") window.print();
    }, 250);
    return () => clearTimeout(t);
  }, []);
  return null;
}

/**
 * Button that re-opens the print dialog (for when auto-print didn't fire
 * or the user dismissed it). Replaces the old "ดาวน์โหลด PDF" button
 * that linked to /api/po/[id]/pdf — that path uses @react-pdf which
 * drops leading Thai consonants (ฝ/ผ/ฟ). Browser print + "Save as PDF"
 * renders Thai correctly.
 */
export function PrintNowButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
      style={{
        background: "#3A5A8C", color: "#fff", padding: "4px 12px",
        borderRadius: 6, textDecoration: "none", fontWeight: 600,
        border: "none", cursor: "pointer", fontSize: 13,
      }}
    >
      🖨️ พิมพ์ / บันทึก PDF
    </button>
  );
}
