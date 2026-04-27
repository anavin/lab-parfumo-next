import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types/db";
import { NotificationsList } from "./_components/notifications-list";

export const metadata: Metadata = {
  title: "การแจ้งเตือน — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

async function getNotifications(userId: string): Promise<Notification[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as Notification[];
}

export default async function NotificationsPage() {
  const user = (await getCurrentUser())!;
  const notifs = await getNotifications(user.id);

  const unread = notifs.filter((n) => !n.is_read);
  const read = notifs.filter((n) => n.is_read);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">การแจ้งเตือน</h1>
        <p className="text-sm text-slate-500">
          ติดตามกิจกรรมในระบบทั้งหมด
        </p>
      </div>

      {notifs.length === 0 ? (
        <EmptyState
          icon="🔕"
          title="ยังไม่มีการแจ้งเตือน"
          text="เมื่อมีการอัปเดตเกี่ยวกับ PO ของคุณ ระบบจะแจ้งให้ทราบที่นี่"
        />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="ทั้งหมด" value={notifs.length} icon="📬" />
            <StatCard label="ยังไม่อ่าน" value={unread.length} icon="🔵"
                      tone={unread.length > 0 ? "warning" : undefined} />
            <StatCard label="อ่านแล้ว" value={read.length} icon="✓" />
          </div>

          <NotificationsList notifications={notifs} hasUnread={unread.length > 0} />
        </>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon, tone,
}: {
  label: string;
  value: number;
  icon: string;
  tone?: "warning";
}) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className="text-xl mb-0.5">{icon}</div>
        <div className={`text-xl font-bold tabular-nums ${
          tone === "warning" && value > 0 ? "text-amber-600" : "text-slate-900"
        }`}>
          {value}
        </div>
        <div className="text-xs text-slate-500">{label}</div>
      </CardContent>
    </Card>
  );
}
