"use client";

/**
 * LookupsManager — UI สำหรับจัดการ dropdown ทุกประเภท
 *
 * แสดง 5 sections (collapsible):
 *  - หมวดหมู่ Supplier
 *  - ธนาคาร
 *  - หน่วย Equipment
 *  - เครดิตเทอม
 *  - เหตุผลการเบิก
 *
 * แต่ละ section มี:
 *  - List rows (name + code + usage count)
 *  - Add (inline)
 *  - Edit (inline)
 *  - Delete (block ถ้า usage > 0)
 *  - Active/Inactive toggle
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, Plus, Edit2, Trash2, Save, X, Eye, EyeOff,
  Building2, Box, CreditCard, Tag, Wrench, type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  LOOKUP_TYPE_LABEL, type LookupType, type LookupWithUsage,
} from "@/lib/types/db";
import {
  createLookupAction, updateLookupAction, deleteLookupAction,
} from "@/lib/actions/lookups";

const TYPE_ICON: Record<LookupType, LucideIcon> = {
  supplier_category: Tag,
  bank: Building2,
  equipment_unit: Box,
  payment_term: CreditCard,
  withdrawal_purpose: Wrench,
};

const TYPE_HINT: Record<LookupType, string> = {
  supplier_category: "ใช้จัดกลุ่ม Supplier ตามประเภท (บรรจุภัณฑ์/สารเคมี/ฯลฯ)",
  bank: "ธนาคารที่ Supplier ใช้รับเงินโอน — แสดงในฟอร์ม + PDF",
  equipment_unit: "หน่วยนับ (ชิ้น/กล่อง/ลิตร) — ใช้ใน catalog + PO + เบิกของ",
  payment_term: "เครดิตเทอมที่ตกลงกับ Supplier (30/60/90 วัน หรือ COD)",
  withdrawal_purpose: "เหตุผลในการเบิกของจาก stock — ช่วยจัดกลุ่มประวัติ",
};

const TYPE_HAS_CODE: Record<LookupType, boolean> = {
  supplier_category: false,
  bank: true,           // BBL / SCB / etc.
  equipment_unit: false,
  payment_term: false,
  withdrawal_purpose: false,
};

export function LookupsManager({
  lookupsByType,
}: {
  lookupsByType: Record<string, LookupWithUsage[]>;
}) {
  const types: LookupType[] = [
    "supplier_category",
    "bank",
    "equipment_unit",
    "payment_term",
    "withdrawal_purpose",
  ];

  // Default open: supplier_category + bank (most-used)
  const [openSet, setOpenSet] = useState<Set<LookupType>>(
    new Set(["supplier_category", "bank"]),
  );

  function toggle(t: LookupType) {
    setOpenSet((cur) => {
      const next = new Set(cur);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">
            🔧 จัดการ Dropdown
          </h3>
          <p className="text-xs text-muted-foreground">
            จัดการค่าที่ใช้ใน dropdown ของฟอร์มต่างๆ — เพิ่ม/แก้/ลบ/sort ได้
          </p>
        </div>

        <div className="space-y-2.5">
          {types.map((t) => (
            <LookupSection
              key={t}
              type={t}
              items={lookupsByType[t] ?? []}
              isOpen={openSet.has(t)}
              onToggle={() => toggle(t)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================================================================
// Section per type
// ==================================================================
function LookupSection({
  type, items, isOpen, onToggle,
}: {
  type: LookupType;
  items: LookupWithUsage[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const Icon = TYPE_ICON[type];
  const label = LOOKUP_TYPE_LABEL[type];
  const hint = TYPE_HINT[type];
  const hasCode = TYPE_HAS_CODE[type];
  const activeCount = items.filter((i) => i.is_active).length;

  return (
    <div className={cn(
      "border rounded-xl transition-all overflow-hidden",
      isOpen ? "border-primary/40 bg-card" : "border-border bg-muted/20",
    )}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/40 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="flex-shrink-0 size-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-sm">
            <Icon className="size-4.5" strokeWidth={2.25} />
          </div>
          <div>
            <div className="font-bold text-sm text-foreground inline-flex items-center gap-2">
              {label}
              <Badge variant="soft" className="text-[10px]">
                {activeCount} active
              </Badge>
              {items.length > activeCount && (
                <Badge variant="outline" className="text-[10px] !text-muted-foreground">
                  {items.length - activeCount} inactive
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
          </div>
        </div>
        <ChevronDown className={cn(
          "size-4 text-muted-foreground transition-transform flex-shrink-0",
          isOpen && "rotate-180",
        )} />
      </button>

      {/* Content (collapsible) */}
      {isOpen && (
        <div className="border-t border-border/50">
          {/* Add row (when adding) */}
          {adding && (
            <AddRow
              type={type}
              hasCode={hasCode}
              onClose={() => setAdding(false)}
            />
          )}

          {/* Existing rows */}
          {items.length === 0 && !adding ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              ยังไม่มีรายการ — กดปุ่ม + เพิ่ม ด้านล่าง
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {items.map((item) => (
                <LookupRow
                  key={item.id}
                  item={item}
                  hasCode={hasCode}
                />
              ))}
            </div>
          )}

          {/* Footer: Add button */}
          {!adding && (
            <div className="p-3 border-t border-border/40 bg-muted/30">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAdding(true)}
              >
                <Plus className="size-3.5" /> เพิ่ม{label}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================================================================
// Add Row (inline)
// ==================================================================
function AddRow({
  type, hasCode, onClose,
}: {
  type: LookupType;
  hasCode: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }
    startTransition(async () => {
      const res = await createLookupAction({
        type,
        name: name.trim(),
        code: code.trim() || undefined,
      });
      if (res.ok) {
        toast.success(`✅ เพิ่ม "${name.trim()}" แล้ว`);
        setName("");
        setCode("");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "เพิ่มไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="px-4 py-3 bg-blue-50/40 border-b border-border/40">
      <div className="flex items-center gap-2 flex-wrap">
        <Plus className="size-4 text-primary flex-shrink-0" />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อใหม่..."
          autoFocus
          disabled={pending}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          className="flex-1 min-w-[150px] h-9"
        />
        {hasCode && (
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Code (optional)"
            disabled={pending}
            className="w-32 h-9 font-mono"
          />
        )}
        <Button size="sm" onClick={handleSubmit} loading={pending}>
          <Save className="size-3.5" /> บันทึก
        </Button>
        <Button size="sm" variant="secondary" onClick={onClose} disabled={pending}>
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ==================================================================
// Lookup Row (display + edit + delete)
// ==================================================================
function LookupRow({
  item, hasCode,
}: {
  item: LookupWithUsage;
  hasCode: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(item.name);
  const [code, setCode] = useState(item.code ?? "");

  function handleSave() {
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อ");
      return;
    }
    startTransition(async () => {
      const res = await updateLookupAction(item.id, {
        name: name.trim(),
        code: code.trim() || undefined,
      });
      if (res.ok) {
        toast.success("✅ บันทึกแล้ว");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "บันทึกไม่สำเร็จ");
      }
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      const res = await updateLookupAction(item.id, {
        is_active: !item.is_active,
      });
      if (res.ok) {
        toast.success(item.is_active ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว");
        router.refresh();
      } else {
        toast.error(res.error ?? "เปลี่ยนสถานะไม่สำเร็จ");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteLookupAction(item.id);
      if (res.ok) {
        toast.success("✅ ลบแล้ว");
        setConfirmDel(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "ลบไม่สำเร็จ");
      }
    });
  }

  function handleCancel() {
    setEditing(false);
    setName(item.name);
    setCode(item.code ?? "");
  }

  // Edit mode
  if (editing) {
    return (
      <div className="px-4 py-2.5 bg-amber-50/40">
        <div className="flex items-center gap-2 flex-wrap">
          <Edit2 className="size-4 text-amber-600 flex-shrink-0" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={pending}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              } else if (e.key === "Escape") {
                handleCancel();
              }
            }}
            className="flex-1 min-w-[150px] h-9"
          />
          {hasCode && (
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Code"
              disabled={pending}
              className="w-32 h-9 font-mono"
            />
          )}
          <Button size="sm" onClick={handleSave} loading={pending}>
            <Save className="size-3.5" /> บันทึก
          </Button>
          <Button size="sm" variant="secondary" onClick={handleCancel} disabled={pending}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // Display mode
  const inactive = !item.is_active;
  return (
    <>
      <div className={cn(
        "px-4 py-2.5 hover:bg-accent/40 transition-colors flex items-center gap-3",
        inactive && "opacity-60",
      )}>
        {/* Sort indicator */}
        <span className="text-[10px] font-mono text-muted-foreground/60 w-6 flex-shrink-0">
          {item.sort_order > 0 ? `${item.sort_order}.` : "—"}
        </span>

        {/* Name + Code */}
        <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-foreground truncate">
            {item.name}
          </span>
          {hasCode && item.code && (
            <span className="text-[11px] font-mono text-muted-foreground">
              ({item.code})
            </span>
          )}
          {inactive && (
            <Badge variant="outline" className="text-[10px] !text-red-600 !border-red-300">
              ปิดใช้งาน
            </Badge>
          )}
        </div>

        {/* Usage count */}
        <Badge
          variant="soft"
          className={cn(
            "text-[10px]",
            item.usageCount > 0
              ? "!bg-blue-100 !text-blue-700"
              : "!bg-slate-100 !text-slate-500",
          )}
        >
          ใช้ {item.usageCount}
        </Badge>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={pending}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={item.is_active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
          >
            {item.is_active
              ? <Eye className="size-3.5" />
              : <EyeOff className="size-3.5" />
            }
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="แก้ไข"
          >
            <Edit2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDel(true)}
            disabled={pending || item.usageCount > 0}
            className={cn(
              "p-1.5 rounded transition-colors",
              item.usageCount > 0
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "text-muted-foreground hover:text-red-600 hover:bg-red-50",
            )}
            title={item.usageCount > 0
              ? `กำลังถูกใช้อยู่ ${item.usageCount} ที่ — ปิดใช้งานแทน`
              : "ลบ"}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title={`ลบ "${item.name}"?`}
        description="ลบแล้วเรียกคืนไม่ได้ — แนะนำใช้ 'ปิดใช้งาน' (eye icon) แทน"
        confirmText="ลบถาวร"
        variant="danger"
        loading={pending}
        onConfirm={handleDelete}
      />
    </>
  );
}
