"use client";

import { useState, useTransition } from "react";
import { Bell, Mail, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { NotificationPrefs } from "@/lib/types/db";
import { updateMyPrefsAction } from "@/lib/actions/notifications";

interface PrefsRow {
  key: keyof NotificationPrefs;
  label: string;
  desc: string;
  privilegedOnly?: boolean;
}

const INAPP_ROWS: PrefsRow[] = [
  {
    key: "inapp_po_status_change",
    label: "PO ของฉันเปลี่ยนสถานะ",
    desc: "เช่น สั่งซื้อแล้ว / กำลังขนส่ง / รับของแล้ว / เสร็จสมบูรณ์",
  },
  {
    key: "inapp_po_cancelled",
    label: "PO ของฉันถูกยกเลิก",
    desc: "เมื่อมีคนยกเลิก PO ที่คุณเป็นผู้สร้าง",
  },
  {
    key: "inapp_new_po",
    label: "มี PO ใหม่เข้าระบบ",
    desc: "(เฉพาะ Admin/Supervisor) เตือนเมื่อมีคนสร้าง PO รออนุมัติ",
    privilegedOnly: true,
  },
];

const EMAIL_ROWS: PrefsRow[] = [
  {
    key: "email_po_status_change",
    label: "อีเมลเมื่อ PO ของฉันเปลี่ยนสถานะ",
    desc: "ส่งเมื่อ: สั่งซื้อแล้ว / กำลังขนส่ง / เสร็จสมบูรณ์ / ยกเลิก / มีปัญหา",
  },
  {
    key: "email_new_po",
    label: "อีเมลเมื่อมี PO ใหม่รออนุมัติ",
    desc: "(เฉพาะ Admin/Supervisor) ส่งเมื่อมี user สร้าง PO ใหม่",
    privilegedOnly: true,
  },
  {
    key: "email_daily_digest",
    label: "อีเมลสรุปประจำวัน",
    desc: "(เฉพาะ Admin/Supervisor) ทุก 8 โมงเช้า — สรุปกิจกรรมของวันก่อนหน้า",
    privilegedOnly: true,
  },
];

export function PreferencesClient({
  initial,
  isPrivileged,
}: {
  initial: NotificationPrefs;
  isPrivileged: boolean;
}) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initial);
  const [pending, start] = useTransition();
  const [dirty, setDirty] = useState(false);

  function set<K extends keyof NotificationPrefs>(k: K, v: NotificationPrefs[K]) {
    setPrefs((p) => ({ ...p, [k]: v }));
    setDirty(true);
  }

  function save() {
    start(async () => {
      const r = await updateMyPrefsAction(prefs);
      if (r.ok) {
        toast.success("บันทึกการตั้งค่าแล้ว");
        setDirty(false);
      } else {
        toast.error(r.error ?? "บันทึกไม่สำเร็จ");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* In-app notifications */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4 text-primary" />
            การแจ้งเตือนในระบบ (Bell icon)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          {INAPP_ROWS.filter((r) => !r.privilegedOnly || isPrivileged).map((row) => (
            <PrefRow
              key={row.key}
              row={row}
              checked={prefs[row.key]}
              onChange={(v) => set(row.key, v)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Email notifications — ทุก user เห็น (มี email_po_status_change) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4 text-primary" />
            อีเมล
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          {EMAIL_ROWS.filter((r) => !r.privilegedOnly || isPrivileged).map((row) => (
            <PrefRow
              key={row.key}
              row={row}
              checked={prefs[row.key]}
              onChange={(v) => set(row.key, v)}
            />
          ))}
          <p className="text-xs text-muted-foreground pt-3 px-1">
            ⓘ การส่งอีเมลทำงานเมื่อ admin ตั้งค่า SMTP ใน /settings → Email และ user มี email ในบัญชีเท่านั้น
          </p>
        </CardContent>
      </Card>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm py-3 -mx-4 px-4 border-t border-border/40 flex justify-end">
        <Button onClick={save} disabled={!dirty || pending} size="sm">
          <Save className="size-4 mr-2" />
          {pending ? "กำลังบันทึก..." : "บันทึก"}
        </Button>
      </div>
    </div>
  );
}

function PrefRow({
  row,
  checked,
  onChange,
}: {
  row: PrefsRow;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 px-1 cursor-pointer hover:bg-accent/30 rounded-md -mx-1 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{row.label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{row.desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </label>
  );
}
