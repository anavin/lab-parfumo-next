"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Trash2, Upload, ImageIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  ImageCompressProgress, ImageCompressSummary,
  type CompressionProgress,
} from "@/components/ui/image-compress-progress";
import { LookupCombobox } from "@/components/ui/lookup-combobox";
import type { Equipment, Lookup } from "@/lib/types/db";
import {
  updateEquipmentAction, addEquipmentImageAction, removeEquipmentImageAction,
} from "@/lib/actions/equipment";
import { uploadMultipleImagesAction } from "@/lib/actions/upload";
import { compressImages } from "@/lib/utils/image";

export function EditEquipmentDialog({
  eq, categories, units, onClose,
}: {
  eq: Equipment;
  categories: string[];
  units?: Lookup[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(eq.name ?? "");
  const [category, setCategory] = useState(eq.category ?? categories[0] ?? "");
  const [sku, setSku] = useState(eq.sku ?? "");
  const [unit, setUnit] = useState(eq.unit ?? "ชิ้น");
  const [lastCost, setLastCost] = useState(eq.last_cost ?? 0);
  const [stock, setStock] = useState(eq.stock ?? 0);
  const [reorderLevel, setReorderLevel] = useState(eq.reorder_level ?? 0);
  const [description, setDescription] = useState(eq.description ?? "");

  // Images: รวมทุก URL จาก eq
  const initialImages = (() => {
    const urls = [...(eq.image_urls ?? [])];
    if (eq.image_url && !urls.includes(eq.image_url)) urls.unshift(eq.image_url);
    return urls;
  })();

  const [images, setImages] = useState<string[]>(initialImages);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [confirmRemoveImg, setConfirmRemoveImg] = useState<string | null>(null);
  const [progress, setProgress] = useState<CompressionProgress>({
    active: false, current: 0, total: 0,
  });
  const [originalSizeTotal, setOriginalSizeTotal] = useState(0);
  const [compressedSizeTotal, setCompressedSizeTotal] = useState(0);

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
    setOriginalSizeTotal(success.reduce((s, r) => s + r.originalSize, 0));
    setCompressedSizeTotal(success.reduce((s, r) => s + r.compressedSize, 0));
    setNewImageFiles(success.map((r) => r.file!));
  }

  const willTriggerLowStock = reorderLevel > 0 && stock <= reorderLevel;

  // ==== Image actions ====
  async function handleUploadImages() {
    if (!newImageFiles.length) return;
    setError(null);
    setUploadingImages(true);
    try {
      const fd = new FormData();
      for (const f of newImageFiles) fd.append("files", f);
      const upRes = await uploadMultipleImagesAction(fd, "equipment-images");
      if (!upRes.ok && upRes.error) {
        setError(upRes.error);
        return;
      }
      // Add each URL to equipment
      for (const url of upRes.urls) {
        await addEquipmentImageAction(eq.id, url);
      }
      setImages((cur) => [...cur, ...upRes.urls]);
      setNewImageFiles([]);
      setOriginalSizeTotal(0);
      setCompressedSizeTotal(0);
      router.refresh();
    } finally {
      setUploadingImages(false);
    }
  }

  async function handleRemoveImage(url: string) {
    setError(null);
    setUploadingImages(true);
    try {
      const res = await removeEquipmentImageAction(eq.id, url);
      if (!res.ok) {
        setError(res.error ?? "ลบรูปไม่สำเร็จ");
        return;
      }
      setImages((cur) => cur.filter((u) => u !== url));
      setConfirmRemoveImg(null);
      router.refresh();
    } finally {
      setUploadingImages(false);
    }
  }

  function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("กรุณากรอกชื่อ");
      return;
    }
    startTransition(async () => {
      const res = await updateEquipmentAction(eq.id, {
        name, category, sku, unit, description,
        lastCost, stock, reorderLevel,
      });
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900">✏️ แก้ไขสินค้า</h2>
            <p className="text-xs text-slate-500 mt-0.5">{eq.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending || uploadingImages}
            className="text-slate-400 hover:text-slate-700"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* ===== Image management ===== */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              🖼️ รูปภาพสินค้า ({images.length})
            </h3>
            {images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {images.map((url, i) => (
                  <div
                    key={url}
                    className="aspect-square bg-slate-100 rounded-lg overflow-hidden relative group border border-slate-200"
                  >
                    <Image
                      src={url}
                      alt={`รูปที่ ${i + 1}`}
                      fill
                      sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 120px"
                      className="object-cover"
                      unoptimized
                    />
                    {i === 0 && (
                      <div className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                        <Star className="h-2.5 w-2.5" /> หลัก
                      </div>
                    )}
                    {confirmRemoveImg === url ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(url)}
                        disabled={uploadingImages}
                        className="absolute inset-0 bg-red-600/90 text-white text-xs font-bold flex items-center justify-center"
                      >
                        ⚠️ ยืนยันลบ
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveImg(url)}
                        disabled={uploadingImages}
                        className="absolute top-1 right-1 h-7 w-7 rounded-full bg-white/95 text-red-600 hover:bg-red-50 inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        aria-label="ลบรูป"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Compression progress */}
            <ImageCompressProgress progress={progress} />

            {/* Upload more */}
            <label
              className={`block border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${
                newImageFiles.length > 0
                  ? "bg-brand-50 border-brand-400"
                  : "bg-slate-50 border-slate-300 hover:bg-brand-50 hover:border-brand-400"
              } ${uploadingImages || progress.active ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <input
                type="file" accept="image/*" multiple
                onChange={(e) => handleFilesPicked(Array.from(e.target.files ?? []))}
                disabled={uploadingImages || progress.active}
                className="sr-only"
              />
              <div className="flex items-center gap-2 justify-center text-xs">
                {newImageFiles.length > 0 ? (
                  <>
                    <ImageIcon className="h-4 w-4 text-brand-700" />
                    <span className="font-semibold text-brand-700">
                      ✅ เลือก {newImageFiles.length} รูปแล้ว
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-600">คลิกเพื่อเพิ่มรูป — จะปรับขนาดอัตโนมัติ</span>
                  </>
                )}
              </div>
            </label>

            {!progress.active && originalSizeTotal > 0 && (
              <ImageCompressSummary
                originalTotal={originalSizeTotal}
                compressedTotal={compressedSizeTotal}
                count={newImageFiles.length}
                className="mt-2"
              />
            )}
            {newImageFiles.length > 0 && (
              <Button
                size="sm" onClick={handleUploadImages}
                loading={uploadingImages}
                className="mt-2"
              >
                <Upload className="h-3.5 w-3.5" /> อัปโหลด {newImageFiles.length} รูป
              </Button>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200" />

          {/* ===== Basic info ===== */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={pending} />
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
              <Input value={sku} onChange={(e) => setSku(e.target.value)} disabled={pending} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">หน่วย</label>
              {units && units.length > 0 ? (
                <LookupCombobox
                  type="equipment_unit"
                  options={units}
                  value={unit}
                  onChange={setUnit}
                  placeholder="เลือก..."
                  allowCreate
                  manageHref="/settings"
                  disabled={pending}
                />
              ) : (
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} disabled={pending} />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">ราคาต้นทุน</label>
              <input type="number" min="0" step="0.01"
                     className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                     value={lastCost === 0 ? "" : lastCost}
                     placeholder="0.00"
                     onFocus={(e) => e.currentTarget.select()}
                     onChange={(e) => setLastCost(parseFloat(e.target.value) || 0)}
                     disabled={pending} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">สต็อก</label>
              <input type="number" min="0" step="1"
                     className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                     value={stock === 0 ? "" : stock}
                     placeholder="0"
                     onFocus={(e) => e.currentTarget.select()}
                     onChange={(e) => setStock(parseInt(e.target.value, 10) || 0)}
                     disabled={pending} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">🔴 Reorder Level</label>
            <input type="number" min="0" step="1"
                   className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm tabular-nums"
                   value={reorderLevel === 0 ? "" : reorderLevel}
                   placeholder="0"
                   onFocus={(e) => e.currentTarget.select()}
                   onChange={(e) => setReorderLevel(parseInt(e.target.value, 10) || 0)}
                   disabled={pending} />
            {willTriggerLowStock && (
              <div className="text-xs text-amber-700 mt-1">
                ⚠️ สต็อก ({stock}) ≤ Reorder Level ({reorderLevel}) — สินค้านี้จะถูกขึ้น Low-Stock List
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">รายละเอียด</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={pending}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600"
            />
          </div>
          {error && <Alert tone="danger">❌ {error}</Alert>}
        </div>

        <div className="flex gap-2 p-5 pt-3 border-t border-slate-200">
          <Button onClick={handleSubmit} loading={pending}>💾 บันทึก</Button>
          <Button variant="secondary" onClick={onClose} disabled={pending || uploadingImages}>
            ยกเลิก
          </Button>
        </div>
      </div>
    </div>
  );
}
