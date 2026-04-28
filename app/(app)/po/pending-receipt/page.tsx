import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Calendar, Clock, PackageOpen, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { requireUser } from "@/lib/auth/require-user";
import { getPosPendingReceipt, bucketByUrgency } from "@/lib/db/po";
import type { PurchaseOrder } from "@/lib/types/db";

export const metadata: Metadata = {
  title: "รอรับของ — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function PendingReceiptPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  // staff เห็นเฉพาะของตัวเอง? ไม่ — รอรับของเป็นของทุกคน (เห็นได้ทั้งทีม)
  // แต่ถ้า requester แสดงเฉพาะของตัวเอง อาจจะดีกว่า — ให้ดูทุกใบเหมือน Streamlit เดิม
  const pos = await getPosPendingReceipt();

  if (pos.length === 0) {
    return (
      <div className="space-y-5">
        <Header total={0} />
        <EmptyState
          icon="🎉"
          title="ไม่มี PO รอรับของ"
          text={"ทุกอย่างเสร็จเรียบร้อยแล้ว!\nถ้ามี PO ใหม่ที่กำลังขนส่ง จะปรากฏที่นี่"}
        />
      </div>
    );
  }

  const buckets = bucketByUrgency(pos);

  return (
    <div className="space-y-5">
      <Header total={pos.length} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="เลยกำหนด" count={buckets.overdue.length}
                 icon={<AlertTriangle className="h-5 w-5" />} tone="danger" />
        <KpiCard label="วันนี้" count={buckets.today.length}
                 icon={<Calendar className="h-5 w-5" />} tone="warning" />
        <KpiCard label="ใน 3 วัน" count={buckets.upcoming.length}
                 icon={<Clock className="h-5 w-5" />} tone="warning" />
        <KpiCard label="ทั้งหมด" count={pos.length}
                 icon={<PackageOpen className="h-5 w-5" />} />
      </div>

      {/* Sections by urgency */}
      {buckets.overdue.length > 0 && (
        <Section title="🚨 เลยกำหนด" count={buckets.overdue.length} accent="danger">
          {buckets.overdue.map((po) => (
            <PendingCard key={po.id} po={po} bucket="overdue" isAdmin={isAdmin} />
          ))}
        </Section>
      )}
      {buckets.today.length > 0 && (
        <Section title="📅 ครบกำหนดวันนี้" count={buckets.today.length} accent="warning">
          {buckets.today.map((po) => (
            <PendingCard key={po.id} po={po} bucket="today" isAdmin={isAdmin} />
          ))}
        </Section>
      )}
      {buckets.upcoming.length > 0 && (
        <Section title="⏰ ใน 3 วัน" count={buckets.upcoming.length} accent="warning">
          {buckets.upcoming.map((po) => (
            <PendingCard key={po.id} po={po} bucket="upcoming" isAdmin={isAdmin} />
          ))}
        </Section>
      )}
      {buckets.later.length > 0 && (
        <Section title="📦 มากกว่า 3 วัน" count={buckets.later.length}>
          {buckets.later.map((po) => (
            <PendingCard key={po.id} po={po} bucket="later" isAdmin={isAdmin} />
          ))}
        </Section>
      )}
      {buckets.noDate.length > 0 && (
        <Section title="❓ ไม่ระบุวันที่" count={buckets.noDate.length}>
          {buckets.noDate.map((po) => (
            <PendingCard key={po.id} po={po} bucket="noDate" isAdmin={isAdmin} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Header({ total }: { total: number }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">รอรับของ</h1>
      <p className="text-sm text-slate-500">
        {total} ใบที่กำลังจะมาถึง • ตรวจรับเมื่อของถึง
      </p>
    </div>
  );
}

function KpiCard({
  label, count, icon, tone,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  tone?: "danger" | "warning" | "success";
}) {
  const toneCls = {
    danger: count > 0 ? "text-red-600 bg-red-50" : "text-slate-500 bg-slate-50",
    warning: count > 0 ? "text-amber-600 bg-amber-50" : "text-slate-500 bg-slate-50",
    success: "text-emerald-600 bg-emerald-50",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            tone ? toneCls[tone] : "text-brand-700 bg-brand-50"
          }`}>
            {icon}
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 leading-none">{count}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title, count, accent, children,
}: {
  title: string;
  count: number;
  accent?: "danger" | "warning";
  children: React.ReactNode;
}) {
  const accentCls = accent === "danger" ? "text-red-700"
    : accent === "warning" ? "text-amber-700"
      : "text-slate-700";
  return (
    <section>
      <h2 className={`text-sm font-bold uppercase tracking-wider mb-2 ${accentCls}`}>
        {title} <span className="text-slate-400">({count})</span>
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

type Bucket = "overdue" | "today" | "upcoming" | "later" | "noDate";

function PendingCard({
  po, bucket, isAdmin,
}: {
  po: PurchaseOrder;
  bucket: Bucket;
  isAdmin: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const itemsCount = po.items?.length ?? 0;
  const itemsPreview = (po.items ?? [])
    .slice(0, 3)
    .map((it) => `${it.name} × ${(it.qty ?? 0).toLocaleString("th-TH")}`)
    .join(", ");
  const moreItems = itemsCount > 3 ? ` และอีก ${itemsCount - 3} รายการ` : "";

  // Badge text
  let badge: { text: string; cls: string } | null = null;
  if (po.expected_date) {
    if (bucket === "overdue") {
      const days = Math.floor((new Date(today).getTime() - new Date(po.expected_date).getTime()) / 86400_000);
      badge = { text: `🚨 เลย ${days} วัน`, cls: "bg-red-50 text-red-700 border-red-200" };
    } else if (bucket === "today") {
      badge = { text: "📅 วันนี้", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    } else if (bucket === "upcoming") {
      const days = Math.ceil((new Date(po.expected_date).getTime() - new Date(today).getTime()) / 86400_000);
      badge = { text: `⏰ อีก ${days} วัน`, cls: "bg-amber-50 text-amber-700 border-amber-200" };
    } else if (bucket === "later") {
      const days = Math.ceil((new Date(po.expected_date).getTime() - new Date(today).getTime()) / 86400_000);
      badge = { text: `📅 อีก ${days} วัน`, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid sm:grid-cols-12 gap-3">
          {/* Left: identity */}
          <div className="sm:col-span-3 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold font-mono text-brand-700">{po.po_number}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusPill status={po.status} />
              {badge && (
                <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${badge.cls}`}>
                  {badge.text}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">
              📅 สั่ง: {fmtDate(po.ordered_date)}
            </div>
            {po.expected_date && (
              <div className="text-xs text-slate-500">
                🎯 คาด: {fmtDate(po.expected_date)}
              </div>
            )}
          </div>

          {/* Middle: details */}
          <div className="sm:col-span-6 min-w-0 text-sm">
            {isAdmin && po.supplier_name && (
              <div className="font-semibold text-slate-900 truncate">
                <Truck className="inline h-3.5 w-3.5 mr-1" />
                {po.supplier_name}
              </div>
            )}
            {po.tracking_number && (
              <div className="text-xs text-slate-500 mt-0.5">
                📋 Tracking: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{po.tracking_number}</code>
              </div>
            )}
            {itemsPreview && (
              <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                📦 {itemsPreview}{moreItems}
              </div>
            )}
            <div className="text-xs text-slate-500 mt-1">
              👤 ผู้สั่ง: {po.created_by_name ?? "—"}
            </div>
          </div>

          {/* Right: actions */}
          <div className="sm:col-span-3 flex sm:flex-col gap-2 justify-end">
            <Link href={`/po/${po.id}`} className="flex-1 sm:flex-none">
              <Button variant="primary" size="sm" fullWidth>
                <PackageOpen className="h-3.5 w-3.5" /> รับของ
              </Button>
            </Link>
            <Link href={`/po/${po.id}`} className="flex-1 sm:flex-none">
              <Button variant="secondary" size="sm" fullWidth>
                👁️ ดูรายละเอียด
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return String(d);
  }
}
