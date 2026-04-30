"use client";

import { useState, useTransition } from "react";
import { Plus, Edit2, Building2, Phone, CreditCard, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { SUPPLIER_CATEGORIES, type Supplier } from "@/lib/types/db";
import {
  createSupplierAction, updateSupplierAction,
} from "@/lib/actions/suppliers";

interface FormState {
  name: string;
  code: string;
  tax_id: string;
  category: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  bank_name: string;
  bank_account: string;
  payment_terms: string;
  notes: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  code: "",
  tax_id: "",
  category: SUPPLIER_CATEGORIES[0],
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  bank_name: "",
  bank_account: "",
  payment_terms: "",
  notes: "",
  is_active: true,
};

function fromSupplier(s: Supplier): FormState {
  return {
    name: s.name,
    code: s.code ?? "",
    tax_id: s.tax_id ?? "",
    category: s.category,
    contact_person: s.contact_person,
    phone: s.phone,
    email: s.email,
    address: s.address,
    bank_name: s.bank_name,
    bank_account: s.bank_account,
    payment_terms: s.payment_terms,
    notes: s.notes,
    is_active: s.is_active,
  };
}

export function SupplierDialog({
  mode, supplier, onClose, onSaved,
}: {
  mode: "create" | "edit";
  supplier?: Supplier;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(
    mode === "edit" && supplier ? fromSupplier(supplier) : EMPTY_FORM,
  );

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((cur) => ({ ...cur, [k]: v }));
  }

  function handleSubmit() {
    setError(null);
    if (!form.name.trim()) {
      setError("กรุณากรอกชื่อ Supplier");
      return;
    }
    startTransition(async () => {
      const res = mode === "create"
        ? await createSupplierAction(form)
        : await updateSupplierAction(supplier!.id, form);

      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      toast.success(
        mode === "create"
          ? `✅ เพิ่ม ${form.name} สำเร็จ`
          : `✅ บันทึก ${form.name} แล้ว`,
      );
      onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              {mode === "create"
                ? <Plus className="size-4" strokeWidth={2.5} />
                : <Edit2 className="size-4" strokeWidth={2.5} />
              }
            </span>
            {mode === "create" ? "เพิ่ม Supplier ใหม่" : `แก้ไข ${supplier?.name}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Section: Basic info */}
          <Section icon={Building2} title="ข้อมูลพื้นฐาน">
            <div>
              <Label required>ชื่อ Supplier</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="เช่น ABC Company Co., Ltd."
                disabled={pending}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>รหัสภายใน</Label>
                <Input
                  value={form.code}
                  onChange={(e) => set("code", e.target.value)}
                  placeholder="S001"
                  disabled={pending}
                />
              </div>
              <div>
                <Label>เลขผู้เสียภาษี</Label>
                <Input
                  value={form.tax_id}
                  onChange={(e) => set("tax_id", e.target.value)}
                  placeholder="0-1055-12345-67-8"
                  disabled={pending}
                />
              </div>
            </div>
            <div>
              <Label>หมวดหมู่</Label>
              <select
                className="h-10 w-full px-3 rounded-lg border border-input bg-background text-sm"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                disabled={pending}
              >
                <option value="">— ไม่ระบุ —</option>
                {SUPPLIER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </Section>

          {/* Section: Contact */}
          <Section icon={Phone} title="ข้อมูลติดต่อ">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ผู้ติดต่อ</Label>
                <Input
                  value={form.contact_person}
                  onChange={(e) => set("contact_person", e.target.value)}
                  placeholder="คุณสมชาย ใจดี"
                  disabled={pending}
                />
              </div>
              <div>
                <Label>โทรศัพท์</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="02-xxx-xxxx / 081-xxx-xxxx"
                  disabled={pending}
                />
              </div>
            </div>
            <div>
              <Label>อีเมล</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="contact@company.com"
                disabled={pending}
              />
            </div>
            <div>
              <Label>ที่อยู่</Label>
              <textarea
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="123 ถนน ... แขวง ... เขต ... จังหวัด รหัสไปรษณีย์"
                rows={2}
                disabled={pending}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:border-primary disabled:bg-muted"
              />
            </div>
          </Section>

          {/* Section: Payment */}
          <Section icon={CreditCard} title="ข้อมูลชำระเงิน (ใช้ใน PDF/ใบโอน)">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ธนาคาร</Label>
                <Input
                  value={form.bank_name}
                  onChange={(e) => set("bank_name", e.target.value)}
                  placeholder="กรุงเทพ / ไทยพาณิชย์ / กสิกรไทย"
                  disabled={pending}
                />
              </div>
              <div>
                <Label>เลขบัญชี</Label>
                <Input
                  value={form.bank_account}
                  onChange={(e) => set("bank_account", e.target.value)}
                  placeholder="123-4-56789-0"
                  disabled={pending}
                />
              </div>
            </div>
            <div>
              <Label>เครดิตเทอม</Label>
              <Input
                value={form.payment_terms}
                onChange={(e) => set("payment_terms", e.target.value)}
                placeholder="30 วันหลังรับของ / โอนทันที"
                disabled={pending}
              />
            </div>
          </Section>

          {/* Section: Notes + status */}
          <Section icon={FileText} title="เพิ่มเติม">
            <div>
              <Label>หมายเหตุภายใน</Label>
              <textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="ส่งของรวดเร็ว / มี promo ทุกไตรมาส"
                rows={3}
                disabled={pending}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:border-primary disabled:bg-muted"
              />
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => set("is_active", e.target.checked)}
                disabled={pending}
                className="h-4 w-4 rounded border-input text-primary"
              />
              <span className="text-sm">
                <strong>Active</strong> — ปรากฏใน dropdown ตอนสั่ง PO
              </span>
            </label>
          </Section>

          {error && <Alert tone="danger">❌ {error}</Alert>}
        </div>

        <div className="flex gap-2 justify-end pt-3 border-t border-border">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Button>
          <Button onClick={handleSubmit} loading={pending}>
            {mode === "create" ? "✅ เพิ่ม Supplier" : "✅ บันทึก"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
      <h3 className="text-sm font-bold text-foreground inline-flex items-center gap-1.5">
        <Icon className="size-4 text-primary" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-bold text-foreground mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}
