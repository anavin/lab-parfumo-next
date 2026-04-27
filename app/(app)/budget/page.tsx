import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getCategories } from "@/lib/db/equipment";
import { getBudgetStatusForMonth, listBudgets } from "@/lib/db/budget";
import { BudgetClient } from "./_components/budget-client";

export const metadata: Metadata = {
  title: "งบประมาณ — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const user = (await getCurrentUser())!;
  if (user.role !== "admin") redirect("/dashboard");

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const [statuses, allBudgets, categories] = await Promise.all([
    getBudgetStatusForMonth(currentYear, currentMonth),
    listBudgets(currentYear),
    getCategories(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">งบประมาณ</h1>
        <p className="text-sm text-slate-500">
          ตั้งงบ + ติดตาม spending vs budget แต่ละช่วง
        </p>
      </div>

      <BudgetClient
        currentYear={currentYear}
        currentMonth={currentMonth}
        statuses={statuses}
        allBudgets={allBudgets}
        categories={categories}
      />
    </div>
  );
}
