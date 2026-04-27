/**
 * Supabase browser client — ใช้ใน Client Component
 * (ใช้ anon key — RLS protect)
 */
"use client";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/db";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let _client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseBrowser() {
  if (!_client) {
    _client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _client;
}
