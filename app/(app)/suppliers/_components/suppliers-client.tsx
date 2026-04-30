"use client";

/**
 * SuppliersClient — list + KPI + filter + search + actions
 *
 * Design language: match /users page (KPI grid, filter pills, list rows)
 */
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Edit2, Trash2, RotateCcw, Search,
  Building2, CheckCircle2, DollarSign, ArrowRight,
  Phone, Mail, FileText, Trophy, Tag, MapPin,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import type { SupplierWithStats } from "@/lib/types/db";
import {
  deleteSupplierAction, restoreSupplierAction,
} from "@/lib/actions/suppliers";
import { SupplierDialog } from "./supplier-dialog";

function fmtMoney(n: number): string {
  return `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", {
    day: "2-digit", month: "short", year: "2-digit",
  });
}

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
}

type Filter = "all" | "active" | "inactive" | "no-po-this-year";

export function SuppliersClient({
  suppliers, myRole,
}: {
  suppliers: SupplierWithStats[];
  myRole: "admin" | "supervisor" | "requester";
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<SupplierWithStats | null>(null);
  const [delPending, startDelTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const editing = editId ? suppliers.find((s) => s.id === editId) : null;
  const isAdmin = myRole === "admin" || myRole === "supervisor";

  // Stats
  const totalCount = suppliers.length;
  const activeCount = suppliers.filter((s) => s.is_active).length;
  const inactiveCount = totalCount - activeCount;
  const totalSpendThisYear = suppliers.reduce(
    (s, sup) => s + sup.totalSpendThisYear, 0,
  );
  const noPoThisYearCount = suppliers.filter(
    (s) => s.is_active && s.poCountThisYear === 0,
  ).length;

  // Top 5 by total spend (for badge)
  const topIds = useMemo(() => {
    const sorted = [...suppliers]
      .filter((s) => s.totalSpend > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5);
    return new Set(sorted.map((s) => s.id));
  }, [suppliers]);

  // Filter
  const filtered = useMemo(() => {
    let out = suppliers;
    if (filter === "active") out = out.filter((s) => s.is_active);
    else if (filter === "inactive") out = out.filter((s) => !s.is_active);
    else if (filter === "no-po-this-year") {
      out = out.filter((s) => s.is_active && s.poCountThisYear === 0);
    }
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((s) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.tax_id ?? "").toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q) ||
        (s.contact_person ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        (s.category ?? "").toLowerCase().includes(q),
      );
    }
    return out;
  }, [suppliers, filter, search]);

  function handleDelete() {
    if (!delTarget) return;
    startDelTransition(async () => {
      const res = await deleteSupplierAction(delTarget.id);
      if (res.ok) {
        toast.success(`✅ ปิดใช้งาน ${delTarget.name}`);
      } else {
        toast.error(res.error ?? "ปิดใช้งานไม่สำเร็จ");
      }
      setDelTarget(null);
      router.refresh();
    });
  }

  function handleRestore(s: SupplierWithStats) {
    startDelTransition(async () => {
      const res = await restoreSupplierAction(s.id);
      if (res.ok) {
        toast.success(`✅ เปิดใช้งาน ${s.name}`);
      } else {
        toast.error(res.error ?? "เปิดใช้งานไม่สำเร็จ");
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="space-y-5">
        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            icon={Building2}
            label="ทั้งหมด"
            value={totalCount}
            unit="ราย"
            color="primary"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <KpiCard
            icon={CheckCircle2}
            label="Active"
            value={activeCount}
            unit="ราย"
            color="emerald"
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <KpiCard
            icon={DollarSign}
            label="ใช้จ่ายปีนี้"
            value={totalSpendThisYear}
            unit="บาท"
            color="amber"
            isMoney
          />
          <KpiCard
            icon={Tag}
            label="ปีนี้ยังไม่สั่ง"
            value={noPoThisYearCount}
            unit="ราย"
            color={noPoThisYearCount > 0 ? "red" : "slate"}
            active={filter === "no-po-this-year"}
            onClick={() => setFilter("no-po-this-year")}
          />
        </div>

        {/* Filter + actions */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              }}
            >
              {([
                { v: "all", label: `ทั้งหมด (${totalCount})` },
                { v: "active", label: `Active (${activeCount})` },
                { v: "inactive", label: `ปิดใช้งาน (${inactiveCount})` },
                { v: "no-po-this-year", label: `ปีนี้ไม่สั่ง (${noPoThisYearCount})` },
              ] as const).map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setFilter(p.v)}
                  className={`inline-flex items-center justify-center h-9 px-3 rounded-lg text-xs font-semibold transition-all ${
                    filter === p.v
                      ? "bg-gradient-to-br from-primary to-brand-900 text-white shadow-sm"
                      : "bg-card border border-border text-foreground hover:bg-accent hover:-translate-y-0.5 hover:shadow-sm"
                  }`}
                >
                  <span className="truncate">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="ค้นหาชื่อ / Tax ID / รหัส / ผู้ติดต่อ"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {isAdmin && (
                <Button onClick={() => setShowAdd(true)}>
                  <Plus className="size-4" /> เพิ่ม Supplier
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Result line */}
        {filtered.length !== suppliers.length && (
          <div className="text-sm text-muted-foreground">
            พบ <strong className="text-foreground">{filtered.length}</strong>{" "}
            จาก {totalCount} ราย
          </div>
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Building2 className="size-10 mx-auto mb-3 text-muted-foreground/50" />
              {totalCount === 0
                ? "ยังไม่มี Supplier ในระบบ — กดปุ่ม + เพิ่ม Supplier ด้านบน"
                : "ไม่พบ Supplier ตามเงื่อนไข"}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((s) => (
              <SupplierRow
                key={s.id}
                supplier={s}
                isTopSpender={topIds.has(s.id)}
                canManage={isAdmin}
                onEdit={() => setEditId(s.id)}
                onDelete={() => setDelTarget(s)}
                onRestore={() => handleRestore(s)}
              />
            ))}
          </div>
        )}

        {showAdd && (
          <SupplierDialog
            mode="create"
            onClose={() => setShowAdd(false)}
            onSaved={() => {
              setShowAdd(false);
              router.refresh();
            }}
          />
        )}
        {editing && (
          <SupplierDialog
            mode="edit"
            supplier={editing}
            onClose={() => setEditId(null)}
            onSaved={() => {
              setEditId(null);
              router.refresh();
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title={`ปิดใช้งาน ${delTarget?.name ?? ""}?`}
        description={
          <>
            Supplier จะไม่ปรากฏใน dropdown ตอนสั่ง PO ใหม่ —
            ประวัติ PO เก่ายังเก็บไว้ปกติ.
            <br />
            สามารถ <strong>เปิดใช้งานใหม่</strong> ได้ภายหลังจากปุ่ม "เปิดใช้งาน"
          </>
        }
        confirmText="ปิดใช้งาน"
        variant="warning"
        loading={delPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ==================================================================
// Supplier Row
// ==================================================================
function SupplierRow({
  supplier: s, isTopSpender, canManage, onEdit, onDelete, onRestore,
}: {
  supplier: SupplierWithStats;
  isTopSpender: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const isInactive = !s.is_active;
  const initials = (s.name || "?").trim().slice(0, 2).toUpperCase();

  return (
    <div
      className={`group bg-card border rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all ${
        isInactive ? "border-border opacity-60" : "border-border hover:border-primary/30"
      }`}
    >
      <div className="grid grid-cols-12 gap-4 items-center">
        {/* Avatar + identity */}
        <Link
          href={`/suppliers/${s.id}`}
          className="col-span-12 sm:col-span-4 flex items-center gap-3 min-w-0"
        >
          <div
            className={`flex-shrink-0 size-12 rounded-xl flex items-center justify-center font-bold text-sm text-white ring-1 shadow-sm ${
              isInactive
                ? "bg-gradient-to-br from-slate-300 to-slate-400 ring-slate-200"
                : "bg-gradient-to-br from-indigo-500 to-violet-600 ring-indigo-200"
            }`}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="font-bold text-foreground truncate hover:text-primary">
                {s.name}
              </div>
              {isTopSpender && (
                <Badge
                  variant="soft"
                  className="text-[10px] !bg-amber-100 !text-amber-700 inline-flex items-center gap-0.5"
                >
                  <Trophy className="size-2.5" /> Top
                </Badge>
              )}
              {isInactive && (
                <Badge
                  variant="outline"
                  className="text-[10px] !text-red-600 !border-red-300"
                >
                  ปิดใช้งาน
                </Badge>
              )}
              {s.category && (
                <Badge variant="outline" className="text-[10px] inline-flex items-center gap-0.5">
                  <Tag className="size-2.5" /> {s.category}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {s.code && <><span className="font-mono">{s.code}</span> • </>}
              {s.tax_id || "ไม่มี Tax ID"}
            </div>
          </div>
        </Link>

        {/* Contact */}
        <div className="col-span-12 sm:col-span-3 text-xs space-y-1 min-w-0">
          {s.contact_person && (
            <div className="inline-flex items-center gap-1 text-foreground">
              👤 <span className="truncate">{s.contact_person}</span>
            </div>
          )}
          {s.phone && (
            <div className="inline-flex items-center gap-1 text-muted-foreground">
              <Phone className="size-3" />
              <span className="truncate">{s.phone}</span>
            </div>
          )}
          {s.email && (
            <div className="inline-flex items-center gap-1 text-muted-foreground min-w-0">
              <Mail className="size-3 flex-shrink-0" />
              <span className="truncate">{s.email}</span>
            </div>
          )}
          {!s.contact_person && !s.phone && !s.email && (
            <div className="text-muted-foreground italic">— ไม่มีข้อมูลติดต่อ —</div>
          )}
        </div>

        {/* Stats */}
        <div className="col-span-12 sm:col-span-3 text-xs space-y-1">
          <div className="inline-flex items-center gap-1.5">
            <FileText className="size-3 text-muted-foreground" />
            <span className="text-muted-foreground/70">PO:</span>
            <span className="font-semibold text-foreground tabular-nums">{s.poCount}</span>
            {s.pendingPoCount > 0 && (
              <span className="text-amber-600">
                ({s.pendingPoCount} รอ)
              </span>
            )}
          </div>
          {s.totalSpend > 0 && (
            <div className="inline-flex items-center gap-1.5">
              <DollarSign className="size-3 text-muted-foreground" />
              <span className="text-muted-foreground/70">รวม:</span>
              <span className="font-semibold text-foreground tabular-nums">
                {fmtMoney(s.totalSpend)}
              </span>
            </div>
          )}
          {s.lastPoDate && (
            <div className="text-muted-foreground inline-flex items-center gap-1">
              <span className="text-muted-foreground/70">PO ล่าสุด:</span>
              <span>{fmtDate(s.lastPoDate)}</span>
              <span className="text-muted-foreground/50">
                ({ageDays(s.lastPoDate)} วัน)
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="col-span-12 sm:col-span-2 flex justify-end gap-1.5">
          <Link href={`/suppliers/${s.id}`}>
            <Button size="sm" variant="outline">
              ดู <ArrowRight className="size-3" />
            </Button>
          </Link>
          {canManage && (
            isInactive ? (
              <Button
                size="sm" variant="secondary"
                onClick={onRestore}
                className="!text-emerald-700"
                title="เปิดใช้งานใหม่"
                aria-label="เปิดใช้งาน"
              >
                <RotateCcw className="size-3.5" />
              </Button>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={onEdit}>
                  <Edit2 className="size-3.5" />
                </Button>
                <Button
                  size="sm" variant="secondary" onClick={onDelete}
                  className="!text-red-600 hover:!bg-red-50"
                  title="ปิดใช้งาน"
                  aria-label="ปิดใช้งาน"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )
          )}
        </div>
      </div>

      {/* Address row (mobile + when present) */}
      {s.address && (
        <div className="mt-2 text-xs text-muted-foreground inline-flex items-start gap-1 max-w-full">
          <MapPin className="size-3 flex-shrink-0 mt-0.5" />
          <span className="truncate">{s.address}</span>
        </div>
      )}
    </div>
  );
}

// ==================================================================
// KPI Card
// ==================================================================
const KPI_TONE: Record<string, { gradient: string; ring: string }> = {
  primary: { gradient: "bg-gradient-to-br from-blue-500 to-blue-700", ring: "ring-blue-200" },
  amber: { gradient: "bg-gradient-to-br from-amber-400 to-orange-500", ring: "ring-amber-200" },
  emerald: { gradient: "bg-gradient-to-br from-emerald-500 to-emerald-700", ring: "ring-emerald-200" },
  red: { gradient: "bg-gradient-to-br from-red-500 to-rose-600", ring: "ring-red-200" },
  slate: { gradient: "bg-gradient-to-br from-slate-300 to-slate-400", ring: "ring-slate-200" },
};

function KpiCard({
  icon: Icon, label, value, unit, color, active, onClick, isMoney,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  unit: string;
  color: keyof typeof KPI_TONE;
  active?: boolean;
  onClick?: () => void;
  isMoney?: boolean;
}) {
  const tone = KPI_TONE[color];
  const interactive = !!onClick;
  const baseCls = `bg-card border rounded-2xl p-4 transition-all w-full text-left ${
    active
      ? "border-primary ring-2 ring-primary/30 shadow-md"
      : "border-border hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40"
  } ${interactive ? "cursor-pointer" : ""}`;

  const display = isMoney
    ? `฿${value.toLocaleString("th-TH", { maximumFractionDigits: 0 })}`
    : value.toLocaleString("th-TH");

  const inner = (
    <div className="flex items-center justify-center gap-3">
      <div className={`flex-shrink-0 size-11 rounded-xl flex items-center justify-center ring-2 shadow-md text-white ${tone.gradient} ${tone.ring}`}>
        <Icon className="size-5" strokeWidth={2.5} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-muted-foreground">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <span className={`${isMoney ? "text-base" : "text-xl"} font-extrabold tabular-nums text-foreground leading-none`}>
            {display}
          </span>
          {!isMoney && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
        </div>
      </div>
    </div>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={baseCls} aria-pressed={active}>
        {inner}
      </button>
    );
  }
  return <div className={baseCls}>{inner}</div>;
}
