"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Download, Trash2, Upload, Plus,
  ImageIcon, FileSpreadsheet, FileArchive,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/cn";
import type { PoAttachment } from "@/lib/types/db";
import {
  addPoAttachmentsAction, removePoAttachmentAction,
} from "@/lib/actions/po";
import { uploadSingleAttachmentAction } from "@/lib/actions/upload";

const CATEGORY_LABEL: Record<string, string> = {
  order: "🛒 ดำเนินการสั่งซื้อ",
  shipping: "🚚 อัปเดตขนส่ง",
  general: "📎 ทั่วไป",
};

function fileIcon(type: string | undefined) {
  const t = (type ?? "").toLowerCase();
  if (["pdf"].includes(t)) return <FileText className="h-5 w-5 text-red-600" />;
  if (["doc", "docx"].includes(t)) return <FileText className="h-5 w-5 text-blue-600" />;
  if (["xls", "xlsx", "csv"].includes(t))
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600" />;
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(t))
    return <ImageIcon className="h-5 w-5 text-purple-600" />;
  if (["zip", "rar", "7z"].includes(t))
    return <FileArchive className="h-5 w-5 text-amber-600" />;
  return <FileText className="h-5 w-5 text-slate-500" />;
}

function fmtSize(n: number | undefined): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("th-TH", {
      day: "2-digit", month: "short", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return String(d);
  }
}

export function AttachmentsSection({
  poId, attachments, isAdmin,
}: {
  poId: string;
  attachments: PoAttachment[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  // Group by category
  const groups = attachments.reduce<Record<string, PoAttachment[]>>((acc, a) => {
    const cat = a.category ?? "general";
    (acc[cat] ??= []).push(a);
    return acc;
  }, {});
  const categoryOrder = ["order", "shipping", "general"];

  function handleRemove(url: string) {
    setError(null);
    startTransition(async () => {
      const res = await removePoAttachmentAction(poId, url);
      if (!res.ok) setError(res.error ?? "ลบไม่สำเร็จ");
      setConfirmDel(null);
      router.refresh();
    });
  }

  async function handleUpload() {
    if (!files.length) return;
    setError(null);
    setUploading(true);
    try {
      // Upload one by one (Server Actions don't easily handle multiple files)
      const uploaded: Array<{
        url: string; name: string; size: number; type: string; uploaded_at: string;
      }> = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        const res = await uploadSingleAttachmentAction(fd);
        if (res.ok && res.attachment) uploaded.push(res.attachment);
      }
      if (!uploaded.length) {
        setError("อัปโหลดไม่สำเร็จ");
        return;
      }
      const addRes = await addPoAttachmentsAction(poId, uploaded, "general");
      if (!addRes.ok) {
        setError(addRes.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setFiles([]);
      setShowAddForm(false);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-slate-900">
            📎 ไฟล์แนบ ({attachments.length})
          </h2>
          {isAdmin && !showAddForm && (
            <Button
              size="sm" variant="secondary"
              onClick={() => setShowAddForm(true)}
              disabled={pending || uploading}
            >
              <Plus className="h-3.5 w-3.5" /> เพิ่มไฟล์
            </Button>
          )}
        </div>

        {/* List by category */}
        {attachments.length === 0 && !showAddForm ? (
          <div className="text-sm text-slate-400 italic">ยังไม่มีไฟล์แนบ</div>
        ) : (
          <div className="space-y-3">
            {categoryOrder.map((cat) => {
              const items = groups[cat];
              if (!items?.length) return null;
              return (
                <div key={cat}>
                  <div className="text-xs font-semibold text-slate-700 mb-1.5">
                    {CATEGORY_LABEL[cat]} <span className="text-slate-400">({items.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((a) => (
                      <div
                        key={a.url}
                        className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:border-brand-300 transition-colors"
                      >
                        {fileIcon(a.type)}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate" title={a.name}>
                            {a.name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                            {a.size && <span>{fmtSize(a.size)}</span>}
                            {a.uploaded_by && <span>โดย {a.uploaded_by}</span>}
                            {a.uploaded_at && <span>{fmtDateTime(a.uploaded_at)}</span>}
                          </div>
                        </div>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex items-center justify-center gap-1 h-8 px-2.5 text-xs font-semibold rounded-lg",
                            "bg-brand-600 text-white hover:bg-brand-700",
                          )}
                          download={a.name}
                        >
                          <Download className="h-3 w-3" /> ดาวน์โหลด
                        </a>
                        {isAdmin && (
                          confirmDel === a.url ? (
                            <Button
                              variant="primary" size="sm" loading={pending}
                              onClick={() => handleRemove(a.url)}
                              className="!from-red-600 !to-red-700 !h-8"
                            >
                              ⚠️ ยืนยัน
                            </Button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDel(a.url)}
                              disabled={pending}
                              className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 inline-flex items-center justify-center"
                              aria-label="ลบ"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Upload form */}
        {showAddForm && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 space-y-3">
            <label
              className={cn(
                "block border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors text-center",
                files.length > 0
                  ? "bg-white border-brand-400"
                  : "bg-white border-slate-300 hover:border-brand-400",
                uploading && "opacity-60 cursor-not-allowed",
              )}
            >
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.zip,.rar,.7z"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                disabled={uploading}
                className="sr-only"
              />
              <Upload className="h-6 w-6 text-slate-400 mx-auto mb-2" />
              {files.length > 0 ? (
                <>
                  <div className="text-sm font-semibold text-brand-700">
                    เลือก {files.length} ไฟล์แล้ว
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm text-slate-700">
                    คลิกเพื่อเลือกไฟล์ (PDF, Word, Excel, รูป — เลือกได้หลายไฟล์)
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">สูงสุด 10 MB ต่อไฟล์</div>
                </>
              )}
            </label>
            {error && <Alert tone="danger">❌ {error}</Alert>}
            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={!files.length || uploading}
                loading={uploading}
              >
                <Upload className="h-4 w-4" /> อัปโหลด
              </Button>
              <Button
                variant="secondary"
                onClick={() => { setShowAddForm(false); setFiles([]); setError(null); }}
                disabled={uploading}
              >
                ยกเลิก
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
