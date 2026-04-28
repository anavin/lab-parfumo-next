"use client";

/**
 * ประวัติการรับของ (delivery history) — full details + photos + lightbox
 */
import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Package, CheckCircle2, AlertTriangle, User, Calendar,
  MessageSquare, ImageOff, X, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { PoDelivery, PoDeliveryItem } from "@/lib/types/db";

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return String(d);
  }
}

export function DeliveriesList({ deliveries }: { deliveries: PoDelivery[] }) {
  const [preview, setPreview] = useState<{
    images: string[]; index: number; title: string;
  } | null>(null);

  return (
    <>
      <div className="space-y-3">
        {deliveries.map((d) => (
          <DeliveryCard
            key={d.id}
            delivery={d}
            onPreview={(images, index) =>
              setPreview({
                images,
                index,
                title: `รับของครั้งที่ ${d.delivery_no}`,
              })
            }
          />
        ))}
      </div>

      {preview && (
        <ImagePreview
          images={preview.images}
          index={preview.index}
          title={preview.title}
          onClose={() => setPreview(null)}
          onIndex={(i) => setPreview({ ...preview, index: i })}
        />
      )}
    </>
  );
}

function DeliveryCard({
  delivery: d, onPreview,
}: {
  delivery: PoDelivery;
  onPreview: (images: string[], startIndex: number) => void;
}) {
  const images = (d.image_urls ?? []).filter(Boolean);
  const hasImages = images.length > 0;
  const isProblem = d.overall_condition !== "ปกติ";
  const totalReceived = d.items_received.reduce((s, it) => s + (it.qty_received ?? 0), 0);
  const totalDamaged = d.items_received.reduce((s, it) => s + (it.qty_damaged ?? 0), 0);
  const totalOrdered = d.items_received.reduce((s, it) => s + (it.qty_ordered ?? 0), 0);

  return (
    <div
      className={`rounded-2xl border p-4 transition-all hover:shadow-md ${
        isProblem
          ? "border-red-200 bg-red-50/30"
          : "border-border bg-card"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        {/* Status icon */}
        <div
          className={`flex-shrink-0 size-11 rounded-xl flex items-center justify-center ring-1 ${
            isProblem
              ? "bg-red-100 text-red-600 ring-red-200/60"
              : "bg-emerald-100 text-emerald-700 ring-emerald-200/60"
          }`}
        >
          {isProblem
            ? <AlertTriangle className="size-5" strokeWidth={2.25} />
            : <CheckCircle2 className="size-5" strokeWidth={2.25} />
          }
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-bold text-sm text-foreground">
              ครั้งที่ {d.delivery_no}
            </div>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 ${
                isProblem
                  ? "bg-red-100 text-red-700 ring-red-300"
                  : "bg-emerald-100 text-emerald-700 ring-emerald-300"
              }`}
            >
              <span className="size-1.5 rounded-full bg-current opacity-70" />
              {d.overall_condition}
            </span>
            {hasImages && (
              <span className="inline-flex items-center text-[11px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 tabular-nums">
                {images.length} รูป
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3" />
              {fmtDate(d.received_date)}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1">
              <User className="size-3" />
              {d.received_by_name ?? "—"}
            </span>
          </div>
        </div>

        {/* Right: summary numbers */}
        <div className="flex-shrink-0 text-right">
          <div className="text-base font-extrabold tabular-nums text-foreground leading-none">
            {totalReceived.toLocaleString("th-TH")}
            <span className="text-xs font-medium text-muted-foreground ml-1">
              / {totalOrdered.toLocaleString("th-TH")}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">รับ / สั่ง</div>
          {totalDamaged > 0 && (
            <div className="text-[11px] text-red-600 font-semibold mt-0.5 tabular-nums">
              เสียหาย {totalDamaged.toLocaleString("th-TH")}
            </div>
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="mt-4 rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-6">รายการ</div>
          <div className="col-span-2 text-right">สั่ง</div>
          <div className="col-span-2 text-right">รับ</div>
          <div className="col-span-2 text-right">เสียหาย</div>
        </div>
        <div className="divide-y divide-border/50">
          {d.items_received.map((it, i) => (
            <ItemRow key={i} item={it} />
          ))}
        </div>
      </div>

      {/* Issue description */}
      {d.issue_description && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider mb-0.5">
                ปัญหาที่พบ
              </div>
              <div className="text-sm text-red-800 whitespace-pre-line break-words leading-relaxed">
                {d.issue_description}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {d.notes && (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-start gap-2">
            <MessageSquare className="size-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                หมายเหตุ
              </div>
              <div className="text-sm text-foreground whitespace-pre-line break-words leading-relaxed">
                {d.notes}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image grid — 4 per row */}
      {hasImages ? (
        <div className="mt-4">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 inline-flex items-center gap-1.5">
            <Package className="size-3" /> รูปประกอบ ({images.length})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  alt={`รูปประกอบครั้งที่ ${d.delivery_no} - ${i + 1}`}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover group-hover/img:scale-110 transition-transform duration-300"
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-md">
                    🔍 ขยาย
                  </div>
                </div>
                <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 tabular-nums backdrop-blur-sm">
                  {i + 1}/{images.length}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
          <ImageOff className="size-3.5" />
          ไม่มีรูปประกอบ
        </div>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: PoDeliveryItem }) {
  const ordered = item.qty_ordered ?? 0;
  const received = item.qty_received ?? 0;
  const damaged = item.qty_damaged ?? 0;
  const incomplete = received < ordered;
  const hasDamage = damaged > 0;

  return (
    <div className="grid grid-cols-12 gap-2 px-3 py-2.5 text-sm hover:bg-accent/30 transition-colors">
      <div className="col-span-6 min-w-0">
        <div className="font-semibold text-foreground truncate" title={item.name}>
          {item.name}
        </div>
        {item.notes && (
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate" title={item.notes}>
            💬 {item.notes}
          </div>
        )}
      </div>
      <div className="col-span-2 text-right tabular-nums text-muted-foreground">
        {ordered.toLocaleString("th-TH")}
      </div>
      <div
        className={`col-span-2 text-right tabular-nums font-bold ${
          incomplete ? "text-amber-600" : "text-emerald-700"
        }`}
        title={incomplete ? `ขาด ${ordered - received}` : "ครบ"}
      >
        {received.toLocaleString("th-TH")}
      </div>
      <div
        className={`col-span-2 text-right tabular-nums font-bold ${
          hasDamage ? "text-red-600" : "text-muted-foreground/40"
        }`}
      >
        {hasDamage ? damaged.toLocaleString("th-TH") : "—"}
      </div>
    </div>
  );
}

// ==================================================================
// Lightbox preview
// ==================================================================
function ImagePreview({
  images, index, title, onClose, onIndex,
}: {
  images: string[];
  index: number;
  title: string;
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
        <div className="text-sm font-bold">{title}</div>
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
          alt={title}
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
