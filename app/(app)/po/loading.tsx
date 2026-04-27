import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Filter row */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Skeleton className="h-10 md:col-span-2" />
            <Skeleton className="h-10" />
          </div>
        </CardContent>
      </Card>

      {/* Filter chips */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>

      {/* PO rows */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="grid grid-cols-12 gap-3 items-center">
                <Skeleton className="col-span-2 h-5" />
                <div className="col-span-4 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="col-span-2 h-6 rounded-full" />
                <Skeleton className="col-span-2 h-5" />
                <Skeleton className="col-span-2 h-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
