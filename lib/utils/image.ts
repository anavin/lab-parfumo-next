/**
 * Client-side image compression utilities
 *
 * - บีบรูปก่อน upload — ลดขนาด 70-90%
 * - แปลง HEIC/HEIF → JPEG อัตโนมัติ
 * - skip GIF (กลัว animation เสีย)
 * - skip ถ้าเล็กอยู่แล้ว (< 500 KB)
 *
 * Browser-only — อย่า import ใน server component
 */
import imageCompression from "browser-image-compression";

/** รูปที่ผ่านเกณฑ์ "เล็กแล้ว" — ข้ามการบีบ */
const SKIP_COMPRESS_BYTES = 500 * 1024; // 500 KB

/** Animated formats ที่ห้ามบีบ */
const SKIP_FORMATS = new Set(["image/gif", "image/apng"]);

/** Format ที่ต้องแปลงเป็น JPEG (เพราะ browser support เก่า) */
const FORCE_JPEG_FORMATS = new Set([
  "image/heic",
  "image/heif",
  "image/avif", // optional — บางเบราเซอร์อาจไม่รองรับ
]);

export interface CompressResult {
  ok: boolean;
  file?: File;
  originalSize: number;
  compressedSize: number;
  /** 0-1 — ratio ที่ลดลง เช่น 0.92 = ลดลง 92% */
  reductionRatio: number;
  /** Skip cause: "small" / "animated" / null */
  skipReason?: "small" | "animated" | null;
  error?: string;
}

export interface CompressOptions {
  /** Max width or height (default: 1920) */
  maxWidthOrHeight?: number;
  /** Max output size in MB (default: 1) */
  maxSizeMB?: number;
  /** JPEG quality 0-1 (default: 0.85) */
  initialQuality?: number;
  /** Use Web Worker (default: true — ไม่ block main thread) */
  useWebWorker?: boolean;
  /** Progress callback (0-100) */
  onProgress?: (percent: number) => void;
}

/**
 * บีบรูปเดียว
 * @returns CompressResult — ดู ok flag ก่อนใช้ file
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<CompressResult> {
  const originalSize = file.size;

  // 1. Skip ถ้า animated (GIF, APNG)
  if (SKIP_FORMATS.has(file.type)) {
    return {
      ok: true,
      file,
      originalSize,
      compressedSize: originalSize,
      reductionRatio: 0,
      skipReason: "animated",
    };
  }

  // 2. Skip ถ้าเล็กอยู่แล้ว (< 500 KB)
  if (originalSize < SKIP_COMPRESS_BYTES && !FORCE_JPEG_FORMATS.has(file.type)) {
    return {
      ok: true,
      file,
      originalSize,
      compressedSize: originalSize,
      reductionRatio: 0,
      skipReason: "small",
    };
  }

  // 3. บีบ
  try {
    const isHeic = FORCE_JPEG_FORMATS.has(file.type) ||
      /\.(heic|heif|avif)$/i.test(file.name);

    const compressed = await imageCompression(file, {
      maxSizeMB: options.maxSizeMB ?? 1,
      maxWidthOrHeight: options.maxWidthOrHeight ?? 1920,
      initialQuality: options.initialQuality ?? 0.85,
      useWebWorker: options.useWebWorker ?? true,
      // HEIC → JPEG (ไม่ทุก browser รองรับ HEIC)
      fileType: isHeic ? "image/jpeg" : undefined,
      onProgress: options.onProgress,
    });

    // browser-image-compression return File ปกติ — แต่ rename ถ้าเป็น HEIC
    const newFileName = isHeic
      ? file.name.replace(/\.(heic|heif|avif)$/i, ".jpg")
      : file.name;
    // ถ้า rename — สร้าง File ใหม่จาก Blob
    const finalFile = isHeic && compressed.name !== newFileName
      ? new File([compressed], newFileName, {
          type: "image/jpeg",
          lastModified: Date.now(),
        })
      : compressed;

    const compressedSize = finalFile.size;
    const reductionRatio = originalSize > 0
      ? Math.max(0, 1 - compressedSize / originalSize)
      : 0;

    return {
      ok: true,
      file: finalFile,
      originalSize,
      compressedSize,
      reductionRatio,
      skipReason: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[compress] failed:", e);
    return {
      ok: false,
      originalSize,
      compressedSize: originalSize,
      reductionRatio: 0,
      error: msg,
    };
  }
}

/**
 * บีบหลายรูปพร้อมกัน + รายงาน progress
 * Run sequential เพื่อไม่ overload memory + browser
 */
export async function compressImages(
  files: File[],
  options: Omit<CompressOptions, "onProgress"> = {},
  onFileProgress?: (current: number, total: number, fileName: string) => void,
): Promise<CompressResult[]> {
  const results: CompressResult[] = [];
  for (let i = 0; i < files.length; i++) {
    onFileProgress?.(i + 1, files.length, files[i].name);
    const r = await compressImage(files[i], options);
    results.push(r);
  }
  return results;
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
