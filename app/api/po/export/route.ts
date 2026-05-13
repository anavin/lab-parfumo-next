/**
 * GET /api/po/export — export filtered POs as CSV
 *
 * Query params (เหมือนหน้า /po):
 *   status   = "ทั้งหมด" / "สั่งซื้อแล้ว" / etc.
 *   search   = text search ชื่อ/PO number/supplier
 *   from     = YYYY-MM-DD (filter created_at >=)
 *   to       = YYYY-MM-DD (filter created_at <=)
 *
 * Output: CSV (UTF-8 with BOM สำหรับ Excel ภาษาไทย)
 *   Filename: lab-parfumo-po-YYYY-MM-DD.csv
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getPos, applyPoFilters } from "@/lib/db/po";
import type { PurchaseOrder, PoStatus } from "@/lib/types/db";

const VALID_STATUSES: PoStatus[] = [
  "รอจัดซื้อดำเนินการ", "สั่งซื้อแล้ว", "กำลังขนส่ง",
  "รับของแล้ว", "มีปัญหา", "เสร็จสมบูรณ์", "ยกเลิก",
];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "ทั้งหมด";
  const search = url.searchParams.get("search") ?? "";
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  // Fetch — staff เห็นแค่ของตัวเอง (ตาม role logic เดิม)
  // จำกัด 1000 แถว เพื่อกัน DoS + ทำให้ Excel เปิดไหว
  // ถ้าต้องการ export มากกว่านี้ → ใช้ filter ลดลง (date range / status)
  const EXPORT_LIMIT = 1000;
  const all = await getPos({
    userId: user.id,
    role: user.role,
    limit: EXPORT_LIMIT,
  });

  // Filter (re-use logic จาก PO list)
  // Validate status — ถ้า invalid ให้ undefined (ไม่ filter)
  const validStatus = (VALID_STATUSES as string[]).includes(status)
    ? (status as PoStatus)
    : undefined;
  const filtered = applyPoFilters(all, {
    status: validStatus,
    search,
    fromDate: from,
    toDate: to,
  });

  // Build CSV
  const csv = buildCsv(filtered, user.role);
  const filename = buildFilename({ status, from, to });

  // UTF-8 BOM ทำให้ Excel เปิดภาษาไทยได้ถูก
  const BOM = "﻿";
  return new NextResponse(BOM + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

function buildCsv(pos: PurchaseOrder[], role: string): string {
  const isPrivileged = role === "admin" || role === "supervisor";

  // Headers — ภาษาไทยเพื่อให้ user เปิดใน Excel เข้าใจง่าย
  const headers = [
    "เลขที่ PO",
    "สถานะ",
    "Supplier",
    ...(isPrivileged ? ["รวมสุทธิ (บาท)", "ค่าส่ง", "VAT", "ส่วนลด"] : []),
    "จำนวนรายการ",
    "ผู้สร้าง",
    "วันที่สร้าง",
    "วันที่สั่ง supplier",
    "วันที่คาดว่าจะได้รับ",
    "วันรับของ",
    "Tracking Number",
    "หมายเหตุ",
    ...(isPrivileged ? ["หมายเหตุจัดซื้อ"] : []),
  ];

  const rows = pos.map((p) => [
    p.po_number,
    p.status,
    p.supplier_name ?? "",
    ...(isPrivileged ? [
      p.total ?? 0,
      p.shipping_fee ?? 0,
      p.vat ?? 0,
      p.discount ?? 0,
    ] : []),
    (p.items ?? []).length,
    p.created_by_name ?? "",
    fmtDate(p.created_at),
    fmtDate(p.ordered_date),
    fmtDate(p.expected_date),
    fmtDate(p.received_date),
    p.tracking_number ?? "",
    p.notes ?? "",
    ...(isPrivileged ? [p.procurement_notes ?? ""] : []),
  ]);

  // Escape CSV: " → "" และ wrap ด้วย " ถ้ามี comma/quote/newline
  const escape = (v: unknown): string => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const csvLines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return csvLines.join("\r\n");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  // ISO → "YYYY-MM-DD" (Excel parse เป็น date ได้)
  return iso.slice(0, 10);
}

function buildFilename(opts: { status: string; from: string; to: string }): string {
  const today = new Date().toISOString().slice(0, 10);
  const parts = ["lab-parfumo-po"];
  if (opts.status && opts.status !== "ทั้งหมด") parts.push(opts.status);
  if (opts.from) parts.push(`from-${opts.from}`);
  if (opts.to) parts.push(`to-${opts.to}`);
  parts.push(today);
  return parts.join("_").replace(/[^\w฀-๿._-]/g, "-") + ".csv";
}
