"use client";

/**
 * Withdraw history — premium B2B redesign
 * Period pills + colored KPIs + rich row + ConfirmDialog for destructive
 */
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2, Search, Calendar, User, Package as PackageIcon,
  TrendingDown, ClipboardList, FileText, Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import type { Withdrawal } from "@/lib/types/db";
import { deleteWithdrawalAction } from "@/lib/actions/withdraw";

type Period = "7" | "30" | "90" | "all";

const PERIOD_LABEL: Record<Period, string> = {
  "7": "7 วันล่าสุด",
  "30": "30 วันล่าสุด",
  "90": "90 วันล่าสุด",
  "all": "ทั้งหมด",
};

export function WithdrawHistory({
  withdrawals, isAdmin, currentUserId,
}: {
  withdrawals: Withdrawal[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<Period>("30");
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [delTarget, setDelTarget] = useState<Withdrawal | null>(null);

  const filtered = useMemo(() => {
    let out = withdrawals;
    if (scope === "mine") {
      out = out.filter((w) => w.withdrawn_by === currentUserId);
    }
    if (period !== "all") {
      const days = parseInt(period, 10);
      const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
      out = out.filter((w) => (w.withdrawn_at ?? "") >= cutoff);
    }
    if (search) {
      const s = search.toLowerCase();
      out = out.filter((w) =>
        (w.equipment_name ?? "").toLowerCase().includes(s) ||
        (w.purpose ?? "").toLowerCase().includes(s) ||
        (w.withdrawn_by_name ?? "").toLowerCase().includes(s),
      );
    }
    return out;
  }, [withdrawals, period, scope, search, currentUserId]);

  // KPIs
  const totalCount = filtered.length;
  const totalQty = filtered.reduce((s, w) => s + (w.qty ?? 0), 0);
  const uniqueEq = new Set(filtered.map((w) => w.equipment_id)).size;
  const uniqueUsers = new Set(filtered.map((w) => w.withdrawn_by)).size;

  function handleDelete() {
    if (!delTarget) return;
    startTransition(async () => {
      const res = await deleteWithdrawalAction(delTarget.id, true);
      if (res.ok) {
        toast.success(`✅ ลบ ${delTarget.equipment_name} (คืนสต็อก ${delTarget.qty} ${delTarget.unit ?? ""}) แล้ว`);
        setDelTarget(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filter card — pill period + scope + search */}
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-bold text-muted-foreground inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                ช่วงเวลา
              </div>
              {isAdmin && (
                <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setScope("mine")}
                    className={`inline-flex items-center gap-1 h-7 px-3 rounded-md text-xs font-semibold transition-all ${
                      scope === "mine"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <User className="size-3" /> ของฉัน
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("all")}
                    className={`inline-flex items-center gap-1 h-7 px-3 rounded-md text-xs font-semibold transition-all ${
                      scope === "all"
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Users className="size-3" /> ทุกคน
                  </button>
                </div>
              )}
            </div>

            {/* Period pills (equal width) */}
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
              }}
            >
              {(["7", "30", "90", "all"] as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`inline-flex items-center justify-center h-9 px-3 rounded-lg text-xs font-semibold transition-all ${
                    period === p
                      ? "bg-gradient-to-br from-primary to-brand-900 text-white shadow-sm"
                      : "bg-card border border-border text-foreground hover:bg-accent hover:-translate-y-0.5 hover:shadow-sm"
                  }`}
                >
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="ค้นหาชื่อสินค้า / วัตถุประสงค์ / ผู้เบิก"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* KPI cards (consistent with reports) */}
        {filtered.length > 0 && (
          <div className={`grid grid-cols-2 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
            <KpiCard
              icon={ClipboardList}
              label="ครั้งที่เบิก"
              value={totalCount}
              unit="ครั้ง"
              color="primary"
            />
            <KpiCard
              icon={TrendingDown}
              label="รวมจำนวน"
              value={totalQty}
              unit="ชิ้น"
              color="amber"
            />
            <KpiCard
              icon={PackageIcon}
              label="สินค้าที่เบิก"
              value={uniqueEq}
              unit="รายการ"
              color="emerald"
            />
            {isAdmin && (
              <KpiCard
                icon={Users}
                label="ผู้เบิก"
                value={uniqueUsers}
                unit="คน"
                color="indigo"
              />
            )}
          </div>
        )}

        {/* Result line */}
        {filtered.length > 0 && (
          <div className="text-sm text-muted-foreground">
            พบ <strong className="text-foreground tabular-nums">{filtered.length}</strong> รายการ
            {scope === "mine" ? " ของคุณ" : " ทุกคน"}
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            icon="📦"
            title="ยังไม่มีประวัติการเบิก"
            text={'ลองเปลี่ยนช่วงเวลา หรือเริ่มเบิกของจาก tab "เบิกใหม่"'}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((w) => (
              <WithdrawalRow
                key={w.id}
                w={w}
                isAdmin={isAdmin}
                onDelete={() => setDelTarget(w)}
                disabled={pending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title={`ลบรายการเบิก ${delTarget?.equipment_name ?? ""}?`}
        description={
          delTarget ? (
            <>
              ระบบจะ <strong>คืนสต็อก {delTarget.qty} {delTarget.unit ?? "ชิ้น"}</strong> กลับเข้าคลังอัตโนมัติ
              <br />
              บันทึกการเบิกครั้งนี้จะถูกลบถาวร — ไม่สามารถเรียกคืน
            </>
          ) : null
        }
        confirmText="ลบ + คืนสต็อก"
        variant="danger"
        loading={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ==================================================================
// Withdrawal Row — rich layout
// ==================================================================
function WithdrawalRow({
  w, isAdmin, onDelete, disabled,
}: {
  w: Withdrawal;
  isAdmin: boolean;
  onDelete: () => void;
  disabled: boolean;
}) {
  const days = ageDays(w.withdrawn_at);
  return (
    <div className="group bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30 transition-all">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 size-10 rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200/60 flex items-center justify-center">
          <TrendingDown className="size-5" strokeWidth={2.25} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: name + qty */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-bold text-sm text-foreground">
              {w.equipment_name}
            </div>
            <div className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 ring-1 ring-amber-200 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums">
              <TrendingDown className="size-3" />
              {w.qty.toLocaleString("th-TH")} {w.unit ?? ""}
            </div>
          </div>

          {/* Row 2: purpose */}
          {w.purpose && (
            <div className="text-sm text-foreground mt-1.5 inline-flex items-start gap-1.5 leading-relaxed">
              <FileText className="size-3.5 flex-shrink-0 mt-0.5 text-muted-foreground" />
              <span className="whitespace-pre-line break-words">{w.purpose}</span>
            </div>
          )}

          {/* Row 3: meta */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1" title={fmtDateLong(w.withdrawn_at)}>
              <Calendar className="size-3" />
              {fmtDate(w.withdrawn_at)}
              <span className="text-muted-foreground/60">({ageLabel(days)})</span>
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
              <User className="size-3" />
              <span className="truncate">{w.withdrawn_by_name ?? "—"}</span>
            </span>
          </div>
        </div>

        {/* Delete (admin) */}
        {isAdmin && (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="size-9 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 inline-flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="ลบและคืนสต็อก"
            title="ลบและคืนสต็อก"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ==================================================================
// KPI card — consistent with reports/pending-receipt
// ==================================================================
const KPI_TONE: Record<string, { gradient: string; ring: string }> = {
  primary: { gradient: "bg-gradient-to-br from-blue-500 to-blue-700", ring: "ring-blue-200" },
  amber:   { gradient: "bg-gradient-to-br from-amber-400 to-orange-500", ring: "ring-amber-200" },
  emerald: { gradient: "bg-gradient-to-br from-emerald-500 to-emerald-700", ring: "ring-emerald-200" },
  indigo:  { gradient: "bg-gradient-to-br from-indigo-500 to-violet-600", ring: "ring-indigo-200" },
};

function KpiCard({
  icon: Icon, label, value, unit, color,
}: {
  icon: typeof PackageIcon;
  label: string;
  value: number;
  unit: string;
  color: keyof typeof KPI_TONE;
}) {
  const tone = KPI_TONE[color];
  return (
    <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 transition-all">
      <div className="flex items-center justify-center gap-3">
        <div className={`flex-shrink-0 size-11 rounded-xl flex items-center justify-center ring-2 shadow-md text-white ${tone.gradient} ${tone.ring}`}>
          <Icon className="size-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-foreground">
            {label}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold tabular-nums text-foreground leading-none">
              {value.toLocaleString("th-TH")}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================================================================
// Helpers
// ==================================================================
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH", {
      day: "2-digit", month: "short", year: "2-digit",
    });
  } catch {
    return String(d).slice(0, 10);
  }
}

function fmtDateLong(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
  } catch {
    return String(d);
  }
}

function ageDays(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000));
}

function ageLabel(days: number): string {
  if (days === 0) return "วันนี้";
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันก่อน`;
  if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ก่อน`;
  return `${Math.floor(days / 30)} เดือนก่อน`;
}
