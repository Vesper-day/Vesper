-- Down — Migration 1 (Enums and Extensions)
-- Reverses 20260601000001_enums_and_extensions.sql.
-- Local-dev / supabase db reset only — never run in production
-- (docs/MIGRATION_DISCIPLINE.md). Drops enums then extensions in reverse order.

BEGIN;

-- Enums (reverse creation order) ---------------------------------------------
DROP TYPE IF EXISTS platform_preference_enum;
DROP TYPE IF EXISTS audit_operation_enum;
DROP TYPE IF EXISTS completion_event_enum;
DROP TYPE IF EXISTS referral_credit_status_enum;
DROP TYPE IF EXISTS referral_event_enum;
DROP TYPE IF EXISTS cancellation_reason_enum;
DROP TYPE IF EXISTS push_platform_enum;
DROP TYPE IF EXISTS integration_status_enum;
DROP TYPE IF EXISTS integration_provider_enum;
DROP TYPE IF EXISTS bill_frequency_enum;
DROP TYPE IF EXISTS errand_frequency_enum;
DROP TYPE IF EXISTS medication_frequency_enum;
DROP TYPE IF EXISTS recipe_difficulty_enum;
DROP TYPE IF EXISTS workout_level_enum;
DROP TYPE IF EXISTS task_status_enum;
DROP TYPE IF EXISTS priority_enum;
DROP TYPE IF EXISTS block_source_enum;
DROP TYPE IF EXISTS block_status_enum;
DROP TYPE IF EXISTS block_type_enum;
DROP TYPE IF EXISTS payment_source_enum;
DROP TYPE IF EXISTS tier_enum;
DROP TYPE IF EXISTS subscription_status_enum;
DROP TYPE IF EXISTS honorific_enum;
DROP TYPE IF EXISTS archetype_enum;

-- Extensions (reverse creation order) ----------------------------------------
DROP EXTENSION IF EXISTS pgcrypto;
DROP EXTENSION IF EXISTS pgsodium;

COMMIT;
