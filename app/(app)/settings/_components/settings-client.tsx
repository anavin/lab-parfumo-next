"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building, Lock, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";
import { updateCompanySettingsAction } from "@/lib/actions/settings";

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

type Tab = "company" | "login";

export function SettingsClient({ initial }: { initial: CompanySettings }) {
  const [tab, setTab] = useState<Tab>("company");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        <TabButton active={tab === "company"} onClick={() => setTab("company")}
                    icon={<Building className="h-4 w-4" />} label="ข้อมูลบริษัท" />
        <TabButton active={tab === "login"} onClick={() => setTab("login")}
                    icon={<Lock className="h-4 w-4" />} label="หน้า Login" />
      </div>

      {tab === "company" ? (
        <CompanyForm initial={initial} />
      ) : (
        <LoginIntroForm initial={initial} />
      )}
    </div>
  );
}

function TabButton({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors",
        active
          ? "border-brand-700 text-brand-700"
          : "border-transparent text-slate-500 hover:text-slate-900",
      )}
    >
      {icon}
      {label}
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
            placeholder={"admin / admin123     → แอดมิน\nstaff1 / staff123    → ผู้สั่ง"}
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
