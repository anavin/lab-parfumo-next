/**
 * Users + notifications queries — server-side
 *
 * ⚡ React.cache() — dedupe ใน same request
 */
import { cache } from "react";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { User, Notification } from "@/lib/types/db";

export const getActiveUsers = cache(async (): Promise<User[]> => {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("users")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  return (data ?? []) as User[];
});

export const getNotificationsForUser = cache(async (
  userId: string, limit = 100,
): Promise<Notification[]> => {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Notification[];
});

export interface PaginatedNotifications {
  rows: Notification[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const getNotificationsPaginated = cache(async (
  userId: string,
  { page = 0, pageSize = 50 }: { page?: number; pageSize?: number } = {},
): Promise<PaginatedNotifications> => {
  const sb = getSupabaseAdmin();
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await sb
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);
  const rows = (data ?? []) as Notification[];
  const total = count ?? rows.length;
  return {
    rows,
    total,
    page,
    pageSize,
    hasMore: (page + 1) * pageSize < total,
  };
});

export const getUnreadNotificationCount = cache(async (
  userId: string,
): Promise<number> => {
  const sb = getSupabaseAdmin();
  const { count } = await sb
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return count ?? 0;
});
