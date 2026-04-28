-- ============================================================
-- Migration: Workflow atomic operations + delivery_no uniqueness
-- รันใน Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. delivery_no unique per PO (ป้องกัน collision)
ALTER TABLE po_deliveries
  DROP CONSTRAINT IF EXISTS uq_po_deliveries_no;

ALTER TABLE po_deliveries
  ADD CONSTRAINT uq_po_deliveries_no UNIQUE (po_id, delivery_no);

-- 2. Atomic stock increment/decrement
CREATE OR REPLACE FUNCTION increment_equipment_stock(p_id UUID, p_qty INT)
RETURNS INT AS $$
DECLARE
  new_stock INT;
BEGIN
  UPDATE equipment
    SET stock = GREATEST(0, COALESCE(stock, 0) + p_qty),
        updated_at = NOW()
    WHERE id = p_id
  RETURNING stock INTO new_stock;

  RETURN new_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. หา delivery_no ถัดไปแบบ atomic (ใช้ advisory lock)
CREATE OR REPLACE FUNCTION next_po_delivery_no(p_po_id UUID)
RETURNS INT AS $$
DECLARE
  next_no INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_po_id::TEXT));

  SELECT COALESCE(MAX(delivery_no), 0) + 1
    INTO next_no
    FROM po_deliveries
    WHERE po_id = p_po_id;

  RETURN next_no;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'workflow atomic functions ready ✅' AS status;
