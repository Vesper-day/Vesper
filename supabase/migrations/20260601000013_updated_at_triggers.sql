-- Migration 13 — generic set_updated_at() trigger + attachments
-- Block 1 foundation, suffix 13 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 Migration Sequence step 13.
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.
--
-- start_of_local_day(tz) was created in migration 4a, not here.
-- calendar_events does not exist yet (created in migration 18); its
-- set_updated_at trigger is attached inside migration 18.

BEGIN;

-- Generic updated_at maintainer. BEFORE UPDATE so the new timestamp is written
-- into the row being persisted. SECURITY DEFINER + pinned search_path for
-- consistency with the other trigger functions (injection prevention).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Attach to every table that currently has an updated_at column.
-- Skipped (no updated_at): workout_templates, recipe_templates, push_tokens
-- (last_used_at), subscription_events (received_at), waitlist, referral_credits,
-- completion_log, security_audit_log, deleted_user_email_hashes.
CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_user_profiles
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_daily_plans
  BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_blocks
  BEFORE UPDATE ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_weekly_priorities
  BEFORE UPDATE ON public.weekly_priorities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_medications
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_recurring_errands
  BEFORE UPDATE ON public.recurring_errands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_bills
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_integrations
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_subscriptions
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
