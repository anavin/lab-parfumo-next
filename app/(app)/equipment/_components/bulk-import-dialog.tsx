"use client";

/**
 * Bulk CSV Import Dialog (Phase C)
 *
 * Flow: pick file → parse client-side → preview + validation → confirm → bulk insert
 *
 * รองรับ CSV header: name, category, sku, unit, last_cost, stock, reorder_level, description
 * (header เป็น optional บางช่อง — ต้องมีอย่างน้อย "name")
 */
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { parseCsvWithHeader } from "@/lib/csv/parse";
import {
  bulkCreateEquipmentAction,
  type BulkRowInput,
} from "@/lib/actions/equipment";

interface ParsedRow extends BulkRowInput {
  __row: number; // 1-indexed for human display
  __error?: string; // validation error
}

const SAMPLE_CSV = `name,category,sku,unit,last_cost,stock,reorder_level,description
ขวดน้ำหอม 50ml,บรรจุภัณฑ์,B001,ชิ้น,15.50,100,20,ขวดใส
กล่องกระดาษ S,บรรจุภัณฑ์,B002,ชิ้น,5.00,200,50,
น้ำมันหอมระเหย Lavender,สารเคมี,C001,ml,250.00,500,100,grade A
`;

export function BulkImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    inserted: number;
    skipped: number;
    failed: number;
    failedReasons?: string[];
  } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  function handlePicked(file: File) {
    setParseError(null);
    const reader = new FileReader();
    reader.onerror = () => setParseError("อ่านไฟล์ไม่สำเร็จ");
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const { headers, rows: dictRows } = parseCsvWithHeader(text);
        if (!headers.includes("name")) {
          setParseError(
            'ไม่พบคอลัมน์ "name" — ต้องมีอย่างน้อย header: name (ดู template)',
          );
          return;
        }
        if (dictRows.length === 0) {
          setParseError("ไฟล์ว่าง / ไม่มีข้อมูลใต้ header");
          return;
        }
        if (dictRows.length > 5000) {
          setParseError(`เกิน limit 5,000 แถว (มี ${dictRows.length} แถว) — ลอง split ไฟล์`);
          return;
        }
        const parsed: ParsedRow[] = dictRows.map((d, idx) => {
          const r: ParsedRow = {
            __row: idx + 2, // +1 for header, +1 for 1-indexed
            name: d.name ?? "",
            category: d.category ?? "",
            sku: d.sku ?? "",
            unit: d.unit ?? "",
            description: d.description ?? "",
            lastCost: numOrUndef(d.last_cost),
            stock: numOrUndef(d.stock),
            reorderLevel: numOrUndef(d.reorder_level),
          };
          if (!r.name?.trim()) r.__error = "ไม่มีชื่อ";
          else if (r.lastCost !== undefined && (Number.isNaN(r.lastCost) || r.lastCost < 0)) r.__error = "last_cost ไม่ถูกต้อง";
          else if (r.stock !== undefined && (Number.isNaN(r.stock) || r.stock < 0)) r.__error = "stock ไม่ถูกต้อง";
          else if (r.reorderLevel !== undefined && (Number.isNaN(r.reorderLevel) || r.reorderLevel < 0)) r.__error = "reorder_level ไม่ถูกต้อง";
          return r;
        });
        setRows(parsed);
        setStep("preview");
      } catch (e) {
        setParseError("รูปแบบ CSV ไม่ถูกต้อง: " + (e instanceof Error ? e.message : "unknown"));
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function downloadTemplate() {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "equipment-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function confirmImport() {
    const validRows = rows.filter((r) => !r.__error);
    if (validRows.length === 0) {
      toast.error("ไม่มีแถวที่ถูกต้อง");
      return;
    }
    start(async () => {
      const r = await bulkCreateEquipmentAction(
        validRows.map((row) => ({
          name: row.name,
          category: row.category,
          sku: row.sku,
          unit: row.unit,
          description: row.description,
          lastCost: row.lastCost,
          stock: row.stock,
          reorderLevel: row.reorderLevel,
        })),
      );
      if (!r.ok) {
        toast.error(r.error ?? "Import ไม่สำเร็จ");
        return;
      }
      setResult({
        inserted: r.inserted,
        skipped: r.skipped + (rows.length - validRows.length),
        failed: r.failed,
        failedReasons: r.failedReasons,
      });
      setStep("done");
      toast.success(`เพิ่ม ${r.inserted} รายการ`);
      router.refresh();
    });
  }

  const validCount = rows.filter((r) => !r.__error).length;
  const invalidCount = rows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl my-8 shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">
            📥 Import สินค้าจาก CSV
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-slate-400 hover:text-slate-700"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === "upload" && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <div className="font-semibold text-blue-900 mb-2">
                  รูปแบบไฟล์ CSV ที่รองรับ
                </div>
                <ul className="text-xs text-blue-800 space-y-0.5 list-disc pl-5">
                  <li>
                    <b>name</b> (จำเป็น) — ชื่อสินค้า (ห้ามซ้ำกับใน DB)
                  </li>
                  <li>
                    <b>category</b>, <b>sku</b>, <b>unit</b>, <b>description</b>{" "}
                    — ข้อความ
                  </li>
                  <li>
                    <b>last_cost</b>, <b>stock</b>, <b>reorder_level</b> —
                    ตัวเลข (default = 0)
                  </li>
                  <li>Encoding: UTF-8 • คั่นด้วย comma • รองรับ "quoted, fields"</li>
                  <li>Limit: สูงสุด 5,000 แถว/ไฟล์</li>
                </ul>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadTemplate}
                  className="mt-3"
                >
                  <Download className="size-3.5 mr-1.5" />
                  Download template
                </Button>
              </div>

              {parseError && (
                <Alert tone="destructive" hideIcon>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="size-4 mt-0.5 flex-shrink-0" />
                    <span>{parseError}</span>
                  </div>
                </Alert>
              )}

              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePicked(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="w-full border-2 border-dashed border-slate-300 rounded-xl p-10 hover:border-primary hover:bg-primary/5 transition-colors text-center"
              >
                <Upload className="size-8 mx-auto text-slate-400 mb-2" />
                <div className="font-semibold text-slate-700">
                  คลิกเพื่อเลือกไฟล์ CSV
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  หรือลาก-วาง — รองรับ .csv เท่านั้น
                </div>
              </button>
            </>
          )}

          {step === "preview" && (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm">
                  พบ <b>{rows.length}</b> แถว — ผ่าน{" "}
                  <b className="text-emerald-600">{validCount}</b>
                  {invalidCount > 0 && (
                    <>
                      {" "}
                      • มีปัญหา{" "}
                      <b className="text-red-600">{invalidCount}</b> แถว
                    </>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRows([]);
                    setStep("upload");
                  }}
                >
                  เปลี่ยนไฟล์
                </Button>
              </div>

              <div className="border border-slate-200 rounded-lg max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr className="border-b border-slate-200">
                      <th className="px-2 py-2 text-left">#</th>
                      <th className="px-2 py-2 text-left">ชื่อ</th>
                      <th className="px-2 py-2 text-left">หมวดหมู่</th>
                      <th className="px-2 py-2 text-left">SKU</th>
                      <th className="px-2 py-2 text-left">หน่วย</th>
                      <th className="px-2 py-2 text-right">ราคา</th>
                      <th className="px-2 py-2 text-right">stock</th>
                      <th className="px-2 py-2 text-right">reorder</th>
                      <th className="px-2 py-2 text-left">ปัญหา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((r) => (
                      <tr
                        key={r.__row}
                        className={`border-b border-slate-100 ${r.__error ? "bg-red-50" : ""}`}
                      >
                        <td className="px-2 py-1.5 text-slate-500">
                          {r.__row}
                        </td>
                        <td className="px-2 py-1.5 font-medium">{r.name}</td>
                        <td className="px-2 py-1.5">{r.category}</td>
                        <td className="px-2 py-1.5">{r.sku}</td>
                        <td className="px-2 py-1.5">{r.unit}</td>
                        <td className="px-2 py-1.5 text-right">
                          {r.lastCost ?? "-"}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {r.stock ?? "-"}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {r.reorderLevel ?? "-"}
                        </td>
                        <td className="px-2 py-1.5 text-red-600">
                          {r.__error ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 200 && (
                  <div className="text-center text-xs text-slate-500 py-2 border-t bg-slate-50">
                    แสดง 200 แถวแรก จากทั้งหมด {rows.length} แถว
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={onClose} disabled={pending}>
                  ยกเลิก
                </Button>
                <Button
                  onClick={confirmImport}
                  disabled={pending || validCount === 0}
                >
                  {pending ? "กำลัง import..." : `ยืนยัน import ${validCount} รายการ`}
                </Button>
              </div>
            </>
          )}

          {step === "done" && result && (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 className="size-14 mx-auto text-emerald-500" />
              <div>
                <div className="text-xl font-bold">Import สำเร็จ</div>
                <div className="text-sm text-slate-600 mt-1">
                  เพิ่ม{" "}
                  <b className="text-emerald-600">{result.inserted}</b> รายการ
                  {result.skipped > 0 && (
                    <>
                      {" "}
                      • ข้าม{" "}
                      <b className="text-amber-600">{result.skipped}</b> (ซ้ำ/ไม่ถูกต้อง)
                    </>
                  )}
                  {result.failed > 0 && (
                    <>
                      {" "}
                      • ล้มเหลว{" "}
                      <b className="text-red-600">{result.failed}</b>
                    </>
                  )}
                </div>
                {result.failedReasons && (
                  <div className="text-xs text-red-600 mt-2 text-left bg-red-50 border border-red-200 rounded p-2">
                    {result.failedReasons.map((r, i) => (
                      <div key={i}>• {r}</div>
                    ))}
                  </div>
                )}
              </div>
              <Button onClick={onClose}>ปิด</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function numOrUndef(v: string): number | undefined {
  const trimmed = (v ?? "").trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}
