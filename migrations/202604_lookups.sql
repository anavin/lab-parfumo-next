-- ============================================================
-- Migration: Generic lookups table — manage all dropdown values
-- รันใน Supabase Dashboard → SQL Editor
--
-- หนึ่งตารางจัดการ dropdown ทุกประเภท:
--   - supplier_category    (หมวดหมู่ Supplier)
--   - bank                 (ธนาคาร)
--   - equipment_unit       (หน่วย เช่น ชิ้น/กล่อง/ลิตร)
--   - payment_term         (เครดิตเทอม)
--   - withdrawal_purpose   (เหตุผลการเบิก)
--
-- Backfill อัตโนมัติจาก data ที่มีอยู่
-- + Pre-populate ธนาคารหลัก 14 แห่งของไทย
-- ปลอดภัยรันซ้ำ — ใช้ NOT EXISTS
-- ============================================================

-- 1. Create lookups table
CREATE TABLE IF NOT EXISTS lookups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,                        -- 'supplier_category' / 'bank' / etc.
  name TEXT NOT NULL,                        -- ชื่อแสดงผล
  code TEXT,                                 -- รหัส optional (ธนาคารใช้ — BBL, SCB, etc.)
  sort_order INT NOT NULL DEFAULT 0,         -- เรียงลำดับ (น้อยขึ้นก่อน)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_name TEXT DEFAULT '',
  updated_by_name TEXT DEFAULT ''
);

-- 2. Indexes
-- Unique per type + name (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS uq_lookups_type_name_lower
  ON lookups (type, LOWER(TRIM(name)));

-- Filter index
CREATE INDEX IF NOT EXISTS idx_lookups_type_active
  ON lookups (type, is_active, sort_order, name);

-- 3. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_lookups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lookups_updated_at ON lookups;
CREATE TRIGGER trg_lookups_updated_at
  BEFORE UPDATE ON lookups
  FOR EACH ROW
  EXECUTE FUNCTION update_lookups_updated_at();

-- 4. RLS
ALTER TABLE lookups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lookups_all" ON lookups;
CREATE POLICY "lookups_all" ON lookups
  FOR ALL USING (true) WITH CHECK (true);

-- ==================================================================
-- 5. Pre-populate: 14 Thai banks
-- ==================================================================
INSERT INTO lookups (type, name, code, sort_order, created_by_name)
SELECT * FROM (VALUES
  ('bank', 'กรุงเทพ', 'BBL', 1, 'system'),
  ('bank', 'ไทยพาณิชย์', 'SCB', 2, 'system'),
  ('bank', 'กสิกรไทย', 'KBANK', 3, 'system'),
  ('bank', 'กรุงไทย', 'KTB', 4, 'system'),
  ('bank', 'กรุงศรีอยุธยา', 'BAY', 5, 'system'),
  ('bank', 'ทหารไทยธนชาต', 'TTB', 6, 'system'),
  ('bank', 'ทิสโก้', 'TISCO', 7, 'system'),
  ('bank', 'ออมสิน', 'GSB', 8, 'system'),
  ('bank', 'อาคารสงเคราะห์', 'GHB', 9, 'system'),
  ('bank', 'ธ.ก.ส.', 'BAAC', 10, 'system'),
  ('bank', 'CIMB ไทย', 'CIMB', 11, 'system'),
  ('bank', 'LH Bank', 'LHFG', 12, 'system'),
  ('bank', 'UOB ไทย', 'UOB', 13, 'system'),
  ('bank', 'แลนด์ แอนด์ เฮ้าส์', 'LH', 14, 'system')
) AS new_banks(type, name, code, sort_order, created_by_name)
WHERE NOT EXISTS (
  SELECT 1 FROM lookups l
  WHERE l.type = new_banks.type
    AND LOWER(TRIM(l.name)) = LOWER(TRIM(new_banks.name))
);

-- ==================================================================
-- 6. Backfill จาก data ที่มีอยู่
-- ==================================================================

-- 6a. supplier_category — จาก suppliers.category
INSERT INTO lookups (type, name, created_by_name)
SELECT DISTINCT 'supplier_category', TRIM(category), 'system (backfill)'
FROM suppliers
WHERE category IS NOT NULL AND TRIM(category) != ''
  AND NOT EXISTS (
    SELECT 1 FROM lookups l
    WHERE l.type = 'supplier_category'
      AND LOWER(TRIM(l.name)) = LOWER(TRIM(suppliers.category))
  );

-- ถ้ายังไม่มี supplier_category เลย → ใส่ default 5 หมวด
INSERT INTO lookups (type, name, sort_order, created_by_name)
SELECT * FROM (VALUES
  ('supplier_category', 'บรรจุภัณฑ์', 1, 'system'),
  ('supplier_category', 'สารเคมี', 2, 'system'),
  ('supplier_category', 'อุปกรณ์', 3, 'system'),
  ('supplier_category', 'บริการ', 4, 'system'),
  ('supplier_category', 'อื่นๆ', 99, 'system')
) AS defaults(type, name, sort_order, created_by_name)
WHERE NOT EXISTS (
  SELECT 1 FROM lookups l
  WHERE l.type = defaults.type
    AND LOWER(TRIM(l.name)) = LOWER(TRIM(defaults.name))
);

-- 6b. equipment_unit — จาก equipment.unit
INSERT INTO lookups (type, name, created_by_name)
SELECT DISTINCT 'equipment_unit', TRIM(unit), 'system (backfill)'
FROM equipment
WHERE unit IS NOT NULL AND TRIM(unit) != ''
  AND NOT EXISTS (
    SELECT 1 FROM lookups l
    WHERE l.type = 'equipment_unit'
      AND LOWER(TRIM(l.name)) = LOWER(TRIM(equipment.unit))
  );

-- ใส่ default หน่วยพื้นฐาน
INSERT INTO lookups (type, name, sort_order, created_by_name)
SELECT * FROM (VALUES
  ('equipment_unit', 'ชิ้น', 1, 'system'),
  ('equipment_unit', 'กล่อง', 2, 'system'),
  ('equipment_unit', 'ขวด', 3, 'system'),
  ('equipment_unit', 'ลัง', 4, 'system'),
  ('equipment_unit', 'แพ็ค', 5, 'system'),
  ('equipment_unit', 'ลิตร', 6, 'system'),
  ('equipment_unit', 'มล.', 7, 'system'),
  ('equipment_unit', 'กก.', 8, 'system'),
  ('equipment_unit', 'กรัม', 9, 'system'),
  ('equipment_unit', 'เมตร', 10, 'system')
) AS defaults(type, name, sort_order, created_by_name)
WHERE NOT EXISTS (
  SELECT 1 FROM lookups l
  WHERE l.type = defaults.type
    AND LOWER(TRIM(l.name)) = LOWER(TRIM(defaults.name))
);

-- 6c. payment_term — จาก suppliers.payment_terms
INSERT INTO lookups (type, name, created_by_name)
SELECT DISTINCT 'payment_term', TRIM(payment_terms), 'system (backfill)'
FROM suppliers
WHERE payment_terms IS NOT NULL AND TRIM(payment_terms) != ''
  AND NOT EXISTS (
    SELECT 1 FROM lookups l
    WHERE l.type = 'payment_term'
      AND LOWER(TRIM(l.name)) = LOWER(TRIM(suppliers.payment_terms))
  );

-- ใส่ default เครดิตเทอม
INSERT INTO lookups (type, name, sort_order, created_by_name)
SELECT * FROM (VALUES
  ('payment_term', 'โอนทันที', 1, 'system'),
  ('payment_term', 'เก็บเงินปลายทาง (COD)', 2, 'system'),
  ('payment_term', '7 วันหลังรับของ', 3, 'system'),
  ('payment_term', '15 วันหลังรับของ', 4, 'system'),
  ('payment_term', '30 วันหลังรับของ', 5, 'system'),
  ('payment_term', '45 วันหลังรับของ', 6, 'system'),
  ('payment_term', '60 วันหลังรับของ', 7, 'system'),
  ('payment_term', '90 วันหลังรับของ', 8, 'system')
) AS defaults(type, name, sort_order, created_by_name)
WHERE NOT EXISTS (
  SELECT 1 FROM lookups l
  WHERE l.type = defaults.type
    AND LOWER(TRIM(l.name)) = LOWER(TRIM(defaults.name))
);

-- 6d. withdrawal_purpose — จาก withdrawals.purpose
INSERT INTO lookups (type, name, created_by_name)
SELECT DISTINCT 'withdrawal_purpose', TRIM(purpose), 'system (backfill)'
FROM withdrawals
WHERE purpose IS NOT NULL AND TRIM(purpose) != ''
  AND NOT EXISTS (
    SELECT 1 FROM lookups l
    WHERE l.type = 'withdrawal_purpose'
      AND LOWER(TRIM(l.name)) = LOWER(TRIM(withdrawals.purpose))
  );

-- ใส่ default เหตุผลการเบิก
INSERT INTO lookups (type, name, sort_order, created_by_name)
SELECT * FROM (VALUES
  ('withdrawal_purpose', 'ใช้ใน lot ใหม่', 1, 'system'),
  ('withdrawal_purpose', 'ทดลองสูตร', 2, 'system'),
  ('withdrawal_purpose', 'เปลี่ยนของเสียหาย', 3, 'system'),
  ('withdrawal_purpose', 'เบิกใช้ในห้อง lab', 4, 'system'),
  ('withdrawal_purpose', 'อื่นๆ', 99, 'system')
) AS defaults(type, name, sort_order, created_by_name)
WHERE NOT EXISTS (
  SELECT 1 FROM lookups l
  WHERE l.type = defaults.type
    AND LOWER(TRIM(l.name)) = LOWER(TRIM(defaults.name))
);

-- ==================================================================
-- 7. Verification
-- ==================================================================
SELECT
  type,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE is_active) AS active
FROM lookups
GROUP BY type
ORDER BY type;

SELECT 'lookups + backfill ready ✅' AS status;
