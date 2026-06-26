# Vesper Design Strategy

**Status:** Locked propagation document. Code-free.
**Authored at:** Phase 4, Chat 106 (Design Cluster, EO 1, design track).
**Purpose:** Carry the already-locked Layer 4 / 5 / 6 and PRD decisions into a single surface-by-surface design plan that every later design-build chat (107 onward, and every `-V` half) composes against.

This document introduces **no new product, pricing, persuasion, or retention decision.** Every claim below traces to a decision already locked in `LAYER_4_EXPERIENCE_IDENTITY.md`, `LAYER_5_BUSINESS_MONETIZATION.md`, `LAYER_6_LAUNCH_GROWTH.md`, or `PRD.md`. Where a surface is mapped to a persuasion principle, the principle is cited by the exact name it carries in Layer 4's "Persuasion Principles Quietly Applied" section, and the mapping is held to the one ethical bar Layer 4 sets:

> The ethical limit: would a fully informed user feel satisfied with their decision 24 hours later? If yes, the principle is influence. If no, manipulation.
> — `LAYER_4_EXPERIENCE_IDENTITY.md`

If a surface cannot clear that bar, its design changes, not the bar.

---

## 1. Surface-by-Surface Map

Design effort lands on three property groups: the **application** (`apps/web`, `apps/mobile`), the **marketing / waitlist site** (the custom Next.js landing on the Vesper TLD), and a small set of **native Swift surfaces** that the build track owns from a design-track visual spec (see Section 5).

The "Shell today" column records what exists in the repo right now (recon of `apps/web/app/` and `apps/mobile/app/`). Surfaces with backend routes but no front-end shell are flagged **not-yet-scaffolded**; the map still covers them because the design-build chats need the strategy before the shell exists.

### 1.1 Application — web (`apps/web/app/`)

| Surface | Shell today | Design weight | Notes |
|---|---|---|---|
| Marketing landing `(marketing)/page.tsx` | Bare stub (`<h1>Vesper</h1>`) | High | Becomes the waitlist landing (Section 4.1). Backend `api/v1/waitlist` exists; UI **not-yet-scaffolded**. |
| Sign-in `(auth)/sign-in` | Built | Low | No-card onboarding entry. Butler-voice copy only. |
| Day / Week plan `(app)/week` | Built | High | Core daily loop surface; Vesper-hour and morning-brief voice land here in later chats. |
| Calendar `(app)/calendar` | Built (`CalendarView`, `EventFormDialog`) | Medium | Block-detail and conflict surfaces. |
| Settings `(app)/settings` (+ `integrations`) | Built | Medium | Hosts the **referral settings panel** (Section 4.3) and the "manage subscription" link to the Stripe portal. Referral panel UI **not-yet-scaffolded**. |
| Trial-end decision screen | None | High | Backend `api/v1/subscription` exists; the two-option screen UI is **not-yet-scaffolded** (Section 4.2). |
| Cancellation acknowledgment | None | Low | Cancellation itself runs through the Stripe Customer Portal; only the butler acknowledgment surface is ours. **Not-yet-scaffolded** (Section 4.4). |

### 1.2 Application — mobile (`apps/mobile/app/`)

| Surface | Shell today | Design weight | Notes |
|---|---|---|---|
| Sign-in `(auth)/sign-in` | Built | Low | Mirrors web onboarding entry. |
| Plan `(tabs)/plan` | Built | High | Mobile daily loop; primary surface. |
| Tasks `(tabs)/tasks` | Built | Medium | |
| Calendar `(tabs)/calendar` | Built | Medium | |
| Settings `(tabs)/settings` (`index`, `integrations`, `privacy`) | Built | Medium | Hosts the referral panel and the link into Apple's subscription management for cancellation. |
| Trial-end decision screen (iOS) | None | High | Routes to StoreKit on continue. UI **not-yet-scaffolded**. |

Mobile talks only through `/api/v1/` routes (per `CLAUDE.md` architecture rules); the design map does not add any mobile-only data path.

### 1.3 Marketing / waitlist site

| Surface | Shell today | Design weight | Notes |
|---|---|---|---|
| Waitlist landing (5 locked sections) | Stub only | High | Custom-built; section set locked in Layer 4 / Layer 6 (Section 4.1). |
| Referral landing `/r/[code]` | None | High | Dedicated path-based referee-facing brand surface (link format `vesper.studio/r/[code]`). Built by chat **095-V**, a design-track window chat (Window Y, Fwin F15). Carries a personalized greeting plus an invalid-code soft-redirect page (HTTP 200, ~2s auto-redirect so a mistyped code does not dead-end). UI **not-yet-scaffolded** (Section 4.3). |

### 1.4 Native Swift surfaces (build-track-owned, design-track-specified)

| Surface | Source chat | Owner | Design-track deliverable |
|---|---|---|---|
| iOS alarm screen | 059b | Build track (native Swift, SwiftUI) | Visual spec authored in chat 107 |
| Live Activity widget target + app group | 077 | Build track (native Swift) | Token values via 107 |
| Live Activity widget UI (3 variants) | 078 | Build track (native Swift) | `DesignTokens.swift` + written visual spec from 107 |

See Section 5 for the ownership rule and its source.

---

## 2. Honest-Conversion Thesis (per revenue / retention surface)

Each of the four conversion / retention surfaces is mapped to **one primary Layer 4 persuasion principle**, cited by its exact Layer 4 name, plus an explicit statement of how the application clears the 24-hour-satisfaction bar. The locked behavior each thesis propagates is named so the strategy can be checked against its source, not re-derived.

### 2.1 Waitlist landing

- **Locked behavior (Layer 6 Waitlist Strategy):** Custom-built Next.js landing on the Vesper TLD. Exactly five sections — Hero (the interactive sixty-second sample-day demo), What Vesper does, Modules, How it works, Pricing and signup. The fifth section holds **the only form on the page**: one email input, one iOS/Android segmented control, one "Begin" button. No additional capture fields. No third-party waitlist widget. No "limited spots," no countdown.
- **Applied Layer 4 principle: Tactical empathy** — "acknowledge the user's situation before any request." The page leads with the sample-day demo: the visitor watches a real plan compose for their own wake time and archetype *before* a single field is asked of them. The product acknowledges the visitor's day before requesting their email.
- **Clears the 24-hour bar:** A visitor who signs up has already seen the product behave honestly and asked for nothing they cannot verify. There is no manufactured scarcity to regret and no hidden cost (the trial is genuinely no-card, seven days). A fully informed signer-up is satisfied a day later because nothing was concealed or inflated. Influence, not manipulation.

### 2.2 Trial-end screen (the trial-end ledger)

- **Locked behavior (Layer 5 Trial-to-Paid; Layer 4 Copy Library):** On the trial end date the user sees two options — **Continue** (routes to Stripe Checkout on web / StoreKit on iOS) or **End** (transitions to seven-day read-only). The screen is in butler voice with **no retention copy, no discount offer, no countdown timer**. It is preceded by the ledger lead-in: "This week I arranged [N] blocks, resolved [N] conflicts, planned [N] meals, and reshuffled your day [N] times." Then: "Your week is up." Two unstyled buttons. **No derived figures, no time-saved estimates.**
- **Applied Layer 4 principle: Commitment and consistency** — "surfaces what the user has already built rather than asking for new commitment." The ledger restates the literal work the butler did during the trial; the decision flows from what already exists, not from a new pitch.
- **A note on loss aversion:** Trial end is one of the three moments where Layer 4 *permits* **Loss aversion** ("reserved for genuine decision moments (trial end, cancellation, account deletion)"). The strategy deliberately keeps it implicit — the ledger names what would lapse without ever adding urgency, a countdown, or a discount. Loss aversion is available here but is not the lever; commitment and consistency is.
- **Clears the 24-hour bar:** The figures are literal counts of events that actually happened, never inflated productivity math. A user who continues does so on a true account of value received; a user who ends meets no friction wall. Either decision still feels right 24 hours later because neither was engineered by pressure.

### 2.3 Referral — two distinct surfaces

The referral program is **two-sided in reward and two surfaces in design**: a referee-facing landing at `/r/[code]` (built by chat 095-V, the design track) and a referrer-facing settings panel (built by chat 095-W, the build track). Each gets its own thesis.

- **Shared locked behavior (Layer 6 Referral Program):** A quiet, two-sided program. Referrer gets 50% off their next billing cycle; referee gets 50% off their first paid month; trial stays the standard seven days for everyone. The referral link is the literal path `vesper.studio/r/[code]` (the section prose says "URL parameter" loosely; the literal link and the build plan govern). **No leaderboard, no public referral count, no badge, no streak, and no surface that highlights how many referrals the user has made.** Credit applies **only on the referee's paid conversion** (applied-only; no pending-count display), and is voided if the referrer is no longer in active subscription at the moment of application.

#### 2.3a Referral landing `/r/[code]` (referee-facing, chat 095-V)

- **Locked behavior (Layer 6 Referral Program; build plan 095-V):** A dedicated path-based page with a valid-code state (a personalized greeting that hands off to the main landing) and an invalid-code soft state (a brand-voiced "this invitation doesn't look right" page returning HTTP 200 with a ~2-second auto-redirect to the main landing, so a mistyped code does not dead-end and the URL indexes as page-exists rather than 404).
- **Applied Layer 4 principle: Tactical empathy** — "acknowledge the user's situation before any request." The page acknowledges the visitor arrived through a friend and shows the honest, disclosed mutual discount before asking for anything; the invalid-code page soft-redirects rather than dead-ending the visitor.
- **Clears the 24-hour bar:** The discount is real and disclosed, nothing is baited, and a mistyped code is handled gracefully rather than punished with a dead end. A referee who lands here, valid code or not, is met with honesty and a working path forward, and is satisfied a day later. Influence, not manipulation.

#### 2.3b Referral settings panel (referrer-facing, chat 095-W)

- **Locked behavior (Layer 6 Referral Program):** The referrer-facing surface lives **only** in the settings panel; it carries the user's link and the locked copy. Applied-only credit, no pending-count, no leaderboard, no badge, no streak.
- **Applied Layer 4 principle: Reciprocity through "together" framing** — "acknowledges mutual investment without inverting the master-butler dynamic." The locked copy carries it exactly: "Anyone who joins through your link starts with the free trial, and their first month is half off when they begin paying. When they begin paying, your next month is half off too." The benefit is mutual and stated plainly; the opener "Pass this along, if you like." keeps the user in charge.
- **Clears the 24-hour bar:** Both sides receive a real, disclosed discount; nothing is dangled and withdrawn. Because there is no pending-count and no leaderboard, the user is never nudged to harvest invitations or chase a number. A user who passes the link along is satisfied a day later because the terms were honest and the social pressure absent. Influence, not manipulation.

### 2.4 Cancellation flow

- **Locked behavior (Layer 5 Cancellation; Layer 4 Copy Library):** Frictionless exit. One tap on iOS (Apple subscription management), one tap on web (Stripe Customer Portal). **No retention modal. No discount offer. No survey at the cancellation moment.** On confirmation the user sees the butler acknowledgment: "Of course. Your data will be here for thirty days if you'd like to come back." A single no-oriented win-back question arrives 48 hours later by email ("Was there anything we could have done differently?") — light, no required fields, no incentive.
- **Applied Layer 4 principle: Tactical empathy** — "acknowledge the user's situation before any request." The exit makes no request at all: "Of course." accepts the decision first, then states the thirty-day data window as reassurance rather than as a hook. (The delayed win-back question is a calibrated, no-oriented question, consistent with Layer 4's **Calibrated questions**, but it sits after the exit, not in front of it.)
- **A note on loss aversion:** Cancellation is again a moment where Layer 4 permits **Loss aversion**, and the strategy again declines to deploy it as pressure. The thirty-day window is stated as fact, not as a countdown to fear.
- **Clears the 24-hour bar:** A user who cancels meets no dark-pattern wall, no guilt screen, no last-second coupon engineered to make them reconsider against their own judgment. The decision they made is the decision that executes. A fully informed user is satisfied 24 hours later precisely because leaving was as easy as joining. Influence, not manipulation.

---

## 3. Scorekeeping Discipline (binding constraint on every later surface)

Layer 4 establishes an anti-gamification, anti-scorekeeping discipline that this strategy promotes from a voice rule to a **layout and component constraint binding on every surface designed after this document.** Stated as the rule the design-build chats must hold:

- **No grades.** No surface renders a grade or report-card verdict on the user's day, week, or behavior. (Layer 4: the Vesper hour shows energy and completion "as secondary context ... never as a headline grade.")
- **No scores as headlines.** Counts of literal events (blocks arranged, conflicts resolved) may appear as calm recap; **no score, ratio, or derived figure is ever the headline.** (Layer 4 Vesper-hour visual system: "There are no grades, no scores rendered as headlines, no streak or gamification chrome." Trial-end ledger: "No derived figures, no time-saved estimates.")
- **No streak or gamification chrome.** No streaks, badges, points, levels, leaderboards, or progress-bar gamification anywhere — application, marketing, referral, or native. (Layer 4 "What the Butler Does Not Say": no "streaks," "badges," "level up." Layer 4 rejected-alternatives and Layer 6 reject a public referral leaderboard / badge / streak outright.)

Practical consequence for the design system (handed to chat 107 and onward): **no grade, score, or streak primitive may be built into the component library.** A surface cannot accidentally render scorekeeping chrome if no such component exists. This is the cheapest enforcement point and the design-build track is expected to honor it at the primitive level.

---

## 4. Surface Design Notes (propagated, not invented)

Brief, per-surface design intent for the four conversion / retention surfaces, so the later chats inherit the posture rather than re-deriving it. Each note restates only locked behavior.

### 4.1 Waitlist landing
Five sections, Hero-demo first, single capture form last (email + iOS/Android control + "Begin"). Espresso / cream / bronze system, Fraunces + Inter, per Layer 4. The cinematic Three.js scroll, if retained, is atmosphere supporting the demo, not the primary surface. No third-party widget, no scarcity chrome.

### 4.2 Trial-end screen
Ledger lead-in, then "Your week is up.", then two unstyled buttons (Continue / End). Bronze marks at most the single primary action and nothing competes with it. No countdown element exists in the layout to populate.

### 4.3 Referral surfaces

**Referral landing `/r/[code]` (referee-facing, 095-V).** An honest welcome in the espresso / cream / bronze system: a personalized greeting that hands off to the main landing, the mutual discount disclosed up front, no scarcity chrome and no countdown. The invalid-code state is a soft brand-voiced page that returns HTTP 200 and auto-redirects after ~2 seconds rather than dead-ending a mistyped code.

**Referral panel (referrer-facing, settings, 095-W).** One quiet card in the settings panel carrying the locked copy and the user's link. No count, no progress indicator, no celebratory state. Applied-only credit; nothing in the UI implies a pending tally.

### 4.4 Cancellation acknowledgment
A single butler-voice acknowledgment surface after the portal/Apple flow returns. No modal precedes it, by design — the absence of a retention modal is itself the design decision.

---

## 5. Division of Labor — Design Track vs Build Track

Two tracks run the Phase 4 build:

- **Design track.** Owns the design system and tokens (chat 107), the core primitives (107/107a), and the visual surfaces composed from them (e.g. the Butler's Notebook card, plan/Vesper-hour surfaces, the landing). Produces this strategy and the visual specs the build track implements against. Does **not** write native Swift.
- **Build track.** Owns the application logic, the API routes, the state machines, and **all native Swift implementation.**

### Native Swift surfaces are build-track-owned, from a design-track visual spec

The native Swift surfaces are **not** implemented by the design track. They are built by the **build track in Swift, from a design-track-authored visual spec:**

- **iOS alarm screen (chat 059b)** — built by the build track (native Swift, SwiftUI). The design track supplies only the visual spec, authored in chat 107. The alarm screen is a Notification Service Extension with custom two-button UI; it is native iOS work, not a React Native or design-track surface.
- **Live Activity widgets (chats 077 / 078)** — the widget extension target and app group (077) and the three widget UI variants (078) are built by the build track (native Swift). The design track supplies `DesignTokens.swift` values plus a written visual spec via chat 107. The design track does not write the SwiftUI.

**Source that establishes this:** `docs/PHASE_4_BUILD_PLAN.md` — the chat 059b note ("the build track owns the native SwiftUI alarm screen and the design track supplies only the visual spec via 107, per Stage 2 §1"), the chat 107 deliverables list ("`DesignTokens.swift` token values plus a written visual spec for the iOS alarm screen (059b) and the three Live Activity widget variants (078), handed to the build track — the design track does not write the Swift itself"), and the master-schedule rows for 059b / 077 / 078 (all build-track native). The build plan in turn cites `PHASE_4_REPLAN_STAGE_2_REORDER.md` §1. The chat 106 end-of-session check itself requires this document to "assign the native Swift surfaces to the build track from a spec rather than to the design track."

---

## 6. Not-Yet-Scaffolded Surfaces (recon finding)

Recon of `apps/web/app/` and `apps/mobile/app/` shows the four conversion / retention surfaces have **backend routes but no front-end UI shell yet.** The map above covers them anyway; the design-build chats will scaffold them.

| Surface | Backend present | Front-end shell | Status |
|---|---|---|---|
| Waitlist landing | `api/v1/waitlist` | `(marketing)/page.tsx` is a bare `<h1>Vesper</h1>` stub | Not-yet-scaffolded |
| Trial-end screen | `api/v1/subscription` | None (web or mobile) | Not-yet-scaffolded |
| Referral (landing + panel) | `api/v1/referral/{code,track}` | None — both the `/r/[code]` landing UI (095-V) and the settings-panel UI (095-W) absent | Not-yet-scaffolded |
| Cancellation acknowledgment | `api/v1/subscription` (portal) | None | Not-yet-scaffolded |

This is expected at EO 1: chat 106 is the first chat in the entire execution order, ahead of every screen chat by construction. The strategy exists so those shells inherit the posture rather than bolting it on.
