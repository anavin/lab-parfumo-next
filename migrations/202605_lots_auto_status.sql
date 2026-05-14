-- Lot status auto-update trigger (F2 — audit round 2)
-- ก่อน: app ต้อง set status='depleted' ด้วยตัวเอง (lib/actions/withdraw.ts)
--       ถ้า admin update qty_remaining ผ่าน SQL ตรง → status ค้าง 'active'
-- หลัง: DB trigger enforce status ตาม qty_remaining + expiry_date อัตโนมัติ
--
-- Idempotent — รันซ้ำได้

-- ==================================================================
-- 1. Function: lot_status_enforce — ตรวจ + แก้ status ก่อน save
-- ==================================================================
-- Rules:
--   IF qty_remaining <= 0 AND status NOT IN ('discarded') → 'depleted'
--   IF expiry_date < CURRENT_DATE AND status = 'active' → 'expired'
--   IF qty_remaining > 0 AND status = 'depleted' → 'active' (re-activate กรณี restore)
--
-- Trigger: BEFORE UPDATE OR INSERT
-- ==================================================================
CREATE OR REPLACE FUNCTION lot_status_enforce()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. ถ้า admin set status='discarded' ตรงๆ → เคารพ ไม่แตะ
  IF NEW.status = 'discarded' THEN
    RETURN NEW;
  END IF;

  -- 2. ถ้า qty_remaining <= 0 → depleted (override active/expired ถ้าจำเป็น)
  IF COALESCE(NEW.qty_remaining, 0) <= 0 THEN
    NEW.status := 'depleted';
    RETURN NEW;
  END IF;

  -- 3. ถ้า qty_remaining > 0 แต่ status='depleted' (จาก restore) → active
  IF COALESCE(NEW.qty_remaining, 0) > 0 AND NEW.status = 'depleted' THEN
    NEW.status := 'active';
    -- ไม่ early return — เผื่อตัด expired ทับใน step ถัดไป
  END IF;

  -- 4. Expired check — ถ้า expiry_date เลย today แล้ว status='active' → 'expired'
  IF NEW.expiry_date IS NOT NULL
     AND NEW.expiry_date < CURRENT_DATE
     AND NEW.status = 'active'
  THEN
    NEW.status := 'expired';
  END IF;

  -- 5. ถ้า expiry_date กลับมาเป็น future (admin แก้) + status='expired' → active
  IF NEW.expiry_date IS NOT NULL
     AND NEW.expiry_date >= CURRENT_DATE
     AND NEW.status = 'expired'
     AND COALESCE(NEW.qty_remaining, 0) > 0
  THEN
    NEW.status := 'active';
  END IF;

  RETURN NEW;
END;
$$;

-- ==================================================================
-- 2. Trigger: ติดกับ lots — BEFORE INSERT OR UPDATE
-- ==================================================================
DROP TRIGGER IF EXISTS trg_lots_status_enforce ON lots;
CREATE TRIGGER trg_lots_status_enforce
  BEFORE INSERT OR UPDATE ON lots
  FOR EACH ROW
  EXECUTE FUNCTION lot_status_enforce();

COMMENT ON FUNCTION lot_status_enforce IS
  'Auto-enforce lot.status ตาม qty_remaining + expiry_date. ไม่แตะ status=discarded';
COMMENT ON TRIGGER trg_lots_status_enforce ON lots IS
  'BEFORE INSERT/UPDATE — bug-proof: app ไม่ต้อง set status เอง';

-- ==================================================================
-- 3. Backfill — sync status ของ row ที่มีอยู่ตอนนี้
-- ==================================================================
-- ทุก lot ที่ qty_remaining <= 0 + status='active' → depleted
UPDATE lots
SET status = 'depleted'
WHERE COALESCE(qty_remaining, 0) <= 0
  AND status = 'active';

-- ทุก lot ที่ expiry_date passed + status='active' → expired
UPDATE lots
SET status = 'expired'
WHERE expiry_date IS NOT NULL
  AND expiry_date < CURRENT_DATE
  AND status = 'active';

-- ==================================================================
-- 4. Verify
-- ==================================================================
SELECT
  status,
  COUNT(*) AS lot_count
FROM lots
GROUP BY status
ORDER BY status;
