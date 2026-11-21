-- ====================================================
-- APPLY BUNDLE 05 — ADMIN AUDIT LOG
--
-- WHAT: the `admin_audit_log` table behind the admin console's
--       audit trail (GET /api/admin/audit).
--
-- WHERE: the Supabase SQL Editor (or psql) against the project that
--        already runs the content bundles.
--
-- THIS FILE IS NOT APPLIED FROM THIS MACHINE. The human partner runs it.
--
-- Safe to re-run: the table is created IF NOT EXISTS and every policy is
-- dropped before it is created, so pasting the bundle twice changes nothing
-- the second time. It removes nothing.
--
-- The write side (`server/lib/audit.js`) inserts through the service-role
-- client and swallows a missing table, so a deployment that has not run this
-- bundle yet still serves product saves. The table is additive only.
-- ====================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    actor_id TEXT,
    actor_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx
    ON public.admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_audit_log_entity_created_at_idx
    ON public.admin_audit_log (entity, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_log_service ON public.admin_audit_log;
CREATE POLICY admin_audit_log_service ON public.admin_audit_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ====================================================
-- Verify:
--
--   SELECT count(*) FROM public.admin_audit_log;
--   SELECT action, entity, entity_id, actor_email FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 10;
-- ====================================================
