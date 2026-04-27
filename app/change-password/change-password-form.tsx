"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { changePasswordAction, type ChangePasswordState } from "./actions";

export function ChangePasswordForm({ username }: { username: string }) {
  const [state, action, isPending] = useActionState<ChangePasswordState | null, FormData>(
    changePasswordAction,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="username" value={username} />

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          รหัสผ่านใหม่ *
        </label>
        <Input
          name="new_password"
          type="password"
          placeholder="อย่างน้อย 8 ตัว มีตัวอักษร + ตัวเลข"
          required
          disabled={isPending}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          ยืนยันรหัสผ่านใหม่ *
        </label>
        <Input
          name="confirm_password"
          type="password"
          placeholder="พิมพ์ซ้ำเพื่อยืนยัน"
          required
          disabled={isPending}
        />
      </div>

      <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 space-y-1">
        <div className="font-semibold text-slate-700">📋 กฎรหัสผ่าน:</div>
        <div>• ยาวอย่างน้อย 8 ตัวอักษร</div>
        <div>• มีทั้งตัวอักษร และตัวเลข</div>
        <div>• ห้ามเหมือน username</div>
        <div>• ห้ามใช้รหัสที่อ่อนแอ (admin123, password)</div>
      </div>

      {state?.error && <Alert tone="danger">❌ {state.error}</Alert>}

      <Button type="submit" fullWidth size="lg" loading={isPending}>
        🔒 {isPending ? "กำลังบันทึก..." : "ตั้งรหัสผ่านใหม่"}
      </Button>
    </form>
  );
}
