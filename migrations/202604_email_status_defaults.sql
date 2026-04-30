-- Email PO status notifications + new PO email (extension to Phase B)
-- - เปลี่ยน default ของ email_po_status_change จาก false → true (opt-out)
-- - เพิ่ม key ใหม่ email_new_po (admin รับเมื่อมี PO ใหม่)
-- Idempotent: รันซ้ำได้

-- ==================================================================
-- 1. Backfill: เพิ่ม keys ที่ขาด ให้ user ทุกคน
-- ==================================================================
-- ใช้ jsonb concat: ถ้ามี key แล้วจะถูก override (ปรับ default ใหม่)
-- ถ้าไม่มี key จะเพิ่มเข้าไป
UPDATE users
SET notification_prefs = notification_prefs || jsonb_build_object(
  'email_po_status_change', true,
  'email_new_po', true
)
WHERE notification_prefs IS NOT NULL
  AND (
    NOT (notification_prefs ? 'email_new_po')
    OR (notification_prefs->>'email_po_status_change')::boolean = false
  );

-- ==================================================================
-- 2. Update default for new users
-- ==================================================================
ALTER TABLE users
ALTER COLUMN notification_prefs SET DEFAULT '{
  "email_daily_digest": true,
  "email_po_status_change": true,
  "email_new_po": true,
  "inapp_po_status_change": true,
  "inapp_po_cancelled": true,
  "inapp_new_po": true
}'::jsonb;

COMMENT ON COLUMN users.notification_prefs IS
  'JSON dict: email_daily_digest, email_po_status_change, email_new_po, inapp_po_status_change, inapp_po_cancelled, inapp_new_po — ผู้ใช้ตั้งเองที่ /preferences';
