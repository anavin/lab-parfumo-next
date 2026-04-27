import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-3 w-16" />
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Filters */}
      <Card><CardContent className="p-4">
        <div className="grid sm:grid-cols-4 gap-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </CardContent></Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-24" />
          </CardContent></Card>
        ))}
      </div>

      {/* Chart */}
      <Card><CardContent className="p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-72 w-full" />
      </CardContent></Card>

      {/* Chart 2 */}
      <Card><CardContent className="p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-64 w-full" />
      </CardContent></Card>
    </div>
  );
}
