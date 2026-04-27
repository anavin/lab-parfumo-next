"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Notification } from "@/lib/types/db";
import {
  markNotificationReadAction, markAllReadAction,
} from "@/lib/actions/notifications";

type Filter = "all" | "unread" | "read";

export function NotificationsList({
  notifications, hasUnread,
}: {
  notifications: Notification[];
  hasUnread: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = notifications.filter((n) =>
    filter === "all" ? true :
    filter === "unread" ? !n.is_read :
    n.is_read,
  );

  function handleMarkAll() {
    startTransition(async () => {
      await markAllReadAction();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {/* Filter + mark all */}
      <Card>
        <CardContent className="p-3 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              ทั้งหมด
            </FilterButton>
            <FilterButton active={filter === "unread"} onClick={() => setFilter("unread")}>
              🔵 ยังไม่อ่าน
            </FilterButton>
            <FilterButton active={filter === "read"} onClick={() => setFilter("read")}>
              ✓ อ่านแล้ว
            </FilterButton>
          </div>
          {hasUnread && (
            <Button variant="secondary" size="sm" onClick={handleMarkAll} loading={pending}>
              <Check className="h-3.5 w-3.5" /> อ่านทั้งหมด
            </Button>
          )}
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-500">
            ไม่มีการแจ้งเตือนในกลุ่มนี้
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="text-sm text-slate-600">
            แสดง <strong>{filtered.length}</strong> รายการ
          </div>
          {filtered.map((n) => (
            <NotificationCard key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 h-9 rounded-lg text-xs font-semibold transition-colors",
        active
          ? "bg-brand-700 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200",
      )}
    >
      {children}
    </button>
  );
}

function NotificationCard({ notification: n }: { notification: Notification }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function handleClick() {
    if (!n.is_read) {
      startTransition(async () => {
        await markNotificationReadAction(n.id);
      });
    }
    if (n.po_id) {
      router.push(`/po/${n.po_id}`);
    }
  }

  return (
    <Card
      className={cn(
        "transition-colors cursor-pointer hover:border-brand-300",
        !n.is_read && "border-brand-300 bg-brand-50/30",
      )}
    >
      <CardContent className="p-4">
        <button
          type="button"
          onClick={handleClick}
          className="w-full text-left flex items-start gap-3"
        >
          <div className="text-base flex-shrink-0">
            {n.is_read ? "⚪" : "🔵"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-slate-900">
              {n.title}
            </div>
            {n.message && (
              <div className="text-xs text-slate-600 mt-0.5">{n.message}</div>
            )}
            <div className="text-xs text-slate-400 mt-1">
              📅 {fmtDateTime(n.created_at)}
            </div>
          </div>
          {n.po_id && (
            <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0 self-center" />
          )}
        </button>
      </CardContent>
    </Card>
  );
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("th-TH", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}
