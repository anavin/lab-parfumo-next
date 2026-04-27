"use client";

import { useActionState } from "react";
import { Lock, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginAction, type LoginActionState } from "./actions";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState<
    LoginActionState | null,
    FormData
  >(loginAction, null);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="username" className="text-slate-700">
          ชื่อผู้ใช้
        </Label>
        <div className="relative group">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            id="username"
            name="username"
            type="text"
            placeholder="username"
            required
            autoComplete="username"
            className="pl-10 h-11"
            disabled={isPending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-slate-700">
          รหัสผ่าน
        </Label>
        <div className="relative group">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="pl-10 h-11"
            disabled={isPending}
          />
        </div>
      </div>

      {state?.error && (
        <Alert tone="danger">
          <AlertDescription>
            {state.error}
            {state.attemptsRemaining !== undefined && state.attemptsRemaining > 0 && (
              <div className="text-xs mt-1.5 font-semibold opacity-80">
                เหลือโอกาส {state.attemptsRemaining} ครั้ง
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={isPending}
        className="group"
      >
        {isPending ? "กำลังเข้าสู่ระบบ..." : (
          <>
            เข้าสู่ระบบ
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </Button>
    </form>
  );
}
