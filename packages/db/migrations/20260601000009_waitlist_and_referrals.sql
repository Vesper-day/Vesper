-- Migration 9 — waitlist_and_referrals (waitlist, referral_credits)
-- Block 1 foundation, suffix 9 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 tables 16-17 (Migration Sequence step 9).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- waitlist (§3 table 16) -----------------------------------------------------
-- Pre-launch, unauthenticated email capture. converted_to_user_id populates on
-- launch day when a waitlist email matches a new trial signup; ON DELETE SET
-- NULL preserves attribution after account deletion. The waitlist row is never
-- part of the user-deletion cascade.
CREATE TABLE public.waitlist (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                text NOT NULL UNIQUE,
  platform_preference  platform_preference_enum NOT NULL,
  referral_source      text,
  converted_to_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Partial index for the "unconverted waitlist users" nurture-email query.
CREATE INDEX idx_waitlist_converted_to_user_id
  ON public.waitlist (converted_to_user_id)
  WHERE converted_to_user_id IS NULL;
-- For the launch-day segmented email send (iOS vs Android variants).
CREATE INDEX idx_waitlist_platform_preference
  ON public.waitlist (platform_preference);

-- referral_credits (§3 table 17) ---------------------------------------------
-- Referrer-only discount model. One row per successful conversion. recipient =
-- the referrer who receives the discount (CASCADE); source = the referee whose
-- conversion triggered it (SET NULL, preserves audit context). A credit whose
-- recipient is no longer active at application time is voided, not applied.
CREATE TABLE public.referral_credits (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_user_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  triggering_event      referral_event_enum NOT NULL,
  discount_percent      smallint NOT NULL DEFAULT 50 CHECK (discount_percent BETWEEN 1 AND 100),
  status                referral_credit_status_enum NOT NULL DEFAULT 'pending',
  applied_to_provider   payment_source_enum,
  applied_to_invoice_id text,
  provider_discount_id  text,
  void_reason           text,
  issued_at             timestamptz NOT NULL DEFAULT now(),
  applied_at            timestamptz,
  voided_at             timestamptz
);

-- For the "find my unapplied credits" query at billing time.
CREATE INDEX idx_referral_credits_recipient_status
  ON public.referral_credits (recipient_user_id, status);
-- For the "how many successful referrals has user X driven" query.
CREATE INDEX idx_referral_credits_source_user_id
  ON public.referral_credits (source_user_id)
  WHERE source_user_id IS NOT NULL;

-- Row Level Security ---------------------------------------------------------
-- waitlist: anonymous INSERT only; reads are service-role-only (§3 table 16).
-- referral_credits: own-row SELECT (recipient); writes service-role-only
-- (issuance/application/voiding in webhook handlers) (§3 table 17).
ALTER TABLE public.waitlist          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_credits  ENABLE ROW LEVEL SECURITY;

CREATE POLICY waitlist_insert_anon ON public.waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY referral_credits_select_own ON public.referral_credits
  FOR SELECT USING (auth.uid() = recipient_user_id);

COMMIT;
