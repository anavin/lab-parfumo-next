-- Close reminder cron — throttle ป้องกัน spam ส่งซ้ำทุกวัน
-- Before: cron ส่ง email ทุก PO ที่ค้างเลย 1 วัน ทุกวัน
--         → ถ้า PO ค้าง 30 วัน user รับ 30 emails!
-- After: ส่งครั้งแรก + ส่งซ้ำทุก 3 วัน (max)
-- Idempotent

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS last_close_reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_po_close_reminder
  ON purchase_orders(last_close_reminder_sent_at)
  WHERE status IN ('รับของแล้ว', 'มีปัญหา');

COMMENT ON COLUMN purchase_orders.last_close_reminder_sent_at IS
  'Timestamp ส่ง close reminder email ล่าสุด — cron ใช้ throttle (re-send หลัง 3 วัน)';
