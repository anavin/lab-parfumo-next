import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/require-user";
import { getNotificationsPaginated } from "@/lib/db/users";
import { NotificationsList } from "./_components/notifications-list";
import { PageNav } from "./_components/page-nav";

export const metadata: Metadata = {
  title: "การแจ้งเตือน — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(0, parseInt(sp.page ?? "0", 10) || 0);
  const paged = await getNotificationsPaginated(user.id, { page });
  const notifs = paged.rows;

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
          {/* Stats — total counts across all pages (bell badge = true total) */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="ทั้งหมด" value={paged.total} icon="📬" />
            <StatCard
              label={page > 0 ? "ยังไม่อ่าน (ในหน้านี้)" : "ยังไม่อ่าน"}
              value={unread.length}
              icon="🔵"
              tone={unread.length > 0 ? "warning" : undefined}
            />
            <StatCard
              label={page > 0 ? "อ่านแล้ว (ในหน้านี้)" : "อ่านแล้ว"}
              value={read.length}
              icon="✓"
            />
          </div>

          <NotificationsList notifications={notifs} hasUnread={unread.length > 0} />
          <PageNav
            page={paged.page}
            pageSize={paged.pageSize}
            total={paged.total}
            hasMore={paged.hasMore}
          />
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
