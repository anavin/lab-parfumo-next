"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Send, X, Search, Hash, FolderOpen, Package as PackageIcon,
  Banknote, AlertCircle, ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { LookupCombobox } from "@/components/ui/lookup-combobox";
import type { Equipment, Lookup } from "@/lib/types/db";
import { createWithdrawalAction } from "@/lib/actions/withdraw";

export function WithdrawForm({
  equipment, categories, purposes, canCreateLookup,
}: {
  equipment: Equipment[];
  categories: string[];
  purposes?: Lookup[];
  canCreateLookup?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("ทั้งหมด");
  const [showZero, setShowZero] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "stock_low" | "stock_high">("name");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [preview, setPreview] = useState<{
    images: string[]; index: number; name: string;
  } | null>(null);

  const filtered = useMemo(() => {
    let out = equipment;
    if (category !== "ทั้งหมด") out = out.filter((e) => e.category === category);
    if (search) {
      const s = search.toLowerCase();
      out = out.filter((e) =>
        (e.name ?? "").toLowerCase().includes(s) ||
        (e.sku ?? "").toLowerCase().includes(s),
      );
    }
    if (!showZero) out = out.filter((e) => (e.stock ?? 0) > 0);
    if (sortBy === "name") out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "stock_low") out = [...out].sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
    else if (sortBy === "stock_high") out = [...out].sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0));
    return out;
  }, [equipment, category, search, showZero, sortBy]);

  const selectedEq = useMemo(
    () => equipment.find((e) => e.id === selectedId) ?? null,
    [equipment, selectedId],
  );

  // Group filtered items by category — same pattern as equipment catalog
  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, Equipment[]>();
    for (const c of categories) groups.set(c, []);
    const noCategory: Equipment[] = [];
    for (const eq of filtered) {
      const c = (eq.category ?? "").trim();
      if (c) {
        if (!groups.has(c)) groups.set(c, []);
        groups.get(c)!.push(eq);
      } else {
        noCategory.push(eq);
      }
    }
    const result: Array<{ name: string; items: Equipment[] }> = [];
    for (const [name, items] of groups) {
      if (items.length > 0) result.push({ name, items });
    }
    if (noCategory.length > 0) {
      result.push({ name: "ไม่ระบุหมวดหมู่", items: noCategory });
    }
    return result;
  }, [filtered, categories]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const allCollapsed = collapsed.size > 0 && collapsed.size === groupedByCategory.length;
  function toggleCategory(name: string) {
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
  function toggleAll() {
    if (allCollapsed) setCollapsed(new Set());
    else setCollapsed(new Set(groupedByCategory.map((g) => g.name)));
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filter row */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="search"
                  placeholder="🔍 ชื่อสินค้า / SKU"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>ทั้งหมด</option>
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-slate-600 items-center">
              <select
                className="h-9 px-2 rounded-lg border border-slate-300 bg-white text-xs"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="name">🔃 เรียงตามชื่อ</option>
                <option value="stock_low">🔃 สต็อกน้อย→มาก</option>
                <option value="stock_high">🔃 สต็อกมาก→น้อย</option>
              </select>
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showZero}
                  onChange={(e) => setShowZero(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                แสดงสินค้าที่หมดด้วย
              </label>
              <span className="ml-auto">
                พบ <strong>{filtered.length}</strong> รายการ ใน <strong>{groupedByCategory.length}</strong> หมวด
              </span>
              {groupedByCategory.length > 1 && (
                <Button size="sm" variant="outline" onClick={toggleAll}>
                  {allCollapsed ? (
                    <><ChevronDown className="size-3.5" /> ขยายทั้งหมด</>
                  ) : (
                    <><ChevronRight className="size-3.5" /> ย่อทั้งหมด</>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Equipment grid grouped by category (collapsible) */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              ไม่พบสินค้าตามที่ค้นหา
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {groupedByCategory.map((group) => {
              const isCollapsed = collapsed.has(group.name);
              return (
                <section
                  key={group.name}
                  className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.name)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
                    aria-expanded={!isCollapsed}
                  >
                    <span className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <FolderOpen className="size-4" strokeWidth={2.25} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-base text-foreground">
                        {group.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {group.items.length} รายการ
                      </div>
                    </div>
                    <span
                      className={`size-7 rounded-md text-muted-foreground flex items-center justify-center transition-transform ${isCollapsed ? "" : "rotate-180"}`}
                      aria-hidden
                    >
                      <ChevronDown className="size-4" />
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="px-4 pb-4 pt-1 border-t border-border/40">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {group.items.map((eq) => (
                          <RichWithdrawCard
                            key={eq.id}
                            eq={eq}
                            isSelected={selectedId === eq.id}
                            onSelect={() =>
                              setSelectedId(selectedId === eq.id ? null : eq.id)
                            }
                            onPreview={(images, index) =>
                              setPreview({ images, index, name: eq.name })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* Withdraw form (sticky bottom) */}
        {selectedEq && (
          <SelectedItemForm
            eq={selectedEq}
            purposes={purposes}
            canCreateLookup={canCreateLookup}
            onClose={() => setSelectedId(null)}
            onSuccess={() => {
              setSelectedId(null);
              router.refresh();
            }}
            startTransition={startTransition}
            pending={pending}
          />
        )}
      </div>

      {preview && (
        <ImagePreview
          images={preview.images}
          index={preview.index}
          name={preview.name}
          onClose={() => setPreview(null)}
          onIndex={(i) => setPreview({ ...preview, index: i })}
        />
      )}
    </>
  );
}

// ==================================================================
// Rich card — mirrors /po/new equipment grid
// ==================================================================
function RichWithdrawCard({
  eq, isSelected, onSelect, onPreview,
}: {
  eq: Equipment;
  isSelected: boolean;
  onSelect: () => void;
  onPreview: (images: string[], startIndex: number) => void;
}) {
  const images = [...(eq.image_urls ?? [])];
  if (eq.image_url && !images.includes(eq.image_url)) {
    images.unshift(eq.image_url);
  }
  const primary = images[0];
  const thumbs = images.slice(1, 4);
  const extraCount = Math.max(0, images.length - 4);

  const stock = eq.stock ?? 0;
  const rl = eq.reorder_level ?? 0;
  const isOutOfStock = stock === 0;
  let stockChip: { bg: string; color: string; text: string };
  if (stock === 0) {
    stockChip = { bg: "bg-red-50 border-red-200", color: "text-red-700", text: "หมด" };
  } else if (rl > 0 && stock <= rl) {
    stockChip = { bg: "bg-red-50 border-red-200", color: "text-red-700", text: `ต้องสั่ง · ${stock}` };
  } else if (stock < 10) {
    stockChip = { bg: "bg-amber-50 border-amber-200", color: "text-amber-700", text: `${stock} ${eq.unit ?? ""}` };
  } else {
    stockChip = { bg: "bg-emerald-50 border-emerald-200", color: "text-emerald-700", text: `${stock} ${eq.unit ?? ""}` };
  }

  function handlePreviewPrimary(e: React.MouseEvent) {
    e.stopPropagation();
    if (primary) onPreview(images, 0);
  }
  function handlePreviewThumb(e: React.MouseEvent, i: number) {
    e.stopPropagation();
    onPreview(images, i + 1);
  }

  return (
    <div
      className={cn(
        "group bg-card border rounded-2xl p-3 transition-all flex flex-col",
        "hover:shadow-md hover:-translate-y-0.5",
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border hover:border-primary/40",
        isOutOfStock && "opacity-60",
      )}
    >
      {/* Primary image */}
      <button
        type="button"
        onClick={handlePreviewPrimary}
        className="relative aspect-square w-full bg-muted rounded-xl overflow-hidden mb-2 group/img cursor-zoom-in"
        aria-label={primary ? "ดูรูปขยาย" : "ไม่มีรูป"}
      >
        {primary ? (
          <>
            <Image
              src={primary}
              alt={eq.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover/img:scale-110"
              unoptimized
            />
            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover/img:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 text-xs font-semibold text-foreground shadow-lg">
                🔍 คลิกดูรูปขยาย
              </div>
            </div>
            {images.length > 1 && (
              <div className="absolute top-2 right-2 inline-flex items-center gap-1 bg-black/60 text-white text-[10px] font-semibold rounded-full px-2 py-0.5 backdrop-blur-sm">
                <span className="size-1 rounded-full bg-white" />
                <span className="tabular-nums">{images.length} รูป</span>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🧴</div>
        )}
      </button>

      {/* Thumbnails */}
      {thumbs.length > 0 && (
        <div className="grid grid-cols-3 gap-1 mb-2">
          {thumbs.map((url, i) => {
            const isLastWithExtras = i === thumbs.length - 1 && extraCount > 0;
            return (
              <button
                key={i}
                type="button"
                onClick={(e) => handlePreviewThumb(e, i)}
                className="relative aspect-square bg-muted rounded-md overflow-hidden hover:ring-2 hover:ring-primary/40 transition-all cursor-zoom-in group/thumb"
                aria-label={isLastWithExtras ? `ดูรูปทั้งหมด ${images.length} รูป` : `รูปที่ ${i + 2}`}
              >
                <Image
                  src={url}
                  alt={`${eq.name} ${i + 2}`}
                  fill
                  sizes="80px"
                  className="object-cover group-hover/thumb:scale-110 transition-transform duration-200"
                  unoptimized
                />
                {isLastWithExtras && (
                  <div className="absolute inset-0 bg-black/55 group-hover/thumb:bg-black/45 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                    <span className="text-base font-extrabold leading-none tabular-nums drop-shadow-md">
                      +{extraCount}
                    </span>
                    <span className="text-[9px] font-medium opacity-90 mt-0.5 drop-shadow">
                      รูปเพิ่ม
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="font-bold text-sm text-foreground line-clamp-2 leading-tight" title={eq.name}>
          {eq.name}
        </div>
        {eq.description && (
          <div className="text-[11px] text-muted-foreground leading-snug whitespace-pre-line break-words">
            {eq.description}
          </div>
        )}
        <div className="space-y-0.5 pt-1 border-t border-border/40">
          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            <Hash className="size-3 flex-shrink-0" />
            <span className="font-mono truncate">{eq.sku || "-"}</span>
          </div>
          <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
            <FolderOpen className="size-3 flex-shrink-0" />
            <span className="truncate">{eq.category || "-"}</span>
          </div>
          {eq.unit && (
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <PackageIcon className="size-3 flex-shrink-0" />
              <span>หน่วย: <span className="font-semibold text-foreground">{eq.unit}</span></span>
            </div>
          )}
          {eq.last_cost > 0 && (
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <Banknote className="size-3 flex-shrink-0 text-emerald-600" />
              <span>ราคาล่าสุด <span className="font-bold text-foreground tabular-nums">฿{eq.last_cost.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</span></span>
            </div>
          )}
          {eq.reorder_level > 0 && (
            <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <AlertCircle className="size-3 flex-shrink-0" />
              <span>จุดสั่งซื้อ: <span className="font-semibold tabular-nums text-foreground">{eq.reorder_level}</span></span>
            </div>
          )}
        </div>

        {/* Stock chip */}
        <div className="pt-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-md border",
              stockChip.bg, stockChip.color,
            )}
          >
            <PackageIcon className="size-3" />
            {stockChip.text}
          </span>
        </div>
      </div>

      {/* Action — เบิก / กำลังเบิก */}
      <button
        type="button"
        onClick={onSelect}
        disabled={isOutOfStock}
        className={cn(
          "mt-3 flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-bold transition-all",
          isOutOfStock
            ? "bg-muted text-muted-foreground/60 cursor-not-allowed"
            : isSelected
              ? "bg-gradient-to-br from-primary to-brand-900 text-white shadow-sm hover:shadow-brand"
              : "bg-muted text-foreground hover:bg-primary hover:text-primary-foreground",
        )}
      >
        {isOutOfStock ? (
          <>หมดสต็อก</>
        ) : isSelected ? (
          <><Send className="size-4" /> กำลังเบิก</>
        ) : (
          <><Send className="size-4" /> เบิกสินค้า</>
        )}
      </button>
    </div>
  );
}

// ==================================================================
// Selected item form (sticky bottom)
// ==================================================================
function SelectedItemForm({
  eq, purposes, canCreateLookup, onClose, onSuccess, startTransition, pending,
}: {
  eq: Equipment;
  purposes?: Lookup[];
  canCreateLookup?: boolean;
  onClose: () => void;
  onSuccess: () => void;
  startTransition: React.TransitionStartFunction;
  pending: boolean;
}) {
  const stock = eq.stock ?? 0;
  const [qty, setQty] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    setError(null);
    if (qty < 1) {
      setError("กรุณากรอกจำนวนอย่างน้อย 1");
      return;
    }
    if (qty > stock) {
      setError(`จำนวนเกินสต็อก — สูงสุด ${stock} ${eq.unit ?? "ชิ้น"}`);
      return;
    }
    if (!purpose.trim()) {
      setError("กรุณากรอกใช้ทำอะไร");
      return;
    }
    startTransition(async () => {
      const res = await createWithdrawalAction({
        equipmentId: eq.id,
        qty,
        purpose,
        withdrawnAt: new Date(date).toISOString(),
      });
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      onSuccess();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Send className="size-4" />
            </span>
            เบิก: {eq.name}
          </DialogTitle>
          <DialogDescription>
            สต็อกคงเหลือ <strong className="text-foreground tabular-nums">{stock}</strong> {eq.unit}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                จำนวน * <span className="text-muted-foreground/70 font-normal">(สูงสุด {stock})</span>
              </label>
              <input
                type="number" min="0" max={stock}
                value={qty === 0 ? "" : qty}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setQty(Number.isFinite(v) && v >= 0 ? v : 0);
                }}
                onFocus={(e) => e.currentTarget.select()}
                placeholder="0"
                disabled={pending}
                autoFocus
                className="h-10 w-full px-3 rounded-lg border border-input bg-background text-sm tabular-nums focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">วันที่ใช้</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={pending}
                className="h-10 w-full px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">หน่วย</label>
              <Input value={eq.unit ?? "ชิ้น"} disabled />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              ใช้ทำอะไร / ใช้ที่ไหน *
            </label>
            {purposes && purposes.length > 0 ? (
              <LookupCombobox
                type="withdrawal_purpose"
                options={purposes}
                value={purpose}
                onChange={setPurpose}
                placeholder={canCreateLookup ? "เลือก หรือพิมพ์เพื่อสร้างใหม่..." : "เลือก..."}
                allowCreate={canCreateLookup}
                manageHref={canCreateLookup ? "/settings" : undefined}
                disabled={pending}
              />
            ) : (
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="เช่น ผลิต CELEB lot 24, ตัวอย่างลูกค้า"
                disabled={pending}
              />
            )}
          </div>

          {error && <Alert tone="danger" className="text-sm">❌ {error}</Alert>}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} loading={pending}>
              <Send className="h-4 w-4" /> บันทึกเบิก
            </Button>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              ยกเลิก
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================================================================
// Lightbox preview — same pattern as /po/new
// ==================================================================
function ImagePreview({
  images, index, name, onClose, onIndex,
}: {
  images: string[];
  index: number;
  name: string;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const current = images[index];
  const hasNav = images.length > 1;

  function prev(e: React.MouseEvent) {
    e.stopPropagation();
    onIndex((index - 1 + images.length) % images.length);
  }
  function next(e: React.MouseEvent) {
    e.stopPropagation();
    onIndex((index + 1) % images.length);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasNav) onIndex((index - 1 + images.length) % images.length);
      if (e.key === "ArrowRight" && hasNav) onIndex((index + 1) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, hasNav, onClose, onIndex]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 size-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
        aria-label="ปิด"
      >
        <X className="size-5" />
      </button>

      <div className="absolute top-4 left-4 text-white">
        <div className="text-sm font-bold">{name}</div>
        {hasNav && (
          <div className="text-xs text-white/60 mt-0.5 tabular-nums">
            {index + 1} / {images.length}
          </div>
        )}
      </div>

      {hasNav && (
        <button
          type="button"
          onClick={prev}
          className="absolute left-4 size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm"
          aria-label="ก่อนหน้า"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      <div onClick={(e) => e.stopPropagation()} className="relative max-w-[90vw] max-h-[85vh]">
        <Image
          src={current}
          alt={name}
          width={1200}
          height={1200}
          unoptimized
          className="rounded-lg object-contain max-w-[90vw] max-h-[85vh] w-auto h-auto"
        />
      </div>

      {hasNav && (
        <button
          type="button"
          onClick={next}
          className="absolute right-4 size-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm"
          aria-label="ถัดไป"
        >
          <ChevronRight className="size-6" />
        </button>
      )}
    </div>
  );
}
