import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-7">
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* KPI hero */}
      <Skeleton className="h-44 w-full rounded-2xl" />

      {/* Quick actions */}
      <div className="flex gap-2.5">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Action items + insights */}
      <div className="grid lg:grid-cols-5 gap-5">
        <Card className="lg:col-span-3">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="size-10 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="lg:col-span-2 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-40" />
            </CardContent></Card>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-5 gap-5">
        <Card className="lg:col-span-3"><CardContent className="p-5">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent></Card>
        <Card className="lg:col-span-2"><CardContent className="p-5">
          <Skeleton className="h-4 w-40 mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent></Card>
      </div>
    </div>
  );
}
