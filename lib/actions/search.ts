"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { globalSearch, type SearchResult } from "@/lib/db/search";

export async function searchAction(query: string): Promise<SearchResult> {
  const user = await getCurrentUser();
  if (!user) return { pos: [], equipment: [], suppliers: [] };
  return globalSearch(query, {
    userId: user.id,
    isAdmin: user.role === "admin",
  });
}
