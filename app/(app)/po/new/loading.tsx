import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-3 w-16" />
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Search row */}
      <Card><CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="grid sm:grid-cols-3 gap-2">
          <Skeleton className="h-11 sm:col-span-2" />
          <Skeleton className="h-11" />
        </div>
        <Skeleton className="h-3 w-48" />
      </CardContent></Card>

      {/* Equipment grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}><CardContent className="p-3 space-y-2">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-9 w-full mt-2" />
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
