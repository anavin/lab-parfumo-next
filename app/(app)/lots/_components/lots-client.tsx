"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, AlertTriangle, Calendar, Package, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Lot, LotStatus } from "@/lib/types/db";
import { LOT_STATUS_LABEL } from "@/lib/types/db";

interface Props {
  lots: Lot[];
  counts: Record<LotStatus, number>;
  currentStatus: LotStatus | "all";
  currentSearch: string;
  currentExpiring: number;
}

const STATUS_TONE: Record<LotStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  depleted: "bg-slate-50 text-slate-600 border-slate-200",
  expired: "bg-red-50 text-red-700 border-red-200",
  discarded: "bg-amber-50 text-amber-700 border-amber-200",
};

export function LotsClient({
  lots, counts, currentStatus, currentSearch, currentExpiring,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  function goto(params: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    start(() => router.push(`/lots?${next.toString()}`));
  }

  function setSearch(q: string) {
    goto({ q: q || undefined });
  }

  function setStatus(s: LotStatus | "all") {
    goto({ status: s === "all" ? undefined : s, expiring: undefined });
  }

  function setExpiring(days: number) {
    if (days === 0) goto({ expiring: undefined });
    else goto({ expiring: String(days), status: undefined });
  }

  const total = lots.length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="กำลังใช้"
          value={counts.active}
          tone="emerald"
          active={currentStatus === "active"}
          onClick={() => setStatus("active")}
        />
        <KpiCard
          label="หมดแล้ว"
          value={counts.depleted}
          tone="slate"
          active={currentStatus === "depleted"}
          onClick={() => setStatus("depleted")}
        />
        <KpiCard
          label="หมดอายุ"
          value={counts.expired}
          tone="red"
          active={currentStatus === "expired"}
          onClick={() => setStatus("expired")}
        />
        <KpiCard
          label="ทิ้ง/ทำลาย"
          value={counts.discarded}
          tone="amber"
          active={currentStatus === "discarded"}
          onClick={() => setStatus("discarded")}
        />
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="ค้นหา lot_no, ชื่อสินค้า, supplier_lot_no..."
                defaultValue={currentSearch}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearch((e.target as HTMLInputElement).value);
                  }
                }}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={currentStatus === "all" && currentExpiring === 0 ? "default" : "outline"}
                onClick={() => setStatus("all")}
              >
                ทั้งหมด
              </Button>
              <Button
                size="sm"
                variant={currentExpiring === 7 ? "default" : "outline"}
                onClick={() => setExpiring(7)}
              >
                <AlertTriangle className="size-3.5 mr-1" />
                หมดอายุใน 7 วัน
              </Button>
              <Button
                size="sm"
                variant={currentExpiring === 30 ? "default" : "outline"}
                onClick={() => setExpiring(30)}
              >
                <Calendar className="size-3.5 mr-1" />
                ใน 30 วัน
              </Button>
            </div>
            {(currentSearch || currentStatus !== "all" || currentExpiring > 0) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => router.push("/lots")}
                disabled={pending}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            แสดง {total.toLocaleString()} lot
          </div>
        </CardContent>
      </Card>

      {/* Lot list */}
      {lots.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon="📦"
              title="ยังไม่มี lot"
              text={
                currentSearch || currentStatus !== "all" || currentExpiring > 0
                  ? "ลองเปลี่ยนตัวกรอง"
                  : "Lot จะถูกสร้างอัตโนมัติเมื่อรับของจาก PO"
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {lots.map((lot) => {
            const isExpired =
              lot.expiry_date && lot.expiry_date < today && lot.status === "active";
            const isExpiringSoon =
              lot.expiry_date &&
              lot.status === "active" &&
              !isExpired &&
              new Date(lot.expiry_date).getTime() - Date.now() < 30 * 86_400_000;
            const pctRemaining =
              lot.qty_initial > 0
                ? (lot.qty_remaining / lot.qty_initial) * 100
                : 0;

            return (
              <Link
                key={lot.id}
                href={`/lots/${lot.id}`}
                className="block group"
              >
                <Card className="group-hover:border-primary/40 group-hover:shadow-sm transition">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <Package className="size-5" strokeWidth={2.25} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-primary">
                            {lot.lot_no}
                          </span>
                          <Badge
                            variant="soft"
                            className={`text-[10px] border ${STATUS_TONE[lot.status]}`}
                          >
                            {LOT_STATUS_LABEL[lot.status]}
                          </Badge>
                          {isExpired && (
                            <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200 border">
                              ⚠️ หมดอายุแล้ว
                            </Badge>
                          )}
                          {isExpiringSoon && !isExpired && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200 border">
                              ⏰ ใกล้หมดอายุ
                            </Badge>
                          )}
                        </div>
                        <div className="font-semibold text-foreground mt-1 truncate">
                          {lot.equipment_name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {lot.po_number && <span>PO: {lot.po_number}</span>}
                          {lot.supplier_name && <span>Supplier: {lot.supplier_name}</span>}
                          {lot.supplier_lot_no && <span>Lot ผู้ผลิต: {lot.supplier_lot_no}</span>}
                          <span>รับเมื่อ {fmtDate(lot.received_date)}</span>
                          {lot.expiry_date && (
                            <span className={isExpired ? "text-red-600 font-medium" : isExpiringSoon ? "text-amber-600 font-medium" : ""}>
                              หมดอายุ {fmtDate(lot.expiry_date)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-base font-bold tabular-nums text-foreground">
                          {Number(lot.qty_remaining).toLocaleString()} / {Number(lot.qty_initial).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {lot.unit ?? ""}
                        </div>
                        <div className="w-20 h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${Math.max(0, Math.min(100, pctRemaining))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label, value, tone, active, onClick,
}: {
  label: string;
  value: number;
  tone: "emerald" | "slate" | "red" | "amber";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    emerald: "text-emerald-600 border-emerald-200",
    slate: "text-slate-600 border-slate-200",
    red: "text-red-600 border-red-200",
    amber: "text-amber-600 border-amber-200",
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`text-left bg-card border rounded-2xl p-4 transition hover:border-primary/40 hover:shadow-sm ${
        active ? "ring-2 ring-primary/30 border-primary/40" : "border-border"
      }`}
    >
      <div className={`text-xs font-medium ${toneClass}`}>{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">
        {value.toLocaleString()}
      </div>
    </button>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
