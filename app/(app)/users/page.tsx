import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { User } from "@/lib/types/db";
import { UsersClient } from "./_components/users-client";

export const metadata: Metadata = {
  title: "ผู้ใช้ — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

async function getAllUsers(): Promise<User[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("users")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  return (data ?? []) as User[];
}

export default async function UsersPage() {
  const me = (await getCurrentUser())!;
  if (me.role !== "admin") redirect("/dashboard");

  const users = await getAllUsers();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">จัดการผู้ใช้</h1>
        <p className="text-sm text-slate-500">
          เพิ่ม / แก้ไข / รีเซ็ตรหัสผ่าน user ทั้งหมด
        </p>
      </div>
      <UsersClient users={users} myId={me.id} />
    </div>
  );
}
