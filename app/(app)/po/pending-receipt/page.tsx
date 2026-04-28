import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle, Calendar, Clock, PackageOpen, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/require-user";
import { getPosPendingReceipt, bucketByUrgency } from "@/lib/db/po";
import { PendingRow } from "./_components/pending-row";

export const metadata: Metadata = {
  title: "รอรับของ — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

export default async function PendingReceiptPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const pos = await getPosPendingReceipt();

  if (pos.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader />
        <EmptyState
          icon="🎉"
          title="ไม่มี PO รอรับของ"
          text={"ทุกอย่างเสร็จเรียบร้อยแล้ว!\nถ้ามี PO ใหม่ที่กำลังขนส่ง จะปรากฏที่นี่"}
          action={
            <Link href="/po">
              <Button variant="outline">
                <ArrowLeft className="size-4" /> ดู PO ทั้งหมด
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const buckets = bucketByUrgency(pos);

  return (
    <div className="space-y-5">
      <PageHeader />

      {/* KPI cards (consistent with /po list) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="เลยกำหนด"
          subtitle="เลยวันคาดได้รับ"
          value={buckets.overdue.length}
          unit="ใบ"
          icon={AlertTriangle}
          color={buckets.overdue.length > 0 ? "red" : "slate"}
        />
        <KpiCard
          label="วันนี้"
          subtitle="ครบกำหนดวันนี้"
          value={buckets.today.length}
          unit="ใบ"
          icon={Calendar}
          color={buckets.today.length > 0 ? "amber" : "slate"}
        />
        <KpiCard
          label="อีก 1-3 วัน"
          subtitle="ใกล้ครบกำหนด"
          value={buckets.upcoming.length}
          unit="ใบ"
          icon={Clock}
          color={buckets.upcoming.length > 0 ? "amber" : "slate"}
        />
        <KpiCard
          label="ทั้งหมด"
          subtitle="กำลังขนส่ง + รอรับ"
          value={pos.length}
          unit="ใบ"
          icon={PackageOpen}
          color="primary"
        />
      </div>

      {/* Result summary */}
      <div className="text-sm text-muted-foreground">
        พบ <strong className="text-foreground tabular-nums">{pos.length}</strong> ใบรอรับของ —
        เรียงตามความเร่งด่วน
      </div>

      {/* Sections by urgency — using PoRow for consistency */}
      {buckets.overdue.length > 0 && (
        <Section
          title="🚨 เลยกำหนด"
          subtitle="ติดตาม supplier โดยด่วน"
          count={buckets.overdue.length}
          accent="danger"
        >
          {buckets.overdue.map((po) => (
            <PendingRow key={po.id} po={po} isAdmin={isAdmin} />
          ))}
        </Section>
      )}
      {buckets.today.length > 0 && (
        <Section
          title="📅 ครบกำหนดวันนี้"
          subtitle="คาดว่าจะได้รับวันนี้"
          count={buckets.today.length}
          accent="warning"
        >
          {buckets.today.map((po) => (
            <PendingRow key={po.id} po={po} isAdmin={isAdmin} />
          ))}
        </Section>
      )}
      {buckets.upcoming.length > 0 && (
        <Section
          title="⏰ ใกล้ครบกำหนด"
          subtitle="ภายใน 3 วัน"
          count={buckets.upcoming.length}
          accent="warning"
        >
          {buckets.upcoming.map((po) => (
            <PendingRow key={po.id} po={po} isAdmin={isAdmin} />
          ))}
        </Section>
      )}
      {buckets.later.length > 0 && (
        <Section
          title="📦 ยังไม่ใกล้ครบกำหนด"
          subtitle="มากกว่า 3 วัน"
          count={buckets.later.length}
        >
          {buckets.later.map((po) => (
            <PendingRow key={po.id} po={po} isAdmin={isAdmin} />
          ))}
        </Section>
      )}
      {buckets.noDate.length > 0 && (
        <Section
          title="❓ ไม่ระบุกำหนด"
          subtitle="ยังไม่กรอกวันที่คาดว่าจะได้รับ"
          count={buckets.noDate.length}
        >
          {buckets.noDate.map((po) => (
            <PendingRow key={po.id} po={po} isAdmin={isAdmin} />
          ))}
        </Section>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          รอรับของ
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          ติดตามใบสั่งซื้อที่กำลังจะมาถึง — เรียงตามความเร่งด่วน
        </p>
      </div>
      <Link href="/po">
        <Button variant="outline" size="sm">
          <ArrowLeft className="size-4" /> PO ทั้งหมด
        </Button>
      </Link>
    </div>
  );
}

const KPI_TONE: Record<string, { bg: string; ring: string; icon: string }> = {
  primary: { bg: "bg-blue-50", ring: "ring-blue-200/60", icon: "text-blue-600" },
  amber:   { bg: "bg-amber-50", ring: "ring-amber-200/60", icon: "text-amber-600" },
  red:     { bg: "bg-red-50", ring: "ring-red-200/60", icon: "text-red-600" },
  emerald: { bg: "bg-emerald-50", ring: "ring-emerald-200/60", icon: "text-emerald-600" },
  slate:   { bg: "bg-muted", ring: "ring-border", icon: "text-muted-foreground" },
};

function KpiCard({
  label, subtitle, value, unit, icon: Icon, color,
}: {
  label: string;
  subtitle?: string;
  value: number;
  unit: string;
  icon: typeof AlertTriangle;
  color: keyof typeof KPI_TONE;
}) {
  const tone = KPI_TONE[color];
  return (
    <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 transition-all duration-200">
      <div className="flex items-center gap-3">
        <div
          className={`flex-shrink-0 size-10 rounded-xl flex items-center justify-center ring-1 ${tone.bg} ${tone.icon} ${tone.ring}`}
        >
          <Icon className="size-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-muted-foreground">
            {label}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold tabular-nums text-foreground leading-none">
              {value.toLocaleString("th-TH")}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{unit}</span>
          </div>
          {subtitle && (
            <div className="text-[10px] text-muted-foreground/80 mt-0.5 truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title, subtitle, count, accent, children,
}: {
  title: string;
  subtitle?: string;
  count: number;
  accent?: "danger" | "warning";
  children: React.ReactNode;
}) {
  const accentColor =
    accent === "danger" ? "text-red-700" :
    accent === "warning" ? "text-amber-700" :
    "text-muted-foreground";
  const badgeBg =
    accent === "danger" ? "bg-red-100 text-red-700 ring-red-200" :
    accent === "warning" ? "bg-amber-100 text-amber-700 ring-amber-200" :
    "bg-muted text-muted-foreground ring-border";

  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className={`text-sm font-bold ${accentColor}`}>{title}</h2>
          <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ring-1 tabular-nums ${badgeBg}`}>
            {count}
          </span>
        </div>
        {subtitle && (
          <span className="text-[11px] text-muted-foreground">{subtitle}</span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
