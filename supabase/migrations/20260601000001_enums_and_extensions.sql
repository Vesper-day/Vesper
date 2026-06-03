-- Migration 1 — Enums and Extensions
-- Block 1 foundation, suffix 1 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 (Conventions, Migration Sequence step 1).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01 (no drizzle-kit generate).

BEGIN;

-- Extensions -----------------------------------------------------------------
-- pgsodium: at-rest encryption of OAuth tokens in integrations (§3 Encryption).
-- pgcrypto: gen_random_uuid() and SHA-256 email hashing (§3 / §4 hard-delete).
CREATE EXTENSION IF NOT EXISTS pgsodium;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enum types (24) ------------------------------------------------------------
-- Values reproduced verbatim from the per-table specs in TECHNICAL_SPEC.md §3.

CREATE TYPE archetype_enum AS ENUM (
  'nine_to_five', 'remote', 'student', 'athlete', 'founder', 'mixed'
);

CREATE TYPE honorific_enum AS ENUM (
  'sir', 'madam', 'none'
);

CREATE TYPE subscription_status_enum AS ENUM (
  'trial', 'active', 'past_due', 'read_only', 'archived', 'deletion_scheduled'
);

CREATE TYPE tier_enum AS ENUM (
  'standard', 'optimizer'
);

CREATE TYPE payment_source_enum AS ENUM (
  'stripe', 'apple'
);

CREATE TYPE block_type_enum AS ENUM (
  'work', 'fitness', 'nutrition', 'sleep', 'errands', 'medication',
  'finance', 'focus', 'commute', 'custom'
);

CREATE TYPE block_status_enum AS ENUM (
  'scheduled', 'in_progress', 'completed', 'skipped', 'rescheduled'
);

CREATE TYPE block_source_enum AS ENUM (
  'ai_generated', 'user_added', 'google_calendar', 'recurring'
);

CREATE TYPE priority_enum AS ENUM (
  'low', 'medium', 'high'
);

CREATE TYPE task_status_enum AS ENUM (
  'pending', 'in_progress', 'completed'
);

CREATE TYPE workout_level_enum AS ENUM (
  'beginner', 'intermediate', 'advanced'
);

CREATE TYPE recipe_difficulty_enum AS ENUM (
  'easy', 'medium', 'hard'
);

CREATE TYPE medication_frequency_enum AS ENUM (
  'daily', 'twice_daily', 'weekly', 'custom'
);

CREATE TYPE errand_frequency_enum AS ENUM (
  'weekly', 'biweekly', 'monthly'
);

CREATE TYPE bill_frequency_enum AS ENUM (
  'monthly', 'quarterly', 'annually', 'one_time'
);

CREATE TYPE integration_provider_enum AS ENUM (
  'google_calendar', 'apple_calendar', 'google_fit', 'apple_health'
);

CREATE TYPE integration_status_enum AS ENUM (
  'connected', 'disconnected', 'error'
);

CREATE TYPE push_platform_enum AS ENUM (
  'ios', 'android', 'web'
);

CREATE TYPE cancellation_reason_enum AS ENUM (
  'price_too_high', 'not_using_enough', 'found_alternative',
  'life_change', 'technical_issues', 'other'
);

CREATE TYPE referral_event_enum AS ENUM (
  'referee_converted'
);

-- referral_credit_status_enum: values pending, applied, voided.
-- The prior `expired` status is intentionally replaced by `voided` (§3 step 1).
CREATE TYPE referral_credit_status_enum AS ENUM (
  'pending', 'applied', 'voided'
);

CREATE TYPE completion_event_enum AS ENUM (
  'block_completed', 'block_skipped', 'block_rescheduled', 'energy_logged',
  'plan_generated', 'plan_regenerated', 'plan_fallback_served'
);

CREATE TYPE audit_operation_enum AS ENUM (
  'INSERT', 'UPDATE', 'DELETE'
);

CREATE TYPE platform_preference_enum AS ENUM (
  'ios', 'android'
);

COMMIT;
