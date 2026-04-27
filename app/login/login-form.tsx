"use client";

import { useActionState } from "react";
import { Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { loginAction, type LoginActionState } from "./actions";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<LoginActionState | null, FormData>(
    loginAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
          ชื่อผู้ใช้
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="username"
            required
            autoComplete="username"
            className="pl-10"
            disabled={isPending}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
          รหัสผ่าน
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="pl-10"
            disabled={isPending}
          />
        </div>
      </div>

      {state?.error && (
        <Alert tone="danger">
          ❌ {state.error}
          {state.attemptsRemaining !== undefined && state.attemptsRemaining > 0 && (
            <div className="text-xs mt-1 font-medium">
              เหลือโอกาส {state.attemptsRemaining} ครั้ง
            </div>
          )}
        </Alert>
      )}

      <Button type="submit" fullWidth size="lg" loading={isPending}>
        🔒 {isPending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}
