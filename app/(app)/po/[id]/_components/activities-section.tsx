/**
 * PoActivitiesSection — async server component, streams via Suspense
 */
import { Card, CardContent } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { getPoActivities } from "@/lib/db/po";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export async function PoActivitiesSection({ poId }: { poId: string }) {
  const activities = await getPoActivities(poId);
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
          <Activity className="h-4 w-4" />
          ประวัติกิจกรรม ({activities.length})
        </h2>
        {activities.length === 0 ? (
          <div className="text-sm text-slate-400 italic">ยังไม่มีกิจกรรม</div>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {activities.map((a) => (
              <li key={a.id} className="flex gap-2 text-slate-600">
                <span className="text-slate-400 text-xs flex-shrink-0">
                  {fmtDateTime(a.created_at)}
                </span>
                <span>—</span>
                <span className="font-semibold text-slate-700">
                  {a.user_role === "admin" ? "👑" : a.user_role === "supervisor" ? "🛡️" : "👤"} {a.user_name ?? "—"}:
                </span>
                <span>{a.description ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function PoActivitiesSectionSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="h-5 w-40 bg-muted/50 rounded animate-pulse mb-3" />
        <ul className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex gap-2">
              <span className="h-3 w-24 bg-muted/50 rounded animate-pulse" />
              <span className="h-3 w-full bg-muted/40 rounded animate-pulse" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
