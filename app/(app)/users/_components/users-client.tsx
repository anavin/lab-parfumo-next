"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2, Trash2, Shield, X, Mail, Calendar, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/lib/types/db";
import {
  createUserAction, updateUserAction, deleteUserAction,
} from "@/lib/actions/users";

const ROLE_LABEL = { admin: "แอดมิน + จัดซื้อ", requester: "ผู้สั่ง" };

export function UsersClient({
  users, myId,
}: {
  users: User[];
  myId: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const editing = editId ? users.find((u) => u.id === editId) : null;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5" /> เพิ่มผู้ใช้
        </Button>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <UserCard
            key={u.id}
            user={u}
            isMe={u.id === myId}
            confirmDel={confirmDel === u.id}
            onEdit={() => setEditId(u.id)}
            onDel={() => setConfirmDel(u.id)}
            onCancelDel={() => setConfirmDel(null)}
          />
        ))}
      </div>

      {showAdd && <AddUserDialog onClose={() => setShowAdd(false)} />}
      {editing && <EditUserDialog user={editing} onClose={() => setEditId(null)} />}
    </div>
  );
}

function UserCard({
  user: u, isMe, confirmDel, onEdit, onDel, onCancelDel,
}: {
  user: User;
  isMe: boolean;
  confirmDel: boolean;
  onEdit: () => void;
  onDel: () => void;
  onCancelDel: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDel() {
    startTransition(async () => {
      await deleteUserAction(u.id);
      router.refresh();
    });
  }

  return (
    <Card className="hover:shadow-md hover:border-primary/30 transition-all">
      <CardContent className="p-4">
        <div className="grid grid-cols-12 gap-4 items-center">
          {/* Avatar + name */}
          <div className="col-span-12 sm:col-span-4 flex items-center gap-3 min-w-0">
            <UserAvatar
              name={u.full_name}
              seed={u.username}
              role={u.role}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="font-semibold text-foreground truncate">
                  {u.full_name}
                </div>
                {isMe && (
                  <Badge variant="soft" className="text-[10px]">คุณ</Badge>
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
              <Shield className="size-3.5 text-muted-foreground" />
              {ROLE_LABEL[u.role]}
            </div>
            {u.email && (
              <div className="text-xs text-muted-foreground truncate inline-flex items-center gap-1 mt-1">
                <Mail className="size-3 flex-shrink-0" />
                <span className="truncate">{u.email}</span>
              </div>
            )}
          </div>

          {/* Date + warnings */}
          <div className="col-span-6 sm:col-span-2 text-xs text-muted-foreground space-y-1">
            <div className="inline-flex items-center gap-1">
              <Calendar className="size-3" />
              {fmtDate(u.created_at)}
            </div>
            {u.must_change_password && (
              <div className="text-amber-600 inline-flex items-center gap-1">
                <AlertTriangle className="size-3" />
                ยังไม่เคยเปลี่ยนรหัส
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="col-span-12 sm:col-span-3 flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={onEdit}>
              <Edit2 className="h-3.5 w-3.5" /> แก้ไข
            </Button>
            {!isMe && (
              confirmDel ? (
                <>
                  <Button size="sm" variant="primary"
                          loading={pending} onClick={handleDel}
                          className="!from-red-600 !to-red-700">
                    ⚠️ ยืนยัน
                  </Button>
                  <button
                    type="button" onClick={onCancelDel}
                    className="text-xs text-muted-foreground underline">
                    ยกเลิก
                  </button>
                </>
              ) : (
                <Button size="sm" variant="secondary" onClick={onDel}
                        className="!text-red-600 hover:!bg-red-50">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddUserDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "requester">("requester");
  const [email, setEmail] = useState("");
  const [sendEmailFlag, setSendEmailFlag] = useState(true);

  function handleSubmit() {
    setError(null);
    setSuccess(null);
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
      let msg = `✅ เพิ่ม ${fullName} แล้ว`;
      if (sendEmailFlag && email) {
        msg += res.emailSent
          ? " • 📧 ส่งอีเมลแล้ว"
          : ` • ⚠️ ส่งอีเมลไม่ได้: ${res.emailError ?? "SMTP ไม่ได้ตั้ง"}`;
      }
      setSuccess(msg);
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 1500);
    });
  }

  return (
    <Modal title="➕ เพิ่มผู้ใช้ใหม่" onClose={onClose} pending={pending}>
      <div className="space-y-3 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)}
                   placeholder="staff1" disabled={pending} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={role}
                    onChange={(e) => setRole(e.target.value as "admin" | "requester")}
                    className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm">
              <option value="requester">ผู้สั่ง</option>
              <option value="admin">แอดมิน + จัดซื้อ</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ-นามสกุล *</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                 disabled={pending} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            รหัสผ่านชั่วคราว *
            <span className="text-[11px] text-slate-400 ml-1">(user จะถูกบังคับเปลี่ยนตอน login ครั้งแรก)</span>
          </label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                 placeholder="อย่างน้อย 8 ตัว มีตัวอักษร + ตัวเลข" disabled={pending} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                 placeholder="user@example.com" disabled={pending} />
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={sendEmailFlag}
                 onChange={(e) => setSendEmailFlag(e.target.checked)}
                 className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          <span className="text-sm text-slate-700">
            📧 ส่งอีเมลแจ้ง user (พร้อม username + รหัสผ่านชั่วคราว)
          </span>
        </label>
        {error && <Alert tone="danger">❌ {error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}
      </div>
      <div className="flex gap-2 p-5 pt-3 border-t border-slate-200">
        <Button onClick={handleSubmit} loading={pending}>✅ เพิ่ม</Button>
        <Button variant="secondary" onClick={onClose} disabled={pending}>ยกเลิก</Button>
      </div>
    </Modal>
  );
}

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
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal title={`✏️ แก้ไข — ${u.full_name}`} onClose={onClose} pending={pending}>
      <div className="space-y-3 p-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อ-นามสกุล</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)}
                 disabled={pending} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
            <select value={role}
                    onChange={(e) => setRole(e.target.value as "admin" | "requester")}
                    className="h-11 w-full px-3 rounded-lg border border-slate-300 bg-white text-sm">
              <option value="requester">ผู้สั่ง</option>
              <option value="admin">แอดมิน + จัดซื้อ</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">สถานะ</label>
            <label className="h-11 px-3 rounded-lg border border-slate-300 bg-white inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                     className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              ใช้งาน
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                 disabled={pending} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            เปลี่ยนรหัสผ่าน
            <span className="text-[11px] text-slate-400 ml-1">(เว้นว่าง = ไม่เปลี่ยน)</span>
          </label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                 placeholder="รหัสใหม่ (อย่างน้อย 8 ตัว)" disabled={pending} />
          <div className="text-[11px] text-slate-400 mt-1">
            💡 user จะถูกบังคับเปลี่ยนรหัสตอน login ครั้งถัดไป
          </div>
        </div>
        {error && <Alert tone="danger">❌ {error}</Alert>}
      </div>
      <div className="flex gap-2 p-5 pt-3 border-t border-slate-200">
        <Button onClick={handleSubmit} loading={pending}>💾 บันทึก</Button>
        <Button variant="secondary" onClick={onClose} disabled={pending}>ยกเลิก</Button>
      </div>
    </Modal>
  );
}

function Modal({
  title, onClose, pending, children,
}: {
  title: string;
  onClose: () => void;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} disabled={pending}
                  className="text-slate-400 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH",
      { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return String(d);
  }
}
