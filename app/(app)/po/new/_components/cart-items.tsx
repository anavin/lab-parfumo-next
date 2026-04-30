"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Minus, Plus, Trash2, Pencil, ImageOff,
  X, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { Equipment, PoItem } from "@/lib/types/db";

export function CartItems({
  items, equipment, onUpdateQty, onRemove,
}: {
  items: PoItem[];
  equipment: Equipment[];
  onUpdateQty: (idx: number, qty: number) => void;
  onRemove: (idx: number) => void;
}) {
  const eqMap = new Map(equipment.map((e) => [e.id, e]));
  const [preview, setPreview] = useState<{
    images: string[]; index: number; name: string;
  } | null>(null);

  return (
    <>
      <div className="space-y-2">
        {items.map((item, idx) => {
          const eq = item.equipment_id ? eqMap.get(item.equipment_id) : undefined;

          // Resolve images: catalog item uses eq.image_urls + image_url,
          // custom item uses item.image_urls
          const images: string[] = [];
          if (eq) {
            if (eq.image_url) images.push(eq.image_url);
            for (const u of eq.image_urls ?? []) {
              if (u && !images.includes(u)) images.push(u);
            }
          } else {
            for (const u of item.image_urls ?? []) {
              if (u) images.push(u);
            }
          }
          const thumb = images[0] ?? null;

          return (
            <div
              key={idx}
              className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary/30 transition-colors"
            >
              {/* Thumbnail — clickable when has image */}
              <button
                type="button"
                onClick={() =>
                  thumb &&
                  setPreview({ images, index: 0, name: item.name })
                }
                disabled={!thumb}
                className={`relative size-14 rounded-xl bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border ${
                  thumb ? "cursor-zoom-in hover:ring-primary/40" : "cursor-default"
                } group/thumb transition-all`}
                aria-label={thumb ? "ดูรูปขยาย" : "ไม่มีรูป"}
              >
                {thumb ? (
                  <>
                    <Image
                      src={thumb}
                      alt={item.name}
                      fill
                      sizes="56px"
                      className="object-cover group-hover/thumb:scale-110 transition-transform"
                      unoptimized
                    />
                    {/* Image count overlay if more than 1 */}
                    {images.length > 1 && (
                      <div className="absolute bottom-0 right-0 bg-black/65 text-white text-[9px] font-bold px-1 py-0.5 rounded-tl-md tabular-nums">
                        +{images.length - 1}
                      </div>
                    )}
                  </>
                ) : item.equipment_id ? (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageOff className="size-5" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-amber-50 text-amber-600">
                    <Pencil className="size-5" />
                  </div>
                )}
              </button>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-foreground truncate" title={item.name}>
                  {item.name}
                </div>
                {item.equipment_id && eq ? (
                  <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono">SKU: {eq.sku || "-"}</span>
                    {eq.category && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="truncate">{eq.category}</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-amber-700 inline-flex items-center gap-1 mt-0.5">
                    <Pencil className="size-3" />
                    พิมพ์เอง (รออนุมัติ)
                  </div>
                )}
                {item.notes && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate" title={item.notes}>
                    💬 {item.notes}
                  </div>
                )}
              </div>

              {/* Qty controls */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateQty(idx, item.qty - 1)}
                  disabled={item.qty <= 1}
                  className="h-9 w-9 rounded-lg border border-border bg-background text-foreground flex items-center justify-center hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="ลด"
                >
                  <Minus className="size-3.5" />
                </button>
                <input
                  type="number"
                  min="1"
                  value={item.qty}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) =>
                    onUpdateQty(idx, Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  className="h-9 w-16 text-center text-sm font-bold tabular-nums border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => onUpdateQty(idx, item.qty + 1)}
                  className="h-9 w-9 rounded-lg border border-border bg-background text-foreground flex items-center justify-center hover:bg-accent transition-colors"
                  aria-label="เพิ่ม"
                >
                  <Plus className="size-3.5" />
                </button>
                <span className="text-xs text-muted-foreground ml-1.5 min-w-[2rem]">
                  {item.unit}
                </span>
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 flex items-center justify-center flex-shrink-0 transition-colors"
                aria-label="ลบรายการ"
                title="ลบรายการ"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {preview && (
        <ImagePreview
          images={preview.images}
          index={preview.index}
          name={preview.name}
          onClose={() => setPreview(null)}
          onIndex={(i) => setPreview({ ...preview, index: i })}
        />
      )}
    </>
  );
}

function ImagePreview({
  images, index, name, onClose, onIndex,
}: {
  images: string[];
  index: number;
  name: string;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const current = images[index];
  const hasNav = images.length > 1;

  function prev(e: React.MouseEvent) {
    e.stopPropagation();
    onIndex((index - 1 + images.length) % images.length);
  }
  function next(e: React.MouseEvent) {
    e.stopPropagation();
    onIndex((index + 1) % images.length);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasNav) onIndex((index - 1 + images.length) % images.length);
      if (e.key === "ArrowRight" && hasNav) onIndex((index + 1) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, hasNav, onClose, onIndex]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
        aria-label="ปิด"
      >
        <X className="size-5" />
      </button>

      <div className="absolute top-4 left-4 text-white">
        <div className="text-sm font-bold">{name}</div>
        {hasNav && (
          <div className="text-xs text-white/60 mt-0.5 tabular-nums">
            {index + 1} / {images.length}
          </div>
        )}
      </div>

      {hasNav && (
        <button
          type="button"
          onClick={prev}
          className="absolute left-4 size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          aria-label="ก่อนหน้า"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      <div onClick={(e) => e.stopPropagation()} className="relative max-w-[90vw] max-h-[85vh]">
        <Image
          src={current}
          alt={name}
          width={1200}
          height={1200}
          unoptimized
          className="rounded-lg object-contain max-w-[90vw] max-h-[85vh] w-auto h-auto"
        />
      </div>

      {hasNav && (
        <button
          type="button"
          onClick={next}
          className="absolute right-4 size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          aria-label="ถัดไป"
        >
          <ChevronRight className="size-6" />
        </button>
      )}
    </div>
  );
}
