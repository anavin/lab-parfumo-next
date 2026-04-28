-- ============================================================
-- Migration: Email/SMTP Settings
-- เพิ่ม column สำหรับเก็บ SMTP config ใน company_settings
-- (admin แก้ผ่าน UI ได้)
-- ============================================================

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS smtp_host TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_port INT DEFAULT 587,
  ADD COLUMN IF NOT EXISTS smtp_user TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_password TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_from_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_from_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT FALSE;

SELECT 'company_settings — SMTP columns ready ✅' AS status;
