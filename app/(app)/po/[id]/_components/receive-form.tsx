"use client";

/**
 * Receive form — บันทึกการรับของ
 * Features: qty received + qty damaged + condition + รูปประกอบ
 */
import { useState, useTransition } from "react";
import { PackageOpen, X, Upload, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { addDeliveryAction } from "@/lib/actions/po";
import { uploadMultipleImagesAction } from "@/lib/actions/upload";
import type { PoItem } from "@/lib/types/db";

const CONDITIONS = [
  "ปกติ", "มีของเสียหาย", "ขาดจำนวน", "ส่งผิด", "อื่นๆ",
];

interface ItemState {
  qty_received: number;
  qty_damaged: number;
  notes: string;
}

export function ReceiveForm({
  poId, poNumber, supplier, tracking, expectedDate, items,
  onClose,
}: {
  poId: string;
  poNumber: string;
  supplier: string | null;
  tracking: string | null;
  expectedDate: string | null;
  items: PoItem[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // State per item
  const [itemStates, setItemStates] = useState<ItemState[]>(() =>
    items.map((it) => ({
      qty_received: it.qty ?? 0,
      qty_damaged: 0,
      notes: "",
    })),
  );

  function updateItem(idx: number, patch: Partial<ItemState>) {
    setItemStates((cur) =>
      cur.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );
  }

  // Auto-detect issue
  const hasIssue = itemStates.some((s, i) =>
    s.qty_received !== (items[i].qty ?? 0) || s.qty_damaged > 0,
  );

  const [overallCondition, setOverallCondition] = useState<string>(
    () => (hasIssue ? "มีของเสียหาย" : "ปกติ"),
  );
  const [issueDescription, setIssueDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;
    setFiles(Array.from(list));
  }

  function handleSubmit() {
    setError(null);
    if (overallCondition !== "ปกติ" && !issueDescription.trim()) {
      setError("กรุณาระบุรายละเอียดปัญหา");
      return;
    }

    startTransition(async () => {
      // 1) Upload รูป (ถ้ามี)
      let imageUrls: string[] = [];
      if (files.length > 0) {
        const fd = new FormData();
        for (const f of files) fd.append("files", f);
        const upRes = await uploadMultipleImagesAction(fd, "delivery-images");
        if (!upRes.ok && upRes.error) {
          setError(upRes.error);
          return;
        }
        imageUrls = upRes.urls;
        // failed uploads — silent (not blocking, user already sees URLs that succeeded)
      }

      // 2) Submit delivery
      const itemsReceived = items.map((it, i) => ({
        equipment_id: it.equipment_id ?? null,
        name: it.name,
        qty_ordered: it.qty ?? 0,
        qty_received: itemStates[i].qty_received,
        qty_damaged: itemStates[i].qty_damaged,
        notes: itemStates[i].notes,
      }));
      const res = await addDeliveryAction(poId, {
        itemsReceived,
        overallCondition,
        issueDescription,
        notes,
        imageUrls,
      });
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      onClose();
    });
  }

  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-slate-200">
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 text-white p-4 rounded-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
          <PackageOpen className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-bold">บันทึกการรับของ — {poNumber}</div>
          <div className="text-xs text-white/85 truncate">
            {supplier ?? "—"} • {items.length} รายการ
            {tracking && ` • Tracking: ${tracking}`}
            {expectedDate && ` • คาดได้รับ: ${fmtDate(expectedDate)}`}
          </div>
        </div>
      </div>

      {/* Per-item input */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-2">
          📦 รายการที่ได้รับ ({items.length})
        </h3>
        <div className="space-y-2">
          {items.map((it, i) => {
            const ordered = it.qty ?? 0;
            const received = itemStates[i].qty_received;
            const damaged = itemStates[i].qty_damaged;
            const isProblem = received !== ordered || damaged > 0;

            return (
              <div
                key={i}
                className={`bg-white border rounded-xl p-3 transition-colors ${
                  isProblem ? "border-amber-300 ring-1 ring-amber-100" : "border-slate-200"
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
                  <div className="sm:col-span-4">
                    <div className="text-sm font-semibold text-slate-900">{it.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      สั่ง: <span className="font-semibold tabular-nums">{ordered.toLocaleString("th-TH")}</span> {it.unit}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor={`item-${i}-received`}
                      className="block text-[11px] font-medium text-slate-700 mb-0.5"
                    >
                      ได้รับ
                    </label>
                    <input
                      id={`item-${i}-received`}
                      type="number" min="0"
                      value={received}
                      onChange={(e) => updateItem(i, {
                        qty_received: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })}
                      disabled={pending}
                      className="h-9 w-full px-2 rounded-lg border border-slate-300 bg-white text-sm tabular-nums text-right"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor={`item-${i}-damaged`}
                      className="block text-[11px] font-medium text-slate-700 mb-0.5"
                    >
                      เสียหาย
                    </label>
                    <input
                      id={`item-${i}-damaged`}
                      type="number" min="0" max={received}
                      value={damaged}
                      onChange={(e) => updateItem(i, {
                        qty_damaged: Math.max(0, Math.min(received, parseInt(e.target.value, 10) || 0)),
                      })}
                      disabled={pending}
                      className="h-9 w-full px-2 rounded-lg border border-slate-300 bg-white text-sm tabular-nums text-right"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-medium text-slate-700 mb-0.5">
                      หมายเหตุ
                    </label>
                    <input
                      type="text"
                      value={itemStates[i].notes}
                      onChange={(e) => updateItem(i, { notes: e.target.value })}
                      placeholder="เช่น มีรอยขนส่ง"
                      disabled={pending}
                      className="h-9 w-full px-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overall condition */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            สภาพรวม
          </label>
          <select
            value={overallCondition}
            onChange={(e) => setOverallCondition(e.target.value)}
            disabled={pending}
            className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {overallCondition !== "ปกติ" && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            รายละเอียดปัญหา *
          </label>
          <textarea
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            placeholder="เช่น ขวดแตก 5 อัน เสียหายระหว่างขนส่ง"
            rows={2}
            disabled={pending}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 disabled:bg-slate-100"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          หมายเหตุเพิ่มเติม
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="(ถ้ามี)"
          rows={2}
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 disabled:bg-slate-100"
        />
      </div>

      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          📸 รูปประกอบ (ใบส่งของ / รูปสินค้า / รูปความเสียหาย)
        </label>
        <label
          className={`block border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${
            files.length > 0
              ? "bg-brand-50 border-brand-300"
              : "bg-slate-50 border-slate-300 hover:bg-brand-50 hover:border-brand-300"
          } ${pending ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={pending}
            className="sr-only"
          />
          <div className="flex items-center gap-3 justify-center text-sm">
            {files.length > 0 ? (
              <>
                <ImageIcon className="h-5 w-5 text-brand-700" />
                <span className="font-semibold text-brand-700">
                  ✅ เลือก {files.length} รูปแล้ว
                </span>
                <span className="text-slate-500 text-xs">
                  ({(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB)
                </span>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 text-slate-400" />
                <span className="text-slate-600">
                  คลิกเพื่อเลือกรูป (เลือกหลายไฟล์ได้)
                </span>
              </>
            )}
          </div>
          <div className="text-xs text-slate-400 text-center mt-1">
            รูปสูงสุด 5 MB ต่อไฟล์
          </div>
        </label>
      </div>

      {error && <Alert tone="danger">❌ {error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSubmit} loading={pending}>
          ✅ ยืนยันรับของ
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          <X className="h-4 w-4" /> ยกเลิก
        </Button>
      </div>
    </div>
  );
}

function fmtDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString("th-TH", {
      day: "2-digit", month: "short",
    });
  } catch {
    return d;
  }
}
