"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  RotateCcw, Trash, FileText, Building2, AlertTriangle, ArrowRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import {
  restorePoFromTrashAction, permanentDeletePoAction,
} from "@/lib/actions/po";
import {
  restoreSupplierFromTrashAction, permanentDeleteSupplierAction,
} from "@/lib/actions/suppliers";
import type { TrashedPo, TrashedSupplier } from "@/lib/db/trash";

type Tab = "po" | "supplier";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function TrashClient({
  pos, suppliers,
}: {
  pos: TrashedPo[];
  suppliers: TrashedSupplier[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("po");
  const [pending, start] = useTransition();
  const [confirmPermDeletePo, setConfirmPermDeletePo] = useState<TrashedPo | null>(null);
  const [confirmPermDeleteSup, setConfirmPermDeleteSup] = useState<TrashedSupplier | null>(null);

  function handleRestorePo(po: TrashedPo) {
    start(async () => {
      const res = await restorePoFromTrashAction([po.id]);
      if (res.ok) {
        toast.success(`✅ กู้คืน ${po.po_number} แล้ว`);
        router.refresh();
      } else {
        toast.error(res.error ?? "กู้คืนไม่สำเร็จ");
      }
    });
  }
  function handlePermDeletePo() {
    if (!confirmPermDeletePo) return;
    const target = confirmPermDeletePo;
    start(async () => {
      const res = await permanentDeletePoAction([target.id]);
      if (res.ok) {
        toast.success(`🗑️ ลบถาวร ${target.po_number} แล้ว`);
        setConfirmPermDeletePo(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "ลบไม่สำเร็จ");
      }
    });
  }

  function handleRestoreSupplier(s: TrashedSupplier) {
    start(async () => {
      const res = await restoreSupplierFromTrashAction(s.id);
      if (res.ok) {
        toast.success(`✅ กู้คืน ${s.name} แล้ว`);
        router.refresh();
      } else {
        toast.error(res.error ?? "กู้คืนไม่สำเร็จ");
      }
    });
  }
  function handlePermDeleteSupplier() {
    if (!confirmPermDeleteSup) return;
    const target = confirmPermDeleteSup;
    start(async () => {
      const res = await permanentDeleteSupplierAction(target.id);
      if (res.ok) {
        toast.success(
          `🗑️ ลบถาวร ${target.name} แล้ว` +
            (res.unlinkedPoCount && res.unlinkedPoCount > 0
              ? ` — unlinked ${res.unlinkedPoCount} PO`
              : ""),
        );
        setConfirmPermDeleteSup(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "ลบไม่สำเร็จ");
      }
    });
  }

  return (
    <>
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <TabButton
          active={tab === "po"}
          onClick={() => setTab("po")}
          icon={FileText}
          label="PO"
          count={pos.length}
        />
        <TabButton
          active={tab === "supplier"}
          onClick={() => setTab("supplier")}
          icon={Building2}
          label="Supplier"
          count={suppliers.length}
        />
      </div>

      {/* Empty state */}
      {tab === "po" && pos.length === 0 && (
        <EmptyState label="PO" />
      )}
      {tab === "supplier" && suppliers.length === 0 && (
        <EmptyState label="Supplier" />
      )}

      {/* PO list */}
      {tab === "po" && pos.length > 0 && (
        <div className="space-y-2">
          {pos.map((po) => (
            <Card key={po.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground font-mono">{po.po_number}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {po.status}
                      </Badge>
                      {po.supplier_name && (
                        <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
                          <Building2 className="size-3" /> {po.supplier_name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ลบโดย <strong>{po.deleted_by_name ?? "—"}</strong> เมื่อ {fmtDateTime(po.deleted_at)}
                      {" · "}สร้างโดย {po.created_by_name ?? "—"}
                      {" · "}{po.items?.length ?? 0} รายการ
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm" variant="secondary"
                      onClick={() => handleRestorePo(po)}
                      disabled={pending}
                      className="!text-emerald-700"
                    >
                      <RotateCcw className="size-3.5" /> กู้คืน
                    </Button>
                    <Button
                      size="sm" variant="secondary"
                      onClick={() => setConfirmPermDeletePo(po)}
                      disabled={pending}
                      className="!text-red-700 !bg-red-50 hover:!bg-red-100 !border-red-200"
                    >
                      <Trash className="size-3.5" /> ลบถาวร
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Supplier list */}
      {tab === "supplier" && suppliers.length > 0 && (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <Card key={s.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-foreground">{s.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ลบโดย <strong>{s.deleted_by_name ?? "—"}</strong> เมื่อ {fmtDateTime(s.deleted_at)}
                      {s.code && <> · รหัส {s.code}</>}
                      {s.tax_id && <> · {s.tax_id}</>}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm" variant="secondary"
                      onClick={() => handleRestoreSupplier(s)}
                      disabled={pending}
                      className="!text-emerald-700"
                    >
                      <RotateCcw className="size-3.5" /> กู้คืน
                    </Button>
                    <Button
                      size="sm" variant="secondary"
                      onClick={() => setConfirmPermDeleteSup(s)}
                      disabled={pending}
                      className="!text-red-700 !bg-red-50 hover:!bg-red-100 !border-red-200"
                    >
                      <Trash className="size-3.5" /> ลบถาวร
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={!!confirmPermDeletePo}
        onOpenChange={(o) => !o && setConfirmPermDeletePo(null)}
        title={`🗑️ ลบถาวร ${confirmPermDeletePo?.po_number ?? ""}?`}
        description={
          <div className="space-y-1.5 text-sm">
            <div>จะลบ PO นี้ออกจาก DB ถาวร พร้อม:</div>
            <ul className="text-xs list-disc pl-5 space-y-0.5 text-muted-foreground">
              <li>กิจกรรม + ความคิดเห็น + ประวัติการรับของ</li>
              <li>ไฟล์แนบ + รูปการรับของ (Storage)</li>
              <li>การแจ้งเตือนที่อ้างถึง PO นี้</li>
              <li>Lots ที่สร้างจาก PO นี้ — <code>po_id</code> จะถูกตั้งเป็น NULL (lot history ยังอยู่)</li>
            </ul>
            <div className="text-destructive font-semibold pt-1">
              ⚠️ ไม่สามารถ undo ได้ — แนะนำใช้ &ldquo;กู้คืน&rdquo; ถ้ายังไม่แน่ใจ
            </div>
          </div>
        }
        confirmText="ลบถาวร"
        variant="danger"
        loading={pending}
        onConfirm={handlePermDeletePo}
      />

      <ConfirmDialog
        open={!!confirmPermDeleteSup}
        onOpenChange={(o) => !o && setConfirmPermDeleteSup(null)}
        title={`🗑️ ลบถาวร ${confirmPermDeleteSup?.name ?? ""}?`}
        description={
          <div className="space-y-1.5 text-sm">
            <div>จะลบ Supplier นี้ออกจาก DB ถาวร</div>
            <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs inline-flex items-start gap-1">
              <AlertTriangle className="size-3.5 mt-0.5 flex-shrink-0" />
              <span>
                PO ที่ link Supplier นี้จะ <strong>คงชื่อ Supplier เดิม</strong> ไว้ (snapshot)
                แต่ supplier_id จะถูก set NULL
              </span>
            </div>
            <div className="text-destructive font-semibold pt-1">
              ⚠️ ไม่สามารถ undo ได้
            </div>
          </div>
        }
        confirmText="ลบถาวร"
        variant="danger"
        loading={pending}
        onConfirm={handlePermDeleteSupplier}
      />
    </>
  );
}

function TabButton({
  active, onClick, icon: Icon, label, count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-4" />
      {label}
      <span className={`ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums ${
        active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
      }`}>
        {count}
      </span>
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        <div className="text-5xl mb-3">🗑️</div>
        ไม่มี {label} ในถังขยะ
        <div className="mt-3">
          <Link href="/po" className="text-primary hover:underline text-xs inline-flex items-center gap-1">
            กลับไปที่ทำงาน <ArrowRight className="size-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
