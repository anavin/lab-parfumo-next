-- ============================================================
-- Migration: QA audit fixes (2026-08 batch)
-- รันใน Supabase Dashboard → SQL Editor
--
-- ประกอบด้วย 5 กลุ่มการแก้ (idempotent — รันซ้ำได้):
--   1. Missing indexes on hot-path columns
--   2. suppliers unique name → partial (exclude soft-deleted)
--   3. lots.qty_remaining CHECK >= 0 (invariant)
--   4. purchase_orders.status CHECK constraint (allowed enum)
--   5. increment_equipment_stock — RAISE instead of silent clamp
--   6. withdraw_atomic — RAISE on unallocated (rollback whole tx)
-- ============================================================


-- ==================================================================
-- 1) Missing indexes — hot-path WHERE / ORDER BY / JOIN columns
-- ==================================================================
-- purchase_orders (base table — ไม่มี migration เพราะสร้าง pre-migration folder)
CREATE INDEX IF NOT EXISTS idx_po_created_at
  ON purchase_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_creator_created
  ON purchase_orders (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_status_created
  ON purchase_orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_status_updated
  ON purchase_orders (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_status_received
  ON purchase_orders (status, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_po_expected_date
  ON purchase_orders (expected_date)
  WHERE expected_date IS NOT NULL AND deleted_at IS NULL;

-- po_activities — ยิงทุกครั้งเข้า PO detail + /audit
CREATE INDEX IF NOT EXISTS idx_po_activities_po_created
  ON po_activities (po_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_activities_created
  ON po_activities (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_activities_action
  ON po_activities (action);

-- po_comments — ยิงทุก PO detail
CREATE INDEX IF NOT EXISTS idx_po_comments_po_created
  ON po_comments (po_id, created_at DESC);

-- notifications — ยิงทุก header render
CREATE INDEX IF NOT EXISTS idx_notif_user_read
  ON notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_created
  ON notifications (created_at DESC);

-- login_attempts — ยิงทุก login + cleanup cron
CREATE INDEX IF NOT EXISTS idx_login_created
  ON login_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_username_created
  ON login_attempts (username, created_at DESC);

-- user_sessions — ยิงทุก request
CREATE INDEX IF NOT EXISTS idx_sessions_expires
  ON user_sessions (expires_at);

-- withdrawals — audit + user pages
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_created
  ON withdrawals (withdrawn_by, withdrawn_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_equipment_created
  ON withdrawals (equipment_id, withdrawn_at DESC);

-- lots composite FIFO — supersede single-column indexes for query planner
CREATE INDEX IF NOT EXISTS idx_lots_equipment_status_received
  ON lots (equipment_id, status, received_date ASC)
  WHERE status = 'active';


-- ==================================================================
-- 2) suppliers.name unique → partial (exclude soft-deleted rows)
-- ก่อน: name ซ้ำ = soft-deleted supplier ยึดชื่อถาวร
-- หลัง: trashed row ไม่นับ + สร้างใหม่ชื่อเดียวกันได้ + restore บล็อกถ้าชื่อชนกับ active
-- ==================================================================
DROP INDEX IF EXISTS uq_suppliers_name_lower;
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_name_lower_active
  ON suppliers (LOWER(TRIM(name)))
  WHERE deleted_at IS NULL;

COMMENT ON INDEX uq_suppliers_name_lower_active IS
  'Unique เฉพาะ supplier ที่ยังไม่ถูก soft-delete — trashed rows ไม่ยึดชื่อ';


-- ==================================================================
-- 3) lots.qty_remaining invariant (>= 0)
-- ก่อน: มีแค่ CHECK บน qty_initial > 0 — direct UPDATE ทำ negative ได้
-- หลัง: DB บังคับ >= 0 (ให้ trigger F2 จัดการ status='depleted' เมื่อถึง 0)
-- ==================================================================
DO $$
BEGIN
  -- Backfill: clamp negative → 0 ก่อน add constraint (กัน migration fail)
  UPDATE lots SET qty_remaining = 0 WHERE qty_remaining < 0;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lots_qty_remaining_nonneg'
  ) THEN
    ALTER TABLE lots
      ADD CONSTRAINT lots_qty_remaining_nonneg
      CHECK (qty_remaining >= 0);
  END IF;
END $$;


-- ==================================================================
-- 4) purchase_orders.status — CHECK enum
-- ก่อน: ไม่มี CHECK — พิมพ์ผิด/RPC bug เขียนค่าอะไรก็เข้า
-- หลัง: บังคับ 7 status ที่ระบบใช้จริง
-- ==================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'purchase_orders_status_check'
  ) THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT purchase_orders_status_check
      CHECK (status IN (
        'รอจัดซื้อดำเนินการ',
        'สั่งซื้อแล้ว',
        'กำลังขนส่ง',
        'รับของแล้ว',
        'มีปัญหา',
        'เสร็จสมบูรณ์',
        'ยกเลิก'
      ));
  END IF;
END $$;


-- ==================================================================
-- 5) increment_equipment_stock — RAISE instead of GREATEST(0, ...)
-- ก่อน: clamp ที่ 0 ปิด over-subtract → stock ผิดเงียบๆ
-- หลัง: RAISE EXCEPTION 'stock_underflow' → caller เห็น error + rollback
-- ==================================================================
CREATE OR REPLACE FUNCTION increment_equipment_stock(p_id UUID, p_qty NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
  v_new_stock NUMERIC;
  v_current   NUMERIC;
BEGIN
  -- Positive qty (add): safe
  -- Negative qty (subtract): ต้องมีของพอ
  IF p_qty < 0 THEN
    SELECT COALESCE(stock, 0) INTO v_current FROM equipment WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'equipment_not_found' USING HINT = p_id::text;
    END IF;
    IF v_current + p_qty < 0 THEN
      RAISE EXCEPTION 'stock_underflow'
        USING DETAIL = format('current=%s, delta=%s', v_current, p_qty),
              HINT   = p_id::text;
    END IF;
  END IF;

  UPDATE equipment
    SET stock = COALESCE(stock, 0) + p_qty,
        updated_at = NOW()
    WHERE id = p_id
    RETURNING stock INTO v_new_stock;

  RETURN v_new_stock;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_equipment_stock IS
  'Atomic stock delta. RAISE stock_underflow ถ้า negative delta ทำให้ stock < 0';


-- ==================================================================
-- 6) withdraw_atomic — RAISE on unallocated (rollback whole tx)
-- ก่อน: return unallocated > 0 → app มักเพิกเฉย + stock drift vs lots
-- หลัง: RAISE EXCEPTION 'unallocated_stock' → tx rollback, error กลับหา app
-- Contract เปลี่ยนเฉพาะ path fail — response fields success/lot_usages เหมือนเดิม
-- ==================================================================
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

  -- 2) Insert withdrawal record
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

  -- 3) FIFO consume lots
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

    UPDATE lots
    SET qty_remaining = qty_remaining - v_used
    WHERE id = v_lot.id;

    INSERT INTO withdrawal_lot_usage (withdrawal_id, lot_id, qty_used)
    VALUES (v_withdrawal_id, v_lot.id, v_used);

    v_lot_usages := v_lot_usages || jsonb_build_object(
      'lot_id', v_lot.id,
      'qty_used', v_used
    );

    IF v_primary_lot_id IS NULL THEN
      v_primary_lot_id := v_lot.id;
    END IF;

    v_remaining := v_remaining - v_used;
  END LOOP;

  -- 4) Reject if lots didn't cover the withdrawal — rollback whole tx
  --    ก่อน: return unallocated > 0 → app มัก ignore + stock drift
  --    หลัง: RAISE = tx rollback (stock, withdrawal, lot updates ทั้งหมดถอย)
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'unallocated_stock'
      USING DETAIL = format('missing=%s of %s', v_remaining, p_qty),
            HINT   = 'lots.active insufficient — reconcile stock vs lots first';
  END IF;

  -- 5) Back-fill primary lot
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
    'unallocated', 0
  );
END;
$$;

COMMENT ON FUNCTION withdraw_atomic IS
  'F1 (updated 2026-08) — Atomic withdraw. RAISE unallocated_stock ถ้า lots ไม่พอ (rollback ทั้ง tx)';


-- ==================================================================
-- Verify
-- ==================================================================
SELECT
  (SELECT count(*) FROM pg_indexes
    WHERE schemaname='public' AND indexname LIKE 'idx_po_%' OR indexname LIKE 'idx_notif_%'
       OR indexname LIKE 'idx_login_%' OR indexname LIKE 'idx_sessions_%'
       OR indexname LIKE 'idx_lots_equipment_status_received'
       OR indexname LIKE 'idx_po_activities_%'
       OR indexname LIKE 'idx_po_comments_%'
       OR indexname LIKE 'idx_withdrawals_%'
  ) AS indexes_present,
  (SELECT count(*) FROM pg_constraint WHERE conname = 'lots_qty_remaining_nonneg') AS lots_qty_check,
  (SELECT count(*) FROM pg_constraint WHERE conname = 'purchase_orders_status_check') AS status_check,
  (SELECT count(*) FROM pg_indexes WHERE indexname = 'uq_suppliers_name_lower_active') AS suppliers_partial_uq;

SELECT 'QA audit migration ready ✅' AS status;
