import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = {
  title: "เปลี่ยนรหัสผ่าน — Lab Parfumo PO",
};

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // ถ้าไม่ได้ถูกบังคับเปลี่ยน → ไป dashboard
  if (!user.must_change_password) redirect("/dashboard");

  const initial = (user.full_name || "U")[0].toUpperCase();

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-md">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            เปลี่ยนรหัสผ่าน
          </h1>
          <p className="text-sm text-slate-500">
            จำเป็นต้องตั้งรหัสใหม่ก่อนเริ่มใช้งาน
          </p>
        </div>

        {/* User info banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-600 text-white font-bold flex items-center justify-center text-sm">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900">
              {user.full_name}
            </div>
            <div className="text-xs text-amber-800">
              👤 @{user.username} • บัญชีนี้ใช้งานครั้งแรก
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <ChangePasswordForm username={user.username} />
        </div>
      </div>
    </main>
  );
}
