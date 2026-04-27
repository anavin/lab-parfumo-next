/**
 * Supabase server-side client (Service Role) — ใช้ใน Server Components,
 * Server Actions, และ Route Handlers
 *
 * ⚠️ ห้าม import ใน Client Component หรือส่งไปฝั่ง browser
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY",
  );
}

/**
 * สร้าง client ใหม่ทุกครั้งที่เรียก — ป้องกัน state ปนกันข้าม request
 */
export function getSupabaseAdmin() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
