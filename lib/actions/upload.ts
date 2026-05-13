"use server";

/**
 * Image upload — ไป Supabase Storage
 * ใช้ใน custom item, delivery photos, equipment photos
 *
 * Buckets ตาม Streamlit เดิม:
 * - "equipment-images"  → รูปสินค้า + custom item ตอนสร้าง PO
 * - "delivery-images"   → รูปประกอบตอนรับของ
 */
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";

export type Bucket = "equipment-images" | "delivery-images" | "po-attachments";

const ALLOWED_IMG_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function safeExt(filename: string): string {
  const e = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  return ALLOWED_IMG_EXT.has(e) ? e : "jpg";
}

/**
 * Verify magic bytes ของไฟล์ — ป้องกัน user rename .exe → .jpg แล้ว upload
 * Returns true ถ้าไฟล์เป็นรูปจริงตาม signature
 */
function verifyImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 &&
    buffer[2] === 0x4e && buffer[3] === 0x47
  ) return true;
  // GIF: 47 49 46 38 ("GIF8")
  if (
    buffer[0] === 0x47 && buffer[1] === 0x49 &&
    buffer[2] === 0x46 && buffer[3] === 0x38
  ) return true;
  // WEBP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50 ("RIFF....WEBP")
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 &&
    buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 &&
    buffer[10] === 0x42 && buffer[11] === 0x50
  ) return true;
  return false;
}

interface UploadResult {
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload single file (Blob/File from FormData) → return public URL
 */
export async function uploadImageAction(
  file: File, bucket: Bucket = "equipment-images",
): Promise<UploadResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  // ตรวจ size (5 MB)
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: `ไฟล์ใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(1)} MB) — สูงสุด 5 MB` };
  }

  const ext = safeExt(file.name);
  const filename = `${randomBytes(16).toString("hex")}.${ext}`;
  const contentType = file.type || `image/${ext === "jpg" ? "jpeg" : ext}`;

  const arr = await file.arrayBuffer();
  const buffer = Buffer.from(arr);

  // Magic bytes verify — ป้องกัน rename .exe → .jpg
  if (!verifyImageMagicBytes(buffer)) {
    return {
      ok: false,
      error: "ไฟล์ไม่ใช่รูปภาพ (header ไม่ตรงกับ JPEG/PNG/GIF/WEBP)",
    };
  }

  const sb = getSupabaseAdmin();

  // Ensure bucket exists (auto-provision on first use)
  const ensured = await ensureBucket(sb, bucket, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (!ensured.ok) {
    return {
      ok: false,
      error: `ไม่สามารถสร้าง bucket: ${ensured.error ?? "unknown"}`,
    };
  }

  const { error } = await sb.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType,
      upsert: false,
    });
  if (error) {
    console.error("[upload] failed:", error);
    return {
      ok: false,
      error: `อัปโหลดไม่สำเร็จ: ${error.message ?? "unknown"}`,
    };
  }

  const { data: urlData } = sb.storage.from(bucket).getPublicUrl(filename);
  return { ok: true, url: urlData.publicUrl };
}

/**
 * Upload หลายไฟล์ใน FormData (key: "files")
 * return ARRAY ของ URLs (เฉพาะที่อัปสำเร็จ)
 */
export async function uploadMultipleImagesAction(
  formData: FormData, bucket: Bucket = "equipment-images",
): Promise<{ ok: boolean; urls: string[]; failed: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, urls: [], failed: 0, error: "ไม่ได้เข้าสู่ระบบ" };

  const files = formData.getAll("files").filter((f): f is File =>
    f instanceof File && f.size > 0,
  );
  if (!files.length) {
    return { ok: false, urls: [], failed: 0, error: "ไม่มีไฟล์" };
  }

  const urls: string[] = [];
  let failed = 0;
  for (const f of files) {
    const r = await uploadImageAction(f, bucket);
    if (r.ok && r.url) urls.push(r.url);
    else failed++;
  }
  return { ok: urls.length > 0, urls, failed };
}

// ==================================================================
// Attachments (PDF/Word/Excel/etc.) — bucket "po-attachments"
// ==================================================================
const ATTACHMENT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  gif: "image/gif", webp: "image/webp",
  zip: "application/zip", rar: "application/x-rar-compressed",
  "7z": "application/x-7z-compressed",
};

export interface UploadedAttachment {
  url: string;
  name: string;
  size: number;
  type: string;            // extension เช่น "pdf"
  uploaded_at: string;
}

/**
 * Ensure a Supabase Storage bucket exists. Idempotent — safe to call repeatedly.
 * Service role key (admin client) is required.
 */
async function ensureBucket(
  sb: ReturnType<typeof getSupabaseAdmin>,
  bucket: string,
  opts: { public: boolean; fileSizeLimit?: number } = { public: true },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: existing } = await sb.storage.getBucket(bucket);
    if (existing) return { ok: true };
  } catch {
    // fall through — try to create
  }
  const { error } = await sb.storage.createBucket(bucket, {
    public: opts.public,
    fileSizeLimit: opts.fileSizeLimit,
  });
  if (error) {
    // Race condition: another request may have created it in parallel
    if (
      String(error.message ?? "").toLowerCase().includes("already") ||
      (error as { statusCode?: string }).statusCode === "409"
    ) {
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * Upload single attachment (any file type) → return metadata
 * ใช้ Server Action — ส่ง FormData มา (key: "file" — single)
 */
export async function uploadSingleAttachmentAction(
  formData: FormData,
): Promise<{ ok: boolean; attachment?: UploadedAttachment; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "ไม่ได้เข้าสู่ระบบ" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "ไม่มีไฟล์" };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: `ไฟล์ใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(1)} MB) — สูงสุด 10 MB` };
  }

  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
  const contentType = ATTACHMENT_MIME[ext] ?? "application/octet-stream";
  // Strip non-ASCII (Thai etc.) since Supabase storage paths must be ASCII
  const baseName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const safeName = `${randomBytes(16).toString("hex")}_${baseName}`;

  const arr = await file.arrayBuffer();
  const buffer = Buffer.from(arr);

  const sb = getSupabaseAdmin();

  // Ensure bucket exists (auto-provision on first use)
  const ensured = await ensureBucket(sb, "po-attachments", {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
  });
  if (!ensured.ok) {
    console.error("[upload-attachment] ensureBucket failed:", ensured.error);
    return {
      ok: false,
      error: `ไม่สามารถสร้าง storage bucket: ${ensured.error ?? "unknown"}`,
    };
  }

  const { error } = await sb.storage
    .from("po-attachments")
    .upload(safeName, buffer, { contentType, upsert: false });
  if (error) {
    console.error("[upload-attachment] failed:", error);
    return {
      ok: false,
      error: `อัปโหลดไม่สำเร็จ: ${error.message ?? "unknown error"}`,
    };
  }

  const { data: urlData } = sb.storage.from("po-attachments").getPublicUrl(safeName);
  return {
    ok: true,
    attachment: {
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
      type: ext,
      uploaded_at: new Date().toISOString(),
    },
  };
}
