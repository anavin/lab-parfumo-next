import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ — Lab Parfumo PO",
};

export default async function LoginPage() {
  // ถ้า login อยู่แล้ว → ส่งไป dashboard
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-3xl shadow-brand">
            📦
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Lab Parfumo</h1>
          <p className="text-sm text-slate-300 mb-2">
            Purchase Order Management System
          </p>
          <span className="inline-block bg-brand-100/20 text-brand-100 px-3 py-1 rounded-full text-xs font-semibold">
            บริษัท ทัช ไดเวอร์เจนซ์ จำกัด
          </span>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <LoginForm />
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          v0.1 — Next.js Edition
        </p>
      </div>
    </main>
  );
}
