-- ============================================================
-- Migration: Partial index for po_payments (hot path optimization)
-- รันใน Supabase Dashboard → SQL Editor (project lab-parfumo-po)
--
-- Query hot path: "unreimbursed payments per user" (dashboard aging +
-- my-payments filter=ยังไม่เบิก) — เกือบทุก row สุดท้ายจะ flip เป็น
-- reimbursed=true → partial index WHERE reimbursed=false เก็บแค่ครึ่ง
--
-- Idempotent — safe to re-run
-- ============================================================

-- Drop plain index (if exists from 202609) — เก็บ index ทั้ง table เกินจำเป็น
DROP INDEX IF EXISTS public.idx_pp_reimb_payer;

-- Partial index — เฉพาะ row ที่ยังไม่เบิก (~50-90% หลุด index)
CREATE INDEX IF NOT EXISTS idx_pp_unreimbursed_payer
  ON po_payments (paid_by_user_id, paid_date DESC)
  WHERE reimbursed = false;

-- แยก index สำหรับ query "reimbursed" (แสดง historical) — ตรงกัน
CREATE INDEX IF NOT EXISTS idx_pp_reimbursed_payer
  ON po_payments (paid_by_user_id, reimbursed_date DESC)
  WHERE reimbursed = true;

SELECT 'po_payments partial index ready ✅' AS status;
