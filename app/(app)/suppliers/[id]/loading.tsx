import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-3 w-20" />

      {/* Header */}
      <Card><CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Skeleton className="size-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
      </CardContent></Card>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4 flex items-center gap-3">
            <Skeleton className="size-11 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-12" />
            </div>
          </CardContent></Card>
        ))}
      </div>

      {/* Two column */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-5 space-y-2">
          <Skeleton className="h-4 w-32 mb-3" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent></Card>
      </div>
    </div>
  );
}
