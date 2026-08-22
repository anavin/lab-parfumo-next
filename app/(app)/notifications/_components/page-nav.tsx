"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PageNav({
  page, pageSize, total, hasMore,
}: {
  page: number; pageSize: number; total: number; hasMore: boolean;
}) {
  if (total <= pageSize) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const prev = page > 0 ? `?page=${page - 1}` : null;
  const next = hasMore ? `?page=${page + 1}` : null;
  return (
    <div className="flex items-center justify-between gap-2 pt-2 text-xs text-slate-600">
      <span>{from.toLocaleString()}–{to.toLocaleString()} / {total.toLocaleString()}</span>
      <div className="flex gap-1">
        <Button asChild={!!prev} variant="ghost" size="sm" disabled={!prev}>
          {prev ? <Link href={prev} scroll={false}>← ก่อนหน้า</Link> : <span>← ก่อนหน้า</span>}
        </Button>
        <Button asChild={!!next} variant="ghost" size="sm" disabled={!next}>
          {next ? <Link href={next} scroll={false}>ถัดไป →</Link> : <span>ถัดไป →</span>}
        </Button>
      </div>
    </div>
  );
}
