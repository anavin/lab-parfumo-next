import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PoRow } from "@/components/po/po-row";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getPos, applyPoFilters, type PoFilters, type PoSortKey,
} from "@/lib/db/po";
import { PO_STATUSES, type PoStatus } from "@/lib/types/db";
import { FilterChips } from "./_components/filter-chips";
import { buildChipOptions } from "./_components/chip-options";
import { ListControls } from "./_components/list-controls";
import { Pagination } from "./_components/pagination";

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
  const user = (await getCurrentUser())!;
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

  return (
    <div className="space-y-5">
      <PageHeader subtitle={`${allPos.length} ใบ • อัปเดตล่าสุด เพิ่งอัปเดต`} />

      <ListControls
        initialSearch={sp.search}
        initialSort={(sp.sort as PoSortKey) ?? "newest"}
        initialFromDate={sp.from}
        initialToDate={sp.to}
        initialMinAmount={sp.min}
        showAdvanced={isAdmin}
      />

      <FilterChips
        active={status ?? "ทั้งหมด"}
        options={chipOptions}
      />

      <div className="text-sm text-slate-600">
        พบ <strong>{filtered.length}</strong> ใบ
        {(filters.search || filters.status || filters.fromDate || filters.minAmount) && (
          <span className="text-slate-400 ml-1">(จากทั้งหมด {allPos.length})</span>
        )}
      </div>

      {pageItems.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="ไม่พบ PO ที่ตรงกับการค้นหา"
          text="ลองเปลี่ยนคำค้นหา / สถานะ / ช่วงวันที่"
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

function PageHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ใบสั่งซื้อทั้งหมด</h1>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <Link href="/po/new">
        <Button>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">สร้างใหม่</span>
        </Button>
      </Link>
    </div>
  );
}
