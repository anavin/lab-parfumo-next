"use client";

import { useState } from "react";
import { Plus, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Budget, BudgetStatus } from "@/lib/db/budget";
import { BudgetDashboard } from "./budget-dashboard";
import { BudgetSettings } from "./budget-settings";

type Tab = "dashboard" | "settings";

export function BudgetClient({
  currentYear, currentMonth, statuses, allBudgets, categories,
}: {
  currentYear: number;
  currentMonth: number;
  statuses: BudgetStatus[];
  allBudgets: Budget[];
  categories: string[];
}) {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}
                    icon={<BarChart3 className="h-4 w-4" />} label="Dashboard" />
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")}
                    icon={<Settings className="h-4 w-4" />} label={`ตั้งงบ (${allBudgets.length})`} />
      </div>

      {tab === "dashboard" ? (
        <BudgetDashboard
          year={currentYear}
          month={currentMonth}
          statuses={statuses}
        />
      ) : (
        <BudgetSettings
          year={currentYear}
          allBudgets={allBudgets}
          categories={categories}
        />
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors",
        active
          ? "border-brand-700 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-900",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
