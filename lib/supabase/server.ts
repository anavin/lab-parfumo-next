/**
 * Supabase server-side client (Service Role) — ใช้ใน Server Components,
 * Server Actions, และ Route Handlers
 *
 * ⚠️ ห้าม import ใน Client Component หรือส่งไปฝั่ง browser
 */
import { createClient } from "@supabase/supabase-js";

/**
 * สร้าง client ใหม่ทุกครั้งที่เรียก — ป้องกัน state ปนกันข้าม request
 *
 * ⭐ Lazy env check: ทำใน function (runtime) ไม่ใช่ module-level
 * เพื่อให้ build process (Next.js page data collection) pass ได้
 * แม้ env vars ยังไม่ตั้ง — fail ตอน request จริงเท่านั้น
 *
 * Untyped: cast เป็น Application types (User, Equipment, etc.) ที่จุดใช้
 */
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
