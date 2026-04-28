"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Check, Plus, X, ChevronLeft, ChevronRight, FolderOpen,
  Hash, Package as PackageIcon, Banknote, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Equipment } from "@/lib/types/db";

export function EquipmentGrid({
  items, selectedIds, onToggle,
}: {
  items: Equipment[];
  selectedIds: Set<string>;
  onToggle: (eq: Equipment) => void;
}) {
  // Lightbox state
  const [preview, setPreview] = useState<{
    images: string[]; index: number; name: string;
  } | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((eq) => (
          <EquipmentCard
            key={eq.id}
            eq={eq}
            isSelected={selectedIds.has(eq.id)}
            onClick={() => onToggle(eq)}
            onPreview={(images, index) =>
              setPreview({ images, index, name: eq.name })
            }
          />
        ))}
      </div>

      {/* Lightbox modal */}
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

function EquipmentCard({
  eq, isSelected, onClick, onPreview,
}: {
  eq: Equipment;
  isSelected: boolean;
  onClick: () => void;
  onPreview: (images: string[], startIndex: number) => void;
}) {
  const images = [...(eq.image_urls ?? [])];
  if (eq.image_url && !images.includes(eq.image_url)) {
    images.unshift(eq.image_url);
  }
  const primary = images[0];
  const thumbs = images.slice(1, 4); // up to 3 thumbnails

  // Stock badge
  const stock = eq.stock ?? 0;
  const rl = eq.reorder_level ?? 0;
  let stockChip: { bg: string; color: string; text: string };
  if (stock === 0) {
    stockChip = { bg: "bg-red-50 border-red-200", color: "text-red-700", text: "หมด" };
  } else if (rl > 0 && stock <= rl) {
    stockChip = { bg: "bg-red-50 border-red-200", color: "text-red-700", text: `ต้องสั่ง · ${stock}` };
  } else if (stock < 10) {
    stockChip = { bg: "bg-amber-50 border-amber-200", color: "text-amber-700", text: `${stock} ${eq.unit ?? ""}` };
  } else {
    stockChip = { bg: "bg-emerald-50 border-emerald-200", color: "text-emerald-700", text: `${stock} ${eq.unit ?? ""}` };
  }

  function handlePreviewPrimary(e: React.MouseEvent) {
    e.stopPropagation();
    if (primary) onPreview(images, 0);
  }
  function handlePreviewThumb(e: React.MouseEvent, i: number) {
    e.stopPropagation();
    onPreview(images, i + 1);
  }

  return (
    <div
      className={cn(
        "group bg-card border rounded-2xl p-3 transition-all flex flex-col",
        "hover:shadow-md hover:-translate-y-0.5",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/40",
      )}
    >
      {/* Primary image — clickable to preview */}
      <button
        type="button"
        onClick={handlePreviewPrimary}
        className="relative aspect-square w-full bg-muted rounded-xl overflow-hidden mb-2 group/img cursor-zoom-in"
        aria-label={primary ? "ดูรูปขยาย" : "ไม่มีรูป"}
      >
        {primary ? (
          <>
            <Image
              src={primary}
              alt={eq.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover/img:scale-110"
              unoptimized
            />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg">
                🔍 คลิกดูรูปขยาย
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🧴</div>
        )}
      </button>

      {/* Thumbnail strip — 3 small images */}
      {thumbs.length > 0 && (
        <div className="grid grid-cols-3 gap-1 mb-2">
          {thumbs.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => handlePreviewThumb(e, i)}
              className="relative aspect-square bg-muted rounded-md overflow-hidden hover:ring-2 hover:ring-primary/40 transition-all cursor-zoom-in"
              aria-label={`รูปที่ ${i + 2}`}
            >
              <Image
                src={url}
                alt={`${eq.name} ${i + 2}`}
                fill
                sizes="80px"
                className="object-cover hover:scale-110 transition-transform duration-200"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Name */}
        <div className="font-bold text-sm text-foreground line-clamp-2 leading-tight" title={eq.name}>
          {eq.name}
        </div>

        {/* Description (if exists) — full text, preserves line breaks */}
        {eq.description && (
          <div className="text-[11px] text-muted-foreground leading-snug whitespace-pre-line break-words">
            {eq.description}
          </div>
        )}

        {/* Meta grid: SKU + Category + Unit */}
        <div className="space-y-0.5 pt-1 border-t border-border/40">
          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 w-full">
            <Hash className="size-3 flex-shrink-0" />
            <span className="font-mono truncate">{eq.sku || "-"}</span>
          </div>
          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 w-full">
            <FolderOpen className="size-3 flex-shrink-0" />
            <span className="truncate">{eq.category || "-"}</span>
          </div>
          {eq.unit && (
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 w-full">
              <PackageIcon className="size-3 flex-shrink-0" />
              <span>หน่วย: <span className="font-semibold text-foreground">{eq.unit}</span></span>
            </div>
          )}
          {eq.last_cost > 0 && (
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 w-full">
              <Banknote className="size-3 flex-shrink-0 text-emerald-600" />
              <span>
                ราคาล่าสุด{" "}
                <span className="font-bold text-foreground tabular-nums">
                  ฿{eq.last_cost.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                </span>
                {eq.unit && <span className="text-muted-foreground/70"> / {eq.unit}</span>}
              </span>
            </div>
          )}
          {eq.reorder_level > 0 && (
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5 w-full">
              <AlertCircle className="size-3 flex-shrink-0" />
              <span>
                จุดสั่งซื้อ:{" "}
                <span className="font-semibold tabular-nums text-foreground">{eq.reorder_level}</span>
              </span>
            </div>
          )}
        </div>

        {/* Stock chip */}
        <div className="pt-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border",
              stockChip.bg, stockChip.color,
            )}
          >
            <PackageIcon className="size-3" />
            {stockChip.text}
          </span>
        </div>
      </div>

      {/* Add/Selected button */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "mt-3 flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-bold transition-all",
          isSelected
            ? "bg-gradient-to-br from-primary to-brand-900 text-white shadow-sm hover:shadow-brand"
            : "bg-muted text-foreground hover:bg-primary hover:text-primary-foreground",
        )}
      >
        {isSelected ? (
          <>
            <Check className="size-4" /> เลือกแล้ว
          </>
        ) : (
          <>
            <Plus className="size-4" /> เพิ่ม
          </>
        )}
      </button>
    </div>
  );
}

// ==================================================================
// Lightbox preview modal
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

  // ESC + arrow keys (proper effect with cleanup)
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
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
        aria-label="ปิด"
      >
        <X className="size-5" />
      </button>

      {/* Title + counter */}
      <div className="absolute top-4 left-4 text-white">
        <div className="text-sm font-bold">{name}</div>
        {hasNav && (
          <div className="text-xs text-white/60 mt-0.5 tabular-nums">
            {index + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Prev */}
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

      {/* Image */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-[90vw] max-h-[85vh]"
      >
        <Image
          src={current}
          alt={name}
          width={1200}
          height={1200}
          unoptimized
          className="rounded-lg object-contain max-w-[90vw] max-h-[85vh] w-auto h-auto"
        />
      </div>

      {/* Next */}
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
