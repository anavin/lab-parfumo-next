"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

const ReportsClientLazy = dynamic(
  () => import("./reports-client").then((m) => m.ReportsClient),
  {
    loading: () => (
      <div className="space-y-5">
        <Card><CardContent className="p-4">
          <div className="grid sm:grid-cols-4 gap-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </CardContent></Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
            </CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-72 w-full" />
        </CardContent></Card>
      </div>
    ),
    ssr: false,
  },
);

export { ReportsClientLazy as ReportsClient };
