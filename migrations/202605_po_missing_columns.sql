-- Fix missing columns ใน purchase_orders (เจอตอน user รายงาน attachment ไม่ work)
-- Idempotent — รันซ้ำได้

-- ==================================================================
-- 1. attachment_urls — JSONB array เก็บไฟล์แนบ (PDF/Word/Excel/etc.)
-- ==================================================================
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS attachment_urls JSONB DEFAULT '[]'::jsonb;

UPDATE purchase_orders
SET attachment_urls = '[]'::jsonb
WHERE attachment_urls IS NULL;

COMMENT ON COLUMN purchase_orders.attachment_urls IS
  'JSONB array of {url, name, size, type, category, uploaded_by, uploaded_at}';

-- ==================================================================
-- 2. column อื่นๆ ที่อาจขาดจาก initial schema
--    (ทุกตัว optional — มีอยู่แล้วก็ skip)
-- ==================================================================
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS procurement_notes TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_contact TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vat NUMERIC DEFAULT 0;

-- ==================================================================
-- 3. Index — ช่วย query attachment-related
-- ==================================================================
-- GIN index บน JSONB เผื่ออนาคตอยาก search ภายใน attachment_urls
CREATE INDEX IF NOT EXISTS idx_po_attachment_urls
  ON purchase_orders USING gin(attachment_urls)
  WHERE attachment_urls IS NOT NULL AND attachment_urls != '[]'::jsonb;
