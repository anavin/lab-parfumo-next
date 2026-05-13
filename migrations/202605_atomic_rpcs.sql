-- Atomic RPCs: withdraw_stock + next_po_number
-- ก่อน: code มี fallback non-atomic → race condition จริง
-- หลัง: RPC ทำงาน atomic ใน DB ผ่าน UPDATE ... RETURNING + advisory lock
-- Idempotent — รันซ้ำได้

-- ==================================================================
-- 1. withdraw_stock — atomic check + decrement equipment.stock
-- ==================================================================
-- Returns JSON: { success, error?, current_stock?, name?, unit? }
-- success=true   → name/unit/current_stock (หลังหัก) มีค่า
-- success=false  → error ใน {"not_found", "insufficient_stock", "inactive"}
CREATE OR REPLACE FUNCTION withdraw_stock(
  p_equipment_id UUID,
  p_qty NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row RECORD;
BEGIN
  -- Atomic update + return (กัน race เพราะ Postgres single statement)
  -- UPDATE ... WHERE stock >= qty → ถ้าได้ row = พอ + หักเรียบร้อย
  UPDATE equipment
  SET
    stock = stock - p_qty,
    updated_at = NOW()
  WHERE id = p_equipment_id
    AND COALESCE(is_active, true) = true
    AND COALESCE(stock, 0) >= p_qty
  RETURNING id, name, unit, stock
  INTO v_row;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'name', v_row.name,
      'unit', v_row.unit,
      'current_stock', v_row.stock
    );
  END IF;

  -- ไม่ผ่าน → ดูว่าเพราะอะไร
  SELECT id, name, unit, COALESCE(stock, 0) AS stock, COALESCE(is_active, true) AS is_active
  INTO v_row
  FROM equipment WHERE id = p_equipment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF NOT v_row.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'inactive');
  END IF;
  RETURN jsonb_build_object(
    'success', false,
    'error', 'insufficient_stock',
    'current_stock', v_row.stock,
    'name', v_row.name,
    'unit', v_row.unit
  );
END;
$$;

COMMENT ON FUNCTION withdraw_stock IS
  'Atomic: ตรวจ stock พอ + หัก ใน statement เดียว. Return JSON';

-- ==================================================================
-- 2. PO number counter table + next_po_number RPC
-- ==================================================================
CREATE TABLE IF NOT EXISTS po_counters (
  year INT PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
);

-- next_po_number — atomic increment per year (advisory lock + UPSERT)
-- Returns TEXT: "PO-YYYY-NNNN"
CREATE OR REPLACE FUNCTION next_po_number(year_int INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_next INT;
  v_existing_max INT;
BEGIN
  -- 1) Lock counter row สำหรับปีนี้ (กัน 2 tx ชน)
  PERFORM pg_advisory_xact_lock(hashtext('po_counter_' || year_int));

  -- 2) ดู counter ที่มี — INSERT ถ้าไม่มี
  INSERT INTO po_counters (year, last_number)
  VALUES (year_int, 0)
  ON CONFLICT (year) DO NOTHING;

  -- 3) Backfill ครั้งแรก — sync counter กับ MAX(po_number) ที่มีจริงใน DB
  --    (กรณี migrate มาจาก system เก่าที่ counter เป็น 0 แต่มี PO อยู่แล้ว)
  SELECT COALESCE(MAX(
    NULLIF(
      SUBSTRING(po_number FROM 'PO-' || year_int || '-(\d+)$'),
      ''
    )::INT
  ), 0)
  INTO v_existing_max
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || year_int || '-%';

  -- 4) Atomic increment — เอาค่าที่มากกว่าระหว่าง counter หรือ existing max
  UPDATE po_counters
  SET last_number = GREATEST(last_number, v_existing_max) + 1
  WHERE year = year_int
  RETURNING last_number INTO v_next;

  RETURN 'PO-' || year_int || '-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

COMMENT ON FUNCTION next_po_number IS
  'Atomic PO number generator per year (advisory lock + counter row)';

-- ==================================================================
-- 3. Backfill po_counters ปีปัจจุบัน (ถ้ายังไม่มี data)
-- ==================================================================
DO $$
DECLARE
  cur_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  v_max INT;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(
      SUBSTRING(po_number FROM 'PO-' || cur_year || '-(\d+)$'),
      ''
    )::INT
  ), 0)
  INTO v_max
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || cur_year || '-%';

  INSERT INTO po_counters (year, last_number)
  VALUES (cur_year, v_max)
  ON CONFLICT (year) DO UPDATE SET last_number = GREATEST(po_counters.last_number, EXCLUDED.last_number);
END
$$;
