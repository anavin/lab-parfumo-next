-- ============================================================
-- Migration: Soft delete with recycle bin (recovery support)
--
-- เพิ่ม `deleted_at TIMESTAMPTZ` column ให้ตารางหลัก เพื่อให้:
--   - "ลบ" จริง = set deleted_at = NOW() (soft) → กู้คืนได้
--   - "ลบถาวร" จาก /trash page = DELETE row จริง
--   - ทุก query ที่อ่าน รายการ filter `deleted_at IS NULL` ปกติ
--
-- ขอบเขต: purchase_orders, suppliers (รวมหลัก)
-- ไม่กระทบ: lookups, equipment, lots, withdrawals (ยังใช้ pattern เดิม)
--
-- ปลอดภัยรันซ้ำ
-- ============================================================

-- 1) purchase_orders
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;

CREATE INDEX IF NOT EXISTS idx_po_deleted_at
  ON purchase_orders (deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN purchase_orders.deleted_at IS
  'NULL = active. NOT NULL = อยู่ในถังขยะ (กู้คืนได้). ดูที่ /trash';

-- 2) suppliers
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS deleted_by_name TEXT;

CREATE INDEX IF NOT EXISTS idx_suppliers_deleted_at
  ON suppliers (deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN suppliers.deleted_at IS
  'NULL = active. NOT NULL = อยู่ในถังขยะ (กู้คืนได้). is_active เป็น flag คนละตัว — pause/active ใน dropdown';

-- 3) Verification
SELECT
  (SELECT count(*) FROM purchase_orders WHERE deleted_at IS NOT NULL) AS po_in_trash,
  (SELECT count(*) FROM suppliers WHERE deleted_at IS NOT NULL) AS suppliers_in_trash;

SELECT 'soft-delete columns ready ✅' AS status;
