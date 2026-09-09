"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, MoreVertical, ExternalLink, Trash2, CheckCircle2, Undo2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  markReimbursedAction,
  unmarkReimbursedAction,
  voidPaymentAction,
} from "@/lib/actions/po-payments";
import type { PoPayment } from "@/lib/types/db";
import { RecordPaymentDialog } from "./record-payment-dialog";

interface SiblingPo {
  id: string;
  po_number: string;
  status: string;
  total: number;
  paid_amount: number;
  supplier_name: string | null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "2-digit", month: "short", year: "2-digit", calendar: "gregory",
  });
}
function fmtBaht(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PaymentSection({
  poId,
  poNumber,
  poTotal,
  paidAmount,
  supplierName,
  siblingPos,
  recentCards,
  payments,
  isAdmin,
  isCreator,
}: {
  poId: string;
  poNumber: string;
  poTotal: number;
  paidAmount: number;
  supplierName: string | null;
  siblingPos: SiblingPo[];
  recentCards: string[];
  payments: PoPayment[];
  isAdmin: boolean;
  isCreator: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Per-row loading (which payment id is currently mutating)
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  // Modal state — Radix ConfirmDialog for void, Undo, and a mini form for mark
  const [voidFor, setVoidFor] = useState<PoPayment | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [unmarkFor, setUnmarkFor] = useState<PoPayment | null>(null);
  const [markingFor, setMarkingFor] = useState<PoPayment | null>(null);
  const [markDate, setMarkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [markRef, setMarkRef] = useState("");

  const remaining = Math.max(0, poTotal - paidAmount);
  const pct = poTotal > 0 ? Math.min(100, (paidAmount / poTotal) * 100) : 0;
  const canAdd = (isAdmin || isCreator) && remaining > 0.01;

  // Use tolerance vs float ===
  const TOL = 0.005;
  const status: "unpaid" | "partial" | "paid" | "overpaid" =
    paidAmount < TOL ? "unpaid"
      : paidAmount < poTotal - TOL ? "partial"
        : Math.abs(paidAmount - poTotal) < TOL ? "paid" : "overpaid";

  const statusMeta = {
    unpaid:   { label: "ยังไม่ชำระ", color: "text-slate-500", bar: "bg-slate-300" },
    partial:  { label: "จ่ายบางส่วน",  color: "text-amber-700",  bar: "bg-amber-500" },
    paid:     { label: "ชำระครบ",     color: "text-emerald-700",  bar: "bg-emerald-500" },
    overpaid: { label: "จ่ายเกิน (ตรวจ)", color: "text-red-700",  bar: "bg-red-500" },
  }[status];

  function doVoid() {
    if (!voidFor) return;
    const target = voidFor;
    const reason = voidReason.trim() || "ไม่ระบุเหตุผล";
    setRowBusy(target.id);
    start(async () => {
      const r = await voidPaymentAction(target.id, reason);
      setRowBusy(null);
      if (r.ok) {
        toast.success("ลบ payment แล้ว");
        setVoidFor(null);
        setVoidReason("");
        router.refresh();
      } else {
        toast.error(r.error ?? "ลบไม่สำเร็จ");
      }
    });
  }

  function doUnmark() {
    if (!unmarkFor) return;
    const target = unmarkFor;
    setRowBusy(target.id);
    start(async () => {
      const r = await unmarkReimbursedAction({ paymentIds: [target.id] });
      setRowBusy(null);
      if (r.ok) {
        toast.success("Undo mark แล้ว");
        setUnmarkFor(null);
        router.refresh();
      } else {
        toast.error(r.error ?? "Undo ไม่สำเร็จ");
      }
    });
  }

  function doMark(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!markingFor) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(markDate)) {
      toast.error("รูปแบบวันที่ไม่ถูกต้อง");
      return;
    }
    const target = markingFor;
    setRowBusy(target.id);
    start(async () => {
      const r = await markReimbursedAction({
        paymentIds: [target.id],
        reimbursedDate: markDate,
        reimbursementRef: markRef.trim() || undefined,
      });
      setRowBusy(null);
      if (r.ok) {
        toast.success("Mark เบิกแล้ว ✓");
        setMarkingFor(null);
        setMarkRef("");
        router.refresh();
      } else {
        toast.error(r.error ?? "Mark ไม่สำเร็จ");
      }
    });
  }

  return (
    <Card className="border-brand-200">
      <CardContent className="p-5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
          <h3 className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
            <CreditCard className="size-4 text-brand-600" aria-hidden="true" /> การชำระเงิน
            <span className="text-slate-400 font-normal text-xs ml-1">ยอดชำระ / ยอด PO</span>
          </h3>
          {canAdd && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              + บันทึกจ่ายผ่านบัตร
            </Button>
          )}
        </div>

        <div className="flex items-baseline gap-2 mt-1">
          <span className={`font-mono text-2xl font-bold ${statusMeta.color}`}>
            ฿{fmtBaht(paidAmount)}
          </span>
          <span className="text-slate-500 text-sm">/ ฿{fmtBaht(poTotal)}</span>
          <span className={`ml-2 text-xs font-semibold ${statusMeta.color}`}>· {statusMeta.label}</span>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${statusMeta.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-xs text-slate-500 font-semibold min-w-[40px] text-right">
            {pct.toFixed(0)}%
          </span>
        </div>

        {payments.length === 0 ? (
          <p className="text-xs text-slate-500 mt-4 italic">ยังไม่มีการจ่าย</p>
        ) : (
          <div className="mt-4">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
              ประวัติการจ่าย ({payments.length} รายการ)
            </p>
            <div className="space-y-2">
              {payments.map((p) => {
                // Admin sees menu whenever any action is possible.
                // Creator (non-admin) → no menu (all actions are admin-only now).
                //   Void was previously creator-allowed but conceptually reversing
                //   a payment record needs admin sign-off anyway.
                const hasAdminActions =
                  isAdmin && (
                    !p.reimbursed || // mark or void (both admin-only)
                    p.reimbursed     // unmark
                  );
                const isRowBusy = rowBusy === p.id;
                return (
                  <div
                    key={p.id}
                    className={
                      "border border-slate-200 rounded-lg p-3 bg-white hover:bg-slate-50/50 transition-colors "
                      + (isRowBusy ? "opacity-60" : "")
                    }
                  >
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {fmtDate(p.paid_date)}
                        </span>
                        <span className="text-sm font-medium">{p.card_display ?? "-"}</span>
                        <span className="text-xs text-slate-500">· {p.paid_by_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm">฿{fmtBaht(p.amount)}</span>
                        {p.reimbursed ? (
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="size-3" aria-hidden="true" /> เบิกแล้ว
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            รอเบิก
                          </span>
                        )}
                        {hasAdminActions && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="p-1 text-slate-400 hover:text-slate-700 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50"
                                aria-label="เมนู payment"
                                disabled={isRowBusy}
                              >
                                <MoreVertical className="size-4" aria-hidden="true" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[180px]">
                              {!p.reimbursed && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setMarkingFor(p);
                                    setMarkRef("");
                                    setMarkDate(new Date().toISOString().slice(0, 10));
                                  }}
                                  className="text-emerald-700 focus:bg-emerald-50 focus:text-emerald-700"
                                >
                                  <CheckCircle2 className="size-3.5 mr-2" /> Mark เบิกแล้ว
                                </DropdownMenuItem>
                              )}
                              {p.reimbursed && (
                                <DropdownMenuItem onClick={() => setUnmarkFor(p)}>
                                  <Undo2 className="size-3.5 mr-2" /> Undo mark
                                </DropdownMenuItem>
                              )}
                              {!p.reimbursed && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setVoidFor(p);
                                    setVoidReason("");
                                  }}
                                  className="text-red-700 focus:bg-red-50 focus:text-red-700"
                                >
                                  <Trash2 className="size-3.5 mr-2" /> ลบ payment
                                </DropdownMenuItem>
                              )}
                              {/* Void hidden for reimbursed — server rejects anyway */}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-500">
                      {p.slip_url && (
                        <a
                          href={p.slip_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 hover:underline inline-flex items-center gap-1"
                        >
                          📎 ดูสลิป <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      )}
                      {p.payment_group_id && (
                        <span className="text-brand-600 bg-brand-50 px-2 py-0.5 rounded text-[10px] font-semibold">
                          🔗 รูดพร้อม PO อื่น
                        </span>
                      )}
                      {p.reimbursed && p.reimbursed_date && (
                        <span className="text-emerald-700">
                          คืน {fmtDate(p.reimbursed_date)}
                          {p.reimbursement_ref ? ` · ${p.reimbursement_ref}` : ""}
                        </span>
                      )}
                      {isRowBusy && (
                        <span className="text-slate-400 italic">กำลังบันทึก...</span>
                      )}
                    </div>
                    {p.notes && (
                      <p className="text-xs text-slate-600 italic mt-1">{p.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dialog: บันทึกจ่าย */}
        <RecordPaymentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          currentPoId={poId}
          currentPoNumber={poNumber}
          currentPoRemaining={remaining}
          supplierName={supplierName}
          siblingPos={siblingPos}
          recentCards={recentCards}
        />

        {/* Confirm: void payment (Radix, with reason field) */}
        <ConfirmDialog
          open={!!voidFor}
          onOpenChange={(o) => !o && setVoidFor(null)}
          title="ลบ payment"
          description={voidFor ? (
            <div className="space-y-2 text-sm">
              <p>
                Payment {voidFor.card_display ?? "-"} ยอด <strong>฿{fmtBaht(voidFor.amount)}</strong> จ่ายโดย {voidFor.paid_by_name}
              </p>
              <div>
                <label className="text-xs font-semibold text-slate-700">เหตุผล (บันทึกใน audit log)</label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-2 py-1.5 border border-slate-300 rounded text-sm"
                  placeholder="เช่น รูดผิด / duplicate"
                  autoFocus
                />
              </div>
            </div>
          ) : ""}
          variant="danger"
          loading={pending}
          onConfirm={doVoid}
          confirmText={pending ? "กำลังลบ..." : "ยืนยันลบ"}
        />

        {/* Confirm: undo mark */}
        <ConfirmDialog
          open={!!unmarkFor}
          onOpenChange={(o) => !o && setUnmarkFor(null)}
          title="ยกเลิกการ mark เบิก"
          description={unmarkFor ? (
            <p className="text-sm">
              Undo mark payment {unmarkFor.card_display ?? "-"} · ฿{fmtBaht(unmarkFor.amount)}
              (สถานะจะกลับเป็น &ldquo;รอเบิก&rdquo;)
            </p>
          ) : ""}
          variant="warning"
          loading={pending}
          onConfirm={doUnmark}
          confirmText={pending ? "กำลัง undo..." : "ยืนยัน undo"}
        />

        {/* Mini modal: Mark เบิกแล้ว (form for Enter-to-submit) */}
        {markingFor && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
            onClick={() => setMarkingFor(null)}
          >
            <form
              className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5"
              onClick={(e) => e.stopPropagation()}
              onSubmit={doMark}
            >
              <h3 className="text-base font-bold mb-1">Mark เบิกแล้ว</h3>
              <p className="text-xs text-slate-500 mb-3">
                Payment {markingFor.card_display ?? ""} · ฿{fmtBaht(markingFor.amount)}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" htmlFor="mark-date">
                    วันที่โอนคืน *
                  </label>
                  <input
                    id="mark-date"
                    type="date"
                    value={markDate}
                    onChange={(e) => setMarkDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" htmlFor="mark-ref">
                    เลขอ้างอิง / หมายเหตุ
                  </label>
                  <input
                    id="mark-ref"
                    value={markRef}
                    onChange={(e) => setMarkRef(e.target.value)}
                    placeholder="เช่น เลขสลิปโอน 202607-1234"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMarkingFor(null)}
                  disabled={pending}
                >
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "กำลังบันทึก..." : "ยืนยัน"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
