"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page, totalPages, totalItems, pageSize,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();

  function go(p: number) {
    const usp = new URLSearchParams(params);
    if (p === 1) usp.delete("page");
    else usp.set("page", String(p));
    router.push(`${pathname}?${usp.toString()}`);
  }

  if (totalPages <= 1) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="hidden sm:block text-sm text-slate-600">
        แสดง <span className="font-semibold">{start}-{end}</span> จาก{" "}
        <span className="font-semibold">{totalItems}</span> • หน้า{" "}
        <span className="font-semibold">{page}/{totalPages}</span>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 ml-auto">
        <Button
          size="sm"
          variant="secondary"
          disabled={page === 1}
          onClick={() => go(1)}
          aria-label="หน้าแรก"
          className="!h-9 !px-2"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page === 1}
          onClick={() => go(page - 1)}
          aria-label="หน้าก่อน"
          className="!h-9 !px-2"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="sm:hidden text-sm font-semibold text-slate-700">
          {page}/{totalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page === totalPages}
          onClick={() => go(page + 1)}
          aria-label="หน้าถัดไป"
          className="!h-9 !px-2"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page === totalPages}
          onClick={() => go(totalPages)}
          aria-label="หน้าสุดท้าย"
          className="!h-9 !px-2"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
