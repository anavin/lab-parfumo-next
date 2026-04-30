import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft, Calendar, Truck, FileText, MessageSquare,
  Activity, Package,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StatusPill } from "@/components/ui/status-pill";
import { WorkflowTimeline } from "@/components/po/workflow-timeline";
import { requireUser } from "@/lib/auth/require-user";
import {
  getPoById, getPoActivities, getPoComments, getPoDeliveries,
  getSupplierHistory,
} from "@/lib/db/po";
import { getEquipmentById } from "@/lib/db/equipment";
import type { Equipment } from "@/lib/types/db";
import { ItemsList } from "./_components/items-list";
import { ActionButtons } from "./_components/action-buttons";
import { CommentForm } from "./_components/comment-form";
import { AttachmentsSection } from "./_components/attachments-section";
import { DeliveriesList } from "./_components/deliveries-list";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const po = await getPoById(id);
  return {
    title: po ? `${po.po_number} — Lab Parfumo PO` : "ไม่พบ PO",
  };
}

export default async function PoViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const isAdmin = user.role === "admin" || user.role === "supervisor";
  const { id } = await params;

  const po = await getPoById(id);
  if (!po) notFound();

  // Permission: staff (non-admin) เห็น PO ของตัวเอง
  // หรือ PO ที่อยู่ในสถานะที่ทุกคนกดรับได้/ดูประวัติได้
  // (สั่งซื้อแล้ว / กำลังขนส่ง / รับของแล้ว / มีปัญหา / เสร็จสมบูรณ์)
  const STAFF_VIEWABLE_STATUSES = [
    "สั่งซื้อแล้ว",
    "กำลังขนส่ง",
    "รับของแล้ว",
    "มีปัญหา",
    "เสร็จสมบูรณ์",
  ];
  if (
    !isAdmin
    && po.created_by !== user.id
    && !STAFF_VIEWABLE_STATUSES.includes(po.status)
  ) {
    redirect("/po");
  }

  // Collect equipment_ids referenced in items, fetch their full records in parallel
  // so ItemsList can show real product images + descriptions
  const eqIds = Array.from(
    new Set(
      (po.items ?? [])
        .map((it) => it.equipment_id)
        .filter((id): id is string => !!id),
    ),
  );

  const [activities, comments, deliveries, suppliers, equipmentList] = await Promise.all([
    getPoActivities(po.id),
    getPoComments(po.id),
    getPoDeliveries(po.id),
    isAdmin ? getSupplierHistory() : Promise.resolve([]),
    Promise.all(eqIds.map((id) => getEquipmentById(id))),
  ]);

  // Build equipment lookup map (filter nulls)
  const equipmentMap: Record<string, Equipment> = {};
  for (const eq of equipmentList) {
    if (eq) equipmentMap[eq.id] = eq;
  }

  const itemsCount = po.items?.length ?? 0;
  const supplier = po.supplier_name || "(ยังไม่ระบุ supplier)";

  // คำเตือนวันใกล้/เลยกำหนด
  const today = new Date().toISOString().slice(0, 10);
  const expectedWarning = (() => {
    if (!po.expected_date) return null;
    if (!["สั่งซื้อแล้ว", "กำลังขนส่ง"].includes(po.status)) return null;
    if (po.expected_date < today) {
      const days = Math.floor(
        (new Date(today).getTime() - new Date(po.expected_date).getTime()) / 86400_000,
      );
      return { tone: "danger" as const, msg: `🚨 เลยกำหนด ${days} วัน — คาดว่าจะได้รับ: ${fmtDate(po.expected_date)}` };
    }
    const daysToGo = Math.ceil(
      (new Date(po.expected_date).getTime() - new Date(today).getTime()) / 86400_000,
    );
    if (daysToGo <= 3) {
      return { tone: "warning" as const, msg: `⏰ ใกล้ครบกำหนด — คาดว่าจะได้รับ: ${fmtDate(po.expected_date)}` };
    }
    return null;
  })();

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <Link
        href="/po"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> ใบ PO
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{po.po_number}</h1>
            <StatusPill status={po.status} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {supplier} • {itemsCount} รายการ • สร้างโดย{" "}
            <span className="font-semibold">{po.created_by_name ?? "—"}</span>{" "}
            เมื่อ {fmtDate(po.created_at)}
          </p>
        </div>
        <Link href="/po">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" /> กลับ
          </Button>
        </Link>
      </div>

      <WorkflowTimeline status={po.status} />

      {/* Warning */}
      {expectedWarning && (
        <Alert tone={expectedWarning.tone}>{expectedWarning.msg}</Alert>
      )}

      {/* Action buttons */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs uppercase tracking-wider font-bold text-brand-700 mb-2.5">
            ⚡ การดำเนินการ
          </div>
          <ActionButtons
            po={{
              id: po.id,
              po_number: po.po_number,
              status: po.status,
              items: po.items ?? [],
              supplier_name: po.supplier_name,
              supplier_contact: po.supplier_contact,
              tracking_number: po.tracking_number,
              expected_date: po.expected_date,
            }}
            isAdmin={isAdmin}
            canCancel={isAdmin || po.created_by === user.id}
            suppliers={suppliers}
          />
        </CardContent>
      </Card>

      {/* Two-column info */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            {isAdmin ? (
              <>
                <SectionTitle icon={<Truck className="h-4 w-4" />}>Supplier</SectionTitle>
                {po.supplier_name ? (
                  <>
                    {po.supplier_id ? (
                      <Link
                        href={`/suppliers/${po.supplier_id}`}
                        className="font-bold text-slate-900 hover:text-primary inline-flex items-center gap-1.5 group"
                        title="ดูข้อมูล Supplier"
                      >
                        {po.supplier_name}
                        <ArrowLeft className="h-3 w-3 rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    ) : (
                      <div className="font-bold text-slate-900">{po.supplier_name}</div>
                    )}
                    {po.supplier_contact && (
                      <div className="text-sm text-slate-600 whitespace-pre-line mt-1">
                        {po.supplier_contact}
                      </div>
                    )}
                    {!po.supplier_id && (
                      <div className="text-[11px] text-amber-600 mt-1.5 inline-flex items-center gap-1">
                        ⚠️ ยังไม่ link กับ Supplier ใน DB —
                        <Link href="/suppliers" className="underline hover:text-amber-800">
                          เพิ่ม Supplier ใหม่
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-slate-500 italic">
                    ยังไม่ได้ระบุ supplier — กดปุ่ม "🛒 สั่งซื้อ" ด้านบน
                  </div>
                )}
              </>
            ) : (
              <>
                <SectionTitle icon={<FileText className="h-4 w-4" />}>สถานะ</SectionTitle>
                <RequesterStatusInfo status={po.status} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <SectionTitle icon={<Calendar className="h-4 w-4" />}>วันที่</SectionTitle>
            <dl className="space-y-1.5 text-sm">
              <DateRow label="สร้าง" value={fmtDate(po.created_at)} />
              {po.ordered_date && <DateRow label="สั่ง supplier" value={fmtDate(po.ordered_date)} />}
              {po.expected_date && (
                <DateRow
                  label="คาดว่าจะได้รับ"
                  value={fmtDate(po.expected_date)}
                  highlight={expectedWarning?.tone}
                />
              )}
              {po.received_date && <DateRow label="รับของ" value={fmtDate(po.received_date)} />}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Tracking (admin) */}
      {isAdmin && po.tracking_number && (
        <Card>
          <CardContent className="p-4">
            <SectionTitle icon={<Truck className="h-4 w-4" />}>Tracking</SectionTitle>
            <code className="block bg-slate-50 px-3 py-2 rounded-lg text-sm font-mono text-slate-800">
              {po.tracking_number}
            </code>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle icon={<Package className="h-4 w-4" />}>รายการ ({itemsCount})</SectionTitle>
          {itemsCount > 0 ? (
            <ItemsList items={po.items} isAdmin={isAdmin} equipmentMap={equipmentMap} />
          ) : (
            <div className="text-sm text-slate-400 italic">ไม่มีรายการ</div>
          )}
        </CardContent>
      </Card>

      {/* ยอดสุทธิ (admin) */}
      {isAdmin && po.total != null && po.total > 0 && (
        <Card>
          <CardContent className="p-5">
            <SectionTitle>💰 ยอดสุทธิ</SectionTitle>
            <dl className="space-y-1.5 text-sm">
              <SumRow label="ยอดรวม" value={po.subtotal ?? 0} />
              {po.discount! > 0 && <SumRow label="ส่วนลด" value={-(po.discount ?? 0)} />}
              {po.shipping_fee! > 0 && <SumRow label="ค่าส่ง" value={po.shipping_fee ?? 0} />}
              {po.vat! > 0 && <SumRow label="VAT" value={po.vat ?? 0} />}
              <div className="pt-2 mt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-base font-bold text-slate-900">รวมสุทธิ</span>
                <span className="text-2xl font-bold text-brand-700 tabular-nums">
                  ฿{(po.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {po.notes && (
        <Card>
          <CardContent className="p-5">
            <SectionTitle>📝 หมายเหตุ</SectionTitle>
            <div className="text-sm text-slate-700 bg-blue-50 border border-blue-200 rounded-lg p-3 whitespace-pre-line">
              {po.notes}
            </div>
          </CardContent>
        </Card>
      )}
      {isAdmin && po.procurement_notes && (
        <Card>
          <CardContent className="p-5">
            <SectionTitle>📝 หมายเหตุจัดซื้อ</SectionTitle>
            <div className="text-sm text-slate-700 bg-blue-50 border border-blue-200 rounded-lg p-3 whitespace-pre-line">
              {po.procurement_notes}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deliveries */}
      {deliveries.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <SectionTitle icon={<Package className="h-4 w-4" />}>
              ประวัติการรับของ ({deliveries.length})
            </SectionTitle>
            <DeliveriesList deliveries={deliveries} />
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      <AttachmentsSection
        poId={po.id}
        attachments={po.attachment_urls ?? []}
        isAdmin={isAdmin}
      />

      {/* Comments */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle icon={<MessageSquare className="h-4 w-4" />}>
            ความคิดเห็น ({comments.length})
          </SectionTitle>
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
            <CommentForm poId={po.id} />
          </div>
        </CardContent>
      </Card>

      {/* Activities */}
      <Card>
        <CardContent className="p-5">
          <SectionTitle icon={<Activity className="h-4 w-4" />}>
            ประวัติกิจกรรม ({activities.length})
          </SectionTitle>
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
    </div>
  );
}

// ==================================================================
// Sub-components
// ==================================================================

function SectionTitle({
  children, icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <h2 className="text-sm font-bold text-slate-900 mb-3 inline-flex items-center gap-1.5">
      {icon}
      {children}
    </h2>
  );
}

function DateRow({
  label, value, highlight,
}: {
  label: string;
  value: string;
  highlight?: "danger" | "warning";
}) {
  const highlightCls =
    highlight === "danger" ? "text-red-600 font-semibold"
      : highlight === "warning" ? "text-amber-600 font-semibold"
        : "text-slate-700";
  return (
    <div className="flex justify-between items-center">
      <dt className="text-slate-500">{label}:</dt>
      <dd className={highlightCls}>{value}</dd>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center">
      <dt className="text-slate-600">{label}:</dt>
      <dd className="text-slate-800 tabular-nums">
        {value < 0 ? "−" : ""}฿{Math.abs(value).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </dd>
    </div>
  );
}

function RequesterStatusInfo({ status }: { status: string }) {
  const map: Record<string, { tone: string; msg: string }> = {
    "รอจัดซื้อดำเนินการ": { tone: "info", msg: "⏳ รอแอดมินติดต่อ supplier" },
    "สั่งซื้อแล้ว": { tone: "success", msg: "✅ แอดมินสั่ง supplier แล้ว — รอจัดส่ง" },
    "กำลังขนส่ง": { tone: "success", msg: "🚚 อยู่ระหว่างจัดส่ง" },
    "รับของแล้ว": { tone: "success", msg: "📦 รับของเรียบร้อย" },
    "มีปัญหา": { tone: "danger", msg: "⚠️ มีปัญหา — แอดมินกำลังจัดการ" },
    "เสร็จสมบูรณ์": { tone: "success", msg: "🎉 เสร็จสมบูรณ์" },
    "ยกเลิก": { tone: "warning", msg: "❌ ยกเลิกแล้ว" },
  };
  const m = map[status];
  if (!m) return <div>{status}</div>;
  const toneCls = {
    info: "text-blue-700 bg-blue-50 border-blue-200",
    success: "text-emerald-700 bg-emerald-50 border-emerald-200",
    warning: "text-amber-700 bg-amber-50 border-amber-200",
    danger: "text-red-700 bg-red-50 border-red-200",
  }[m.tone] ?? "";
  return <div className={`text-sm px-3 py-2 rounded-lg border ${toneCls}`}>{m.msg}</div>;
}

// ==================================================================
// Helpers
// ==================================================================

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return String(d);
  }
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("th-TH", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}
