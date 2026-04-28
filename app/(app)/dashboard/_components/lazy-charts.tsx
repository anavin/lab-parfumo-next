"use client";

/**
 * Lazy chart wrappers — defer recharts (~50KB) until chart is in view.
 * Falls back to a skeleton during JS chunk load.
 */
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const TrendChartLazy = dynamic(
  () => import("./trend-chart").then((m) => m.TrendChart),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false,
  },
);

const SuppliersChartLazy = dynamic(
  () => import("./suppliers-chart").then((m) => m.SuppliersChart),
  {
    loading: () => <Skeleton className="h-64 w-full" />,
    ssr: false,
  },
);

export { TrendChartLazy as TrendChart, SuppliersChartLazy as SuppliersChart };
