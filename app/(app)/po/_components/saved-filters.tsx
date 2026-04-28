"use client";

/**
 * Saved filter presets — store current URL params under a name
 * (localStorage, per-browser). Click a preset to jump to that view.
 */
import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Bookmark, BookmarkPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

interface SavedFilter {
  id: string;
  name: string;
  query: string; // serialized URLSearchParams
}

const STORAGE_KEY = "lp-po-saved-filters";

function loadFilters(): SavedFilter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedFilter[]) : [];
  } catch {
    return [];
  }
}

function saveFilters(items: SavedFilter[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage full or unavailable
  }
}

export function SavedFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [items, setItems] = useState<SavedFilter[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  // Load on mount
  useEffect(() => {
    setItems(loadFilters());
  }, []);

  const currentQuery = params.toString();
  const hasFilters = currentQuery.length > 0;

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("กรุณาตั้งชื่อ");
      return;
    }
    const next: SavedFilter = {
      id: Date.now().toString(36),
      name: trimmed,
      query: currentQuery,
    };
    const updated = [next, ...items].slice(0, 12); // cap at 12
    setItems(updated);
    saveFilters(updated);
    toast.success(`✅ บันทึก "${trimmed}" แล้ว`);
    setSaveOpen(false);
    setName("");
  }

  function handleApply(item: SavedFilter) {
    router.push(`${pathname}?${item.query}`);
  }

  function handleDelete(id: string) {
    const updated = items.filter((f) => f.id !== id);
    setItems(updated);
    saveFilters(updated);
  }

  if (items.length === 0 && !hasFilters) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Bookmark className="size-3.5 text-muted-foreground flex-shrink-0" />
          {items.map((f) => (
            <div
              key={f.id}
              className="group inline-flex items-center gap-1 bg-accent/50 hover:bg-accent rounded-md px-2 py-1 text-xs transition-colors"
            >
              <button
                type="button"
                onClick={() => handleApply(f)}
                className="font-medium text-foreground"
                title="คลิกเพื่อใช้ filter นี้"
              >
                {f.name}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(f.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                aria-label="ลบ preset นี้"
                title="ลบ"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {hasFilters && (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => setSaveOpen(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <BookmarkPlus className="size-3.5" />
          บันทึก filter ปัจจุบัน
        </Button>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>บันทึก filter เป็น preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="เช่น: Stale 7+ วัน, ของซีรา, ปัญหา..."
            />
            <div className="text-xs text-muted-foreground">
              เก็บใน localStorage (เฉพาะเบราว์เซอร์นี้) — สูงสุด 12 รายการ
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
