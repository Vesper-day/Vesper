# Layer 5: Business and Monetization

## Layer Purpose

Layer 5 translates the product, technical, and experience specifications locked in prior layers into a concrete commercial structure. Where Layer 2 defined what the product does, Layer 3 defined how it is built, and Layer 4 defined how it looks and sounds, Layer 5 defines how it makes money, how that money flows through legal and tax infrastructure, and how the business is structured to survive its first year of operation.

This layer produces seven sets of decisions: the pricing model and tier structure with specific dollar amounts; the payment infrastructure spanning Apple's in-app purchase system, Stripe for web, and the reconciliation between them; the subscription lifecycle covering trial onset, active subscription, dunning on failed payment, read-only continuation, archive, and hard delete; the refund and cancellation policies with their underlying philosophy; the legal foundation including privacy policy, terms of service, data handling commitments, and the regulatory posture for US launch with eventual expansion in mind; the business entity structure that preserves founder anonymity while remaining compliant with California residency tax obligations; and the unit economics analysis that grounds every other decision in real margin math.

Decisions in this layer interact directly with Layer 3's technical architecture (Stripe webhook handlers, subscription state fields, Cloudflare Workers for dunning checks) and with Layer 4's copy library (all subscription-related user-facing copy is locked in Layer 4 and referenced here). Where Layer 5 modifies or expands prior-layer decisions, the change is documented explicitly in the cross-layer updates section at the end.

## Working Direction From Prior Layers

The product is a Life OS for young professionals, launching in the United States only at V1, with a butler-tone voice and warm-dark aesthetic. The business model is a one-week free trial converting to paid, with no permanent free tier. The trial requires no credit card upfront, includes every V1 feature, and converts to a paid subscription only when the user explicitly opts to continue at the trial's conclusion. The trial-end flow surfaces butler-voice reminders at two days before, one day before, and on the end date, with two clean options (continue or end) on the end-date screen. The post-trial and post-cancellation states transition through a seven-day read-only continuation mode, then a thirty-day archive, then hard delete. Cancellation is deliberately frictionless, with no retention modals, no last-minute discount offers, and no adversarial confirmation prompts. A win-back survey arrives forty-eight hours after cancellation via email, framed as a no-oriented question that respects the user's exit decision. The realistic AI cost is approximately $1.00 to $1.50 per active paying user per month, with $1.20 as the planning midpoint. This is derived from Sonnet 4.6 ($3/$15 per million input/output tokens) and Haiku 4.5 ($1/$5) against a blended cold/warm cache pattern at 15 to 20 active days per month. Earlier $0.30 to $0.50 figures used an understated output-token count and an engagement assumption (5 to 7 days per month) consistent with a churning user rather than an engaged one. Stripe Checkout, Customer Portal, and Pricing Tables are the hosted payment infrastructure choices locked in Layer 3. The founder operates anonymously, with anonymity preserved through the build phase and into public launch.

Layer 5 builds entirely within those constraints.

## Pricing Model

The pricing model is a **paid trial converting to a monthly subscription** with no permanent free tier and no annual billing option at V1. Each component of that sentence carries weight and is justified below.

**Paid trial rather than freemium.** A permanent free tier was rejected during Layer 2 brainstorming. Freemium models work best when the free tier costs the operator near-zero per user and when the upgrade path is feature-driven. Neither condition holds here: every active user, free or paid, incurs measurable AI cost (template selection, plan synthesis, edits), so a free tier would burn margin indefinitely without conversion. The one-week trial captures the same psychological benefit (try before you buy, no upfront friction) without subsidizing non-converting users in perpetuity.

**Seven days rather than fourteen or thirty days.** Seven days is a shorter window than the base profile model would ideally have to personalize against the user's patterns, and the trade-off is acknowledged honestly: an extra week would offer modestly more surface for the engine to settle in. The seven-day choice is nonetheless correct for V1 on four grounds.

The first is unit economics. Trial users are cold-cache by default because the sleep-alarm prewarming pathway requires module configuration that does not happen in week one. Fourteen days of trial usage at approximately $0.074 per fully-engaged day equals $1.04 in AI spend per non-converting trial user; at four to five active days within fourteen, approximately $0.30 to $0.37. Seven days at the same daily rate equals $0.52 fully-engaged or $0.30 to $0.37 partially-engaged, with $0.45 as the planning midpoint. The halving of cumulative cost applies to the ninety-plus percent of trial signups who never convert (at a realistic six percent conversion rate). At V1 funnel volumes the difference is material; at scale it dominates the trial-cost line item entirely.

The second is that the base profile is more portable than the original "one to two weeks to personalize" framing assumed. Plan quality on day one through seven is already strong because the prompt-context architecture (Layer 1's voice and structural specification, Layer 2's user base context, Layer 3's filtered template subset) carries most of the signal that determines plan quality. Only Layer 4, today's specifics, varies day to day. The engine does not need fourteen days of accumulated behavior to demonstrate value; it needs one good morning brief and several adequate iterations after that. Seven days is sufficient for both.

The third is urgency without manufactured scarcity. A seven-day window creates natural decision pressure without invoking the countdown timers and "limited spots" tactics Layer 1 explicitly rejects. The day-six soft prompt with one-tap pay (specified below) captures committed users at low friction, and users who have not decided by day seven are unlikely to have decided at day fourteen either; an extra week of indecision usually resolves the same way the first week did.

The fourth is competitive validation. Empirically tested trial lengths in productivity SaaS span seven to fourteen days, and both points are defensible. Sunsama and Notion sit at fourteen; many comparable indie tools sit at seven. The seven-day choice trades a small expected reduction in conversion rate for materially better trial-cost economics, and the trial length itself is a Layer 5 decision that can extend to ten or fourteen days in a Phase 5 revision without requiring schema or architecture changes if post-launch data warrants it.

**No card required upfront.** This is locked from Layer 4's onboarding flow ("One week free. No card required."). The friction reduction at signup outweighs the conversion penalty at trial end. Requiring a card upfront converts more trial users to paid because the default action becomes "do nothing and get charged," but the signup conversion rate drops materially. For an indie launch optimizing for top-of-funnel signups and word-of-mouth, no-card-required is correct.

**End-of-trial soft prompt with one-tap pay.** On trial day six, twenty-four hours before the trial ends, Vesper surfaces a soft prompt offering one-tap conversion via Apple Pay on iOS or Stripe Link on web. A single biometric confirmation converts the user; users who do nothing let the trial expire to read-only. This pattern captures committed users at materially lower friction than a manual checkout flow, with industry benchmarks for one-tap-pay conversion in the twenty-five to thirty percent range against the fifteen percent typical of plain no-card trials. The prompt itself is not a default-yes pre-authorization, so no surprise charges occur; the user takes a deliberate action or the trial ends quietly. This preserves the no-card-required posture at signup while recovering most of the conversion benefit that card-required-upfront flows obtain by manipulating the default.

**Monthly billing only at V1.** Annual billing with a discount was considered and rejected. Three reasons. First, annual discounts implicitly signal that monthly pricing is inflated, undermining the premium positioning. Second, an annual plan introduces complexity around mid-year cancellations, pro-rated refunds, and renewal timing that the V1 codebase should not carry. Third, offering a discount at all can read as a struggling-startup signal; absence of a discount reads as confidence in the product. Annual billing is deferred to V2 or V3, introduced only if data shows users explicitly requesting it for budgeting reasons.

**Single tier at V1.** The Optimizer power-user tier referenced in Layer 1 is deferred to V1.5 or V2. The features that would differentiate Optimizer from Standard (quantified-self dashboards, correlation insights, deeper AI customization) do not ship at V1 per Layer 2's V1.5 and V2 roadmaps. Launching with one tier eliminates pricing-page complexity, reduces user confusion at the conversion moment, and removes the engineering work of building a feature-gating layer that is not yet needed. When Optimizer launches with V1.5 dashboards, it slots in cleanly above the Standard tier without disrupting existing subscribers.

## Tier Structure at V1

One paid tier exists at V1: Standard. There is no free tier and there is no second paid tier.

**Vesper Standard.** $19.99 per month. Includes all seven V1 pillars without restriction: the AI plan engine, all seven modules (work, fitness, nutrition, sleep, errands, medication, finance), the calendar dual surface (Google Calendar plus built-in), the mobile-and-web platform parity, the natural-language input surface, the adaptive onboarding flow, and the Dynamic Island integration. The one-week free trial includes the same complete feature set, with the same usage limits (which is to say, no usage limits beyond the underlying API rate limits which are not user-facing). Trial accounts are capped at two plan generations per local day; paid accounts are capped at five per rolling hour. The trial cap protects margin on non-converting users without degrading the core experience for anyone actively evaluating the product.

## Tier Structure at V1.5 (Forward-Looking)

When V1.5 ships, the Optimizer tier launches above Standard. This is documented now so the V1 architecture is built with the tier flag in place from day one (a `tier` enum on the user row defaulting to `standard` ships at V1; the `optimizer` value activates at V1.5).

**Vesper Optimizer (V1.5).** Tentatively $29.99 per month. Includes everything in Standard plus the quantified-self dashboards (sleep, energy, workout completion, focus time, mood, correlation insights), the weekly review with AI-generated insights from the prior week's data, and deeper template adaptation (the AI receives broader latitude to modify templates beyond simple parameter swaps). The Optimizer pricing is documented as tentative because actual demand for the tier and willingness-to-pay are not yet known; final pricing locks during V1.5 development based on closed beta feedback from V1 users.

This is explicitly not a launch-day decision. It is documented here so V1 architecture accommodates it cleanly.

## Price Point Reasoning

The $19.99 monthly price is anchored against four reference points. First, comparable productivity tools in the same psychographic register: Sunsama at $20 per month, Superhuman at $30 per month, Motion at $34 per month, Notion at $10 per month, Reclaim at $10 per month. Vesper's breadth (Life OS covering seven domains) materially exceeds the single-slice competitors (Reclaim handles scheduling, Sunsama handles daily planning, Motion handles task scheduling). The $19.99 price positions Vesper above the basic-utility competitors and within the premium productivity register, while remaining materially below the premium professional tools.

Second, target audience income. Young professionals ages twenty-two to thirty-two in their first decade of career typically earn $60,000 to $150,000 per year. A $19.99 per month subscription equals approximately 0.16 percent to 0.4 percent of annual income. For a tool the user touches daily and that compounds time savings across an entire life domain, this price point is well within the easy-yes range.

Third, unit economics. AI cost at realistic usage is approximately $1.00 to $1.50 per active paying user per month per Layer 3, with $1.20 as the planning midpoint. Vesper qualifies for Apple's Small Business Program from day one because the developer account has not exceeded $1 million in App Store proceeds, so Apple's commission is fifteen percent on subscriptions from the first transaction. Net revenue per iOS subscriber after Apple's fifteen percent is approximately $16.99 on the $19.99 price; after $1.20 AI cost, net contribution is approximately $15.79. Stripe processing on web subscribers at 2.9 percent plus thirty cents, plus Stripe Tax Basic for Checkout at 0.5 percent (approximately $0.10 on $19.99), yields approximately $19.01 in net revenue per web subscriber; after $1.20 AI cost, net contribution is approximately $17.81. The blended margin after AI cost and processing is approximately 79 to 89 percent.

Fourth, positioning consistency. A $9.99 price would undercut the premium butler/concierge framing established in Layers 1 and 4 and signal a generic productivity utility. A $24.99 price would narrow the addressable market without delivering enough additional value perception to justify the increase at V1. The $19.99 price holds the premium positioning while preserving accessibility, and leaves room to raise to $24.99 in a future price experiment once retention data and willingness-to-pay are proven.

The price is also a round-enough number to read cleanly in marketing materials. "$19.99 per month" or "twenty dollars per month" both work in butler-voice copy ("After seven days, twenty dollars per month").

## Currency and Geographic Scope

USD only at V1. The V1 launch is United States only per Layer 1, so multi-currency pricing introduces complexity without serving the user base. International expansion to Canada, the United Kingdom, and Australia at V2 or V3 will require local currency pricing (CAD, GBP, AUD) and likely a slight regional adjustment to account for purchasing power and competitive landscape differences. Multi-currency is supported by Stripe natively and is a low-cost lift when expansion arrives.

Pricing is presented as $19.99 USD in all surfaces (landing page, pricing table, Stripe Checkout, App Store listing) at V1.

## Free Trial Mechanics

The free trial is seven calendar days starting at the moment of account creation. Trial mechanics are mostly locked in prior layers but are consolidated here for the Layer 5 record.

**Trial onset.** The user creates an account via email magic link, Google OAuth, or Apple Sign In. The `trial_started_at` field on the user row is set to the current timestamp, and `trial_ends_at` is set to seven days forward. The `subscription_status` field is set to `trial`. No payment method is collected during onboarding.

**Trial scope.** The trial includes the full V1 feature set without restriction. Every module, every integration, every AI-generated plan operates exactly as it would for a paying subscriber. The single exception is a soft cap of two plan generations per local day, applied only to trial accounts; the cap protects margin on non-converting trial users without degrading the experience of any user actively evaluating the product. Paid accounts are capped at five generations per rolling hour as a runaway-cost ceiling rather than a usage limit. Neither cap is surfaced as a usage meter; the user experiences exactly what they would experience as a paying subscriber.

**Trial reminders.** A Cloudflare Worker runs daily at 9:00 AM in the user's local timezone and checks for users whose `trial_ends_at` falls two days, one day, or zero days from the current date. The worker sends transactional emails via Resend at each of these checkpoints, with copy locked in Layer 4's copy library. In-app, the ambient butler line and a soft banner on the plan view surface the same reminders, also with locked copy.

**Day-five optional payment capture.** On trial day five, Vesper surfaces an opt-in prompt offering to save a payment method now for a frictionless conversion tomorrow. On iOS, a single Apple Pay sheet saves the card via StoreKit without charging it. On web, a Stripe Setup Intent captures the card without charging. Users who decline proceed through the standard day-six and day-seven flows unchanged. The prompt is informational and consent-based, not a default-yes pre-authorization.

**Day-six one-tap conversion prompt.** Twenty-four hours before the trial ends (day six), users who saved a payment method on day five see a one-tap conversion prompt. A single biometric confirmation converts them; users who did not save a method see an informational reminder with a CTA to the standard Checkout or StoreKit flow. Users who take no action on either prompt let the trial proceed to its natural end-date prompt the following day.

**Trial-to-paid conversion.** On the trial end date, the user is presented with two options: continue (which routes to Stripe Checkout on web, or initiates an Apple StoreKit purchase flow on iOS) or end (which transitions the account to the seven-day read-only continuation state). The choice is presented in butler voice without persuasion friction: "Your week is up." with two unstyled buttons. No retention copy, no discount offer, no countdown timer.

**Trial extension policy.** No extensions are offered by default. The trial is seven days, with no manipulation. The founder retains discretion to extend a specific user's trial manually via the admin interface in genuine cases (technical issues that prevented the user from evaluating the product, for example). This discretion is not advertised and is exercised case-by-case.

**Trial abuse prevention.** A single email address cannot start more than one trial. Account-level deduplication is enforced at signup. Repeat trial signups using different email addresses are an accepted leakage at V1 given the friction such enforcement would impose on legitimate users; if leakage becomes material post-launch, IP-level rate limiting or device fingerprinting can be added.

## Subscription Lifecycle

The subscription lifecycle is modeled as a state machine with seven states. The `subscription_status` field on the user row tracks the current state. State transitions are triggered by user actions (subscribing, canceling), payment events (charges succeeding, charges failing, dunning timing out), or scheduled jobs (trial ending, archive period ending).

**State 1: trial.** Active during the seven-day trial window. User has full access. No charges are made. `trial_ends_at` drives transitions out of this state.

**State 2: active.** The user has converted to a paid subscription. Charges are made monthly on the conversion anniversary. Full access continues. This is the steady state of a successful conversion.

**State 3: past_due.** The most recent charge failed. Stripe (or Apple) initiates its native dunning process. The user retains full access during the dunning window. A soft butler-voice banner surfaces in-app indicating the payment did not go through, with copy locked in Layer 4 ("Your payment didn't go through. I'll keep things running while you sort it out.").

**State 4: read_only.** The dunning window expired without a successful charge, or the user canceled, or the trial ended without conversion. The user retains read access to their plan and historical data but cannot generate new plans, edit existing blocks, or modify modules. This state persists for seven days. Copy in this state is continuation-framed rather than punitive ("Your data stays here for seven days, then archives for another thirty.").

**State 5: archived.** Seven days in read-only elapsed without the user resubscribing. The account is archived: no access whatsoever, but all user data remains in the database. A resubscribe option is surfaced if the user signs in (with butler-voice acknowledgment per Layer 4: "Welcome back. Everything is as you left it."). This state persists for thirty days.

**State 6: deletion_scheduled.** Either the archive period has elapsed without resubscription, or the user explicitly requested account deletion. The `deletion_requested_at` field is populated. A thirty-day grace period runs. The user can recover by signing in and clicking cancel-deletion. After thirty days, the account hard-deletes.

**State 7: deleted.** The user row and all associated data have been hard-deleted by a Cloudflare Worker that runs daily. The user's email address is retained in a hashed form for trial-abuse prevention but is otherwise scrubbed.

The state machine is enforced server-side. Mobile and web clients display state-appropriate UI based on the subscription_status field returned from the API.

## Payment Infrastructure

Two payment systems run in parallel: Apple's In-App Purchase for iOS subscribers, and Stripe for web subscribers. The user pays through whichever surface they convert on. State is reconciled centrally in the user row regardless of payment source. This is the most architecturally involved part of Layer 5 and warrants detailed specification.

### iOS Subscribers: Apple In-App Purchase

iOS subscribers convert to paid through Apple's StoreKit framework. The conversion flow is triggered when the user taps continue on the trial-end screen or on the in-app upgrade surface. StoreKit presents Apple's native payment sheet, which uses the payment method already on the user's Apple ID (typically a card, but also Apple Cash, Apple Pay-linked bank accounts, or App Store credit). The transaction completes through Apple, and the user is enrolled in an auto-renewing monthly subscription billed by Apple.

Vesper qualifies for Apple's Small Business Program from day one because the developer account has not exceeded $1 million in App Store proceeds across all associated apps in the previous calendar year. Under the Small Business Program, Apple's commission is fifteen percent on all in-app purchases including subscriptions, applied from the first transaction. The standard "thirty percent year one, then fifteen percent thereafter" structure is the non-Small-Business-Program default and is not the path Vesper operates under. Enrollment requires acknowledgment in App Store Connect and the new Paid Applications agreement; the founder enrolls during the App Store submission process. The reduced rate takes effect fifteen days after the end of the fiscal month in which Apple approves the enrollment.

Net revenue per iOS subscriber after Apple's fifteen percent commission ($3.00 on $19.99) is approximately $16.99 per month.

Apple handles billing, payment method storage, payment retries on failure, refund requests, tax calculation and remittance for the App Store transaction itself, and dunning logic. The product receives notifications via Apple's App Store Server Notifications V2 webhook, which posts to a Cloudflare Worker endpoint with subscription lifecycle events: initial purchase, renewal, billing retry, billing recovery, expiration, refund, revoke. The webhook handler updates the `subscription_status` field on the user row accordingly.

The user's payment method, billing address, and personally identifiable financial information remain with Apple. The product never sees a card number, never sees a billing address from iOS subscribers, and is not responsible for PCI compliance on the iOS side.

App Store refund requests are handled by Apple independently of the product. Users can request a refund through Apple's standard refund flow, and Apple makes the determination. The product receives a notification when a refund is granted and adjusts internal state accordingly.

### Web Subscribers: Stripe

Web subscribers convert to paid through Stripe Checkout, a hosted checkout page operated by Stripe. The conversion flow is triggered when the user taps continue on the trial-end screen on web (or initiates an upgrade from elsewhere on the web surface). The user is redirected to a Stripe-hosted checkout page, where they select their payment method, enter payment details, and confirm. On successful payment, Stripe redirects back to the product's success URL, and the product receives a webhook event confirming the subscription creation.

Stripe Customer Portal handles subscription management: payment method updates, viewing of past invoices, and cancellation. The portal is hosted by Stripe and styled to match Vesper's warm-dark design system to the extent Stripe's customization options allow (logo, accent color, and font selection). Users access the portal through a "manage subscription" link in their account settings, which generates a portal session via the Stripe API and redirects.

Stripe's processing fee is 2.9 percent plus thirty cents per transaction in the United States, approximately $0.88 on $19.99. Stripe Tax Basic for Checkout adds approximately $0.10 per transaction (0.5% on $19.99). Net revenue per web subscriber on the $19.99 price is approximately $19.01 after both fees.

### Payment Methods Enabled

On both surfaces, the product accepts every reasonable payment method available through the respective payment infrastructure. The founder direction is to leave no method off the table at V1; methods that perform poorly can be disabled later, but methods missing at launch represent revenue left on the table.

On iOS via Apple In-App Purchase, the user pays with whatever Apple supports on their Apple ID. This is not configurable by the product; the product accepts whatever Apple presents to the user. Methods include credit and debit cards, Apple Cash, Apple Pay-linked bank accounts, App Store credit (gift cards, refund balances), and carrier billing in some markets.

On web via Stripe, the following payment methods are enabled at V1:

- Credit and debit cards (Visa, Mastercard, American Express, Discover, JCB, Diners Club)
- Apple Pay
- Google Pay
- Link (Stripe's one-click checkout)
- ACH Direct Debit (US bank account, lower processing fee than cards at scale)
- PayPal
- Cash App Pay

Buy-now-pay-later methods (Klarna, Afterpay) are not enabled at V1, not because they are unwanted but because they are designed for one-time purchases rather than recurring subscriptions and do not integrate naturally with monthly billing. They are reconsidered if Stripe expands BNPL support to subscription products.

Cryptocurrency is not enabled at V1. Stripe does not directly support crypto subscriptions, and integrating Coinbase Commerce or similar introduces meaningful operational complexity for low expected volume. Crypto support is reconsidered post-launch only if user demand surfaces.

### Stripe Tax

Stripe Tax is enabled from launch. The service automatically calculates sales tax on each transaction based on the customer's billing address and the product's tax category (digital service, SaaS), and remits collected tax to the appropriate state authority. Stripe Tax Basic pricing for no-code integrations (which includes Stripe Checkout, the path Vesper uses) is 0.5 percent per transaction where tax is registered, which works out to approximately $0.10 per $19.99 monthly transaction. The alternative pricing tier ($0.50 per transaction) applies only to direct Stripe API integrations, not Checkout.

The alternative (manually tracking nexus by state and registering for sales tax in each state where revenue exceeds the nexus threshold) is significantly more operationally complex and risks underpayment penalties if a threshold is missed. The $0.10 per transaction cost of Stripe Tax is cheap insurance.

Apple handles tax calculation and remittance independently for App Store transactions. No additional tax infrastructure is needed for iOS subscribers.

### Webhook Architecture and State Reconciliation

The architecture handles two parallel webhook streams (Stripe and Apple App Store Server Notifications) writing to a single `subscription_status` field on the user row. Reconciliation is required because a user could theoretically subscribe on both surfaces, or transition between them.

The reconciliation rule is: the most recently active subscription wins. If a user has both a Stripe subscription and an Apple subscription, the one with the most recent `current_period_start` is treated as the source of truth for `subscription_status`. A flag on the user row indicates which payment source is active. The other subscription is treated as a duplicate and surfaced in the user's account settings with a "cancel this duplicate" prompt.

In practice, duplicates should be rare because the conversion flow on each surface checks the user's current subscription state before initiating a new purchase. The reconciliation logic exists primarily to handle edge cases (user converts on web, then converts on iOS while web subscription is in dunning, for example).

The Cloudflare Worker that runs nightly performs a reconciliation sweep across all user rows, ensuring `subscription_status` matches the most recent source-of-truth event from either payment provider. Discrepancies are logged to Sentry for manual review.

### Apple StoreKit Implementation Notes

The iOS application uses StoreKit 2 (the modern Swift-based API) rather than the legacy StoreKit 1. StoreKit 2 is available on iOS 15 and later, which is the minimum target for the V1 launch given Dynamic Island requires iOS 16.1+ on iPhone 14 Pro and iOS 17.2+ for Push Starts.

Subscription products are configured in App Store Connect with a single product identifier (`com.vesper.standard.monthly`). The mobile application fetches the product details from StoreKit at runtime and presents them in the upgrade flow. The price is set in App Store Connect ($19.99 USD) and is not hardcoded in the application code; this allows the founder to adjust pricing in the App Store Connect interface without an app update.

App Store Server-to-Server Notifications V2 is the webhook mechanism. The notification URL is configured in App Store Connect and points to a Cloudflare Worker endpoint that handles incoming events. The worker verifies the notification's signed JWS payload using Apple's public keys, parses the event type, and updates the user row accordingly.

## Dunning

Dunning is the process of attempting to recover failed payments before terminating the subscription. The dunning policies on each payment surface differ slightly because each provider handles it differently, but the user-facing experience is consistent.

**Stripe dunning.** When a charge fails, Stripe's Smart Retries logic attempts the charge multiple times over the following days, with timing optimized by Stripe's machine learning. By default, Stripe retries up to four times over a roughly week-long window. During this window, the `subscription_status` field is set to `past_due` and the user sees the soft butler-voice banner in-app. If all retries fail, Stripe sends a `customer.subscription.deleted` webhook event, which transitions the subscription to `read_only`.

The Stripe dunning email policy is set to send a single email at the first failed charge and one more before the final retry. This is more restrained than Stripe's default of multiple emails through the cycle; the restraint matches the anti-overwhelm posture.

**Apple dunning.** Apple manages dunning autonomously through its own retry and billing recovery system, which spans approximately sixty days for some retry patterns. During Apple's billing recovery period, the `subscription_status` is set to `past_due`. If Apple ultimately fails to recover the charge, the subscription expires and Apple sends an expiration event, which transitions the subscription to `read_only`.

Apple sends its own emails to the user during billing recovery (these are sent from Apple, not from Vesper). The product does not duplicate these emails.

**Read-only entry.** When dunning fails completely (Stripe or Apple), the subscription transitions to the read-only state described in the lifecycle section. The user retains read access to their plan and history for seven days, with continuation-framed copy. After seven days, the account archives for thirty days. The user can resubscribe at any point during read-only or archive to restore full access.

## Refund Policy

The stated refund policy is straightforward: no refunds. The one-week free trial is the try-before-you-buy period. After the trial converts to paid, charges are not refundable.

This policy is documented in the terms of service and on the pricing page in plain language: "After your one-week free trial, monthly subscriptions are non-refundable. Cancel anytime to stop future charges."

Two practical exceptions modify this nominal policy.

**Apple-managed refunds.** iOS subscribers can request a refund through Apple's standard refund flow, which is independent of the product's stated policy. Apple makes the refund determination based on its own criteria, and grants or denies the refund without consulting the product. When a refund is granted, the product receives a `REFUND` notification and adjusts the user's subscription state accordingly. Apple's refund flow is intentionally surfaced by Apple, and the product does not actively encourage or discourage its use.

**Founder discretion.** For web subscribers via Stripe, the founder retains discretion to issue refunds case-by-case in genuine hardship situations (technical issues that prevented use, accidental charges, etc.). This discretion is exercised manually through the Stripe dashboard and is not advertised or surfaced in user-facing copy. Refunds in these cases happen as one-off acts of customer service, not as policy.

The no-refund stated policy is aligned with the trial-based model. The trial gives users one week of full access at zero cost. The implicit contract is that the user has made an informed decision at the conversion moment. Refunding charges after that would create perverse incentives for abuse and erode the trial-as-evaluation-period framing.

## Cancellation

The cancellation flow is locked in Layer 2 and Layer 4 and is summarized here for completeness.

**Frictionless exit.** Cancellation is one tap on iOS (through Apple's subscription management interface accessible from Settings or the App Store) and one tap on web (through the Stripe Customer Portal). No retention modal appears. No discount offer is presented. No survey is required at the cancellation moment.

**Butler-voice acknowledgment.** Upon cancellation confirmation, the user sees the butler-voice acknowledgment copy locked in Layer 4 ("Of course. Your data will be here for thirty days if you'd like to come back.").

**State transition.** The subscription transitions to `read_only` immediately upon cancellation confirmation. The seven-day read-only window followed by thirty-day archive applies, identical to the post-dunning lifecycle path.

**Win-back survey.** Forty-eight hours after cancellation, a transactional email arrives asking the user a single no-oriented question ("Was there anything we could have done differently?"). The email is intentionally light: no required fields, no surveys with multiple pages, no incentive offered to fill it out. Responses are aggregated for retrospective analysis. No automated response is sent; if the user replies and the founder wants to follow up, the founder does so manually.

**Referral pending-count display posture.** The referral panel in account settings surfaces only credits in the `applied` state — credits that have produced a real discount on the user's invoice. Credits in the `pending` state (issued but not yet applied to a billing cycle) are intentionally not displayed to the referrer. The Layer 4 anti-gamification posture rejects pending-credit displays because they create a disappointment surface: a pending credit that voids (because the referrer churns before consuming it, or because the referee refunds) becomes a visible loss the user noticed and was tracking. Showing only applied credits avoids that surface entirely and keeps the panel honest about value already delivered rather than value provisionally earned.

The philosophy is that an adversarial cancellation flow generates short-term retention bumps at the cost of long-term goodwill. A user who cancels cleanly and feels respected is more likely to resubscribe later (or recommend the product despite their own exit) than a user who fought through a retention gauntlet. This aligns with Layer 1's anti-overwhelm posture and the Cialdini ethical test that frames all persuasion principles in the butler voice (would a fully informed user feel satisfied with their decision twenty-four hours later?).

## Win-Back

The forty-eight-hour win-back email is the only proactive win-back attempt at V1. No additional win-back emails are sent at thirty days, sixty days, or any other interval. The user's data archives, then deletes per the lifecycle schedule, and the relationship ends absent the user's choice to resubscribe.

This is deliberately restrained. Many SaaS products send multi-touch win-back campaigns (thirty-day reactivation discount, sixty-day "we miss you" email, ninety-day "last chance" message). Each touch chips away at goodwill and reads as desperate. The single forty-eight-hour survey is enough to gather retrospective signal without harassing former users.

Reactivation discounts (e.g., "come back and get 50 percent off your first month") are not offered at V1. They contradict the no-discount posture established for new subscribers and create perverse incentives for current subscribers to cancel and resubscribe to capture the discount.

Per Layer 6, the single 48-hour win-back survey email is the only proactive win-back attempt at V1 and V2. Additional reactivation campaigns are not added regardless of observed organic resubscription rates. The single-survey posture holds through V2.

## Unit Economics

The unit economics ground every pricing decision in real numbers. The analysis below assumes the V1 launch period (months one through six post-launch) and breaks out revenue by payment source.

**Per-subscriber monthly economics, iOS via Apple IAP with Small Business Program enrollment:**

- Gross revenue: $19.99
- Apple commission (15%): $3.00
- Net revenue: $16.99
- AI cost (realistic V1, ~$1.20): $1.20
- Net contribution per iOS subscriber: $15.79

**Per-subscriber monthly economics, web via Stripe:**

- Gross revenue: $19.99
- Stripe processing (2.9% + $0.30): $0.88
- Stripe Tax fee (~$0.10): $0.10
- Net revenue: $19.01
- AI cost (realistic V1, ~$1.20): $1.20
- Net contribution per web subscriber: $17.81

The blended net contribution per paying subscriber, assuming roughly even split between iOS and web conversion (which is unknown until launch data is available), is approximately $16.80 per month. The AI cost figure of $1.20 reflects realistic V1 measurement at typical engagement (15 to 20 active days per month, blended cold/warm cache). An aspirational reduction to approximately $1.00 per month is plausible once prewarm cache coverage stabilizes and output token discipline holds across diverse user prompts. The lower aspirational figures appearing in earlier drafts were derived from understated output token assumptions and an engagement model inconsistent with an engaged daily-use product.

**Trial cost per non-converter.** Trial users are cold-cache by default because the sleep-alarm prewarming pathway requires module configuration that does not happen in week one. Realistic daily cost during trial is approximately $0.074 (cold-cache Sonnet plan generation at $0.060 plus approximately $0.014 in Haiku edits and check-in operations). A fully engaged seven-day non-converter costs approximately $0.52; a partially engaged non-converter active on four or five of the seven days costs approximately $0.30 to $0.37. The planning midpoint per non-converter is approximately $0.45. There is no payment processing cost during trial since no charge is made. The seven-day trial halves the cumulative non-converter burden that a fourteen-day trial would produce. At $16.80 blended net contribution, one paying subscriber covers the trial cost of approximately 37 non-converters at the planning midpoint.

**Cost model recalibration.** The realistic planning figure is $1.20 per active paying user per month, with $1.00 to $1.50 as the operating range depending on engagement intensity and cache hit rate. Aspirational reduction to approximately $1.00 per month is plausible once prewarm coverage stabilizes; further reduction below $1.00 would require either substantially lower output token counts (which conflicts with plan utility) or substantially higher cache hit rates (which conflicts with the structure of a once-per-day plan generation pattern). Earlier $0.30 and $0.35 to $0.50 figures relied on understated output tokens and an engagement model inconsistent with engaged daily-use behavior.

**Blended customer acquisition cost on a six percent trial-to-paid conversion rate.** At six percent conversion (the planning midpoint for an indie B2C consumer subscription app with an opt-in no-card-required trial; five percent baseline plus an estimated one to two percentage points from the day-six soft prompt), every paying customer is paired with approximately 15.7 non-converting trials. Sunk trial AI cost across those non-converters at approximately $0.45 each is approximately $7.07 in trial AI spend per paying customer acquired through organic top-of-funnel. This is in addition to whatever paid acquisition cost is incurred for the funnel itself; at V1 paid acquisition is held in reserve and not actively spent. The implied CAC purely from trial overhead is approximately $7 per paying customer. The fifteen to twenty-five percent conversion rates appearing in earlier drafts were sourced from B2B SaaS benchmarks (First Page Sage, OpenView) that do not apply to consumer indie products; the applicable benchmark is ChartMogul 2026's 8.9 percent average for opt-in trials across 200 SaaS products, with the indie B2C subset below that average.

**Payback period.** At $16.80 blended net contribution per paying subscriber per month and approximately $7 acquisition overhead from trial AI cost, the payback period from trial-cost recovery is within the first billing cycle. The subscriber is net positive on operational margin from month one. AI run-rate during the active subscription ($1.20 per month) is the dominant ongoing cost, not recovered trial overhead.

**Lifetime value at retention assumptions.** Modeling LTV requires assumptions about churn. If monthly churn is five percent, average lifetime is twenty months, yielding LTV of approximately $336 per subscriber ($16.80 × 20). If monthly churn is ten percent (a more conservative assumption for a new product), average lifetime is ten months, yielding LTV of approximately $168. Both substantially exceed the approximately $7 trial-cost CAC, confirming the model is economically sound at the realistic six percent conversion assumption.

**Sensitivity to conversion rate.** At a pessimistic three percent conversion (soft prompt producing essentially no uplift over a weak organic baseline), trial AI cost per paying customer rises to approximately $14.55 (97 non-converters at $0.45 each divided by 3 conversions). Payback period from trial recovery remains under one billing cycle. At an optimistic ten percent conversion (closer to the ChartMogul opt-in average), trial AI cost per paying customer drops to approximately $4.05 (90 non-converters at $0.45 each divided by 10 conversions). Payback period is same-cycle. The unit economics are robust across the realistic three to ten percent range for an indie B2C consumer app. The price point is defensible across this range.

## Legal Foundation

The legal foundation comprises four documents and one compliance posture. All four documents are required for launch and are described in their final form here. Drafting and review happen during the pre-launch phase (Phase 7 in the Project Overview).

### Privacy Policy

The privacy policy is generated using Termly's privacy policy template, customized for Vesper's specific data practices, and reviewed by counsel before launch. The policy is published on the marketing site at `/privacy` and linked from every signup surface, the App Store listing, and the in-app account settings.

The policy discloses, at minimum, the following:

- Identity and contact information of the operator (the LLC name and a contact email)
- Categories of personal data collected (email, name if provided, archetype selection, location with permission, calendar events synced via integration, fitness data when fitness module is enabled, dietary preferences from nutrition module, medication entries, financial entries from finance module)
- Purposes for which data is processed (delivering the product's core function, AI-driven personalization, billing, communications, analytics)
- Categories of third parties data is shared with (Supabase for hosting, Anthropic for AI processing, Stripe and Apple for payments, Resend for transactional email, PostHog for analytics, Sentry for error tracking)
- The explicit statement that Anthropic does not use API data for model training
- The explicit statement that medication, finance, and other sensitive module data is not shared with third parties beyond what is required for the product's core function
- User rights under CCPA (right to know, right to delete, right to opt out of sale, right to non-discrimination)
- Data retention policy (active accounts retained while subscription is active; deleted accounts hard-deleted after thirty-day grace; anonymized analytics retained indefinitely)
- Children's privacy disclosure (the product is not directed at users under thirteen, and accounts believed to belong to users under thirteen are terminated)
- Process for exercising user rights (contact email; in-application self-service deletion flow)
- Process for international data transfers (data stored in US-based servers; no international transfer except where required for incidental third-party processing)
- Date of last update

The policy is reviewed annually or whenever data practices change materially.

### Terms of Service

The terms of service are similarly generated using Termly, customized for Vesper, and reviewed by counsel. The terms are published at `/terms` and linked from every signup surface.

The terms include, at minimum:

- Acceptance of terms (using the product constitutes acceptance)
- Description of the service (Life OS planning application)
- Account responsibilities (accurate information, account security, single user per account)
- Subscription terms (seven-day free trial, $19.99 per month after trial, monthly auto-renewal, cancellation policy, refund policy)
- User content and data (the user owns their data; Vesper has a limited license to process it for the purpose of delivering the service)
- Prohibited uses (illegal activity, automated abuse, reverse engineering, distribution of the application, attempts to bypass authentication or access other users' data)
- Disclaimer of warranties (service provided as-is)
- Limitation of liability (cap at amount paid by the user in the trailing twelve months, with carve-outs for jurisdictions where this is not enforceable)
- Indemnification
- Dispute resolution (binding arbitration on an individual basis, no class actions, with a small-claims-court carveout; venue specified per the LLC's home state)
- Modification of terms (changes are communicated via email and via banner in the application; continued use after the effective date constitutes acceptance)
- Termination (Vesper may terminate accounts for terms violations; user may terminate by canceling subscription)
- Governing law (per the LLC's home state)
- Effective date and contact information

### Data Deletion Policy

The data deletion policy is published as a standalone document at `/data-deletion` and is linked from the privacy policy. It documents the lifecycle from deletion request to hard delete in user-readable language.

When a user requests deletion through the in-application account settings flow:

1. The deletion request is recorded with the timestamp.
2. The account enters the `deletion_scheduled` state immediately. Read access is preserved during the grace period.
3. A confirmation email is sent indicating the thirty-day grace period and providing a one-click cancellation link.
4. The user can cancel the deletion at any point during the thirty-day grace by signing in and clicking the in-application cancellation button.
5. After thirty days without cancellation, a Cloudflare Worker hard-deletes the user row and cascades to all related tables: profiles, plans, blocks, tasks, integrations (with token revocation where possible), push tokens, medications, completion logs, recurring errands, and bills.
6. After hard delete, only an anonymized hashed reference of the user's email is retained for trial-abuse prevention. All other personally identifiable data is purged.

Aggregate analytics events (PostHog) are anonymized by stripping the user ID at the time of deletion. Aggregate event data continues to inform product analytics but cannot be re-associated with the deleted user.

Stripe and Apple subscription records are not deleted by the product directly because they live in those providers' systems. The product cancels any active subscription with the provider on deletion request, and the provider retains transaction records per its own data retention policies (typically seven years for financial records, per US tax law).

### CCPA Compliance Statement

A standalone CCPA notice is published at `/ccpa` and linked from the privacy policy footer. The notice describes California residents' specific rights and the process for exercising them.

CCPA-specific rights:

- Right to know what categories of personal information have been collected
- Right to know the specific pieces of personal information collected
- Right to delete personal information (exercised via the in-application deletion flow)
- Right to opt out of the sale of personal information (the product does not sell personal information, so this right is automatically satisfied; the notice states this explicitly)
- Right to non-discrimination for exercising CCPA rights

Process for exercising rights: contact email or in-application self-service. Identity verification for sensitive requests (data export, deletion of an existing account by someone other than the account holder) is handled through email verification.

A "Do Not Sell My Personal Information" link is included in the website footer per CCPA requirement, even though no personal information is sold. The link directs to the CCPA notice explaining that no sale occurs.

### App Privacy Disclosure (Apple App Store)

The App Store requires accurate App Privacy "nutrition labels" disclosing data collection by the application. The disclosures are configured in App Store Connect during submission and are visible on the App Store listing.

The disclosed categories of data collection are:

- Contact info: email address (linked to identity, used for product functionality and communications)
- Identifiers: user ID (linked to identity, used for product functionality)
- Health and fitness: workout records and fitness data (linked to identity, used for product functionality; collected only when fitness module is enabled)
- Sensitive info: dietary information and medical information (linked to identity, used for product functionality; collected only when respective modules are enabled)
- Location: precise location (linked to identity, used for product functionality with user permission)
- Diagnostics: crash data and performance data (not linked to identity, used for app functionality)
- Usage data: product interaction (linked to identity, used for analytics)

The disclosures are kept current as the application evolves. Each new data collection category triggers an App Store Connect update before the new version ships.

### Termly Configuration

Termly is configured at the Pro tier (~$20 to $30 per month) which includes the privacy policy generator, terms of service generator, cookie banner, and CCPA toolkit. The Pro tier also includes automatic updates as relevant laws change, which is the primary value over a static template.

Termly setup is deferred to the pre-launch phase. There is no need to have legal documents drafted during the build phase, and starting Termly's subscription during build would burn $200 to $300 of unnecessary subscription cost. Termly activates approximately four weeks before public launch, allowing time for document generation, customization, and counsel review.

### Counsel Review

Counsel review of the generated legal documents is recommended before public launch. A standard SaaS legal review by a small business attorney runs $500 to $1,500 for review and minor customization of templated documents. The review confirms that the generated documents are appropriately adapted to Vesper's specific data practices, that the LLC structure is correctly reflected, and that any jurisdiction-specific quirks are addressed.

The counsel review happens after Termly's documents are generated and customized, and before public launch.

## Business Entity

The founder is a California resident. The default anonymous-indie LLC playbook (Wyoming or New Mexico LLC) interacts with California tax law in ways that make LLC formation expensive: California's $800 minimum franchise tax applies to any LLC with a California-resident member, regardless of where the LLC is formed. For a pre-revenue indie launch, this overhead is meaningful.

The founder's stated anonymity preference is media-focused: no founder face, no founder name pushed in marketing. It does not extend to App Store regulatory disclosures or other surfaces that most users never read. This significantly relaxes the entity-structure constraint.

**Recommended path: sole proprietorship with DBA, LLC at revenue threshold.**

The founder operates as a sole proprietor through V1 launch and the first months of revenue. No entity formation, no franchise tax, no annual filings. The DBA (Doing Business As) filing registers "Vesper" as a fictitious business name in the founder's California county, which costs approximately $40 to $50 plus a newspaper publication requirement of approximately $50 to $100 (a one-time California requirement). The DBA allows operating under the Vesper brand on Stripe receipts, contracts, and business communications without forming an entity.

The founder obtains an EIN from the IRS (free, online, approximately ten minutes) which separates business income reporting from personal Social Security Number on Stripe and tax filings. The EIN is not required for sole proprietorships in California but is recommended for any sole prop generating meaningful revenue.

Business liability insurance from a small-business carrier (Hiscox, Next, Thimble, or comparable) provides liability coverage in the $1M to $2M range for approximately $300 to $600 per year for a solo SaaS operator. This is the substitute for the LLC liability shield. For a product that handles sensitive user data (health, medication, location, finance entries), liability insurance is recommended regardless of entity structure.

**LLC formation trigger.** The founder forms an LLC if and when revenue or liability exposure justifies the overhead ($800 annual California minimum franchise tax with no first-year waiver since AB85 expired January 2024, plus formation costs and registered agent fees). No specific ARR or timeline is committed; the trigger is the founder's own assessment of liability exposure against ongoing costs. At formation, the structure can be a California LLC (simpler, member name disclosed in CA records) or a foreign LLC (e.g., New Mexico) registered to do business in California (preserves more anonymity in public records, but the $800 California franchise tax still applies because the founder is a California resident).

**Annual ongoing costs at V1 launch (sole prop path).** Approximately $400 to $700 per year: DBA renewal where applicable, business insurance, and the Apple Developer Program. No franchise tax. This is materially cheaper than the LLC path and appropriate for the pre-revenue and early-revenue stages.

**Apple Developer Program enrollment.** The founder enrolls as an individual rather than as an organization. Individual enrollment costs $99 per year, requires no D-U-N-S number, and processes faster than organizational enrollment. The App Store listing displays the founder's legal name as the developer in the small-print disclosure surface that Apple requires; the prominent surface displays the Vesper brand name and the app's marketing materials. This satisfies the founder's media-anonymity preference (the brand carries the marketing surface; the legal name appears only in the regulatory disclosure surface). When the LLC forms at the revenue trigger, the developer account can be transferred to organizational enrollment at that time.

**Stripe setup.** Stripe is configured under the sole proprietorship with "Vesper" as the public-facing merchant display name (set via the DBA). Stripe requires KYC verification including the founder's legal name, address, and tax ID (SSN for sole prop, or EIN once obtained); this information is internal to Stripe's compliance systems and not publicly disclosed. Customer credit card statements show "Vesper" rather than the founder's personal name.

**Critical caveat.** This document provides direction based on general knowledge of California small business tax and entity law as of the project's brainstorming phase. It does not constitute legal or tax advice. The founder should consult a CPA at the LLC-formation trigger to confirm the optimal structure and tax election at that point. A one-time CPA consultation at the formation trigger runs approximately $200 to $400. At V1 launch (sole prop phase), no consultation is strictly required, though the founder may elect to confirm the sole prop setup with a CPA if comfort warrants the $200 cost.

## Pricing Experiments

Pricing experiments are deferred to V3 per founder direction. No experimentation infrastructure (PostHog feature flags, A/B test allocation, holdout cohorts) is activated at V1 or V2. The documented experiments below remain on file for future consideration but are not run before V3. The rationale is twofold: statistical significance on consumer SaaS experiments requires meaningful user volume that an indie launch will not have for some time, and the founder has elected to focus on building a loyal paying base before introducing experimentation overhead.
The experimental program described below is documented for future activation when post-launch volume is sufficient for meaningful signal. No specific signup count or timeline triggers activation; the trigger is the founder's assessment that data volume supports statistical signal.

**Experiment 1: Trial length.** Test seven-day (V1 baseline), ten-day, and fourteen-day trial windows. Hypothesis: seven days is sufficient given the day-six soft prompt and prompt-context-driven plan quality on day one, but ten or fourteen days may produce meaningfully higher conversion if observed trial-to-paid conversion falls materially below the realistic 5 to 8 percent range for indie B2C opt-in trials. Measure conversion rate, time-to-conversion, trial AI spend per non-converter, and the trial-cost-per-paying-customer composite.

**Experiment 2: Price point.** Test $14.99, $19.99, and $24.99 monthly prices for new signups. Hypothesis: $19.99 is in the sweet spot; $14.99 underprices premium positioning; $24.99 narrows TAM. Measure conversion rate, churn rate at thirty days, and net contribution per cohort.

**Experiment 3: No-card-required versus card-required-upfront.** Test the current no-card-required flow against a card-required-upfront flow. Hypothesis: no-card-required wins on signup conversion but loses on trial-to-paid conversion; net new paying users is approximately equivalent. Measure signup conversion, trial-to-paid conversion, and total paying users per traffic dollar.

**Experiment 4: Annual billing prominence.** When annual billing is introduced at V2, test whether the upgrade flow defaults to monthly with annual as an upsell, versus defaults to annual with monthly as a fallback. Hypothesis: defaulting to annual increases blended ARPU at the cost of slightly lower initial conversion.

All experiments run sequentially rather than concurrently to avoid statistical interference. Each experiment runs until reaching ninety-five percent confidence on the primary metric or for at least four weeks, whichever comes first.

The experimental infrastructure uses PostHog's feature flag and experimentation tools, which are included in the PostHog free tier.

## Cross-Layer Updates Required

The cross-layer changes specified during Layer 5 drafting have been applied to the relevant source documents. Specifically: Layer 4's onboarding screen 17 and landing page section 5 price placeholders were resolved to $19.99; Layer 4's copy library received the additional payment-related empty-state and error-state entries; Layer 3's Payments section received the Apple In-App Purchase paragraph; Layer 3's users table received the tier and payment_source fields; Layer 3's Privacy and Compliance section received the Termly Pro tier statement; and Layer 2's User Flows edge case received the $19.99 pricing sentence. Layer 1's "Founder reveal threshold" open item remains open. No further cross-layer updates are pending. This section is retained as an audit trail and contains no action items.

## What Was Considered and Rejected

The following alternatives were actively considered during Layer 5 and rejected, recorded so they are not revisited.

**Freemium model with a permanent free tier.** Rejected for cost reasons (every active user incurs AI cost; free tier burns margin in perpetuity) and positioning reasons (free tiers signal commodity utility, not premium concierge). The trial captures the same try-before-you-buy benefit without ongoing margin drain.

**Thirty-day trial.** Rejected. Trial AI cost compounds badly at thirty days; per-non-converter cost would approach $1.20 to $1.60 versus the $0.45 planning midpoint the seven-day trial sinks. The longer surface for base-profile personalization is real but the marginal conversion lift is modest in productivity SaaS, and the cumulative funnel cost across non-converters does not justify the extension. The seven-day trial captured in the Pricing Model section above is the chosen length.

**Card-required-upfront trial.** Rejected per Layer 4. Auto-charge on day fifteen is a common pattern that converts well but reads as dishonest given the marketing language ("free trial" while requiring payment information upfront). The no-card friction reduction at signup is consistent with the warm, anti-overwhelm brand posture.

**Annual billing at V1.** Rejected. Discount-based annual pricing signals struggling-startup; non-discounted annual pricing rarely converts well. The complexity of mid-year cancellations, pro-rated refunds, and renewal timing is not worth carrying in the V1 codebase. Deferred to V2 or V3.

**Two-tier launch (Standard plus Optimizer at V1).** Rejected. Optimizer's differentiating features (dashboards, correlation insights, deeper AI customization) do not ship at V1. Launching with one tier eliminates pricing-page complexity and removes engineering work that is not yet needed. Optimizer slots in cleanly at V1.5.

**$9.99 price point.** Rejected. Undercuts premium positioning. Margin after Apple commission and AI cost is thin. Signals commodity utility rather than concierge.

**$24.99 price point.** Rejected as the V1 starting price. Narrows TAM at launch when the goal is signup volume to feed the funnel. Reconsidered as a price experiment post-launch once retention data justifies a price raise.

**Cryptocurrency payment support.** Rejected. Stripe does not directly support crypto subscriptions. Coinbase Commerce or similar integrations add operational complexity. Demand at V1 is essentially zero. Reconsidered post-launch only if user demand surfaces.

**Buy-now-pay-later (Klarna, Afterpay) for monthly subscriptions.** Rejected. BNPL is designed for one-time purchases with installment plans, not for recurring monthly subscriptions. Reconsidered only if Stripe's BNPL support evolves to handle subscriptions natively.

**Manual sales tax tracking by state.** Rejected. Stripe Tax at $0.60 per transaction is cheap insurance against the operational burden of state-by-state nexus tracking and remittance. Apple handles tax on the iOS side independently.

**Aggressive retention modal at cancellation.** Rejected per Layer 2 and Layer 4. The frictionless cancellation flow is locked.

**Multi-touch win-back campaign (thirty-day reactivation, sixty-day "we miss you," etc.).** Rejected. The forty-eight-hour single-survey approach is restrained, gathers retrospective signal, and avoids reading as desperate or harassing.

**Reactivation discount offers for former subscribers.** Rejected at V1. Creates perverse incentives for current subscribers to cancel and resubscribe to capture the discount. Reviewed only if organic reactivation rates are surprisingly high and a discount could meaningfully convert additional former users.

**LLC formation at V1 launch.** Rejected. California's $800 minimum franchise tax applies to any LLC with a California-resident member, regardless of state of formation. For a pre-revenue indie launch, this overhead is not justified given the founder's stated anonymity preference is media-focused rather than regulatory. Sole proprietorship with DBA and business liability insurance is the appropriate V1 structure. LLC formation is deferred to a meaningful revenue threshold.

**Wyoming or New Mexico LLC operated without California foreign registration.** Rejected. Non-compliant given the founder's California residency. The Franchise Tax Board has authority to pursue back taxes and penalties. The risk is asymmetric: modest annual savings versus material penalty exposure.

**Apple Developer enrollment as an organization at V1.** Rejected. Requires LLC formation, which is itself rejected at V1. Individual enrollment shows the founder's legal name on the App Store regulatory disclosure surface, which is acceptable under the founder's media-anonymity-only preference. Transferred to organizational enrollment when LLC forms at the revenue threshold.

**Apple Developer enrollment as an individual.** Rejected. Discloses the founder's legal name on the App Store listing, compromising anonymity. Organizational enrollment with the LLC name preserves the brand-only public surface.

**Refund window of seven days after first charge.** Rejected. The seven-day trial is the evaluation period. A post-charge refund window would create gaming opportunities (user uses the product for the seven-day trial free, pays, uses for another week, refunds, repeats with a new account). The no-refund stated policy is cleaner.

**Generous pro-rated refunds on annual cancellations.** Not applicable at V1 since annual billing is not offered. Reviewed when annual is introduced.

**A standalone "education" or "student" discount tier.** Rejected at V1. Holds the single-price posture clean. Reviewed at V2 if student adoption is high enough to justify a discount tier without diluting premium positioning.

**Family plan or household subscription bundling multiple users for a discount.** Rejected per Layer 2 (family/team killed) and reconfirmed here.

## What's Next

**Layer 6: Launch and Growth.** This layer locks the pre-launch waitlist landing page strategy (what the page says, what it captures, how it converts); the launch channel mix designed and prioritized (Product Hunt strategy and ideal launch day, Reddit subreddits with seeding plan, X and TikTok content cadence and themes with a weekly time budget capped at three to five hours and batched into dedicated content days); the content and marketing angles that thread the needle of subtle AI positioning; the founder content calendar with evergreen content versus reactive content; and the analytics infrastructure (PostHog and Vercel Analytics) tracking trial-to-paid conversion rate and monthly paid churn as the operative measures. Specific signup or paying-subscriber count targets and tied diagnostic triggers are not used because they are not within direct founder control and do not drive business decisions.

Per Layer 1, this layer is tactical and reversible throughout, appropriate for Sonnet rather than Opus. Begin the next chat by pasting the Brainstorm Master document, the Layer 1, Layer 2, Layer 3, Layer 4, and this Layer 5 document for full context.
