-- Down migration 11 — security_audit_log + audit triggers
-- Reverses 20260601000011_security_audit_log.sql. Local-dev reset only.
-- Drop triggers before their functions; drop the table last.

BEGIN;

DROP TRIGGER IF EXISTS audit_integrations_changes ON public.integrations;
DROP TRIGGER IF EXISTS audit_medications_changes ON public.medications;

DROP FUNCTION IF EXISTS public.audit_integrations_changes();
DROP FUNCTION IF EXISTS public.audit_medications_changes();

DROP TABLE IF EXISTS public.security_audit_log;

COMMIT;
