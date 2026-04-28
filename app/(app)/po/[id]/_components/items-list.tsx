"use client";

/**
 * Render รายการสินค้าใน PO — ครบถ้วน + รูป 4/แถว + lightbox
 *
 * Image resolution:
 * - Catalog item (equipment_id set): use Equipment.image_url + image_urls
 * - Custom item:                      use PoItem.image_urls
 */
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Package as PackageIcon, Pencil, ImageOff,
  X, ChevronLeft, ChevronRight, MessageSquare,
  Hash, FolderOpen, Tag,
} from "lucide-react";
import type { PoItem, Equipment } from "@/lib/types/db";

export function ItemsList({
  items, isAdmin, equipmentMap,
}: {
  items: PoItem[];
  isAdmin: boolean;
  equipmentMap?: Record<string, Equipment>;
}) {
  const [preview, setPreview] = useState<{
    images: string[]; index: number; name: string;
  } | null>(null);

  return (
    <>
      <div className="space-y-3">
        {items.map((it, idx) => (
          <ItemCard
            key={idx}
            item={it}
            isAdmin={isAdmin}
            equipment={it.equipment_id ? equipmentMap?.[it.equipment_id] : undefined}
            onPreview={(images, index) =>
              setPreview({ images, index, name: it.name })
            }
          />
        ))}
      </div>

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

function ItemCard({
  item, isAdmin, equipment, onPreview,
}: {
  item: PoItem;
  isAdmin: boolean;
  equipment?: Equipment;
  onPreview: (images: string[], startIndex: number) => void;
}) {
  // Resolve images: prefer equipment images for catalog items, else item's own
  const images: string[] = [];
  if (equipment) {
    if (equipment.image_url) images.push(equipment.image_url);
    for (const u of equipment.image_urls ?? []) {
      if (u && !images.includes(u)) images.push(u);
    }
  }
  // Always include item-level images too (for both catalog + custom)
  for (const u of item.image_urls ?? []) {
    if (u && !images.includes(u)) images.push(u);
  }
  const hasImages = images.length > 0;
  const isCustom = !item.equipment_id;
  const showPrice = isAdmin && item.unit_price != null && item.unit_price > 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 hover:shadow-md transition-all">
      {/* Top row: name + qty/price */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base text-foreground leading-snug">
            {item.name}
          </div>
          {/* Source pill */}
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {isCustom ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2 py-0.5">
                <Pencil className="size-3" /> พิมพ์เอง
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-full px-2 py-0.5">
                <PackageIcon className="size-3" /> จาก catalog
              </span>
            )}
            {hasImages && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 tabular-nums">
                {images.length} รูป
              </span>
            )}
          </div>

          {/* Equipment metadata (only for catalog items) */}
          {equipment && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {equipment.sku && (
                <span className="inline-flex items-center gap-1 font-mono">
                  <Hash className="size-3" /> {equipment.sku}
                </span>
              )}
              {equipment.category && (
                <>
                  {equipment.sku && <span className="text-muted-foreground/40">·</span>}
                  <span className="inline-flex items-center gap-1">
                    <FolderOpen className="size-3" /> {equipment.category}
                  </span>
                </>
              )}
              {equipment.unit && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Tag className="size-3" /> หน่วย {equipment.unit}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Equipment description (catalog only) */}
          {equipment?.description && (
            <div className="mt-2 text-xs text-muted-foreground leading-relaxed whitespace-pre-line break-words">
              {equipment.description}
            </div>
          )}

          {/* Item notes */}
          {item.notes && (
            <div className="mt-2 text-sm text-muted-foreground inline-flex items-start gap-1.5 leading-relaxed">
              <MessageSquare className="size-3.5 flex-shrink-0 mt-0.5 text-muted-foreground/60" />
              <span className="whitespace-pre-line break-words">{item.notes}</span>
            </div>
          )}
        </div>

        {/* Right column: qty + price */}
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-extrabold text-foreground tabular-nums leading-none">
            {item.qty.toLocaleString("th-TH")}
          </div>
          <div className="text-xs font-medium text-muted-foreground mt-1">
            {item.unit}
          </div>
          {showPrice && (
            <div className="mt-3 pt-3 border-t border-border/50 space-y-0.5">
              <div className="text-[11px] text-muted-foreground tabular-nums">
                @ ฿{item.unit_price!.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </div>
              <div className="text-base font-extrabold text-primary tabular-nums">
                ฿{(item.subtotal ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image grid — 4 per row */}
      {hasImages ? (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {images.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onPreview(images, i)}
              className="relative aspect-square bg-muted rounded-xl overflow-hidden ring-1 ring-border hover:ring-primary/40 hover:shadow-md cursor-zoom-in group/img transition-all"
              aria-label={`ดูรูปที่ ${i + 1}`}
            >
              <Image
                src={url}
                alt={`${item.name} ${i + 1}`}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover group-hover/img:scale-110 transition-transform duration-300"
                unoptimized
              />
              {/* Hover zoom hint */}
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-md">
                  🔍 ขยาย
                </div>
              </div>
              {/* Index badge */}
              <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 tabular-nums backdrop-blur-sm">
                {i + 1}/{images.length}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          <ImageOff className="size-3.5" />
          ไม่มีรูปประกอบ
        </div>
      )}
    </div>
  );
}

// ==================================================================
// Lightbox preview
// ==================================================================
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
