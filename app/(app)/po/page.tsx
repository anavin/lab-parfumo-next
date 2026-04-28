import type { Metadata } from "next";
import Link from "next/link";
import {
  Plus, FileText, Clock, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PoRow } from "@/components/po/po-row";
import { requireUser } from "@/lib/auth/require-user";
import {
  getPos, applyPoFilters, type PoFilters, type PoSortKey,
} from "@/lib/db/po";
import { PO_STATUSES, type PoStatus } from "@/lib/types/db";
import { FilterChips } from "./_components/filter-chips";
import { buildChipOptions } from "./_components/chip-options";
import { ListControls } from "./_components/list-controls";
import { Pagination } from "./_components/pagination";
import { SavedFilters } from "./_components/saved-filters";

export const metadata: Metadata = {
  title: "ใบสั่งซื้อ — Lab Parfumo PO",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface SearchParams {
  status?: string;
  search?: string;
  sort?: string;
  from?: string;
  to?: string;
  min?: string;
  page?: string;
}

export default async function PoListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const sp = await searchParams;

  const allPos = await getPos({ userId: user.id, role: user.role });

  // === Empty state (no POs at all) ===
  if (!allPos.length) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <EmptyState
          icon="📋"
          title="ยังไม่มีใบสั่งซื้อ"
          text="เริ่มต้นง่ายๆ — สร้างใบ PO ใหม่ ระบบจะแจ้งแอดมินอัตโนมัติ"
          action={
            <Link href="/po/new">
              <Button>
                <Plus className="h-4 w-4" />
                สร้างใบ PO ใหม่
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Compute byStatus for chip counts (BEFORE filter)
  const byStatus: Record<string, number> = {};
  for (const p of allPos) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
  const chipOptions = buildChipOptions(byStatus, allPos.length);

  // Quick KPIs for header
  const pending = (byStatus["รอจัดซื้อดำเนินการ"] ?? 0) + (byStatus["สั่งซื้อแล้ว"] ?? 0) + (byStatus["กำลังขนส่ง"] ?? 0);
  const completed = byStatus["เสร็จสมบูรณ์"] ?? 0;
  const problems = byStatus["มีปัญหา"] ?? 0;

  // Total spend (admin only)
  const totalSpend = isAdmin
    ? allPos.reduce((s, p) => {
        if (["สั่งซื้อแล้ว", "กำลังขนส่ง", "รับของแล้ว", "เสร็จสมบูรณ์"].includes(p.status)) {
          return s + (p.total ?? 0);
        }
        return s;
      }, 0)
    : 0;

  // Parse filters from URL
  const status = (sp.status && (PO_STATUSES as readonly string[]).includes(sp.status))
    ? (sp.status as PoStatus) : undefined;
  const filters: PoFilters = {
    status,
    search: sp.search,
    fromDate: sp.from,
    toDate: sp.to,
    minAmount: sp.min ? Number(sp.min) : undefined,
    sort: ((sp.sort as PoSortKey) ?? "newest"),
  };
  const filtered = applyPoFilters(allPos, filters);

  // Pagination
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const hasFilters = !!(filters.search || filters.status || filters.fromDate || filters.minAmount);

  return (
    <div className="space-y-5">
      <PageHeader />

      {/* Quick KPI cards */}
      <div className={`grid grid-cols-2 ${isAdmin ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
        <KpiCard
          label="ทั้งหมด"
          value={allPos.length}
          unit="ใบ"
          icon={FileText}
          color="primary"
          href="/po"
        />
        <KpiCard
          label="รอดำเนินการ"
          value={pending}
          unit="ใบ"
          icon={Clock}
          color="amber"
          href={"/po?status=" + encodeURIComponent("รอจัดซื้อดำเนินการ")}
        />
        <KpiCard
          label="เสร็จสมบูรณ์"
          value={completed}
          unit="ใบ"
          icon={CheckCircle2}
          color="emerald"
          href={"/po?status=" + encodeURIComponent("เสร็จสมบูรณ์")}
        />
        {isAdmin && (
          <KpiCard
            label={problems > 0 ? "มีปัญหา" : "ยอดรวม"}
            value={problems > 0 ? problems : totalSpend}
            unit={problems > 0 ? "ใบ" : "บาท"}
            icon={problems > 0 ? AlertTriangle : FileText}
            color={problems > 0 ? "red" : "primary"}
            href={problems > 0 ? "/po?status=" + encodeURIComponent("มีปัญหา") : "/reports"}
            isAmount={problems === 0}
          />
        )}
      </div>

      {/* Search + filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <ListControls
            initialSearch={sp.search}
            initialSort={(sp.sort as PoSortKey) ?? "newest"}
            initialFromDate={sp.from}
            initialToDate={sp.to}
            initialMinAmount={sp.min}
            showAdvanced={isAdmin}
          />

          <div className="border-t border-border/40 pt-3">
            <FilterChips
              active={status ?? "ทั้งหมด"}
              options={chipOptions}
            />
          </div>

          <SavedFilters />
        </CardContent>
      </Card>

      {/* Result summary */}
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="text-muted-foreground">
          พบ <strong className="text-foreground tabular-nums">{filtered.length}</strong> ใบ
          {hasFilters && (
            <span className="text-muted-foreground/60 ml-1">
              (จากทั้งหมด <span className="tabular-nums">{allPos.length}</span>)
            </span>
          )}
        </div>
        {hasFilters && (
          <Link
            href="/po"
            className="text-xs font-semibold text-primary hover:underline"
          >
            ล้าง filter
          </Link>
        )}
      </div>

      {pageItems.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="ไม่พบ PO ที่ตรงกับการค้นหา"
          text="ลองเปลี่ยนคำค้นหา / สถานะ / ช่วงวันที่ — หรือเริ่ม PO ใหม่"
          action={
            hasFilters ? (
              <Link href="/po">
                <Button variant="outline">ล้าง filter ทั้งหมด</Button>
              </Link>
            ) : (
              <Link href="/po/new">
                <Button>
                  <Plus className="h-4 w-4" /> สร้างใบ PO ใหม่
                </Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {pageItems.map((po) => (
              <PoRow key={po.id} po={po} isAdmin={isAdmin} />
            ))}
          </div>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
          />
        </>
      )}
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          ใบสั่งซื้อทั้งหมด
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          จัดการ ติดตาม และค้นหาใบสั่งซื้อทั้งหมดในระบบ
        </p>
      </div>
      <Link href="/po/new">
        <Button size="lg" className="shadow-md">
          <Plus className="h-4 w-4" />
          สร้างใบ PO ใหม่
        </Button>
      </Link>
    </div>
  );
}

const KPI_TONE: Record<string, { bg: string; text: string; ring: string; icon: string }> = {
  primary: { bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200/60", icon: "text-blue-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200/60", icon: "text-amber-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200/60", icon: "text-emerald-600" },
  red: { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200/60", icon: "text-red-600" },
};

function KpiCard({
  label, value, unit, icon: Icon, color, href, isAmount,
}: {
  label: string;
  value: number;
  unit: string;
  icon: typeof Plus;
  color: keyof typeof KPI_TONE | string;
  href: string;
  isAmount?: boolean;
}) {
  const tone = KPI_TONE[color] ?? KPI_TONE.primary;
  const formatted = isAmount
    ? value.toLocaleString("th-TH", { maximumFractionDigits: 0 })
    : value.toLocaleString("th-TH");
  return (
    <Link
      href={href}
      className="group block bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 transition-all duration-200"
    >
      <div className="flex items-center gap-3">
        <div className={`flex-shrink-0 size-10 rounded-xl flex items-center justify-center ring-1 ${tone.bg} ${tone.icon} ${tone.ring}`}>
          <Icon className="size-5" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-muted-foreground truncate">
            {label}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold tabular-nums text-foreground leading-none truncate">
              {formatted}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{unit}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
