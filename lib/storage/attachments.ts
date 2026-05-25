/**
 * Attachment URL resolver — M6 signed URL migration support
 *
 * Goal: prepare for moving `po-attachments` bucket from public → private.
 *
 * Strategy:
 *   - New uploads store both `url` (public — current behavior) AND `path`
 *     (storage key — used to mint signed URLs after migration).
 *   - This helper returns a fresh URL on demand:
 *     1) If bucket is private + path is known → signed URL (TTL 1 hr)
 *     2) If path is known but bucket is still public → keep public URL
 *        (avoids extra round-trip until migration is complete)
 *     3) Legacy attachments (no path) → try to extract path from the
 *        public URL pattern; if extractable + private bucket → signed
 *     4) Fallback → return the stored URL as-is
 *
 * `BUCKET_IS_PRIVATE` is a single env flag — flip to "true" the same
 * deploy that runs the Supabase dashboard "make bucket private" step.
 * Stored URLs in DB don't need re-writing.
 */
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { PoAttachment } from "@/lib/types/db";

const BUCKET = "po-attachments";
const SIGNED_TTL_SECONDS = 60 * 60; // 1 hour — long enough for download + link sharing in toasts

/**
 * Detect if bucket migration has happened. Default false → backward compat.
 * Flip to true via env (PO_ATTACHMENTS_PRIVATE=true) the same deploy you
 * change Supabase Storage policy to private.
 */
function bucketIsPrivate(): boolean {
  return process.env.PO_ATTACHMENTS_PRIVATE === "true";
}

/**
 * Extract storage path from a known Supabase public URL pattern:
 *   https://{ref}.supabase.co/storage/v1/object/public/po-attachments/{path}
 * Returns null if URL doesn't match.
 */
export function extractAttachmentPath(url: string): string | null {
  try {
    const u = new URL(url);
    // Match: /storage/v1/object/public/po-attachments/<path>
    //    OR: /storage/v1/object/sign/po-attachments/<path>  (already signed)
    const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/po-attachments\/(.+)$/);
    if (!m) return null;
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

/**
 * Resolve an attachment to a usable URL. Server-only — use in RSC.
 *
 * @returns the URL to render. Never throws — falls back to att.url on any error.
 */
export async function resolveAttachmentUrl(att: PoAttachment): Promise<string> {
  // Fast path: bucket still public → original URL works
  if (!bucketIsPrivate()) return att.url;

  const path = att.path ?? extractAttachmentPath(att.url);
  if (!path) {
    // Can't sign — return original (might 404 if bucket is private and URL is stale)
    return att.url;
  }

  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      console.warn("[attachments] sign failed:", error?.message);
      return att.url;
    }
    return data.signedUrl;
  } catch (e) {
    console.warn("[attachments] sign threw:", e);
    return att.url;
  }
}

/**
 * Batch resolver — runs in parallel. Use when rendering a list.
 * Returns attachments with the `url` field swapped to the resolved URL.
 */
export async function resolveAttachmentUrls(
  atts: PoAttachment[],
): Promise<PoAttachment[]> {
  if (atts.length === 0) return atts;
  if (!bucketIsPrivate()) return atts; // skip Promise.all overhead
  const resolved = await Promise.all(
    atts.map(async (a) => ({ ...a, url: await resolveAttachmentUrl(a) })),
  );
  return resolved;
}
