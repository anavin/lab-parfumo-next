"use client";

import { useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { addCommentAction } from "@/lib/actions/po";

export function CommentForm({ poId }: { poId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    const message = String(formData.get("message") ?? "");
    if (!message.trim()) {
      setError("ข้อความว่าง");
      return;
    }
    startTransition(async () => {
      const res = await addCommentAction(poId, message);
      if (!res.ok) setError(res.error ?? "ส่งไม่สำเร็จ");
      else if (ref.current) ref.current.value = "";
    });
  }

  return (
    <form action={handleSubmit} className="space-y-2">
      <textarea
        ref={ref}
        name="message"
        placeholder="ส่งข้อความถึงทีม..."
        rows={3}
        disabled={pending}
        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
      />
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          {error && <Alert tone="danger" className="text-xs py-1.5">{error}</Alert>}
        </div>
        <Button type="submit" size="sm" loading={pending}>
          <Send className="h-3.5 w-3.5" />
          {pending ? "กำลังส่ง..." : "ส่งความคิดเห็น"}
        </Button>
      </div>
    </form>
  );
}
