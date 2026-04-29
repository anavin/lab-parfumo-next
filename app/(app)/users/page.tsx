import type { Metadata } from "next";
import { requirePrivileged } from "@/lib/auth/require-user";
import { getActiveUsers } from "@/lib/db/users";
import { UsersClient } from "./_components/users-client";

export const metadata: Metadata = {
  title: "ผู้ใช้ — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requirePrivileged();
  const users = await getActiveUsers();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">จัดการผู้ใช้</h1>
        <p className="text-sm text-slate-500">
          เพิ่ม / แก้ไข / รีเซ็ตรหัสผ่าน user ทั้งหมด
        </p>
      </div>
      <UsersClient users={users} myId={me.id} myRole={me.role} />
    </div>
  );
}
