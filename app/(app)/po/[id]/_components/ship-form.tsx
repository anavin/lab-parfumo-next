"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { shipPoAction } from "@/lib/actions/po";

export function ShipForm({
  poId, poNumber, initialTracking,
  onClose,
}: {
  poId: string;
  poNumber: string;
  initialTracking: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(initialTracking ?? "");
  const [note, setNote] = useState("");

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await shipPoAction(poId, tracking.trim(), note.trim());
      if (!res.ok) setError(res.error ?? "บันทึกไม่สำเร็จ");
      else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-slate-200">
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 text-white p-4 rounded-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/15 flex items-center justify-center">
          <Truck className="h-5 w-5" />
        </div>
        <div>
          <div className="font-bold">อัปเดตขนส่ง — {poNumber}</div>
          <div className="text-xs text-white/85">
            ใส่เลข Tracking — ผู้สร้าง PO จะได้รับแจ้งเตือน
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          เลข Tracking
        </label>
        <Input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          placeholder="เช่น KE12345678"
          disabled={pending}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          หมายเหตุ
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น Supplier แจ้งจัดส่งวันนี้"
          rows={2}
          disabled={pending}
          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 disabled:bg-slate-100"
        />
      </div>

      {error && <Alert tone="danger">❌ {error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSubmit} loading={pending}>
          ✅ ยืนยัน
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          <X className="h-4 w-4" /> ยกเลิก
        </Button>
      </div>
    </div>
  );
}
