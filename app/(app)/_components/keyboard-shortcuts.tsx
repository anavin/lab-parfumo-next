"use client";

/**
 * Global keyboard shortcuts (mounted in layout)
 *
 *   /        focus search
 *   N        new PO
 *   G + D    go dashboard
 *   G + P    go PO list
 *   G + W    go withdraw
 *   ?        show help dialog
 *   Esc      close any modal (Radix handles this)
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ["/"], label: "ค้นหา (open search)" },
  { keys: ["N"], label: "สร้าง PO ใหม่" },
  { keys: ["G", "D"], label: "ไป Dashboard" },
  { keys: ["G", "P"], label: "ไป PO list" },
  { keys: ["G", "W"], label: "ไป เบิกของ" },
  { keys: ["?"], label: "เปิดหน้านี้" },
  { keys: ["Esc"], label: "ปิด modal" },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let lastG = 0; // timestamp of last "g" press for sequential shortcuts

    function onKey(e: KeyboardEvent) {
      // Ignore when typing in form fields
      if (isEditableTarget(e.target)) {
        // exception: Cmd+K (handled in search-trigger) and Esc (Radix)
        return;
      }
      // Ignore when modifier keys held (except shift for ?)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key;

      // ? help (shift+/)
      if (k === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }

      // / search — emit a synthetic Cmd+K
      if (k === "/") {
        e.preventDefault();
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", metaKey: true }),
        );
        return;
      }

      // N new PO
      if (k.toLowerCase() === "n") {
        e.preventDefault();
        router.push("/po/new");
        return;
      }

      // G + X sequential
      const now = Date.now();
      if (k.toLowerCase() === "g") {
        lastG = now;
        return;
      }
      if (now - lastG < 1500) {
        // chord: g + ?
        if (k.toLowerCase() === "d") {
          e.preventDefault();
          router.push("/dashboard");
        } else if (k.toLowerCase() === "p") {
          e.preventDefault();
          router.push("/po");
        } else if (k.toLowerCase() === "w") {
          e.preventDefault();
          router.push("/withdraw");
        }
        lastG = 0;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>คีย์ลัด ⌨️</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5">
          {SHORTCUTS.map((s) => (
            <div
              key={s.keys.join("+")}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-foreground">{s.label}</span>
              <div className="flex gap-1">
                {s.keys.map((key, i) => (
                  <kbd
                    key={i}
                    className="px-2 py-0.5 text-[11px] font-mono font-semibold rounded border bg-muted text-foreground shadow-sm"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground pt-2 border-t">
          💡 ค้นหาด้วย <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded border bg-muted">⌘K</kbd> ก็ได้
        </div>
      </DialogContent>
    </Dialog>
  );
}
