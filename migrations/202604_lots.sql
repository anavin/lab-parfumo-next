-- Lot/Batch Tracking (Phase E)
-- ทุกการรับของจะสร้าง lot ต่อ equipment line อัตโนมัติ
-- Idempotent — safe to re-run

-- ==================================================================
-- 1. lots table
-- ==================================================================
CREATE TABLE IF NOT EXISTS lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ระบุ lot
  lot_no TEXT NOT NULL UNIQUE,
  equipment_id UUID NOT NULL,
  equipment_name TEXT NOT NULL,         -- snapshot กันชื่อเปลี่ยน
  unit TEXT,

  -- ปริมาณ
  qty_initial NUMERIC NOT NULL CHECK (qty_initial > 0),
  qty_remaining NUMERIC NOT NULL DEFAULT 0,

  -- Provenance (มาจากไหน)
  po_id UUID,
  po_number TEXT,                       -- snapshot
  po_delivery_id UUID,
  supplier_name TEXT,
  supplier_lot_no TEXT,                 -- เลข lot ที่พิมพ์ข้างกล่อง

  -- วันที่ (optional — ใส่ภายหลังได้)
  manufactured_date DATE,
  expiry_date DATE,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- สถานะ
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'depleted', 'expired', 'discarded')),
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_name TEXT
);

-- FK เพิ่มแยก (กัน error ถ้าตาราง equipment/po ยังไม่มีเมื่อรัน)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lots_equipment_id_fkey'
  ) THEN
    ALTER TABLE lots
      ADD CONSTRAINT lots_equipment_id_fkey
      FOREIGN KEY (equipment_id) REFERENCES equipment(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lots_po_id_fkey'
  ) THEN
    ALTER TABLE lots
      ADD CONSTRAINT lots_po_id_fkey
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ==================================================================
-- 2. Indexes
-- ==================================================================
CREATE INDEX IF NOT EXISTS idx_lots_equipment ON lots(equipment_id);
CREATE INDEX IF NOT EXISTS idx_lots_status_active
  ON lots(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_lots_expiry
  ON lots(expiry_date) WHERE status = 'active' AND expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lots_po_id ON lots(po_id);
CREATE INDEX IF NOT EXISTS idx_lots_received_date ON lots(received_date DESC);

-- ==================================================================
-- 3. Sequence for lot_no auto-generation
-- ==================================================================
CREATE SEQUENCE IF NOT EXISTS lot_no_seq START 1;

-- helper function: next lot_no formatted as LOT-2026-00001
CREATE OR REPLACE FUNCTION next_lot_no() RETURNS TEXT AS $$
BEGIN
  RETURN 'LOT-' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT
       || '-' || LPAD(nextval('lot_no_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ==================================================================
-- 4. updated_at trigger
-- ==================================================================
CREATE OR REPLACE FUNCTION update_lots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lots_updated_at ON lots;
CREATE TRIGGER trg_lots_updated_at
  BEFORE UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION update_lots_updated_at();

-- ==================================================================
-- 5. withdrawals.lot_id (optional FK — ระบุว่าเบิกจาก lot ไหน)
-- ==================================================================
ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES lots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_lot_id ON withdrawals(lot_id);

COMMENT ON TABLE lots IS 'Lot/Batch tracking (Phase E) — สร้างอัตโนมัติเมื่อรับของจาก PO';
COMMENT ON COLUMN withdrawals.lot_id IS 'Optional: ระบุว่าเบิกจาก lot ไหน (FIFO หรือเลือกเอง)';
