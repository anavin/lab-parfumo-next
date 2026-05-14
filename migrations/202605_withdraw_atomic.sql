-- F1 + F3 — Withdraw atomic RPC + lot usage tracking table
--
-- F3: withdrawal_lot_usage — track FIFO consumption across N lots per withdrawal
--     (กรณี withdrawal กิน lot หลายตัว — เดิมเก็บแค่ primary lot_id)
--
-- F1: withdraw_atomic — RPC ทำทุก step ใน transaction เดียว
--     stock decrement → insert withdrawal → FIFO lots → record usage
--     ถ้า step ใด fail → rollback ทั้งหมด (true atomicity)
--
-- Idempotent — รันซ้ำได้

-- ==================================================================
-- 1. Table: withdrawal_lot_usage
-- ==================================================================
CREATE TABLE IF NOT EXISTS withdrawal_lot_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID NOT NULL,
  lot_id UUID,
  qty_used NUMERIC NOT NULL CHECK (qty_used > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK เพิ่มแยก (กัน error ถ้า migration order หรือ tables ไม่ครบ)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_lot_usage_withdrawal_id_fkey'
  ) THEN
    ALTER TABLE withdrawal_lot_usage
      ADD CONSTRAINT withdrawal_lot_usage_withdrawal_id_fkey
      FOREIGN KEY (withdrawal_id) REFERENCES withdrawals(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_lot_usage_lot_id_fkey'
  ) THEN
    ALTER TABLE withdrawal_lot_usage
      ADD CONSTRAINT withdrawal_lot_usage_lot_id_fkey
      FOREIGN KEY (lot_id) REFERENCES lots(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_wlu_withdrawal_id ON withdrawal_lot_usage(withdrawal_id);
CREATE INDEX IF NOT EXISTS idx_wlu_lot_id ON withdrawal_lot_usage(lot_id);

COMMENT ON TABLE withdrawal_lot_usage IS
  'F3 — บันทึก FIFO consumption ของแต่ละ lot ใน withdrawal เดียว (1 withdrawal → N lots)';

-- ==================================================================
-- 2. Grants (consistent กับ data_api_grants policy)
-- ==================================================================
GRANT ALL ON public.withdrawal_lot_usage TO service_role;
REVOKE ALL ON public.withdrawal_lot_usage FROM anon;
REVOKE ALL ON public.withdrawal_lot_usage FROM authenticated;
ALTER TABLE withdrawal_lot_usage ENABLE ROW LEVEL SECURITY;

-- ==================================================================
-- 3. RPC: withdraw_atomic — ทำงานครบใน transaction เดียว
-- ==================================================================
-- Returns JSONB:
--   success=true  → withdrawal_id, name, unit, current_stock, lot_usages[]
--   success=false → error ∈ {not_found, inactive, insufficient_stock}
CREATE OR REPLACE FUNCTION withdraw_atomic(
  p_equipment_id UUID,
  p_qty NUMERIC,
  p_user_id UUID,
  p_user_name TEXT,
  p_purpose TEXT,
  p_notes TEXT DEFAULT '',
  p_withdrawn_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_equipment RECORD;
  v_withdrawal_id UUID;
  v_remaining NUMERIC := p_qty;
  v_used NUMERIC;
  v_lot RECORD;
  v_primary_lot_id UUID := NULL;
  v_lot_usages JSONB := '[]'::jsonb;
  v_stock_check RECORD;
BEGIN
  IF p_qty <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_qty');
  END IF;

  -- 1) Atomic check + decrement equipment.stock
  UPDATE equipment
  SET
    stock = stock - p_qty,
    updated_at = NOW()
  WHERE id = p_equipment_id
    AND COALESCE(is_active, true) = true
    AND COALESCE(stock, 0) >= p_qty
  RETURNING id, name, unit, stock
  INTO v_equipment;

  IF NOT FOUND THEN
    -- หาว่าทำไม fail
    SELECT id, name, unit, COALESCE(stock, 0) AS stock, COALESCE(is_active, true) AS is_active
    INTO v_stock_check
    FROM equipment WHERE id = p_equipment_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;
    IF NOT v_stock_check.is_active THEN
      RETURN jsonb_build_object('success', false, 'error', 'inactive');
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_stock',
      'current_stock', v_stock_check.stock,
      'name', v_stock_check.name,
      'unit', v_stock_check.unit
    );
  END IF;

  -- 2) Insert withdrawal record (without lot_id ตอนนี้ — back-fill ทีหลัง)
  INSERT INTO withdrawals (
    equipment_id, equipment_name, qty, unit, purpose,
    withdrawn_by, withdrawn_by_name, withdrawn_at, notes
  ) VALUES (
    p_equipment_id, v_equipment.name, p_qty, v_equipment.unit, p_purpose,
    p_user_id, p_user_name,
    COALESCE(p_withdrawn_at, NOW()),
    COALESCE(p_notes, '')
  )
  RETURNING id INTO v_withdrawal_id;

  -- 3) FIFO consume lots — ลูปผ่าน active lots เรียงตาม received_date asc
  FOR v_lot IN
    SELECT id, qty_remaining
    FROM lots
    WHERE equipment_id = p_equipment_id
      AND status = 'active'
      AND qty_remaining > 0
    ORDER BY received_date ASC, id ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_used := LEAST(v_remaining, v_lot.qty_remaining);

    -- Update lot (trigger จะจัดการ status auto)
    UPDATE lots
    SET qty_remaining = qty_remaining - v_used
    WHERE id = v_lot.id;

    -- Record usage (F3 — multi-lot traceability)
    INSERT INTO withdrawal_lot_usage (withdrawal_id, lot_id, qty_used)
    VALUES (v_withdrawal_id, v_lot.id, v_used);

    -- Build response array
    v_lot_usages := v_lot_usages || jsonb_build_object(
      'lot_id', v_lot.id,
      'qty_used', v_used
    );

    -- Record primary lot (first one used) — back-compat กับ withdrawals.lot_id
    IF v_primary_lot_id IS NULL THEN
      v_primary_lot_id := v_lot.id;
    END IF;

    v_remaining := v_remaining - v_used;
  END LOOP;

  -- 4) Back-fill withdrawals.lot_id (primary lot)
  IF v_primary_lot_id IS NOT NULL THEN
    UPDATE withdrawals
    SET lot_id = v_primary_lot_id
    WHERE id = v_withdrawal_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'name', v_equipment.name,
    'unit', v_equipment.unit,
    'current_stock', v_equipment.stock,
    'lot_usages', v_lot_usages,
    'unallocated', v_remaining  -- ของ untracked (ถ้า > 0 = stock มี แต่ไม่มี active lot)
  );
END;
$$;

COMMENT ON FUNCTION withdraw_atomic IS
  'F1 — Atomic withdraw: stock + withdrawal + lots ใน transaction เดียว';

-- Grants for RPC
GRANT EXECUTE ON FUNCTION withdraw_atomic TO service_role;
REVOKE EXECUTE ON FUNCTION withdraw_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION withdraw_atomic FROM authenticated;

-- ==================================================================
-- 4. Verify
-- ==================================================================
SELECT
  'withdrawal_lot_usage' AS object,
  COUNT(*) AS row_count
FROM withdrawal_lot_usage
UNION ALL
SELECT 'withdraw_atomic_function', 1
WHERE EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'withdraw_atomic'
);
