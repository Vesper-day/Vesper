-- Migration 12 — deleted_user_email_hashes
-- Block 1 foundation, suffix 12 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 table 20 (Migration Sequence step 12).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- deleted_user_email_hashes (§3 table 20) ------------------------------------
-- SHA-256 hashes of emails of hard-deleted accounts. Signup checks existence to
-- detect repeat trial signups (trial-abuse prevention). Contains no reversible
-- PII. Service-role-only on every operation (no public policies).
CREATE TABLE public.deleted_user_email_hashes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL UNIQUE,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

-- The UNIQUE constraint on email_hash is the only access path (existence check).

-- Row Level Security ---------------------------------------------------------
-- RLS enabled with no policies → deny-all to public roles; only the service
-- role (signup lookup, hard-delete worker) reads/writes (§3 table 20).
ALTER TABLE public.deleted_user_email_hashes ENABLE ROW LEVEL SECURITY;

COMMIT;
