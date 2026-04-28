"use client";

/**
 * ConfirmDialog — เปิด modal ถามยืนยันก่อน action ที่ทำลายข้อมูล
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <ConfirmDialog
 *     open={open} onOpenChange={setOpen}
 *     title="ยกเลิกใบ PO?"
 *     description="การยกเลิกจะไม่สามารถเรียกคืนได้"
 *     confirmText="ยืนยันยกเลิก"
 *     variant="danger"
 *     onConfirm={() => deleteAction()}
 *   />
 */
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Optional reason input — when set, requires non-empty text */
  requireReason?: boolean;
  reasonPlaceholder?: string;
  reasonValue?: string;
  onReasonChange?: (value: string) => void;
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmText = "ยืนยัน", cancelText = "ยกเลิก",
  variant = "default", loading, onConfirm,
  requireReason, reasonPlaceholder, reasonValue, onReasonChange,
}: ConfirmDialogProps) {
  const isDanger = variant === "danger";
  const iconColor =
    variant === "danger" ? "text-destructive" :
    variant === "warning" ? "[color:hsl(var(--warning))]" :
    "text-primary";

  const canConfirm = !requireReason || (reasonValue?.trim().length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            {(isDanger || variant === "warning") && (
              <div className={`flex-shrink-0 size-10 rounded-full bg-destructive/10 flex items-center justify-center ${iconColor}`}>
                <AlertTriangle className="size-5" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-2">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {requireReason && (
          <div className="px-1">
            <textarea
              autoFocus
              value={reasonValue ?? ""}
              onChange={(e) => onReasonChange?.(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder={reasonPlaceholder ?? "เหตุผล..."}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring resize-none"
            />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={isDanger ? "destructive" : "primary"}
            onClick={() => onConfirm()}
            loading={loading}
            disabled={!canConfirm}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
