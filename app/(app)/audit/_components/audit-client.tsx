"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText, KeyRound, Search, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Filter, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type {
  AuditPoActivity,
  AuditLoginAttempt,
  AuditFilters,
} from "@/lib/db/audit";

interface Props {
  tab: "po" | "login";
  page: number;
  filters: AuditFilters;
  actions: string[];
  poData: { rows: AuditPoActivity[]; total: number; hasMore: boolean };
  loginData: { rows: AuditLoginAttempt[]; total: number; hasMore: boolean };
}

const ACTION_LABEL: Record<string, string> = {
  created: "สร้าง PO",
  ordered: "สั่งซื้อ",
  status_changed: "เปลี่ยนสถานะ",
  received: "รับของ",
  cancelled: "ยกเลิก",
  closed: "ปิดงาน",
  comment: "คอมเมนต์",
  attachment_added: "แนบไฟล์",
  attachment_removed: "ลบไฟล์",
  cloned: "Clone",
};

export function AuditClient({
  tab, page, filters, actions, poData, loginData,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  // Local filter form state — applied on submit
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const [user, setUser] = useState(filters.user ?? "");
  const [action, setAction] = useState(filters.action ?? "_all");
  const [status, setStatus] = useState(filters.status ?? "all");

  function applyFilters() {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (user.trim()) params.set("user", user.trim());
    if (action && action !== "_all") params.set("action", action);
    if (tab === "login" && status !== "all") params.set("status", status);
    start(() => router.push(`/audit?${params.toString()}`));
  }

  function clearFilters() {
    setFrom(""); setTo(""); setUser(""); setAction("_all"); setStatus("all");
    start(() => router.push(`/audit?tab=${tab}`));
  }

  function setTab(newTab: "po" | "login") {
    const params = new URLSearchParams(sp.toString());
    params.set("tab", newTab);
    params.delete("page");
    if (newTab === "po") params.delete("status");
    start(() => router.push(`/audit?${params.toString()}`));
  }

  function gotoPage(newPage: number) {
    const params = new URLSearchParams(sp.toString());
    if (newPage <= 0) params.delete("page");
    else params.set("page", String(newPage));
    start(() => router.push(`/audit?${params.toString()}`));
  }

  const data = tab === "po" ? poData : loginData;
  const hasFilter =
    !!filters.from || !!filters.to || !!filters.user ||
    !!filters.action || filters.status !== "all";

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("po")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${
            tab === "po"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="size-4" />
          PO Activities
          <span className="text-xs text-muted-foreground">
            ({poData.total.toLocaleString()})
          </span>
        </button>
        <button
          onClick={() => setTab("login")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-colors ${
            tab === "login"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <KeyRound className="size-4" />
          Login Attempts
          <span className="text-xs text-muted-foreground">
            ({loginData.total.toLocaleString()})
          </span>
        </button>
      </div>

      {/* Filter card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="size-4" />
            ตัวกรอง
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">ตั้งแต่</label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ถึง</label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                {tab === "po" ? "ผู้ใช้" : "username"}
              </label>
              <Input
                type="text"
                placeholder="ค้นหา..."
                value={user}
                onChange={(e) => setUser(e.target.value)}
              />
            </div>
            {tab === "po" && (
              <div>
                <label className="text-xs text-muted-foreground">Action</label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">— ทั้งหมด —</SelectItem>
                    {actions.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ACTION_LABEL[a] ?? a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {tab === "login" && (
              <div>
                <label className="text-xs text-muted-foreground">สถานะ</label>
                <Select value={status} onValueChange={(v) => setStatus(v as "all" | "success" | "failed")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="success">✓ สำเร็จ</SelectItem>
                    <SelectItem value="failed">✗ ล้มเหลว</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Button onClick={applyFilters} disabled={pending} size="sm" className="flex-1">
                <Search className="size-3.5 mr-1.5" />
                ค้นหา
              </Button>
              {hasFilter && (
                <Button onClick={clearFilters} disabled={pending} size="sm" variant="outline">
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data table */}
      <Card>
        <CardContent className="p-0">
          {data.rows.length === 0 ? (
            <EmptyState
              icon="📋"
              title={hasFilter ? "ไม่พบข้อมูลตรงกับตัวกรอง" : "ยังไม่มีข้อมูล"}
              text={hasFilter ? "ลองเปลี่ยนตัวกรอง" : ""}
            />
          ) : tab === "po" ? (
            <PoActivityTable rows={poData.rows} />
          ) : (
            <LoginTable rows={loginData.rows} />
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data.total > 100 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            หน้า {page + 1} • แสดง {data.rows.length} จาก {data.total.toLocaleString()} รายการ
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0 || pending}
              onClick={() => gotoPage(page - 1)}
            >
              <ChevronLeft className="size-4" /> ก่อน
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!data.hasMore || pending}
              onClick={() => gotoPage(page + 1)}
            >
              ถัดไป <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PoActivityTable({ rows }: { rows: AuditPoActivity[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 sticky top-0">
          <tr className="border-b border-border/40">
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">เวลา</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">ผู้ใช้</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">PO</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Action</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">รายละเอียด</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/40 hover:bg-accent/30">
              <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(r.created_at)}
              </td>
              <td className="px-3 py-2">
                <div className="font-medium text-foreground">{r.user_name}</div>
                <div className="text-xs text-muted-foreground">{r.user_role}</div>
              </td>
              <td className="px-3 py-2">
                {r.po_number ? (
                  <Link
                    href={`/po/${r.po_id}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {r.po_number}
                  </Link>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </td>
              <td className="px-3 py-2">
                <Badge variant="soft" className="text-[10px]">
                  {ACTION_LABEL[r.action] ?? r.action}
                </Badge>
              </td>
              <td className="px-3 py-2 text-foreground/80 break-words max-w-md">
                {r.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoginTable({ rows }: { rows: AuditLoginAttempt[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 sticky top-0">
          <tr className="border-b border-border/40">
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">เวลา</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Username</th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/40 hover:bg-accent/30">
              <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(r.created_at)}
              </td>
              <td className="px-3 py-2 font-medium text-foreground">{r.username}</td>
              <td className="px-3 py-2">
                {r.success ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                    <CheckCircle2 className="size-3.5" />
                    สำเร็จ
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-red-600 text-xs font-medium">
                    <XCircle className="size-3.5" />
                    ล้มเหลว
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  // Bangkok ICT
  return d.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
