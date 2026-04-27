import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-5 max-w-2xl">
      <Skeleton className="h-3 w-16" />
      <div>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Card><CardContent className="p-5 space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
      </CardContent></Card>

      <Card><CardContent className="p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-10 w-40" />
      </CardContent></Card>
    </div>
  );
}
