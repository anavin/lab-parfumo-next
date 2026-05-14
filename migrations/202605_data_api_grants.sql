-- Data API Grants — เตรียมระบบสำหรับการเปลี่ยนแปลง Supabase
-- ประกาศ: https://supabase.com — เริ่ม 30 May 2026 (new projects), 30 Oct 2026 (existing)
-- เปลี่ยน: tables ใน "public" ต้องมี GRANT ชัดเจน — Data API ถึงเข้าถึงได้
--
-- กลยุทธ์ของระบบเรา:
--   ระบบเข้า DB ทาง service_role เท่านั้น (lib/supabase/server.ts ใช้ SUPABASE_SERVICE_ROLE_KEY)
--   → GRANT ALL ให้ service_role (ทุก table)
--   → REVOKE จาก anon + authenticated (defense in depth)
--   → ENABLE RLS (กัน leak ถ้าวันหนึ่งเปิด anon key ใช้)
--
-- Idempotent — รันซ้ำได้

-- ==================================================================
-- 1. Tables — GRANT service_role + REVOKE anon/authenticated + RLS
-- ==================================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        -- Core tables
        'users', 'user_sessions', 'login_attempts',
        'equipment', 'equipment_categories',
        'purchase_orders', 'po_activities', 'po_comments', 'po_deliveries',
        'withdrawals', 'notifications', 'company_settings',
        -- Migration tables
        'suppliers', 'lookups', 'lots',
        'po_counters',
        -- Budget tables (ถ้ามี)
        'budgets', 'budget_categories'
      )
  LOOP
    -- 1.1) Grant ทุกสิทธิ์ให้ service_role (app ใช้ key นี้)
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);

    -- 1.2) Revoke จาก anon + authenticated (เราไม่ใช้ Data API ผ่าน client keys)
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', tbl);

    -- 1.3) Enable RLS — defense in depth
    --      service_role bypasses RLS อยู่แล้ว
    --      ถ้าวันหนึ่งเปิด anon access ก็จะ block อัตโนมัติ (no policies = no access)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    RAISE NOTICE 'Granted public.% to service_role + RLS enabled', tbl;
  END LOOP;
END
$$;

-- ==================================================================
-- 2. Functions / RPCs — GRANT EXECUTE ให้ service_role
-- ==================================================================

DO $$
DECLARE
  fn TEXT;
BEGIN
  -- RPC ที่ app เรียกผ่าน sb.rpc()
  FOR fn IN
    SELECT proname FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'next_po_number',
        'next_po_delivery_no',
        'next_lot_no',
        'withdraw_stock',
        'increment_equipment_stock'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO service_role', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM anon', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM authenticated', fn);
    RAISE NOTICE 'Granted EXECUTE on %() to service_role', fn;
  END LOOP;
END
$$;

-- ==================================================================
-- 3. Sequences — GRANT USAGE ให้ service_role (next_lot_no ใช้)
-- ==================================================================

DO $$
DECLARE
  seq TEXT;
BEGIN
  FOR seq IN
    SELECT sequencename FROM pg_sequences
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO service_role', seq);
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon', seq);
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM authenticated', seq);
  END LOOP;
END
$$;

-- ==================================================================
-- 4. Future-proof: grant default privileges สำหรับ tables/functions ใหม่
--    ที่จะถูกสร้างต่อไป — ไม่ต้องใส่ GRANT ในทุก migration
-- ==================================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM authenticated;

-- ==================================================================
-- 5. Verify — show summary
-- ==================================================================

SELECT
  'TABLES' AS kind,
  COUNT(*) AS total_in_public
FROM pg_tables WHERE schemaname = 'public'
UNION ALL
SELECT 'RLS_ENABLED', COUNT(*)
FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true
UNION ALL
SELECT 'FUNCTIONS', COUNT(*)
FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prokind = 'f'
UNION ALL
SELECT 'SEQUENCES', COUNT(*)
FROM pg_sequences WHERE schemaname = 'public';

COMMENT ON SCHEMA public IS
  'Lab Parfumo PO — service_role only. anon/authenticated revoked. RLS enabled.';
