"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Upload, ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  ImageCompressProgress, ImageCompressSummary,
  type CompressionProgress,
} from "@/components/ui/image-compress-progress";
import { createEquipmentAction } from "@/lib/actions/equipment";
import { uploadMultipleImagesAction } from "@/lib/actions/upload";
import { compressImages } from "@/lib/utils/image";

export function AddEquipmentDialog({
  categories, onClose,
}: {
  categories: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "อุปกรณ์อื่นๆ");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("ชิ้น");
  const [lastCost, setLastCost] = useState(0);
  const [stock, setStock] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(0);
  const [description, setDescription] = useState("");

  // Image upload + compression state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<CompressionProgress>({
    active: false, current: 0, total: 0,
  });
  const [originalSizeTotal, setOriginalSizeTotal] = useState(0);
  const [compressedSizeTotal, setCompressedSizeTotal] = useState(0);

  /** บีบรูปทันทีเมื่อ user เลือก */
  async function handleFilesPicked(picked: File[]) {
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
      setError(`บีบ ${failed.length} รูปไม่ได้`);
    }
    setOriginalSizeTotal((prev) =>
      prev + success.reduce((s, r) => s + r.originalSize, 0),
    );
    setCompressedSizeTotal((prev) =>
      prev + success.reduce((s, r) => s + r.compressedSize, 0),
    );
    // append (ไม่ replace) เพื่อให้ user เพิ่มเติมได้
    setImageFiles((cur) => [...cur, ...success.map((r) => r.file!)]);
  }

  function removeImage(idx: number) {
    setImageFiles((cur) => cur.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ");
      return;
    }

    startTransition(async () => {
      // 1) Upload รูปก่อน (ถ้ามี)
      let imageUrls: string[] = [];
      if (imageFiles.length > 0) {
        const fd = new FormData();
        for (const f of imageFiles) fd.append("files", f);
        const upRes = await uploadMultipleImagesAction(fd, "equipment-images");
        if (!upRes.ok && upRes.error) {
          setError(upRes.error);
          return;
        }
        imageUrls = upRes.urls;
        if (upRes.failed > 0) {
          // upload บางรูปพลาด — แต่ยังคง create equipment ต่อ
          console.warn(`[add-equipment] ${upRes.failed} รูปอัพไม่สำเร็จ`);
        }
      }

      // 2) Create equipment + รูป
      const res = await createEquipmentAction({
        name, category, sku, unit, description,
        lastCost, stock, reorderLevel,
        imageUrls,
      });
      if (!res.ok) {
        setError(res.error ?? "เพิ่มไม่สำเร็จ");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const compressing = progress.active;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">➕ เพิ่มสินค้าใหม่</h2>
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

        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="เช่น ขวดแก้ว 30ml" disabled={pending} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">หมวด</label>
              <select
                className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={pending}
              >
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SKU</label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)}
                     placeholder="LP-BTL-30" disabled={pending} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">หน่วย</label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)}
                     placeholder="ชิ้น" disabled={pending} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ราคาต้นทุน (฿)</label>
              <input type="number" min="0" step="1"
                     className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                     value={lastCost}
                     onChange={(e) => setLastCost(parseFloat(e.target.value) || 0)}
                     disabled={pending} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">สต็อก</label>
              <input type="number" min="0" step="1"
                     className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                     value={stock}
                     onChange={(e) => setStock(parseInt(e.target.value, 10) || 0)}
                     disabled={pending} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              🔴 Reorder Level
              <span className="text-slate-400 text-xs ml-1">(เมื่อ stock ≤ ค่านี้ จะเตือน)</span>
            </label>
            <input type="number" min="0" step="1"
                   className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                   value={reorderLevel}
                   onChange={(e) => setReorderLevel(parseInt(e.target.value, 10) || 0)}
                   disabled={pending} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">รายละเอียด / สเปค</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={pending}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600"
              placeholder="ขนาด / สี / Made in..."
            />
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              📷 รูปสินค้า (เลือกได้หลายรูป — รองรับ HEIC, PNG, JPG)
            </label>

            {/* Compression progress */}
            <ImageCompressProgress progress={progress} />

            {/* Image preview grid */}
            {imageFiles.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {imageFiles.map((file, i) => {
                  const url = URL.createObjectURL(file);
                  return (
                    <div
                      key={`${file.name}-${i}`}
                      className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden group border border-slate-200"
                    >
                      <Image
                        src={url}
                        alt={`รูปที่ ${i + 1}`}
                        fill
                        sizes="(max-width: 640px) 33vw, 120px"
                        className="object-cover"
                        unoptimized
                      />
                      {i === 0 && (
                        <div className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          หลัก
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        disabled={pending}
                        className="absolute top-1 right-1 size-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="ลบรูป"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* File picker */}
            <label
              className={`block border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${
                imageFiles.length > 0
                  ? "bg-brand-50 border-brand-300"
                  : "bg-slate-50 border-slate-300 hover:bg-brand-50 hover:border-brand-300"
              } ${pending || compressing ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  handleFilesPicked(Array.from(e.target.files ?? []));
                  e.target.value = ""; // reset เพื่อให้เลือกไฟล์เดิมซ้ำได้
                }}
                disabled={pending || compressing}
                className="sr-only"
              />
              <div className="flex items-center gap-2 justify-center text-xs">
                {imageFiles.length > 0 ? (
                  <>
                    <ImageIcon className="h-4 w-4 text-brand-700" />
                    <span className="font-semibold text-brand-700">
                      + เพิ่มรูปอีก
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600">
                      คลิกเพื่อเลือกรูป — จะปรับขนาดอัตโนมัติ
                    </span>
                  </>
                )}
              </div>
            </label>

            {/* Summary */}
            {!compressing && originalSizeTotal > 0 && (
              <ImageCompressSummary
                originalTotal={originalSizeTotal}
                compressedTotal={compressedSizeTotal}
                count={imageFiles.length}
              />
            )}
          </div>

          {error && <Alert tone="danger">❌ {error}</Alert>}
        </div>

        <div className="flex gap-2 p-5 pt-3 border-t border-slate-200">
          <Button
            onClick={handleSubmit}
            loading={pending}
            disabled={compressing}
          >
            ✅ เพิ่มสินค้า
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Button>
        </div>
      </div>
    </div>
  );
}
