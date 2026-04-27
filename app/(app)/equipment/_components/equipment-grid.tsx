"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Equipment } from "@/lib/types/db";
import { deleteEquipmentAction } from "@/lib/actions/equipment";
import { EditEquipmentDialog } from "./edit-equipment-dialog";

export function EquipmentGrid({
  items, categories,
}: {
  items: Equipment[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

  const editing = editId ? items.find((e) => e.id === editId) : null;

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteEquipmentAction(id);
      setConfirmDel(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((eq) => (
          <Card key={eq.id} className="overflow-hidden">
            <CardContent className="p-3">
              <EqCard eq={eq} />
              <div className="grid grid-cols-2 gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => setEditId(eq.id)}
                  disabled={pending}
                >
                  <Edit2 className="h-3.5 w-3.5" /> แก้ไข
                </Button>
                {confirmDel === eq.id ? (
                  <Button
                    variant="primary" size="sm"
                    loading={pending}
                    onClick={() => handleDelete(eq.id)}
                    className="!from-red-600 !to-red-700"
                  >
                    ⚠️ ยืนยัน
                  </Button>
                ) : (
                  <Button
                    variant="secondary" size="sm"
                    onClick={() => setConfirmDel(eq.id)}
                    disabled={pending}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> ลบ
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {editing && (
        <EditEquipmentDialog
          eq={editing}
          categories={categories}
          onClose={() => setEditId(null)}
        />
      )}
    </>
  );
}

function EqCard({ eq }: { eq: Equipment }) {
  const stock = eq.stock ?? 0;
  const rl = eq.reorder_level ?? 0;
  const images = [...(eq.image_urls ?? [])];
  if (eq.image_url && !images.includes(eq.image_url)) images.unshift(eq.image_url);
  const thumb = images[0];

  let stockChip;
  if (stock === 0) stockChip = { bg: "bg-red-50", color: "text-red-700", label: "หมด" };
  else if (rl > 0 && stock <= rl) stockChip = { bg: "bg-red-50", color: "text-red-700", label: `🔴 ต้องสั่ง ${stock}/${rl}` };
  else if (stock < 10) stockChip = { bg: "bg-amber-50", color: "text-amber-700", label: `เหลือ ${stock}` };
  else stockChip = { bg: "bg-emerald-50", color: "text-emerald-700", label: `${stock} ${eq.unit ?? ""}` };

  return (
    <>
      <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden mb-2 flex items-center justify-center">
        {thumb ? (
          <img src={thumb} alt={eq.name} loading="lazy"
               className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl">🧴</span>
        )}
      </div>
      <div className="font-semibold text-sm text-slate-900 truncate" title={eq.name}>
        {eq.name}
      </div>
      <div className="text-[11px] text-slate-500 truncate">
        SKU: {eq.sku ?? "-"} • 📂 {eq.category ?? "-"}
      </div>
      {eq.description && (
        <div className="text-[11px] text-slate-600 mt-1 line-clamp-2 h-8">
          {eq.description}
        </div>
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
        <span className="text-sm font-bold text-brand-700 tabular-nums">
          ฿{(eq.last_cost ?? 0).toLocaleString("th-TH", { maximumFractionDigits: 0 })}
        </span>
        <span className={cn("inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full",
          stockChip.bg, stockChip.color)}>
          📦 {stockChip.label}
        </span>
      </div>
    </>
  );
}
