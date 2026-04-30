-- ============================================================
-- Migration: Suppliers table + supplier_id FK in purchase_orders
-- รันใน Supabase Dashboard → SQL Editor
--
-- สิ่งที่ทำ:
-- 1. สร้างตาราง suppliers (15 columns)
-- 2. เพิ่ม supplier_id (UUID REFERENCES suppliers) ใน purchase_orders
-- 3. Backfill: import supplier_name ที่มีอยู่ → suppliers + link FK
-- 4. Unique constraint บน LOWER(name) — กันชื่อซ้ำ case-insensitive
-- 5. Auto-update trigger สำหรับ updated_at
--
-- ปลอดภัยรันซ้ำ — ใช้ IF NOT EXISTS / NOT EXISTS ทั้งหมด
-- ============================================================

-- 1. Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name TEXT NOT NULL,
  code TEXT,                              -- รหัสภายใน เช่น "S001"
  tax_id TEXT,                            -- เลขผู้เสียภาษี
  category TEXT DEFAULT '',               -- บรรจุภัณฑ์ / สารเคมี / อุปกรณ์ / บริการ / อื่นๆ

  -- Contact
  contact_person TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',

  -- Payment
  bank_name TEXT DEFAULT '',
  bank_account TEXT DEFAULT '',
  payment_terms TEXT DEFAULT '',          -- เช่น "30 วันหลังรับของ"

  -- Internal
  notes TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_name TEXT DEFAULT '',
  updated_by_name TEXT DEFAULT ''
);

-- 2. Indexes
-- Unique on LOWER(name) — case-insensitive (ABC = abc)
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_name_lower
  ON suppliers (LOWER(TRIM(name)));

-- Unique on code (เฉพาะที่ไม่ว่าง)
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_code
  ON suppliers (code) WHERE code IS NOT NULL AND code != '';

-- Filter index
CREATE INDEX IF NOT EXISTS idx_suppliers_active
  ON suppliers (is_active, name);

-- 3. Add supplier_id to purchase_orders (FK)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_po_supplier_id
  ON purchase_orders (supplier_id);

-- 4. Backfill: import unique supplier_name → suppliers
-- ใช้ NOT EXISTS pattern (safer than ON CONFLICT บน functional index)
INSERT INTO suppliers (name, address, notes, is_active, created_by_name)
SELECT DISTINCT ON (LOWER(TRIM(supplier_name)))
  TRIM(supplier_name) AS name,
  COALESCE(supplier_contact, '') AS address,    -- supplier_contact เดิมเป็น free-text ไป address
  'นำเข้าจาก PO เก่า — กรุณาตรวจสอบและแก้ไข' AS notes,
  true AS is_active,
  'system (migration)' AS created_by_name
FROM purchase_orders po
WHERE po.supplier_name IS NOT NULL
  AND TRIM(po.supplier_name) != ''
  AND NOT EXISTS (
    SELECT 1 FROM suppliers s
    WHERE LOWER(TRIM(s.name)) = LOWER(TRIM(po.supplier_name))
  );

-- 5. Link purchase_orders.supplier_id ↔ suppliers.id
UPDATE purchase_orders po
SET supplier_id = s.id
FROM suppliers s
WHERE LOWER(TRIM(po.supplier_name)) = LOWER(TRIM(s.name))
  AND po.supplier_id IS NULL
  AND po.supplier_name IS NOT NULL
  AND TRIM(po.supplier_name) != '';

-- 6. Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_suppliers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION update_suppliers_updated_at();

-- 7. RLS — match pattern ของ table อื่นใน project (allow all + control via service-role)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suppliers_all" ON suppliers;
CREATE POLICY "suppliers_all" ON suppliers
  FOR ALL USING (true) WITH CHECK (true);

-- 8. Verification — รันแยกเพื่อตรวจผลลัพธ์
SELECT
  (SELECT COUNT(*) FROM suppliers) AS supplier_count,
  (SELECT COUNT(*) FROM suppliers WHERE is_active) AS active_count,
  (SELECT COUNT(DISTINCT supplier_id) FROM purchase_orders WHERE supplier_id IS NOT NULL) AS distinct_linked_suppliers,
  (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id IS NOT NULL) AS linked_pos,
  (SELECT COUNT(*) FROM purchase_orders WHERE supplier_name IS NOT NULL AND supplier_id IS NULL) AS unlinked_pos
;

SELECT 'suppliers + backfill ready ✅' AS status;
