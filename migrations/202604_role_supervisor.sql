-- ============================================================
-- Migration: เพิ่ม role "supervisor"
-- รันใน Supabase Dashboard → SQL Editor (optional — DB column เป็น TEXT แล้ว)
--
-- Supervisor มีสิทธิ์เหมือน Admin ยกเว้น:
--   ❌ ไม่สามารถเข้า /settings (ตั้งค่าระบบ)
--   ❌ ไม่สามารถจัดการ user role = admin (สร้าง/แก้/ลบ/promote)
-- ============================================================

-- Add CHECK constraint (optional — บังคับ role ที่ valid เท่านั้น)
-- ถ้าไม่มี constraint อยู่แล้ว → จะสร้างใหม่
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'supervisor', 'requester'));

SELECT 'role supervisor ready ✅' AS status;
