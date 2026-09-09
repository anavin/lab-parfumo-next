"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { recordPaymentAction } from "@/lib/actions/po-payments";
import { uploadSingleAttachmentAction } from "@/lib/actions/upload";

interface SiblingPo {
  id: string;
  po_number: string;
  status: string;
  total: number;
  paid_amount: number;
  supplier_name: string | null;
}

export function RecordPaymentDialog({
  open,
  onClose,
  currentPoId,
  currentPoNumber,
  currentPoRemaining,
  supplierName,
  siblingPos,
  recentCards,
}: {
  open: boolean;
  onClose: () => void;
  currentPoId: string;
  currentPoNumber: string;
  currentPoRemaining: number;
  supplierName: string | null;
  /** PO ของ supplier เดียวกัน (ยัง unpaid/partial) เผื่อเลือกจ่ายรวม */
  siblingPos: SiblingPo[];
  /** บัตรที่ user เคยใช้ล่าสุด (auto-suggest) */
  recentCards: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);

  const [mode, setMode] = useState<"single" | "group">("single");
  const [selectedPos, setSelectedPos] = useState<Record<string, number>>({
    [currentPoId]: currentPoRemaining,
  });
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cardDisplay, setCardDisplay] = useState(recentCards[0] ?? "");
  const [approvalCode, setApprovalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [slipUrl, setSlipUrl] = useState<string | null>(null);
  const [slipName, setSlipName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset เมื่อเปิดใหม่
  useEffect(() => {
    if (open) {
      setMode("single");
      setSelectedPos({ [currentPoId]: currentPoRemaining });
      setPaidDate(new Date().toISOString().slice(0, 10));
      setCardDisplay(recentCards[0] ?? "");
      setApprovalCode("");
      setNotes("");
      setSlipUrl(null);
      setSlipName(null);
      setError(null);
    }
  }, [open, currentPoId, currentPoRemaining, recentCards]);

  const totalAmount = useMemo(
    () => Object.values(selectedPos).reduce((s, v) => s + (Number(v) || 0), 0),
    [selectedPos],
  );

  function togglePo(poId: string, remaining: number) {
    setSelectedPos((cur) => {
      const next = { ...cur };
      if (poId in next) delete next[poId];
      else next[poId] = remaining;
      return next;
    });
  }

  function updateAmount(poId: string, value: string) {
    const n = Number(value);
    setSelectedPos((cur) => ({
      ...cur,
      [poId]: Number.isFinite(n) && n > 0 ? n : 0,
    }));
  }

  async function handleUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError("ไฟล์ใหญ่เกิน 10 MB");
      return;
    }
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await uploadSingleAttachmentAction(fd);
      if (res.ok && res.attachment) {
        setSlipUrl(res.attachment.url);
        setSlipName(res.attachment.name);
      } else {
        setError(res.error ?? "อัปโหลดไม่สำเร็จ");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    setError(null);
    const allocs = Object.entries(selectedPos)
      .map(([poId, amount]) => ({ poId, amount: Number(amount) || 0 }))
      .filter((a) => a.amount > 0);
    if (allocs.length === 0) {
      setError("เลือก PO อย่างน้อย 1 ใบ + ระบุยอด");
      return;
    }
    if (!cardDisplay.trim()) {
      setError("ระบุบัตรที่รูด");
      return;
    }

    start(async () => {
      const res = await recordPaymentAction({
        allocations: allocs,
        paidDate,
        cardDisplay: cardDisplay.trim(),
        approvalCode: approvalCode.trim() || undefined,
        slipUrl: slipUrl || undefined,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      toast.success(
        `✅ บันทึกจ่าย ${res.count} รายการ ` +
        `(฿${totalAmount.toLocaleString()})${res.paymentGroupId ? " · รูดรวมกัน" : ""}`,
      );
      onClose();
      router.refresh();
    });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center p-4 pt-[8vh] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
              <CreditCard className="size-5 text-brand-600" /> บันทึกจ่ายผ่านบัตรเครดิต
            </h2>
            {supplierName && (
              <p className="text-xs text-slate-500 mt-0.5">{supplierName}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700"
            aria-label="ปิด"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* PO selection */}
          <div>
            <div className="flex items-center gap-4 mb-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "single"}
                  onChange={() => {
                    setMode("single");
                    setSelectedPos({ [currentPoId]: currentPoRemaining });
                  }}
                />
                จ่ายเฉพาะ PO นี้
              </label>
              {siblingPos.length > 0 && (
                <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === "group"}
                    onChange={() => setMode("group")}
                  />
                  รูดพร้อมกับ PO อื่น ({siblingPos.length})
                </label>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-200">
                  {/* Current PO always shown */}
                  <tr className="bg-brand-50/30">
                    <td className="w-8 p-2 text-center">
                      <input
                        type="checkbox"
                        checked={currentPoId in selectedPos}
                        onChange={() => togglePo(currentPoId, currentPoRemaining)}
                      />
                    </td>
                    <td className="p-2">
                      <div className="font-mono font-semibold text-sm">{currentPoNumber}</div>
                      <div className="text-[11px] text-slate-500">PO นี้ · ค้างจ่าย</div>
                    </td>
                    <td className="p-2 text-right text-xs text-slate-500 font-mono">
                      ฿{currentPoRemaining.toLocaleString()}
                    </td>
                    <td className="p-2 w-28">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={selectedPos[currentPoId] ?? ""}
                        onChange={(e) => updateAmount(currentPoId, e.target.value)}
                        disabled={!(currentPoId in selectedPos)}
                        className="text-right font-mono text-xs h-8"
                      />
                    </td>
                  </tr>

                  {/* Sibling POs (only shown in group mode) */}
                  {mode === "group" && siblingPos.map((po) => {
                    const isSel = po.id in selectedPos;
                    const remaining = Number(po.total ?? 0) - Number(po.paid_amount ?? 0);
                    return (
                      <tr key={po.id}>
                        <td className="w-8 p-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => togglePo(po.id, remaining)}
                          />
                        </td>
                        <td className="p-2">
                          <div className={`font-mono font-semibold text-sm ${isSel ? "" : "text-slate-500"}`}>
                            {po.po_number}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {po.status} · ค้าง {remaining > 0 ? "จ่าย" : "ครบแล้ว"}
                          </div>
                        </td>
                        <td className="p-2 text-right text-xs text-slate-500 font-mono">
                          ฿{remaining.toLocaleString()}
                        </td>
                        <td className="p-2 w-28">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={selectedPos[po.id] ?? ""}
                            onChange={(e) => updateAmount(po.id, e.target.value)}
                            disabled={!isSel}
                            className="text-right font-mono text-xs h-8"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td colSpan={3} className="p-2 text-right text-xs font-semibold text-slate-700">
                      รวมยอดที่จะรูด:
                    </td>
                    <td className="p-2 text-right font-mono font-bold text-sm text-emerald-700">
                      ฿{totalAmount.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Form fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">วันที่รูด *</label>
              <Input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Approval code</label>
              <Input
                value={approvalCode}
                onChange={(e) => setApprovalCode(e.target.value)}
                placeholder="เลขจากเครื่องรูด"
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">บัตร *</label>
            <Input
              value={cardDisplay}
              onChange={(e) => setCardDisplay(e.target.value)}
              placeholder="เช่น KTC anavin •••1234"
              list="recent-cards"
            />
            {recentCards.length > 0 && (
              <datalist id="recent-cards">
                {recentCards.map((c) => <option key={c} value={c} />)}
              </datalist>
            )}
            {recentCards.length > 0 && (
              <p className="text-[11px] text-slate-500 mt-1">
                คลิกช่องเพื่อเลือกจากบัตรที่เคยใช้
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">สลิป *</label>
            {slipUrl ? (
              <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs">
                <span className="flex-1 text-emerald-800 font-medium truncate">📎 {slipName}</span>
                <button
                  type="button"
                  onClick={() => { setSlipUrl(null); setSlipName(null); }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-50 text-sm text-slate-600">
                <Upload className="size-4" />
                <span>{uploading ? "กำลังอัปโหลด..." : "เลือกไฟล์ (JPG/PNG/PDF, max 10MB)"}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">หมายเหตุ</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น รูดร่วมกับ PO-XXX ที่ไม่ได้เลือกไว้"
            />
          </div>

          {error && (
            <div
              className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700"
              role="alert"
              aria-live="assertive"
            >
              ❌ {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
          <Button variant="outline" onClick={onClose} disabled={pending}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={pending || uploading}>
            {pending ? "กำลังบันทึก..." : `บันทึก · ฿${totalAmount.toLocaleString()}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
