-- Down migration 9 — waitlist_and_referrals
-- Reverses 20260601000009_waitlist_and_referrals.sql. Local-dev reset only.

BEGIN;

DROP TABLE IF EXISTS public.referral_credits;
DROP TABLE IF EXISTS public.waitlist;

COMMIT;
