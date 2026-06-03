-- Migration 11 — security_audit_log + audit triggers
-- Block 1 foundation, suffix 11 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 table 19 (Migration Sequence step 11).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.
--
-- Audit coverage is intentionally scoped to TWO tables per §3 table 19:
-- medications (most sensitive) and integrations (OAuth token mutation history).
-- subscriptions is covered by subscription_events; bills and push_tokens are
-- operational data without forensic need and are deliberately NOT audited.

BEGIN;

-- security_audit_log (§3 table 19) -------------------------------------------
-- Trigger-written only. The application never writes here directly. user_id is
-- ON DELETE CASCADE: audit rows are PII and are purged on hard-delete. Grows
-- unbounded at V1 (docs/RETENTION_POLICY.md).
CREATE TABLE public.security_audit_log (
  id         bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  table_name text NOT NULL,
  row_id     uuid NOT NULL,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  operation  audit_operation_enum NOT NULL,
  old_values jsonb,
  new_values jsonb,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Per-user audit queries.
CREATE INDEX idx_security_audit_log_user_id_changed_at
  ON public.security_audit_log (user_id, changed_at DESC);
-- "Show all changes to medication X" queries.
CREATE INDEX idx_security_audit_log_table_row
  ON public.security_audit_log (table_name, row_id);

-- Row Level Security ---------------------------------------------------------
-- Own-row SELECT only. No write policies: only the SECURITY DEFINER trigger
-- functions below write, and rows are never modified except via user-cascade.
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_audit_log_select_own ON public.security_audit_log
  FOR SELECT USING (auth.uid() = user_id);

-- Trigger functions ----------------------------------------------------------
-- SECURITY DEFINER so the function can write security_audit_log regardless of
-- the invoking user's policies. SET search_path = public pins resolution to
-- prevent search-path injection (§3 table 19). VOLATILE (default): these
-- functions perform an INSERT, so STABLE would be incorrect.

CREATE OR REPLACE FUNCTION public.audit_medications_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log
    (table_name, row_id, user_id, operation, old_values, new_values)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::uuid,
    COALESCE(NEW.user_id, OLD.user_id),
    TG_OP::audit_operation_enum,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_integrations_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.security_audit_log
    (table_name, row_id, user_id, operation, old_values, new_values)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::uuid,
    COALESCE(NEW.user_id, OLD.user_id),
    TG_OP::audit_operation_enum,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers (named audit_* so the audit-coverage verification query matches) ---
CREATE TRIGGER audit_medications_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.medications
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_medications_changes();

CREATE TRIGGER audit_integrations_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_integrations_changes();

COMMIT;
