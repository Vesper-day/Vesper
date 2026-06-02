-- Migration 8 — subscriptions (subscriptions, subscription_events)
-- Block 1 foundation, suffix 8 (docs/MIGRATION_NUMBER_ALLOCATION.md).
-- Source: TECHNICAL_SPEC.md §3 tables 14-15 (Migration Sequence step 8).
-- Hand-written per ARCHITECTURE_DECISIONS Decision 01.

BEGIN;

-- subscriptions (§3 table 14) ------------------------------------------------
-- Authoritative subscription state, 1:1 with users. users.subscription_status
-- is a denormalized cache of subscriptions.status; this table is source of
-- truth. Provider switches update the row in place. Service-role-only writes.
CREATE TABLE public.subscriptions (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                       uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  provider                      payment_source_enum NOT NULL,
  status                        subscription_status_enum NOT NULL,
  stripe_customer_id            text,
  stripe_subscription_id        text,
  stripe_price_id               text,
  apple_original_transaction_id text,
  apple_product_id              text,
  current_period_start          timestamptz,
  current_period_end            timestamptz,
  cancel_at_period_end          boolean NOT NULL DEFAULT false,
  canceled_at                   timestamptz,
  cancellation_reason           cancellation_reason_enum,
  cancellation_reason_text      text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now(),
  -- Provider/identifier consistency: stripe rows carry a stripe_customer_id and
  -- no apple id; apple rows carry an apple_original_transaction_id and no
  -- stripe id (§3 table 14 CHECK).
  CONSTRAINT subscriptions_provider_identifier_check CHECK (
    (provider = 'stripe' AND stripe_customer_id IS NOT NULL
       AND apple_original_transaction_id IS NULL)
    OR
    (provider = 'apple' AND apple_original_transaction_id IS NOT NULL
       AND stripe_customer_id IS NULL)
  )
);

-- The UNIQUE (user_id) constraint is the primary access path. Remaining indexes
-- serve webhook-handler lookups and renewal-window cron sweeps (§3 table 14).
CREATE INDEX idx_subscriptions_stripe_customer_id
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_subscriptions_stripe_subscription_id
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_subscriptions_apple_original_transaction_id
  ON public.subscriptions (apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;
CREATE INDEX idx_subscriptions_current_period_end
  ON public.subscriptions (current_period_end)
  WHERE status IN ('active', 'past_due');

-- subscription_events (§3 table 15) ------------------------------------------
-- Idempotency log for Stripe/Apple webhooks. (provider, event_id) guarantees
-- exactly-once processing. user_id nullable: some events arrive before the user
-- is resolvable. Service-role-only on every operation.
CREATE TABLE public.subscription_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider         payment_source_enum NOT NULL,
  event_id         text NOT NULL,
  event_type       text NOT NULL,
  user_id          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  payload          jsonb NOT NULL,
  processed_at     timestamptz,
  processing_error text,
  received_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE INDEX idx_subscription_events_user_id
  ON public.subscription_events (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX idx_subscription_events_processed_at
  ON public.subscription_events (processed_at)
  WHERE processed_at IS NULL;

-- Row Level Security ---------------------------------------------------------
-- subscriptions: own-row SELECT only; writes are service-role-only (webhook
-- handlers). subscription_events: no public policies whatsoever (§3 tables
-- 14-15).
ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

COMMIT;
