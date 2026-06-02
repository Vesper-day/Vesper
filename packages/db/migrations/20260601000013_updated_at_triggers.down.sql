-- Down migration 13 — updated_at triggers
-- Reverses 20260601000013_updated_at_triggers.sql. Local-dev reset only.
-- Drop all attachments before the function. calendar_events trigger is owned by
-- migration 18, not dropped here.

BEGIN;

DROP TRIGGER IF EXISTS set_updated_at_subscriptions ON public.subscriptions;
DROP TRIGGER IF EXISTS set_updated_at_integrations ON public.integrations;
DROP TRIGGER IF EXISTS set_updated_at_bills ON public.bills;
DROP TRIGGER IF EXISTS set_updated_at_recurring_errands ON public.recurring_errands;
DROP TRIGGER IF EXISTS set_updated_at_medications ON public.medications;
DROP TRIGGER IF EXISTS set_updated_at_weekly_priorities ON public.weekly_priorities;
DROP TRIGGER IF EXISTS set_updated_at_tasks ON public.tasks;
DROP TRIGGER IF EXISTS set_updated_at_blocks ON public.blocks;
DROP TRIGGER IF EXISTS set_updated_at_daily_plans ON public.daily_plans;
DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON public.user_profiles;
DROP TRIGGER IF EXISTS set_updated_at_users ON public.users;

DROP FUNCTION IF EXISTS public.set_updated_at();

COMMIT;
