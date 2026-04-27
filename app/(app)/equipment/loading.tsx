import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-3 w-16" />
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Filter row */}
      <Card><CardContent className="p-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <Skeleton className="h-10 sm:col-span-2" />
          <Skeleton className="h-10" />
        </div>
      </CardContent></Card>

      {/* Equipment grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i}><CardContent className="p-3 space-y-2">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
