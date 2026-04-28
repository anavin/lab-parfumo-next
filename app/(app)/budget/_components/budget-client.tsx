"use client";

import { useState } from "react";
import { BarChart3, Settings as SettingsIcon } from "lucide-react";
import type { Budget, BudgetStatus } from "@/lib/types/db";
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
    <div className="space-y-5">
      {/* Tabs — segmented pill style (consistent with app) */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 max-w-md">
        <TabButton
          active={tab === "dashboard"}
          onClick={() => setTab("dashboard")}
          icon={<BarChart3 className="size-4" />}
          label="Dashboard"
        />
        <TabButton
          active={tab === "settings"}
          onClick={() => setTab("settings")}
          icon={<SettingsIcon className="size-4" />}
          label={`ตั้งงบประมาณ (${allBudgets.length})`}
        />
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
      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 h-10 rounded-lg text-sm font-semibold transition-all ${
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
