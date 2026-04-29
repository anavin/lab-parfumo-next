"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";

interface UpsertInput {
  periodType: "monthly" | "quarterly" | "yearly";
  year: number;
  month?: number | null;
  category?: string | null;
  amount: number;
  notes?: string;
}

export async function upsertBudgetAction(
  input: UpsertInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  if (input.amount <= 0) return { ok: false, error: "งบประมาณต้องมากกว่า 0" };

  const sb = getSupabaseAdmin();
  // Check existing
  let q = sb.from("budget_periods" as never).select("id")
    .eq("period_type", input.periodType)
    .eq("period_year", input.year);
  if (input.month != null) q = q.eq("period_month", input.month);
  else q = q.is("period_month", null);
  if (input.category) q = q.eq("category", input.category);
  else q = q.is("category", null);
  const { data: existing } = await q.maybeSingle();

  const payload = {
    period_type: input.periodType,
    period_year: input.year,
    period_month: input.month ?? null,
    category: input.category ?? null,
    amount: input.amount,
    notes: input.notes ?? "",
    created_by_name: user.full_name,
  };

  if (existing) {
    await sb.from("budget_periods" as never)
      .update(payload as never)
      .eq("id", (existing as { id: string }).id);
  } else {
    await sb.from("budget_periods" as never).insert(payload as never);
  }
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteBudgetAction(
  budgetId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "supervisor")) {
    return { ok: false, error: "เฉพาะแอดมินหรือ Supervisor" };
  }
  const sb = getSupabaseAdmin();
  await sb.from("budget_periods" as never).delete().eq("id", budgetId);
  revalidatePath("/budget");
  return { ok: true };
}
