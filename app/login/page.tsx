import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ — Lab Parfumo PO",
};

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-slate-950 via-brand-950 to-slate-900">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 size-96 rounded-full bg-brand-600/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 size-96 rounded-full bg-brand-500/20 blur-3xl animate-pulse"
             style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-brand-700/10 blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex relative mb-5">
            <div className="absolute inset-0 bg-brand-500/40 rounded-2xl blur-xl" />
            <div className="relative size-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-brand-lg">
              <Package className="size-8 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1.5 tracking-tight">
            Lab Parfumo
          </h1>
          <p className="text-sm text-slate-400 mb-3">
            Purchase Order Management System
          </p>
          <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 backdrop-blur text-slate-200 px-3 py-1 rounded-full text-[11px] font-medium">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            บริษัท ทัช ไดเวอร์เจนซ์ จำกัด
          </span>
        </div>

        {/* Form Card — glass morphism */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 rounded-2xl blur-sm" />
          <div className="relative bg-white/[0.95] backdrop-blur-xl rounded-2xl p-7 shadow-2xl border border-white/20">
            <LoginForm />
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-500 mt-6 tracking-wide">
          v1.0 · Powered by Next.js + Supabase
        </p>
      </div>
    </main>
  );
}
