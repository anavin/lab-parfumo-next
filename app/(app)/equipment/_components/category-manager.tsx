"use client";

/**
 * Category management — admin จัดลำดับ + แก้ + ลบ + เพิ่มหมวด
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp, ArrowDown, Edit2, Trash2, Plus, Save, X, Folder,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  addCategoryAction, updateCategoryAction,
  deleteCategoryAction, moveCategoryAction,
} from "@/lib/actions/equipment";

interface CategoryWithCount {
  name: string;
  count: number;
}

export function CategoryManager({
  categories, equipmentByCategory,
}: {
  categories: string[];
  equipmentByCategory: Record<string, number>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const cats: CategoryWithCount[] = categories.map((c) => ({
    name: c, count: equipmentByCategory[c] ?? 0,
  }));

  function move(name: string, dir: "up" | "down") {
    setError(null);
    startTransition(async () => {
      const res = await moveCategoryAction(name, dir);
      if (!res.ok && res.error) setError(res.error);
      router.refresh();
    });
  }

  function startEdit(name: string) {
    setEditingName(name);
    setEditingValue(name);
    setError(null);
  }

  function saveEdit() {
    if (!editingName) return;
    setError(null);
    startTransition(async () => {
      const res = await updateCategoryAction(editingName, editingValue);
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setEditingName(null);
      router.refresh();
    });
  }

  function handleDelete(name: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteCategoryAction(name);
      if (!res.ok) {
        setError(res.error ?? "ลบไม่สำเร็จ");
        setConfirmDel(null);
        return;
      }
      setConfirmDel(null);
      router.refresh();
    });
  }

  function handleAdd() {
    setError(null);
    if (!newName.trim()) {
      setError("กรุณากรอกชื่อหมวด");
      return;
    }
    startTransition(async () => {
      const res = await addCategoryAction(newName);
      if (!res.ok) {
        setError(res.error ?? "เพิ่มไม่สำเร็จ");
        return;
      }
      setNewName("");
      router.refresh();
    });
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-bold text-slate-900">
            จัดการหมวดหมู่ ({cats.length})
          </span>
        </div>
        <span className={`text-xs text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {open && (
        <CardContent className="p-4 pt-0 space-y-3">
          {error && <Alert tone="danger">❌ {error}</Alert>}

          <div className="text-xs text-slate-500">
            ⬆️⬇️ จัดลำดับ • ✏️ แก้ชื่อ • 🗑️ ลบ
          </div>

          {/* List */}
          <div className="space-y-1.5">
            {cats.map((cat, i) => (
              <div
                key={cat.name}
                className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg"
              >
                <span className="text-xs text-slate-400 w-6 tabular-nums">
                  #{i + 1}
                </span>
                {/* Name (or edit input) */}
                <div className="flex-1 min-w-0">
                  {editingName === cat.name ? (
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      autoFocus
                      disabled={pending}
                      className="h-9"
                    />
                  ) : (
                    <div className="text-sm font-semibold text-slate-900">
                      📂 {cat.name}
                    </div>
                  )}
                </div>
                {/* Count */}
                <span className="text-xs text-slate-500 px-2">
                  {cat.count > 0 ? `📦 ${cat.count}` : "(ว่าง)"}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {editingName === cat.name ? (
                    <>
                      <Button
                        size="sm" loading={pending}
                        onClick={saveEdit}
                        className="!h-8 !px-2"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="secondary" size="sm"
                        onClick={() => setEditingName(null)}
                        disabled={pending}
                        className="!h-8 !px-2"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => move(cat.name, "up")}
                        disabled={pending || i === 0}
                        title="เลื่อนขึ้น"
                        className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 inline-flex items-center justify-center"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(cat.name, "down")}
                        disabled={pending || i === cats.length - 1}
                        title="เลื่อนลง"
                        className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 inline-flex items-center justify-center"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(cat.name)}
                        disabled={pending}
                        title="แก้ไข"
                        className="h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 inline-flex items-center justify-center"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {confirmDel === cat.name ? (
                        <Button
                          variant="primary" size="sm" loading={pending}
                          onClick={() => handleDelete(cat.name)}
                          className="!from-red-600 !to-red-700 !h-8"
                        >
                          ⚠️ ยืนยัน
                        </Button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDel(cat.name)}
                          disabled={pending || cat.count > 0}
                          title={cat.count > 0 ? "มีสินค้าในหมวดนี้ — ลบไม่ได้" : "ลบ"}
                          className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add new */}
          <div className="pt-3 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-1.5">
              ➕ เพิ่มหมวดใหม่
            </div>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="เช่น น้ำหอม / กล่องของขวัญ / สเปรย์"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !pending) {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                disabled={pending}
              />
              <Button onClick={handleAdd} loading={pending} disabled={!newName.trim()}>
                <Plus className="h-3.5 w-3.5" /> เพิ่ม
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
