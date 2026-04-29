"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { globalSearch, type SearchResult } from "@/lib/db/search";

export async function searchAction(query: string): Promise<SearchResult> {
  const user = await getCurrentUser();
  if (!user) return { pos: [], equipment: [], suppliers: [] };
  return globalSearch(query, {
    userId: user.id,
    // Supervisor มีสิทธิ์เห็นเหมือน admin (PO ทั้งระบบ + suppliers)
    isAdmin: user.role === "admin" || user.role === "supervisor",
  });
}
