# STRIPE_CUTOVER

**Trigger:** Cutting the Stripe billing integration from **test mode** to **live mode** for the first paid launch — swapping test keys for live keys, onboarding Stripe Tax, and re-pointing the webhook at the production endpoint. Also re-run (in part) if the live price is re-created or the webhook endpoint URL changes.
**Frequency:** Once at launch (the test→live cutover). Individual steps (webhook re-registration, key roll) recur on-demand thereafter.
**Owner:** Founder (V1).

> **Scope (authoritative — TECHNICAL_SPEC §8/§9).** This runbook covers the **operational** cutover of the two web billing entry points that create Stripe sessions:
> - `POST /api/v1/subscription/checkout` → Checkout Session, returns `{ url }`.
> - `POST /api/v1/subscription/portal` → Customer Portal Session, returns `{ url }`.
>
> Both are **session-creation only**. They read `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` from the environment (the price is **never** hardcoded, §8) and build the success/cancel/return URLs from `NEXT_PUBLIC_APP_URL`. The web routes run on **Vercel** (Node runtime), so `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` are set in the **Vercel** project env.
>
> **Out of scope for this runbook's code:** the Stripe **webhook handler** (subscription state transitions on `checkout.session.completed`, `customer.subscription.*`, etc.) is a **separate chat**. This runbook covers only the **endpoint registration + signing-secret** operational step (§3 below), not the handler logic. No subscription-state write happens in the session routes.

## Detection

Not an incident runbook — this is a scheduled launch procedure. Run it when moving from the test-mode integration (built and verified with `sk_test_…` / `price_…` test IDs) to accepting real cards. Re-run the relevant sub-section if: the live price is replaced (new `STRIPE_PRICE_ID`), the webhook endpoint URL changes, or the webhook signing secret must be rotated.

Before starting, confirm access to: the **Stripe Dashboard** (with the account toggled to **live mode** for the live-side steps), the **Vercel** project settings (web env vars), and the **Cloudflare** dashboard / `wrangler` (webhook worker env, §3).

## Procedure

Do the steps in order. The **load-bearing ordering** (§2 → §3, then flip the keys last) exists so no window ever bills a real card against a stale or unsigned endpoint.

### 1. PREREQUISITE — onboard Stripe Tax before the first live Checkout

The Checkout Session is created with `automatic_tax: { enabled: true }` (§8). **If Stripe Tax is not onboarded, Stripe rejects the session creation** — a live Checkout will fail closed, not silently skip tax. Complete this **before** any live Checkout is attempted:

1. In the Stripe Dashboard → **Settings → Tax**, **accept the Stripe Tax terms**. Tax is inert until the terms are accepted.
2. Register the **tax registrations / state nexus** for every jurisdiction where Vesper has an obligation to collect (Dashboard → **Tax → Registrations**). `automatic_tax` only computes tax for jurisdictions with an active registration; a missing registration means no tax is charged there, not a hard failure — but the terms must still be accepted for the session to create at all.
3. Set the **origin address** (Dashboard → **Tax → Settings**) — Stripe needs it to determine tax behaviour.
4. **Confirm the product carries tax code `txcd_10103001`** (SaaS / digital services subscription, §8): Dashboard → **Product catalog → Vesper Standard Monthly → Tax code**. If it is unset or wrong, set it to `txcd_10103001` on the product so every line item inherits the correct category. Verify this in **live mode** specifically — the test-mode and live-mode product catalogs are separate.

> Do not proceed to real payments until **Settings → Tax** shows the terms accepted and at least the home-jurisdiction registration active. This is the single most common cutover failure: `automatic_tax` enabled + Tax not onboarded ⇒ every live Checkout 4xxs.

### 2. Test → production key swap (order matters)

Two secrets change value between test and live, and **both differ** — the price ID is not the same object across modes:

- `STRIPE_SECRET_KEY`: `sk_test_…` → `sk_live_…`
- `STRIPE_PRICE_ID`: the **live** `price_…` (create the product + $19.99/mo recurring price **in live mode**; its ID is distinct from the test price). `.env.example` documents both the test placeholder (`price_…`) and the live-key block.

**Do NOT flip the live secret key until the live webhook endpoint exists and its signing secret is captured (§3).** If `STRIPE_SECRET_KEY` goes live while the webhook still points at the test endpoint (or none), a real customer can complete Checkout and their `checkout.session.completed` event has nowhere valid to land — the subscription would be paid at Stripe but never attributed in our DB. Safe order:

1. Create the **live** product + price in the Stripe Dashboard (live mode). Record the live `price_…`.
2. Register the **live** webhook endpoint and capture its signing secret first — **§3 below**.
3. **Only then** set the live values in Vercel: update `STRIPE_PRICE_ID` to the live price and `STRIPE_SECRET_KEY` to `sk_live_…` in the Vercel project env, and **redeploy** the web app so the running functions pick up the new env. (Vercel env changes require a redeploy to take effect.)
4. Set `STRIPE_SECRET_KEY` (`sk_live_…`) and `STRIPE_WEBHOOK_SECRET` (from §3) on the webhook worker's Cloudflare env as well, so the worker verifies live events against the live account.

Flipping the key **last** means the first moment a real card can be charged is also the first moment a correctly-signed live endpoint is already listening.

### 3. Webhook endpoint reconfiguration

> The webhook **handler** (event verification + state machine) ships in a **separate chat** and is out of scope here. This step is the **endpoint registration + signing secret** only — the operational plumbing the future handler will consume.

1. In the Stripe Dashboard (**live mode**) → **Developers → Webhooks → Add endpoint**, register the production endpoint at the Cloudflare Worker URL: **`https://<worker-host>/webhooks/stripe`**. Subscribe it to the subscription-lifecycle events the handler will need (at minimum `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`).
2. Copy the endpoint's **Signing secret** (`whsec_…`) and store it as **`STRIPE_WEBHOOK_SECRET`** on the **webhook worker's** Cloudflare env (`wrangler secret put STRIPE_WEBHOOK_SECRET --name <worker>`). This is the value the handler uses to verify each event's signature; it is distinct per endpoint, so the live endpoint's secret is **not** the test endpoint's secret.
3. Confirm the endpoint is **enabled** and shows the live account. Leave the test-mode endpoint in place (separate mode) — it does not interfere with live traffic.

### 4. Verification

Run all four before declaring the cutover done. Some are test-mode (safe, no real charge); the real-card confirmation is a single deliberate live smoke.

1. **Checkout session opens** — hit `POST /api/v1/subscription/checkout` as an authenticated user and follow the returned `{ url }`. Confirm the Stripe-hosted Checkout page actually loads with the **Vesper Standard Monthly** line item at **$19.99/mo**. Do this first with **test keys** (`sk_test_` / test price) to validate the wiring end-to-end without a real charge, then repeat once live keys are in.
2. **Automatic tax renders** — on that same Checkout page, confirm a **tax line** appears (enter an address in a registered jurisdiction). If tax is absent or the page errors on load, Stripe Tax is not onboarded (§1) or the product is missing `txcd_10103001` — fix before real traffic.
3. **Customer Portal opens** — hit `POST /api/v1/subscription/portal` for a customer that **has a `stripe_customer_id`** and follow `{ url }`; confirm the Stripe billing portal loads. A user with **no** completed checkout has no `stripe_customer_id`, so the route returns **409 CONFLICT** by design — that is correct, not a failure. Because a `stripe_customer_id` only exists **after a completed checkout is processed by the webhook handler (a later chat)**, the live Portal smoke may be **deferred** until the handler ships and one test subscription has been created.
4. **Where to watch for failures** — Stripe Dashboard → **Developers → Events / Logs** for session-creation and webhook-delivery errors (look for failed `automatic_tax` and non-2xx webhook deliveries); Stripe → **Webhooks → [endpoint]** for delivery attempts and response codes; and the app's **Sentry** for `INTEGRATION_ERROR` (Stripe returned no URL) / `INTERNAL_ERROR` (missing `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID`) thrown by the session routes.

## Rollback

Revert to test mode by restoring the **test** values in Vercel (`STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_PRICE_ID=` the test price) and redeploying; disable the live webhook endpoint in the Stripe Dashboard. Because the session routes are **stateless** (they write no subscription state — that is the webhook handler's job, out of scope here), reverting the env is a clean rollback: no partial DB state is created by the routes themselves. Any real subscription already created at Stripe is unaffected by the env revert and must be handled at Stripe directly (cancel/refund) if the cutover is being aborted.

## Post-Incident Review

- **What happened** — planned launch cutover vs. a re-run (price re-create / webhook change / secret rotation); which secrets changed and where (Vercel vs. Cloudflare).
- **Timeline** — Tax onboarded, live webhook registered + secret captured, live keys set + redeployed, verification passed.
- **Root cause** — for any failed live Checkout: Tax not onboarded, wrong/missing `txcd_10103001`, stale env (no redeploy), or key flipped before the webhook was live.
- **Action items** — e.g. add a pre-launch checklist gate for "Stripe Tax terms accepted", script the Vercel/Cloudflare env swap so no surface is missed, or add a Sentry alert on session-route `INTEGRATION_ERROR`.
