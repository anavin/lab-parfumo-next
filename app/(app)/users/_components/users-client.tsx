"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Edit2, Trash2, Shield, Mail, Calendar, AlertTriangle,
  Users as UsersIcon, UserCheck, UserX, Crown, LogIn, Search,
  CircleAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/sonner";
import type { User } from "@/lib/types/db";
import {
  createUserAction, updateUserAction, deleteUserAction,
} from "@/lib/actions/users";

const ROLE_LABEL = { admin: "แอดมิน + จัดซื้อ", requester: "Staff" } as const;

export function UsersClient({
  users, myId,
}: {
  users: User[];
  myId: string;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [delTarget, setDelTarget] = useState<User | null>(null);
  const [delPending, startDelTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "admin" | "requester" | "never">("all");

  const editing = editId ? users.find((u) => u.id === editId) : null;

  // Stats
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const requesterCount = users.filter((u) => u.role === "requester").length;
  const neverLoggedIn = users.filter((u) => !u.last_login_at).length;
  const inactiveCount = users.filter((u) => !u.is_active).length;

  // Filter
  const filtered = useMemo(() => {
    let out = users;
    if (filter === "admin") out = out.filter((u) => u.role === "admin");
    else if (filter === "requester") out = out.filter((u) => u.role === "requester");
    else if (filter === "never") out = out.filter((u) => !u.last_login_at);
    if (search) {
      const s = search.toLowerCase();
      out = out.filter((u) =>
        (u.full_name ?? "").toLowerCase().includes(s) ||
        (u.username ?? "").toLowerCase().includes(s) ||
        (u.email ?? "").toLowerCase().includes(s),
      );
    }
    return out;
  }, [users, filter, search]);

  function handleDelete() {
    if (!delTarget) return;
    startDelTransition(async () => {
      await deleteUserAction(delTarget.id);
      toast.success(`✅ ลบ ${delTarget.full_name} สำเร็จ`);
      setDelTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="space-y-5">
        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={UsersIcon}
            label="ผู้ใช้ทั้งหมด"
            value={totalUsers}
            unit="คน"
            color="primary"
          />
          <KpiCard
            icon={Crown}
            label="แอดมิน"
            value={adminCount}
            unit="คน"
            color="amber"
          />
          <KpiCard
            icon={UserCheck}
            label="Staff"
            value={requesterCount}
            unit="คน"
            color="emerald"
          />
          <KpiCard
            icon={UserX}
            label="ยังไม่เคย login"
            value={neverLoggedIn}
            unit="คน"
            color={neverLoggedIn > 0 ? "red" : "slate"}
            subtitle={inactiveCount > 0 ? `${inactiveCount} ปิดใช้งาน` : undefined}
          />
        </div>

        {/* Filter card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              }}
            >
              {([
                { v: "all", label: `ทั้งหมด (${totalUsers})` },
                { v: "admin", label: `แอดมิน (${adminCount})` },
                { v: "requester", label: `Staff (${requesterCount})` },
                { v: "never", label: `ยังไม่ login (${neverLoggedIn})` },
              ] as const).map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setFilter(p.v)}
                  className={`inline-flex items-center justify-center h-9 px-3 rounded-lg text-xs font-semibold transition-all ${
                    filter === p.v
                      ? "bg-gradient-to-br from-primary to-brand-900 text-white shadow-sm"
                      : "bg-card border border-border text-foreground hover:bg-accent hover:-translate-y-0.5 hover:shadow-sm"
                  }`}
                >
                  <span className="truncate">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="ค้นหาชื่อ / username / อีเมล"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setShowAdd(true)}>
                <Plus className="size-4" /> เพิ่มผู้ใช้
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Result line */}
        {filtered.length !== users.length && (
          <div className="text-sm text-muted-foreground">
            พบ <strong className="text-foreground">{filtered.length}</strong>{" "}
            จาก {totalUsers} คน
          </div>
        )}

        {/* User list */}
        {filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              <UsersIcon className="size-10 mx-auto mb-3 text-muted-foreground/50" />
              ไม่พบผู้ใช้ตามเงื่อนไข
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((u) => (
              <UserCard
                key={u.id}
                user={u}
                isMe={u.id === myId}
                onEdit={() => setEditId(u.id)}
                onDel={() => setDelTarget(u)}
              />
            ))}
          </div>
        )}

        {showAdd && <AddUserDialog onClose={() => setShowAdd(false)} />}
        {editing && <EditUserDialog user={editing} onClose={() => setEditId(null)} />}
      </div>

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title={`ลบ ${delTarget?.full_name ?? ""}?`}
        description={
          <>
            ระบบจะปิด user <strong>@{delTarget?.username}</strong> (soft delete) —
            user จะ login ไม่ได้ แต่ข้อมูลย้อนหลังยังเก็บอยู่
          </>
        }
        confirmText="ลบ"
        variant="danger"
        loading={delPending}
        onConfirm={handleDelete}
      />
    </>
  );
}

// ==================================================================
// KPI Card
// ==================================================================
const KPI_TONE: Record<string, { gradient: string; ring: string }> = {
  primary: { gradient: "bg-gradient-to-br from-blue-500 to-blue-700", ring: "ring-blue-200" },
  amber: { gradient: "bg-gradient-to-br from-amber-400 to-orange-500", ring: "ring-amber-200" },
  emerald: { gradient: "bg-gradient-to-br from-emerald-500 to-emerald-700", ring: "ring-emerald-200" },
  red: { gradient: "bg-gradient-to-br from-red-500 to-rose-600", ring: "ring-red-200" },
  slate: { gradient: "bg-gradient-to-br from-slate-300 to-slate-400", ring: "ring-slate-200" },
};

function KpiCard({
  icon: Icon, label, value, unit, color, subtitle,
}: {
  icon: typeof UsersIcon;
  label: string;
  value: number;
  unit: string;
  color: keyof typeof KPI_TONE;
  subtitle?: string;
}) {
  const tone = KPI_TONE[color];
  return (
    <div className="bg-card border border-border rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 transition-all">
      <div className="flex items-center justify-center gap-3">
        <div className={`flex-shrink-0 size-11 rounded-xl flex items-center justify-center ring-2 shadow-md text-white ${tone.gradient} ${tone.ring}`}>
          <Icon className="size-5" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-muted-foreground">{label}</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold tabular-nums text-foreground leading-none">
              {value.toLocaleString("th-TH")}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{unit}</span>
          </div>
          {subtitle && (
            <div className="text-[10px] text-amber-600 mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================================================================
// User Card
// ==================================================================
function UserCard({
  user: u, isMe, onEdit, onDel,
}: {
  user: User;
  isMe: boolean;
  onEdit: () => void;
  onDel: () => void;
}) {
  const lastLoginDays = u.last_login_at ? ageDays(u.last_login_at) : null;
  const isStale = lastLoginDays !== null && lastLoginDays > 30;
  const neverLoggedIn = !u.last_login_at;
  const isInactive = !u.is_active;

  return (
    <div
      className={`group bg-card border rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all ${
        isInactive ? "border-border opacity-60" : "border-border hover:border-primary/30"
      }`}
    >
      <div className="grid grid-cols-12 gap-4 items-center">
        {/* Avatar + identity */}
        <div className="col-span-12 sm:col-span-4 flex items-center gap-3 min-w-0">
          <UserAvatar
            name={u.full_name}
            seed={u.username}
            role={u.role}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="font-bold text-foreground truncate">
                {u.full_name}
              </div>
              {isMe && (
                <Badge variant="soft" className="text-[10px]">คุณ</Badge>
              )}
              {isInactive && (
                <Badge variant="outline" className="text-[10px] !text-red-600 !border-red-300">
                  ปิดใช้งาน
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
              @{u.username}
            </div>
          </div>
        </div>

        {/* Role + email */}
        <div className="col-span-6 sm:col-span-3 min-w-0">
          <div className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
            {u.role === "admin" ? (
              <Crown className="size-3.5 text-amber-500" />
            ) : (
              <Shield className="size-3.5 text-muted-foreground" />
            )}
            {ROLE_LABEL[u.role]}
          </div>
          {u.email && (
            <div className="text-xs text-muted-foreground truncate inline-flex items-center gap-1 mt-1">
              <Mail className="size-3 flex-shrink-0" />
              <span className="truncate">{u.email}</span>
            </div>
          )}
        </div>

        {/* Last login + warnings */}
        <div className="col-span-6 sm:col-span-3 text-xs space-y-1">
          {/* Last login */}
          <div
            className={`inline-flex items-center gap-1 ${
              neverLoggedIn ? "text-red-600" : isStale ? "text-amber-600" : "text-muted-foreground"
            }`}
            title={u.last_login_at ? `เข้าสู่ระบบล่าสุด ${fmtDateLong(u.last_login_at)}` : "ยังไม่เคย login"}
          >
            <LogIn className="size-3" />
            {neverLoggedIn ? (
              <span className="font-semibold">ยังไม่เคย login</span>
            ) : (
              <>
                <span className="text-muted-foreground/70">login ล่าสุด</span>
                <span className="font-semibold">{ageLabel(lastLoginDays!)}</span>
              </>
            )}
          </div>
          {/* Created date */}
          <div className="text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="size-3" />
            <span className="text-muted-foreground/70">สมัครเมื่อ</span>
            {fmtDate(u.created_at)}
          </div>
          {/* Warnings */}
          {u.must_change_password && (
            <div className="text-amber-600 inline-flex items-center gap-1">
              <AlertTriangle className="size-3" />
              ยังไม่เคยเปลี่ยนรหัส
            </div>
          )}
          {(u.failed_login_count ?? 0) >= 3 && (
            <div className="text-red-600 inline-flex items-center gap-1">
              <CircleAlert className="size-3" />
              login fail {u.failed_login_count} ครั้ง
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="col-span-12 sm:col-span-2 flex justify-end gap-1.5">
          <Button size="sm" variant="secondary" onClick={onEdit}>
            <Edit2 className="size-3.5" /> แก้ไข
          </Button>
          {!isMe && (
            <Button
              size="sm" variant="secondary" onClick={onDel}
              className="!text-red-600 hover:!bg-red-50"
              title="ลบผู้ใช้"
              aria-label="ลบผู้ใช้"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================================================================
// Add User Dialog
// ==================================================================
function AddUserDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "requester">("requester");
  const [email, setEmail] = useState("");
  const [sendEmailFlag, setSendEmailFlag] = useState(true);

  function handleSubmit() {
    setError(null);
    if (sendEmailFlag && !email.trim()) {
      setError('ต้องใส่อีเมลถ้าจะส่งคำแจ้ง — หรือ uncheck "ส่งอีเมล"');
      return;
    }
    startTransition(async () => {
      const res = await createUserAction({
        username, password, fullName, role, email,
        sendEmail: sendEmailFlag,
      });
      if (!res.ok) {
        setError(res.error ?? "เพิ่มไม่สำเร็จ");
        return;
      }
      let msg = `เพิ่ม ${fullName} สำเร็จ`;
      if (sendEmailFlag && email) {
        msg += res.emailSent
          ? " — ส่งอีเมลแล้ว 📧"
          : ` — ⚠️ ส่งอีเมลไม่ได้: ${res.emailError ?? "SMTP ไม่ได้ตั้ง"}`;
      }
      toast.success(msg);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Plus className="size-4" strokeWidth={2.5} />
            </span>
            เพิ่มผู้ใช้ใหม่
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Username *</label>
              <Input
                value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="staff1" disabled={pending}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Role</label>
              <div className="grid grid-cols-2 gap-1 bg-muted rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setRole("requester")}
                  className={`h-9 rounded-md text-xs font-semibold transition-all ${
                    role === "requester"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Staff
                </button>
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`h-9 rounded-md text-xs font-semibold transition-all ${
                    role === "admin"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  แอดมิน
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">ชื่อ-นามสกุล *</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={pending} />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">
              รหัสผ่านชั่วคราว *
            </label>
            <Input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="อย่างน้อย 8 ตัว มีตัวอักษร + ตัวเลข"
              disabled={pending}
            />
            <div className="text-[11px] text-muted-foreground mt-1">
              💡 user จะถูกบังคับเปลี่ยนรหัสตอน login ครั้งแรก
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">อีเมล</label>
            <Input
              type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com" disabled={pending}
            />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox" checked={sendEmailFlag}
              onChange={(e) => setSendEmailFlag(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary"
            />
            <span className="text-foreground">
              📧 ส่งอีเมลแจ้ง user (พร้อม username + รหัสผ่านชั่วคราว)
            </span>
          </label>
          {error && <Alert tone="danger">❌ {error}</Alert>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Button>
          <Button onClick={handleSubmit} loading={pending}>
            <Plus className="size-4" /> เพิ่มผู้ใช้
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================================================================
// Edit User Dialog
// ==================================================================
function EditUserDialog({
  user: u, onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(u.full_name);
  const [email, setEmail] = useState(u.email ?? "");
  const [role, setRole] = useState<"admin" | "requester">(u.role);
  const [isActive, setIsActive] = useState(u.is_active);
  const [newPassword, setNewPassword] = useState("");

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const res = await updateUserAction(u.id, {
        fullName, email, role, isActive,
        newPassword: newPassword || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      toast.success(`✅ บันทึกข้อมูล ${fullName} สำเร็จ`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <UserAvatar name={u.full_name} seed={u.username} role={u.role} size="md" />
            <div>
              <div>แก้ไข — {u.full_name}</div>
              <div className="text-xs font-normal text-muted-foreground font-mono">@{u.username}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">ชื่อ-นามสกุล</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={pending} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">Role</label>
              <div className="grid grid-cols-2 gap-1 bg-muted rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setRole("requester")}
                  className={`h-9 rounded-md text-xs font-semibold transition-all ${
                    role === "requester"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Staff
                </button>
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={`h-9 rounded-md text-xs font-semibold transition-all ${
                    role === "admin"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  แอดมิน
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-foreground mb-1">สถานะ</label>
              <label className="h-10 px-3 rounded-lg border border-input bg-background inline-flex items-center gap-2 text-sm cursor-pointer w-full">
                <input
                  type="checkbox" checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary"
                />
                <span className="text-foreground">{isActive ? "ใช้งาน" : "ปิดใช้งาน"}</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">อีเมล</label>
            <Input
              type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground mb-1">
              เปลี่ยนรหัสผ่าน <span className="text-muted-foreground font-normal">(เว้นว่าง = ไม่เปลี่ยน)</span>
            </label>
            <Input
              type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="รหัสใหม่ (อย่างน้อย 8 ตัว)" disabled={pending}
            />
            <div className="text-[11px] text-muted-foreground mt-1">
              💡 user จะถูกบังคับเปลี่ยนรหัสตอน login ครั้งถัดไป
            </div>
          </div>

          {/* Last login info (read-only) */}
          {u.last_login_at && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs space-y-1">
              <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                <LogIn className="size-3" />
                <span>เข้าสู่ระบบล่าสุด:</span>
                <span className="font-semibold text-foreground">
                  {fmtDateLong(u.last_login_at)}
                </span>
              </div>
              {u.password_changed_at && (
                <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Shield className="size-3" />
                  <span>เปลี่ยนรหัสล่าสุด:</span>
                  <span className="font-semibold text-foreground">
                    {fmtDate(u.password_changed_at)}
                  </span>
                </div>
              )}
            </div>
          )}

          {error && <Alert tone="danger">❌ {error}</Alert>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            ยกเลิก
          </Button>
          <Button onClick={handleSubmit} loading={pending}>
            💾 บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==================================================================
// Helpers
// ==================================================================
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH",
      { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return String(d);
  }
}

function fmtDateLong(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH", {
      weekday: "short", day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

function ageDays(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000));
}

function ageLabel(days: number): string {
  if (days === 0) return "วันนี้";
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันก่อน`;
  if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ก่อน`;
  if (days < 365) return `${Math.floor(days / 30)} เดือนก่อน`;
  return `${Math.floor(days / 365)} ปีก่อน`;
}
