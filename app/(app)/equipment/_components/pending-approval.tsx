"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, X, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { Equipment } from "@/lib/types/db";
import {
  bulkApproveEquipmentAction, rejectEquipmentAction,
} from "@/lib/actions/equipment";
import { ApproveEquipmentDialog } from "./approve-equipment-dialog";

export function PendingApproval({
  pending: pendingItems, categories,
}: {
  pending: Equipment[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [approveId, setApproveId] = useState<string | null>(null);
  const [confirmBulkApprove, setConfirmBulkApprove] = useState(false);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(pendingItems.map((e) => e.id)));
  }
  function clearAll() {
    setSelected(new Set());
    setConfirmBulkApprove(false);
  }

  function handleBulkApprove() {
    setError(null);
    if (!selected.size) return;
    startTransition(async () => {
      const res = await bulkApproveEquipmentAction(Array.from(selected));
      if (!res.ok && res.error) {
        setError(res.error);
        return;
      }
      setSelected(new Set());
      setConfirmBulkApprove(false);
      router.refresh();
    });
  }

  function handleReject(id: string) {
    startTransition(async () => {
      await rejectEquipmentAction(id, "rejected by admin");
      setConfirmReject(null);
      router.refresh();
    });
  }

  const approving = approveId
    ? pendingItems.find((e) => e.id === approveId)
    : null;

  return (
    <Card className="bg-amber-50 border-amber-300">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">
              รออนุมัติเพิ่ม Catalog
            </h2>
            <span className="bg-amber-300 text-amber-900 px-2 py-0.5 rounded-full text-xs font-bold">
              {pendingItems.length}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-600 mb-3">
          รายการที่ user เพิ่มผ่านการสร้าง PO แต่ยังไม่ได้อยู่ใน catalog
        </p>

        {/* Bulk action toolbar */}
        <div className="flex items-center gap-2 flex-wrap mb-3 p-2 bg-white rounded-lg border border-amber-200">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.size === pendingItems.length && pendingItems.length > 0}
              onChange={(e) => e.target.checked ? selectAll() : clearAll()}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <span className="font-semibold">
              เลือกทั้งหมด ({selected.size}/{pendingItems.length})
            </span>
          </label>
          {selected.size > 0 && (
            <>
              <button
                type="button"
                onClick={clearAll}
                disabled={pending}
                className="text-xs text-slate-600 underline hover:no-underline"
              >
                ล้าง
              </button>
              {confirmBulkApprove ? (
                <Button
                  size="sm" loading={pending}
                  onClick={handleBulkApprove}
                >
                  ⚠️ ยืนยันอนุมัติ {selected.size} รายการ
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setConfirmBulkApprove(true)}
                  disabled={pending}
                >
                  <Check className="h-3.5 w-3.5" /> อนุมัติทั้งหมด ({selected.size})
                </Button>
              )}
            </>
          )}
        </div>

        {confirmBulkApprove && (
          <Alert tone="warning" className="mb-3 text-xs">
            <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
            การอนุมัติแบบเหมาจะใช้ SKU เดิม + หมวด <strong>"อุปกรณ์อื่นๆ"</strong> —
            ถ้าต้องการกำหนด SKU/หมวดให้ละเอียด → กดปุ่ม "✅ อนุมัติ" ของแต่ละรายการแทน
          </Alert>
        )}

        {error && <Alert tone="danger" className="mb-3">❌ {error}</Alert>}

        {/* List */}
        <div className="space-y-2">
          {pendingItems.map((eq) => {
            const isSel = selected.has(eq.id);
            const isConfirmReject = confirmReject === eq.id;
            const images = [...(eq.image_urls ?? [])];
            if (eq.image_url && !images.includes(eq.image_url)) images.unshift(eq.image_url);
            return (
              <div
                key={eq.id}
                className={`bg-white border rounded-lg p-3 transition-colors ${
                  isSel ? "border-brand-600 ring-1 ring-brand-100" : "border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(eq.id)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 flex-shrink-0"
                  />
                  {/* Thumb */}
                  <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {images[0] ? (
                      <img src={images[0]} alt={eq.name} loading="lazy"
                           className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">✏️</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-900 truncate">{eq.name}</div>
                    <div className="text-xs text-slate-500">
                      หน่วย: {eq.unit ?? "ชิ้น"} • 📷 {images.length} รูป
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      👤 เสนอโดย: {eq.suggested_by_name ?? "—"}
                    </div>
                    {eq.suggested_notes && (
                      <div className="text-xs text-slate-600 truncate mt-0.5">
                        💬 {eq.suggested_notes}
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 sm:flex-row flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => setApproveId(eq.id)}
                      disabled={pending}
                    >
                      <Check className="h-3.5 w-3.5" /> อนุมัติ
                    </Button>
                    {isConfirmReject ? (
                      <Button
                        variant="primary" size="sm"
                        loading={pending}
                        onClick={() => handleReject(eq.id)}
                        className="!from-red-600 !to-red-700"
                        title="ยืนยันลบรายการนี้"
                      >
                        ⚠️
                      </Button>
                    ) : (
                      <Button
                        variant="secondary" size="sm"
                        onClick={() => setConfirmReject(eq.id)}
                        disabled={pending}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Approve dialog */}
        {approving && (
          <ApproveEquipmentDialog
            eq={approving}
            categories={categories}
            onClose={() => setApproveId(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
