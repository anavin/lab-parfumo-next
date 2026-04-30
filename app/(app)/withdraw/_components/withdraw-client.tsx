"use client";

import { useState } from "react";
import { Plus, History } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Equipment, Withdrawal, Lookup } from "@/lib/types/db";
import { WithdrawForm } from "./withdraw-form";
import { WithdrawHistory } from "./withdraw-history";

type Tab = "form" | "history";

export function WithdrawClient({
  initialTab, equipment, categories, withdrawals, purposes, currentUserId, isAdmin,
}: {
  initialTab: Tab;
  equipment: Equipment[];
  categories: string[];
  withdrawals: Withdrawal[];
  purposes: Lookup[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <TabButton
          active={tab === "form"}
          onClick={() => setTab("form")}
          icon={<Plus className="h-4 w-4" />}
          label="เบิกใหม่"
        />
        <TabButton
          active={tab === "history"}
          onClick={() => setTab("history")}
          icon={<History className="h-4 w-4" />}
          label={`ประวัติการเบิก (${withdrawals.length})`}
        />
      </div>

      {/* Content */}
      {tab === "form" ? (
        <WithdrawForm
          equipment={equipment}
          categories={categories}
          purposes={purposes}
          canCreateLookup={isAdmin}
        />
      ) : (
        <WithdrawHistory
          withdrawals={withdrawals}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
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
