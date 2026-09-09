-- ============================================================
-- Migration: Credit-card payment tracking + reimbursement (simple)
-- รันใน Supabase Dashboard → SQL Editor (project lab-parfumo-po)
--
-- Design: 1-table pattern
--   po_payments = การรูดบัตร 1 ครั้ง (1 row per PO)
--     - จ่ายเดี่ยว     → 1 row, payment_group_id = NULL
--     - จ่ายรวมหลาย PO → N rows share payment_group_id เดียวกัน
--   purchase_orders + paid_amount + payment_status (computed via server action)
--
-- ไม่มี M:N join table, ไม่มี trigger, ไม่มี reimbursements table
-- Idempotent — รันซ้ำได้
-- ============================================================

-- ==================================================================
-- 1) po_payments
-- ==================================================================
CREATE TABLE IF NOT EXISTS po_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id             UUID NOT NULL,        -- FK เพิ่มใน DO $$ ด้านล่าง (guard against schema race)

  -- ★ Grouping — คีย์หลักของ feature
  payment_group_id  UUID,                 -- รูดพร้อมกันหลาย PO → share id
                                          -- NULL = จ่ายเดี่ยว

  amount            NUMERIC NOT NULL CHECK (amount > 0),
  paid_date         DATE NOT NULL,

  -- คนจ่าย
  paid_by_user_id   UUID NOT NULL,
  paid_by_name      TEXT NOT NULL,        -- snapshot กัน user rename

  -- บัตร (free-text — ไม่ต้องมี credit_cards table)
  card_display      TEXT,                 -- "KTC anavin •••1234"
  approval_code     TEXT,
  slip_url          TEXT,

  -- Reimbursement — ง่ายๆ boolean
  reimbursed        BOOLEAN NOT NULL DEFAULT FALSE,
  reimbursed_date   DATE,
  reimbursement_ref TEXT,                 -- free-text: "โอนคืน 15/9" หรือ statement no.
  reimbursed_by     UUID,                 -- admin ที่ mark
  reimbursed_by_name TEXT,

  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID
);

-- FK เพิ่มแยก (defensive — เผื่อ table ยังไม่พร้อม)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'po_payments_po_id_fkey'
  ) THEN
    ALTER TABLE po_payments
      ADD CONSTRAINT po_payments_po_id_fkey
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'po_payments_payer_fkey'
  ) THEN
    ALTER TABLE po_payments
      ADD CONSTRAINT po_payments_payer_fkey
      FOREIGN KEY (paid_by_user_id) REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pp_po
  ON po_payments (po_id);
CREATE INDEX IF NOT EXISTS idx_pp_group
  ON po_payments (payment_group_id)
  WHERE payment_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pp_reimb_payer
  ON po_payments (paid_by_user_id, reimbursed, paid_date DESC);
CREATE INDEX IF NOT EXISTS idx_pp_paid_date
  ON po_payments (paid_date DESC);

-- Grants (per Supabase 30-Oct-2026 pattern)
GRANT ALL ON public.po_payments TO service_role;
REVOKE ALL ON public.po_payments FROM anon;
REVOKE ALL ON public.po_payments FROM authenticated;
ALTER TABLE po_payments ENABLE ROW LEVEL SECURITY;

-- ==================================================================
-- 2) purchase_orders — เพิ่ม 2 columns (server action คำนวณ)
-- ==================================================================
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';

-- CHECK constraint — เพิ่มเมื่อยังไม่มี (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'purchase_orders_payment_status_check'
  ) THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT purchase_orders_payment_status_check
      CHECK (payment_status IN ('unpaid','partial','paid','overpaid'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_po_payment_status
  ON purchase_orders (payment_status)
  WHERE payment_status IN ('unpaid','partial');

COMMENT ON COLUMN purchase_orders.paid_amount IS
  'sum(po_payments.amount WHERE po_id = this) — computed by server action';
COMMENT ON COLUMN purchase_orders.payment_status IS
  'unpaid / partial / paid / overpaid — computed จาก paid_amount vs total';

-- ==================================================================
-- 3) Verify
-- ==================================================================
SELECT
  (SELECT count(*) FROM po_payments) AS existing_payments,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name = 'purchase_orders'
      AND column_name IN ('paid_amount','payment_status')) AS po_columns_added;

SELECT 'po_payments migration ready ✅' AS status;
