"use client";

import { useState, useTransition } from "react";
import { Edit3, Plus, ChevronDown, Upload, ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { uploadMultipleImagesAction } from "@/lib/actions/upload";

export function CustomItemForm({
  onAdd,
}: {
  onAdd: (
    name: string, qty: number, unit: string, notes: string,
    imageUrls: string[],
  ) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("ชิ้น");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      // Upload รูปก่อนถ้ามี
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
      setError(null);
    });
  }

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
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="ชิ้น"
                disabled={pending}
              />
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
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              📷 รูปประกอบ (แนะนำ — ให้ admin เห็นว่าจะสั่งอะไร)
            </label>
            <label
              className={`block border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${
                files.length > 0
                  ? "bg-brand-50 border-brand-300"
                  : "bg-slate-50 border-slate-300 hover:bg-brand-50 hover:border-brand-300"
              } ${pending ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                disabled={pending}
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
                      คลิกเพื่อเลือกรูป (5 MB / ไฟล์)
                    </span>
                  </>
                )}
              </div>
            </label>
          </div>

          {error && <Alert tone="danger">❌ {error}</Alert>}

          <Button onClick={handleAdd} size="sm" loading={pending}>
            <Plus className="h-4 w-4" /> เพิ่มเข้าใบ PO
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
