/**
 * PoCommentsSection — async server component, streams via Suspense
 *
 * Fetches comments independently of the main PO query so the rest of
 * the page can paint before activities/comments resolve.
 */
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { getPoComments } from "@/lib/db/po";
import { CommentForm } from "./comment-form";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export async function PoCommentsSection({ poId }: { poId: string }) {
  const comments = await getPoComments(poId);
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          ความคิดเห็น ({comments.length})
        </h2>
        {comments.length === 0 ? (
          <div className="text-sm text-slate-400 italic">ยังไม่มีความคิดเห็น</div>
        ) : (
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-slate-900">
                    {c.user_role === "admin" ? "👑" : c.user_role === "supervisor" ? "🛡️" : "👤"} {c.user_name}
                  </span>
                  <span className="text-xs text-slate-400">{fmtDateTime(c.created_at)}</span>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-line">{c.message}</p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <CommentForm poId={poId} />
        </div>
      </CardContent>
    </Card>
  );
}

export function PoCommentsSectionSkeleton() {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="h-5 w-40 bg-muted/50 rounded animate-pulse mb-3" />
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="border border-slate-200 rounded-xl p-3">
              <div className="h-4 w-32 bg-muted/50 rounded animate-pulse mb-2" />
              <div className="h-3 w-full bg-muted/40 rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-muted/40 rounded animate-pulse mt-1.5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
