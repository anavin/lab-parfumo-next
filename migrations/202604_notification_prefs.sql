-- Notification Preferences (Phase B)
-- ทุก user ตั้งค่าได้เองว่าจะรับ noti แบบไหนบ้าง
-- Idempotent: ถ้ามี column แล้วจะไม่ error

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB
  NOT NULL
  DEFAULT '{
    "email_daily_digest": true,
    "email_po_status_change": false,
    "inapp_po_status_change": true,
    "inapp_po_cancelled": true,
    "inapp_new_po": true
  }'::jsonb;

-- Backfill: ถ้ามี user ที่ column เป็น null (จากก่อน default) → set defaults
UPDATE users
SET notification_prefs = '{
  "email_daily_digest": true,
  "email_po_status_change": false,
  "inapp_po_status_change": true,
  "inapp_po_cancelled": true,
  "inapp_new_po": true
}'::jsonb
WHERE notification_prefs IS NULL;

COMMENT ON COLUMN users.notification_prefs IS
  'JSON dict: email_daily_digest, email_po_status_change, inapp_po_status_change, inapp_po_cancelled, inapp_new_po — ผู้ใช้ตั้งเองที่ /preferences';
