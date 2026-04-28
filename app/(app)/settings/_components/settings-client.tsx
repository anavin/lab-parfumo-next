"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building, Lock, Save, Mail, Send, CheckCircle2, AlertCircle, Eye, EyeOff,
  Server, Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/cn";
import { toast } from "sonner";
import {
  updateCompanySettingsAction,
  updateEmailSettingsAction,
  clearEmailSettingsAction,
  testEmailAction,
  verifyEmailAction,
} from "@/lib/actions/settings";

export interface CompanySettings {
  name: string;
  name_th: string;
  address: string;
  phone: string;
  email: string;
  tax_id: string;
  website: string;
  login_intro_visible: boolean;
  login_intro_title: string;
  login_intro_text: string;
  login_intro_note: string;
  updated_at: string;
  updated_by_name: string;
}

export interface EmailUiSettings {
  host: string;
  port: number;
  user: string;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  secure: boolean;
  source: "env" | "db" | "none" | "migration-needed" | "db-error";
  errorDetail?: string;
  managedByEnv: boolean;
  encryptionAvailable: boolean;
  passwordEncrypted: boolean;
}

interface EmailDiagnostic {
  ok: boolean;
  message: string;        // ภาษาไทย — สั้น
  detail?: string;         // technical
  kind?: "auth" | "connect" | "from" | "send" | "not-configured" | "migration-needed" | "db-error" | "ok";
  testedAt: number;        // timestamp
}

type Tab = "company" | "login" | "email";

export function SettingsClient({
  initial, email, adminEmail,
}: {
  initial: CompanySettings;
  email: EmailUiSettings;
  adminEmail: string;
}) {
  const [tab, setTab] = useState<Tab>("company");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        <TabButton active={tab === "company"} onClick={() => setTab("company")}
                    icon={<Building className="h-4 w-4" />} label="ข้อมูลบริษัท" />
        <TabButton active={tab === "login"} onClick={() => setTab("login")}
                    icon={<Lock className="h-4 w-4" />} label="หน้า Login" />
        <TabButton active={tab === "email"} onClick={() => setTab("email")}
                    icon={<Mail className="h-4 w-4" />} label="อีเมล (SMTP)"
                    badge={email.source === "none" ? "ยังไม่ตั้ง" : undefined} />
      </div>

      {tab === "company" && <CompanyForm initial={initial} />}
      {tab === "login" && <LoginIntroForm initial={initial} />}
      {tab === "email" && <EmailForm initial={email} adminEmail={adminEmail} />}
    </div>
  );
}

function TabButton({
  active, onClick, icon, label, badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
        active
          ? "border-brand-700 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-900",
      )}
    >
      {icon}
      {label}
      {badge && (
        <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

// ==================================================================
// Company info form
// ==================================================================
function CompanyForm({ initial }: { initial: CompanySettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial.name);
  const [nameTh, setNameTh] = useState(initial.name_th);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [taxId, setTaxId] = useState(initial.tax_id);
  const [website, setWebsite] = useState(initial.website);

  function handleSubmit() {
    setError(null);
    setSuccess(false);
    if (!name.trim()) {
      setError("กรุณากรอกชื่อบริษัท");
      return;
    }
    startTransition(async () => {
      const res = await updateCompanySettingsAction({
        name: name.trim(),
        name_th: nameTh.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        tax_id: taxId.trim(),
        website: website.trim(),
      });
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <p className="text-xs text-slate-500">
          ข้อมูลที่แสดงใน PDF ใบ PO + ใบรับของ + ทั้งระบบ
        </p>

        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2">🏢 ข้อมูลพื้นฐาน</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ชื่อบริษัท (อังกฤษ) *
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)}
                     placeholder="Lab Parfumo Co., Ltd." disabled={pending} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ชื่อบริษัท (ไทย)
              </label>
              <Input value={nameTh} onChange={(e) => setNameTh(e.target.value)}
                     placeholder="บริษัท ทัช ไดเวอร์เจนซ์ จำกัด" disabled={pending} />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">ที่อยู่</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="เลขที่ ... ถนน ... แขวง ... เขต ... กรุงเทพฯ 10000"
              rows={2}
              disabled={pending}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:border-brand-600 disabled:bg-slate-50"
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2">📞 ติดต่อ</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">โทรศัพท์</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)}
                     placeholder="02-xxx-xxxx" disabled={pending} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">อีเมล</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="contact@labparfumo.com" disabled={pending} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                เลขผู้เสียภาษี
                <span className="text-[11px] text-slate-400 ml-1">(แสดงใน PDF)</span>
              </label>
              <Input value={taxId} onChange={(e) => setTaxId(e.target.value)}
                     placeholder="0-1055-64xxx-xx-x" disabled={pending} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">เว็บไซต์</label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)}
                     placeholder="www.labparfumo.com" disabled={pending} />
            </div>
          </div>
        </div>

        {error && <Alert tone="danger">❌ {error}</Alert>}
        {success && <Alert tone="success">✅ บันทึกแล้ว — PDF จะใช้ข้อมูลใหม่ครั้งต่อไป</Alert>}

        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <Button onClick={handleSubmit} loading={pending}>
            <Save className="h-4 w-4" /> บันทึก
          </Button>
          <p className="text-xs text-slate-500 text-right">
            📅 อัปเดต: {initial.updated_at ? fmtDateTime(initial.updated_at) : "ยังไม่เคย"}
            {initial.updated_by_name && ` • โดย ${initial.updated_by_name}`}
          </p>
        </div>

        {/* Preview */}
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 mb-2">👁️ ตัวอย่างที่แสดงใน PDF</h3>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-base font-bold text-slate-900">{name || "—"}</div>
            {nameTh && <div className="text-sm text-slate-600">{nameTh}</div>}
            {address && <div className="text-xs text-slate-500 mt-1">{address}</div>}
            <div className="text-xs text-slate-500 mt-1">
              {phone && `โทร: ${phone}`}
              {phone && email && " | "}
              {email && `อีเมล: ${email}`}
            </div>
            {taxId && (
              <div className="text-xs text-slate-500 mt-0.5">เลขผู้เสียภาษี: {taxId}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================================================================
// Login intro form
// ==================================================================
function LoginIntroForm({ initial }: { initial: CompanySettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [visible, setVisible] = useState(initial.login_intro_visible);
  const [title, setTitle] = useState(initial.login_intro_title);
  const [text, setText] = useState(initial.login_intro_text);
  const [note, setNote] = useState(initial.login_intro_note);

  function handleSubmit() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await updateCompanySettingsAction({
        login_intro_visible: visible,
        login_intro_title: title.trim(),
        login_intro_text: text.trim(),
        login_intro_note: note.trim(),
      });
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    });
  }

  function handleClear() {
    startTransition(async () => {
      await updateCompanySettingsAction({
        login_intro_visible: false,
        login_intro_title: "",
        login_intro_text: "",
        login_intro_note: "",
      });
      setVisible(false);
      setTitle("");
      setText("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <Alert tone="info">
          💡 <strong>เคล็ดลับ:</strong> หลังจากที่ user ทุกคนตั้งรหัสของตัวเองแล้ว
          อาจจะ <strong>ปิดข้อความนี้</strong> เพื่อความปลอดภัย
        </Alert>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          <span className="text-sm font-semibold">
            แสดงข้อความบนหน้า Login
          </span>
        </label>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">หัวข้อกล่อง</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder="ℹ️ บัญชีเริ่มต้น" disabled={pending} />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            เนื้อหา (รายชื่อบัญชี / ข้อความ)
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"admin / admin123     → Admin\nstaff1 / staff123    → Staff"}
            rows={5}
            disabled={pending}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-mono focus:outline-none focus:border-brand-600 disabled:bg-slate-50"
          />
          <p className="text-xs text-slate-500 mt-1">
            เขียนเป็นบรรทัดได้หลายบรรทัด — แสดงเป็นกล่อง code
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            หมายเหตุ (caption ด้านล่าง)
          </label>
          <Input value={note} onChange={(e) => setNote(e.target.value)}
                 placeholder="⚠️ ครั้งแรก ระบบจะบังคับเปลี่ยนรหัสผ่าน" disabled={pending} />
        </div>

        {error && <Alert tone="danger">❌ {error}</Alert>}
        {success && <Alert tone="success">✅ บันทึกแล้ว — เปิดหน้า Login ใหม่จะเห็นการเปลี่ยนแปลง</Alert>}

        <div className="flex gap-2 pt-2 border-t border-slate-200">
          <Button onClick={handleSubmit} loading={pending}>
            <Save className="h-4 w-4" /> บันทึก
          </Button>
          <Button variant="secondary" onClick={handleClear} disabled={pending}>
            🗑️ ล้างข้อความทั้งหมด
          </Button>
        </div>

        {/* Preview */}
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-bold text-slate-900 mb-2">👁️ ตัวอย่างหน้า Login</h3>
          {visible && text ? (
            <details className="bg-white border border-slate-200 rounded-lg p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                {title || "ℹ️ บัญชีเริ่มต้น"}
              </summary>
              <pre className="mt-3 bg-slate-100 rounded p-3 text-xs font-mono text-slate-800 whitespace-pre-wrap">
                {text}
              </pre>
              {note && <p className="text-xs text-slate-500 mt-2">{note}</p>}
            </details>
          ) : (
            <p className="text-xs text-slate-400 italic">
              👁️‍🗨️ ปิดอยู่ — ไม่แสดงในหน้า Login
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ==================================================================
// Email/SMTP form
// ==================================================================
type Preset = { name: string; host: string; port: number; secure: boolean; help?: string };
const PRESETS: Preset[] = [
  { name: "Gmail", host: "smtp.gmail.com", port: 587, secure: false, help: "ต้องใช้ App Password (ไม่ใช่รหัส Gmail ปกติ)" },
  { name: "Resend", host: "smtp.resend.com", port: 587, secure: false, help: "Username = 'resend', Password = API Key" },
  { name: "SendGrid", host: "smtp.sendgrid.net", port: 587, secure: false, help: "Username = 'apikey', Password = API Key" },
  { name: "Outlook", host: "smtp-mail.outlook.com", port: 587, secure: false },
  { name: "Custom", host: "", port: 587, secure: false },
];

function EmailForm({ initial, adminEmail }: { initial: EmailUiSettings; adminEmail: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [testing, startTesting] = useTransition();
  const [verifying, startVerifying] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<EmailDiagnostic | null>(null);

  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(String(initial.port));
  const [user, setUser] = useState(initial.user);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fromEmail, setFromEmail] = useState(initial.fromEmail);
  const [fromName, setFromName] = useState(initial.fromName || "Lab Parfumo PO");
  const [secure, setSecure] = useState(initial.secure);

  const [testTo, setTestTo] = useState(adminEmail || "");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const isConfigured = initial.source === "env" || initial.source === "db";
  const isMigrationNeeded = initial.source === "migration-needed";
  const isDbError = initial.source === "db-error";
  const managedByEnv = initial.managedByEnv;

  function applyPreset(p: Preset) {
    setHost(p.host);
    setPort(String(p.port));
    setSecure(p.secure);
    if (p.help) toast.info(p.help, { duration: 5000 });
  }

  function handleSubmit() {
    setError(null);
    if (!host.trim()) {
      setError("กรุณากรอก SMTP Host");
      return;
    }
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError("Port ไม่ถูกต้อง (1-65535)");
      return;
    }
    if (!user.trim()) {
      setError("กรุณากรอก Username");
      return;
    }
    if (!initial.hasPassword && !password) {
      setError("กรุณากรอก Password");
      return;
    }
    if (!fromEmail.trim()) {
      setError("กรุณากรอก From Email");
      return;
    }

    startTransition(async () => {
      const res = await updateEmailSettingsAction({
        smtp_host: host.trim(),
        smtp_port: portNum,
        smtp_user: user.trim(),
        smtp_password: password, // ถ้า empty → คงค่าเดิม
        smtp_from_email: fromEmail.trim(),
        smtp_from_name: fromName.trim(),
        smtp_secure: secure,
      });
      if (!res.ok) {
        setError(res.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      toast.success("บันทึกแล้ว — ลองกดทดสอบส่งอีเมลด้านล่าง");
      setPassword("");
      router.refresh();
    });
  }

  function handleVerify() {
    setDiagnostic(null);
    startVerifying(async () => {
      const r = await verifyEmailAction();
      if (r.ok) {
        setDiagnostic({
          ok: true,
          message: "เชื่อมต่อ SMTP สำเร็จ — Username/Password ถูกต้อง",
          kind: "ok",
          testedAt: Date.now(),
        });
        toast.success("✅ เชื่อมต่อ SMTP สำเร็จ");
      } else {
        setDiagnostic({
          ok: false,
          message: r.error ?? "ตรวจสอบไม่สำเร็จ",
          detail: r.errorDetail,
          kind: r.errorKind ?? "send",
          testedAt: Date.now(),
        });
      }
    });
  }

  function handleTest() {
    if (!testTo.trim()) {
      toast.error("กรอกอีเมลที่จะทดสอบ");
      return;
    }
    setDiagnostic(null);
    startTesting(async () => {
      const r = await testEmailAction(testTo.trim());
      if (r.ok) {
        setDiagnostic({
          ok: true,
          message: `ส่งอีเมลทดสอบไปยัง ${testTo} แล้ว — ตรวจ inbox (รวม Spam)`,
          kind: "ok",
          testedAt: Date.now(),
        });
        toast.success(`📨 ส่งทดสอบไปยัง ${testTo} แล้ว`);
      } else {
        setDiagnostic({
          ok: false,
          message: r.error ?? "ส่งไม่สำเร็จ",
          detail: r.errorDetail,
          kind: r.errorKind ?? "send",
          testedAt: Date.now(),
        });
      }
    });
  }

  function handleClear() {
    startTransition(async () => {
      const r = await clearEmailSettingsAction();
      if (!r.ok) {
        toast.error(r.error ?? "ล้างไม่สำเร็จ");
        return;
      }
      setHost(""); setPort("587"); setUser(""); setPassword("");
      setFromEmail(""); setFromName("Lab Parfumo PO"); setSecure(false);
      toast.success("ล้างค่า SMTP แล้ว — ระบบจะหยุดส่งอีเมล");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        {/* Status banner — 4 states */}
        {isMigrationNeeded ? (
          <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-red-50 border-red-300">
            <div className="flex-shrink-0 size-9 rounded-lg flex items-center justify-center bg-red-500">
              <AlertCircle className="size-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-red-900">
                🔴 ต้องรัน Database Migration ก่อน
              </div>
              <div className="text-xs mt-1 text-red-800 leading-relaxed">
                ตาราง <code className="bg-red-100 px-1 py-0.5 rounded font-mono text-[11px]">company_settings</code> ยังไม่มี column <code className="bg-red-100 px-1 py-0.5 rounded font-mono text-[11px]">smtp_*</code> —
                เปิด <strong>Supabase Dashboard → SQL Editor</strong> แล้วรันไฟล์
                <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono text-[11px] mx-1">migrations/202604_email_settings.sql</code>
              </div>
              <details className="mt-2">
                <summary className="text-[11px] text-red-600 cursor-pointer font-semibold">
                  ดู SQL ที่ต้องรัน
                </summary>
                <pre className="mt-2 bg-white border border-red-200 rounded p-2 text-[10px] font-mono overflow-x-auto">
{`ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS smtp_host TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_port INT DEFAULT 587,
  ADD COLUMN IF NOT EXISTS smtp_user TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_password TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_from_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_from_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT FALSE;`}
                </pre>
                {initial.errorDetail && (
                  <div className="mt-2 text-[10px] text-red-500 font-mono break-all">
                    DB error: {initial.errorDetail}
                  </div>
                )}
              </details>
            </div>
          </div>
        ) : isDbError ? (
          <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-red-50 border-red-300">
            <div className="flex-shrink-0 size-9 rounded-lg flex items-center justify-center bg-red-500">
              <AlertCircle className="size-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-red-900">
                🔴 อ่านค่าจาก Database ไม่ได้
              </div>
              <div className="text-xs mt-1 text-red-800">
                ตรวจการเชื่อมต่อ Supabase + service role key
              </div>
              {initial.errorDetail && (
                <div className="mt-1.5 text-[10px] text-red-600 font-mono break-all bg-white border border-red-200 rounded px-2 py-1">
                  {initial.errorDetail}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={cn(
            "flex items-start gap-3 p-3.5 rounded-xl border",
            isConfigured
              ? "bg-emerald-50 border-emerald-200"
              : "bg-amber-50 border-amber-200",
          )}>
            <div className={cn(
              "flex-shrink-0 size-9 rounded-lg flex items-center justify-center",
              isConfigured ? "bg-emerald-500" : "bg-amber-500",
            )}>
              {isConfigured
                ? <CheckCircle2 className="size-5 text-white" />
                : <AlertCircle className="size-5 text-white" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "text-sm font-bold",
                isConfigured ? "text-emerald-900" : "text-amber-900",
              )}>
                {isConfigured
                  ? `🟢 ตั้งค่าแล้ว (${initial.source === "env" ? "จาก Environment Variables" : "จาก Database"})`
                  : "🟡 ยังไม่ตั้งค่า — ระบบจะไม่ส่งอีเมล"
                }
              </div>
              <div className={cn(
                "text-xs mt-0.5",
                isConfigured ? "text-emerald-700" : "text-amber-700",
              )}>
                {isConfigured
                  ? `${initial.host}:${initial.port} • ${initial.user}`
                  : "อีเมลต้อนรับเมื่อสร้าง user ใหม่ + Daily digest จะไม่ทำงาน"
                }
              </div>
            </div>
          </div>
        )}

        {managedByEnv && (
          <Alert tone="info">
            🔒 <strong>SMTP ตั้งค่าผ่าน Environment Variables</strong> —
            ฟอร์มด้านล่างเป็น read-only เพื่อแสดงค่าปัจจุบัน
            <div className="text-xs mt-1 text-slate-500">
              ถ้าจะแก้ผ่าน UI ให้ลบ env: <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code> ใน Vercel
            </div>
          </Alert>
        )}

        {/* Password encryption status — แสดงเมื่อใช้ DB source */}
        {!managedByEnv && initial.source === "db" && initial.hasPassword && (
          initial.passwordEncrypted ? (
            <Alert tone="success">
              🔐 <strong>Password ถูก encrypt แล้ว</strong> (AES-256-GCM)
              — ปลอดภัยจากการเข้าถึง DB โดยตรง
            </Alert>
          ) : (
            <Alert tone="warning">
              ⚠️ <strong>Password ยังเก็บแบบ plaintext ใน DB</strong>
              {initial.encryptionAvailable ? (
                <div className="text-xs mt-1 text-slate-600">
                  Encryption key พร้อมใช้แล้ว — กดบันทึกฟอร์มอีกครั้ง (กรอก password ซ้ำ) เพื่อ encrypt
                </div>
              ) : (
                <div className="text-xs mt-1 text-slate-600">
                  ตั้ง env <code className="bg-amber-100 px-1 rounded">ENCRYPTION_KEY</code> ใน Vercel:
                  <br />
                  1. Generate: <code className="bg-amber-100 px-1 rounded">openssl rand -hex 32</code>
                  <br />
                  2. Vercel → Settings → Environment Variables → Add <code>ENCRYPTION_KEY</code>
                  <br />
                  3. Redeploy → กดบันทึก SMTP ฟอร์มอีกครั้ง
                </div>
              )}
            </Alert>
          )
        )}

        {/* Presets */}
        {!managedByEnv && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              ⚡ Quick setup
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p)}
                  disabled={pending}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 hover:border-brand-300 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Server config */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2 inline-flex items-center gap-1.5">
            <Server className="size-4 text-brand-600" />
            SMTP Server
          </h3>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Host *</label>
              <Input value={host} onChange={(e) => setHost(e.target.value)}
                     placeholder="smtp.gmail.com"
                     disabled={pending || managedByEnv} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Port *</label>
              <Input type="number" value={port}
                     onChange={(e) => setPort(e.target.value)}
                     placeholder="587"
                     disabled={pending || managedByEnv} />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={secure}
              onChange={(e) => setSecure(e.target.checked)}
              disabled={pending || managedByEnv}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <span className="text-xs text-slate-700">
              ใช้ SSL/TLS โดยตรง <span className="text-slate-400">(เปิดเฉพาะ port 465 — port 587 ใช้ STARTTLS อัตโนมัติ)</span>
            </span>
          </label>
        </div>

        {/* Auth */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2 inline-flex items-center gap-1.5">
            <Lock className="size-4 text-brand-600" />
            Authentication
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username *</label>
              <Input value={user} onChange={(e) => setUser(e.target.value)}
                     placeholder="you@gmail.com"
                     disabled={pending || managedByEnv} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password *
                {initial.hasPassword && (
                  <span className="text-[11px] text-emerald-600 ml-1.5 font-normal">
                    (มีอยู่แล้ว — เว้นว่างถ้าไม่เปลี่ยน)
                  </span>
                )}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={initial.hasPassword ? "•••••••• (เก็บไว้)" : "App Password / API Key"}
                  disabled={pending || managedByEnv}
                  className="pr-10"
                />
                {!managedByEnv && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* From */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-2 inline-flex items-center gap-1.5">
            <Mail className="size-4 text-brand-600" />
            ผู้ส่ง (From)
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">From Email *</label>
              <Input type="email" value={fromEmail}
                     onChange={(e) => setFromEmail(e.target.value)}
                     placeholder="noreply@labparfumo.com"
                     disabled={pending || managedByEnv} />
              <p className="text-[11px] text-slate-500 mt-1">
                ปกติให้ตรงกับ Username (Gmail บังคับ)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">From Name</label>
              <Input value={fromName}
                     onChange={(e) => setFromName(e.target.value)}
                     placeholder="Lab Parfumo PO"
                     disabled={pending || managedByEnv} />
              <p className="text-[11px] text-slate-500 mt-1">
                ชื่อที่ผู้รับเห็นในกล่อง inbox
              </p>
            </div>
          </div>
        </div>

        {error && <Alert tone="danger">❌ {error}</Alert>}

        {/* Actions */}
        {!managedByEnv && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
            <Button onClick={handleSubmit} loading={pending}>
              <Save className="h-4 w-4" /> บันทึก
            </Button>
            {isConfigured && (
              <Button
                variant="secondary"
                onClick={() => setConfirmClearOpen(true)}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4" /> ล้างค่า
              </Button>
            )}
          </div>
        )}

        {/* Test & Verify section */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
              <Send className="size-4 text-brand-600" />
              ทดสอบ SMTP
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              <strong>ตรวจสอบ</strong> = test connection อย่างเดียว (ไม่ส่งจริง) •
              <strong> ส่งทดสอบ</strong> = ส่งอีเมลจริงไปยังที่ระบุ
            </p>
          </div>

          {/* Verify button — separate row */}
          <div>
            <Button
              variant="secondary"
              onClick={handleVerify}
              loading={verifying}
              disabled={!isConfigured || pending || testing}
              className="w-full sm:w-auto"
            >
              <CheckCircle2 className="h-4 w-4" /> ตรวจสอบการเชื่อมต่อ
            </Button>
          </div>

          {/* Test send — input + button */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              ส่งอีเมลทดสอบไปยัง:
            </label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@example.com"
                disabled={testing || !isConfigured}
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={handleTest}
                loading={testing}
                disabled={!isConfigured || verifying || pending}
              >
                <Send className="h-4 w-4" /> ส่งทดสอบ
              </Button>
            </div>
          </div>

          {!isConfigured && !isMigrationNeeded && !isDbError && (
            <p className="text-xs text-amber-600">
              ⚠️ บันทึก SMTP ก่อน ถึงจะทดสอบได้
            </p>
          )}

          {/* Persistent diagnostic result */}
          {diagnostic && (
            <DiagnosticPanel
              diagnostic={diagnostic}
              onDismiss={() => setDiagnostic(null)}
            />
          )}
        </div>

        {/* Help */}
        <details className="pt-4 border-t border-slate-200">
          <summary className="cursor-pointer text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
            💡 วิธีตั้งค่า Gmail / Resend / SendGrid
          </summary>
          <div className="mt-3 space-y-3 text-xs text-slate-600">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="font-bold text-slate-900 mb-1">📧 Gmail (ฟรี — 500 emails/วัน)</div>
              <ol className="list-decimal list-inside space-y-1 text-slate-600">
                <li>เปิด <a className="text-brand-700 underline" href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer">2-Step Verification</a> ใน Google Account</li>
                <li>สร้าง <a className="text-brand-700 underline" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">App Password</a> (ไม่ใช่รหัส Gmail ปกติ)</li>
                <li>กดปุ่ม <strong>Gmail</strong> ด้านบน → ใส่ email ใน Username + paste 16-digit App Password ใน Password</li>
              </ol>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="font-bold text-slate-900 mb-1">📨 Resend (ฟรี — 3,000 emails/เดือน)</div>
              <ol className="list-decimal list-inside space-y-1 text-slate-600">
                <li>สมัคร + ขอ API key ที่ <a className="text-brand-700 underline" href="https://resend.com" target="_blank" rel="noopener noreferrer">resend.com</a></li>
                <li>กดปุ่ม <strong>Resend</strong> ด้านบน</li>
                <li>Username = <code>resend</code> | Password = API key (เริ่มด้วย <code>re_</code>)</li>
                <li>From email = <code>onboarding@resend.dev</code> (สำหรับเทส) หรือ domain ที่ verify แล้ว</li>
              </ol>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="font-bold text-slate-900 mb-1">📮 SendGrid (ฟรี — 100 emails/วัน)</div>
              <ol className="list-decimal list-inside space-y-1 text-slate-600">
                <li>สมัคร + สร้าง API key ที่ <a className="text-brand-700 underline" href="https://sendgrid.com" target="_blank" rel="noopener noreferrer">sendgrid.com</a></li>
                <li>Username = <code>apikey</code> (ตัวอักษรนี้เลย) | Password = API key</li>
              </ol>
            </div>
          </div>
        </details>
      </CardContent>

      <ConfirmDialog
        open={confirmClearOpen}
        onOpenChange={setConfirmClearOpen}
        title="ล้างค่า SMTP?"
        description="ระบบจะหยุดส่งอีเมล (อีเมลต้อนรับ + Daily digest) จนกว่าจะตั้งค่าใหม่"
        confirmText="ล้างค่า"
        variant="danger"
        onConfirm={handleClear}
      />
    </Card>
  );
}

function fmtDateTime(d: string): string {
  try {
    return new Date(d).toLocaleString("th-TH", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return d;
  }
}

// ==================================================================
// Diagnostic panel — แสดงผลการ verify/test แบบ persistent + troubleshoot
// ==================================================================
function DiagnosticPanel({
  diagnostic, onDismiss,
}: {
  diagnostic: EmailDiagnostic;
  onDismiss: () => void;
}) {
  const tips = troubleshootTips(diagnostic.kind);
  const time = new Date(diagnostic.testedAt).toLocaleTimeString("th-TH", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  if (diagnostic.ok) {
    return (
      <div className="rounded-xl border bg-emerald-50 border-emerald-200 p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="flex-shrink-0 size-7 rounded-lg bg-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="size-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-emerald-900">✅ สำเร็จ</div>
            <div className="text-xs text-emerald-700 mt-0.5">{diagnostic.message}</div>
            <div className="text-[10px] text-emerald-600/70 mt-1">{time}</div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="text-emerald-600/60 hover:text-emerald-700 text-xs"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-red-50 border-red-200 p-3.5">
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 size-7 rounded-lg bg-red-500 flex items-center justify-center">
          <AlertCircle className="size-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-red-900">❌ ล้มเหลว</div>
          <div className="text-xs text-red-800 mt-0.5">{diagnostic.message}</div>
          <div className="text-[10px] text-red-600/70 mt-1">{time}</div>

          {tips.length > 0 && (
            <div className="mt-2.5 bg-white border border-red-200 rounded-lg p-2.5">
              <div className="text-[11px] font-bold text-red-900 mb-1.5">
                💡 วิธีแก้ที่แนะนำ:
              </div>
              <ul className="space-y-1 text-[11px] text-slate-700 list-disc list-inside">
                {tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
          )}

          {diagnostic.detail && (
            <details className="mt-2">
              <summary className="text-[10px] text-red-600 cursor-pointer font-semibold">
                รายละเอียดทาง technical
              </summary>
              <pre className="mt-1 bg-white border border-red-200 rounded p-2 text-[10px] font-mono text-red-700 overflow-x-auto whitespace-pre-wrap break-all">
                {diagnostic.detail}
              </pre>
            </details>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-red-600/60 hover:text-red-700 text-xs"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function troubleshootTips(kind?: EmailDiagnostic["kind"]): string[] {
  switch (kind) {
    case "auth":
      return [
        "ตรวจ Username = email เต็ม (เช่น you@gmail.com — ไม่ใช่แค่ 'you')",
        "ใช้ App Password 16 หลัก (Gmail) — ไม่ใช่รหัส Gmail ปกติ",
        "App Password ของ Gmail ห้ามมีเว้นวรรค (paste ตรงๆ)",
        "ถ้าใช้ Resend → Username = 'resend' / Password = API key (ขึ้นต้น re_)",
        "ถ้าใช้ SendGrid → Username = 'apikey' (พิมพ์ตามนี้) / Password = API key",
        "Gmail: ต้องเปิด 2-Step Verification ก่อนสร้าง App Password",
      ];
    case "connect":
      return [
        "ตรวจ Host สะกดถูกต้อง (เช่น smtp.gmail.com — ไม่มี https://)",
        "ตรวจ Port: 587 (STARTTLS, ปกติ) หรือ 465 (SSL — ติ๊ก SSL/TLS โดยตรง)",
        "ถ้า Vercel/cloud อาจ block port 25 — ใช้ 587/465 เท่านั้น",
        "ลอง preset 'Gmail' หรือ 'Resend' ดูว่าค่าตรงกับ provider หรือไม่",
      ];
    case "from":
      return [
        "Gmail บังคับ From email ตรงกับ Username",
        "Resend: From ต้องอยู่ใน domain ที่ verify (หรือใช้ onboarding@resend.dev)",
        "ลองตั้ง From email = Username เลย",
      ];
    case "migration-needed":
      return [
        "เปิด Supabase Dashboard → SQL Editor",
        "Copy SQL จาก migrations/202604_email_settings.sql",
        "Paste และกด Run",
        "Refresh หน้านี้ → จะเห็นฟอร์มพร้อมใช้",
      ];
    case "db-error":
      return [
        "ตรวจ env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY",
        "ดู log ที่ Vercel Dashboard → Logs",
      ];
    case "not-configured":
      return [
        "กรอกฟอร์มด้านบน → กดบันทึก",
        "เลือก preset (Gmail/Resend/SendGrid) เพื่อเติม host/port อัตโนมัติ",
      ];
    case "send":
    default:
      return [
        "ดูข้อความ error technical ด้านล่าง",
        "ตรวจ Vercel Logs สำหรับ stack trace",
      ];
  }
}
