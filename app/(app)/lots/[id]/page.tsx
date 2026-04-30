import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, Calendar, Building2, Hash, FileText } from "lucide-react";
import { requirePrivileged } from "@/lib/auth/require-user";
import { getLotById, getWithdrawalsForLot } from "@/lib/db/lots";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LOT_STATUS_LABEL } from "@/lib/types/db";
import { LotEditClient } from "./_components/lot-edit-client";

export const metadata: Metadata = {
  title: "Lot Detail — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePrivileged();
  const { id } = await params;

  const [lot, withdrawals] = await Promise.all([
    getLotById(id),
    getWithdrawalsForLot(id),
  ]);

  if (!lot) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const isExpired = lot.expiry_date && lot.expiry_date < today && lot.status === "active";
  const pctRemaining =
    lot.qty_initial > 0 ? (lot.qty_remaining / lot.qty_initial) * 100 : 0;

  return (
    <div className="space-y-5">
      <Link
        href="/lots"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        ทุก lot
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="size-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Package className="size-7" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-base font-bold text-primary">
              {lot.lot_no}
            </span>
            <Badge variant="soft">{LOT_STATUS_LABEL[lot.status]}</Badge>
            {isExpired && (
              <Badge className="bg-red-100 text-red-700 border-red-200 border">
                ⚠️ หมดอายุแล้ว
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            {lot.equipment_name}
          </h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">เริ่มต้น</div>
            <div className="text-2xl font-bold tabular-nums">
              {Number(lot.qty_initial).toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {lot.unit ?? ""}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">คงเหลือ</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-600">
              {Number(lot.qty_remaining).toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {lot.unit ?? ""}
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.max(0, Math.min(100, pctRemaining))}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">ใช้ไปแล้ว</div>
            <div className="text-2xl font-bold tabular-nums">
              {Number(lot.qty_initial - lot.qty_remaining).toLocaleString()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({Math.round(100 - pctRemaining)}%)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provenance + edit */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">ที่มา + รายละเอียด</h2>
            <LotEditClient lot={lot} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Field icon={Hash} label="Lot ภายใน" value={lot.lot_no} mono />
            <Field
              icon={Hash}
              label="Lot ผู้ผลิต"
              value={lot.supplier_lot_no ?? "—"}
              dim={!lot.supplier_lot_no}
            />
            <Field
              icon={Building2}
              label="Supplier"
              value={lot.supplier_name ?? "—"}
              dim={!lot.supplier_name}
            />
            <Field
              icon={FileText}
              label="PO ที่มา"
              value={
                lot.po_number ? (
                  <Link
                    href={`/po/${lot.po_id}`}
                    className="text-primary hover:underline"
                  >
                    {lot.po_number}
                  </Link>
                ) : "—"
              }
              dim={!lot.po_number}
            />
            <Field
              icon={Calendar}
              label="วันรับเข้า"
              value={fmtDate(lot.received_date)}
            />
            <Field
              icon={Calendar}
              label="วันผลิต (MFG)"
              value={fmtDate(lot.manufactured_date)}
              dim={!lot.manufactured_date}
            />
            <Field
              icon={Calendar}
              label="วันหมดอายุ (EXP)"
              value={fmtDate(lot.expiry_date)}
              dim={!lot.expiry_date}
              danger={!!isExpired}
            />
            <Field
              icon={FileText}
              label="หมายเหตุ"
              value={lot.notes ?? "—"}
              dim={!lot.notes}
            />
          </div>
        </CardContent>
      </Card>

      {/* Withdrawal history */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-bold text-foreground mb-3">
            ประวัติการเบิก ({withdrawals.length})
          </h2>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              ยังไม่มีการเบิกจาก lot นี้
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr className="border-b border-border/40">
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">เวลา</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">ผู้เบิก</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">จำนวน</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">เพื่อ</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="border-b border-border/40">
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {fmtDateTime(w.withdrawn_at)}
                      </td>
                      <td className="px-3 py-2 font-medium">{w.withdrawn_by_name}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        −{Number(w.qty).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{w.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  icon: Icon, label, value, mono, dim, danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  dim?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="size-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div
          className={`${mono ? "font-mono" : ""} ${
            dim ? "text-muted-foreground" : "text-foreground"
          } ${danger ? "text-red-600 font-medium" : ""}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
