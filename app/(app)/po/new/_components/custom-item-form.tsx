"use client";

import { useState, useTransition } from "react";
import { Edit3, Plus, ChevronDown, Upload, ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  ImageCompressProgress, ImageCompressSummary,
  type CompressionProgress,
} from "@/components/ui/image-compress-progress";
import { LookupCombobox } from "@/components/ui/lookup-combobox";
import { uploadMultipleImagesAction } from "@/lib/actions/upload";
import { compressImages } from "@/lib/utils/image";
import type { Lookup } from "@/lib/types/db";

export function CustomItemForm({
  onAdd, units, canCreateLookup,
}: {
  onAdd: (
    name: string, qty: number, unit: string, notes: string,
    imageUrls: string[],
  ) => void;
  units?: Lookup[];
  /** ผู้ใช้ปัจจุบันมีสิทธิ์สร้าง lookup ใหม่ได้มั้ย (admin/supervisor) */
  canCreateLookup?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("ชิ้น");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Compression state
  const [progress, setProgress] = useState<CompressionProgress>({
    active: false, current: 0, total: 0,
  });
  const [originalSizeTotal, setOriginalSizeTotal] = useState(0);
  const [compressedSizeTotal, setCompressedSizeTotal] = useState(0);

  /** บีบรูปทันทีเมื่อ user เลือก — ก่อนกดปุ่มเพิ่ม */
  async function handleFilesSelected(picked: File[]) {
    if (!picked.length) return;
    setError(null);
    setProgress({ active: true, current: 0, total: picked.length });
    setOriginalSizeTotal(0);
    setCompressedSizeTotal(0);

    const results = await compressImages(
      picked,
      { maxWidthOrHeight: 1920, maxSizeMB: 1, initialQuality: 0.85 },
      (current, total, fileName) => {
        setProgress({ active: true, current, total, fileName });
      },
    );

    setProgress({ active: false, current: 0, total: 0 });

    const success = results.filter((r) => r.ok && r.file);
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      setError(`บีบ ${failed.length} รูปไม่ได้ — รูปอาจเสียหายหรือไม่รองรับ`);
    }

    setOriginalSizeTotal(success.reduce((s, r) => s + r.originalSize, 0));
    setCompressedSizeTotal(success.reduce((s, r) => s + r.compressedSize, 0));
    setFiles(success.map((r) => r.file!));
  }

  function handleAdd() {
    setError(null);
    if (!name.trim()) {
      setError("กรุณาพิมพ์ชื่อรายการ");
      return;
    }
    const qtyNum = parseInt(qty, 10);
    if (!qtyNum || qtyNum < 1) {
      setError("จำนวนต้องอย่างน้อย 1");
      return;
    }

    startTransition(async () => {
      // Upload รูปก่อนถ้ามี (รูปบีบเสร็จแล้ว)
      let imageUrls: string[] = [];
      if (files.length > 0) {
        const fd = new FormData();
        for (const f of files) fd.append("files", f);
        const res = await uploadMultipleImagesAction(fd, "equipment-images");
        if (!res.ok && res.error) {
          setError(res.error);
          return;
        }
        imageUrls = res.urls;
      }

      onAdd(name.trim(), qtyNum, unit.trim() || "ชิ้น", notes.trim(), imageUrls);
      // Reset
      setName("");
      setQty("1");
      setUnit("ชิ้น");
      setNotes("");
      setFiles([]);
      setOriginalSizeTotal(0);
      setCompressedSizeTotal(0);
      setError(null);
    });
  }

  const compressing = progress.active;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-slate-900">
            พิมพ์ชื่อเอง (สำหรับรายการที่ไม่มีใน catalog)
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ชื่อรายการ *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="พิมพ์ชื่ออุปกรณ์"
                disabled={pending}
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                จำนวน *
              </label>
              <Input
                type="number" min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                หน่วย
              </label>
              {units && units.length > 0 ? (
                <LookupCombobox
                  type="equipment_unit"
                  options={units}
                  value={unit}
                  onChange={setUnit}
                  placeholder="เลือก..."
                  allowCreate={canCreateLookup}
                  disabled={pending}
                />
              ) : (
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="ชิ้น"
                  disabled={pending}
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              หมายเหตุ (ถ้ามี)
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น สเปคพิเศษ / ยี่ห้อ / สี"
              disabled={pending}
            />
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              📷 รูปประกอบ (แนะนำ — ให้ admin เห็นว่าจะสั่งอะไร)
            </label>

            {/* Compression in progress */}
            <ImageCompressProgress progress={progress} />

            <label
              className={`block border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${
                files.length > 0
                  ? "bg-brand-50 border-brand-300"
                  : "bg-slate-50 border-slate-300 hover:bg-brand-50 hover:border-brand-300"
              } ${pending || compressing ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFilesSelected(Array.from(e.target.files ?? []))}
                disabled={pending || compressing}
                className="sr-only"
              />
              <div className="flex items-center gap-2 justify-center text-xs">
                {files.length > 0 ? (
                  <>
                    <ImageIcon className="h-4 w-4 text-brand-700" />
                    <span className="font-semibold text-brand-700">
                      ✅ เลือก {files.length} รูปแล้ว
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600">
                      คลิกเพื่อเลือกรูป — จะปรับขนาดอัตโนมัติ (รองรับ HEIC, PNG, JPG)
                    </span>
                  </>
                )}
              </div>
            </label>

            {/* Summary หลังบีบเสร็จ */}
            {!compressing && originalSizeTotal > 0 && (
              <ImageCompressSummary
                originalTotal={originalSizeTotal}
                compressedTotal={compressedSizeTotal}
                count={files.length}
              />
            )}
          </div>

          {error && <Alert tone="danger">❌ {error}</Alert>}

          <Button onClick={handleAdd} size="sm" loading={pending} disabled={compressing}>
            <Plus className="h-4 w-4" /> เพิ่มเข้าใบ PO
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
