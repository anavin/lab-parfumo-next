"use client";

/**
 * Shared image lightbox + slideshow
 *
 * Features:
 *  - Fullscreen preview พื้นหลังดำ + backdrop blur
 *  - Navigation ← → keyboard + buttons
 *  - Slideshow auto-advance (พักเมื่อ manual nav)
 *  - Play/Pause toggle (Space key shortcut)
 *  - Click outside / Esc = close
 *  - Optional download button per image
 *  - Optional meta line (uploaded_by, date, etc.)
 *
 * Usage:
 *   const [idx, setIdx] = useState<number | null>(null);
 *   const lightboxImages = images.map(url => ({ url }));
 *   {idx !== null && (
 *     <ImageLightbox
 *       images={lightboxImages}
 *       index={idx}
 *       onClose={() => setIdx(null)}
 *       onIndex={setIdx}
 *       title="รูปประกอบ"
 *     />
 *   )}
 */
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import {
  X, ChevronLeft, ChevronRight, Play, Pause, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  url: string;
  name?: string;
  /** Small text shown under the name — size / uploaded_by / etc. */
  meta?: React.ReactNode;
}

export function ImageLightbox({
  images,
  index,
  onClose,
  onIndex,
  title,
  downloadable = true,
  slideshowInterval = 3000,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
  title?: string;
  /** Show download button per image (default true) */
  downloadable?: boolean;
  /** Auto-advance interval in ms (default 3000). Set 0 to disable slideshow */
  slideshowInterval?: number;
}) {
  const current = images[index];
  const hasNav = images.length > 1;
  const [playing, setPlaying] = useState(false);
  const indexRef = useRef(index);
  indexRef.current = index;

  // Stop slideshow when only 1 image
  useEffect(() => {
    if (!hasNav) setPlaying(false);
  }, [hasNav]);

  // Slideshow timer
  useEffect(() => {
    if (!playing || !hasNav || slideshowInterval <= 0) return;
    const t = setInterval(() => {
      onIndex((indexRef.current + 1) % images.length);
    }, slideshowInterval);
    return () => clearInterval(t);
  }, [playing, hasNav, slideshowInterval, images.length, onIndex]);

  // Manual nav helpers (pause slideshow)
  function goTo(newIdx: number) {
    setPlaying(false);
    onIndex(newIdx);
  }
  function prev(e?: React.MouseEvent) {
    e?.stopPropagation();
    goTo((index - 1 + images.length) % images.length);
  }
  function next(e?: React.MouseEvent) {
    e?.stopPropagation();
    goTo((index + 1) % images.length);
  }

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && hasNav) {
        prev();
      } else if (e.key === "ArrowRight" && hasNav) {
        next();
      } else if (e.key === " " && hasNav) {
        // Space = toggle play/pause
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNav, onClose]);

  if (!current) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      {/* Close button (top-right) */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors z-10"
        aria-label="ปิด"
      >
        <X className="size-5" />
      </button>

      {/* Play/Pause (top-right, next to close — only if multi-image) */}
      {hasNav && slideshowInterval > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPlaying((p) => !p);
          }}
          className={cn(
            "absolute top-4 right-16 inline-flex items-center gap-1.5 px-3 h-10 rounded-full text-white text-xs font-semibold backdrop-blur-sm transition-colors z-10",
            playing
              ? "bg-emerald-500/30 hover:bg-emerald-500/40 ring-1 ring-emerald-300/50"
              : "bg-white/10 hover:bg-white/20",
          )}
          aria-label={playing ? "หยุด slideshow" : "เริ่ม slideshow"}
          title="Spacebar = toggle"
        >
          {playing ? (
            <>
              <Pause className="size-3.5" />
              <span>หยุด</span>
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              <span>Slideshow</span>
            </>
          )}
        </button>
      )}

      {/* Title + meta (top-left) */}
      <div className="absolute top-4 left-4 text-white max-w-[55vw] z-10">
        {title && (
          <div className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-0.5">
            {title}
          </div>
        )}
        {current.name && (
          <div className="text-sm font-bold truncate">{current.name}</div>
        )}
        <div className="text-xs text-white/60 mt-0.5 flex items-center gap-2 flex-wrap tabular-nums">
          {hasNav && <span>{index + 1} / {images.length}</span>}
          {current.meta && <span>{current.meta}</span>}
        </div>
      </div>

      {/* Prev button */}
      {hasNav && (
        <button
          type="button"
          onClick={prev}
          className="absolute left-4 size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors z-10"
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
          src={current.url}
          alt={current.name ?? `Image ${index + 1}`}
          width={1600}
          height={1600}
          unoptimized
          className="rounded-lg object-contain max-w-[90vw] max-h-[85vh] w-auto h-auto"
        />
      </div>

      {/* Next button */}
      {hasNav && (
        <button
          type="button"
          onClick={next}
          className="absolute right-4 size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors z-10"
          aria-label="ถัดไป"
        >
          <ChevronRight className="size-6" />
        </button>
      )}

      {/* Bottom bar: thumbnails + download */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
        {hasNav && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-white/10 backdrop-blur-sm max-w-[60vw] overflow-x-auto no-scrollbar"
          >
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  "size-10 rounded overflow-hidden flex-shrink-0 ring-1 transition-all",
                  i === index
                    ? "ring-2 ring-white scale-110"
                    : "ring-white/20 hover:ring-white/50 opacity-60 hover:opacity-100",
                )}
                aria-label={`ไปรูปที่ ${i + 1}`}
              >
                <Image
                  src={img.url}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  className="object-cover w-full h-full"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Download (bottom-right) */}
      {downloadable && (
        <a
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
          download={current.name ?? "image"}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 px-3 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-sm transition-colors z-10"
        >
          <Download className="size-4" />
          ดาวน์โหลด
        </a>
      )}

      {/* Slideshow progress bar (subtle line at top) */}
      {playing && hasNav && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 overflow-hidden z-10">
          <div
            key={`${index}-${playing}`}
            className="h-full bg-emerald-400 animate-slideshow-bar"
            style={{ animationDuration: `${slideshowInterval}ms` }}
          />
        </div>
      )}
    </div>
  );
}
