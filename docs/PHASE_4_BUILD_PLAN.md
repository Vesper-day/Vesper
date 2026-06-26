# Phase 4 Build Plan — Vesper V1

**Status:** Canonical Phase 4 reference (Stage-3 reorder rewrite). Replaces the prior `PHASE_4_BUILD_PLAN.md`. Equivalent role to ENVIRONMENT_SETUP.md in Phase 3. Execution order is governed by the **master reordered-sequence table** in this front matter; chat numbers are **immutable IDs**, not execution order. Every chat keeps its original number so that inline dependencies, Cutover steps, the Risk Map, the Parallelization Map, and the Critical Path continue to resolve. The full plan is produced and stored as parts 1–10 (see the file-split plan below) and concatenated into one document; **this part (part 1) is the conventions source** — its legend, per-chat template, and master table are authoritative for every later part.

**Scope:** Project Weeks 6 onward through V1 ship. The Claude Code sessions required to take the monorepo from "type-checks clean, empty migrations dir" to "submitted to App Store with waitlist landing page live on the production domain." The original 105-session plan is re-planned here into a dependency-valid order that pulls a low-dependency, design-defining cluster into an ~11-day design-cluster window without renumbering any existing chat. Total entries after the re-plan: 109 carried-over chats (non-deferred) + 13 split halves + 7 new chats, sequenced as 106 execution-ordered positions (the deferred V1.5 export chat 090a is excluded from the order).

**Source documents:** TECHNICAL_SPEC.md (implementation contract), PRD.md (product contract), all six layer documents (foundation, scope, architecture, experience, business, launch), OPEN_SOURCE_INVENTORY.md, ENVIRONMENT_SETUP.md, plus the re-plan inputs that produced this order: PHASE_4_REPLAN_STAGE_1_ANALYSIS.md (dependency/staleness analysis) and PHASE_4_REPLAN_STAGE_2_REORDER.md (the reordered sequence, model assignments, splits, and carried-forward flags). Where Stage 2 carries an unresolved migration/prompt question as a CANNOT-DETERMINE flag, this document carries it forward unresolved and attaches it to the chat that reads it; gaps are flagged, not invented.

**Author convention:** Every chat in this document represents one Claude Code session driven by one corresponding chat in claude.ai. Sessions are bounded by the Pro plan's 5-hour limit and by Tech Spec §13's coherent-unit-of-work guidance: one API route, one UI component, one Worker per session. Sprawling cross-package sessions are explicitly rejected.

---

## How to Use This Document

At the start of any Claude Code build session, the chat that directs that session loads this document, reads the **master reordered-sequence table** to find the next position in execution order (EO), and identifies the chat ID sitting at that position. It then reads the matching numbered section in the relevant part, loads the documents and code paths listed in that section's **Load at session start** block, and executes the work in **Goal** with the deliverables enumerated in **Output**. The session ends when the deliverables exist, the implementation notes have been satisfied, and the end-of-session checks pass.

**Execution order is the EO column, not the chat number and not the block order.** Chat numbers are immutable identifiers carried for cross-reference stability; the document body remains organized by its original Blocks for readability; but the order in which sessions actually run is the EO column of the master table. When chat numbering, block order, and EO disagree, **EO is canonical for sequencing** and the **Critical Path section remains canonical for the specific late-binding back-references** it has always governed (Chat 018 → 019, 020 → 022, 034 → 063/064, 056 → 057, 072 → 091, 074 → 084/087/088). Each affected chat restates this caveat inline, so the rule is enforced at both the doc level (here) and the per-chat level.

**EO is a dependency rank, not a schedule.** A position number is the chat's place in a single dependency-valid topological walk; it is not a wall-clock day and there are no day bands in this document. The build runs on **two parallel tracks** — the **F (design) track** and the **B (build) track** — across the same calendar. A high EO does not mean "starts later in wall-clock" for a build-track chat whose prerequisites are already built; it means later in the topological order. The two tracks interleave in the single EO sequence but run concurrently.

**The design-cluster window.** Fifteen chats (marked `Y` in the Window column) must finish inside the ≤11-day design-cluster window. Those fifteen also carry a design-cluster-window sequence counter, `Fwin F1`–`F15`, so window load is visible at a glance; the counter is independent of the build-track EO positions interleaved around it. The window note directly under the master table records the feasibility result, the designated pressure valve, and a counter-vs-flag naming caveat.

**Splits.** Thirteen chats are split into a design-track visual/static half (`NNN-V`, inside the window) and an build-track wiring half (`NNN-W`, in normal sequence). **Both halves are documented inside the original chat's Block** — the split is a sequencing and ownership device, not a relocation. Any existing reference to `NNN` resolves to the pair. The `-V` halves are design-locked, wiring-deferred: durable visual output that the `-W` half rewires to real APIs after the design track leaves. A `-V` half is not "done" until its `-W` half ships.

**New chats.** Seven new chats carry fresh IDs ≥106 so they cannot collide with any existing number (including the intentionally-deleted 068–070, left untouched). The three pure design-foundation chats (106 design-strategy, 107 design system, 107a component library part 2) are documented in a new **Design Cluster** section placed ahead of Block 0. The Butler's Notebook pair (108 migration/API on the build track, 108a visual card on the design track) is documented in a new **Butler's Notebook** section adjacent to the Design Cluster. The two stale-code fix chats are documented in the blocks they repair: 111 (schema/Zod fixes and the single early migration-read checkpoint) in Block 1, and 112 (AI fallback re-scope and chat-019 prompt audit) in Block 3.

Risk-flagged chats (⚠️) require special handling: multiple iterations if needed, no shortcuts. The Risk Map explains why each flagged chat carries elevated risk. Parallel execution across terminals is encouraged where chats are marked ⇄; the Parallelization Map enumerates concurrency.

The Cutover Block is not a Claude Code session. It is a sequence of thirty-one manual founder actions (twenty-nine integer-numbered steps C-01 through C-29 plus two letter-suffix steps C-22a and C-27a) that must complete in order before the chats marked 🚧 can run. The exact sequencing of Cutover relative to Phase 4 chats is established in the Critical Path section. The reorder does not alter any Cutover step number.

---

## Notation Legend

The symbols used throughout this document carry consistent meanings.

All Claude Code sessions run on a single model; per-chat model assignments have been removed from this plan.

**Package origin** is marked with one of four colors. 🔵 indicates web work in `@vesper/web` (the Next.js application). 🟢 indicates mobile work in `@vesper/mobile` (the Expo application). 🟣 indicates a Cloudflare Worker in the `workers/` directory. 🟡 indicates shared-package work in `@vesper/shared`, `@vesper/db`, or `@vesper/ai`.

**Skill flags** identify which Claude Code skill must be explicitly invoked during the session. 🗄️ flags chats where the drizzle-best-practices skill is required. 🤖 flags chats that touch the AI layer where prompt versioning matters. 🎩 flags chats where caveman and stop-slop interact through the butler voice gate for user-facing copy.

**Risk and dependency flags** identify chats requiring special handling. ⚠️ marks chats with elevated risk of architectural backtracking, silent bugs, or revenue impact. 🚧 marks chats that cannot run until the Cutover Block completes. ⇄ marks chats that can run in parallel with sibling chats on separate terminals.

**Window and CD-flags.** `Window Y` marks a chat that must finish inside the ≤11-day design-cluster window; window chats also carry a `Fwin F#` sequence position. `CD-flags` lists any carried-forward CANNOT-DETERMINE flags (F1–F4) the chat reads or consumes — these are migration/prompt questions Stage 2 could not resolve from the project copy and are resolved at build time, not by guessing. Note that the `Fwin F#` counter and the `CD-flag F#` tokens share an `F#` shape but live in different columns/fields and are unrelated; read them field-scoped (see the window note).

---

## Per-Chat Entry Template

Every chat entry in parts 2–9 follows this exact field layout. Fields in order: identifier and title (header); meta line carrying block, EO, model, package color, skills, risk/dep flags, window, and CD-flags; then the bold-labeled blocks for prerequisites (Load / Dependencies), scope (Goal), outputs (Output), and notes (Implementation notes / End-of-session checks).

```
### Chat <ID> — <Title>

*Block <N> · EO <##> · <🔵|🟢|🟣|🟡> · Skills: <list or —> · <⚠️ | 🚧 | ⇄ + partner IDs, or —> · Window <Y (Fwin F#) | N> · CD-flags: <F1..F4 | —>*

**Load at session start:** <documents and code paths to load before work begins; the prerequisite-context half of "prerequisites">

**Goal:** <the scope of the session in one to three sentences — what the session produces and why>

**Output:**
- <deliverable file or artifact 1>
- <deliverable file or artifact 2>
- <...>

**Implementation notes:** <the notes: design decisions, threat models, gotchas, model/skill rationale, and any inline restatement of a Critical Path caveat>

**Dependencies:** <gating chat IDs by number; the dependency half of "prerequisites." "None" if first in its chain. Restate any later-numbered hard dependency and point to Critical Path.>

**End-of-session checks:** <the concrete conditions that must hold for the session to be considered complete>
```

Field-mapping notes for authors of later parts: **scope → Goal**; **prerequisites → Load at session start (context) + Dependencies (gating IDs)**; **outputs → Output**; **notes → Implementation notes + End-of-session checks**. The meta line is where **EO** is surfaced per entry; it must agree with the master table. A split half uses the same template with its `-V`/`-W` ID and its own EO and window values. New chats use the same template.

---

## Master Reordered-Sequence Table

Every chat, existing and new, in execution order. **Track** is `F` (design track) or `B` (build track). **Win** is the design-cluster-window membership; **Fwin#** is the in-window sequence counter (window chats only). **CD-flags** lists carried-forward CANNOT-DETERMINE flags the chat reads (R) or consumes (C). The deferred V1.5 chat 090a is not in the order. This table — not the chat numbers, not the block order — is the execution order of the build.

| EO | Chat ID | Track | Win | Fwin# | Scope (one line) | CD-flags |
|---|---|---|---|---|---|---|
| 1 | 106 | F | Y | F1 | Design-strategy doc (no code); honest-conversion map across app + site | — |
| 2 | 107 | F | Y | F2 | Design system (tokens) + core primitives; emits native token spec | — |
| 3 | 107a | F | Y | F3 | Component library pt 2 (forms, pickers, butler-line, motion) | — |
| 4 | 111 | B | N | — | Schema/Zod stale-fixes + single early migration-read checkpoint | F1 R, F2 R, F3 R |
| 5 | 112 | B | N | — | AI fallback re-scope (018) + chat-019 prompt audit | F4 R |
| 6 | 021 | B | N | — | Context builders + cache wiring | — |
| 7 | 023 | B | N | — | Other AI op scaffolds (NL parse, classify, check-in, regen) | — |
| 8 | 024 | B | N | — | Profile + energy APIs (uses 111-corrected profile shape) | — |
| 9 | 031 | B | N | — | Waitlist + referral APIs | F3 C |
| 10 | 047 | B | N | — | Seed sourcing scripts (ExerciseDB + TheMealDB) | — |
| 11 | 091 | B | N | — | Resend templates 1 (auth + trial reminders) | — |
| 12 | 108 | B | N | — | Notebook migration + table + RLS + read/confirm-correct API | — |
| 13 | 059b | B | N | — | iOS alarm screen (the build track owns; design-track visual spec via 107) | — |
| 14 | 077 | B | N | — | LA widget target + app group (the build track owns) | — |
| 15 | 093-V | F | Y | F4 | Landing page + Three.js hero demo (canned templates, no account) | — |
| 16 | 032-V | F | Y | F5 | Onboarding welcome / auth-reposition / honorific (visual + reveal) | — |
| 17 | 033-V | F | Y | F6 | Archetype tiles (visual) | — |
| 18 | 034-V | F | Y | F7 | Calendar-connect / walkthrough / location screens (static) | — |
| 19 | 035-V | F | Y | F8 | Module toggles + per-module prefs (forms, mocked; reflects 111 notif-prefs) | — |
| 20 | 036-V | F | Y | F9 | First-plan cinematic loading + reveal + tour (mock plan) | — |
| 21 | 041-V | F | Y | F10 | 10 block-type detail layouts (static, BlockDetailsSchema) | — |
| 22 | 044-V | F | Y | F11 | Ambient butler line (visual + local rotation, static library) — **pressure valve** | — |
| 23 | 046-V | F | Y | F12 | Vesper-hour static + week view + morning brief + energy slider + quiet hours | — |
| 24 | 108a | F | Y | F13 | Notebook visual card surface | — |
| 25 | 089-V | F | Y | F14 | Subscription lifecycle static states (trial-end ledger, banners, billing) | — |
| 26 | 095-V | F | Y | F15 | Referral landing `/r/[code]` page (visual) | — |
| 27 | 022 | B | N | — | synthesizePlan + fallback chain (uses 112-audited prompt) | — |
| 28 | 048 | B | N | — | Seed migrations 14–15 + first seed deploy | — |
| 29 | 026 | B | N | — | Plan retrieval APIs | — |
| 30 | 028 | B | N | — | Task APIs | — |
| 31 | 030 | B | N | — | Subscription / account / push-token scaffolds | — |
| 32 | 029 | B | N | — | NL command + weekly-priorities APIs | — |
| 33 | 078 | B | N | — | LA widget UI (3 variants + DesignTokens.swift from 107 spec) | — |
| 34 | 025 | B | N | — | Plan-gen API (SSE, idempotency, atomic commit) | F1 C |
| 35 | 027 | B | N | — | Block APIs (optimistic concurrency) | — |
| 36 | 037 | B | N | — | Supabase Realtime client | — |
| 37 | 063 | B | N | — | GCal OAuth + pgsodium + rotation runbook | — |
| 38 | 081 | B | N | — | Subscription state machine | — |
| 39 | 076 | B | N | — | Push token infrastructure (APNs + push-to-start) | — |
| 40 | 090b | B | N | — | Biometric lock setting (OFF default) | — |
| 41 | 052-W | B | N | — | Built-in calendar web (chrome + library + CRUD + RRULE; 052-V folded in) | — |
| 42 | 053 | B | N | — | Built-in calendar mobile (parity) | — |
| 43 | 054-W | B | N | — | Tasks: list UI + CRUD wiring (054-V folded in) | — |
| 44 | 064 | B | N | — | GCal sync + token refresh + classification | — |
| 45 | 038 | B | N | — | Offline mutation queue + conflict resolution | — |
| 46 | 032-W | B | N | — | Onboarding state machine + auth/persistence wiring | — |
| 47 | 033-W | B | N | — | Archetype 5A/5B branch routing | — |
| 48 | 039 | B | N | — | Plan day view (web) — wire 037/038/026 | — |
| 49 | 040 | B | N | — | Plan day view (mobile) — parity | — |
| 50 | 041-W | B | N | — | Bind block-detail layouts to retrieved data | — |
| 51 | 042 | B | N | — | Block actions + state transitions + butler copy | — |
| 52 | 034-W | B | N | — | Onboarding calendar-branch + geolocation wiring (CP 063→064→034) | — |
| 53 | 035-W | B | N | — | Module-prefs persistence + push-prompt timing | — |
| 54 | 060 | B | N | — | Medications module (strict RLS, audit, local notifs) | F2 C |
| 55 | 061 | B | N | — | Finance + bills module (default OFF) | — |
| 56 | 057 | B | N | — | Weekly planning steps 1–3 | — |
| 57 | 085 | B | N | — | Apple StoreKit 2 (mobile purchase flow) | — |
| 58 | 083 | B | N | — | Stripe Checkout + Portal + cutover runbook | — |
| 59 | 044-W | B | N | — | Honorific-aware butler-line selection | — |
| 60 | 045 | B | N | — | NL input sheet + command pipeline | — |
| 61 | 043 | B | N | — | Block drag-and-drop reorder | — |
| 62 | 046-W | B | N | — | Vesper evening draft/approve loop + completion wiring | F1 C |
| 63 | 036-W | B | N | — | First-plan real synthesis trigger wiring | — |
| 64 | 049 | B | N | — | Fitness module (template wiring, scaling, detail UI, swap) | — |
| 65 | 050 | B | N | — | Nutrition module (recipe UI, hydration) | — |
| 66 | 051 | B | N | — | Meal planning + grocery list | — |
| 67 | 055 | B | N | — | Task placement algorithm (task → focus block) | — |
| 68 | 056 | B | N | — | Task reflow + over-commit prompt (voice-gated) | — |
| 69 | 058 | B | N | — | Weekly planning steps 4–5 + weekly grid | — |
| 70 | 059a | B | N | — | Sleep module logic (wind-down, bedtime, quiet hours) | — |
| 71 | 062 | B | N | — | Errands module | — |
| 72 | 065 | B | N | — | GCal push webhook channel + receiver | — |
| 73 | 066 | B | N | — | GCal channel renewal worker | — |
| 74 | 067 | B | N | — | GCal conflict resolution + regen prompt | — |
| 75 | 084 | B | N | — | Stripe webhook handler (worker) | — |
| 76 | 086 | B | N | — | Apple receipt verification API | — |
| 77 | 086a | B | N | — | Apple PKI monitor worker | — |
| 78 | 087 | B | N | — | Apple Server Notifications V2 — part 1 | — |
| 79 | 088 | B | N | — | Apple Server Notifications V2 — part 2 | — |
| 80 | 079 | B | N | — | expo-live-activities JS bridge | — |
| 81 | 075 | B | N | — | Bill reminder + APNs token cleanup workers | — |
| 82 | 080 | B | N | — | Live Activity pusher worker + immediate trigger | — |
| 83 | 071 | B | N | — | Cache pre-warm worker | — |
| 84 | 082 | B | N | — | Read-only mode enforcement (cross-cutting) | — |
| 85 | 089-W | B | N | — | Subscription lifecycle wiring (state machine + Stripe/Apple) | — |
| 86 | 090 | B | N | — | Cancellation flow + reason + deletion UI | — |
| 87 | 095-W | B | N | — | Referral attribution + cookie + mint-on-active + settings | F3 C |
| 88 | 092 | B | N | — | Resend templates 2 (waitlist, post-cancel, referral) | — |
| 89 | 094 | B | N | — | Landing SEO / OG + sitemap + icons | — |
| 90 | 072 | B | N | — | Trial reminder + dunning workers | — |
| 91 | 073 | B | N | — | Hard-delete worker + Stripe cleanup | — |
| 92 | 074 | B | N | — | Reconciliation worker | — |
| 93 | 105a | B | N | — | Demo account provisioning (2 reviewer accounts) | — |
| 94 | 096 | B | N | — | PostHog event taxonomy + 3 funnels | — |
| 95 | 097 | B | N | — | Sentry coverage + analytics + dashboard | — |
| 96 | 097a | B | N | — | Operational alerting + spend monitoring | — |
| 97 | 098 | B | N | — | Voice-gate end-to-end sweep | — |
| 98 | 099 | B | N | — | Error states 1 (AI fallback, offline, integration) | — |
| 99 | 100 | B | N | — | Error states 2 (regen, absence, 404, auth, mini-onboarding) | — |
| 100 | 101 | B | N | — | Accessibility + performance audit | — |
| 101 | 101a | B | N | — | Load test + chaos drill | — |
| 102 | 102 | B | N | — | App Store metadata + privacy manifest | — |
| 103 | 103 | B | N | — | App Store screenshots + marketing assets | — |
| 104 | 104 | B | N | — | Privacy policy + ToS live pages | — |
| 105 | 105 | B | N | — | TestFlight build + LA verification + submission | — |
| 106 | 105b | B | N | — | App Store review rejection response (conditional) | — |

---

## Design-Cluster-Window Note (EO, tracks, slack, pressure valve)

This note is the feasibility record for the window defined by the table above; it is co-located with the master table because the window, the `Fwin#` counter, and the pressure valve are all defined here.

**EO is a dependency rank, not a wall-clock schedule, and the F and B tracks run in parallel.** A build-track chat at a high EO whose prerequisites are already built can run early in wall-clock time; the EO position only fixes its place in the topological order. No day bands are stated anywhere in this document.

**The fifteen window chats, in `Fwin` order:** F1 = 106, F2 = 107, F3 = 107a, F4 = 093-V, F5 = 032-V, F6 = 033-V, F7 = 034-V, F8 = 035-V, F9 = 036-V, F10 = 041-V, F11 = 044-V, F12 = 046-V, F13 = 108a, F14 = 089-V, F15 = 095-V. Capacity is ~11 days for 15 chats, ~1.36 chats/day, treated as a ceiling. Every window chat depends only on already-built foundations (shells 012/013, schema 004–006) plus the design system (107/107a) earlier in the same cluster; **no window chat depends on any unbuilt build-track chat**, so the design track runs the cluster start-to-finish while the build track builds the backend spine in parallel.

**Pressure valve (pre-agreed drop-to-14).** If the ≤11-day window slips, the designated chat to drop from the window is **044-V (Fwin F11)** — the ambient butler line, whose visual + local rotation is the lowest-leverage of the fifteen and whose function survives composition from 107a primitives during its `-W` half (044-W, EO 59). Dropping 044-V brings the window to 14 chats with no loss of a conversion, retention, onboarding, or design-foundation surface. (108a Fwin F13 is the alternate valve named in Stage 2 if 044-V cannot be dropped for any reason.) Designating the valve here means the fifteen are not carried with zero slack.

**Counter-vs-flag naming caveat (carried as a flag, not silently renamed).** The Stage-2-review instruction added the design-cluster-window counter using the token range "F1–F15." Those tokens share an `F#` shape with the carried-forward CANNOT-DETERMINE flags **F1–F4**, but they are unrelated: `Fwin F1` is the first window chat (106); `CD-flag F1` is the `daily_plans` draft/approved-state migration question. They are namespaced by column (`Fwin#` vs `CD-flags`) and must be read field-scoped. The collision was honored as requested rather than resolved by renaming, because the CD-flag names F1–F4 are referenced by other parts and renaming would break those references.

---

## File-Split Plan

The full document is produced as separate markdown parts, each ending on a block (or section) boundary so that none truncates mid-entry, then concatenated into one `PHASE_4_BUILD_PLAN.md`. The suggested 7-file default overflows once the 13 split halves (+13 entries) and 7 new chats (+7 entries) inflate the body and the detail mandate forbids compression; the plan is therefore rebalanced to **ten parts**. Entry counts below are post-split. Parts whose count sits near the truncation ceiling are flagged to self-split into `Na`/`Nb` if the authoring chat's content estimate would overflow a single response; the chain continues unbroken in that case.

| Part | Contents | Entries / notes |
|---|---|---|
| **1** | Front matter: title, status/scope, sources, How-to-Use, Notation Legend, per-chat template, master reordered-sequence table, design-cluster-window note + pressure valve, this file-split plan | this part — conventions source |
| **2** | Design Cluster (106, 107, 107a) + Butler's Notebook (108, 108a) + Block 0 (001–003) + Block 1 (004–007, 111) | 13 entries (new chats detailed) |
| **3** | Block 2 (008–015) + Block 3 (016–023, 112) | 17 entries |
| **4** | Block 4 (024–031) + Block 5 (032–036, each `-V`/`-W`) | 18 entries |
| **5** | Block 6 (037–046, with 041/044/046 `-V`/`-W`) | 13 entries |
| **6** | Block 7 (047–062, with 052/054 `-V`/`-W`; 059a, 059b) | 19 entries — **self-split to 6a/6b if overflow** |
| **7** | Block 8 (063–067) + Block 9 (071–075) + Block 10 (076–080) | 15 entries |
| **8** | Block 11 (081–090b, with 089 `-V`/`-W`; excludes deferred 090a) | 13 entries |
| **9** | Block 12 (091–097a, with 093/095 `-V`/`-W`) + Block 13 (098–105b) | 21 entries — **self-split to 9a/9b if overflow** |
| **10** | Cutover Block + Risk Map + Parallelization Map + Skill Invocation Map + Critical Path + External Items Started Day 1 + Closing Notes + Deferred to V1.5 (090a) | non-chat tail |

Boundary rules for authors of later parts: never end a part mid-entry; if a part would truncate, split at the nearest block boundary into `Na`/`Nb` and continue the chain; the `-V` and `-W` halves of a split chat are documented in the same part (their original block); 090a appears only in the Deferred section in part 10. Concatenation order is parts 1 → 10 (with any `a`/`b` sub-parts in letter order); patching them head-to-tail in that order reproduces the single `PHASE_4_BUILD_PLAN.md`.

<!-- PHASE_4_BUILD_PLAN.md — Part 2 of 10. Body begins here; conventions, legend, and master table live in Part 1. Concatenate Parts 1→10 (a/b sub-parts in letter order) head-to-tail. -->

---

## Carry-Over Note for Built Foundation Chats (Blocks 0–1 in this part)

Chats 001–007 are carried over from the prior `PHASE_4_BUILD_PLAN.md` as already-completed foundation work. The re-plan's master reordered-sequence table in Part 1 sequences only the not-yet-built and pulled-in work — its first execution-order position is 106 and it reaches the first existing build chat (021) at EO 6 — so chats 001–020 do not appear in that table and carry no execution-order position or model assignment from it. This is the built-foundation premise from Stage 1 (001–020 built, 021+ unbuilt), corroborated by the committed Zod and context artifacts but not independently re-verified.

Consequently, for every carried-over chat in this part the meta line records **EO** as `— (built foundation; not in master sequence)` rather than an invented position, because these sessions are all build-track. No EO numbers are fabricated for them. Package colors, skill flags, risk flags, and all body content are carried over from the prior plan unchanged except for the reformat into the Part 1 per-chat template. The new chats in this part — 106, 107, 107a, 108, 108a, and 111 — do carry their real EO, Window, and CD-flag values from the master table.

---

## Design Cluster

The Design Cluster is a new section introduced by the re-plan and placed ahead of Block 0 because its three chats are the first sessions to run in execution order (EO 1–3) and the first three positions of the design-cluster window (`Fwin F1`–`F3`). The cluster exists to close the design-system gap Stage 1 identified: the prior plan jumped from the application shells (012/013) straight to feature UI with no dedicated token-and-primitive layer, so every screen risked re-deriving design tokens and drifting. These three chats build that layer once, on the design track, while the build track builds the backend spine in parallel on the build track. All three depend only on already-built foundations (the shells 012/013 and the locked Layer 4 identity), so they are unblocked immediately and do not wait on any unbuilt build-track chat.

### Chat 106 — Design-Strategy Doc (no code)

*Design Cluster · EO 1 · 🔵 🟢 · Skills: — · — · Window Y (Fwin F1) · CD-flags: —*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (full file, with attention to the Persuasion Principles Quietly Applied section and the scorekeeping discipline it establishes); LAYER_5_BUSINESS_MONETIZATION.md and LAYER_6_LAUNCH_GROWTH.md (the conversion and retention surfaces — trial, referral, waitlist, cancellation); PRD.md (product contract); the built application shells in `apps/web/app/` and `apps/mobile/app/` so the strategy is grounded in the surfaces that already exist.

**Goal:** Reason — in prose, with no code produced — about what design goes where across the application and the marketing site, and how each design choice drives honest conversion and honest retention rather than dark-pattern engagement. The session produces a single committed design-strategy document that the design-build chats (107 onward, and every later `-V` half) follow. Because this is the first chat in execution order and the anchor of the design-cluster window, its job is to make the persuasion-with-integrity posture explicit before any pixel is committed, so the visual system inherits it rather than bolting it on.

**Output:**
- `docs/DESIGN_STRATEGY.md` — a design-strategy document covering, at minimum: the surface-by-surface map of where design effort lands across app and site; the honest-conversion thesis for each revenue/retention surface (waitlist landing, trial-end ledger, referral landing, cancellation flow), each tied back to the specific Layer 4 persuasion principle it applies and the 24-hour-satisfaction ethical bar that principle must clear; the scorekeeping discipline (no grades, no scores as headlines, no streak or gamification chrome) restated as a binding constraint on every later surface; and the division of labor between the design track and the build track, including the explicit note that native Swift surfaces (the alarm screen 059b and the Live Activity widgets 077/078) are built by the build track from a design-track-authored visual spec rather than by the design track directly.

**Implementation notes:** This chat is on the design track and is deliberately code-free; its leverage is that it front-loads the design reasoning the entire cluster and every later `-V` half will compose against. The persuasion principles must be verified against Layer 4 before being relied upon, not paraphrased from memory, because the document's whole purpose is to bind later copy and layout to the principles as actually written — including the ethical limit Layer 4 states (a fully informed user would feel satisfied with the decision 24 hours later; if not, it is manipulation and is out of bounds). The strategy must treat loss-aversion framing as reserved for genuine decision moments (trial end, cancellation, account deletion) and never sprinkled through routine copy, mirroring Layer 4. No new product decisions are introduced here; the document only propagates locked Layer 4/5/6 decisions into a design plan.

**Dependencies:** None new. Reasons over the locked Layer 4/5/6 and PRD and the already-built shells (012/013). First chat in the entire execution order and first in the design-cluster window.

**End-of-session checks:** `docs/DESIGN_STRATEGY.md` exists, renders in GitHub's markdown view, and names every conversion/retention surface with its applied persuasion principle and the scorekeeping constraint. Every principle cited is traceable to the Layer 4 persuasion section as written. The document explicitly assigns the native Swift surfaces to the build track from a spec rather than to the design track.

### Chat 107 — Design System (tokens) + Core Primitives

*Design Cluster · EO 2 · 🔵 🟢 🟡 · Skills: frontend-design · — · Window Y (Fwin F2) · CD-flags: —*

**Load at session start:** `docs/DESIGN_STRATEGY.md` (from chat 106); LAYER_4_EXPERIENCE_IDENTITY.md (the visual system — the espresso/cream/bronze palette, the Fraunces Display / Inter / JetBrains Mono type roles, the motion bands, spacing, radii, and the vellum-texture and reduced-motion conventions); the built shells `apps/web/app/` and `apps/mobile/app/` and any token references already scattered ad hoc inside 013/077/078/091 so they can be consolidated rather than duplicated.

**Goal:** Build the design system as the first design-BUILD chat: a single source-of-truth token layer (color, type, motion, spacing, radii) expressed as a Tailwind theme for web and a React Native theme for mobile, plus the core primitive components every later screen composes from — cards, buttons, the block row, and the butler-line container. This chat also emits the native token values and a visual spec for the surfaces the build track owns in Swift, so visual consistency carries to native without spending design-track capacity on Swift.

**Output:**
- `apps/web/` Tailwind theme extension encoding the Layer 4 tokens: the espresso/cream/bronze palette as semantic tokens (`bg-primary`, `bg-surface`, `text-primary`, `text-secondary`, the bronze accent), the type scale mapped to Fraunces Display for headlines, Inter for body/labels, and JetBrains Mono for counts/times, the spacing and radii scales, and the motion bands (Instant / Quick / Considered) with a reduced-motion fallback path
- `apps/mobile/` React Native theme object mirroring the same tokens so web and mobile render the identical system
- Primitive components in both packages: card (with the vellum texture at the limit of perceptibility), button (with the single-primary-action bronze treatment), block row, and the butler-line container shell
- `DesignTokens.swift` token values plus a written visual spec for the iOS alarm screen (059b) and the three Live Activity widget variants (078), handed to the build track — the design track does not write the Swift itself
- A short `docs/DESIGN_SYSTEM.md` (or equivalent in-repo reference) documenting token names, their Layer 4 source, and the composition rule that later screens must use these primitives rather than re-deriving tokens

**Implementation notes:** The frontend-design skill is invoked because this chat sets the aesthetic foundation and the constraints (token system, type roles, motion discipline) that every later UI chat inherits; getting drift out of the system here is the entire point of inserting the cluster. The bronze accent is reserved for the single primary action on any surface and nothing competes with it, per Layer 4. There are no grades, scores, streaks, or gamification primitives in the system — the scorekeeping discipline from chat 106 and Layer 4 is encoded as the absence of those components, not merely as guidance. The native-token handoff (`DesignTokens.swift` values + visual spec) is the mechanism by which the §1 native-ownership decision from Stage 2 is honored: the build track implements 059b/077/078 in SwiftUI against this spec, keeping the design track's slots for the design-defining web surfaces.

**Dependencies:** Chat 106 (design strategy doc); the built shells 012/013. First design-BUILD chat; precedes every screen chat by construction.

**End-of-session checks:** The Tailwind theme and the React Native theme expose the same semantic token names and values. The primitive components render correctly in both packages and pass `pnpm build` / `pnpm lint`. `DesignTokens.swift` values plus the alarm and Live Activity visual specs exist and are complete enough for the build track to implement without re-deriving any token. No grade/score/streak primitive exists anywhere in the system.

### Chat 107a — Component Library Part 2 (forms, pickers, butler-line, motion)

*Design Cluster · EO 3 · 🔵 🟢 · Skills: frontend-design · — · Window Y (Fwin F3) · CD-flags: —*

**Load at session start:** `docs/DESIGN_SYSTEM.md` and the token themes and primitives from chat 107; LAYER_4_EXPERIENCE_IDENTITY.md (the butler voice posture and the motion bands); the built shells for the host surfaces these components will mount into.

**Goal:** Continue the component library with the second tier of primitives the screen chats need: form controls, time and date pickers, the butler-line component proper (the rendered voice surface, not just the container shell from 107), and the motion primitives (the shared entrance/interaction animations in the Considered and Quick bands with their reduced-motion fallbacks). This is the continuation of 107, split out only so neither session exceeds the coherent-unit-of-work bound; together 107 and 107a are the full component library.

**Output:**
- Form control components (text fields, toggles, selects/segmented controls) in both `apps/web` and `apps/mobile`, styled from the 107 token system
- Time and date picker components in both packages, sized for the onboarding wake/bed capture and the module-preference surfaces that consume them later
- The butler-line component — the rendered butler-voice line surface composed onto the 107 container, with the formal-but-human, brief, lead-with-service posture baked into its layout (the copy library itself is authored later in 044, not here)
- Motion primitives: shared, reusable entrance and interaction animations in the Considered and Quick bands, each with an explicit reduced-motion fallback to instant transitions
- The `docs/DESIGN_SYSTEM.md` reference extended to cover the part-2 components

**Implementation notes:** The frontend-design skill is invoked for the same reason as 107 — these are the remaining shared primitives, and consistency with the part-1 token system is the deliverable. The butler-line component renders the voice surface but does not author voice copy; the actual ambient line library and its honorific-aware rotation are split across 044-V (visual + local rotation, in the window) and 044-W (honorific-aware selection, later), so 107a stops at the component and notes that the voice gate (caveman + stop-slop) governs any copy that later flows through it. Pickers and form controls are built against the data shapes the onboarding and module-preference screens will mount, so the later `-V` halves compose rather than rebuild.

**Dependencies:** Chat 107 (token system and core primitives). Third and last chat of the Design Cluster.

**End-of-session checks:** All part-2 components render in both packages and pass `pnpm build` / `pnpm lint`. Pickers and form controls compose cleanly onto the 107 primitives with no token re-derivation. The butler-line component renders a placeholder line in the correct type role and color and exposes a slot for voice-gated copy. Motion primitives honor the reduced-motion fallback.

---

## Butler's Notebook

The Butler's Notebook section is a new section introduced by the re-plan to hold the two chats that build the notebook surface, which Stage 1 found had no table and no chat anywhere in the prior plan. The surface is the low-frequency place where the product shows what it has learned about the user — at most a few times per week, never as push, surfaced in-app on the plan view or in the Vesper hour — stating one engine inference in butler voice with a confirm-or-correct affordance. Per the Stage 2 split, the work divides into a build-track migration-and-API chat (108) and a design-track visual card chat (108a, in the window). The section is placed adjacent to the Design Cluster because 108a is a window chat that composes directly on the 107/107a design system.

### Chat 108 — Notebook Migration + Table + RLS + Read/Confirm-Correct API

*Butler's Notebook · EO 12 · 🔵 🟡 · Skills: drizzle-best-practices · 🗄️ · Window N · CD-flags: —*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (the Butler's Notebook subsection — the inference-with-confirm/correct model, the no-list-accumulation and no-insights-dashboard framing); `docs/MIGRATION_NUMBER_ALLOCATION.md`; the committed migration set under `packages/db/migrations/` and `packages/db/src/schema/`; the API foundation from chat 008 (`createRoute`, error catalog, `validateSession`) and the service-role-with-user-filter pattern from chat 007; the security audit and RLS patterns established in chats 005/006.

**Goal:** Create the storage and the API for the butler's notebook: a new table for engine inferences carrying a confirm/correct state, Row Level Security with own-row policies and the appropriate audit posture, and the read / confirm / correct endpoints the visual card (108a) will call. This is the build-track half of the notebook; it produces no UI.

**Output:**
- A new migration `packages/db/migrations/<allocated>_notebook_inferences.sql` and its `.down.sql`, creating the inferences table: `id uuid PK`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, the inference text in butler voice, an inference-type/source discriminator, a confirm/correct state column with a sensible default, the timestamp(s) needed to surface entries at the right cadence, and indexes for the per-user, most-recent read pattern; RLS own-row policies for SELECT and the state-changing operations, deny-all by default; the `set_updated_at()` trigger attached if the table carries `updated_at`
- The API endpoints under `apps/web/app/api/v1/...` built on the chat 008 `createRoute` template: a read endpoint returning the due/pending inference(s) for the authenticated user, a confirm endpoint, and a correct endpoint, each scoped through the `withUser` filter from chat 007 against the service-role client
- Drizzle schema sync for the new table and any Zod validation for request/response shapes added to `packages/shared`
- An `audit-schema` assertion (extending chat 006's script) that the notebook table, its RLS policies, and its constraints exist

**Implementation notes:** **Migration number allocation is a build-time decision and is deliberately not hard-coded here.** Per `docs/MIGRATION_NUMBER_ALLOCATION.md`, numbers 14–30 are the Blocks 4–7 range; the committed migration set already runs through `…0018_calendar_events.sql`, and chat 005 has already consumed 14–18 out of that range, so 108 must select the next genuinely-free number against the allocation document at build time rather than assuming a specific suffix is open. A guessed number risks colliding with another Blocks 4–7 chat that claims a slot first. The table models a single current inference surfaced occasionally, not an accumulating feed — there is no list, no history dashboard, no "insights" framing — so the schema favors the confirm/correct lifecycle of one inference at a time over an append-only log. RLS is strict own-row because notebook content is derived personal data; the audit posture follows the chat 005 pattern for sensitive tables. The confirm/correct copy itself is part of the visual card (108a) and flows through the butler voice gate there; 108 only returns the inference text and records the state transition.

**Dependencies:** Built schema foundation (chats 004–006), the API foundation (chat 008), and the connection/user-filter pattern (chat 007). Runs on the build track at EO 12, ahead of the design-track card 108a (EO 24) so the card has a real API to call as soon as its wiring half is reached.

**End-of-session checks:** The migration applies and reverses cleanly on a fresh local database; the allocated number does not collide with any committed or planned migration. `drizzle-kit pull` reflects the new table. The read/confirm/correct endpoints return the standard response shapes through `createRoute` and are correctly user-scoped (a second user cannot read or mutate another user's inference). `pnpm build` and `pnpm lint` clean.

### Chat 108a — Notebook Visual Card Surface

*Butler's Notebook · EO 24 · 🔵 🟢 · Skills: frontend-design · 🎩 · Window Y (Fwin F13) · CD-flags: —*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (the Butler's Notebook subsection, including the sample copy and the "That's right." / "Not quite." affordances, and the espresso/cream/bronze visual direction); the design system and primitives from chats 107/107a (the card primitive, the butler-line component, the motion bands); `docs/DESIGN_STRATEGY.md` from chat 106; the butler voice gate (caveman + stop-slop) from chat 017 for the user-facing copy.

**Goal:** Build the notebook's visual card surface on the design track: a single card in the espresso/cream/bronze system that states one inference in butler voice and offers a confirm and a correct affordance, with no list accumulation and no insights-dashboard chrome. The card is built static/mocked in the window, composing the 107/107a primitives; wiring it to the 108 API is deferred to the build track after the design track leaves.

**Output:**
- The notebook card component in `apps/web` and `apps/mobile`, composed from the 107 card primitive and the 107a butler-line component, rendering one inference in the espresso/cream/bronze system with the confirm ("That's right.") and correct ("Not quite.") affordances
- The mocked inference content for the static pass (e.g. the Layer 4 sample copy "I've noticed you move workouts to the evening. I'll plan them there, unless you'd rather I didn't."), clearly marked as mock data to be replaced when wired to 108
- The surface placement so the card can mount either on the plan view or in the Vesper hour, per Layer 4, rather than as its own destination
- Motion: the card entrance and the confirm/correct interaction using the 107a motion primitives in the Considered/Quick bands with the reduced-motion fallback

**Implementation notes:** This is a `-V`-style design-locked, wiring-deferred surface: the visual output is durable, but the confirm/correct actions are mocked here and must be rewired to the chat 108 read/confirm/correct endpoints on the build track before the surface is "done." The 🎩 voice-gate flag is set because the card renders user-facing butler copy — the inference line and the affordance labels pass through the caveman regex layer and, where length warrants, the Haiku review layer from chat 017. The card must hold to the Layer 4 framing: one inference, confirm-or-correct, no accumulation, no dashboard, leading with what the product noticed in service of the user. As the alternate pressure valve named in the design-cluster-window note, 108a (Fwin F13) can be dropped to bring the window to 14 chats if 044-V cannot be dropped for any reason; its function survives later composition from the 107/107a primitives during its wiring half.

**Dependencies:** Chats 107 and 107a (design system and primitives); chat 106 (design strategy); chat 017 (voice gate) for the copy. Its wiring depends on chat 108 (notebook API), reached earlier in execution order at EO 12.

**End-of-session checks:** The card renders in both packages from the shared primitives with no token re-derivation, in the espresso/cream/bronze system, showing one mocked inference with both affordances. All rendered copy has passed the voice gate. Motion honors the reduced-motion fallback. The mock data boundary is explicit so the wiring half knows exactly what to replace. `pnpm build` / `pnpm lint` clean.

---

## Pre-Build Setup — Block 0

Block 0 establishes the foundations every subsequent chat depends on. Skipping any of its three chats forces improvisation under pressure later in the build. All three are carried over as completed foundation work; see the Carry-Over Note at the top of this part for why their meta lines record no master-sequence EO and the build-track default model.

### Chat 001 — Architectural Decisions and External Account Setup

*Block 0 · EO — (built foundation; not in master sequence) · 🟡 · Skills: context-engineering-kit, caveman · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md (full file, focus on §2 Stack, §3 Conventions, §10 Hosting, §13 Operations); ENVIRONMENT_SETUP.md; LAYER_3_TECHNICAL_ARCHITECTURE.md.

**Goal:** Make every architectural decision that has been implicit until now, document each decision with its rationale and consequences, and submit the time-lagged external applications (Apple Developer, Stripe identity verification) that have multi-day approval windows. The deliverable is a committed `docs/ARCHITECTURE_DECISIONS.md` file and a checklist of externally-submitted items with their expected approval dates.

**Output:**
- `docs/ARCHITECTURE_DECISIONS.md` — covering each of the twenty-two architectural decisions enumerated in the implementation notes below
- Apple Developer Program enrollment submitted ($99), enrolled as an individual (not organizational; V1 entity is sole proprietorship with DBA per LAYER_5; organizational enrollment requires LLC, which is deferred)
- Stripe identity verification application submitted
- Expo account created and `eas init` run from `apps/mobile/`
- RapidAPI account created (for ExerciseDB seeding access at Block 7)
- Confirmation that an iPhone 14 Pro or later is available for Live Activity testing (required from Chat 105)
- Confirmation that a non-Dynamic-Island iOS device (iPhone 14 or earlier) is available for fallback APNs push verification in Chat 105

**Implementation notes:** The twenty-two decisions to document and lock are as follows. First, migration generation pattern: hand-written SQL files in `packages/db/migrations/` per Tech Spec, with corresponding `.down.sql` files; no `drizzle-kit generate`. Second, Supabase CLI migrations path: configure `supabase/config.toml` to read from `packages/db/migrations/` rather than the default. Third, API runtime per route: Node runtime for any route that touches the Stripe SDK or the Anthropic SDK with extended-output operations; Edge runtime for everything else; document exceptions per route. Fourth, Supabase connection pooling: use Supavisor in transaction mode (the `pgbouncer://` connection string) from all serverless contexts; direct connections only from local development. Fifth, Zustand persistence per slice: auth slice persisted to expo-secure-store on mobile and httpOnly cookie on web; plan slice not persisted (always refetched); ui slice not persisted. Sixth, TanStack Query persistence: persist `['plan', planDate]` queries on mobile via AsyncStorage; web defaults are fine. Seventh, Sentry sampling rate: 0% in development, 100% in preview, 100% in production initially with scale-down trigger at 4,000 errors per month. Eighth, PostHog autocapture: off; the explicit event taxonomy from Tech Spec §11 (the original eighteen events plus the observability events added by the Phase 4 audit, enumerated authoritatively in Chat 096) is the source of truth. Ninth, React Native New Architecture: enabled per Expo SDK 52 default; verify Reanimated, Realtime, and Live Activities all work under Fabric before chat 037. Tenth, versioning convention: semver application version plus monotonic build number; both incremented manually on tag push. Eleventh, cookie consent strategy: no banner at V1 (US-only); decision documented for future jurisdictions. Twelfth, service-role-with-user-filter pattern: a typed query-builder convention in `@vesper/db` where every exported query function takes `userId: string` as its required first parameter and emits the filter through Drizzle's typed `eq(table.userId, userId)` API; a `UserScopedQuery<T>` TypeScript generic enforces at compile time that no query function can be exported from the queries barrel without consuming `userId`. Application code never constructs queries inline against the service-role client — it only calls these exported functions. This prevents the most common Supabase mistake (forgetting the user_id filter on a service-role query). The runtime SQL-string inspection approach is rejected because it produced false negatives on parameterized queries; the typed approach makes the safety property visible to TypeScript at every callsite. Thirteenth, CSP allowlist scope: production CSP omits `'unsafe-eval'` from `script-src`; Three.js shaders are precompiled at build time via `vite-plugin-glsl` so no runtime `eval` is needed; the CSP allowlist enumerates only Sentry, PostHog, Stripe Checkout, and Resend tracking origins (no shader-related entries). Fourteenth, API rate limiter implementation: Upstash Redis on the free tier (500,000 commands per month per Upstash's March 2025 pricing update; ~16K/day average) plus 256 MB storage and 200 GB bandwidth, chosen over Cloudflare KV for strong consistency on `plans/generate` token-bucket logic. Fifteenth, built-in calendar library: defer to chat 052 evaluation, but note that FullCalendar Standard is the leading candidate for web. Sixteenth, webhook signature verification pattern: always use `request.text()` then `JSON.parse()`; never use a JSON middleware before signature verification. Seventeenth, Apple JWS public key cache TTL: one hour, refresh on signature verification failure. Eighteenth, Realtime websocket lifecycle on mobile: suspend on `applicationDidEnterBackground`, resume on `applicationWillEnterForeground`. Nineteenth, GCal push channel renewal cadence: renew at less-than-24-hours remaining; channels max at seven days per Google's policy. Twentieth, cron consolidation pattern: scheduled workers are deployed as one multiplexed Cloudflare Worker — `daily-cron` (dispatches by hour-of-UTC to trial-reminder, dunning-check, hard-delete, reconciliation, bill-reminder, gcal-channel-renewal, spend-monitor); live-activity-pusher remains its own worker (tight CPU budget and 5-minute cron cadence); apple-pki-monitor remains its own worker (weekly schedule does not compose with daily-cron's hourly dispatch model). The Cloudflare Workers paid-tier cron-trigger budget is 250 per account; the three workers (daily-cron, live-activity-pusher, apple-pki-monitor) together consume well under that ceiling. Note: Cloudflare Workers Paid is required from day one of cron deployment per the SCALING_THRESHOLDS update in chat 003; free-tier cron is unusable for production work due to its 10ms CPU limit per cron trigger. Twenty-first, hydration data shape: hydration writes go to a new event-style `hydration_log` table (one row per glass logged, like completion_log); mutations do NOT bump `user_profiles.base_profile_version`; the daily counter is derived via a count query against `start_of_local_day(user.timezone)`. Twenty-second, optional mid-trial payment-method capture: on trial day 5, surface an opt-in payment-method capture UI (Stripe Setup Intent on web, Apple Pay token on iOS); the day-6 one-tap pay surface fires only for users who captured; users who did not capture see the regular trial-end Checkout/StoreKit flow.

The external account submissions are urgent because of approval lag. Apple Developer enrollment review can take a full week. Stripe identity verification typically takes one to three business days. Both must be in flight by the end of this session so they are active by the time the Cutover Block begins.

**Dependencies:** None. This is the first chat of the entire phase (in the original build order; it predates the re-plan's execution sequence).

**End-of-session checks:** `docs/ARCHITECTURE_DECISIONS.md` exists and is comprehensive. Apple Developer enrollment confirmation email received (or screenshot of submission). Stripe identity verification screen reached. EAS project ID present in `apps/mobile/app.config.js`. RapidAPI dashboard accessible. Hardware confirmation noted.

### Chat 002 — Test Infrastructure and CI/CD Pipeline

*Block 0 · EO — (built foundation; not in master sequence) · 🟡 · Skills: superpowers · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §13 Operations; ENVIRONMENT_SETUP.md; `package.json` files in `apps/web`, `apps/mobile`, `packages/shared`, `packages/ai`, `packages/db`.

**Goal:** Install and configure the test framework across all packages so that unit tests, contract tests, and end-to-end tests are runnable from a single root command. Build the GitHub Actions workflows that gate pull requests against the test suite, deploy source maps to Sentry on merge, and trigger EAS mobile builds on tag push. Enable branch protection on `main` so that no chat thereafter can merge without these gates passing.

**Output:**
- `vitest.config.ts` at root with workspace configuration
- Per-package `vitest.config.ts` files for `@vesper/web`, `@vesper/mobile`, `@vesper/ai`, `@vesper/db`, `@vesper/shared`
- Playwright configuration in `apps/web/playwright.config.ts` (Playwright is already installed per ENV_SETUP)
- Test database setup script in `packages/db/scripts/setup-test-db.ts` that creates an isolated test schema in the local Supabase instance
- Factory functions for test data (users, plans, blocks, tasks) in `packages/db/src/test/factories.ts`
- `.github/workflows/pr-check.yml` — runs `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm test`, and `pnpm playwright test` on every pull request
- `.github/workflows/sentry-release.yml` — uploads source maps and tags a release on every push to main
- `.github/workflows/mobile-build.yml` — triggers `eas build` on git tag push matching `mobile-v*`
- Branch protection rules configured on `main` requiring all status checks to pass

**Implementation notes:** Vitest is chosen over Jest because it handles ES modules without ceremony and integrates cleanly with TypeScript path aliases. The workspace configuration at the root delegates to per-package configs, allowing `pnpm test` from any directory. The test database pattern uses Supabase's CLI to spawn an isolated local instance per CI run; this keeps tests deterministic and parallelizable. The factory functions take an optional override object so that tests can construct edge cases without rewriting setup. The PR check workflow must be fast: caching `pnpm store`, `node_modules`, and `~/.cache/playwright/browsers` is essential, otherwise PR review latency makes the gate annoying enough to bypass. The Sentry release workflow tags releases with the git SHA and uploads source maps for `apps/web`, `apps/mobile`, and `workers/` so that stack traces in production are symbolicated. The EAS workflow does not auto-submit to TestFlight; it produces a build that the founder manually promotes via `eas submit`.

**Dependencies:** Chat 001 (Expo account exists, RapidAPI key not needed here but documented).

**End-of-session checks:** `pnpm test` from root runs and passes (even with zero tests). `pnpm playwright test` runs and passes. A trivial pull request opened against main triggers all three workflows and they pass. Branch protection on main requires the pr-check workflow status before merge.

### Chat 003 — Documentation Scaffolding

*Block 0 · EO — (built foundation; not in master sequence) · 🟡 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PROJECT_OVERVIEW.md; ENVIRONMENT_SETUP.md; TECHNICAL_SPEC.md (sections 2 and 10 specifically).

**Goal:** Author the repository's top-level documentation surface so that the project is navigable by a hypothetical future contributor (or by the founder returning after a long break). This is not feature work; it is permanent project context that every subsequent chat can reference.

**Output:**
- `README.md` at repository root — project overview, two-paragraph what-and-why, link to TECHNICAL_SPEC.md as the implementation contract, link to PRD.md as the product contract, local-development quickstart with the same content as ENV_SETUP's verification commands
- `CONTRIBUTING.md` — workflow conventions including the rule that every chat ends with `pnpm build && pnpm lint`, the migration discipline rule (never edit a committed migration; always forward), and the env var discipline rule (every new env var updates `.env.example`)
- `docs/ARCHITECTURE.md` — a Mermaid diagram showing Next.js + Expo + Supabase + Cloudflare Workers + Stripe + Anthropic + Resend + Sentry + PostHog with the request flow for a daily plan generation traced through the diagram
- `docs/RUNBOOKS/README.md` — index file listing all runbooks authored across the build. The current set of indexed runbooks and the chats responsible for delivering each:
  - `PGSODIUM_KEY_ROTATION.md` (chat 063) — key rotation procedure for the pgsodium-encrypted columns in the `integrations` table.
  - `STRIPE_CUTOVER.md` (chat 083) — Stripe test-to-live key swap and Stripe Tax onboarding prerequisites (Stripe Tax onboarding is a hard prerequisite to the first paid Checkout session per I-083-b).
  - `HARD_DELETE_RECOVERY.md` (chat 073) — what to do if a hard-delete is run incorrectly; documents the irreversibility boundary and audit-trail expectations. (The cascade-verification artifact is the CI script `workers/daily-cron/scripts/verify-hard-delete-cascade.ts`, not the runbook.)
  - `GCAL_CHANNEL_RENEWAL.md` (chat 066, delivered per I-066-a) — operational runbook for silent multi-day worker failure detection and manual channel re-registration.
  - `APNS_KEY_ROTATION.md` (chat 076, delivered per I-076-a) — zero-downtime rotation procedure for the APNs .p8 signing key including the emergency-rotation variant for compromised-key response.
  - `APPLE_ROOT_CA_ROTATION.md` (chat 086) — procedure to add a new pinned Apple Root CA when Apple rotates its PKI; the action procedure consumed by the apple-pki-monitor alert handler.
  - `APPLE_PKI_MONITOR.md` (chat 086a, delivered per I-086a-b) — alert-handler runbook describing what to do when the apple-pki-monitor Sentry alert fires; refers to `APPLE_ROOT_CA_ROTATION.md` as the action procedure.
  - `IOS_ALARM_REBUILD.md` (chat 059b) — rebuild procedure for the iOS alarm Notification Service Extension.
  - `IOS_WIDGET_REBUILD.md` (chat 077) — rebuild procedure for the SwiftUI Live Activity widget extension.
  - `ALERTING.md` (chat 097a) — on-call runbook covering alert severity matrix, escalation, and acknowledgment workflow for every operational alert wired in Chat 097a (Anthropic spend, Sentry error volume, Cloudflare worker health, Supabase Realtime, Stripe webhook delivery, Apple ASSN, plus the apple-pki-monitor alert handler).
  - Plus the operational drill runbooks: backup-restore drill, incident response, and log retention.
- `docs/RUNBOOKS/INCIDENT_RESPONSE.md` — incident-response skeleton with sections for API 500-storm, database connection saturation, Anthropic spend spike, payment provider outage, Realtime websocket flood. Each section names the detection signal, immediate action steps, escalation contact (founder for V1), and a post-incident review template.
- `docs/RUNBOOKS/BACKUP_RESTORE_DRILL.md` — quarterly procedure for restoring Supabase PITR snapshot to staging, verifying row counts match production, verifying a representative user's data round-trips correctly. First drill scheduled for Phase 5.
- `docs/MIGRATION_DISCIPLINE.md` — full prose explanation of why migrations are forward-only in production, why `.down.sql` exists for local resets only, and why post-launch schema changes use the add-nullable-then-backfill pattern.
- `docs/MIGRATION_NUMBER_ALLOCATION.md` — reserves numeric ranges so that out-of-order chats do not collide on migration numbers. "Number" refers to the numeric suffix after the date prefix in filenames like `20260601000005_templates.sql` (here, `5`). Numbers may carry a single letter suffix (e.g., `4a`) for small helper migrations that fit between integer slots without claiming a full slot (used by Chat 004 for the `start_of_local_day` helper function). Allocation: numbers 1 through 13 (with letter suffixes permitted) are Block 1 foundation (assigned in chats 004 and 005); 14 through 30 are reserved for Blocks 4 through 7 incremental schema additions (chats that need a new column or table during those blocks pick the next number in this range); 31 through 50 are reserved for Blocks 8 through 11 additions; 100001 through 199999 are reserved for seed migrations (chat 048); 200001 and above are reserved for post-launch migrations. Every chat that adds a migration cites this document and picks the next available number in the assigned range.
- `docs/RETENTION_POLICY.md` — documents V1 acceptance that `completion_log` and `security_audit_log` tables grow unbounded for the first 12 months, with a planned V1.5 retention worker that rolls up `completion_log` to daily aggregates after 90 days and retains `security_audit_log` medication-module rows for 7 years (HIPAA-aligned even though the product is not HIPAA-covered at V1) and other audit rows for 1 year.
- `docs/SCALING_THRESHOLDS.md` — documents the upgrade triggers across infrastructure providers: Supabase free-to-Pro tier at approximately 500 active users or when 500MB database / 1GB file storage / 5GB uncached egress limits begin to bite (per Layer 3 and verified May 2026 against Supabase's current free-tier limits), Supabase Realtime free-to-paid upgrade at 75 dual-device users (≈150 concurrent channels, 75% of the free-tier 200 ceiling), Vercel Pro tier bandwidth (1TB/month) and function invocation (1M/day) ceilings — active from Phase 4 build start, no upgrade step required, Cloudflare Workers Paid ($5/month) required from day one of cron deployment because Free-tier cron is unusable for production work (10 ms CPU limit per cron trigger). Also: Free tier caps at 5 cron triggers per account (Paid: 250). The cron consolidation pattern from Chat 001 Decision 20 stays well within these limits. Free-tier 100K-requests-per-day cap is informational only — Workers Paid is required for cron-CPU reasons before request volume becomes relevant. Resend free tier 3,000 emails/month AND 100/day cap (the daily cap may bind earlier than the monthly during traffic bursts); upgrade trigger at 2,500/month sustained OR any single day exceeding 80 sends (80% of the 100/day cap), Stripe API rate limits (100 read / 100 write per second per account; alert if any worker exceeds 50% sustained), and Anthropic spend ceiling (per the formula in chat 097a: max($5/day floor, $1.20/user/month × (active+trial users) / 30); alert at 80%, action at 100%, panic at 200%). Each threshold names the migration steps and the PostHog or Sentry signal that fires the alert.
- `docs/ENV_VAR_DISCIPLINE.md` — explains the `.env.example` source-of-truth pattern and the convention that `NEXT_PUBLIC_*` keys are client-bundled and never sensitive.

**Implementation notes:** The README is the front door; keep it short and link-heavy rather than comprehensive. The Mermaid architecture diagram should fit on one screen and trace one specific user action end-to-end; the morning plan generation is the canonical example because it touches the most services. The runbook index forces runbook authoring in the chats that require them. The migration number allocation document is the single source of truth for any chat that needs to add a migration; chats consult it before picking a number to avoid collisions when sequencing changes.

**Dependencies:** Chat 001 (architecture decisions documented; this chat references them).

**End-of-session checks:** All five documents render correctly in GitHub's markdown view. The Mermaid diagram renders. README links resolve.

---

## Block 1 — Database Foundation

Block 1 produces the seventeen-table V1 schema, runs the first real `supabase db push`, syncs Drizzle types, authors the Zod schemas for JSONB columns, and verifies Row Level Security on every table. Nothing else in the project compiles correctly until Block 1 is complete because the Drizzle types it emits are imported by every API route, every UI component that displays user data, and every test. Chats 004–007 are carried over as completed foundation work (see the Carry-Over Note above); chat 111 is new and inserted here by the re-plan as the single early migration-verification checkpoint and the consolidation point for the Stage 1 schema/Zod staleness findings.

### Chat 004 — Migrations Part 1: Foundation Tables

*Block 1 · EO — (built foundation; not in master sequence) · 🗄️ 🟡 · Skills: drizzle-best-practices · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §3 (full Database Schema section); the `packages/db/migrations/` directory (currently empty per ENV_SETUP); `docs/ARCHITECTURE_DECISIONS.md` (migration generation pattern decision).

**Goal:** Author the first four migration files in the sequence defined by Tech Spec §3 Migration Sequence: enums and extensions, users with the `handle_new_user()` trigger function, user_profiles with the trigger extension, and the four coupled daily-planning tables (daily_plans, blocks, tasks, weekly_priorities). Each migration is hand-written SQL wrapped in BEGIN and COMMIT, with a corresponding `.down.sql` file that reverses the operations.

**Output:**
- `packages/db/migrations/20260601000001_enums_and_extensions.sql` and `.down.sql` — enables `pgsodium` and `pgcrypto` extensions; creates all twenty-four enum types listed in Tech Spec §3
- `packages/db/migrations/20260601000002_users.sql` and `.down.sql` — creates the users table with every column from the Tech Spec audit (including `referral_code varchar(6) UNIQUE` (auto-minted by the `transitionToActive` logic in chat 081 on first paid conversion), `onboarding_completed_at`, `referred_by_user_id`, `deletion_requested_at`, all subscription columns referenced in API contracts, plus `last_warmed_at timestamptz` used by the wake-alarm-triggered cache warm path from chat 071, plus `biometric_lock_enabled boolean DEFAULT false` for the optional mobile biometric lock setting from chat 090b); the bedtime and wake-time columns (`sleep_target_bedtime`, `sleep_target_wake`) are declared as `time` (HH:MM, no date) rather than `timestamptz` so daylight-saving transitions do not silently shift the user's stored target; the absolute timestamp is computed per-day at read time from the local time string plus `users.timezone`; creates indexes; enables RLS with standard own-row policies for SELECT and UPDATE on permitted columns only; creates the `handle_new_user()` trigger function with `SECURITY DEFINER`
- `packages/db/migrations/20260601000003_user_profiles.sql` and `.down.sql` — creates the user_profiles table; extends the `handle_new_user()` trigger to also create the matching user_profiles row in the same transaction
- `packages/db/migrations/20260601000004_daily_planning.sql` and `.down.sql` — creates daily_plans, blocks, tasks, and weekly_priorities; the blocks table includes a `client_mutation_id uuid` column plus the constraint `UNIQUE (user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL` (so the same mutation id retried by an offline-queue flush is idempotent rather than producing duplicate rows) used by the Realtime self-mutation filter in chat 037 (every mutation API route writes the inbound client mutation id into this column, the Realtime broadcast carries it, and the originating device drops the broadcast against its own recent-mutation set); the blocks migration also sets `ALTER TABLE blocks REPLICA IDENTITY FULL;` so Realtime broadcasts deliver the full row payload including unchanged columns to subscribers; creates a trigger on the blocks table that updates `daily_plans.updated_at` whenever any child block row is inserted, updated, or deleted (this is the source of truth for the optimistic-concurrency check in chat 027); creates all indexes from Tech Spec including the partial index `idx_tasks_user_id_deadline` and the unique constraints `(user_id, plan_date)` and `(user_id, week_start_date)`; enables RLS with standard own-row patterns
- `packages/db/migrations/20260601000004a_start_of_local_day.sql` and `.down.sql` — creates the `start_of_local_day(tz text) RETURNS timestamptz` Postgres function that takes an IANA timezone string and returns the timestamptz for the start of the current local day in that zone; called by every per-local-day query (trial regen cap in chat 025, hydration counter in chat 050, trial reminder worker in chat 072, 3-regen prompt in chat 100)

**Implementation notes:** The migrations do not run yet; they run in chat 006. The audit against API contracts in chat 008 means that every column referenced by the Tech Spec §9 endpoint responses must exist on the underlying table. The drizzle-best-practices skill is invoked because hand-writing migrations is error-prone and the skill encodes correct patterns for foreign keys, RLS policies, and check constraints. The `handle_new_user()` trigger function must be created with `SECURITY DEFINER` and have its search_path explicitly set to prevent search-path injection attacks. The BEGIN/COMMIT wrapper ensures that if any single statement in a migration fails, the entire file rolls back rather than leaving the schema half-applied. **Re-plan note:** the universal-wake/bed/location, alarm-opt-in, and notification-prefs concerns Stage 1 raised against this foundation (and the nullability reconsideration on the location columns in `…0002_users.sql`) are consolidated and applied in the new chat 111 rather than retro-edited here; this entry is preserved as the original built artifact.

**Dependencies:** Chat 001 (migration pattern decision), Chat 003 (migration discipline doc).

**End-of-session checks:** All eight files exist with sensible naming. Running each migration's `.sql` against a fresh local database succeeds. Running the corresponding `.down.sql` reverses cleanly. `pnpm lint` passes (linting includes SQL file format checks).

### Chat 005 — Migrations Part 2: Modules, Integrations, Subscriptions, Audit

*Block 1 · EO — (built foundation; not in master sequence) · 🗄️ 🟡 · Skills: drizzle-best-practices · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §3 sections 7 through 20 plus the Migration Sequence list; `packages/db/migrations/` (now containing the four files from chat 004).

**Goal:** Author migrations five through thirteen in the Tech Spec sequence, completing the schema. This chat covers the workout and recipe template tables, the medication/errands/bills module tables, the integrations and push_tokens tables, the subscriptions and subscription_events tables, the waitlist and referral_credits tables, the completion_log table, the security_audit_log table with its two trigger functions, the deleted_user_email_hashes table, and the final generic `set_updated_at()` trigger function applied to every table with an `updated_at` column.

**Output:**
- `20260601000005_templates.sql` and `.down.sql` — workout_templates and recipe_templates with GIN indexes on tag arrays
- `20260601000006_modules.sql` and `.down.sql` — medications (with the strictest RLS verified), recurring_errands, bills
- `20260601000007_integrations.sql` and `.down.sql` — integrations with pgsodium-encrypted token columns (bytea), `status integration_status_enum NOT NULL DEFAULT 'connected'` and `last_error text` columns (the authoritative trigger for the broken-integration banner in chats 064 and 099), push_tokens with the unique constraint on (user_id, device_id)
- `20260601000008_subscriptions.sql` and `.down.sql` — subscriptions with the unique user_id constraint and the CHECK constraints from Tech Spec, subscription_events with the unique (provider, event_id) idempotency constraint
- `20260601000009_waitlist_and_referrals.sql` and `.down.sql`
- `20260601000010_completion_log.sql` and `.down.sql` — with the ON DELETE SET NULL on block_id for log persistence past block deletion
- `20260601000011_security_audit_log.sql` and `.down.sql` — creates the table, the `audit_medications_changes()`, `audit_integrations_changes()`, `audit_bills_changes()`, `audit_subscriptions_changes()`, and `audit_push_tokens_changes()` trigger functions (all with `SECURITY DEFINER` and `STABLE`), and attaches the triggers to the medications, integrations, bills, subscriptions, and push_tokens tables
- `20260601000012_deleted_user_email_hashes.sql` and `.down.sql`
- `20260601000013_updated_at_triggers.sql` and `.down.sql` — the generic `set_updated_at()` function and its attachment to every table with an `updated_at` column
- `20260601000014_hydration_log.sql` and `.down.sql` — creates the `hydration_log` event-style table with `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `logged_at timestamptz NOT NULL DEFAULT now()`, `count integer NOT NULL DEFAULT 1`; index on `(user_id, logged_at DESC)`; RLS own-row policies for SELECT and INSERT; the daily counter in chat 050 derives via `SELECT COUNT(*) FROM hydration_log WHERE user_id = $1 AND logged_at >= start_of_local_day(user.timezone)`
- `20260601000015_email_queue.sql` and `.down.sql` — creates the `email_queue` table with `id uuid PK`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `template_name text NOT NULL`, `scheduled_for timestamptz NOT NULL`, `sent_at timestamptz NULL`, `payload jsonb NOT NULL DEFAULT '{}'::jsonb`; index on `(scheduled_for) WHERE sent_at IS NULL`; consumed by the post-cancel survey email queue (chat 090) and any other deferred Resend send
- `20260601000016_delayed_jobs.sql` and `.down.sql` — creates the `delayed_jobs` table with `id uuid PK`, `job_type text NOT NULL`, `payload jsonb NOT NULL DEFAULT '{}'::jsonb`, `scheduled_for timestamptz NOT NULL`, `processed_at timestamptz NULL`, `attempts integer NOT NULL DEFAULT 0`; index on `(scheduled_for) WHERE processed_at IS NULL`; replaces Upstash QStash for the delayed reconciliation triggers in chats 074, 084, 087, 088 (the daily-cron worker or a dedicated tick worker picks up due rows and dispatches by `job_type`)
- `20260601000017_cancellation_events.sql` and `.down.sql` — creates the `cancellation_events` table with `id uuid PK`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `reason text NOT NULL`, `free_text text NULL`, `archetype text NULL`, `subscription_duration_days integer NULL`, `canceled_at timestamptz NOT NULL DEFAULT now()`; written by chat 090 in addition to the PostHog event so cancellation data is queryable in the application database for post-launch analysis without round-tripping PostHog
- `20260601000018_calendar_events.sql` and `.down.sql` — creates the `calendar_events` table consumed by the built-in calendar in chat 052: `id uuid PK`, `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `title text NOT NULL`, `start_time timestamptz NOT NULL`, `end_time timestamptz NOT NULL`, `rrule text NULL` (RFC 5545 recurrence rule, expanded at read time), `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`; RLS own-row policies; ownership of this migration is in Chat 005 so the schema is in place before chat 052 builds against it

**Implementation notes:** The security_audit_log triggers must run with SECURITY DEFINER so they can write to a table the calling user has no policies to write to directly. The audit triggers fire AFTER INSERT OR UPDATE OR DELETE; for DELETE, the OLD row is captured in `old_values` and `new_values` is NULL; for INSERT, the reverse; for UPDATE, both are populated. The extended audit coverage (bills, subscriptions, push_tokens beyond the original medications and integrations) exists because each of these surfaces carries either financial or security sensitivity: bills hold financial info, subscriptions hold the canonical paid-state, and push_tokens are the delivery target for time-sensitive notifications including medication reminders. The audit_log rows reference `user_id` with `ON DELETE CASCADE` because the V1 retention policy (documented in `docs/RETENTION_POLICY.md` from chat 003) accepts right-to-erasure deleting audit rows along with the user; the product is not HIPAA-covered at V1 so no regulatory retention floor applies, and the cleaner GDPR/CCPA-compatible posture is to wipe everything on hard-delete. The `set_updated_at()` generic trigger is attached only to tables where `updated_at` should be mutated by the database rather than the application; reference tables like workout_templates and recipe_templates do not need it because they are mutation-by-seed-migration only. The pgsodium-encrypted columns in integrations are bytea, not text; the encryption itself happens in API route code in chat 063 using the pgsodium key (the application holds the encryption key, not Postgres). The completion_log table uses a uuid primary key (not bigint), so it is not the same shape as security_audit_log. The new event-style tables (hydration_log, cancellation_events) match the completion_log pattern: append-only, immutable rows, queried by date range; mutations on hydration_log specifically do NOT increment `user_profiles.base_profile_version` because hydration is high-frequency event data, not a profile preference. The delayed_jobs table replaces the prior QStash dependency entirely; the tick worker (or the daily-cron consolidated worker dispatching by `job_type`) polls for due rows, dispatches them, and updates `processed_at`. **Re-plan note:** the medication fire-on-time default question against `…0006_modules.sql` (Stage 1 §5.4) and the two-sided-referral question against `…0009_waitlist_and_referrals.sql` and `…0002_users.sql` (Stage 1 §5.6) are carried forward as CANNOT-DETERMINE flags F2 and F3 and are read at build time inside chat 111, not retro-resolved here.

**Dependencies:** Chat 004 (migrations one through four must exist first because foreign keys reference users and user_profiles).

**End-of-session checks:** All migration files exist with naming conventions correct. Each `.sql` runs cleanly on a fresh database. Each `.down.sql` reverses cleanly. The audit triggers are attached to medications, integrations, bills, subscriptions, and push_tokens — verified via `pg_trigger` lookup; only these five tables have audit triggers and none others. This aligns with the Chat 005 Output line that creates the triggers on all five tables.

### Chat 006 — First `supabase db push` plus Drizzle Sync, Zod Schemas, RLS Audit

*Block 1 · EO — (built foundation; not in master sequence) · 🗄️ 🟡 · Skills: drizzle-best-practices · ⚠️ · Window N · CD-flags: —*

**Load at session start:** All migration files from chats 004 and 005; TECHNICAL_SPEC.md §3 plus the JSONB shape specifications in §3.2 (base_profile and modules_enabled), §3.4 (block.details discriminated union by block_type), §3.6 (weekly_priorities), and §3.18 (completion_log.value discriminated union by event_type); `packages/db/` package root; `packages/shared/` package root.

**Goal:** Run the first real `supabase db push` to deploy all thirteen migrations to the local Supabase instance, then run `drizzle-kit pull` to introspect the resulting schema into TypeScript types in `packages/db/src/schema/`. Then author the Zod schemas for every JSONB column in `packages/shared/src/schemas/jsonb/` so that runtime validation matches the database structure and TypeScript types match Zod types end-to-end. Finally, run a Row Level Security audit against every table to verify the deny-all default plus per-table policies are correct.

**Output:**
- Local Supabase database with all seventeen tables, twenty-four enums, three trigger functions, and one generic trigger function deployed
- `packages/db/src/schema/index.ts` and per-table files generated by `drizzle-kit pull`
- `packages/shared/src/schemas/jsonb/baseProfile.ts` — Zod schema matching the Tech Spec base_profile structure (work_schedule, sleep_preferences, fitness_preferences, location_bound_events, goals, preferences)
- `packages/shared/src/schemas/jsonb/modulesEnabled.ts` — Zod schema with discriminated structures for each of the seven modules
- `packages/shared/src/schemas/jsonb/blockDetails.ts` — Zod discriminated union by `block_type` with branches for work, fitness, nutrition, sleep, errands, medication, finance, focus, commute, custom
- `packages/shared/src/schemas/jsonb/weeklyPriorities.ts` — Zod array schema with text, source, completed_at per item; array length validation between three and five
- `packages/shared/src/schemas/jsonb/completionLogValue.ts` — Zod discriminated union by `event_type` with the appropriate value shape per event
- `packages/db/scripts/test-rls.ts` — a script that connects as the anon role and attempts to SELECT, INSERT, UPDATE, and DELETE every table, verifying that public tables (workout_templates, recipe_templates, waitlist insert) return data and all other tables return zero rows or permission denied
- `packages/db/scripts/audit-schema.ts` — a script that introspects the database and verifies all foreign keys, indexes, and check constraints from Tech Spec §3 are present. Explicit assertions include: `users.referral_code` exists as `varchar(6)` with a `UNIQUE` constraint (referenced by the mint-on-active logic in chat 081), `blocks.client_mutation_id` exists with the partial unique constraint `(user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL` (referenced by chat 037 Realtime self-mutation filter and the offline-queue idempotency in chat 038), `blocks` has `REPLICA IDENTITY FULL` set (verified via `pg_class.relreplident = 'f'`; required so Realtime broadcasts deliver the full row to subscribers in chat 037), `start_of_local_day(text)` Postgres function exists and returns `timestamptz`, audit triggers exist on `bills`, `subscriptions`, and `push_tokens` in addition to `medications` and `integrations` (verified via `pg_trigger` lookup), tables `hydration_log`, `email_queue`, `delayed_jobs`, `cancellation_events`, and `calendar_events` exist with correct RLS own-row policies (specifically verified for Realtime-broadcast tables that RLS gates the broadcast channel, not only the API), the trigger that updates `daily_plans.updated_at` on any child block INSERT/UPDATE/DELETE exists and fires correctly (verified by inserting a test block and asserting the parent row's `updated_at` advanced), `users.last_warmed_at` exists (referenced by chat 071 cache warm dedup), `users.biometric_lock_enabled` exists with a default of false (referenced by chat 090b), `users.sleep_target_bedtime` and `users.sleep_target_wake` are declared as `time` not `timestamptz`, `integrations.status` and `integrations.last_error` columns exist, and `security_audit_log.user_id` foreign key uses `ON DELETE CASCADE`. The script fails the build if any assertion fails.

**Implementation notes:** The `supabase db push` command reads from the directory configured in `supabase/config.toml` (per the chat 001 architecture decision, this is configured to read `packages/db/migrations/`). Before pushing, run `supabase db reset` to ensure a clean state. After pushing, run `drizzle-kit pull` with the connection string pointing at the local database; this generates the TypeScript types automatically from the running schema rather than from the migration files. The Zod schemas must match the TypeScript types exactly; mismatches will surface as runtime validation errors against valid database rows. The RLS audit script is critical because manual RLS verification is error-prone; an automated script that fails CI if any expected policy is missing prevents data leaks. The audit-schema script is the safety net against missing columns mentioned in chat 004's column audit; if any column referenced by Tech Spec §9 API contracts is missing, this is where to catch it and add a migration. **Re-plan note:** the Stage 1 §5.1–5.3 Zod-shape staleness — promoting wake/bed/location to always-present base-profile fields, de-duplicating against the sleep module, adding the alarm-opt-in flag, and adding the notification-prefs / morning-knock shape plus the prewarm key — is consolidated into the new chat 111 against the `baseProfile.ts` / `modulesEnabled.ts` schemas this chat produces, rather than retro-edited into this entry.

**Dependencies:** Chats 004 and 005 (migrations exist), chat 001 (Supabase config path is set).

**End-of-session checks:** `supabase db push` runs to completion with no errors. `drizzle-kit pull` produces complete schema files matching all seventeen tables. All Zod schemas in `packages/shared/src/schemas/jsonb/` exist and pass their own unit tests against representative valid and invalid inputs. `pnpm tsx packages/db/scripts/test-rls.ts` reports zero leaked rows on any private table. `pnpm tsx packages/db/scripts/audit-schema.ts` reports all expected schema elements present. `pnpm build` clean. `pnpm lint` clean.

### Chat 007 — Supabase Connection Pooling and Drizzle Client Pattern

*Block 1 · EO — (built foundation; not in master sequence) · 🟡 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §10 Hosting (Supabase section); `docs/ARCHITECTURE_DECISIONS.md` (connection pooling decision); `packages/db/` package root; Supabase project dashboard for the local instance (note the Supavisor connection string format).

**Goal:** Configure the Drizzle client to use Supavisor in transaction mode for all serverless contexts (Vercel API routes, Cloudflare Workers) and direct connections only for local development scripts. Author the canonical client initialization pattern that every API route and worker imports. Author the service-role-with-user-filter wrapper utility that the architecture decision in chat 001 mandated.

**Output:**
- `packages/db/src/client.ts` — exports `createDrizzleClient()` that takes a connection string parameter (defaulting to environment-driven selection between pooler URL and direct URL based on `process.env.NODE_ENV` and `process.env.RUNTIME`), returns a typed Drizzle client; uses `postgres-js` driver with `prepare: false` for the pooler-compatibility flag that is required in transaction mode
- `packages/db/src/withUserFilter.ts` — exports `withUser<T>(userId: string, query: (db: Database, userId: string) => T)` that takes a service-role Drizzle client and enforces per-user scoping via a typed query-builder pattern: every exported query function in `packages/db/src/queries/*.ts` takes `userId: string` as its required first parameter and emits the `eq(table.userId, userId)` filter through Drizzle's typed API; TypeScript enforces at compile time that no query function can be defined without consuming the parameter (achieved via a `UserScopedQuery<T>` generic that the file's query barrel re-exports). The runtime SQL-string inspection approach is rejected because it produced false negatives on parameterized queries and added per-call overhead; the typed approach makes the enforcement a compile-time concern instead.
- `packages/db/.env.example` updated to include both `SUPABASE_DB_URL` (direct) and `SUPABASE_POOLER_URL` (Supavisor)
- `apps/web/.env.local` and `apps/mobile/.env.local` updated similarly
- `packages/db/CLIENT_PATTERN.md` — full prose documentation of the connection model, when to use direct versus pooler, the wrapper utility's purpose, and an example API route showing correct usage

**Implementation notes:** Supavisor in transaction mode does not support prepared statements, which is why `prepare: false` is required on the postgres-js driver. Without this flag, every query that uses prepared statements (which is most of them with Drizzle's default) will fail with cryptic errors at runtime, not at compile time, and only in serverless environments where pooling is enabled. The withUserFilter wrapper is the architectural enforcement of the service-role pattern; the Supabase service role bypasses RLS entirely, so application code is responsible for per-user filtering. Without enforcement, a developer who forgets the filter clause leaks every user's data. The wrapper relies on a typed query-builder convention rather than runtime SQL inspection: each query function lives in `packages/db/src/queries/*.ts`, takes `userId` as its required first parameter, and emits the filter through Drizzle's typed `eq(table.userId, userId)` API. The compile-time `UserScopedQuery<T>` generic ensures a query cannot be exported from the queries barrel without consuming `userId`. Application code never constructs queries inline against the service-role client; it only calls these exported functions. This eliminates the runtime SQL-parsing overhead, removes the false-negative window on parameterized queries, and makes the safety property visible to TypeScript at every callsite.

**Dependencies:** Chat 006 (Drizzle schema exists).

**End-of-session checks:** A test API route that uses `createDrizzleClient()` with the pooler URL runs successfully against the local database. The `withUserFilter` wrapper throws when given a query that omits the filter, and succeeds when given one that includes it. Documentation is complete and references real code patterns. `pnpm build` clean.

### Chat 111 — Schema/Zod Stale-Fixes + Single Early Migration-Read Checkpoint

*Block 1 · EO 4 · 🗄️ 🟡 · Skills: drizzle-best-practices · — · Window N · CD-flags: F1 R, F2 R, F3 R*

**Load at session start:** PHASE_4_REPLAN_STAGE_1_ANALYSIS.md §5 (the stale-code findings 5.1–5.4 and 5.6); LAYER_2_PRODUCT_SCOPE.md and PRD.md (the universal-wake/bed/location, progressive-module, alarm-opt-in, morning-knock, medication-default, and two-sided-referral directions the fixes must conform to); the built migrations under `packages/db/migrations/` (specifically `…0002_users.sql`, `…0004_daily_planning.sql`, `…0006_modules.sql`, and `…0009_waitlist_and_referrals.sql`); the built Zod schemas `packages/shared/src/schemas/jsonb/baseProfile.ts` and `modulesEnabled.ts` and the `packages/db/src/schema/` types from chat 006; `docs/MIGRATION_NUMBER_ALLOCATION.md` and `docs/MIGRATION_DISCIPLINE.md`.

**Goal:** Apply the schema-and-Zod staleness fixes Stage 1 concentrated in the 004–006 foundation, and serve as the build's single early migration-verification checkpoint — the one place where the three carried-forward CANNOT-DETERMINE migration questions (F1, F2, F3) are read against the actual `.sql` bodies that were not present in the planning copy. Running this early (EO 4) unblocks the downstream chats that consume these shapes (024, 025, 031, 046-W, 060, 095-W) before they are reached, by either confirming the existing schema models the locked direction or producing a forward migration that makes it so.

**Output:**
- Forward changes (Zod and, where required, a new forward migration per migration discipline — never editing a committed migration) implementing Stage 1 §5.1–5.3 against `baseProfile.ts` / `modulesEnabled.ts` and `…0002_users.sql`: promote wake time, bed time, and location to always-present first-class base-profile fields rather than optional, sleep-module-nested preferences; de-duplicate the wake/bed fields against the sleep module so there is one source of truth; reconsider the nullability of the location columns on the users row (the column may stay nullable given the web manual-coordinate fallback, but the Zod contract stops treating wake/bed/location as optional); add an explicit alarm-opt-in flag (§5.2); and add a notification-preferences shape carrying the morning-knock on/off plus the chosen wake time, with the cache prewarm key rekeyed to that wake time rather than to alarm adoption (§5.3)
- **F1 read** against `…0004_daily_planning.sql`: verify the `daily_plans` table can model the Vesper-hour evening draft→approved lifecycle (a draft-vs-approved state and an `approved_at`-style timestamp). If the table cannot represent it, produce the forward migration that adds the state; if it can, record that finding so chats 025 and 046-W consume it without re-reading
- **F2 read** against `…0006_modules.sql`: verify the medications table encodes fire-on-time as the default with an explicit per-medication shift-out-of-quiet-hours opt-in (not a `respect_quiet_hours` default-true that would silently delay doses). If the stale suppression-by-default posture is baked into a column default, correct it forward (§5.4)
- **F3 read** against `…0009_waitlist_and_referrals.sql` and `…0002_users.sql`: verify the `referral_credits` table supports two-sided credits (the referee also gets 50% off the first paid month, mirroring the referrer) and that the users table carries a referral-attribution column stored on the new user's row at signup; if either is absent, produce the forward fix (§5.6)
- Extensions to the chat 006 `audit-schema.ts` assertions covering any new column, default, or state added here, so the checkpoint's results are enforced in CI rather than left as prose

**Implementation notes:** This is the consolidation chat for the Stage 1 schema/Zod staleness cluster and the build's one early migration-read checkpoint; it is placed at EO 4 (after the design cluster, before the AI and API spine) precisely because it is cheap and high-unblock. The three F-flags it reads are the migration/prompt questions Stage 2 could not resolve from the planning copy and explicitly refused to guess; the resolution mechanism is to read the real `.sql` bodies here at build time. **The `Fwin F#` window counter and these `CD-flag F#` tokens share an `F#` shape but are unrelated and must be read field-scoped** — this chat is not a window chat (Window N); its `F1 R, F2 R, F3 R` are the CANNOT-DETERMINE flags it reads, per the Part 1 naming caveat. The Stage-2-review adjustment attaches F1 to this chat as a reader; F1 remains attached to chats 025 and 046-W as downstream consumers of the draft/approved state, so if 111 finds the state missing and adds it, those consumers inherit the corrected shape. All schema changes follow migration discipline: forward-only, never editing a committed migration, using the add-nullable-then-backfill pattern where a column must become non-null on existing rows, and allocating any new migration number from `docs/MIGRATION_NUMBER_ALLOCATION.md` at build time rather than assuming a free slot. The drizzle-best-practices skill is invoked because the work touches migrations and the typed schema.

**Dependencies:** Built migrations and Zod from chats 004–006. Runs early at EO 4; no later-numbered hard dependency, so the Critical Path back-reference caveat does not apply to this chat.

**End-of-session checks:** The base-profile Zod treats wake/bed/location as always-present; the sleep module no longer duplicates wake/bed; the alarm-opt-in flag and the notification-prefs/morning-knock shape exist with the prewarm key rekeyed to wake time. The three F-flag reads are recorded with an explicit determination (confirmed-as-is or fixed-forward) for F1 (daily_plans draft/approved), F2 (medication fire-on-time default), and F3 (two-sided referral + attribution column). Any forward migration applies and reverses cleanly and does not collide with a committed or allocated number. The extended `audit-schema.ts` assertions pass. `pnpm build` and `pnpm lint` clean.

<!-- PHASE_4_BUILD_PLAN.md — Part 3 of 10. Body continues here; conventions, legend, and master table live in Part 1. Concatenate Parts 1→10 (a/b sub-parts in letter order) head-to-tail. -->

---

## Carry-Over Note for Built Foundation Chats (Block 2 and the early Block 3 chats in this part)

Chats 008–020 are carried over from the prior `PHASE_4_BUILD_PLAN.md` as already-completed foundation work, on the same premise the Part 2 carry-over note records: Stage 1 asserts 001–020 built and 021+ unbuilt, corroborated by the committed artifacts but not independently re-verified here. The re-plan's master reordered-sequence table in Part 1 sequences only the not-yet-built and pulled-in work — its first existing build chat is 021 at EO 6 — so chats 008–020 do not appear in that table and carry no execution-order position or model assignment from it.

Consequently, for every carried-over chat in this part that falls in the 008–020 range, the meta line records **EO** as `— (built foundation; not in master sequence)`, exactly as the Part 2 note prescribes; no EO numbers are fabricated for them. Package colors, skill flags, risk flags, and all body content are carried over from the prior plan unchanged except for the reformat into the Part 1 per-chat template. The chats in this part that **do** carry their real master-table values are **021** (EO 6), **023** (EO 7), **022** (EO 27), and the new **112** (EO 5).

**Skill-naming convention used in the reformatted meta lines.** The Part 1 legend names a concrete skill only for the 🗄️ flag (drizzle-best-practices). For the 🎩 flag the legend states that caveman and stop-slop interact through the butler voice gate, so 🎩 chats name **caveman, stop-slop** in the Skills field [doc:PHASE_4_BUILD_PLAN_part1.md]. The 🤖 flag is described as marking AI-layer chats where prompt versioning matters but the legend names **no skill to invoke** for it; the 🤖 emoji is therefore carried in the meta cluster as a flag and is **not** expanded into an invented skill name, so a 🤖-only chat shows `Skills: —`. This is a flag-not-invent decision per the project's verification discipline, not a new convention.

**One carried-forward discrepancy, flagged rather than silently reconciled.** Stage 2 §6 lists F4's consumers as chats 022 and 112 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. The Part 1 master table tags **112** with `F4 R` (EO 5) but leaves **022**'s CD-flags column blank at EO 27 [doc:PHASE_4_BUILD_PLAN_part1.md] — unlike the parallel F1 case, where the consumer 025 carries `F1 C` in its own master row. Because the Part 1 master table is authoritative for every meta line ("every meta-line EO + Model MUST match the File 1 master table"), 022's meta line below shows `CD-flags: —`; the downstream-consumer relationship Stage 2 records is carried in 022's Implementation notes as prose and the master-table-vs-Stage-2 gap is noted there, not patched into the meta line.

---

## Block 2 — Auth, API Foundation, and Shell

Block 2 brings the monorepo from "schema deployed" to "user can sign up, see an authenticated empty plan view on both web and mobile." Authentication works through magic link and Google OAuth. The API has a foundational pattern that every subsequent route follows. The shells boot, gate authentication, and render placeholder screens. Security headers are configured for the web. A build-verification gate locks discipline for all subsequent chats. (Block organization is preserved for readability; actual run order is the EO column of the Part 1 master table, and the 008–020 chats in this block are built foundation outside that table per the carry-over note above.)

### Chat 008 — `@vesper/shared` API Foundation

*Block 2 · EO — (built foundation; not in master sequence) · 🟡 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §9 Conventions (full subsection on error shapes, pagination, date format, authorization); `packages/shared/` package root.

**Goal:** Author the shared utilities that every API route imports: the error codes catalog, the standard response shape types, the auth middleware factory that validates Supabase session tokens, the minimum-app-version header check, the API route template that bundles all of these into a Next.js route handler, and the Sentry capture / request-correlation-ID emission in the route template's error-catching layer (so every unhandled exception in any subsequent API route is automatically reported to Sentry with the request method, path, user ID if authenticated, and a request-correlation-ID that downstream logs can join on). After this chat completes, every subsequent API chat follows the same pattern.

**Output:**
- `packages/shared/src/errors.ts` — exports `ErrorCode` as a const object with every SCREAMING_SNAKE_CASE error code identified across Tech Spec §9 (PLAN_NOT_FOUND, INVALID_REQUEST, UNAUTHORIZED, FORBIDDEN, RATE_LIMITED, READ_ONLY_MODE, OPTIMISTIC_LOCK_FAILURE, INTEGRATION_ERROR, etc.); exports `ApiError` class with code, message, and httpStatus
- `packages/shared/src/api/response.ts` — exports `successResponse<T>(data: T, status?: number)` and `errorResponse(code: ErrorCode, message: string, status: number)` helpers that produce the standard `{ error: { code, message } }` shape
- `packages/shared/src/api/auth.ts` — exports `validateSession(request: Request): Promise<AuthenticatedUser>` that reads the Authorization Bearer token, calls Supabase Auth to verify, returns the user record with derived subscription_status; throws `ApiError` with 401 if invalid
- `packages/shared/src/api/minAppVersion.ts` — exports `checkAppVersion(request: Request): void` that reads the `X-App-Version` header from mobile clients and throws `ApiError` with 426 Upgrade Required if below the constant `MIN_APP_VERSION`; web clients are exempt (no header check)
- `packages/shared/src/api/route.ts` — exports `createRoute<T>(handler: AuthenticatedHandler<T>): NextRouteHandler` that wraps a handler function with session validation, app version check, error catching, and response serialization
- Unit tests for each utility in `packages/shared/src/api/__tests__/`

**Implementation notes:** The error code enum is the source of truth; any new error code added in a subsequent chat must be added here first, then used. CORS posture: Next.js API routes at `/api/v1/*` accept Authorization-Bearer requests without an explicit CORS allowlist (the bearer-auth flow is a simple cross-origin request that does not trigger a preflight under the CORS spec, and no cookies or credentials are read from request headers other than Authorization). The mobile app's bundle origin is therefore acceptable as-is. If a future chat adds cookie-based auth, multipart uploads, or any custom request header beyond `Authorization`, `Content-Type`, or `X-App-Version`, that chat MUST add an explicit CORS allowlist and document the threat model — the silent default is no longer safe in that scenario. The route template factory is the most important deliverable: it removes the need to remember session validation in every route by enforcing it at the wrapper level. The `AuthenticatedUser` type returned from `validateSession` is the same shape used throughout the application; it includes the derived `subscription_status` so downstream code can gate access without an additional query. The app version check is a no-op for web because web is always at the latest deploy; the header check applies only when `X-Vesper-Client: mobile` is set (or when `X-App-Version` is present at all). `MIN_APP_VERSION` is declared as `process.env.MIN_APP_VERSION` (string semver, e.g. `"1.0.3"`) so it can be bumped by changing the Vercel/Cloudflare environment variable without a code deploy; the package exports a `getMinAppVersion()` helper that reads the env var with a fallback to the package-default constant (`"1.0.0"` at initial ship). Bumping the env var forces clients below the new threshold to receive 426 on the next API call, which triggers the Chat 013 update-required modal.

**Dependencies:** Chat 007 (Drizzle client exists; validateSession queries the users table).

**End-of-session checks:** Unit tests for all five files pass. A trivial test API route in `apps/web/app/api/v1/test/route.ts` that uses `createRoute` returns the expected response shape with valid auth and the expected error shape with invalid auth. `pnpm build` clean.

### Chat 009 — API Rate Limiting Middleware

*Block 2 · EO — (built foundation; not in master sequence) · 🟡 🟣 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §9 (Pagination note about Cloudflare-edge rate limiting on the waitlist endpoint and referral endpoint); `docs/ARCHITECTURE_DECISIONS.md` (rate limiter implementation: Upstash Redis).

**Goal:** Implement the rate limiting pattern that protects expensive endpoints from misuse. Two distinct rate-limit surfaces are configured: Cloudflare-edge limiting for unauthenticated public endpoints (waitlist, referral track) where IP-based limiting is appropriate, and Upstash Redis token-bucket limiting for authenticated endpoints where per-user limiting is needed (especially `POST /plans/generate` which burns Anthropic credits).

**Output:**
- Upstash Redis account created on free tier; `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` added to `apps/web/.env.local` and the relevant Cloudflare Worker secrets
- `packages/shared/src/api/rateLimit.ts` — exports `withRateLimit(limiterName: 'plan-generate' | 'ai-command' | ..., key: string)` middleware that takes the user ID as the key, queries Upstash with `@upstash/ratelimit` library, returns the route's response or a 429 ApiError; configurations include `plan-generate` at five-per-hour, `ai-command` at sixty-per-hour
- `apps/web/middleware.ts` updated to apply Cloudflare-style edge rate limiting (which, when running on Vercel Edge, uses the platform's KV-backed rate limit primitives) to `/api/v1/waitlist` at one-hundred-per-IP-per-hour and `/api/v1/referral/track` at two-hundred-per-IP-per-hour
- `packages/shared/RATE_LIMITING.md` — documentation of every rate-limited endpoint with its current limits and the rationale
- Structured logging on every rate-limit trip: when `withRateLimit` returns a 429, the middleware emits a Sentry breadcrumb plus a PostHog event `rate_limit_tripped` carrying `{user_id, endpoint, limiter_name, window_seconds, retry_after_seconds}` (the user_id is the authenticated principal; for edge-tier IP-based limits on unauthenticated endpoints the field is `anonymous_ip_hash`, a SHA-256 of the IP plus a daily-rotating salt to avoid persisting raw IPs). Without this, debugging "why is user X getting 429" or "is anyone hammering /plans/generate" is impossible.

**Implementation notes:** The two-tier approach matches the two-tier nature of the endpoints. Unauthenticated endpoints have no user ID to limit by, so IP-based limits at the edge are appropriate. Authenticated endpoints have a user ID, so per-user limits are appropriate (an authenticated user could otherwise hammer `/plans/generate` and burn unbounded Anthropic credits). The Upstash free tier provides 500,000 commands per month (per Upstash's March 2025 pricing change; the prior 10,000-commands-per-day tier is retired); each rate-limited request is one command, so this comfortably supports thousands of users at typical activity levels (roughly 16,667 commands per day on average). The 429 response includes a `Retry-After` header with the seconds remaining in the bucket. The `plans/generate` route specifically uses a two-path hand-off implemented in chat 025: trial users (subscription_status='trial') go through a per-local-day completion_log count query against `start_of_local_day(user.timezone)`; active subscribers go through the Upstash token bucket configured here. The two paths are mutually exclusive — a single request takes one path based on subscription_status and never composes both — so the Upstash command budget is consumed only by active-subscriber requests, keeping the free-tier comfortable.

**Dependencies:** Chat 008 (the route template integrates with this middleware).

**End-of-session checks:** A test request to a rate-limited endpoint succeeds on the first invocation and returns 429 with `Retry-After` after exceeding the limit. The middleware applies correctly to both authenticated and public endpoints.

### Chat 010 — Web Authentication, Magic Link Email, and Resend Integration

*Block 2 · EO — (built foundation; not in master sequence) · 🎩 🔵 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §4 Authentication; PRD §3.1 (onboarding screen 2 — authentication options); LAYER_4_EXPERIENCE_IDENTITY.md (Onboarding Flow section, Screen 2); `apps/web/app/` directory.

**Goal:** Implement Supabase Auth on web with three live sign-in methods at V1: Google OAuth, Sign in with Apple, and email magic link. Author the React Email template for the magic link, configure Supabase Auth to route transactional email through Resend's SMTP relay so deliverability matches production from day one, and configure the OAuth callback route with allowlist enforcement to prevent open-redirect attacks. All three methods feed the same Supabase Auth identity and are surfaced as equal-weight options on the sign-in screen because App Store Review guideline 4.8 mandates Sign in with Apple whenever any other third-party social login is offered.

**Output:**
- `apps/web/app/(auth)/sign-in/page.tsx` — the sign-in page with three stacked options (Google, Apple, email magic link), all live
- `apps/web/app/auth/callback/route.ts` — the OAuth callback handler that exchanges the OAuth code for a Supabase session for both Google and Apple flows; validates the `next` redirect parameter against an allowlist of internal paths to prevent open-redirect attacks
- `apps/web/lib/auth/apple-sign-in.ts` — the Apple Sign in flow using the Services ID provisioned in Cutover step C-09; redirects to Apple's authorization endpoint, handles the form-post return, and forwards to the Supabase OAuth callback
- `packages/shared/emails/MagicLinkEmail.tsx` — the React Email template; voice-gated copy with a single short paragraph and a prominent CTA button styled with the Layer 4 design tokens (cream on espresso, bronze accent on the button)
- `apps/web/app/api/v1/auth/magic-link/route.ts` — the API route that triggers magic link sending via Supabase Auth
- `apps/web/lib/supabase/server.ts` and `apps/web/lib/supabase/client.ts` — the Supabase client factories for server-side and client-side use following the Supabase App Router patterns
- Supabase Dashboard configuration step (documented in the chat output as a manual checklist): configure Supabase Auth → SMTP settings to relay through Resend using the `RESEND_API_KEY` credentials and the `noreply@vesper.day` sender; configure Apple OAuth provider in Supabase Auth → Providers using the Services ID and private key from C-09

**Implementation notes:** Without the Supabase-to-Resend SMTP relay configuration, magic links go through Supabase's built-in email service, which has a three-per-hour per-project rate limit and a generic template that breaks the butler-voice posture. Configuring SMTP relay through Resend at first ship means dev and production behavior are identical and the rate limit ceiling matches Resend's plan. The OAuth callback redirect allowlist is non-obvious but critical. Without it, an attacker constructs a URL like `https://vesper.day/auth/callback?next=https://evil.com` and any authenticated user who clicks the link is redirected to the attacker's site with their session token in the URL fragment, allowing token theft. The allowlist uses a proper URL parser, not a character-prefix check: the `next` parameter is fed to `new URL(next, request.url)`; the parsed URL's `origin` must exactly match the request's origin, otherwise it is rejected. A character-prefix check ("starts with `/` but not `//`") is insufficient because it misses backslash variants (`/\evil.com`), Unicode line separators (`/​evil.com` with U+2028), URL-encoded variants (`%2F%2Fevil.com`), and other parser-confusion payloads that browsers resolve as external origins. Threat model documented inline: any value that the platform's URL constructor resolves to a non-same-origin destination is treated as hostile and produces a redirect to the default `/dashboard`. The magic link email goes through the voice gate at copy authoring time; the regex layer strips em-dashes and exclamation points, and the Haiku review layer is invoked for the body text since it exceeds thirty words. Sign in with Apple on web is a redirect flow (not the native iOS dialog); the user is taken to Apple's authorization page, signs in, and is form-posted back to the callback. The first-time Apple sign-in returns the user's email and (optionally) name only once; the callback persists these into the Supabase user record on initial creation.

Auth-event audit logging: every auth flow path writes a row to `security_audit_log` (table owned by Chat 005) with event_type in the set {magic_link_requested, magic_link_request_failed, magic_link_clicked, magic_link_clicked_invalid_or_expired, oauth_callback_success, oauth_callback_rejected_open_redirect, oauth_callback_provider_error, apple_signin_success, apple_signin_failed}, plus user_id (if known), ip_address (hashed), user_agent (truncated), and an event-specific JSONB detail. The open-redirect rejection event in particular is the canary for any future exploit attempt; logging it explicitly enables a Sentry alert (Chat 097a) when the rejection rate spikes.

**Dependencies:** Chat 008 (API route template), chat 017 (voice gate must exist and pass tests before this chat ships user-facing email copy), Cutover step C-09 (Apple Services ID and private key provisioned), Cutover step C-22 (Resend domain authentication completed for production sender). For the development environment, the Resend sandbox sender from ENV_SETUP suffices and C-22 dependency applies only to production deploys.

**End-of-session checks:** A user can sign up via Google OAuth in development. A user can sign up via Apple Sign in in development. A user can request a magic link, receive it through the Resend relay (not Supabase's default sender), click the link, and arrive authenticated at the dashboard. The OAuth callback rejects any `next` parameter that is not an allowed path. All three buttons render with consistent Layer 4 styling.

### Chat 011 — Mobile Authentication, EAS, Deep Links, and Secure Storage

*Block 2 · EO — (built foundation; not in master sequence) · 🟢 · Skills: — · ⇄ 010 · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §4 Authentication; PRD §3.1 (onboarding screen 2); LAYER_4_EXPERIENCE_IDENTITY.md (Screen 2); `apps/mobile/` directory; `apps/mobile/app.config.js`.

**Goal:** Implement Supabase Auth on mobile with three live sign-in methods at V1: Google OAuth via `expo-auth-session`, native Sign in with Apple via `expo-apple-authentication`, and email magic link. Configure the deep link scheme `vesper://` for development OAuth callbacks. Prepare the Universal Links configuration (the `apple-app-site-association` file) for the eventual production cutover; this chat does not deploy the file but creates the source of truth for it. Store the Supabase session token in `expo-secure-store` and wire the Zustand auth slice to persist through it. Native Sign in with Apple is the recommended provider on iOS because it uses the system dialog (no browser bounce), and App Store Review guideline 4.8 requires it to be offered when any other social login is offered.

**Output:**
- `apps/mobile/app/(auth)/sign-in.tsx` — sign-in screen with three options, all live; Apple Sign in renders the native system button per Apple HIG
- `apps/mobile/lib/auth/google-oauth.ts` — Google OAuth flow using expo-auth-session with the deep link scheme `vesper://auth/callback` for development; production callback URL (`https://vesper.day/auth/callback`) declared in the config for switching at Cutover
- `apps/mobile/lib/auth/apple-sign-in.ts` — native Apple Sign in flow using `expo-apple-authentication`; on first sign-in, captures the `fullName` and `email` returned by Apple (only returned on first auth) and forwards both with the identity token to Supabase Auth's Apple provider; subsequent sign-ins forward only the identity token
- `apps/mobile/lib/auth/magic-link.ts` — magic link request flow that opens the email client via Linking API; the magic link in the email opens back into the app via the deep link
- `apps/mobile/lib/auth/secureStorage.ts` — wrapper around expo-secure-store with namespaced keys for session token and refresh token
- `apps/mobile/store/auth.ts` — the Zustand auth slice that loads session from secure storage on app start, persists changes back to secure storage, and exposes `signIn`, `signOut`, `currentUser`
- `apps/mobile/app.config.js` updated with the URL scheme `vesper`, the iOS bundle identifier `com.vesper.app`, the deployment target `iOS 17.2` (raised from 16.1 per H-10 decision; enables Live Activity Push Start without a degraded-fallback code path; 91.5% of iOS devices support 17.2+ as of April 2026 per iOScompatibility.com, sufficient coverage for indie launch), the `expo-apple-authentication` plugin entry, and the `usesAppleSignIn: true` capability flag
- `apps/web/public/.well-known/apple-app-site-association.template.json` — the AASA template that will be hosted at the production domain at Cutover step C-23; the team ID and bundle ID placeholders will be replaced at Cutover
- App icon assets in `apps/mobile/assets/` (multi-size from the Layer 4 brand assets)
- Splash screen configuration in `app.config.js` referencing the cream-on-espresso splash design

**Implementation notes:** The deep link scheme is a workaround for development; in production, Universal Links (which require the AASA file hosted at the verified domain) provide a smoother UX because the OS opens the app without an intermediate "Open in Vesper?" prompt. The AASA file pre-authoring means that the only remaining work at Cutover is to host the file at the right path; the content is already correct. Secure storage on iOS uses the Keychain, which is encrypted at rest and survives app reinstalls (with a configurable accessibility option; the default `whenUnlocked` is appropriate for auth tokens). The Zustand auth slice hydrates from secure storage during the initial render, so the first frame may show a loading state; the auth gate in chat 013 reads from this slice and decides whether to render the auth flow or the main app. The native Apple Sign in dialog is materially better UX than the web redirect (no browser launch, biometric confirmation, no password entry), which is why iOS uses native and web uses the redirect flow. Apple returns the user's email and name only on the first authentication; the implementation must persist these to Supabase immediately because Apple will not return them again, and the `fullName` object can be null on subsequent sessions if the user revoked the data sharing.

Auth-event audit logging on mobile: every flow path (Google OAuth start, Google OAuth callback, native Apple Sign in start, native Apple Sign in callback, magic link request, magic link deep-link return, session restore from secure storage, sign-out) calls the internal auth-event endpoint (added in Chat 030's `onAuthStateChange`) which writes to `security_audit_log` with the same event_type taxonomy as Chat 010 plus mobile-specific variants {oauth_native_apple_signin_success, oauth_native_apple_signin_user_canceled, deep_link_callback_received, deep_link_callback_invalid, session_restored_from_secure_storage, secure_storage_read_failed}.

**Dependencies:** Chat 008 (auth middleware on web validates these tokens), chat 003 (architecture decisions doc includes the secure storage choice), Cutover step C-09 (Apple Sign in capability provisioned in the App ID). Parallel with chat 010.

**End-of-session checks:** A user can sign in via Google OAuth in the iOS Simulator. The session token persists across app cold starts (verified by killing and reopening the app). The AASA template renders correctly when manually inserting the team ID. The app icon and splash screen display correctly.

### Chat 012 — Web Shell with TanStack Query, Zustand, and Sentry

*Block 2 · EO — (built foundation; not in master sequence) · 🔵 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §2 Stack and §10 Hosting (Vercel section); `docs/ARCHITECTURE_DECISIONS.md` (Zustand persistence, TanStack Query persistence, Sentry sampling decisions); `apps/web/` directory.

**Goal:** Build the application shell: the Next.js App Router structure with route groups for marketing, auth, and authenticated app surfaces; the middleware that enforces the auth gate by redirecting unauthenticated users; the TanStack Query provider with default options for retry and stale time; the Zustand stores for auth, plan, and UI slices (with the plan slice stubbed since the data shape doesn't exist yet); and Sentry initialization with the `beforeSend` PII scrub hook.

**Output:**
- `apps/web/app/(marketing)/layout.tsx` — marketing route group layout (no auth required)
- `apps/web/app/(auth)/layout.tsx` — auth route group layout
- `apps/web/app/(app)/layout.tsx` — authenticated app route group layout that requires a valid session
- `apps/web/middleware.ts` — Next.js middleware that intercepts requests to `(app)/*` paths, validates the session cookie, and redirects to `/sign-in` if absent
- `apps/web/app/providers.tsx` — wraps the app with TanStack Query provider and Zustand store provider; configures TanStack Query with `staleTime: 30_000`, `retry: 2`, `refetchOnWindowFocus: true`
- `apps/web/store/auth.ts` — auth slice
- `apps/web/store/plan.ts` — plan slice with `currentPlanDate`, `isStreamingPlan`, `optimisticBlockUpdates` (stubs; concrete shape filled in chat 039)
- `apps/web/store/ui.ts` — UI slice with toast queue, modal state, theme preference
- `apps/web/sentry.client.config.ts`, `apps/web/sentry.server.config.ts`, `apps/web/sentry.edge.config.ts` — Sentry initialization with `tracesSampleRate: 0` in dev, `1.0` in preview and production; `beforeSend` hook that scrubs known PII patterns from URLs, request bodies, and breadcrumbs (emails, tokens, phone numbers)

**Implementation notes:** The route group pattern in App Router is the cleanest way to apply layout-level concerns; `(app)/` routes never render without authentication because their layout enforces it via the middleware. The TanStack Query stale time of thirty seconds means that fresh navigation back to a screen reuses cached data without refetch for thirty seconds; this is appropriate for most surfaces and is overridden per-query where needed (the plan view will use a longer stale time). The Zustand stores follow the slice pattern where each slice is a separate hook; this keeps the surface narrow and prevents accidental cross-slice subscriptions. The Sentry PII scrub hook is critical because Sentry's default behavior captures everything in stack traces, including any URL parameters that might contain emails or session tokens; the hook removes anything matching known patterns before transmission.

**Dependencies:** Chat 010 (Supabase web client exists), chat 008 (auth middleware integrates).

**End-of-session checks:** A request to an `(app)/*` route without a session redirects to `/sign-in`. A request with a valid session renders the placeholder dashboard. TanStack Query's devtools open and show no errors. Zustand stores hydrate correctly. Sentry captures a deliberate test error in development without leaking PII. `pnpm build` clean.

### Chat 013 — Mobile Shell with TanStack Query, Zustand, and Sentry

*Block 2 · EO — (built foundation; not in master sequence) · 🟢 · Skills: — · ⇄ 012 · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §2 Stack (mobile dependencies table); `docs/ARCHITECTURE_DECISIONS.md`; `apps/mobile/` directory; LAYER_4_EXPERIENCE_IDENTITY.md (design tokens, spacing).

**Goal:** Build the mobile application shell: the Expo Router structure with auth-gated and tab navigation groups; the TanStack Query provider with `persistQueryClient` configured to persist plan queries to AsyncStorage so cold starts render immediately from cache; the Zustand stores (same shape as web); Sentry mobile initialization; iOS app group identifier and keychain access group configuration to enable Live Activity widget sharing later; and the application lifecycle hooks that refresh on foreground and clean up on background.

**Output:**
- `apps/mobile/app/_layout.tsx` — root layout with auth gate, providers, and lifecycle hooks
- `apps/mobile/app/(auth)/_layout.tsx` — auth route group layout
- `apps/mobile/app/(tabs)/_layout.tsx` — tab navigator with Plan, Tasks, Calendar, Settings tabs
- `apps/mobile/app/providers.tsx` — TanStack Query provider with `persistQueryClient` using AsyncStorage adapter; configured to persist queries matching `['plan', *]` and `['weeklyPriorities', *]`
- Mobile Zustand stores at `apps/mobile/store/` mirroring the web stores
- `apps/mobile/lib/sentry.ts` — Sentry initialization via `@sentry/react-native`; same sampling rates and PII scrub hook as web
- `apps/mobile/lib/api/client.ts` — the shared mobile fetch wrapper that automatically attaches the Supabase session token, handles 401 by clearing the session and routing to sign-in, and handles HTTP 426 by surfacing a full-screen non-dismissible modal "Vesper has updated. Update to continue." with a single button that deeplinks to the App Store at `itms-apps://apps.apple.com/app/id<APP_ID>`. The 426 handler exists because chat 008's `min-app-version` middleware returns 426 to clients running older versions than the server requires; without this client-side handling the user sees only an opaque error toast and tends to uninstall.
- `apps/mobile/app.config.js` updated with iOS `appGroup` (group identifier `group.com.vesper.app`) and `keychainAccessGroups` for shared Keychain between the app and the future Live Activity widget extension
- `apps/mobile/hooks/useAppLifecycle.ts` — hook that listens to AppState changes, invalidates plan queries on foreground, and triggers Realtime cleanup on background (Realtime client wired in chat 037)

**Implementation notes:** The TanStack Query persistence pattern means the plan view renders instantly on cold start with the last-known plan data, then refetches in the background; this is the difference between a snappy mobile experience and a sluggish one. The app group and keychain access group are configured now even though Live Activity isn't built until Block 10; configuring them later requires rebuilding the iOS project with prebuild, which is disruptive mid-build. The lifecycle hook centralizes the foreground/background patterns; subsequent chats subscribe to it rather than implementing their own listeners.

**Dependencies:** Chat 011 (mobile auth exists), chat 008. Parallel with chat 012.

**End-of-session checks:** The app launches in the iOS Simulator and renders the sign-in screen without an authenticated session. After signing in, the app navigates to the tab navigator and renders placeholder screens. Killing and reopening the app shows the previously authenticated state with the placeholder plan view rendered from persisted cache. Sentry captures a deliberate test error.

### Chat 014 — Security Headers and Content Security Policy for Web

*Block 2 · EO — (built foundation; not in master sequence) · 🔵 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** `docs/ARCHITECTURE_DECISIONS.md` (CSP allowlist scope decision); OWASP Secure Headers reference; the actual list of third-party origins that need allowing (Sentry's ingest, PostHog's app and ingest hosts, Stripe Checkout redirect, Resend tracking pixels in emails).

**Goal:** Configure the full set of HTTP security headers on the Next.js web application so that XSS, clickjacking, and protocol downgrade attacks are mitigated at the platform level. The CSP is the most demanding header to author correctly because it must allow every legitimate third-party origin without leaving the application open to arbitrary script injection.

**Output:**
- `apps/web/next.config.js` updated with the `async headers()` configuration block emitting Content-Security-Policy, Strict-Transport-Security (with `max-age=31536000; includeSubDomains; preload`), X-Frame-Options (`DENY`), X-Content-Type-Options (`nosniff`), Referrer-Policy (`strict-origin-when-cross-origin`), and Permissions-Policy (denying camera, microphone, geolocation by default; geolocation re-enabled for the location capture flow only via the JS API which prompts the user)
- `docs/CSP_NOTES.md` — comprehensive documentation of every CSP directive value with the rationale for each allowed origin; documents the deliberate exclusion of `'unsafe-eval'` from `script-src` and the precompiled-shader strategy that makes this possible (Three.js shaders are precompiled at build time via a Vite/webpack plugin in chat 093, eliminating the runtime `eval` requirement)
- `apps/web/lib/csp/nonce.ts` — utility that generates a per-request nonce for inline scripts that cannot be moved to external files (Sentry tracker bootstrap is one such case); the nonce is embedded in the CSP header and in the inline script tag

**Implementation notes:** The production CSP omits `'unsafe-eval'` from `script-src` (this is Decision 13 from chat 001, made canonical here). The CSP is written in a single string with the directives listed: `default-src 'self'`, `script-src 'self' https://js.stripe.com https://app.posthog.com 'nonce-{NONCE}'`, `style-src 'self' 'unsafe-inline'` (Next.js requires unsafe-inline for its CSS-in-JS solution), `img-src 'self' data: blob:`, `font-src 'self' data:`, `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.posthog.com https://*.sentry.io https://api.stripe.com`, `frame-src 'self' https://js.stripe.com https://checkout.stripe.com`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self' https://checkout.stripe.com`. The deliberate omission of `'unsafe-eval'` is a hard requirement; this directive would broadly weaken XSS defense across the entire site, and any XSS finding could escalate to arbitrary script execution. Three.js compiles shaders via `eval` at runtime by default, so the precompiled-shader approach from chat 093 is the architectural workaround: shaders are extracted to GLSL files, compiled at build time via `vite-plugin-glsl`, and loaded as static assets. The HSTS preload entry should be added to the [HSTS preload list](https://hstspreload.org) only after the production domain has been live for at least a few weeks; the configuration enables HSTS but the preload submission is a manual cutover task.

**Dependencies:** Chat 012 (web shell exists).

**End-of-session checks:** The web application loads in a browser with no CSP violation reports in the console. A deliberate test of CSP enforcement (attempting to load a script from an unauthorized origin) produces a violation report. The site scores A on observatory.mozilla.org's HTTPS observatory.

### Chat 015 — Monorepo Build Verification Gate

*Block 2 · EO — (built foundation; not in master sequence) · 🟡 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** All `package.json` files; `pnpm-workspace.yaml`; `tsconfig.json` files; `.eslintrc.*` files.

**Goal:** Run `pnpm build` and `pnpm lint` from the repository root and resolve every error and warning that has accumulated through Block 1 and Block 2. From this chat onward, every subsequent chat ends with these same two commands passing, and that discipline is enforced by the CI gate from chat 002. This chat is the formal locking of that discipline.

**Output:** A clean `pnpm build` and `pnpm lint` from the repository root. Any cross-package type errors fixed. Any deprecation warnings addressed. The `CONTRIBUTING.md` updated to formally state the end-of-session check rule.

**Implementation notes:** It is normal for cross-package type errors to accumulate when many packages are being built in parallel. Common causes include circular imports between `@vesper/shared` and `@vesper/db` (resolved by moving the offending types to the lower-dependency package), missing exports from package barrels (resolved by adding to `src/index.ts`), and TypeScript path alias mismatches between `tsconfig.json` and `vitest.config.ts` (resolved by ensuring both reference the same paths).

**Dependencies:** Chats 004 through 014.

**End-of-session checks:** `pnpm build` from root completes with no errors. `pnpm lint` from root completes with no errors. Both commands run in under three minutes from a cold cache.

---

## Block 3 — AI Engine

Block 3 builds the AI layer of the application. The voice gate ships first because every subsequent chat that produces user-facing copy must pass through it. The Layer 1 system prompt is the highest-stakes single chat in Phase 4 because it determines plan quality. An evaluation harness is built so that prompt iteration is rubric-driven rather than vibes-driven. Hardcoded fallback templates are authored so the fallback chain has something to fall back to. The full plan synthesis function lands at the end of the block. Chats 016–020 are built foundation (outside the master sequence per the carry-over note above); 021 (EO 6), 023 (EO 7), and 022 (EO 27) take their master-table positions; and the new re-scope/audit chat 112 (EO 5) is documented at the end of this block. The block body is ordered by chat number for readability; the run order is the EO column, and the late-binding back-references in this block (018 → 019 and 020 → 022) are governed by the Critical Path section, which is canonical for them.

### Chat 016 — `@vesper/ai` Package Scaffold

*Block 3 · EO — (built foundation; not in master sequence) · 🤖 🟡 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §5 AI Architecture (Model Selection, Prompt Constants and Versioning); LAYER_3_TECHNICAL_ARCHITECTURE.md (AI Architecture section); `packages/ai/` package root.

**Goal:** Author the `@vesper/ai` package structure with the Anthropic client wrappers (Haiku 4.5 and Sonnet 4.6), the Vercel AI SDK integration, the prompt versioning constants pattern, and the cost-tracking utility that logs token usage per call. The package after this chat is empty of business logic but provides the foundation for every AI operation that follows.

**Output:**
- `packages/ai/src/client.ts` — exports `createAnthropicClient()` that returns a Vercel AI SDK provider configured with the Anthropic SDK; environment-driven API key
- `packages/ai/src/models.ts` — exports `MODELS = { HAIKU: 'claude-haiku-4-5', SONNET: 'claude-sonnet-4-6' }` as the model identifier constants
- `packages/ai/src/cacheConfig.ts` — exports the cache TTL strategy per model and prompt type: both Sonnet daily plan synthesis (covered by chat 071's HTTP-triggered cache pre-warm for the morning-alarm cohort) and all Haiku operations (template selection, NL parsing, classification, check-in question generation) use the default 5-minute ephemeral cache TTL. The 1-hour extended TTL was considered for Haiku and rejected because Haiku call density per user per day is single-digit and spread across the day; the 1-hour TTL's 2× input-rate write cost (versus 1.25× for the 5-min TTL) is rarely earned back by reads within the hour, and the prior assumed "~30% net cost reduction" was not derived from any documented call-density model. The 5-minute default is the operative configuration per the project-wide operative principles
- `packages/ai/src/streamText.ts`, `packages/ai/src/generateText.ts`, `packages/ai/src/generateObject.ts` — thin wrappers around the Vercel AI SDK functions that integrate the voice gate (when chat 017 lands) and the cost tracker; the wrappers consult `cacheConfig.ts` to apply the correct TTL on each call
- `packages/ai/src/prompts/types.ts` — type definitions for the prompt versioning pattern: each prompt is a constant string plus a sibling version constant string in the format `v{N}-{YYYY}-{MM}-{DD}`
- `packages/ai/src/cost/tracker.ts` — exports `trackCost(model, inputTokens, outputTokens, cachedTokens?)` that logs to the completion_log table with `event_type='ai_call'` and a value JSONB containing the token counts and the calculated cost
- `packages/ai/src/index.ts` — package barrel exports
- `packages/ai/tsconfig.json` with proper path setup

**Implementation notes:** The Vercel AI SDK provides streaming, structured outputs via Zod schemas, and provider abstraction; the wrappers in this package extend it with the voice gate integration and cost tracking. The cost tracker writes to completion_log because that table is the canonical event log; an alternative would be Sentry as a custom event, but the database is more durable and queryable. The prompt versioning constants pattern means that every prompt change requires both the prompt string and the version string to be updated atomically; this is documented in the package README so the discipline is preserved. The Vercel AI SDK entrypoint convention is also documented as a decision in the package README: use `streamText` for streaming Sonnet (plan synthesis, where the SSE stream is piped to the client); use `generateObject` for Haiku structured-output operations (NL command parsing, calendar event classification, template selection, check-in question generation — anywhere the model must return JSON matching a Zod schema); use `generateText` for Sonnet freeform copy (the 3-regen empathetic prompt from chat 023 and any similar freeform-text generation). All three entrypoints apply the voice gate automatically via the wrappers per the source-aware sampling rules in chat 017.

**Dependencies:** Chat 015 (build gate; subsequent packages compile clean).

**End-of-session checks:** `pnpm test packages/ai` passes (with no tests yet, the suite is empty but the runner works). A trivial test call to Anthropic via the wrapper succeeds in development. `pnpm build` clean.

### Chat 017 — Butler Voice Gate

*Block 3 · EO — (built foundation; not in master sequence) · 🤖 🎩 🟡 · Skills: caveman, stop-slop · ⚠️ · Window N · CD-flags: —*

**Load at session start:** PRD §5 (Butler Voice Specification, full); LAYER_4_EXPERIENCE_IDENTITY.md (Voice rules); the Layer 4 line library; `packages/ai/` package.

**Goal:** Implement the two-layer butler voice gate that every user-facing copy must pass through before display. The regex layer catches prohibited characters and strings (em-dashes, exclamation points, emoji, "AI" and related self-references). The Haiku review layer reads any AI-generated string longer than thirty words and reviews it against the butler voice specification, returning either an approved version or a revision. This chat must complete and pass tests before any user-facing copy ships from any subsequent chat.

**Output:**
- `packages/ai/src/voiceGate.ts` — exports `voiceGate(text: string, options?: { allowAi?: false, source?: 'freeform' | 'constrained' }): Promise<string>` that runs the regex layer synchronously and then the Haiku review layer asynchronously when the text is in scope. The `source` parameter defaults to `'freeform'` when not provided so that callers who forget to specify get the safer (max-coverage) behavior on unknown surfaces; explicit `'constrained'` is required to opt into sampling. The `source` parameter governs sampling: `freeform` outputs (AI-generated copy that follows a loose prompt) trigger the Haiku review layer for every string longer than thirty words; `constrained` outputs (AI-generated copy where the source prompt strongly constrains tone and structure, such as block titles in the DailyPlan schema) trigger the Haiku review on a 20% sample. The sampling rate is configurable per source via the same module. This sampling exists because the voice gate's Haiku review at ~$0.001 per call across many calls per user per day represents a non-trivial portion of total AI cost; sampling on constrained outputs (where voice violations are rare by construction) captures the same quality signal at one-fifth the cost. Free-form outputs are never sampled because their voice risk is high. Degraded-mode behavior is also defined: when the chat 022 circuit breaker is open (Anthropic unreachable), the Haiku review layer is skipped entirely for freeform outputs and the function falls through to regex-only mode; this is documented in the voice gate module so that the degraded behavior is auditable and the regex layer is understood to be the floor of voice safety during Anthropic outages.
- `packages/ai/src/prompts/voiceGateReview.ts` — the Haiku prompt that instructs the model to review the input string against the butler voice specification and return either the original text (if compliant) or a revision (if not), in a structured JSON object with `{ compliant: boolean, revision?: string, issues?: string[] }`
- `packages/ai/src/voiceGate.regex.ts` — the regex catalog with each prohibited pattern, its detection regex, and an optional replacement (e.g., em-dash becomes period-space)
- Unit tests in `packages/ai/src/__tests__/voiceGate.test.ts` that cover every entry in the Layer 4 line library plus a battery of synthetic test cases including edge cases (the word "AI" appearing inside a legitimate word like "available" must not be flagged), plus tests verifying the sampling logic correctly invokes the Haiku review at the configured rate
- The wrappers from chat 016 (`streamText`, `generateText`, `generateObject`) updated to invoke `voiceGate` automatically on AI output, passing the appropriate `source` value based on which prompt produced the output (the prompt constant carries metadata indicating its constraint level)

**Implementation notes:** The regex layer must be careful with substring matching. The string "AI" must be matched as a word, not a substring; otherwise "available" gets flagged. The pattern `\bAI\b` with case-insensitive matching is appropriate; the same for "artificial intelligence" and "machine learning". Emoji detection uses the Unicode property `\p{Extended_Pictographic}` which catches all emoji code points reliably. The em-dash replacement is straightforward; the exclamation point replacement requires more care because "!" sometimes appears in valid text (e.g., a brand name); the policy is strict (no exceptions), with the replacement being a period. The Haiku review layer is non-negotiable for AI-generated strings because the regex layer cannot catch every voice violation; tone mismatches, validation-seeking behavior, and over-explanation are all violations that only a language model can detect reliably. The chat carries elevated-risk handling because of its ⚠️ flag: it is the cross-cutting gate that every later user-facing string depends on, so a silent defect here propagates everywhere.

**Dependencies:** Chat 016 (Anthropic client and wrappers exist).

**End-of-session checks:** All unit tests pass. The voice gate applied to every line in the Layer 4 line library returns the line unchanged. The voice gate applied to deliberately violating strings ("Awesome!", "Wow — that's great", "Hey there 👋") returns approved revisions or throws. `pnpm test packages/ai` passes.

### Chat 018 — Hardcoded Archetype Fallback Plans

*Block 3 · EO — (built foundation; not in master sequence) · 🤖 🎩 🟡 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** PRD §6 (Module Specifications for each of the seven modules); LAYER_2_PRODUCT_SCOPE.md (Pillar 2 module list); the DailyPlan Zod schema (from chat 019); the six archetype enum values.

**Goal:** Author six JSON files representing a hardcoded fallback day plan per archetype. These are used by the synthesizePlan fallback chain (step three) when both the primary Anthropic call and the simplified retry fail. Without these files, the fallback chain has nothing to serve and the user sees a blank plan view on their first day if AI is unavailable.

**Output:**
- `packages/ai/src/fallback/nine_to_five.json` — DailyPlan-shaped fallback for a generic nine-to-five professional
- `packages/ai/src/fallback/remote.json` — fallback for a remote worker
- `packages/ai/src/fallback/student.json` — fallback for a student
- `packages/ai/src/fallback/athlete.json` — fallback for an athlete-focused user
- `packages/ai/src/fallback/founder.json` — fallback for a founder
- `packages/ai/src/fallback/mixed.json` — fallback for the mixed archetype
- `packages/ai/src/fallback/index.ts` — exports `getFallbackPlan(archetype: ArchetypeEnum, planDate: Date): DailyPlan` that loads the appropriate file, sets the dates correctly (the JSON stores times as HH:MM strings; this function combines them with the requested plan date), and returns a valid DailyPlan object

**Implementation notes:** Each fallback plan contains roughly eight to twelve blocks representing a balanced day for the archetype: wake-up window, morning routine, focused work or class blocks, exercise block, meal blocks, and an evening wind-down. The block titles and any text fields are voice-gated at authoring time. The blocks reference generic title strings rather than template UUIDs (since templates are seeded in chat 048 and may not exist at the moment the fallback is served on a first-day failure). The block source is set to `ai_generated` so downstream code treats them identically to a real plan. **Late-binding back-reference (Critical-Path-canonical): this chat hard-depends on chat 019 even though 019 is numbered after it.** The DailyPlan Zod schema authored in 019 must exist for these JSON files to be type-valid, so in execution order 018 ships after 019; chat-number order is not run order. The Critical Path section is canonical for this 018 → 019 ordering (it appears in the How-to-Use back-reference list); this inline note restates it but does not redefine it. Note that this fallback content is re-scoped by the new chat 112 (§5.8) to a minimal active-module / progressive-module day, because the six full-day plans here assume the old "modules default ON" posture; see chat 112 below.

**Dependencies:** Chat 019 (DailyPlan Zod schema must exist for type validity; later-numbered hard dependency — see Critical Path, canonical), chat 017 (voice gate for copy authoring).

**End-of-session checks:** Each fallback JSON validates against the DailyPlan Zod schema. `getFallbackPlan` returns a valid plan for each archetype with the requested date applied correctly. The block titles pass the voice gate.

### Chat 019 — Layer 1 System Prompt and DailyPlan JSON Schema

*Block 3 · EO — (built foundation; not in master sequence) · 🤖 🎩 🟡 · Skills: caveman, stop-slop · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §5 (Prompt Structure and Caching, Layer 1 description); PRD §5 (full Butler Voice Specification); LAYER_4_EXPERIENCE_IDENTITY.md (Voice rules); LAYER_2_PRODUCT_SCOPE.md (the seven modules); the daily_plans and blocks Drizzle schemas.

**Goal:** Author the canonical system prompt for daily plan synthesis (the largest cache layer; changes only on prompt version updates) and the DailyPlan JSON schema (Zod) that the prompt instructs the model to output. This chat is the highest-impact single chat in Phase 4 because the plan quality the application produces is largely determined by the quality of this prompt. The chat does not ship the prompt without testing; it requires at least three test cycles against representative inputs before committing.

**Output:**
- `packages/ai/src/prompts/dailyPlanSynthesis.ts` — exports `DAILY_PLAN_SYNTHESIS_PROMPT` (the full system prompt as a multi-paragraph string) and `DAILY_PLAN_SYNTHESIS_VERSION` (e.g., `'v1-2026-XX-XX'`). The prompt is authored with caveman-style compression applied to the production version while preserving the butler voice specification fidelity (the verbose reference version lives in a sibling file `dailyPlanSynthesis.reference.ts` for human review, but the production constant is the compressed form). Target compression: roughly half the token count of an uncompressed equivalent without quality regression, verified through the eval harness from chat 020.
- `packages/shared/src/schemas/dailyPlan.ts` — exports `DailyPlanSchema` (Zod) describing the output structure: a `blocks` array where each block has `startTime` (HH:MM string for the day), `endTime`, `blockType`, `title`, `details` (discriminated by blockType), `source` ('ai_generated' always for this output), `displayOrder`. The schema deliberately omits any `rationale` or `notes` field per block (users do not see them; storing them is waste); the schema is audited during this chat to remove any redundant or unused fields that would inflate output tokens.
- Inline documentation in the prompt file explaining each section of the prompt and why it is shaped that way; this is the prompt's commentary track

**Implementation notes:** Explicit token budget for the synthesisPlan call (locked here so cost projections in LAYER_5, SCALING_THRESHOLDS, and Chat 097a remain rederivable): Layer 1 system prompt target ≤ 5K input tokens; Layer 2 (user context) + Layer 3 (template subset) + Layer 4 (today's specifics) combined target ≤ 5K input tokens; output target ≤ 2K tokens. Total: 10K input + 2K output per cold-cache call. These targets feed the cold-cache cost calculation of $0.060/plan (`10K/1M × $3 + 2K/1M × $15 = $0.030 + $0.030 = $0.060`) and the warm-cache equivalent of ~$0.036/plan (9K of the 10K input is cache-shared at 0.1× input rate, 1K fresh, 2K output: `9K/1M × $3 × 0.1 + 1K/1M × $3 + 2K/1M × $15 = $0.0027 + $0.003 + $0.030 = $0.0357 ≈ $0.036`). If a prompt iteration exceeds these targets, the eval harness's p95 latency criterion (< 12 seconds) plus the LAYER_5 cost projections must be revisited.

The prompt is structured in distinct sections in this order: a one-sentence role establishment ("You are a calm, butler-tone life planner..."), the voice rules (briefly restated), the output instructions ("Respond only with valid JSON matching this schema. No prose. No backticks."), the schema description (a TypeScript-style interface for clarity), examples of well-formed output for one archetype, and edge case handling ("If the user has explicitly fixed events that occupy the entire day, return an empty blocks array with a `note` field explaining this. If energy is below three, prefer recovery-oriented blocks. If energy is above seven, allow more demanding blocks. Always include a brief breakfast block if the wake time is before nine AM. Always end the day with a wind-down block before bedtime_target."). The prompt is written with the assumption that Layer 2 (user context), Layer 3 (template subset), and Layer 4 (today's specifics) will be appended by the caller; the prompt itself is generic across all users. The prompt does not include any examples of bad output (per the voice rules, the model should never see what we don't want it to do); it includes only good examples. After authoring, the prompt is tested by manually running it against three representative user profiles (a nine-to-five professional with three meetings, a student with classes and a gym goal, a founder with no fixed events and three tasks) and reviewing the output for voice compliance, block coherence, and schema validity. Iteration continues until the output is consistently good across all three profiles. The chat carries elevated-risk handling because of its ⚠️ flag (highest-impact single chat). **The progressive-module conditioning of this prompt is audited separately by chat 112 (§5.9, CANNOT-DETERMINE F4):** the prompt text lives in `@vesper/ai` and was not readable in the planning copy, so whether it conditions strictly on the active `modulesEnabled` set is verified at build time, not assumed here.

**Dependencies:** Chat 017 (voice gate; the prompt itself is reviewed for voice compliance), chat 016 (AI scaffold).

**End-of-session checks:** Manual test against three representative inputs produces high-quality plans with correct voice. The output validates against the DailyPlanSchema. The prompt file commits with the version constant.

### Chat 020 — AI Evaluation Harness

*Block 3 · EO — (built foundation; not in master sequence) · 🤖 🟡 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** Chat 019 (prompt and schema); the six archetype enum values; representative user profile structures from PRD §6 (modules) and Tech Spec §3.2 (base_profile shape).

**Goal:** Build the evaluation harness so that future prompt iterations are rubric-driven rather than vibes-driven. The harness is a CLI tool that runs the daily plan synthesis prompt against a fixture set of user profiles and outputs the resulting plans for human review. This harness will be re-run whenever the prompt is updated (in chat 019 iterations, in chat 049 fitness adaptation, in chat 058 weekly synthesis, and any post-launch prompt changes).

**Output:**
- `packages/ai/eval/fixtures/` directory with ten JSON files, one per fixture user profile spanning all six archetypes and various edge cases (high energy, low energy, sparse calendar, dense calendar, every module enabled, only work and sleep modules enabled, etc.)
- `packages/ai/eval/runPlanEval.ts` — the CLI script that loads each fixture, builds the plan context, calls `synthesizePlan` (stub-callable until chat 022), and writes the output plans to `packages/ai/eval/output/{timestamp}/`
- `packages/ai/eval/SCORING_RUBRIC.md` — the scoring rubric document with criteria for voice adherence, block coherence (do block types make sense given the archetype?), archetype fit, schema validity, and edge case handling; each criterion is scored zero through three with explicit examples
- `packages/ai/eval/PASS_BAR.md` — the quantitative pass bar that any prompt version must meet before shipping: (a) 100% structural validity across all ten fixtures (every output parses against DailyPlanSchema), (b) zero voice-gate regex violations, (c) mean rubric score of 4.0 or higher out of 5.0 on a manual 20-sample review per prompt version, (d) p95 plan-generation latency under 12 seconds end-to-end. A prompt version that fails any criterion is not shipped; the eval harness reports each criterion's status at the end of each run.
- `packages/ai/eval/stopSlopComparison.ts` — an A/B comparison harness that runs the same fixture set against two prompt variants (canonical vs stop-slop-constrained) and reports the token-count difference and the rubric-score difference. As a baseline step before any A/B run, the harness runs the v1 prompt against the ten fixtures and records the average output token count per fixture and the suite-wide average in `packages/ai/eval/output/baseline.json`; subsequent compression iterations target a 30–50% reduction from this measured baseline rather than the prior "roughly half the token count of an uncompressed equivalent" heuristic. The stop-slop variant adds output instructions to the synthesis prompt ("Block titles ≤6 words. Omit filler phrases. Prefer noun phrases over sentences."); the comparison determines whether the constrained variant achieves token reduction within the 30–50% target band without quality regression. If the A/B comes back voice-safe and rubric-neutral and hits the band, the stop-slop variant becomes the production prompt.
- `package.json` script `eval:plan` that runs the evaluator and `eval:slop` that runs the A/B comparison

**Implementation notes:** The fixtures should span the full space of realistic inputs. Two should be at the energy extremes (one with energyScore 2, one with energyScore 9). One should have a calendar that is nearly full (six fixed events). One should have an empty calendar. One should have all seven modules enabled with realistic preferences. One should have only work and sleep enabled. The output directory uses a timestamp suffix so that historical runs are preserved for comparison; this makes it easy to verify that a prompt change improves quality across the suite rather than just on the cases that motivated the change. The scoring rubric is human-applied because automating the scoring would itself require a large prompt that's potentially as fragile as the prompt under test. **Late-binding back-reference (Critical-Path-canonical): this chat has a hard dependency on chat 022, which is numbered and EO-ordered after it (022 is EO 27).** The harness calls `synthesizePlan` from 022; until 022 exists the harness is wired to call the chat-019 prompt directly, and it is re-pointed at the full `synthesizePlan` once 022 lands. The Critical Path section is canonical for this 020 → 022 ordering; this inline note restates it.

**Dependencies:** Chat 019 (prompt exists), chat 022 (synthesizePlan stub callable; if 022 not ready, the harness can be wired to call the prompt directly — later-EO hard dependency, see Critical Path, canonical).

**End-of-session checks:** `pnpm eval:plan` runs to completion and produces ten output plans. Each plan validates against the schema. Manual scoring against the rubric produces a baseline score for the v1 prompt.

### Chat 021 — Context Builders and Cache Wiring

*Block 3 · EO 6 · 🤖 🟡 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §5 (Prompt Structure and Caching, full); the users table schema; the user_profiles table schema; the workout_templates and recipe_templates schemas.

**Goal:** Author the three context-building functions that assemble the prompt layers for the AI call. `buildUserContext` produces the Layer 2 content (user base profile, archetype, modules enabled, location, timezone). `buildTemplateSubset` produces the Layer 3 content (a pre-filtered subset of workouts and recipes relevant to the user; this is stubbed with empty arrays until chat 048 lands real templates). `buildPlanContext` assembles all four layers into the final message structure with appropriate cache_control markers on the cacheable layers.

**Output:**
- `packages/ai/src/context/userContext.ts` — `buildUserContext(userId: string): Promise<UserContext>` returns a JSON-serializable object with archetype, timezone, location_lat, location_lng, base_profile, modules_enabled; queries the users and user_profiles tables via the Drizzle client
- `packages/ai/src/context/templateSubset.ts` — `buildTemplateSubset(modulesEnabled): Promise<TemplateSubset>` filters workouts to at most ten matching the user's fitness goal, equipment, and level; filters recipes to at most fifteen matching diet_tags and cooking_time_max; returns empty arrays if templates have not been seeded yet (stub behavior)
- `packages/ai/src/context/planContext.ts` — `buildPlanContext(userId, planDate, energyScore, calendarEvents, pendingTasks): Promise<PlanContext>` assembles all four layers into a message array with Layer 1 as system message (with cache_control), Layer 2 as user message part (with cache_control), Layer 3 as user message part (with cache_control), Layer 4 as user message part (no cache); ready for direct submission to the AI SDK
- `packages/ai/src/context/cacheObservability.ts` — utility that logs cache hit/miss to Sentry breadcrumbs and to completion_log; useful for diagnosing why the cache pre-warm worker is or isn't producing hits

**Implementation notes:** The cache_control marker is the Anthropic SDK's way of indicating ephemeral cache scope; the marker is placed at the end of each cacheable layer. The Layer 1 cache is the largest and most stable; the Layer 2 cache is per-user and changes weekly at most; the Layer 3 cache is per-user-configuration and changes when the user toggles a module or updates a preference. Layer 4 is small and changes daily, so caching it provides little benefit. The template subset stub returning empty arrays is intentional; the AI prompt is robust to empty template lists (the model will improvise without templates), and chat 048 wires the real implementation. The observability utility is a small but important deliverable because debugging cache miss issues without it is extremely difficult. This chat sits at EO 6 — the first existing build chat in the master sequence — and reads the 111-corrected base-profile/modules shapes (111 at EO 4 runs before it), so the context it assembles already reflects the universal wake/bed/location and progressive-module fixes.

**Dependencies:** Chat 019 (prompt exists), chat 007 (Drizzle client and withUserFilter wrapper), chat 006 (user_profiles JSONB Zod schemas for parsing base_profile and modules_enabled).

**End-of-session checks:** A manual call to `buildPlanContext` for a test user returns a well-formed message array with cache_control markers in the correct positions. The empty template stub does not break the prompt. The Zod schemas validate the returned context objects.

### Chat 022 — synthesizePlan and Fallback Chain

*Block 3 · EO 27 · 🤖 🟡 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §5 (Fallback Handling, Cost Estimate); chat 019 prompt (as audited by chat 112); chat 021 context builders; chat 018 fallback plans (as re-scoped by chat 112); chat 020 eval harness.

**Goal:** Implement the primary plan synthesis function with the full three-step fallback chain. Step one is the canonical streaming Sonnet call. Step two is a retry after 1.5 seconds with a simplified prompt (Layer 3 reduced to five workouts and five recipes; Layer 4 reduced to date and energy only). Step three is to serve the most recent prior plan or, if none exists, the hardcoded archetype fallback from chat 018. Every failure logs to completion_log with the failure reason. The fallback's apology line passes through the voice gate.

**Output:**
- `packages/ai/src/synthesizePlan.ts` — exports `synthesizePlan(userId, planDate, energyScore, options?: { signal?: AbortSignal }): AsyncIterable<DailyPlanChunk>` that yields partial plan chunks as the SSE stream arrives and returns the final plan on completion; internally orchestrates the three-step fallback chain. The `signal` parameter wires AbortController cancellation end-to-end: when the calling API route detects that the client SSE connection has closed, it aborts the signal, which propagates through the Anthropic SDK and stops the upstream generation; output tokens stop billing immediately rather than continuing to generate after the user closed the app.
- `packages/ai/src/synthesizePlan.fallback.ts` — the fallback orchestration logic, separated for testability
- `packages/ai/src/synthesizePlan.simplifiedContext.ts` — the simplified context builder used by fallback step two
- `packages/ai/src/synthesizePlan.circuitBreaker.ts` — a per-user circuit-breaker utility that tracks recent synthesis failures keyed by user_id (stored in Upstash Redis with a 5-minute sliding window per user). When a single user's failure count crosses three within five minutes, that user's circuit opens and their subsequent calls skip steps one and two of the fallback chain and go directly to step three (cached or hardcoded fallback). The breaker auto-closes after five minutes of no new failures for that user. The per-user (rather than global) scope means one bad user's input pattern or one failing OAuth-dependent path does not cause every active user to be degraded to fallback simultaneously; global Anthropic outages still surface via the per-user breakers opening in aggregate. While any user's breaker is open, the global degraded-mode banner from chat 099 is shown to that user (and only to that user). This prevents thundering-herd retries during Anthropic outages from amplifying spend and worsening user latency without painting all users with the same brush.
- Unit tests covering each of the three fallback steps with mocked Anthropic responses, plus circuit-breaker open/close transitions and abort-signal propagation
- `packages/ai/src/synthesizePlan.observability.ts` — emits a structured log entry to completion_log (or a new ai_call_log table) for every synthesizePlan call (success or failure) capturing: user_id, plan_date, prompt_version (from `DAILY_PLAN_SYNTHESIS_VERSION`), model (`claude-sonnet-4-6`), cache_hit (boolean, from chat 021's cacheObservability), input_token_count, output_token_count, latency_ms, fallback_step (1 if step one succeeded, 2 if step two succeeded, 3 if hardcoded fallback), error_code (if any). Without this, post-launch debugging "why did this plan generation take 15 seconds" or "why did the AI bill double this week" is much harder.
- After the implementation, run the eval harness from chat 020 against the full synthesizePlan (not just the prompt) to verify integration and confirm the chat 020 pass bar holds
- `apps/web/app/api/v1/health/circuit-breaker/route.ts` — GET handler that returns the per-user circuit-breaker state for the authenticated user as JSON `{ open: boolean, opensAt?: string, closesAt?: string }`. Used by Chat 099's DegradedModeBanner to surface degraded mode to the user when the per-user Anthropic circuit breaker is open. Auth required; the endpoint reads only the current user's breaker state from Upstash (no admin/system-wide query path).

**Implementation notes:** The streaming behavior is critical to UX (the user sees the plan render block by block as the model generates) and to keeping the function within Vercel's serverless timeout. The Vercel AI SDK's `streamText` returns a stream that the caller can pipe into an HTTP response; the synthesizePlan function exposes this as an async iterable for caller flexibility. The fallback chain is non-trivial: step one's failure modes include network timeout (caught by AbortController with a fifteen-second timeout), rate limit 429 (parsed and respected), API error 5xx (logged and retry), and malformed response (Zod validation failure on the final chunk). Each failure type is logged with its specific cause. The apology line for the fallback is a static voice-gated string and is prepended to the plan's metadata so the UI can surface it. Buffer-then-commit semantics are explicit: chunks are accumulated in an in-memory buffer keyed by the request's idempotency lock. On AbortController fire (client disconnect, timeout), the buffer is discarded, the idempotency lock from chat 025 is released, and no partial plan is ever written to the database — the next user retry starts clean rather than colliding with orphan state. The Postgres transaction opens only at stream-end, after Zod validation of the assembled plan succeeds; the transaction writes the plan row and all child block rows atomically and commits in roughly 50-200ms. After the implementation, the eval harness is re-run; the expectation is that step one succeeds for all ten fixtures, and the resulting plans match or improve on the chat 019 prompt-only baseline. This chat consumes the chat-112 outputs: the audited chat-019 prompt (so the active-module conditioning question F4 is resolved before synthesis runs in production) and the re-scoped chat-018 fallback plans (so step three serves a progressive-module day, not a full-modules day). **F4 carried-forward note:** Stage 2 §6 records F4's consumers as chats 022 and 112, with 112 as the resolver [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. The Part 1 master table assigns `F4 R` to 112 (EO 5) but leaves this chat's CD-flags column blank at EO 27 [doc:PHASE_4_BUILD_PLAN_part1.md], so the meta line above shows `CD-flags: —` to match the authoritative master table; the downstream-consumer relationship is recorded here in prose rather than added to the meta line, and the master-table-vs-Stage-2 discrepancy is flagged, not silently reconciled (see the carry-over note at the top of this part). The chat carries elevated-risk handling because of its ⚠️ flag (multi-step fallback with revenue-affecting spend behavior and atomic-commit semantics).

**Dependencies:** Chats 017, 018, 019, 020, 021, and 112 (the prompt audit and fallback re-scope must land before production synthesis relies on them; 112 is EO 5, well ahead of this chat's EO 27).

**End-of-session checks:** All unit tests pass. Eval harness produces plans at or above the v1 prompt baseline. A deliberate test of fallback step three (mock both Anthropic calls to fail) returns a hardcoded archetype plan with the apology line in metadata. `pnpm test packages/ai` passes.

### Chat 023 — Other AI Operation Scaffolds

*Block 3 · EO 7 · 🤖 🎩 🟡 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §5 (Model Selection, all Haiku operations described); chat 017 voice gate; chat 016 wrappers.

**Goal:** Author the remaining AI operation functions that will be wired into specific features in later chats. Each function is implemented with its prompt, its versioning constant, its return type schema (via Zod), and its tests. The functions are not invoked anywhere yet; they are scaffolded for chats 029, 049, 050, 064, 067, and 100 to call.

**Output:**
- `packages/ai/src/parsePlanEditCommand.ts` — Haiku call that translates natural-language input ("move gym to 7pm") into a structured `PlanEditCommand` object with discriminated `type` field (reschedule_block, complete_block, skip_block, add_block, remove_block, regenerate_plan, unknown) and the corresponding payload. The implementation guarantees no raw user input is persisted: only the parsed structural command is forwarded; if telemetry needs to dedupe similar phrasings, a SHA-256 hash of the user input is what gets logged, never the input itself.
- `packages/ai/src/selectWorkoutTemplate.ts` — Haiku call that takes user fitness preferences and energy score, returns a workout template UUID from a candidate set passed in; falls back to the lowest-rest-required candidate if the AI returns nothing useful
- `packages/ai/src/selectRecipeTemplate.ts` — Haiku call equivalent for recipe selection
- `packages/ai/src/classifyCalendarEvent.ts` — Haiku call that takes a Google Calendar event summary and returns a `block_type_enum` value (or `null` if no good classification)
- `packages/ai/src/classifyCalendarEventsBatch.ts` — Haiku call that takes an array of calendar event summaries and returns an array of classifications in a single API call. The classification step in chat 064 calls this batched form whenever more than one event needs classification (which is the common case at morning sync), saving roughly 30% of Haiku spend by amortizing the system prompt and cache write across the batch.
- `packages/ai/src/generateCheckInQuestion.ts` — Haiku call that produces one or two short morning check-in questions based on recent context
- `packages/ai/src/suggestWeeklyPriorities.ts` — Haiku call consumed by chat 057's weekly-planning step 2; takes the user's outstanding tasks plus the prior week's completion data and returns 3–5 suggested priority strings; the structured-output schema is `{ suggestions: string[] }` with 3 ≤ length ≤ 5 enforced
- `packages/ai/src/generateRegenerationPrompt.ts` — Sonnet call that produces the empathetic "what's not working?" prompt after three failed regenerations
- `packages/ai/src/prompts/` files for each of the above with their version constants
- Tests with mocked responses for each function, including a test for the batched classifier that verifies the array form returns the same per-event classifications as N individual calls

**Implementation notes:** Each function follows the same pattern: define the prompt as a constant, define the version, define the return type schema, call `generateObject` (Haiku) or `generateText` (Sonnet, for the regeneration prompt which is freeform copy), pass through the voice gate. The voice gate is invoked on the freeform copy outputs but not on the structured outputs (the schema validation is sufficient because structured outputs are not displayed verbatim to the user). The natural-language command parser is the most complex of these because its return type is a discriminated union; the prompt must instruct the model carefully to choose the right type and populate only the relevant fields. This chat sits at EO 7 (after 021 at EO 6); it depends only on the AI scaffold and voice gate, both built foundation, so it is unblocked immediately.

**Dependencies:** Chats 016, 017.

**End-of-session checks:** All unit tests pass. Each function called with a representative input via the CLI returns a well-formed output. The voice gate is invoked where appropriate.

### Chat 112 — AI Fallback Re-Scope (018) + Chat-019 Prompt Audit

*Block 3 · EO 5 · 🤖 🎩 🟡 · Skills: caveman, stop-slop · — · Window N · CD-flags: F4 R*

**Load at session start:** PHASE_4_REPLAN_STAGE_1_ANALYSIS.md §5.8 (fallback re-scope finding) and §5.9 (system-prompt module-set audit finding); LAYER_2_PRODUCT_SCOPE.md (lines establishing progressive modules — a new user starts with Work+Tasks+Calendar plus one chosen lifestyle module, not all modules on) and PRD.md (progressive-onboarding direction); the chat-018 fallback JSON files under `packages/ai/src/fallback/`; the chat-019 system prompt `packages/ai/src/prompts/dailyPlanSynthesis.ts` and the DailyPlan Zod schema; chat 017 voice gate.

**Goal:** Apply the two stale-code AI-layer fixes Stage 1 isolated, both of which arise because the built 018/019 work assumed the old "modules default ON" posture that progressive onboarding has since replaced. First, §5.8: re-scope the six hardcoded fallback day plans (chat 018) from full days that populate fitness + nutrition + errands + every-module blocks down to a minimal active-module / progressive-module day — a day-one fallback should not over-fill a new user's schedule relative to the modules they have actually enabled. Second, §5.9: audit the chat-019 daily-plan synthesis system prompt to confirm it conditions strictly on the active `modulesEnabled` set and tolerates a one-lifestyle-module day, rather than generating blocks for modules a progressive-onboarding user has not enabled. Running this early (EO 5) means the corrected fallback content and the audit determination are both in place before chat 022 (EO 27) wires the production synthesis-and-fallback chain.

**Output:**
- Re-scoped fallback plans under `packages/ai/src/fallback/` (§5.8): the six archetype JSON files revised so each represents a minimal active-module day — the always-on Work + Tasks + Calendar surface plus one representative lifestyle module — rather than a full seven-module day; or, where cleaner, made module-aware so `getFallbackPlan` can compose blocks from the user's actual `modulesEnabled` set at serve time. Each revised plan is confirmed not to render a grade or score headline, consistent with the §5.9 scorekeeping posture. This is a content fix, not a structural one; the DailyPlan schema is unchanged.
- **F4 read** against the chat-019 prompt in `@vesper/ai` (§5.9): read the actual `DAILY_PLAN_SYNTHESIS_PROMPT` text — which was not present in the planning copy and is the reason F4 was carried forward as CANNOT-DETERMINE — and confirm it conditions strictly on the active `modulesEnabled` set and tolerates a one-lifestyle-module day. If the prompt still assumes "six modules default ON," correct the prompt copy forward (bumping `DAILY_PLAN_SYNTHESIS_VERSION` per the versioning discipline) and re-run the chat 020 eval harness against the corrected prompt to confirm no quality regression. If the prompt already conditions correctly, record that determination so chat 022 consumes it without re-reading. The DailyPlan schema needs no change for this; only the prompt copy might.
- A recorded determination for F4 (confirmed-as-is or corrected-forward) written where the build can see it, so that chat 022 — the downstream consumer of the audited prompt — inherits a resolved flag rather than re-opening the question.

**Implementation notes:** This is the AI-layer analogue of chat 111's schema/Zod consolidation: a cheap, high-unblock stale-fix that runs early (EO 5, immediately after 111 at EO 4) so the downstream synthesis spine reads corrected inputs. The work is content and prompt copy, not structure — §5.8 is explicitly "a content fix, not a structural one" and §5.9 needs no DailyPlan schema change [doc:PHASE_4_REPLAN_STAGE_1_ANALYSIS.md]. **F4 is the one CANNOT-DETERMINE flag this chat reads (R):** the chat-019 prompt body lives in `@vesper/ai` and could not be inspected from the project copy, so Stage 2 carried F4 forward rather than guess at the prompt text; the resolution mechanism is to read the real prompt here at build time [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. **The `Fwin F#` window counter and this `CD-flag F4` token share an `F#` shape but are unrelated and must be read field-scoped** — this chat is not a window chat (Window N); its `F4 R` is the CANNOT-DETERMINE flag it reads, per the Part 1 naming caveat. Per Stage 2 §6, F4's consumers are chats 022 and 112 and its resolver is 112; this chat resolves it and chat 022 consumes the resolved prompt downstream. The 🎩 flag applies because the re-scoped fallback block titles are user-facing copy and must clear the butler voice gate at authoring time; caveman/stop-slop are invoked accordingly. The 🤖 flag applies because the prompt-copy correction (if any) bumps the prompt version constant under the prompt-versioning discipline.

**Dependencies:** Built chats 018 and 019 and the `@vesper/ai` package (the fallback JSON and the synthesis prompt this chat revises and audits). Runs early at EO 5; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply to this chat. Its output is consumed downstream by chat 022 (EO 27).

**End-of-session checks:** The six fallback plans represent a minimal active-module day (or are module-aware) and no longer over-fill a progressive-onboarding user's day; each still validates against the DailyPlan Zod schema and each block title passes the voice gate. The F4 read is recorded with an explicit determination — confirmed-as-is or corrected-forward — for whether the chat-019 prompt conditions strictly on the active `modulesEnabled` set and tolerates a one-lifestyle-module day. If the prompt was corrected, its version constant is bumped and the chat 020 eval harness shows no rubric regression. `pnpm test packages/ai` passes; `pnpm build` and `pnpm lint` clean.

<!-- PHASE_4_BUILD_PLAN.md — Part 4 of 10. Body continues here; conventions, legend, per-chat template, and master reordered-sequence table live in Part 1. Concatenate Parts 1→10 (a/b sub-parts in letter order) head-to-tail. -->

---

## Authoring Note for Part 4 (Block 4 and Block 5)

Unlike Part 3, this part contains no built-foundation chats. Stage 1 asserts 001–020 built and 021+ unbuilt [doc:PHASE_4_REPLAN_STAGE_1_ANALYSIS.md], so every chat in Blocks 4 and 5 is not-yet-built work that appears in the Part 1 master reordered-sequence table and therefore carries a **real EO and a real Model** from that table [doc:PHASE_4_BUILD_PLAN_part1.md]. No EO is recorded as `—`; each meta line below takes its EO and Model verbatim from the master table.

**Block 5 split convention.** Block 5's chats 032–036 are each split into a design-track visual/static half (`NNN-V`, inside the design-cluster window) and an build-track wiring half (`NNN-W`, in normal build-track sequence). **Both halves are documented here, inside Block 5** — the split is a sequencing/ownership device, not a relocation, exactly as the Part 1 splits note prescribes [doc:PHASE_4_BUILD_PLAN_part1.md]. Each half takes its **own** EO and Window values from the master table: the `-V` halves are design-track, `Window Y`, and carry their own `Fwin F#` counter position (032-V = F5, 033-V = F6, 034-V = F7, 035-V = F8, 036-V = F9, per the design-cluster-window note); the `-W` halves are build-track, `Window N`, at their normal EO positions. The pairs are presented `-V` then `-W` so any reference to `NNN` resolves to the pair. A `-V` half is design-locked, wiring-deferred — not "done" until its `-W` half ships.

**Flag propagation across a split (carried, not reinvented).** Where an original chat carried the 🎩 voice-gate flag (032, 035, 036), the flag is propagated to the half that actually authors the user-facing copy — the `-V` half, which holds the static/voice-gated lines the copy gate (chat 017) must clear at authoring time — and the `-W` wiring half, which adds no new copy, shows `Skills: —`. This is a propagation of the existing flag onto the owning half, not a new convention, consistent with the flag-not-invent discipline Part 3 used. Package colors are likewise decomposed onto each half from the original chat's output set (the visual screens to `-V`; the shared state machine / persistence wiring to `-W`), not invented.

**Counter-vs-flag scoping reminder.** The `-V` halves carry a `Fwin F#` window-counter token; chats 025 and 031 carry a `CD-flag F#` token. These share an `F#` shape but live in different fields and are unrelated — `Fwin F5` is the fifth window chat (032-V); `CD-flag F1` is the `daily_plans` draft/approved-state migration question consumed by 025. Read them field-scoped, per the Part 1 naming caveat [doc:PHASE_4_BUILD_PLAN_part1.md].

**Master-table-vs-Stage-2 reconciliation.** Where the master table and Stage 2 agree, the meta line follows both; where they would disagree, the master table is authoritative for the meta line and the Stage 2 detail is carried in prose and flagged rather than patched, as Part 3 did. For the two CD-flag-bearing chats in this part — 025 (`F1 C`) and 031 (`F3 C`) — the master table and Stage 2 §6 agree, so no discrepancy arises [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

---

## Block 4 — Core API Routes

Block 4 implements the API surface that authenticated clients call. The routes use the foundation pattern from chat 008 and the rate limiting from chat 009. The plan generation route is the highest-stakes because of its streaming behavior, idempotency requirements, and cost-protection rate limit. The block update route encodes the optimistic concurrency check that resolves Tech Spec Open Question 2. (Block organization is preserved for readability; actual run order is the EO column of the Part 1 master table — the Block 4 chats are interleaved across EO 8 through EO 35 on the build track, not run as a contiguous numeric block.)

### Chat 024 — Profile and Energy APIs

*Block 4 · EO 8 · 🔵 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §9 (Profile section, Energy section); chat 008 API foundation; the users and user_profiles Drizzle schemas; the base_profile and modules_enabled Zod schemas **as corrected by chat 111** (the profile-shape stale-fix; load the 111-corrected schema, not the pre-111 shape).

**Goal:** Implement the profile read and write API routes plus the energy logging route. Profile writes enforce the base_profile_version increment invariant. The modules toggle convenience endpoint mutates the modulesEnabled JSONB atomically. The energy log endpoint writes to completion_log with the energy_logged event type and does not trigger plan generation.

**Output:**
- `apps/web/app/api/v1/profile/route.ts` — GET and PUT handlers using `createRoute` from chat 008
- `apps/web/app/api/v1/profile/modules/[moduleId]/route.ts` — PATCH handler for the convenience module toggle
- `apps/web/app/api/v1/energy/route.ts` — POST handler
- Request body Zod schemas in `apps/web/app/api/v1/profile/schemas.ts`, written against the 111-corrected base_profile shape
- Response shape types matching Tech Spec §9
- Integration tests using the test database from chat 002

**Implementation notes:** The PUT /profile handler must increment base_profile_version every time base_profile changes; this is enforced in the handler rather than at the database level because it is a logically simple invariant. The PATCH module toggle reads the current modulesEnabled JSONB, mutates the specified module key, and writes back atomically; the increment to base_profile_version also happens here because module configuration changes affect plan generation cache. The energy POST writes to completion_log only; plan generation is a separate route (chat 025). The Zod schemas for request bodies are co-located with the routes for ease of maintenance. **This chat consumes the 111-corrected profile shape:** chat 111 (EO 4) is the schema/Zod stale-fix that brought the wake/bed/location, alarm-flag, and notification-preferences fields into agreement with the post-progressive-onboarding posture [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]; because 024 runs at EO 8, after 111 at EO 4, the routes are authored against the corrected shape rather than the stale one. Profile is therefore an early build-track chat: its only gating predecessor in the reordered sequence is the 111 fix, the rest of its prerequisites being built foundation [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 008, 009, 007, 006, and 111 (the 111-corrected profile/Zod shape is a real gating predecessor in the reordered sequence; Stage 2 records 024 as "depends on 111-corrected profile shape" with built foundations 008/009/007/006 assumed satisfied [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 8; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** Integration tests pass for all three routes. Manual testing via curl with a real auth token produces the expected responses. base_profile_version increments correctly on every PUT. The request schemas validate against the 111-corrected base_profile shape (no field drift from the pre-111 shape).

### Chat 025 — Plan Generation API with Streaming and Idempotency

*Block 4 · EO 34 · 🔵 · Skills: — · ⚠️ · Window N · CD-flags: F1 C*

**Load at session start:** TECHNICAL_SPEC.md §9 (Plans section, POST /plans/generate); chat 022 synthesizePlan; chat 009 rate limiting; `apps/web/app/api/v1/plans/` directory; the `daily_plans` migration `…0004_daily_planning.sql` (the draft/approved-state model behind CD-flag F1).

**Goal:** Implement the plan generation streaming endpoint with all the cross-cutting concerns: heartbeat-extended idempotency locking to prevent concurrent generation for the same (user_id, plan_date), per-user rate limiting that distinguishes trial-state from active-state users (two generations per day during trial, five per hour for active subscribers), buffer-then-commit atomic writing of the plan and its blocks on stream completion (the database transaction is opened only at stream-end rather than held open across the entire generation), regeneration_count increment when a plan already exists, fallback handling when the AI fails, AbortController propagation when the client disconnects mid-stream, and completion_log writes for analytics.

**Output:**
- `apps/web/app/api/v1/plans/generate/route.ts` — POST handler that returns a streaming `text/event-stream` response; orchestrates synthesizePlan, the heartbeat idempotency lock, the buffer-then-commit atomic write, the AbortController wiring, and the analytics logging
- `apps/web/lib/idempotency.ts` — utility for the (user_id, plan_date) lock using Upstash Redis with a 300-second initial TTL plus a heartbeat that extends the TTL by 60 seconds every 30 seconds while the stream is active; on stream end (success or error), the lock is explicitly deleted; on crash, the TTL expires naturally within 5 minutes. If a lock is already held when a request arrives, the client receives a 409 with the message "A plan is being generated for this date; try again in a moment."
- `apps/web/lib/regenerationLimits.ts` — utility that enforces the trial-vs-paid regeneration cap: trial users (subscription_status='trial') are capped at 2 plan generations per local day (queried via completion_log for `event_type IN ('plan_generated', 'plan_regenerated')` rows with `created_at >= start_of_local_day(user.timezone)` — using the Postgres function added in chat 004 so the day boundary is computed in the database and is DST-correct); active subscribers are capped at 5 per rolling hour via the Upstash token bucket from chat 009. The two paths are mutually exclusive on each request: the handler reads `subscription_status` once at request entry and routes to exactly one of the two paths, never both, so the trial completion_log count and the active token bucket never compose. The cap exists during trial to protect margin on non-converting users without degrading core experience; the limit is well above typical use (most users generate at most once a day) but blocks regen-abuse patterns.

**Implementation notes:** Streaming responses on Vercel are supported when the runtime is set to Node and the response is constructed via the Web Streams API; the Vercel AI SDK abstracts this for AI streams specifically. The buffer-then-commit pattern is the architectural fix to a subtle resource-exhaustion bug: holding a Postgres transaction open across an 8-15 second AI stream consumes one of the limited Supavisor transaction-mode connection slots for the entire stream duration; at 15 concurrent users with a 15-slot free-tier cap, the connection pool is exhausted and unrelated API routes return 503. The correct pattern is: stream Anthropic chunks to the SSE client immediately for UX, accumulate the complete plan in worker memory, open the database transaction at stream completion, write plan plus blocks atomically, commit, close. The transaction holds for ~50-200ms instead of ~10 seconds. The heartbeat idempotency lock prevents the double-tap race; without heartbeat, the 60-second initial TTL would expire mid-stream on slow generations (Anthropic p99 latency can exceed 60s under load), the lock would release prematurely, and a second client request could initiate a parallel generation that conflicts at commit time. The AbortController wiring propagates client disconnection upstream: when the SSE connection closes (client navigation, app backgrounding, network drop), the route's request handler receives an abort signal, which forwards into the synthesizePlan call's `signal` option from chat 022, which forwards into the Anthropic SDK, which closes the upstream stream and stops billing output tokens. **CD-flag F1 (consumed):** this chat consumes the `daily_plans` draft/approved-state question — whether the table models the evening draft→approve loop with an `approved_at` column — by reading `…0004_daily_planning.sql` at build time; F1 was carried forward as CANNOT-DETERMINE because the migration body was not present in the planning copy [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. The master table tags 025 with `F1 C` and Stage 2 §6 lists 025 as both a consumer and the designated resolver of F1 (with a 004/006 fix as the alternate resolution path if the draft-state model is absent) [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]; 046-W (Part 5, EO 62) is the downstream consumer of the same flag. **The `CD-flag F1` token here is unrelated to the `Fwin F#` window counter** — read field-scoped. ⚠️ risk requires elevated handling and multiple iterations if needed, because the streaming/idempotency/transaction interaction is exactly the kind of cross-cutting concern where silent bugs (premature lock release, connection-slot exhaustion, un-aborted upstream streams) carry real cost and reliability impact; the Risk Map records why.

**Dependencies:** Chats 008, 009, 022, 024 (Stage 2 gating prereqs are 022 and 024, with built foundations 008/009 assumed [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 34; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Its plan-generation surface is consumed downstream by 036-W (the first-plan real-synthesis trigger, EO 63).

**End-of-session checks:** A streaming request from a real test client produces SSE chunks as the plan generates. A second request fired immediately (before the first completes) receives the 409 conflict response. The plan_generated event appears in completion_log. The trial regeneration cap blocks the third generation in a single local day for a trial user. The active-subscriber rate limit kicks in on the sixth request within an hour. A deliberate client disconnect during stream verifies the upstream abort fires (Anthropic logs show the stream terminated). The F1 read is recorded with an explicit determination — the `daily_plans` table either models draft/approved with `approved_at` as-is, or a 004/006 fix is applied — so that 046-W inherits a resolved flag.

### Chat 026 — Plan Retrieval APIs

*Block 4 · EO 29 · 🔵 · Skills: — · ⇄ 025 · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §9 (Plans section, GET endpoints); the day rollover decision (midnight in user's timezone per architecture decisions).

**Goal:** Implement GET /plans/today and GET /plans/date/:date. The "today" endpoint computes the current local date based on the authenticated user's timezone and serves the plan for that date; the date-specific endpoint serves any historical or future plan if one exists. Both return 404 if no plan exists for the requested date.

**Output:**
- `apps/web/app/api/v1/plans/today/route.ts` — GET handler that computes the user's local date and queries the database
- `apps/web/app/api/v1/plans/date/[date]/route.ts` — GET handler with date validation (must be YYYY-MM-DD format)
- `apps/web/lib/dates/localDate.ts` — utility that takes a user's timezone (IANA string) and the current server timestamp, returns the user's current local date in YYYY-MM-DD format; handles DST transitions correctly using the `Intl.DateTimeFormat` API or the `date-fns-tz` library

**Implementation notes:** The day rollover logic is subtle. If the user is in `America/Los_Angeles` and the current UTC time is 06:00 on January 2nd, the user's local date is 22:00 on January 1st, so "today" is January 1st. The IANA timezone identifier accommodates DST automatically. The handler queries the daily_plans table by (user_id, plan_date) and joins blocks; the response shape matches Tech Spec §9 exactly. The withUserFilter wrapper from chat 007 ensures the query is properly scoped. **The ⇄ 025 flag is carried from the prior plan:** 026 and 025 are logically independent (neither depends on the other; both depend only on 008/024) and so are parallel-capable on separate terminals. The reorder places them at different EO positions (026 at EO 29, 025 at EO 34) because EO is a single dependency-rank walk, not a wall-clock schedule; concurrency is governed by the Parallelization Map (Part 10), which is canonical for actual parallel execution. The ⇄ token is preserved as a flag, not reconciled to the new EO distance.

**Dependencies:** Chats 008, 024 (Stage 2 gating prereq is 024 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Parallel with chat 025 (⇄; see Parallelization Map). Runs at EO 29; its retrieval surface is consumed by 041-W (EO 50) and the day-view chats 039/040.

**End-of-session checks:** Integration tests pass for both endpoints. The local date computation handles a representative DST transition correctly. 404 returns when no plan exists; 200 returns with the full plan shape when one does.

### Chat 027 — Block APIs with Optimistic Concurrency and In-Progress Transition

*Block 4 · EO 35 · 🔵 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §9 (Blocks section); TECHNICAL_SPEC.md §14 (Open Question 2 about displayOrder concurrency); the blocks table schema.

**Goal:** Implement PATCH /blocks/:blockId with single-field updates (status, time, displayOrder), the plan-level updated_at optimistic concurrency check applied to every mutation (not only displayOrder), and the in_progress auto-transition computed at read time in the API layer rather than via a database trigger. Also implement POST /blocks for user-added blocks.

**Output:**
- `apps/web/app/api/v1/blocks/[blockId]/route.ts` — PATCH handler with the optimistic concurrency check that fires on every block mutation
- `apps/web/app/api/v1/blocks/route.ts` — POST handler for user-added blocks
- `apps/web/lib/blocks/effectiveStatus.ts` — utility used by GET /plans/today (chat 026) and GET /blocks/:id serializers that computes the displayed status: `effective_status = (status === 'scheduled' && start_time !== null && end_time !== null && end_time > start_time && now >= start_time && now < end_time) ? 'in_progress' : status`. The null-and-ordering guards exist because user-added blocks may legitimately omit times, and synthesis-generated blocks always have non-null end_time > start_time but the read-time computation does not trust the invariant. Blocks never cross local midnight: the synthesis prompt is instructed to split any spanning interval at the day boundary, so the `now >= start_time && now < end_time` comparison can safely use a single day's clock without wraparound handling. The database stores the authoritative status (one of scheduled, complete, skipped, rescheduled); the in_progress visual state is derived at read time, eliminating the need for a database trigger that would otherwise need to fire on SELECT (which Postgres does not support) or on every mutation that touches the table.
- Request body Zod schemas

**Implementation notes:** The optimistic concurrency check works as follows. The client always sends the plan's `updated_at` timestamp it last saw, in every block mutation request (not only reorder). The PATCH handler reads the current plan's `updated_at` in the same transaction as the block update; if they differ, the request is rejected with 409 Optimistic Lock Failure. The client refreshes its view and retries via the conflict-toast flow in chat 038. Expanding the check to all mutations (not only displayOrder per Tech Spec §14 Open Question 2's narrow framing) prevents a different race where two devices simultaneously mutate the same block (one marks complete, one reschedules) and the second mutation overwrites the first with no toast. The in_progress derivation at read time was selected over a database trigger because the natural trigger condition (status='scheduled' AND start_time <= now AND end_time > now) cannot be expressed as a Postgres trigger on SELECT (no such hook exists), and an UPDATE-only trigger fires too late (the next mutation may be hours after the actual transition). Computing in the API layer is simpler, has no migration overhead, and produces the correct effective status on every read. The POST handler for user-added blocks requires the plan to exist; if not, it returns 400 with an error indicating that the plan must be generated first. Interaction with chat 029's batch reorder endpoint: both endpoints share the `daily_plans.updated_at` OCC check (advanced by the child-block trigger from chat 004); concurrent batch reorders from the same device are serialized by the per-user mutation queue on the client, so the in-flight ordering is preserved; if two batch reorders nonetheless arrive at the server (multi-device), last write wins on `displayOrder` because each commit advances `daily_plans.updated_at` and any later request whose claimed `updated_at` is stale receives a single 409. Mark the interaction in this chat's notes so the reorder endpoint chat does not re-invent the OCC plumbing. ⚠️ risk requires elevated handling: the OCC semantics are the resolution of a Tech Spec open question and an off-by-one in the read-in-same-transaction check silently corrupts multi-device state.

**Dependencies:** Chats 008, 026 (Stage 2 gating prereq is 026 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 35; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Consumed by chat 042 (block actions) and chat 038 (offline conflict resolution).

**End-of-session checks:** Integration tests pass including a deliberate optimistic lock failure scenario on a status update (not only reorder). The effective_status computation returns 'in_progress' for a block whose start_time is in the past and end_time is in the future. POST /blocks validates against the schema and rejects requests for non-existent plans.

### Chat 028 — Task APIs

*Block 4 · EO 30 · 🔵 · Skills: — · ⇄ 027 · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §9 (Tasks section); the tasks table schema; PRD §6.1 (Work and Tasks module spec).

**Goal:** Implement GET /tasks (with optional status filter), POST /tasks, PATCH /tasks/:taskId (with status, title, estimatedMinutes, deadline, priority all optional), and DELETE /tasks/:taskId. Order results by priority descending and deadline ascending. Validate that estimatedMinutes is positive and that the deadline is in the future on creation.

**Output:**
- `apps/web/app/api/v1/tasks/route.ts` — GET and POST handlers
- `apps/web/app/api/v1/tasks/[taskId]/route.ts` — PATCH and DELETE handlers
- Request body Zod schemas

**Implementation notes:** Tasks are not paginated at V1 because user task backlogs are bounded (the user manages their own list). Sorting by priority descending requires mapping the enum to a numeric order (high=3, medium=2, low=1) since the enum's text comparison is not what we want. The deadline validation on creation is a soft check (rejection at creation); deadline mutation on PATCH does not re-validate (users can move deadlines into the past if needed for archival purposes). The DELETE is a hard delete; there is no soft-delete pattern on tasks per Tech Spec. **The ⇄ 027 flag is carried from the prior plan:** 028 (EO 30, gating prereq 024) and 027 (EO 35, gating prereq 026) are logically independent and parallel-capable on separate terminals; the differing EO positions reflect the single dependency-rank walk, not a schedule, and the Parallelization Map (Part 10) is canonical for actual concurrency. The token is preserved as a flag, not reconciled.

**Dependencies:** Chats 008, 024 (Stage 2 gating prereq is 024 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Parallel with chat 027 (⇄; see Parallelization Map). Runs at EO 30; consumed by 054-W (tasks list UI + CRUD wiring, EO 43) and chat 055 (task placement algorithm).

**End-of-session checks:** Integration tests pass. The sort order is correct (high-priority then earliest-deadline). Validation rejects invalid bodies.

### Chat 029 — Natural Language Command and Weekly Priorities APIs

*Block 4 · EO 32 · 🔵 🤖 🎩 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §9 (AI Commands, Weekly Priorities); chat 023 (parsePlanEditCommand); the weekly_priorities table schema.

**Goal:** Implement POST /ai/command which parses a natural-language string into a structured PlanEditCommand and returns it (the client applies the edit via the other APIs). Implement GET and PUT /weekly-priorities with array length validation (between three and five priorities required). For unknown commands, return a butler-tone clarification line that has passed through the voice gate.

**Output:**
- `apps/web/app/api/v1/ai/command/route.ts` — POST handler invoking parsePlanEditCommand
- `apps/web/app/api/v1/weekly-priorities/route.ts` — GET and PUT handlers
- `apps/web/app/api/v1/plans/[date]/reorder/route.ts` — POST handler that accepts `{ blocks: [{ id, displayOrder }], planUpdatedAt }` and applies all displayOrder updates atomically within a single transaction with the optimistic concurrency check from chat 027. This batch endpoint exists because the drag-and-drop reorder UX in chat 043 needs to apply N displayOrder updates atomically; issuing N parallel PATCH /blocks calls produces partial-failure states when a 409 fires on some blocks but not others. The batch endpoint either commits all updates or rejects the entire reorder with one 409.
- Request body Zod schemas

**Implementation notes:** The AI command route returns the structured edit operation; the application of that operation is the client's responsibility (the client then calls PATCH /blocks or POST /blocks or POST /plans/generate or the batch reorder endpoint as appropriate). This separation keeps the AI route stateless. The clarification line for unknown commands is a hardcoded string constant authored once and passed through the voice gate at authoring time; there is no runtime Haiku call to generate the clarification (the same fixed string serves every unknown-command response across the application). The weekly priorities PUT replaces the entire priorities array atomically; the array length validation rejects anything outside three-to-five items; the PUT also increments `user_profiles.base_profile_version` because priorities materially affect plan generation context and the cache layer must invalidate when they change. The batch reorder endpoint serializes all displayOrder updates inside one Postgres transaction with the optimistic concurrency check at the top; if planUpdatedAt mismatches, the transaction rolls back and the client sees a single 409 instead of a partial-success state. **Flag handling:** the 🎩 voice-gate flag applies because the unknown-command clarification line is user-facing butler copy authored through the caveman/stop-slop gate at authoring time; those two skills are named in the Skills field per the Part 3 skill-naming convention [doc:PHASE_4_BUILD_PLAN_part3.md]. The 🤖 flag marks this as an AI-layer chat where prompt versioning matters (the parsePlanEditCommand call), but the Part 1 legend names no skill to invoke for 🤖, so it is carried in the meta cluster as a flag and not expanded into an invented skill name.

**Dependencies:** Chats 008, 023 (Stage 2 gating prereq is 023 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 32; the batch reorder endpoint is consumed by chat 043 (drag-and-drop reorder) and the OCC plumbing it reuses is from chat 027.

**End-of-session checks:** Integration tests pass including a deliberately ambiguous command that produces an `unknown` type with a clarification line that has cleared the voice gate. Weekly priorities PUT with two or six items returns 400.

### Chat 030 — Subscription, Account, and Push Token API Scaffolds

*Block 4 · EO 31 · 🔵 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §9 (Subscriptions, Account, Push Tokens sections); Block 11 chats (the full logic lands later; this chat builds the route scaffolds).

**Goal:** Implement the scaffolds for all subscription, account, and push token routes. The full state machine logic lands in Block 11; this chat builds the route handlers that delegate to the state machine (which is stubbed) and the push token registration that does not yet trigger Live Activity flows.

**Output:**
- `apps/web/app/api/v1/subscription/route.ts` — GET handler
- `apps/web/app/api/v1/subscription/checkout/route.ts` — POST handler that creates a Stripe Checkout session
- `apps/web/app/api/v1/subscription/portal/route.ts` — POST handler that creates a Stripe Customer Portal session
- `apps/web/app/api/v1/subscription/apple-verify/route.ts` — POST handler returning 501 until chat 086 lands real verification
- `apps/web/app/api/v1/account/delete/route.ts` — POST handler that sets deletion_requested_at, transitions subscription_status to deletion_scheduled, cancels any active Stripe subscription via the Stripe API, AND writes a security_audit_log row with event_type='account_deletion_requested' carrying {user_id, requested_at, subscription_source_at_request, stripe_subscription_cancellation_result_if_applicable}. The audit row is the canonical record of user intent for any future dispute or recovery.
- `apps/web/app/api/v1/account/restore/route.ts` — POST handler that clears deletion_requested_at and transitions back to read_only, AND writes a security_audit_log row with event_type='account_deletion_restored' carrying {user_id, restored_at}. Both row writes happen inside the same transaction as the state mutation so audit-log presence cannot diverge from state.
- `apps/web/app/api/v1/push-tokens/route.ts` — POST handler that upserts the push_tokens row
- `apps/web/app/api/v1/push-tokens/[deviceId]/route.ts` — DELETE handler
- `apps/web/lib/auth/onAuthStateChange.ts` — server-side hook driven by a Supabase database trigger on `auth.users` UPDATE that calls a Vesper-internal HTTP endpoint (`/api/v1/internal/auth-event`, authenticated via a shared-secret header set as a Supabase database secret) with the user id and event type (sign-out, password change, session expired, hard-delete cascade); the endpoint deletes all push_tokens rows for that user_id. The database trigger is a sub-deliverable of this chat: it is created as a migration in the chat's output. The hook fires on user sign-out, password change, session expiration, and hard-delete cascade. This prevents the orphan-token bug where a user signs out of one device but their push tokens remain registered, causing later Live Activity and notification deliveries to land on a device the user no longer controls.

**Implementation notes:** The Checkout and Portal handlers use the Stripe SDK and require the Node runtime. The apple-verify handler is a stub that returns 501 with a clear error code (NOT_IMPLEMENTED) so that integration tests can distinguish "scaffolded but not yet wired" from "broken." The account delete handler behavior depends on the subscription source. For Stripe-managed subscriptions, the handler cancels the Stripe subscription synchronously via the Stripe API (a stripe.subscriptions.cancel call); this is critical because otherwise the user is charged again before the hard-delete worker runs. For Apple StoreKit-managed subscriptions, the server cannot cancel on behalf of the user (Apple's policy); instead the handler sets `deletion_requested_at` and the UI surface displays a clear instruction directing the user to cancel their Apple subscription via iOS Settings → Apple ID → Subscriptions before the 30-day grace period elapses, and offers an `itms-apps://` deeplink to that surface. The push tokens POST upserts on (user_id, device_id) per the unique constraint. This chat is positioned at EO 31 because three later build-track chains gate on its scaffolds: GCal OAuth (063, EO 37), the subscription state machine (081, EO 38), and push-token infrastructure (076, EO 39) all list 030 as their gating predecessor in the reordered sequence [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Dependencies:** Chats 008, 024 (Stage 2 gating prereq is 024 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 31; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Consumed by 063, 081, 076, and 035-W (push-prompt timing).

**End-of-session checks:** Integration tests pass for each scaffolded route. The Stripe Checkout session creation succeeds in test mode. The push token upsert handles both insert and update paths.

### Chat 031 — Waitlist and Referral APIs

*Block 4 · EO 9 · 🔵 · Skills: — · ⇄ 030 · Window N · CD-flags: F3 C*

**Load at session start:** TECHNICAL_SPEC.md §9 (Waitlist, Referral sections); the waitlist and referral_credits table schemas; the `…0009_*` referral migration and `…0002_users.sql` referral-attribution column (the schema behind CD-flag F3).

**Goal:** Implement POST /waitlist (public, rate-limited at the edge), POST /referral/track (public, sets attribution cookie and redirects), and GET /referral/code (authenticated). The waitlist insert returns 409 if the email exists. The referral track endpoint validates the code against users.referral_code (the column is added in chat 095 if not already present in the schema audit from chat 006).

**Output:**
- `apps/web/app/api/v1/waitlist/route.ts` — POST handler that validates email format, checks for duplicates, inserts; 409 on duplicate
- `apps/web/app/api/v1/referral/track/route.ts` — POST handler that validates the code, sets the `vesper_ref` cookie (max-age 30 days, SameSite=Lax, Secure), and returns a 302 redirect to the marketing landing page
- `apps/web/app/api/v1/referral/code/route.ts` — GET handler that returns the authenticated user's referral code with summary statistics

**Implementation notes:** The waitlist endpoint is unauthenticated and rate-limited at the Cloudflare edge (configured in chat 009). The referral track cookie is set with HttpOnly false because the client may want to read it for UTM enrichment; the cookie's value is the referral code only, not any sensitive identifier. The referral code GET handler returns 404 with reason `not_eligible` if the user has never reached an active subscription (referral codes are minted only at paid conversion in chat 095). **CD-flag F3 (consumed):** this chat consumes the referral two-sidedness / attribution-column question — whether `referral_credits` models both sides of a referral and whether `users` carries the referral-attribution column — which Stage 2 carried forward as CANNOT-DETERMINE because the `…0009_*` and `…0002_users.sql` migration bodies were not present in the planning copy [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. The master table tags 031 with `F3 C`; Stage 2 §6 names **111** (the early schema/Zod fix, EO 4) as F3's resolver and lists 031, 095-W, and 111 as the flag's touchpoints [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. Because 111 resolves the schema question at EO 4 and 031 runs at EO 9, this chat consumes a resolved or held determination rather than re-opening it; 095-W (Part 5, EO 87) is the other downstream consumer. **The `CD-flag F3` token is unrelated to the `Fwin F#` window counter** — read field-scoped. **The ⇄ 030 flag is carried from the prior plan:** 031 and 030 were marked parallel-capable; the reorder pulls 031 early (EO 9, a low-dependency referral/waitlist surface needing only built foundation 008/009) while 030 sits at EO 31, so they are no longer EO-adjacent, but the logical-independence the ⇄ records still holds and the Parallelization Map (Part 10) is canonical for actual concurrency. The token is carried as a flag, not reconciled to the new EO distance.

**Dependencies:** Chats 008, 009 (Stage 2 lists no gating unbuilt prereq beyond built foundation; 031 holds F3 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs early at EO 9; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Its referral surface is consumed downstream by 095-W (referral attribution + mint-on-active, EO 87).

**End-of-session checks:** Integration tests pass. Rate limiting fires after the configured threshold. The cookie is set correctly on referral track. The F3 read is reconciled against 111's resolution (or held with an explicit determination) so that 095-W inherits a resolved flag rather than re-opening the referral-attribution question.

---

## Block 5 — Onboarding

Block 5 takes the user from sign-up to landing on a fully populated day view. The flow is screen-by-screen exactly as locked in Layer 4. The voice gate from chat 017 must be active and all hardcoded copy must have passed through it. The resume-state derivation handles users who drop mid-flow and return. Every chat in this block is **split** into a design-track visual/static half (`-V`, inside the design-cluster window) and an build-track wiring half (`-W`, in normal build-track sequence); both halves are documented here, in Block 5, with each half taking its own EO/Model/Window from the master table. The `-V` halves build durable visual surfaces against mocked data and the design system (107/107a); the `-W` halves rewire those surfaces to the real APIs from Block 4 and the integration chains after the design track leaves. A `-V` half is not "done" until its `-W` half ships.

### Chat 032-V — Onboarding Welcome / Auth-Reposition / Honorific (Visual + Reveal)

*Block 5 · EO 16 · 🔵 🟢 🎩 · Skills: caveman, stop-slop · — · Window Y (Fwin F5) · CD-flags: —*

**Load at session start:** PRD §3.1 (Onboarding Flow, Screens 1–3); LAYER_4_EXPERIENCE_IDENTITY.md (Onboarding Flow section, Screens 1, 2, 3); the design system tokens and primitives from chats 107 and 107a; chats 010, 011 (existing auth surfaces being repositioned, as visual reference only); chat 017 (voice gate) for the welcome/honorific copy.

**Goal:** Build the static, design-locked visual surfaces for onboarding screens 1–3 against the design system: the welcome screen with its four-second sequential reveal animation, the authentication screen repositioned within the onboarding flow (visual reposition of the chats 010/011 surface; no new auth wiring), and the honorific selection screen. Output is durable visual, wired to mocked state and reveal timing only — persistence and the state machine are deferred to 032-W.

**Output:**
- `apps/web/app/(onboarding)/welcome/page.tsx` and `apps/mobile/app/(onboarding)/welcome.tsx` — the welcome screen with the sequential reveal animation (1.0s + 0.2s crossfade + 1.0s + 0.2s + 1.4s + 0.3s = ~4 seconds total) and a Begin button that appears at the end; tap-to-skip advances to the button state immediately. Built with `react-native-reanimated` on mobile and Framer Motion on web; timing matches the Layer 4 specification exactly.
- `apps/web/app/(onboarding)/sign-in/page.tsx` and `apps/mobile/app/(onboarding)/sign-in.tsx` — the sign-in screen repositioned into the onboarding flow, showing the three options (Google, Apple, email magic link) in their onboarding-context layout; the underlying auth surfaces are the built chats 010/011, so this half presents them visually in the new position without re-authoring the auth mechanics
- `apps/web/app/(onboarding)/honorific/page.tsx` and `apps/mobile/app/(onboarding)/honorific.tsx` — the honorific selection (Sir, Madam, No honorific) with the small footnote "You can change this anytime in settings", all copy cleared through the voice gate
- Onboarding shell visual chrome (the back-button affordance presentation) consumed by the shell layout, built against 107a primitives

**Implementation notes:** This is a window chat (Fwin F5) and a design-track session; it builds visual surfaces against the design system from 107/107a and mocks the reveal/skip state locally. **The 🎩 flag is propagated here, to the copy-authoring half:** the welcome lines and the honorific footnote are user-facing butler copy that must clear the caveman/stop-slop voice gate at authoring time, so the visual half owns the gate interaction; 032-W adds no new copy and shows `Skills: —`. The auth screen is a reposition of the already-built chats 010/011 surfaces, not new auth code; this half handles only its placement and styling within the onboarding flow. **Window vs CD-flag scoping:** the `Fwin F5` token is the fifth window-chat position and is unrelated to any `CD-flag F#`; this chat carries no CD-flag. Per the design-cluster-window note, every window chat depends only on already-built foundations plus the design system earlier in the same cluster, so this half is unblocked once 107a lands and runs start-to-finish inside the ≤11-day window while the build track builds the backend spine in parallel [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 107, 107a (design system and component library); chat 017 (voice gate, for copy authoring); chats 010, 011 (the built auth surfaces being repositioned, as reference). Stage 2's window-table immediate sequencing predecessor is 107a [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. Runs at EO 16 inside the window; its visual output is the prerequisite for its own wiring half 032-W (EO 46) and is the entry surface 033-V (EO 17) and 036-V (EO 20) sequence after.

**End-of-session checks:** The welcome reveal animation runs at the Layer 4 timing on both web and mobile and tap-to-skip advances to the Begin state. The sign-in screen renders all three options in the onboarding-context layout. The honorific screen renders the three options and the footnote, all copy having cleared the voice gate. All three surfaces compose from 107/107a primitives with no bespoke styling outside the design system. No persistence or state-machine logic is present (deferred to 032-W).

### Chat 032-W — Onboarding State Machine + Auth/Persistence Wiring

*Block 5 · EO 46 · 🟡 🔵 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PRD §3.1 (Onboarding Flow, Screens 1–3); the 032-V visual surfaces; chats 010, 011 (auth flows); chat 024 (profile API, for honorific persistence); chats 012, 013 (shells).

**Goal:** Rewire the 032-V surfaces to real state and persistence: build the onboarding state machine that tracks which screen the user is on (derived from which fields have been populated rather than a separate column), wire the repositioned auth surface to the live chats 010/011 flows, persist the honorific to the users.honorific column via the profile API, and add the analytics emission and resume-state derivation to the onboarding shell.

**Output:**
- `packages/shared/src/onboarding/state.ts` — exports `deriveOnboardingStep(user, profile): OnboardingStep` that returns the screen the user should see next based on which fields are populated (no archetype → step 4; no location_lat → step 6; no sleep_target → step 7; etc.)
- Auth wiring on the repositioned sign-in surface: Google, Apple, and email magic link all functional on both surfaces (Apple uses the web redirect flow on web and the native `expo-apple-authentication` dialog on mobile per chats 010 and 011)
- Honorific persistence: the honorific selection writes to the users.honorific column via the PUT /profile endpoint (chat 024)
- `apps/web/app/(onboarding)/layout.tsx` and `apps/mobile/app/(onboarding)/_layout.tsx` — the onboarding shell that handles the back-button affordance behavior, the analytics emission (`onboarding_step_completed` event per screen), and the resume state derivation on entry

**Implementation notes:** The resume state derivation is the key architectural choice; rather than storing `onboarding_step` on the users table (which would require a schema migration and would be redundant with the fields themselves), the step is derived from which fields exist. This is robust to the user signing in on a second device mid-flow. The back-button affordance respects the linear flow; pressing back at screen 5 returns to screen 4 without losing data already entered. This wiring half adds no new user-facing copy and so carries no 🎩 flag; the copy that exists came through the gate in 032-V. The shared state machine lands in `@vesper/shared` (🟡); the auth and persistence wiring touch web (🔵) and mobile (🟢).

**Dependencies:** Chats 024, 032-V (Stage 2 gating prereqs are 024 and 032-V [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]); built foundations 010, 011, 012, 013, 017 assumed satisfied. Runs at EO 46; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. It is the gating predecessor for 033-W (EO 47).

**End-of-session checks:** A new user can complete screens 1 through 3 on both web and mobile with live auth. The honorific is persisted to the users.honorific column. Refreshing the app on screen 3 returns to screen 3 (resume state works via `deriveOnboardingStep`). Analytics events fire for each step completion. The 032-V visual surfaces are now backed by real state and persistence, completing the 032 pair.

### Chat 033-V — Onboarding Screen 4: Archetype Tiles (Visual)

*Block 5 · EO 17 · 🔵 🟢 · Skills: — · — · Window Y (Fwin F6) · CD-flags: —*

**Load at session start:** PRD §3.1 (Screen 4); LAYER_4_EXPERIENCE_IDENTITY.md (Screen 4); the archetype enum values; the design system tokens and primitives from 107/107a.

**Goal:** Build the static archetype selection screen against the design system: six tab-style tiles (Nine-to-Five Professional, Remote Worker, Student, Athlete-Focused, Founder Mode, Mixed) with their selected/unselected visual states. Selection is visual only at this stage — the persistence and branch routing are deferred to 033-W.

**Output:**
- `apps/web/app/(onboarding)/archetype/page.tsx` and `apps/mobile/app/(onboarding)/archetype.tsx` — the six archetype tiles, implemented with the Layer 4 styling tokens (bronze for selected state, cream on espresso otherwise), composed from 107a primitives, with local-only selection state

**Implementation notes:** Window chat (Fwin F6), design-track. The tile UI is the durable visual surface; the branch logic and the PUT /profile write are deferred to 033-W. No user-facing freeform copy beyond the tile labels (which are fixed product nomenclature), so no 🎩 flag. **Window vs CD-flag scoping:** `Fwin F6` is the sixth window-chat position; this chat carries no CD-flag.

**Dependencies:** Chats 107, 107a (design system); 032-V (Stage 2's window-table sequencing predecessor [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 17 inside the window; its visual output gates its own wiring half 033-W (EO 47) and is the sequencing predecessor for 034-V (EO 18) and 035-V (EO 19).

**End-of-session checks:** The six archetype tiles render with correct selected/unselected styling on both web and mobile, composed from 107/107a primitives. Local selection state toggles correctly. No persistence or branch routing is present (deferred to 033-W).

### Chat 033-W — Archetype 5A/5B Branch Routing

*Block 5 · EO 47 · 🟡 🔵 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PRD §3.1 (Screen 4 branch logic); the 033-V visual surface; chat 024 (profile API); 032-W (onboarding state machine).

**Goal:** Wire the 033-V archetype tiles to persistence and branch routing: on selection, write the archetype to the users table via the PUT /profile endpoint and determine the next screen via the branch logic that sends users with implied existing planning surfaces to screen 5A (calendar-connected branch) and others to screen 5B (no-existing-plan branch).

**Output:**
- `packages/shared/src/onboarding/branch.ts` — exports `getOnboardingBranch(archetype: ArchetypeEnum): 'calendar-connected' | 'no-existing-plan'` per the PRD logic
- Wiring on the 033-V tiles: on selection, the archetype is written to the users table via the PUT /profile endpoint and the next screen is determined by the branch logic

**Implementation notes:** The branch logic per PRD: nine-to-five, remote, athlete, founder, and mixed go to the calendar-connected branch (5A); only student goes to the no-existing-plan branch (5B) by default, though the user can skip 5A and effectively land in the same place as 5B. Rationale for routing Mixed to 5A specifically: Mixed-archetype users typically come from professional-plus-personal calendar realities where at least one calendar (work or personal) is connectable; offering the connect surface first respects that reality and gives users without a connectable calendar a single tap (the Skip option in 5A) to land in 5B's effective state without forcing two-branch authoring of the same content. This wiring half adds the `branch.ts` logic to `@vesper/shared` (🟡) and the persistence/navigation wiring on web (🔵) and mobile (🟢).

**Dependencies:** Chats 033-V, 032-W, 024 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 47; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Completes the 033 pair.

**End-of-session checks:** Each archetype selection routes correctly to 5A or 5B per `getOnboardingBranch`. The archetype persists via PUT /profile. The next screen renders. The 033-V tiles are now backed by real persistence and branch routing.

### Chat 034-V — Onboarding Screens 5 and 6: Calendar-Connect / Walkthrough / Location (Static)

*Block 5 · EO 18 · 🔵 🟢 · Skills: — · — · Window Y (Fwin F7) · CD-flags: —*

**Load at session start:** PRD §3.1 (Screens 5A, 5B, 6); LAYER_4_EXPERIENCE_IDENTITY.md (corresponding screens); the design system tokens and primitives from 107/107a; chat 017 (voice gate) for the location rationale copy.

**Goal:** Build the static visual surfaces for the calendar branching screens and the location capture screen: screen 5A (the "Connect Google Calendar" CTA presentation with a skip option), screen 5B (the three-screen walkthrough explaining how to enter fixed events into the built-in calendar), and screen 6 (the location capture surface with its iOS permission-rationale screen). All static — the OAuth initiation, geolocation capture, and calendar-event classification are deferred to 034-W.

**Output:**
- `apps/web/app/(onboarding)/calendar/page.tsx` and `apps/mobile/app/(onboarding)/calendar.tsx` — the 5A/5B presentation surface (the branch selection itself is wired in 034-W; this half builds both branch presentations)
- `apps/web/app/(onboarding)/calendar/walkthrough/[step]/page.tsx` and `apps/mobile/app/(onboarding)/calendar/walkthrough/[step].tsx` — the three-screen walkthrough for the 5B branch
- `apps/web/app/(onboarding)/location/page.tsx` and `apps/mobile/app/(onboarding)/location.tsx` — the location capture screen presentation
- A rationale screen before the iOS location permission prompt; per the L4 copy library the copy is "Vesper uses your location to personalise your schedule," cleared through the voice gate at authoring

**Implementation notes:** Window chat (Fwin F7), design-track. The walkthrough and connect/location screens are durable visual surfaces built against 107/107a; the OAuth flow, the actual geolocation capture, and the calendar-branch wiring are deferred to 034-W because they depend on the GCal integration chain (063/064) that is unbuilt during the window. The location rationale copy clears the voice gate here, but the original chat carried no 🎩 flag, so this half follows the original and shows `Skills: —`; the single rationale line is fixed L4 copy rather than a copy-heavy butler surface. **Window vs CD-flag scoping:** `Fwin F7` is the seventh window-chat position; no CD-flag.

**Dependencies:** Chats 107, 107a (design system); chat 017 (voice gate, for the rationale line); 033-V (Stage 2's window-table sequencing predecessor [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 18 inside the window; its visual output gates its own wiring half 034-W (EO 52). **Note the asymmetry:** the visual half is fully buildable inside the window with no GCal dependency, but its wiring half carries a hard Critical-Path dependency on the GCal chain — see 034-W.

**End-of-session checks:** The 5A connect surface, the 5B three-screen walkthrough, and the screen-6 location surface (with its rationale screen) all render on both web and mobile, composed from 107/107a primitives, with the rationale copy cleared through the voice gate. No OAuth, geolocation capture, or calendar-branch wiring is present (deferred to 034-W).

### Chat 034-W — Onboarding Calendar-Branch + Geolocation Wiring

*Block 5 · EO 52 · 🔵 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PRD §3.1 (Screens 5A, 5B, 6); TECHNICAL_SPEC.md §6 (Google Calendar OAuth flow); the 034-V visual surfaces; 033-W (branch routing); chat 063 (GCal OAuth + pgsodium); chat 064 (GCal sync + token refresh + classification); the Critical Path section (canonical for the 034 → 063/064 back-reference).

**Goal:** Wire the 034-V surfaces to live behavior: initiate the Google Calendar OAuth flow from screen 5A (creating the integrations row, encrypting OAuth tokens via pgsodium, and returning the user to the onboarding flow with the integration active), capture device geolocation on screen 6 (browser Geolocation API on web, expo-location on mobile) writing lat/lng to the user row with a manual/skip path storing null, and wire the 5A/5B branch selection to the 033-W routing.

**Output:**
- Calendar-branch wiring on `apps/web/app/(onboarding)/calendar/page.tsx` and `apps/mobile/app/(onboarding)/calendar.tsx` — branches into 5A or 5B based on the archetype (using 033-W's `getOnboardingBranch`) and initiates the chat-063 Google OAuth flow from the 5A CTA
- Geolocation wiring on `apps/web/app/(onboarding)/location/page.tsx` and `apps/mobile/app/(onboarding)/location.tsx` — browser Geolocation API (web) and expo-location (mobile); stores lat/lng to the user row; manual skip stores null

**Implementation notes:** The calendar OAuth from 5A initiates the same Google OAuth flow built in chat 063 with full functionality: the integrations row is created, OAuth tokens are encrypted via pgsodium, and the user is returned to the onboarding flow with the integration active. **Critical Path back-reference (restated inline, Critical Path section canonical):** this requires chat 063 to ship before 034-W in the build order, and chat 064 (token refresh and calendar-event classification) must also exist before onboarding can finish with a connected calendar that does anything meaningful with its events — so the ordering is 063 → 064 → 034. This is one of the late-binding back-references the Part 1 How-to-Use list enumerates (034 → 063/064), and the **Critical Path section (Part 10) remains canonical** for it; this inline restatement enforces the rule at the per-chat level, and the master table places 063 at EO 37 and 064 at EO 44, both before 034-W at EO 52, satisfying the constraint [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. The rationale screen before the iOS location permission prompt (built visually in 034-V) is an iOS HIG best practice. This wiring half adds no new copy and so carries no 🎩 flag.

**Dependencies:** Chats 033-W, 063, 064 (Stage 2 gating prereqs; the 063/064 pair is the hard Critical-Path dependency, ordering 063 → 064 → 034 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 52, after 063 (EO 37) and 064 (EO 44). The later-numbered hard dependencies are restated above and the Critical Path section is canonical. It is the gating predecessor for 035-W (EO 53).

**End-of-session checks:** A user on the calendar-connected branch can connect Google Calendar (or skip) with the OAuth flow creating the integration and encrypting tokens. A user on the no-existing-plan branch sees the three-screen walkthrough. Location capture works on both web (browser Geolocation or skip) and mobile (expo-location permission prompt or skip). Lat/lng writes correctly to the user row. The 034-V surfaces are now backed by the live GCal and geolocation behavior, completing the 034 pair.

### Chat 035-V — Onboarding Screens 7 through 11: Preferences, Modules, Trial (Forms, Mocked)

*Block 5 · EO 19 · 🔵 🟢 🎩 · Skills: caveman, stop-slop · — · Window Y (Fwin F8) · CD-flags: —*

**Load at session start:** PRD §3.1 (Screens 7–11); LAYER_4_EXPERIENCE_IDENTITY.md (corresponding screens); PRD §6 (each module's onboarding preferences); LAYER_2_PRODUCT_SCOPE.md (Pillar 2 default state per module); the 111-corrected notification-preferences shape (this half reflects it); the design system tokens and primitives from 107/107a; chat 017 (voice gate) for the screen copy.

**Goal:** Build the static, mocked form surfaces for screens 7 (sleep target with two time pickers), 8 (goals with three open text fields), 9 (module toggles with all seven modules, six default ON and finance default OFF), 10 (per-module quick preferences for the enabled modules), and 11 (trial confirmation). All forms are visually complete and mocked — persistence, the push-permission prompt timing, and the trial-state writes are deferred to 035-W. The module-preference forms reflect the 111-corrected notification-preferences shape so the wiring half persists without field drift.

**Output:**
- `apps/web/app/(onboarding)/sleep/page.tsx` and `apps/mobile/app/(onboarding)/sleep.tsx` — two time pickers, built from 107a picker primitives
- `apps/web/app/(onboarding)/goals/page.tsx` and `apps/mobile/app/(onboarding)/goals.tsx` — three open text fields
- `apps/web/app/(onboarding)/modules/page.tsx` and `apps/mobile/app/(onboarding)/modules.tsx` — the module toggles for all seven modules, presenting six default-ON and finance default-OFF
- `apps/web/app/(onboarding)/preferences/[moduleId]/page.tsx` and the mobile equivalents — the per-module quick preference sub-flow forms (fitness: goal, equipment, level, days-per-week; nutrition: dietary restrictions, cooking-time tolerance, dislikes; medications: optional add-one; errands: initial recurring chores; finance, if enabled: first bill entry), all mocked; the forms reflect the 111-corrected notification-preferences shape
- `apps/web/app/(onboarding)/trial/page.tsx` and `apps/mobile/app/(onboarding)/trial.tsx` — the trial confirmation CTA presentation
- The push notification permission rationale screen presentation on mobile (the prompt timing/firing is wired in 035-W)

**Implementation notes:** Window chat (Fwin F8), design-track. The per-module preference sub-flow is a non-trivial UI piece: for each enabled module, the user sees one or two screens of preferences, and this half builds all of them as mocked forms against 107a primitives. **The 🎩 flag is propagated here, to the copy-authoring half:** the screen copy and module-preference labels are user-facing butler copy cleared through the caveman/stop-slop gate at authoring time, so the visual half owns the gate interaction; 035-W adds no new copy and shows `Skills: —`. **The forms reflect the 111-corrected notification-preferences shape** per Stage 2's window-table note, so 035-W persists without field drift [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. **Window vs CD-flag scoping:** `Fwin F8` is the eighth window-chat position and is unrelated to any `CD-flag F#`; this chat carries no CD-flag despite reflecting the 111 fix (the 111 reflection is a shape-consumption note, not a carried-forward CANNOT-DETERMINE flag).

**Dependencies:** Chats 107, 107a (design system); chat 017 (voice gate); 033-V (Stage 2's window-table sequencing predecessor [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]); reflects the 111-corrected notification-preferences shape. Runs at EO 19 inside the window; its visual output gates its own wiring half 035-W (EO 53).

**End-of-session checks:** Screens 7–11 render on both web and mobile for every archetype, composed from 107/107a primitives, with all copy cleared through the voice gate. The module toggles present six default-ON and finance default-OFF. The per-module preference forms reflect the 111-corrected notification-preferences shape. No persistence, trial-state write, or push-prompt firing is present (deferred to 035-W).

### Chat 035-W — Module-Prefs Persistence + Push-Prompt Timing

*Block 5 · EO 53 · 🔵 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PRD §3.1 (Screens 7–11); PRD §6 (module onboarding preferences); the 035-V form surfaces; chat 024 (profile API); chat 030 (push-token scaffolds); 034-W (preceding onboarding wiring).

**Goal:** Wire the 035-V forms to persistence and the push-permission prompt: persist each screen's data (sleep targets, goals, module toggles, per-module preferences) to `user_profiles.base_profile` and `user_profiles.modules_enabled` via the profile API, fire the contextual push-notification permission prompt at the decided moment (after module preferences are captured but before plan generation), and wire the trial confirmation to set `trial_started_at` and compute/store `trial_ends_at`.

**Output:**
- Persistence wiring across the screen-7–11 forms: each module's sub-flow writes to `user_profiles.modules_enabled`; the PUT /profile endpoint is called once per sub-flow to update the JSONB atomically; sleep targets and goals write to `user_profiles.base_profile`
- The push notification permission prompt firing on mobile (after preferences, before trial confirmation), using expo-notifications; if denied, the user can still complete onboarding and the medication module's notification feature is degraded with a banner explaining the limitation
- Trial confirmation wiring: sets `trial_started_at` to the current time and records the user's explicit acknowledgment of the 7-day trial window; computes and stores `trial_ends_at = trial_started_at + interval '7 days'` at the same time

**Implementation notes:** The trial confirmation does NOT change subscription_status (the handle_new_user trigger already set it to `trial` at sign-up per Tech Spec); the confirmation step only sets the trial_started_at timestamp and records acknowledgment. The trial_ends_at field is stored at the same time so downstream queries (chat 072 trial-reminder worker, chat 089 day-6 prompt) read a stable end-of-trial timestamp. The push-permission prompt timing is the architectural decision encoded here: it fires after module preferences are captured but before plan generation, so the user has agency over the prompt timing. This wiring half adds no new copy (the degraded-state banner copy came through the gate in 035-V), so it carries no 🎩 flag.

**Dependencies:** Chats 034-W, 024, 030 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 53; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. It is a widely-consumed predecessor: chats 044-W (honorific-aware butler line), 059a (sleep module), 100 (error states 2), and 105a (demo account provisioning) all list 035-W as a gating predecessor in the reordered sequence [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. Completes the 035 pair.

**End-of-session checks:** A new user can complete all five screens for each archetype with live persistence. The `user_profiles.base_profile` JSONB and `modules_enabled` JSONB are populated correctly and without field drift from the 111-corrected shape. The trial confirmation sets `trial_started_at` and stores `trial_ends_at`. The push permission prompt fires at the correct moment (after preferences, before plan generation). The 035-V forms are now backed by real persistence, completing the 035 pair.

### Chat 036-V — First-Plan Cinematic Loading + Reveal + Tour (Mock Plan)

*Block 5 · EO 20 · 🔵 🟢 🎩 · Skills: caveman, stop-slop · — · Window Y (Fwin F9) · CD-flags: —*

**Load at session start:** PRD §3.1 (first plan and tour); LAYER_4_EXPERIENCE_IDENTITY.md (Screen 12 and feature tour); the design system tokens and primitives from 107/107a; chat 017 (voice gate) for the loading and tour copy.

**Goal:** Build the static, design-locked first-plan experience against a mock plan: the streaming-skeleton loading screen (shimmer placeholders with voice-gated loading copy), the cinematic reveal of the first plan, and the feature tour (four to five swipeable screens covering mark complete, NL input, Dynamic Island, weekly planner; all skippable at any point). The real plan-generation trigger and SSE streaming are deferred to 036-W; this half uses a canned mock plan to build the loading/reveal/tour choreography.

**Output:**
- `apps/web/app/(onboarding)/generating/page.tsx` and `apps/mobile/app/(onboarding)/generating.tsx` — the streaming-skeleton screen with voice-gated copy ("Setting up your day, [honorific].") and a progress indicator; built to animate as if SSE chunks were arriving, driven by a mock-plan sequence rather than the real stream
- `apps/web/app/(onboarding)/tour/[step]/page.tsx` and the mobile equivalents — four to five tour screens with skip option, copy cleared through the voice gate
- The cinematic first-plan reveal choreography against the mock plan, composed from 107a primitives

**Implementation notes:** Window chat (Fwin F9), design-track. The streaming skeleton is a critical UX moment; users wait roughly five to fifteen seconds for the plan to generate, and the skeleton must feel intentional and calm rather than slow. The blocks render in placeholder form (gray rectangles with subtle shimmer) and fill in as the (mocked, in this half) SSE sequence progresses. The voice-gated copy rotates through three or four lines during the generation; the tour content is hardcoded copy describing each feature in one or two sentences with a small visual or icon. **The 🎩 flag is propagated here, to the copy-authoring half:** the rotating loading lines and the tour copy are user-facing butler copy cleared through the caveman/stop-slop gate at authoring time; 036-W adds no new copy and shows `Skills: —`. **Window vs CD-flag scoping:** `Fwin F9` is the ninth window-chat position; no CD-flag. This half is fully buildable inside the window because it depends only on the design system and a mock plan; the real plan-generation API (chat 025) is unbuilt during the window and is wired in 036-W.

**Dependencies:** Chats 107, 107a (design system); chat 017 (voice gate); 032-V (Stage 2's window-table sequencing predecessor [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 20 inside the window; its visual output gates its own wiring half 036-W (EO 63).

**End-of-session checks:** The generating-skeleton screen animates calmly through the mock-plan sequence with voice-gated rotating copy on both web and mobile. The cinematic reveal plays against the mock plan. The tour renders four to five swipeable screens with skip available, all copy cleared through the voice gate. No real plan-generation trigger or SSE wiring is present (deferred to 036-W).

### Chat 036-W — First-Plan Real Synthesis Trigger Wiring

*Block 5 · EO 63 · 🔵 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PRD §3.1 (first plan and tour); the 036-V visual surfaces; chat 025 (plan generation API, SSE); 035-W (preceding onboarding wiring); chat 022 (synthesizePlan, the real synthesis behind 025).

**Goal:** Rewire the 036-V loading/reveal/tour choreography to the real plan-generation pipeline: trigger the user's first plan generation at the end of onboarding by calling POST /plans/generate, stream the real SSE response into the skeleton, drive the reveal from the real chunks, show the feature tour after the plan completes, and land the user on the day view.

**Output:**
- `apps/web/lib/firstPlan.ts` and the mobile equivalent — the orchestration: call POST /plans/generate (chat 025) with the user's onboarding-derived energy default of 5, stream the real response into the 036-V skeleton, navigate to the tour on completion, navigate to day view on tour completion or skip
- Wiring on the 036-V generating and tour surfaces to consume the real stream and the real completion/skip transitions

**Implementation notes:** This half replaces 036-V's mock-plan sequence with the real synthesizePlan-backed stream from chat 025. The skeleton's shimmer-and-fill choreography (built in 036-V) now fills from the real SSE chunks; the reveal plays against the real plan. The tour content is unchanged (it came through the gate in 036-V), so this wiring half carries no 🎩 flag. The energy default of 5 is the onboarding-derived starting value passed to the generation call.

**Dependencies:** Chats 035-W, 025 (Stage 2 gating prereqs; "needs 025" per the split table [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]); chat 022 (the real synthesis the generation route uses) assumed via 025. Runs at EO 63; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Completes the 036 pair and is the last screen of the onboarding flow before the day view.

**End-of-session checks:** A fresh user completes onboarding and sees a streaming first plan driven by the real SSE response. The plan completes successfully (using the real synthesizePlan from chat 022 via the chat-025 route). The tour renders correctly with skip available. The user lands on the day view. The 036-V choreography is now backed by the real generation pipeline, completing the 036 pair and closing the Block 5 onboarding flow.

## Block 6 — Plan Experience

Block 6 builds the core daily surface of the application: the Supabase Realtime client that subscribes to block changes for live sync across devices, the TanStack Query offline mutation queue that handles connectivity loss with conflict resolution, the plan day view on both surfaces, the per-block-type detail layouts, block actions, drag-and-drop reorder, the ambient butler line, natural-language input, and the week view plus the evening/morning/energy/quiet-hours surfaces. The re-plan leaves the block's organization and every chat number untouched but splits three of its chats — **041**, **044**, and **046** — each into a design-track visual/static half (`-V`, inside the design-cluster window) and an build-track wiring half (`-W`, in normal build-track sequence). Both halves of each split chat are documented here, in Block 6; the split is a sequencing and ownership device, not a relocation, and any existing reference to `041`, `044`, or `046` resolves to the corresponding pair. Execution order is governed by the EO column of the master reordered-sequence table in Part 1, not by the order entries appear in this block: the three `-V` halves run early inside the design-cluster window (EO 21–23, `Fwin F10`–`F12`) while the wiring halves and the unsplit chats run later on the build track. The remaining chats (037, 038, 039, 040, 042, 043, 045) are single build-track sessions taking their real master-table EO and model. None of the chats in this block is governed by a Critical Path late-binding back-reference, and none depends on a later-EO chat, so the Critical Path caveat does not bind any Block 6 entry; the Critical Path section remains canonical for the specific back-references it has always governed.

### Chat 037 — Supabase Realtime Client Setup

*Block 6 · EO 36 · 🟡 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §11 (Realtime and Offline); chat 013 (mobile shell with app lifecycle hook); chat 026 (plan retrieval); chat 004 (the blocks migration that added `client_mutation_id` and set `REPLICA IDENTITY FULL`); chat 006 (the publication-RLS audit script).

**Goal:** Build the Supabase Realtime client abstraction shared between web and mobile. The client subscribes to changes on the blocks table filtered to the current plan's user and date, provides a self-mutation filter so the device's own writes are not re-applied, integrates with TanStack Query so incoming changes invalidate the relevant queries, handles reconnection on network blips, and respects the mobile lifecycle (suspend on background, resume on foreground).

**Output:**
- `packages/shared/src/realtime/client.ts` — exports `createRealtimeClient()` returning a typed client with `subscribeToBlocks(userId, planDate, onUpdate)` and `unsubscribe()` methods
- `packages/shared/src/realtime/selfMutationFilter.ts` — utility that maintains a sliding-window set of recent `client_mutation_id` values the device has generated (one mutation id minted per outbound mutation request, attached to the request, written to the `blocks.client_mutation_id` column by the API route, and echoed in the Realtime broadcast); incoming events whose `client_mutation_id` matches the local set are dropped because the device already applied them optimistically and re-applying would produce visible flicker or a double-apply. The window expires entries after 60 seconds (raised from the prior 30-second value to tolerate longer network stalls and background-then-foreground refetch windows on mobile)
- `apps/web/hooks/usePlanRealtime.ts` and `apps/mobile/hooks/usePlanRealtime.ts` — React hooks that subscribe to Realtime for the current plan, integrate with TanStack Query invalidation, and handle the mobile lifecycle (the mobile hook uses the `useAppLifecycle` hook from chat 013). Both hooks emit PostHog event `realtime_connection_state_changed` on every subscription state transition (subscribing, subscribed, error, closed, reconnecting) with payload `{state, reason, plan_date, retry_count}`, and a Sentry breadcrumb on any non-recoverable error so "edits from my other device aren't showing up" reports can be triaged against actual connection state. The event is added to chat 096's PostHog taxonomy

**Implementation notes:** The Realtime subscription is configured with a filter on the blocks table (`daily_plan_id=eq.{planId}`, computed from user and plan date at subscription time) so the device receives only its own plan's rows; without filtering, every block change for every user would broadcast and exhaust the free tier quickly. The self-mutation filter relies on the `client_mutation_id` column from chat 004's blocks migration. Every block mutation API route (PATCH /blocks, POST /blocks, and the batch reorder endpoint from chat 029) accepts a `clientMutationId` header from the device, writes it into the row, and the Realtime broadcast carries the full updated row (because of `REPLICA IDENTITY FULL` on blocks from chat 004) including that column. The TanStack Query integration invalidates `['plan', planDate]` on incoming changes that pass the filter; the next read refetches the full plan. The mobile lifecycle hook suspends the subscription on background (cleaning up the websocket) and resumes on foreground (re-subscribing); on foreground it also explicitly invalidates the `['plan', currentDate]` query so broadcasts that occurred while the websocket was suspended are picked up via refetch — without this explicit invalidation the resume-then-no-changes path silently misses background updates. Without the background suspend, the websocket persists in background and burns battery and Supabase Realtime connection quota. Security model: Realtime broadcasts bypass the API layer entirely; their only gate is the RLS policy on the broadcast (publication) table, and the chat 006 audit script explicitly verifies that RLS gates the publication — not only direct SELECT — so a misconfigured publication policy that broadcasts cross-user rows fails the audit before reaching production. This chat carries ⚠️ because Realtime reconnection logic, self-mutation filtering, and lifecycle management are subtle and their failure modes (stale data, echoed self-edits) are silent; the Risk Map is canonical for why, and the chat carries elevated-risk handling.

**Dependencies:** Chats 007, 013, 026 (plus the built blocks migration and publication-RLS audit from chats 004 and 006). All prerequisites sit at a lower EO; no later-EO dependency.

**End-of-session checks:** Two devices signed into the same account see each other's block updates in real time (within one second). Backgrounding the mobile app stops the websocket; foregrounding resumes it and refetches missed changes. Self-mutations do not echo.

### Chat 038 — TanStack Query Offline Mutation Queue and Conflict Resolution

*Block 6 · EO 45 · 🟡 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §11 (Offline Behavior); chat 027 (optimistic concurrency); chat 013 (TanStack Query persistence on mobile); chat 037 (the Realtime client and self-mutation filter this queue interleaves with).

**Goal:** Build the offline mutation queue using TanStack Query's `mutationCache` with custom retry on reconnect. An edit made offline queues locally and the UI updates optimistically; on reconnect the queue flushes in order, and mutations that fail with 409 Optimistic Lock Failure trigger a refresh and a voice-gated toast. The queue persists across app cold starts on mobile via AsyncStorage.

**Output:**
- `packages/shared/src/queries/mutationQueue.ts` — configuration for TanStack Query's `mutationCache` with custom retry logic, persistence (mobile only), and conflict toast emission
- `apps/web/lib/queries/queryClient.ts` and `apps/mobile/lib/queries/queryClient.ts` updated to use the configured mutation cache
- `packages/shared/src/queries/conflictToast.ts` — utility that emits a toast through the UI store with the voice-gated conflict copy
- PostHog emission on the offline-queue lifecycle: `offline_queue_flush_started` (carrying `{queued_mutation_count}`) when reconnect triggers the flush, and `offline_queue_flush_completed` (carrying `{succeeded_count, conflict_count, network_error_count, total_duration_ms}`) when the flush settles. Without these, "the offline queue silently dropped my edits" cannot be distinguished from unusually consistent network. Events are added to chat 096's PostHog taxonomy

**Implementation notes:** TanStack Query's `mutationCache` exposes serializable state; the mobile implementation writes the cache to AsyncStorage on every mutation and rehydrates on cold start. The custom retry uses exponential backoff on network errors but does not retry 4xx errors (client mistakes). The 409 handling is special: instead of retrying, it triggers a query invalidation and a toast. The toast utility coalesces multiple 409 events fired within a five-second window into a single message so flushing a long offline queue does not produce a flood of redundant notifications; the coalesced toast reads "Refreshed — your other device made changes," the single-event toast reads "Your other device edited this — refreshed," and both pass through the voice gate. This chat carries ⚠️ for the same reason as 037 (silent-failure surface) plus the added complexity of mobile persistence and reconnect-time conflict resolution; the Risk Map is canonical and elevated-risk handling applies.

**Dependencies:** Chats 037, 027, 013. All at lower EO; no later-EO dependency.

**End-of-session checks:** Going offline mid-edit queues the mutation. Coming back online flushes it in order. A deliberate 409 scenario produces the (coalesced or single) toast and refreshes the query. The mobile queue survives a cold start.

### Chat 039 — Plan Day View on Web

*Block 6 · EO 48 · 🔵 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PRD §3.2 (Daily Journey); LAYER_4_EXPERIENCE_IDENTITY.md (plan view design); chats 037, 038 (Realtime and offline); chat 026 (plan retrieval); chat 012 (web shell).

**Goal:** Build the web plan view as a vertical block timeline with Realtime sync wired, a streaming render hook for the first plan or regenerations, an empty state when no plan exists, a loading skeleton during SSE, and day-rollover logic that advances the displayed date at local midnight.

**Output:**
- `apps/web/app/(app)/page.tsx` — the day view page
- `apps/web/components/plan/BlockTimeline.tsx` — the vertical block list component
- `apps/web/components/plan/BlockCard.tsx` — individual block card with type-specific styling
- `apps/web/components/plan/PlanSkeleton.tsx` — the loading skeleton shown during SSE
- `apps/web/components/plan/PlanEmpty.tsx` — the empty state shown when no plan exists
- `apps/web/hooks/useDayRollover.ts` — hook that detects local midnight and advances the displayed date; uses both a `document.visibilitychange` listener (immediate advancement when the tab returns to foreground after midnight) and a 60-second polling fallback (because browser timers may be throttled or stopped when the tab is backgrounded for long periods, so a single `setTimeout` to the next midnight cannot be trusted to fire)

**Implementation notes:** The block timeline is ordered by `start_time` ascending with `displayOrder` as a tiebreaker; blocks render with their type-specific icon, title, time range, and current status. The empty state distinguishes "no plan generated yet for today" (with a generate CTA) from "no plan can be generated right now" (with the fallback apology line if applicable). The loading skeleton renders placeholder cards that fill in as SSE chunks arrive. The day-rollover hook computes the next local midnight, advances the date when reached, and fires a new plan query for the new date. The component composes the design-system primitives produced earlier in the design-cluster window (107/107a); its block-detail expansion targets the layouts delivered by 041-V and wired by 041-W, but the day view itself only needs the timeline and card shells to function.

**Dependencies:** Chats 037, 038, 026, 012. All at lower EO; no later-EO dependency.

**End-of-session checks:** The day view renders a real plan correctly. The empty state renders when no plan exists. Streaming a new plan via the API shows the skeleton animation. Day rollover at local midnight advances correctly via both the visibility listener and the polling fallback.

### Chat 040 — Plan Day View on Mobile

*Block 6 · EO 49 · 🟢 · Skills: — · ⇄ 039 · Window N · CD-flags: —*

**Load at session start:** Same as chat 039 plus mobile design considerations (touch targets, pull-to-refresh); chat 013 (mobile shell and persisted query client).

**Goal:** Build the mobile equivalent of the day view at parity with the web. Add pull-to-refresh, swipe gestures on blocks for quick actions, and Reanimated layout animations for block changes (a rescheduled block slides smoothly to its new position rather than jumping).

**Output:**
- `apps/mobile/app/(tabs)/index.tsx` — the day view tab
- `apps/mobile/components/plan/BlockTimeline.tsx` and `BlockCard.tsx` with mobile-specific styling and gestures
- `apps/mobile/components/plan/PlanSkeleton.tsx` and `PlanEmpty.tsx`
- `apps/mobile/hooks/useDayRollover.ts` — shared rollover logic with web, but listening via expo-notifications local triggers or app lifecycle rather than `visibilitychange`

**Implementation notes:** Reanimated's layout animations are configured at the `BlockTimeline` level so any list reorder produces a smooth transition. Pull-to-refresh attempts the refetch unconditionally rather than pre-gating on `NetInfo.isConnected`; if the fetch errors (no network) the cached plan from chat 013's `persistQueryClient` remains rendered and a 2-second voice-gated toast displays "Showing your saved plan" — no spinner, no error state. The pre-gate-then-refetch pattern was rejected because `NetInfo` state can be stale across captive-portal transitions and the unconditional-attempt-then-handle-error pattern is simpler and produces the same UX on the actual-offline path. Swipe gestures on a block reveal action buttons (complete, skip, reschedule) without requiring an expand step. This chat is marked ⇄ 039: web and mobile day view share no code that forces sequencing and can run on separate terminals concurrently; the Parallelization Map is canonical for the concurrency.

**Dependencies:** Chats 037, 038, 026, 013. Parallel with chat 039. All at lower EO; no later-EO dependency.

**End-of-session checks:** The day view renders correctly on the iOS Simulator. Pull-to-refresh works (including the offline cached-plan path). Swipe gestures reveal actions. Reanimated animations are smooth.

### Chat 041-V — Block Detail Views for All Ten Block Types (Visual / Static)

*Block 6 · EO 21 · 🔵 🟢 · Skills: — · — · Window Y (Fwin F10) · CD-flags: —*

**Load at session start:** PRD §4 and §6 (each module's block-detail content); the committed `BlockDetailsSchema` (the `block_details` JSONB Zod discriminated union from chat 006); the design system and component library from 107/107a (earlier in the same design-cluster window); `docs/DESIGN_STRATEGY.md` from chat 106.

**Goal:** Build the expanded block-detail layouts for each of the ten `block_type` values (work, fitness, nutrition, sleep, errands, medication, finance, focus, commute, custom) as static, design-locked surfaces composed from the 107a primitives and typed against the committed `BlockDetailsSchema`. This is the visual half: each layout renders against mocked or schema-shaped sample data, with no retrieval wiring — the binding to real retrieved block data is deferred to 041-W. As a design-cluster-window chat (Fwin F10) it depends only on already-built foundations plus the design system and runs while the build track builds the backend spine in parallel.

**Output:**
- `apps/web/components/plan/details/` and `apps/mobile/components/plan/details/` directories with one component per block type, each composed from 107a primitives and rendered against schema-shaped sample data
- A discriminated dispatcher component `BlockDetail.tsx` on each surface that selects the appropriate detail view based on the block's `blockType` field
- Empty/minimal states for each block type (e.g. a fitness block with no template detail renders a generic "exercise block" state)

**Implementation notes:** The discriminated union in the `BlockDetailsSchema` (chat 006) flows through to the UI; each detail component is typed against its specific branch so TypeScript catches mismatches at compile time. Detail views are designed to be scannable rather than information-dense — the goal is that the user knows what to do without reading carefully. Per the Stage-2 objection on `-V`/`-W` separability, this `-V` half is deliberately built against the **already-committed** `BlockDetailsSchema` rather than a speculative shape, so if the data contract is stable the wiring half is pure plumbing and the durable-visual claim holds; if `BlockDetailsSchema` shifts during wiring, the rework is concentrated here where the dependency is explicit, not hidden. The errands layout is a flat checklist of stops ordered by deadline (no routing or sequencing — the local intelligence layer is removed from V1). The design track owns the visual and static composition; it does not wire retrieval. The original chat 041 carried no 🎩 flag (the detail layouts are scannable structure, not copy-heavy butler surfaces), so this half follows the original and shows `Skills: —`. **Window vs CD-flag scoping:** `Fwin F10` is the tenth window-chat position and is unrelated to any `CD-flag F#`; this chat carries no CD-flag, and the `Fwin#` and `CD-flags` fields are read field-scoped per the Part 1 naming caveat [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chat 107a (component library) and the committed `BlockDetailsSchema` (chat 006); Stage 2's window-table sequencing predecessor in this cluster is 107a [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. Runs at EO 21 inside the window; its visual output gates its own wiring half 041-W (EO 50) [doc:PHASE_4_BUILD_PLAN_part1.md]. No later-EO dependency.

**End-of-session checks:** Each of the ten block types renders its static detail layout correctly when expanded, composed from 107a primitives. Empty/minimal states render when details are sparse. Each component type-checks against its `BlockDetailsSchema` branch. The surface is design-locked and ready for 041-W to rewire to retrieved data.

### Chat 041-W — Bind Block-Detail Layouts to Retrieved Data

*Block 6 · EO 50 · 🔵 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** 041-V (the design-locked detail layouts and the `BlockDetail.tsx` dispatcher); chat 026 (plan retrieval APIs); the committed `BlockDetailsSchema` (chat 006); chats 039, 040 (the day-view timelines whose expansion surface hosts these details).

**Goal:** Rewire the static block-detail layouts from 041-V to real retrieved block data. The dispatcher now selects and hydrates the correct detail view from the `block_details` JSONB on the retrieved block; mocked sample data is replaced with the live plan query, and loading/empty states are connected to the actual retrieval and parse results. This is the build-track wiring half; the `-V` half is not considered done until this ships.

**Output:**
- Updates to `apps/web/components/plan/details/` and `apps/mobile/components/plan/details/` replacing sample data with hydration from the retrieved block's `block_details`
- `BlockDetail.tsx` (both surfaces) wired to read `blockType` and `block_details` off the live block object from the chat 026 plan query
- Loading and empty states connected to the real retrieval/parse path (a block whose `block_details` is absent or fails the schema parse renders the generic state from 041-V rather than crashing)

**Implementation notes:** Because 041-V was built against the committed `BlockDetailsSchema`, wiring is plumbing rather than redesign: the discriminated branch each component already expects is the branch the retrieved JSONB parses into. The detail view hydrates from the block object already present in the `['plan', planDate]` query cache (chat 026), so expansion does not issue an additional fetch. A parse failure on a malformed `block_details` payload degrades to the generic block state rather than erroring, keeping the timeline resilient to upstream synthesis drift. This chat consumes 041-V; no later-EO dependency, so the Critical Path caveat does not apply.

**Dependencies:** Chats 041-V, 026 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]; day-view hosts 039, 040 assumed). Runs at EO 50; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Completes the 041 pair.

**End-of-session checks:** Each block type's detail view renders from real retrieved data on both surfaces. A block with sparse or malformed details falls back to the generic state. Expansion issues no extra fetch (hydrates from the plan query cache). The 041 pair (V + W) is now complete.

### Chat 042 — Block Actions and State Transitions

*Block 6 · EO 51 · 🎩 🔵 🟢 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** PRD §3.2 (block-action copy from the Layer 4 line library); chat 027 (PATCH /blocks, optimistic concurrency); chat 038 (offline queue); chat 026 (plan retrieval); chat 037 (Realtime self-mutation filter, for the optimistic/Realtime interaction below).

**Goal:** Implement the three primary block actions — mark complete, skip, and reschedule. Each writes to `completion_log` via the API and produces a butler-voiced confirmation. Mark complete triggers haptic feedback on mobile with no on-screen copy per Layer 4; skip and reschedule emit their respective butler lines through the voice gate.

**Output:**
- `apps/web/components/plan/BlockActions.tsx` and `apps/mobile/components/plan/BlockActions.tsx` — the action button row that appears on block expand or swipe
- `apps/web/components/plan/RescheduleModal.tsx` and `apps/mobile/components/plan/RescheduleModal.tsx` — the time-picker modal for reschedule
- Optimistic UI updates via TanStack Query with rollback on error
- Toast notifications for skip and reschedule using voice-gated copy

**Implementation notes:** Mark-complete is the most common action and is optimized: a single tap (or right-swipe on mobile) writes optimistically, fires haptic feedback on mobile, and rolls back if the PATCH fails. The PATCH /blocks server handler writes both the block status update and the corresponding `completion_log` row inside the same transaction, so the optimistic mutation routes through a single API call rather than two parallel writes; this guarantees analytics never diverge from block state. The reschedule modal opens a time picker; selecting a new start time computes the new end time from the block's original duration and the PATCH fires with both `startTime` and `endTime`. Skip is one tap with no confirmation modal; the optimistic update removes the block from the timeline immediately. The optimistic-update/Realtime interaction is documented explicitly because it is subtle: (1) the user taps mark-complete; (2) the client mints a `clientMutationId`, applies the optimistic update, and sends PATCH /blocks; (3) the server writes the row with that `client_mutation_id` and Realtime broadcasts the change; (4) the broadcast arrives at the originating device; (5) the chat 037 self-mutation filter drops it against the local recent-mutation set (preventing flicker); (6a) on a 2xx the optimistic update is confirmed by the server response, or (6b) on a 409 Optimistic Lock Failure the chat 038 conflict-toast flow fires — the optimistic update rolls back, the plan query invalidates, and the voice-gated conflict toast displays. The end state is identical regardless of whether the broadcast or the PATCH response arrives first. The 🎩 voice gate (caveman, stop-slop) runs on the skip and reschedule confirmation copy so the butler voice is consistent.

**Dependencies:** Chats 041-W, 027, 038. All at lower EO; no later-EO dependency.

**End-of-session checks:** Each action works on both web and mobile. Optimistic updates render immediately and roll back correctly on failure. Voice-gated copy displays on skip and reschedule. The optimistic/Realtime/409 sequence converges to the same end state on both ordering paths.

### Chat 043 — Block Drag-and-Drop Reorder

*Block 6 · EO 61 · 🔵 🟢 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §14 (Open Question 2 resolution); chat 027 (optimistic concurrency); chat 029 (the batch reorder endpoint); OPEN_SOURCE_INVENTORY.md (`@hello-pangea/dnd` and `react-native-draggable-flatlist`); chat 042 (the action surface this builds on).

**Goal:** Implement drag-and-drop reorder on the block timeline. On web use `@hello-pangea/dnd`; on mobile use `react-native-draggable-flatlist`. Both surfaces emit the new `displayOrder` values for affected blocks through a single atomic batch request; the chat 027 optimistic concurrency check fires, and on a 409 the entire reorder rolls back and the conflict toast displays. Keyboard reorder is supported on web for accessibility.

**Output:**
- `apps/web/components/plan/DraggableBlockTimeline.tsx` — wraps the block list with `@hello-pangea/dnd`
- `apps/mobile/components/plan/DraggableBlockTimeline.tsx` — wraps with `react-native-draggable-flatlist`
- Mutation orchestration that issues a single POST to the batch reorder endpoint from chat 029 (`POST /plans/:date/reorder`) with all affected block `displayOrder` values plus the plan's `updatedAt`; the entire reorder commits atomically or returns one 409
- Keyboard handlers on web for arrow-key reorder when a block is focused (per WCAG 2.1 SC 2.1.1 Keyboard and WCAG 2.2 SC 2.5.7 Dragging Movements, which requires a single-pointer / non-drag alternative for every drag operation)

**Implementation notes:** Drag-and-drop reorder is the hardest interaction in this block and carries ⚠️ for that reason — it combines drag-and-drop with optimistic concurrency and accessibility (keyboard reorder for screen readers); the Risk Map is canonical and elevated-risk handling applies. The optimistic UI shows the new order immediately; the single batch POST issues; on success the optimistic state is confirmed, on a 409 the UI snaps back to the server's order and the conflict toast displays once. The client serializes drag-drop operations per device: a second drag-drop is held in a per-device mutation queue until the prior batch resolves, avoiding the in-flight race where two reorders submitted in quick succession produce a server-side last-write-wins on `displayOrder` while the optimistic UI shows the second order. Using the batch endpoint rather than N parallel PATCH /blocks calls eliminates the partial-failure window where some updates commit and others 409. The keyboard reorder allows up/down arrow keys to move a focused block; this is the WCAG 2.2 SC 2.5.7 dragging-movements alternative and satisfies WCAG 2.1 SC 2.1.1.

**Dependencies:** Chats 042, 027, 029 (the chat 029 batch reorder endpoint is the only mutation surface this chat calls). All at lower EO; no later-EO dependency.

**End-of-session checks:** Drag-and-drop works on both surfaces. The optimistic concurrency check fires and a 409 rolls the whole reorder back with a single toast. Keyboard reorder works on web with a screen reader navigating. Rapid sequential drags do not produce a divergent server order.

### Chat 044-V — Ambient Butler Line: Visual + Local Rotation (Static Library)

*Block 6 · EO 22 · 🔵 🟢 🟡 🎩 · Skills: caveman, stop-slop · — · Window Y (Fwin F11) · CD-flags: —*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (Voice section, Line Rotation, Line Library — the authored eighty-line library); the design system and component library from 107/107a; `docs/DESIGN_STRATEGY.md` from chat 106; chat 017 (voice gate) for the line-library copy.

**Goal:** Build the visual half of the ambient butler line — the static line library transcribed from Layer 4, the local (context + recency) rotation engine, and the rendered ambient-line component on both surfaces — composed from 107a primitives, with `[HONORIFIC]` placeholders left unresolved. Honorific-aware selection against the real `users.honorific` value is deferred to 044-W. This is a design-cluster-window chat (Fwin F11) depending only on the design system and the authored library.

**Output:**
- `packages/shared/src/butlerLines/library.ts` — the eighty-line library from Layer 4, organized by context category (morning, afternoon, evening, all_complete, post_skip, etc.), with `[HONORIFIC]` placeholders carried verbatim
- `packages/shared/src/butlerLines/rotation.ts` — exports `selectLine(context: LineContext): string` returning a contextually appropriate line and respecting the no-repeat-within-four-hours rule via local storage (web) / MMKV (mobile); honorific substitution is stubbed (placeholder left in place or replaced with empty string) pending 044-W
- `apps/web/hooks/useAmbientLine.ts` and `apps/mobile/hooks/useAmbientLine.ts` — hooks that subscribe to context changes (current time, plan state, recent block completions) and return the current ambient line from the local engine
- `apps/web/components/plan/AmbientLine.tsx` and `apps/mobile/components/plan/AmbientLine.tsx` — the rendered ambient-line component; tap is intended to open the natural-language input sheet (built in chat 045) but the tap target/handler stub is left for 045 to wire

**Implementation notes:** The library is authored as a TypeScript constant with each line tagged by context; the selection algorithm scores each candidate by context-match strength and recency, and the highest-scoring non-recent line wins. The no-repeat rule tracks the last shown line per context bucket and checks its timestamp against the current time minus four hours. **The 🎩 flag is propagated here, to the copy-authoring half:** the eighty butler lines are user-facing butler copy cleared through the caveman/stop-slop voice gate at authoring time, so the visual half owns the gate interaction; 044-W performs only the mechanical honorific substitution, adds no new copy, and shows `Skills: —`. **This chat is the pre-agreed pressure valve for the design-cluster window:** per the Part 1 Design-Cluster-Window Note, if the ≤11-day window slips, 044-V (Fwin F11) is the designated drop-to-14 because its visual plus local rotation is the lowest-leverage of the fifteen window chats and its function survives composition from 107a primitives during 044-W; dropping it loses no conversion, retention, onboarding, or design-foundation surface (108a Fwin F13 is the named alternate valve). The Design-Cluster-Window Note is canonical for that decision [doc:PHASE_4_BUILD_PLAN_part1.md]. **Window vs CD-flag scoping:** `Fwin F11` is the eleventh window-chat position and is unrelated to any `CD-flag F#`; this chat carries no CD-flag, read field-scoped per the Part 1 naming caveat.

**Dependencies:** Chat 107a (and the authored Layer 4 line library); chat 017 (voice gate, for copy authoring). Stage 2's window-table sequencing predecessor in this cluster is 107a [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. Runs at EO 22 inside the window; its visual output gates its own wiring half 044-W (EO 59) [doc:PHASE_4_BUILD_PLAN_part1.md]. No later-EO dependency.

**End-of-session checks:** The ambient line renders correctly on both surfaces from the local engine. Lines rotate as context changes and the no-repeat-within-four-hours rule is enforced. `[HONORIFIC]` placeholders are present and unresolved (or empty-string stubbed), ready for 044-W to bind. The surface is design-locked.

### Chat 044-W — Honorific-Aware Butler-Line Selection

*Block 6 · EO 59 · 🟡 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** 044-V (the static library, rotation engine, and ambient-line components); chat 035-W (onboarding module-prefs persistence, which lands the `users.honorific` value).

**Goal:** Rewire the rotation engine's honorific substitution to the real `users.honorific` value so selection is honorific-aware at runtime. This is the build-track wiring half that completes the 044 pair: the `[HONORIFIC]` placeholders from 044-V are resolved against the persisted honorific (`, sir` / `, madam` / empty string). The lines themselves were authored and gated in 044-V; this half adds no new user-facing copy.

**Output:**
- Updates to `packages/shared/src/butlerLines/rotation.ts` resolving `[HONORIFIC]` against the persisted `users.honorific` rather than the 044-V stub
- The `useAmbientLine` hooks updated to read the honorific from the persisted profile (via 035-W) so selection is honorific-aware at runtime

**Implementation notes:** The honorific substitution replaces `[HONORIFIC]` with `, sir`, `, madam`, or empty string based on the `users.honorific` field captured in onboarding and persisted by 035-W; until 035-W lands, the placeholder stays stubbed, which is why this half sits at EO 59 (after 035-W at EO 53). This wiring half adds no new copy — the eighty lines came through the gate in 044-V and the honorific token is a fixed mechanical substitution, not new butler copy — so it carries no 🎩 flag and shows `Skills: —`. This chat consumes 044-V and 035-W; both are at lower EO, so the Critical Path back-reference caveat does not apply.

**Dependencies:** Chats 044-V, 035-W (Stage 2 gating prereqs; "needs 035-W" per the split table [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 59; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Completes the 044 pair.

**End-of-session checks:** Honorific substitution resolves correctly for sir / madam / none against the persisted profile. Rotation remains honorific-aware across context changes. No new copy is introduced (the lines were gated in 044-V). The 044 pair (V + W) is now complete.

### Chat 045 — Natural Language Input Sheet and Command Pipeline

*Block 6 · EO 60 · 🎩 🔵 🟢 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** PRD §4.2 and §4.3 (NL input); chat 029 (POST /ai/command, the NL command + weekly-priorities APIs); chat 044-W (ambient-line tap-to-open); chat 042 (block actions the applier dispatches to); LAYER_4_EXPERIENCE_IDENTITY.md (input-sheet design); chat 023 (the privacy posture for raw-input capture).

**Goal:** Build the natural-language input sheet that opens when the user taps the ambient line. The user types a command (voice input is V1.5; at V1 a long-press opens the keyboard rather than starting a recording). The command is sent to POST /ai/command, the structured response is applied via the appropriate block API or plan-generation API, and a butler-voiced confirmation displays.

**Output:**
- `apps/web/components/plan/NLInputSheet.tsx` — bottom sheet on web with a text input and send button
- `apps/mobile/components/plan/NLInputSheet.tsx` — native sheet on mobile
- `apps/web/lib/nlCommand/applyCommand.ts` and the mobile equivalent — the command applier that takes a parsed `PlanEditCommand` and calls the right API; handles reschedule, complete, skip, add, remove, and regenerate types
- Voice-gated confirmation copy displayed in a toast after successful command application
- PostHog emission on every NL command lifecycle stage: `nl_command_submitted` (carrying `{input_length_chars, source: 'ambient_tap'}`; raw input is NEVER captured, per the chat 023 privacy posture), `nl_command_parsed` (carrying `{command_type, parse_latency_ms}` where `command_type` ∈ {reschedule_block, complete_block, skip_block, add_block, remove_block, regenerate_plan, swap_workout, unknown}), and `nl_command_applied` (carrying `{command_type, apply_outcome: 'success'|'api_error', apply_latency_ms}`). Without these, NL prompt tuning is blind. Events are added to chat 096's PostHog taxonomy

**Implementation notes:** The input sheet is invoked from the ambient-line tap; tap is the only invocation surface at V1 (voice input and any long-press-to-record gesture are deferred entirely to V1.5 — there is no long-press recording handler in this chat's mobile code). The user submits, a loading state shows, and the command response either applies (with a confirmation toast) or returns `unknown` (with a clarification prompt asking the user to rephrase). The command applier dispatches to the various block APIs from chat 042 and the plan-generation path; it does not re-parse the natural language, because parsing is already done server-side by chat 029's endpoint. The 🎩 voice gate (caveman, stop-slop) runs on the confirmation and clarification copy.

**Dependencies:** Chats 044-W, 029, 042. All at lower EO; no later-EO dependency.

**End-of-session checks:** A user can type "move gym to 7pm" and see the gym block reschedule. A user can type "add pick up dry cleaning at 3" and see a new block appear. An unparseable command surfaces the clarification. The three lifecycle events emit with the documented payloads and raw input is never captured.

### Chat 046-V — Vesper-Hour Static Surfaces, Week View, Morning Brief, Energy Slider, Quiet Hours (Visual / Static)

*Block 6 · EO 23 · 🔵 🟢 🎩 · Skills: caveman, stop-slop · — · Window Y (Fwin F12) · CD-flags: —*

**Load at session start:** PRD §3.2 and §3.3 (the full daily journey beyond the day view); LAYER_4_EXPERIENCE_IDENTITY.md (evening summary, morning brief, Vesper-hour voice); the design system and component library from 107/107a; `docs/DESIGN_STRATEGY.md` from chat 106; chat 017 (voice gate) for the surface copy.

**Goal:** Build the visual/static half of the remaining plan surfaces, composed from 107a primitives against mocked data, and author all of their user-facing butler copy through the voice gate: the week view (web only, seven-day horizontal grid), the static Vesper-hour evening surface (presenting a mocked tomorrow draft with the approve/adjust prompt copy), the evening summary layout (completed/missed/energy trend/tomorrow preview), the morning brief on app open (next three blocks plus weather and commute stubs), the energy-slider screen (mobile full-screen post-alarm, web inline on first morning open), the proactive end-of-block check-in surface with its prompt copy (in-app and Dynamic Island only, never push), and the quiet-hours UI affordances. The evening draft→approve loop *behavior* and completion-data wiring are deferred to 046-W; this half renders the surfaces with mocked plan/completion data, authors the copy, and leaves the F1 `daily_plans` draft-state question open (it is consumed downstream in 046-W). design-cluster-window chat (Fwin F12).

**Output:**
- `apps/web/app/(app)/week/page.tsx` — the week view (static, mocked)
- `apps/web/components/plan/EveningSummary.tsx` and `apps/mobile/components/plan/EveningSummary.tsx` — the evening summary layout against mocked data
- `apps/web/components/plan/MorningBrief.tsx` and `apps/mobile/components/plan/MorningBrief.tsx` — the morning brief with weather/commute stubs
- `apps/mobile/app/(modal)/energy-slider.tsx` — the full-screen energy slider on mobile (visual)
- `apps/web/components/plan/EnergySliderInline.tsx` — the inline equivalent on web (visual)
- `apps/web/components/plan/EndOfBlockCheckIn.tsx` and `apps/mobile/components/plan/EndOfBlockCheckIn.tsx` — the proactive prompt surface (static), with its prompt copy authored through the voice gate
- The static Vesper-hour evening surface composed from 107a primitives, rendered against a mocked tomorrow draft, with the approve/adjust prompt copy authored through the voice gate

**Implementation notes:** The week view is web-only because mobile screens are too narrow for a seven-day grid; mobile users see a single-day view. These surfaces are built as design-locked statics: the evening summary, morning brief, energy slider, and Vesper-hour surface render from mocked plan/completion data so the design track can finish them inside the window without waiting on the synthesis or completion spine. Per the Stage-2 objection on `-V`/`-W` separability, 046-V is explicitly the case where the static layout is mocked with the **F1 draft-state flag left open** rather than pretending to resolve it — the draft→approve lifecycle binding is concentrated in 046-W where F1 is consumed, so the separability risk is flagged, not hidden [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. **The 🎩 flag is propagated here, to the copy-authoring half:** the morning-brief, evening-summary, Vesper-hour, draft/approve-prompt, and check-in copy are user-facing butler copy cleared through the caveman/stop-slop voice gate at authoring time, so the visual half owns the gate interaction; 046-W wires behavior only, adds no new copy, and shows `Skills: —`. **Window vs CD-flag scoping:** `Fwin F12` is the twelfth window-chat position and is unrelated to any `CD-flag F#`; this `-V` half carries no CD-flag (F1 is carried on its `-W` half), read field-scoped per the Part 1 naming caveat [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chat 107a (component library); chat 017 (voice gate, for copy authoring). Stage 2's window-table sequencing predecessor in this cluster is 107a [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. Runs at EO 23 inside the window; its visual output gates its own wiring half 046-W (EO 62) [doc:PHASE_4_BUILD_PLAN_part1.md]. No later-EO dependency.

**End-of-session checks:** The week view, evening summary, morning brief, energy slider (mobile full-screen and web inline), end-of-block check-in, and static Vesper-hour surface all render correctly from mocked data, composed from 107a primitives. The surfaces are design-locked and ready for 046-W to wire to real completion data and the draft→approve loop. No real data path is asserted; F1 remains open for the wiring half.

### Chat 046-W — Vesper Evening Draft/Approve Loop + Completion Wiring

*Block 6 · EO 62 · 🔵 🟢 · Skills: — · — · Window N · CD-flags: F1 C*

**Load at session start:** 046-V (the design-locked Vesper-hour, week-view, morning-brief, energy-slider, and check-in surfaces, with all copy already authored and gated); chat 026 (plan retrieval); chat 035-W (the persisted sleep/quiet-hours targets and module prefs); chat 042 (block actions / completion writes); chat 111 and the F1 determination on `…0004_daily_planning.sql` (the `daily_plans` draft/approved-state question this chat consumes).

**Goal:** Wire the static Vesper-hour surfaces from 046-V to real data: the evening draft→approve loop (the Vesper-hour evening surface presents tomorrow's draft plan and lets the user approve or adjust it), the completion-data wiring for the evening summary and energy trend, the energy-slider submission that triggers a fresh plan generation, the morning-brief data path, the end-of-block check-in trigger, and quiet-hours enforcement against the persisted sleep window. This build-track half completes the 046 pair.

**Output:**
- The evening draft/approve loop wired to the `daily_plans` draft/approved state — the Vesper-hour surface reads the draft for tomorrow and the approve action transitions it to approved (per the F1 determination)
- `EveningSummary` (both surfaces) computing from real `completion_log` data (completed/missed/energy trend) rather than mocked data
- Energy-slider submission wired to trigger a fresh plan generation; `MorningBrief` wired to the live next-three-blocks query plus the weather/commute stubs
- `EndOfBlockCheckIn` wired to fire when a block's `end_time` passes without being marked complete (in-app and Dynamic Island only — never push, per the privacy posture)
- `apps/mobile/lib/quietHours.ts` — utility that consults the user's persisted sleep targets and suppresses local notifications between bedtime and wake, with the medication per-medication override from chat 060 respected

**Implementation notes:** This chat **consumes the F1 CANNOT-DETERMINE flag** — the `daily_plans` draft/approved-state question read at the chat 111 early checkpoint (against `…0004_daily_planning.sql`) and also attached to chat 025 as a consumer. Per the carried-forward flag, 046-W binds the draft→approve loop to whatever draft-state shape 111 confirmed or added forward; it does not invent a state. **The `Fwin F#` window counter and this `CD-flag F1` token share an `F#` shape but are unrelated and must be read field-scoped** — this is not a window chat (Window N); its `F1 C` is the CANNOT-DETERMINE flag it consumes, per the Part 1 naming caveat. (Note that the master table records `046-W` as `F1 C` while the Stage-2 §6 flag register lists F1's consumers as 025 and 046-W; this matches, and the consumer relationship is carried forward as a flag rather than reconciled here.) The evening-summary trigger uses two mechanisms in combination: a local notification (mobile) or scheduled in-app event (web) at bedtime minus thirty minutes, plus an on-open check that displays the summary if the app is opened within four hours after the trigger and the user has not yet seen it for the day — relying only on a JS timer fails when the app is closed or the tab is throttled past the trigger time, so the on-open fallback guarantees the summary surfaces on first interaction within the window. Coordination with the wind-down block from chat 059a: the wind-down block is a scheduled plan block in the timeline (a work item), while the evening summary is a reflective modal overlay; both can appear on the same evening on different surfaces without colliding. The morning brief appears only on the first app open of the day. The energy slider is full-screen on mobile (post-alarm) and inline on web (no alarm), and its submission triggers a fresh plan generation. The end-of-block check-in is a soft in-app/Dynamic-Island prompt and never push-notifies. The quiet-hours utility wraps expo-notifications scheduling to respect the persisted sleep window, with the chat 060 per-medication override honored. This wiring half adds no new user-facing copy — the evening-summary, draft/approve-prompt, and check-in copy came through the gate in 046-V — so it carries no 🎩 flag and shows `Skills: —`. This chat consumes 046-V, 035-W, and 042 (all lower EO); no later-EO dependency, so the Critical Path back-reference caveat does not apply [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 042, 026, 035-W (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]; plus 046-V and the chat 111 F1 determination). Runs at EO 62; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Completes the 046 pair.

**End-of-session checks:** The Vesper-hour evening draft→approve loop reads and transitions the `daily_plans` draft/approved state per the F1 determination. The evening summary computes from real `completion_log` data. The energy slider triggers a fresh plan generation when submitted. The morning brief and end-of-block check-in render from live data. Quiet hours suppress test notifications between bedtime and wake, with the medication override respected. Voice-gated copy displays on all surfaces. The 046 pair (V + W) is now complete.

---

<!-- PHASE_4_BUILD_PLAN.md — Part 6 of 10. Body continues here; conventions, legend, per-chat template, and master reordered-sequence table live in Part 1. Concatenate Parts 1→10 (a/b sub-parts in letter order) head-to-tail. -->

---

## Authoring Note for Part 6 (Block 7)

Like Part 4 and Part 5, this part contains no built-foundation chats. Stage 1 asserts 001–020 built and 021+ unbuilt [doc:PHASE_4_REPLAN_STAGE_1_ANALYSIS.md], so every Block 7 chat is not-yet-built work that appears in the Part 1 master reordered-sequence table and therefore carries a **real EO and a real Model** taken verbatim from that table [doc:PHASE_4_BUILD_PLAN_part1.md]. No EO is recorded as `—`. Every meta line below was re-derived directly from the Part 1 master table rather than carried from any prior draft.

**Fold convention (052 and 054).** Block 7's chats 052 and 054 were originally marked for a `-V`/`-W` split, but per the Part 1 master table and Stage 2 §5 their design-track visual halves (**052-V** calendar chrome, **054-V** sortable task list) are **folded into their wiring halves** and are **not** in the design-cluster window — they are utilitarian, lowest-design-leverage surfaces trivially composable from the 107/107a primitives, and cutting them from the window is what brought the cluster from 17 candidates down to the 15 it holds [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. They are therefore rendered here as **single chats, 052-W and 054-W**, each taking its own master-table EO (052-W EO 41, 054-W EO 43; both build-track) with the folded-in visual noted in prose — **not** as separate `-V`/`-W` pairs. The fold is the master table's and Stage 2's decision propagated here, not a new product decision.

**File-split-plan-count discrepancy (flagged, not reconciled).** The Part 1 file-split plan lists Part 6 as "**19 entries**" with the parenthetical "(047–062, with 052/054 `-V`/`-W`; 059a, 059b)" [doc:PHASE_4_BUILD_PLAN_part1.md]. That count is the **pre-fold** figure: it counts 052-V, 052-W, 054-V, and 054-W as four separate entries. After folding 052-V into 052-W and 054-V into 054-W per the master table and Stage 2 §5, the rendered body contains **17 entries** (047, 048, 049, 050, 051, 052-W, 053, 054-W, 055, 056, 057, 058, 059a, 059b, 060, 061, 062). The master table (single 052-W / 054-W rows) and the file-split plan's "19" therefore disagree; following the Part-3-through-5 discipline, the master table is authoritative and the file-split-plan count is carried as a flagged discrepancy rather than silently reconciled. The single-response budget is unaffected (the fold reduces, not increases, the entry count), so no `6a`/`6b` split is needed.

**New chats 059a / 059b.** The original 059 work is rendered as two chats, each with its own master-table EO and Model: **059a** (sleep module logic) is EO 70, on the build track; **059b** (iOS alarm screen) is EO 13, **build-track native** — the build track owns the native SwiftUI alarm screen and the design track supplies only the visual spec via 107, per Stage 2 §1 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. They are documented separately below at their respective positions.

**Skill / 🎩 propagation (copy-authoring test).** Following the Part 4 / Part 5 precedent, the 🎩 voice-gate flag and `Skills: caveman, stop-slop` sit on the half that actually authors user-facing butler copy. For the folded single chats (052-W, 054-W) the same copy-authoring test is applied to the whole chat: neither folded chat authors new butler copy (the pre-split originals carried no 🎩), so both show `Skills: —` and carry no 🎩. The 🤖 flag marks AI-layer chats where prompt versioning matters but the Part 1 legend names no skill to invoke for it, so a 🤖-bearing chat with no 🎩 shows `Skills: —`. The 🗄️ flag names **drizzle-best-practices** (chat 048), exactly as chat 111 renders it in Part 2 [doc:PHASE_4_BUILD_PLAN_part2.md]. The `frontend-design` skill is reserved for the pure design-system chats (107 / 107a / 108a) and is used by no Block 7 chat.

**One CD-flag and one Critical Path back-reference in this part.** Chat **060** carries `CD-flags: F2 C` — the medications quiet-hours / fire-on-time default question, first read in chat 111 and consumed here [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]; it is read field-scoped against the unrelated `Fwin F#` window counter per the Part 1 naming caveat. The Part 1 How-to-Use back-reference list includes **056 → 057** [doc:PHASE_4_BUILD_PLAN_part1.md]: chat 056 declares a hard dependency on the later-numbered chat 057, restated inline in 056 below, with the **Critical Path section (Part 10) canonical** for the ordering.

---

## Block 7 — Modules

Block 7 implements the seven modules — fitness, nutrition, sleep, medication, finance, errands, and tasks (the work module) — plus the cross-module Sunday weekly planning session. The template seed scripts and seed migrations land early so fitness and nutrition template selection works in the module chats that follow (047 sources templates at EO 10; 048 deploys the seed migrations at EO 28). The built-in calendar and tasks surfaces (052-W, 053, 054-W) absorb their folded-in design-track visuals and compose from the 107/107a design system. Block organization is preserved for readability; the actual run order is the EO column of the Part 1 master table, not the chat-number order in which the entries appear below — the Block 7 chats are interleaved across EO 10 through EO 71 on the build track. The one late-binding back-reference in this block (056 → 057) is governed by the Critical Path section, which is canonical for it; no other Block 7 entry depends on a later-EO chat.

### Chat 047 — Seed Sourcing Scripts

*Block 7 · EO 10 · 🟡 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §6 (TheMealDB and ExerciseDB Seed-Only); OPEN_SOURCE_INVENTORY.md (template sourcing); chat 001 (RapidAPI key acquired during external-account submissions).

**Goal:** Author the scripts that source workout templates from ExerciseDB (via RapidAPI) and recipe templates from TheMealDB. Each script outputs a JSON file in `packages/db/seed/` validated against the corresponding Zod schema. Manual curation passes refine the diet tags and other metadata, since the source APIs do not perfectly map onto the target shapes.

**Output:**
- `packages/db/seed/scripts/buildWorkoutTemplates.ts` — fetches from ExerciseDB via RapidAPI, transforms to the `workout_templates` row shape, validates with Zod, and writes to `packages/db/seed/workout_templates.json`
- `packages/db/seed/scripts/buildRecipeTemplates.ts` — same for TheMealDB (free API), writing to `recipe_templates.json`
- Approximately 150 workouts and 300 recipes respectively, tagged across the required dimensions
- The RapidAPI key is used only during the seed run; it is never stored in production environments

**Implementation notes:** ExerciseDB returns individual exercises; the script aggregates them into workout templates by grouping on goal and equipment. TheMealDB's free API has limited query depth, so the recipe script makes paginated calls to assemble the 300-recipe set. Manual curation involves reviewing the generated JSON for diet-tag accuracy (TheMealDB does not reliably tag vegetarian, so the script applies ingredient-based heuristics), cooking-time accuracy, and any obviously inappropriate content; the manual review is a one-time activity captured in the script's commit message. This is the first Block 7 chat by EO (10), running well ahead of the module-wiring chats so the seeded data exists before chat 048 deploys it; Stage 2 lists no gating unbuilt prereq for it [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Dependencies:** Chats 001, 005 (built foundation: the RapidAPI key from external-account submissions and the `workout_templates` / `recipe_templates` schemas; Stage 2 lists no gating unbuilt prereq beyond built foundation [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 10; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Its JSON output is consumed by chat 048 (EO 28).

**End-of-session checks:** Running each script produces a JSON file with the expected row count. Each row validates against its Zod schema. A manual spot-check confirms the diet tags are reasonable.

### Chat 048 — Seed Migrations and First Seed Deploy

*Block 7 · EO 28 · 🗄️ 🟡 · Skills: drizzle-best-practices · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §3 (Seed Data); chat 047 outputs; chat 021 (the template-subset stub that needs to be replaced with real data).

**Goal:** Author seed migrations 14 and 15 that truncate and bulk-insert the `workout_templates` and `recipe_templates` tables from the JSON files, deploy them via `supabase db push`, and update the template-subset function from chat 021 to use the real data (replacing the empty-array stub).

**Output:**
- `packages/db/migrations/20260601100001_seed_workout_templates.sql` and `.down.sql` — truncate `workout_templates`, bulk insert from the JSON
- `packages/db/migrations/20260601100002_seed_recipe_templates.sql` and `.down.sql` — same for recipes
- After `supabase db push`, the tables contain the seeded rows
- `packages/ai/src/context/templateSubset.ts` updated to filter the real templates by user fitness and nutrition preferences

**Implementation notes:** The bulk insert uses a single `INSERT INTO … VALUES (…), (…), …` statement; for 150 and 300 rows respectively this is efficient and fits within Postgres statement-size limits. The migrations are idempotent because they truncate first; re-running produces the same final state. The template-subset filter logic is straightforward: for workouts, filter by `goal`, `equipment ARRAY contains user's equipment`, and `level <= user's level`, limit ten; for recipes, filter by `diet_tags ARRAY contains user's diet_tags`, `total_minutes <= user's cooking_time_max`, limit fifteen. The 🗄️ flag invokes drizzle-best-practices for the migration authoring, rendered exactly as chat 111 renders it in Part 2 [doc:PHASE_4_BUILD_PLAN_part2.md]. The 🟡 package color is decomposed from this chat's output set (`packages/db/migrations`, `packages/ai/src/context`), both of which the Part 1 legend colors 🟡 — not invented; the prior-plan meta line carried only the 🗄️ skill flag with no explicit color [doc:PHASE_4_BUILD_PLAN.md][doc:PHASE_4_BUILD_PLAN_part1.md]. EO 28 places this after chat 021 (EO 6, the stub) and after chat 047 (EO 10, the JSON source), as the dependencies require [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Dependencies:** Chats 047, 005, 006, 021 (Stage 2 gating prereqs are 047 and 021, with built foundations 005/006 assumed [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 28; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** `supabase db push` applies the seed migrations cleanly. The `workout_templates` and `recipe_templates` tables contain the expected row counts. The template-subset function returns non-empty arrays for representative user profiles.

### Chat 049 — Fitness Module: Selection, Adaptation, UI

*Block 7 · EO 64 · 🔵 🟢 🤖 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §5 (Fitness in Model Selection); PRD §6.2 (Fitness module spec); chat 023 (`selectWorkoutTemplate`); chat 022 (`synthesizePlan` integration).

**Goal:** Wire the fitness template selection into the plan-synthesis flow, implement the Sonnet contextual adaptation that scales workouts (e.g., a 60-minute template adapted down to 30 minutes for a tight morning), build the fitness block-detail UI showing the exercise list with sets and reps, and implement the workout-swap command path (when the user says "give me something shorter" or "I want a home workout").

**Output:**
- `packages/ai/src/synthesizePlan.fitness.ts` — the fitness-specific synthesis hook that calls `selectWorkoutTemplate` and optionally the contextual adaptation
- `apps/web/components/plan/details/FitnessBlock.tsx` and `apps/mobile/components/plan/details/FitnessBlock.tsx` — the fitness detail view
- `apps/web/components/plan/SwapWorkoutSheet.tsx` and the mobile equivalent — the swap UI invoked by the swap command
- The Sonnet adaptation prompt iterated against test cases

**Implementation notes:** The fitness template selection runs as part of the plan-synthesis prompt; the selected template UUID is referenced in `block.details`. The contextual adaptation is a separate Sonnet call invoked when the available time slot is shorter than the template's standard duration; it takes the template and the available time and returns a modified version (fewer sets, shorter rest intervals). The workout swap is invoked via the natural-language command pipeline from chat 045 rather than a distinct gesture; `SwapWorkoutSheet` is the surface the command applier opens when the parser returns a `swap_workout` command type. Swap and the NL command path are the same feature with different surfaces (input is NL, surface is the sheet). The sheet presents the next-best matching template based on the user's modified preference. The 🤖 flag marks this as an AI-layer chat where prompt versioning matters (the contextual-adaptation call), but the Part 1 legend names no skill to invoke for 🤖, so it is carried in the meta cluster as a flag and `Skills: —`, not expanded into an invented skill name [doc:PHASE_4_BUILD_PLAN_part1.md]. This chat is ⚠️ in the prior plan and the Risk Map; elevated-risk handling (multiple iterations) applies because the contextual-adaptation prompt is one of the harder secondary AI prompts and must produce structurally-correct output while meaningfully modifying a template's parameters.

**Dependencies:** Chats 048, 023, 042 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 64; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** A user with the fitness module enabled receives a fitness block in their daily plan. Adaptation scales workouts correctly. The swap command produces a new template.

### Chat 050 — Nutrition Module: Selection, Recipe UI, Hydration

*Block 7 · EO 65 · 🔵 🟢 🤖 · Skills: — · ⇄ 049 · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §5; PRD §6.3 (Nutrition module spec); chat 023 (`selectRecipeTemplate`).

**Goal:** Wire recipe template selection into plan synthesis, build the recipe detail UI showing ingredients and step-by-step instructions, implement the recipe-swap command path, and add the hydration sub-feature as an inline tracker within the nutrition module.

**Output:**
- `packages/ai/src/synthesizePlan.nutrition.ts` — the nutrition-specific synthesis hook
- `apps/web/components/plan/details/NutritionBlock.tsx` and the mobile equivalent
- `apps/web/components/plan/SwapRecipeSheet.tsx` and the mobile equivalent
- `apps/web/components/plan/HydrationTracker.tsx` and the mobile equivalent — a simple counter for water intake; each tap inserts a row into the `hydration_log` table from chat 005 with `user_id`, `logged_at = now()`, `count = 1`; the visible counter is derived from `SELECT COUNT(*) FROM hydration_log WHERE user_id = $1 AND logged_at >= start_of_local_day(user.timezone)`

**Implementation notes:** Nutrition follows the same pattern as fitness. The hydration tracker is intentionally minimal at V1; users tap a button to record an event row in `hydration_log`. The counter is derived at read time from the count of rows since the local-day boundary; daily resets are a consequence of the query (no mutation runs at rollover). Hydration mutations do **not** bump `user_profiles.base_profile_version`, because hydration is high-frequency event data, not a profile preference, and does not affect plan-generation context caching. No notifications or goals at V1 beyond the count display. The 🤖 flag marks the AI-layer recipe-selection call where prompt versioning matters, carried as a flag with `Skills: —` per the Part 1 legend [doc:PHASE_4_BUILD_PLAN_part1.md]. **The ⇄ 049 flag is carried from the prior plan:** 049 (EO 64) and 050 (EO 65) are parallel-capable on separate terminals; the master table places them EO-adjacent and the Parallelization Map (Part 10) is canonical for actual concurrency [doc:PHASE_4_BUILD_PLAN_part1.md]. The token is preserved as a flag, not reconciled.

**Dependencies:** Chats 048, 023, 042 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Parallel with chat 049 (⇄; see Parallelization Map). Runs at EO 65; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** Nutrition blocks generate with recipe details. Swap works. The hydration tracker increments and resets at the local-day boundary.

### Chat 051 — Meal Planning and Grocery List

*Block 7 · EO 66 · 🔵 🟢 🤖 🎩 · Skills: caveman, stop-slop · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §5 (Sonnet meal planning); PRD §6.3 (weekly meal planning, grocery list).

**Goal:** Implement weekly meal-plan synthesis via Sonnet (seven days × meal slots) and grocery-list aggregation from the week's ingredients as a simple checklist.

**Output:**
- `packages/ai/src/weeklyMealPlan.ts` — the Sonnet call that takes the user's nutrition preferences and produces a weekly meal plan
- `apps/web/app/(app)/meal-plan/page.tsx` and `apps/mobile/app/(tabs)/meal-plan.tsx` — the weekly meal-plan view
- `apps/web/app/(app)/grocery-list/page.tsx` and the mobile equivalent — the grocery-list view
- `packages/shared/src/grocery/aggregator.ts` — a utility that aggregates a week's recipe ingredients
- Voice-gated copy for the grocery list ("Your list is ready.")

**Implementation notes:** The meal plan is triggered during the Sunday weekly planning session (chat 057) or on user demand. The grocery aggregator combines duplicate ingredients (two recipes calling for 2 cups of rice each become 4 cups total). The grocery list is a flat checklist; no store routing is implemented. **The 🎩 flag is the copy-authoring marker:** the grocery-list line is user-facing butler copy cleared through the caveman/stop-slop voice gate at authoring time, so those two skills are named in the Skills field; the 🤖 flag marks the meal-synthesis AI call where prompt versioning matters and is carried as a flag without an invented skill name [doc:PHASE_4_BUILD_PLAN_part1.md]. This chat carries elevated-risk handling per its ⚠️ flag — the Risk Map rationale is that the weekly Sonnet meal synthesis must produce a coherent week's worth of meals, not seven independent days, and coherence is hard to achieve via prompting alone.

**Dependencies:** Chats 050, 022 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 66; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** A weekly meal plan generates. The grocery list aggregates correctly and renders as a checklist.

### Chat 052-W — Built-in Calendar: Library Selection and Web Implementation (052-V folded in)

*Block 7 · EO 41 · 🔵 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** LAYER_2_PRODUCT_SCOPE.md (Pillar 3 — Calendar Layer); OPEN_SOURCE_INVENTORY.md (FullCalendar, react-big-calendar); PRD calendar dual-surface requirements; the design system and component library from 107/107a (for the folded-in calendar chrome).

**Goal:** Evaluate FullCalendar Standard vs react-big-calendar and decide based on RRULE recurrence support and theming flexibility; implement the web calendar with event CRUD and RRULE recurrence for fixed weekly events (work hours, classes, recurring appointments); and build the calendar chrome visual — the folded-in **052-V** half — composing it from the 107/107a primitives rather than as a separate window chat.

**Output:**
- A decision documented in `docs/CALENDAR_LIBRARY_CHOICE.md`
- The chosen library integrated in `apps/web/app/(app)/calendar/page.tsx`, styled with the calendar chrome composed from the 107 design system (052-V folded in)
- Event CRUD operations writing to the `calendar_events` table owned by chat 005 (this chat consumes the existing table; it does not own a new migration)
- An RRULE recurrence parser for events like "every Monday and Wednesday 9am–10am for work"

**Implementation notes:** This chat carries elevated risk because the library choice is hard to undo (Risk Map: FullCalendar versus react-big-calendar is a real decision that affects every calendar surface forward). FullCalendar Standard is the leading candidate for its mature RRULE support and well-documented theming API; react-big-calendar is the smaller-bundle alternative with weaker RRULE support. The `calendar_events` table migration is owned by chat 005 and lives in the Block 1 migration set at allocation number 14 (the first available number in the Blocks 4–7 range per `docs/MIGRATION_NUMBER_ALLOCATION.md`); this chat does not add a migration and there is no "retroactive to Block 1" reordering. Calendar events are user-owned recurring entities separate from generated plans, which is why they live in their own table rather than as an extension of `daily_plans`. **Fold note (master table + Stage 2 §5):** the planned visual half **052-V** (calendar chrome) is deferred *out of the design-cluster window* — utilitarian, lowest design-leverage, trivially composable from the 107/107a primitives — and its visual build folds into this chat, which is therefore a **single chat** (not a `-V`/`-W` pair) taking its own master-table EO (41), build-track, and is **not** a window chat (Window N) [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md][doc:PHASE_4_BUILD_PLAN_part1.md]. The copy-authoring test applied to the whole folded chat: it authors no new user-facing butler copy (the pre-split 052 carried no 🎩), so `Skills: —` and no 🎩. Elevated-risk handling per the ⚠️ flag.

**Dependencies:** Chat 015 (Stage 2 lists no gating unbuilt prereq beyond built 015 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]; the 107/107a design system is loaded for the folded-in chrome but those are earlier in-cluster F-track chats, complete by EO 41). Runs at EO 41; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Its web calendar is the gating predecessor for chat 053 (EO 42).

**End-of-session checks:** The chosen library renders correctly. Event CRUD works. RRULE recurrence produces correct instances. The calendar chrome matches the 107 design system.

### Chat 053 — Built-in Calendar: Mobile Implementation

*Block 7 · EO 42 · 🟢 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** Chat 052-W (library decision and web implementation); OPEN_SOURCE_INVENTORY.md (react-native-calendars); the `calendar_events` table schema.

**Goal:** Implement the mobile calendar with feature parity to web using react-native-calendars. Verify RRULE recurrence support; if the library does not support RRULE natively, implement in-app recurrence expansion (the app stores RRULE strings and expands them to event instances on read).

**Output:**
- `apps/mobile/app/(tabs)/calendar.tsx` and supporting components
- Event CRUD parity with web
- An RRULE expansion utility if needed
- The events-to-blocks pipeline: built-in calendar events become `source=user_added` blocks at plan-synthesis time

**Implementation notes:** If react-native-calendars supports RRULE, use it directly. If not, the in-app expansion pattern is: the `calendar_events` table stores the RRULE string and the start/end dates of the series; on read, the app expands the RRULE to individual instances using the `rrule` library; the expanded instances are not stored (only the RRULE is). This pattern is standard for calendar applications and is well documented. This chat carries elevated-risk handling per its ⚠️ flag: the Risk Map rationale is that RRULE recurrence on react-native-calendars is the open question, and if the library does not support it natively the in-app expansion pattern adds complexity. EO 42 places this immediately after 052-W (EO 41), matching the hard dependency [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Dependencies:** Chat 052-W (Stage 2 gating prereq [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 42; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** The mobile calendar renders correctly. Event CRUD works. RRULE recurrence produces correct instances. Events appear in the daily plan as fixed blocks.

### Chat 054-W — Tasks Module: UI and CRUD (054-V folded in)

*Block 7 · EO 43 · 🔵 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PRD §6.1 (Work and Tasks module); chat 028 (task APIs); the design system and component library from 107/107a (for the folded-in sortable task-list UI).

**Goal:** Build the task list UI on web and mobile, composing the static sortable-list visual — the folded-in **054-V** half — from the 107/107a primitives. The list is sortable by priority and deadline; users can create, edit, complete, and delete tasks. The UI is reachable from the plan view (secondary surface) and from the natural-language input.

**Output:**
- `apps/web/app/(app)/tasks/page.tsx` and `apps/mobile/app/(tabs)/tasks.tsx`
- `apps/web/components/tasks/TaskList.tsx`, `TaskCard.tsx`, `TaskForm.tsx` and the mobile equivalents, styled from the 107 design system (054-V folded in)
- An empty state for users with no tasks

**Implementation notes:** Tasks are not paginated at V1 per the Tech Spec; the list renders as a flat scroll. The task form opens as a modal for creation and edit. **Fold note (master table + Stage 2 §5):** the planned visual half **054-V** (sortable task list, static) is deferred *out of the design-cluster window* — utilitarian, trivially composable from primitives — and its visual build folds into this chat, which is therefore a **single chat** (not a `-V`/`-W` pair) taking its own master-table EO (43), build-track, and is **not** a window chat (Window N) [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md][doc:PHASE_4_BUILD_PLAN_part1.md]. The copy-authoring test applied to the whole folded chat: it authors no new user-facing butler copy (the pre-split 054 carried no 🎩), so `Skills: —` and no 🎩. EO 43 places it after chat 028 (EO 30, the task APIs it wires) [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Dependencies:** Chat 028 (Stage 2 gating prereq [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 43; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Its tasks UI is consumed by chat 055 (task placement, EO 67).

**End-of-session checks:** Task CRUD works on both surfaces. Sorting is correct. The list visual matches the 107 design system.

### Chat 055 — Tasks Module: Placement Algorithm

*Block 7 · EO 67 · 🟡 🤖 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PRD §6.1 (focus-block placement); chat 022 (`synthesizePlan`); chat 054-W (tasks UI).

**Goal:** Implement the algorithm that places pending tasks into focus blocks during plan synthesis. Tasks are sorted by priority and deadline proximity; they are split across multiple focus windows if longer than available time; they respect calendar-event boundaries.

**Output:**
- `packages/ai/src/scheduling/taskPlacement.ts` — the algorithm that takes a list of pending tasks and the available open time windows in the day and returns the focus-block assignments
- In-file documentation explaining the algorithm
- Integration into `synthesizePlan` so that focus blocks reference the placed tasks

**Implementation notes:** The algorithm is greedy: sort tasks by priority descending, then deadline ascending, then iterate; for each task, find the next available window large enough; if no single window is large enough, split the task across the largest available windows. This is not optimal in the operations-research sense, but it is good enough for V1 and easy to understand. The 🤖 flag marks the AI-layer scheduling integration where prompt versioning matters, carried as a flag with `Skills: —` per the Part 1 legend [doc:PHASE_4_BUILD_PLAN_part1.md]. EO 67 places this after both gating chats (022 EO 27, 054-W EO 43) [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Dependencies:** Chats 022, 054-W (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 67; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply. It is the gating predecessor for chat 056 (EO 68).

**End-of-session checks:** A user with several pending tasks of varying priorities sees them placed correctly in the generated plan.

### Chat 056 — Tasks Module: Reflow and Over-Commit Prompt

*Block 7 · EO 68 · 🎩 🔵 🟢 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** PRD §6.1 (mid-day reflow, over-commit prompt); chat 055; chat 057 (later-numbered hard dependency — see Critical Path, canonical).

**Goal:** Implement the mid-day reflow logic that activates when a new calendar event displaces a task chunk; the engine attempts a silent reshuffle and surfaces a prompt only when no resolution exists within the day. The prompt is voice-gated and asks the user to choose which items move to tomorrow.

**Output:**
- The reflow logic invoked when the calendar sync detects a new conflicting event (the trigger from chat 067)
- `apps/web/components/plan/OverCommitPrompt.tsx` and the mobile equivalent — the prompt UI

**Implementation notes:** The silent reshuffle attempts to fit displaced task chunks into the next available windows; if all task work cannot fit in the remaining day, the over-commit prompt fires, presenting the conflicting items as a list and asking the user to select which to keep and which to defer. Precedence ordering with chat 067: when a calendar sync delivers a new or modified event, chat 067's conflict resolution runs FIRST (any AI-placed blocks overlapping the new event are set to `rescheduled` and removed from the visible plan), then this chat's reflow runs SECOND on any remaining task displacement caused by the removal; the order is documented in both chats so it is unambiguous. The 🎩 flag is the copy-authoring marker for the voice-gated over-commit copy; caveman/stop-slop are named accordingly [doc:PHASE_4_BUILD_PLAN_part1.md]. **Critical Path back-reference (restated inline, Critical Path section canonical):** this chat carries a hard dependency on chat 057, which is numbered after it. The Part 1 How-to-Use back-reference list enumerates 056 → 057, and the **Critical Path section (Part 10) remains canonical** for the ordering; this inline restatement enforces the rule at the per-chat level, and the master table places 057 at EO 56 before this chat at EO 68, satisfying the constraint [doc:PHASE_4_BUILD_PLAN_part1.md]. (The prior plan body lists only chat 055 in this chat's stated dependencies and does not spell out the 057 dependency's rationale; the back-reference is carried forward as recorded in the How-to-Use list, with the gap between the body's stated dependencies and the back-reference list flagged here rather than reconciled [doc:PHASE_4_BUILD_PLAN.md].)

**Dependencies:** Chat 055 (Stage 2 gating prereq [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]); chat 057 (later-numbered hard dependency — see Critical Path, canonical). Runs at EO 68, after 057 at EO 56.

**End-of-session checks:** A reflow scenario produces a silent successful reshuffle. An over-commit scenario surfaces the prompt with the correct items.

### Chat 057 — Weekly Planning Session: Steps 1 through 3

*Block 7 · EO 56 · 🔵 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PRD §3.3 (Weekly Planning Flow); chat 029 (weekly-priorities API); LAYER_4_EXPERIENCE_IDENTITY.md (Sunday prompt copy).

**Goal:** Build the first three steps of the weekly planning session: the Sunday prompt (dismissible butler line plus banner); step 1, prior-week review (completion percentage); step 2, priority entry (three to five fields with AI pre-suggestion from outstanding tasks via Haiku); and step 3, fixed-event confirmation.

**Output:**
- `apps/web/app/(app)/weekly-planning/page.tsx` — the weekly planning surface, web-primary
- `apps/mobile/app/(app)/weekly-planning.tsx` — mobile parity
- A Sunday-morning prompt component that displays in the day view
- Step-by-step UI for the first three steps

**Implementation notes:** The Sunday prompt fires on Sunday mornings in the user's local timezone and is dismissible without action; the session is accessible all day Sunday via the weekly-planner navigation. Step 1 displays the prior week's completion percentage; step 2 uses the suggested priorities from chat 023's `suggestWeeklyPriorities` Haiku call (which takes outstanding tasks and the prior week's completion data and returns 3–5 suggested priority strings — this function is part of chat 023's outputs and replaces the prior incorrect reference to `generateCheckInQuestion`), with the user able to overwrite; step 3 displays the upcoming week's calendar events for review. EO 56 places this ahead of chat 056 (EO 68), satisfying the 056 → 057 Critical Path back-reference, and ahead of chat 058 (EO 69), satisfying 058's dependency on 057 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md][doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 029, 023 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 56; no later-EO hard dependency of its own, so the Critical Path back-reference caveat does not bind this chat (it is the *target* of 056's back-reference, not the holder). It is the gating predecessor for chats 056 (EO 68) and 058 (EO 69).

**End-of-session checks:** A user can engage the weekly planning session on Sunday and complete the first three steps.

### Chat 058 — Weekly Planning Session: Steps 4 and 5

*Block 7 · EO 69 · 🔵 🟢 🤖 🎩 · Skills: caveman, stop-slop · ⚠️ · Window N · CD-flags: —*

**Load at session start:** PRD §3.3 (Steps 4–5); chat 022 (`synthesizePlan`); chat 057.

**Goal:** Build the final two steps of the weekly planning session: step 4, module adjustments (pause modules for travel, dinner-out flags); and step 5, the Sonnet weekly-template generation (seven-day grid review). The user accepts the plan or makes block-level adjustments, after which the per-day plans are written.

**Output:**
- The step 4 UI for module adjustments
- The step 5 weekly-synthesis call to Sonnet and the seven-day review grid
- `packages/ai/src/weeklyTemplate.ts` — the Sonnet call

**Implementation notes:** The weekly-template generation is the most complex Sonnet call in the application; it produces seven days of plans simultaneously with consistent priority threading. The user reviews the entire week in a grid view and either accepts in bulk or adjusts individual blocks. On accept, the per-day plans are written via batch insert to `daily_plans` and `blocks`. Timezone handling: the 7-day window starts at `start_of_local_day(user.timezone)` on the Sunday of generation, computed by the same Postgres function added in chat 004, so DST transitions during the week are handled correctly and per-day boundaries align with the user's local calendar. Anthropic-spend interaction with chat 097a: weekly synthesis amortizes to roughly $0.004/day per active user, but the actual spend lands ~$0.030 on Sunday per user as a burst. The $0.030 figure assumes approximately 5K input tokens (Layer 1 system prompt is cache-shared with daily synthesis, paid at 0.1× input rate) plus approximately 1.5K output tokens (compressed weekly view across 7 days, roughly 200 tokens per day): `(5,000/1,000,000) × $3 × 0.1 + (1,500/1,000,000) × $15 = $0.0015 + $0.0225 = $0.024` warm-cache, or up to `$0.0375` fully cold-cache; the $0.030 midpoint assumes a partial cache hit on the system prompt. If a future prompt change pushes the weekly output above 1.5K tokens, the Sunday spike scales linearly with output volume; chat 058's eval-baseline verification on chat 020 captures regressions. The chat 097a budget formula (`max($5/day floor, $1.20/user/month × (active+trial users) / 30)`) and its 80%/100%/200% alert thresholds accommodate this Sunday spike — alerts are tuned to expect the burst rather than fire on it. (Per H-1 decision, the coefficient is $1.20 to match operative AI cost.) The 🎩 flag is the copy-authoring marker for the user-facing weekly-planning copy (caveman, stop-slop); the 🤖 flag marks the weekly-synthesis AI call where prompt versioning matters and is carried as a flag without an invented skill name [doc:PHASE_4_BUILD_PLAN_part1.md]. This chat is ⚠️ in the prior plan and the Risk Map; elevated-risk handling (multiple iterations) applies because the Sonnet weekly-template generation is the most complex AI call in the application, producing seven days of plans simultaneously with priority threading.

**Dependencies:** Chats 057, 022 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 69; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** A full weekly planning session completes successfully. The generated plan is consistent across days. User adjustments persist.

### Chat 059a — Sleep Module Logic

*Block 7 · EO 70 · 🎩 🟡 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** PRD §6.4 (Sleep module); chat 022 (`synthesizePlan`); chat 035-W (module-prefs persistence) and chat 046 (quiet-hours utility).

**Goal:** Implement the sleep module's plan-synthesis hooks: wind-down block placement N minutes before `bedtime_target`, the bedtime butler-line trigger, and quiet-hours enforcement integration.

**Output:**
- `packages/ai/src/synthesizePlan.sleep.ts` — adds a wind-down block to the plan based on the user's `bedtime_target`
- Integration with the quiet-hours utility from chat 046

**Implementation notes:** The wind-down block default is fifteen minutes before bedtime; the user can adjust it in module preferences. The bedtime butler line fires from the ambient-line engine when the current time is within five minutes of bedtime. The 🎩 flag is the copy-authoring marker for the bedtime butler line (caveman, stop-slop) [doc:PHASE_4_BUILD_PLAN_part1.md]. **New-chat note:** 059a is the sleep-module-logic half of the original 059 work, carrying its own master-table position (EO 70, build-track) distinct from the iOS alarm screen 059b (EO 13, build-track native); the two were separated because the alarm screen is native iOS work owned by the build track while the sleep logic is build-track synthesis-hook work [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. Stage 2 records this chat's gating predecessor as chat 035-W (module-prefs persistence) rather than the bare 035 the prior plan named, since the persistence wiring is what the module preference reads; EO 70 sits after 035-W (EO 53) and 022 (EO 27) [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Dependencies:** Chats 035-W, 022 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 70; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** A user with sleep enabled sees a wind-down block in their daily plan. The bedtime butler line fires correctly.

### Chat 059b — iOS Alarm Screen

*Block 7 · EO 13 · 🟢 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** PRD §3.2 (Morning alarm); LAYER_4_EXPERIENCE_IDENTITY.md (alarm design); Apple Human Interface Guidelines for notifications; the 107 visual spec for the alarm screen (the design track supplies the visual spec; the build track implements it in SwiftUI).

**Goal:** Build the iOS native alarm screen with two edge-to-edge buttons (SNOOZE and STOP) that dismisses on a single tap without requiring phone unlock. This is a Notification Service Extension or actionable notification with custom UI, both of which require native iOS work.

**Output:**
- `apps/mobile/ios/VesperAlarmExtension/` — a Notification Service Extension target added to the Xcode project (via Expo prebuild + manual Xcode work)
- The extension implements custom UI for the alarm notification with the two-button layout
- The alarm scheduling logic in `apps/mobile/lib/alarm.ts` that schedules local notifications at the user's `wake_target`, with PostHog event emission at each lifecycle stage: `alarm_scheduled` (carrying `{wake_target_local, scheduled_at, snooze_minutes}`); `alarm_fired` (carrying `{fired_at, latency_from_target_ms}`, set on the Notification Service Extension via app-group shared `UserDefaults` so the React Native side can read it on next foreground); `alarm_dismissed` (carrying `{action: 'snooze'|'stop', dismissed_at}`). Without these, post-launch "why didn't my alarm fire" debugging has no client-side trail beyond the user's verbal report. The events are added to chat 096's PostHog taxonomy
- `docs/RUNBOOKS/IOS_ALARM_REBUILD.md` — a runbook describing the manual Xcode steps required to recreate the Notification Service Extension target after `expo prebuild --clean` regenerates the iOS project; the same pattern as the widget rebuild runbook owned by chat 077

**Implementation notes:** This chat involves manual Xcode work because Expo does not have first-class support for Notification Service Extensions; the prebuild generates the iOS project, then the founder adds the target manually in Xcode. The extension's UI is implemented in SwiftUI. The two-button layout with edge-to-edge buttons is achieved via the notification's category configuration. Dismissal-without-unlock requires the notification's `interruption-level` to be `time-sensitive` or `critical`; time-sensitive is the appropriate choice for normal alarms (critical is reserved for emergency alerts). The runbook is essential because every `expo prebuild --clean` wipes the manually-added target; recovery requires the documented step list rather than improvisation. **Ownership note:** at EO 13 this is **build-track native** work — the build track owns the native SwiftUI alarm screen, with the design track supplying only the visual spec via 107, per Stage 2 §1 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. Elevated-risk handling per the ⚠️ flag: native iOS work via a Notification Service Extension is unfamiliar territory for most Expo developers and requires Xcode debugging. EO 13 is early because the chat depends only on the built mobile shell (chat 013).

**Dependencies:** Chat 013 (Stage 2 lists no gating unbuilt prereq; native call per §1 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 13; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** A scheduled alarm fires on the physical iPhone with the two-button layout. Tapping either button dismisses the alarm.

### Chat 060 — Medications Module

*Block 7 · EO 54 · 🔵 🟢 · Skills: — · ⚠️ · Window N · CD-flags: F2 C*

**Load at session start:** PRD §6.5 (Medications); TECHNICAL_SPEC.md §3.9 (`medications` table); chat 005 (audit trigger); the F2 determination recorded by chat 111 (the `medications` quiet-hours / fire-on-time default).

**Goal:** Build the medications module with the strictest RLS verified, the audit trigger firing on every CRUD verified end-to-end, the `times[]` picker for daily dose times, local-notification scheduling via expo-notifications, quiet-hours respect with a per-medication override, and PostHog posture handled correctly on the medications surface.

**Output:**
- `apps/web/app/(app)/medications/page.tsx` and `apps/mobile/app/(tabs)/medications.tsx`
- Medication CRUD UI with the `times[]` picker
- `apps/web/app/api/v1/medications/route.ts` and `apps/web/app/api/v1/medications/[id]/route.ts` — medication CRUD API
- Local-notification scheduling in `apps/mobile/lib/medicationReminders.ts`

**Implementation notes:** Medications are the most sensitive data in the application (Risk Map: RLS errors here are breach-class incidents). RLS strictest means the SELECT, INSERT, UPDATE, and DELETE policies all check `auth.uid() = user_id` with no exceptions. The audit trigger fires on every operation and writes to `security_audit_log`. The `times[]` picker lets the user specify multiple times of day for a daily medication; for weekly or custom frequency the picker UI adjusts. Local notifications are scheduled by expo-notifications at the user's specified times; quiet hours suppress them unless the medication has the override flag set. The push-permission posture is soft-gate, not hard-gate: iOS does not allow re-prompting the system permission dialog after a user denies it, so at medication-add time the surface shows a contextual in-app rationale explaining that reminders only work when notifications are enabled, with a direct deep link to iOS Settings → Vesper → Notifications. A persistent prominent in-app banner (red-priority style) appears at each scheduled dose time when the app is in the foreground. If the app is closed and permission is denied, the dose reminder cannot fire — this is the user's informed choice. The settings panel always exposes the same iOS Settings deep link. Failure-mode capture: any `expo-notifications` schedule call that throws is captured to Sentry with the error message, and a PostHog event `medication_notification_schedule_failed` is emitted with `{medication_id, scheduled_times_count, error_class}` — this catches the silent-failure window between "user added medication" and "user reports never receiving reminder." PostHog session-recording masking is not applied at V1: autocapture is OFF (chat 096) and session recording is not enabled at V1, so the prior `data-ph-no-capture` instruction is unnecessary; if session recording is enabled at V1.5, every surface displaying medication content must be wrapped with `data-ph-no-capture` at that time. **CD-flag F2 (consumed here):** the master table tags this chat `F2 C` — the `medications` quiet-hours / fire-on-time default question (is fire-on-time the default with a per-med shift-out opt-in? read `…0006_modules.sql`), first read in chat 111 and consumed here; Stage 2 §6 lists F2's attached chats as 060 and 111 with 111 as the first reader, and the master table and Stage 2 agree, so no discrepancy arises [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md][doc:PHASE_4_BUILD_PLAN_part1.md]. **The `Fwin F#` window counter and this `CD-flag F2` token share an `F#` shape but are unrelated and must be read field-scoped** — this is not a window chat (Window N); its `F2 C` is the CANNOT-DETERMINE flag it consumes, per the Part 1 naming caveat. Elevated-risk handling per the ⚠️ flag.

**Dependencies:** Chats 005, 028 (Stage 2 gating prereq is 028, with built foundation 005 assumed; consumes the chat 111 F2 determination [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 54; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** Medication CRUD works on both surfaces. Notifications fire at the configured times (respecting the F2-determined quiet-hours default). The audit trigger writes to `security_audit_log` on every change (verified by inserting a test medication and confirming the row). PostHog autocapture is verified OFF on the medications routes (no `posthog.capture` calls on form inputs or sensitive fields); when session recording is enabled at V1.5, this check is replaced with the masking verification (every surface displaying medication content carries `data-ph-no-capture` and PostHog recordings produce blank frames for those regions).

### Chat 061 — Finance and Bills Module

*Block 7 · EO 55 · 🎩 🔵 🟢 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** PRD §6.7 (Finance); TECHNICAL_SPEC.md §3.11 (`bills` table).

**Goal:** Build the bills CRUD UI and API, defaulting the finance module to OFF at onboarding, with bill-due-tomorrow butler-line copy authored for the worker in chat 075. PostHog posture is handled on the bills surface in parallel with the medications posture.

**Output:**
- `apps/web/app/(app)/bills/page.tsx` and `apps/mobile/app/(tabs)/bills.tsx`
- Bills CRUD UI
- `apps/web/app/api/v1/bills/route.ts` and `apps/web/app/api/v1/bills/[id]/route.ts`
- The voice-gated bill-reminder copy

**Implementation notes:** Bills CRUD includes name, amount, `due_day_of_month`, frequency, and category. The module is OFF by default; users must enable it explicitly via the module toggle. The 🎩 flag is the copy-authoring marker for the bill-due-tomorrow butler copy (caveman, stop-slop) [doc:PHASE_4_BUILD_PLAN_part1.md]. EO 55 places this immediately after the medications module (060, EO 54), with which it shares the audit-trigger and PostHog-posture verification pattern [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Dependencies:** Chat 028 (Stage 2 gating prereq [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 55; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** Bills CRUD works. The module toggle correctly hides the surface when disabled. The audit trigger writes to `security_audit_log` on every bills CRUD operation (verified by inserting a test bill and confirming the row, parallel to the medications verification in chat 060). RLS on the `bills` table is verified: SELECT, INSERT, UPDATE, and DELETE all check `auth.uid() = user_id` with no exceptions. PostHog autocapture is verified OFF on the bills routes; session-recording masking via `data-ph-no-capture` is V1.5 work conditional on session-recording adoption (the same posture as chat 060).

### Chat 062 — Errands Module

*Block 7 · EO 71 · 🎩 🔵 🟢 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** PRD §6.6 (Errands); TECHNICAL_SPEC.md §3.10 (`recurring_errands` table); chat 045 (NL input pipeline for one-off errand creation).

**Goal:** Build the errands module with recurring-errand CRUD (frequency plus day-of-week anchor), one-off errand creation via the natural-language input, and the errands block-detail UI showing the errand checklist.

**Output:**
- `apps/web/app/(app)/errands/page.tsx` and `apps/mobile/app/(tabs)/errands.tsx` — recurring-errands management
- `apps/web/app/api/v1/recurring-errands/route.ts` and the `[id]/route.ts` equivalent
- `apps/web/components/plan/details/ErrandsBlock.tsx` and the mobile equivalent — the errands block-detail view with a flat checklist of errand stops ordered by deadline (no routing or sequencing is applied; the local intelligence layer has been removed from V1)

**Implementation notes:** Recurring errands have a frequency (weekly, biweekly, monthly) and an optional `day_of_week` anchor. The errands block detail renders stops as a flat checklist ordered by deadline; no routing or sequencing is applied. The 🎩 flag is the copy-authoring marker for the errands user-facing copy (caveman, stop-slop) [doc:PHASE_4_BUILD_PLAN_part1.md]. EO 71 is the last Block 7 position, after chat 045 (EO 60, the NL pipeline) and chat 028 (EO 30, the task/CRUD APIs) [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Dependencies:** Chats 028, 045 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 71; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** Recurring-errands CRUD works. Errand blocks appear in the plan on the right days. The errands block detail renders the stops correctly.

---

<!-- PHASE_4_BUILD_PLAN.md — Part 7 of 10. Body continues here; conventions, legend, per-chat template, and master reordered-sequence table live in Part 1. Concatenate Parts 1→10 (a/b sub-parts in letter order) head-to-tail. -->

---

## Authoring Note for Part 7 (Blocks 8, 9, 10)

Like Parts 4–6, this part contains no built-foundation chats. Stage 1 asserts 001–020 built and 021+ unbuilt [doc:PHASE_4_REPLAN_STAGE_1_ANALYSIS.md], so every chat in Blocks 8, 9, and 10 is not-yet-built work that appears in the Part 1 master reordered-sequence table and therefore carries a **real EO and a real Model** taken verbatim from that table [doc:PHASE_4_BUILD_PLAN_part1.md]. No EO is recorded as `—`. Every meta line below was re-derived directly from the Part 1 master table rather than carried from any prior draft.

**No splits, no folds, no window chats in this part.** Per the Part 1 file-split plan and master table, Block 8 (063–067), Block 9 (071–075), and Block 10 (076–080) contain **no `-V`/`-W` splits and no folded chats** [doc:PHASE_4_BUILD_PLAN_part1.md]. Per the master table and Stage 2 §5, **no Block 8/9/10 chat is a design-cluster-window chat** — every meta line below reads `Window N`, and none carries a `Fwin F#` counter [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md][doc:PHASE_4_BUILD_PLAN_part1.md]. The 15 entries are 063, 064, 065, 066, 067, 071, 072, 073, 074, 075, 076, 077, 078, 079, 080 — exactly one chat per ID, each at its own master-table EO and Model.

**File-split-plan count agrees with the master table (no discrepancy to flag).** The Part 1 file-split plan lists Part 7 as "**15 entries**" with the parenthetical "(063–067) + (071–075) + (076–080)" [doc:PHASE_4_BUILD_PLAN_part1.md]. Because this part has no splits and no folds, the rendered body contains exactly **15 entries**, matching the file-split-plan figure. Unlike Part 6 (whose fold made the file-split-plan "19" disagree with the master-table-rendered "17"), Part 7's two counts coincide, so there is **no count discrepancy to flag** here. The single-response budget is unaffected by any inflation, so no `7a`/`7b` split is needed.

**Skill / 🎩 propagation (copy-authoring test) for non-split chats.** Following the Part 4–6 precedent, the 🎩 voice-gate flag and `Skills: caveman, stop-slop` sit on the chat that actually authors user-facing butler copy. Three Part 7 chats carry 🎩 in the prior plan's meta lines — 067, 072, 075 [doc:PHASE_4_BUILD_PLAN.md]. Applying the copy-authoring test to each:

- **067** authors a *new* butler-voice prompt string (the calendar-conflict regen prompt) — copy originates here, so 067 keeps **🎩** and `Skills: caveman, stop-slop`.
- **072** consumes the trial-reminder email copy authored in chat **091** (Resend templates 1, EO 11, which the master table scopes to "auth + trial reminders") and only *sets* in-app banner flags; it adds no new user-facing copy, so 072 shows **`Skills: —`** and carries **no 🎩**, with the rationale "adds no new copy — the trial-reminder copy came through the gate in chat 091." **Divergence flagged, not reconciled:** the prior-plan meta line carried 🎩 on 072; the copy-authoring test reassigns authorship to 091, and the divergence is recorded here rather than silently patched.
- **075** consumes the bill-due-tomorrow butler line authored in chat **061** (which Part 6 explicitly names as the author of that library entry [doc:PHASE_4_BUILD_PLAN_part6.md]) and uses the library entry verbatim; it adds no new user-facing copy, so 075 shows **`Skills: —`** and carries **no 🎩**, with the rationale "adds no new copy — the bill-line copy came through the gate in chat 061." **Divergence flagged, not reconciled:** the prior-plan meta line carried 🎩 on 075; the copy-authoring test reassigns authorship to 061, recorded here.

The 🤖 flag marks AI-layer chats where prompt versioning matters (064, 071) but the Part 1 legend names no skill to invoke for it, so a 🤖-bearing chat shows **`Skills: —`** unless it also authors butler copy [doc:PHASE_4_BUILD_PLAN_part1.md]. No Part 7 chat carries 🗄️ (no migration-authoring chat in these blocks; the GCal-channel-renewal and worker chats author worker modules, not Drizzle migrations). The `frontend-design` skill is reserved for the pure design-system chats (107 / 107a / 108a) and is used by **no** Part 7 chat — chats 077/078 *consume* the 107 native visual spec but do not invoke frontend-design [doc:PHASE_4_BUILD_PLAN_part1.md].

**Meta-line emoji ordering (per Part 2/4/5/6).** A 🎩-only build chat leads with the skill emoji then colors (067: `🎩 🔵`); when 🤖 is present, colors lead then 🤖 (064: `🔵 🤖`; 071: `🟣 🤖`); a colors-only chat shows just the package color(s). No design-track visual/static half appears in this part, so the "colors then 🎩" design-track ordering is not exercised here.

**CD-flags and the Fwin-vs-CD-flag caveat.** No Part 7 chat reads or consumes a CANNOT-DETERMINE flag — every meta line below reads `CD-flags: —` [doc:PHASE_4_BUILD_PLAN_part1.md]. Because no Part 7 chat is a window chat and none carries a CD-flag, the Part 1 naming caveat — *the `Fwin F#` window counter and the `CD-flag F#` tokens share an `F#` shape but are unrelated and must be read field-scoped* — binds **no** meta line in this part; it is noted here once for completeness and does not need per-chat restatement (contrast Part 6, where chat 060's `F2 C` required the field-scoped restatement).

**Critical Path back-references in this part.** The Part 1 How-to-Use back-reference list includes three references that govern Part 7 chats: **034 → 063/064**, **072 → 091**, and **074 → 084/087/088** [doc:PHASE_4_BUILD_PLAN_part1.md]. Each is restated inline in the chat it governs below, with the **Critical Path section (Part 10) canonical** for the ordering. The GCal critical-path chain **063 → 064 → 034** is load-bearing: 034-W (EO 52) hard-depends on the full 063→064 GCal OAuth-plus-sync flow rather than a stub, so 063 (EO 37) and 064 (EO 44, Haiku) must land before 034-W; the chain is restated in 063 and 064 and the Critical Path section governs it. Two additional cross-block hard dependencies by chat number — **073 → 080** and **075 → 080** (Block 9 consuming Block 10's live-activity-pusher immediate-trigger endpoint) — are not in the canonical Critical-Path back-reference list; they are carried below as ordinary cross-block dependencies with the prior plan's documented integration-gap note, not as Critical-Path back-references.

---

## Block 8 — Integrations (Google Calendar)

Block 8 brings Google Calendar online, with the pgsodium key rotation runbook authored as a non-negotiable deliverable. Block organization is preserved for readability; the actual run order is the EO column of the Part 1 master table, not the chat-number order in which the entries appear below — the Block 8 chats are interleaved across **EO 37 through EO 74** on the build track [doc:PHASE_4_BUILD_PLAN_part1.md]. The block opens the GCal critical-path chain 063 → 064 → 034: chat 063 (OAuth, EO 37) and chat 064 (sync, EO 44, Haiku) are the upstream of the later-numbered onboarding chat 034-W (EO 52), which hard-depends on the full integration flow; that chain is governed by the Critical Path section (Part 10), which is canonical for it, and is restated inline in 063 and 064 below.

### Chat 063 — Google Calendar OAuth, pgsodium Encryption, and Key Rotation Runbook

*Block 8 · EO 37 · 🔵 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §6 (Google Calendar OAuth); TECHNICAL_SPEC.md §14 (Open Question 1 — pgsodium key rotation); the integrations table schema; LAYER_3_TECHNICAL_ARCHITECTURE.md (encryption).

**Goal:** Implement the Google Calendar OAuth flow with token storage encrypted via pgsodium. Author the key rotation runbook as a committed file in `docs/RUNBOOKS/PGSODIUM_KEY_ROTATION.md` before any production OAuth token is ever encrypted. Build the integrations settings UI on web and mobile with the reconnect banner pattern for error states. The Apple Calendar option renders disabled with "Coming soon."

**Output:**
- `apps/web/app/api/v1/integrations/google-calendar/connect/route.ts` — POST handler that exchanges the OAuth code for tokens, encrypts via pgsodium, writes the integrations row
- `apps/web/app/api/v1/integrations/[provider]/route.ts` — DELETE handler that revokes the token with Google and deletes the row
- `apps/web/app/(app)/settings/integrations/page.tsx` and the mobile equivalent
- `docs/RUNBOOKS/PGSODIUM_KEY_ROTATION.md` — the full step-by-step rotation procedure
- `packages/db/src/encryption.ts` — the encryption helpers that wrap pgsodium
- Ownership statement: `docs/RUNBOOKS/APPLE_ROOT_CA_ROTATION.md` is authored in chat 086 (not this chat); the pgsodium runbook lives here, the Apple Root CA runbook lives in chat 086, and `docs/RUNBOOKS/README.md` from chat 003 indexes both

**Implementation notes:** The pgsodium key is a server-held key (stored as a Supabase secret); decryption happens only inside API routes that need to call the third-party provider. The runbook describes the rotation procedure: generate a new key, add it alongside the old key (pgsodium supports multiple keys), re-encrypt all integrations rows with the new key, mark the old key inactive, and after a verification period remove the old key. The runbook also describes the recovery procedure if the encryption key is ever lost (data is unrecoverable; users must re-authenticate). The runbook is critical because rotation is a security operation that cannot be improvised under pressure. Both the OAuth code-for-token exchange (Google's `https://oauth2.googleapis.com/token` endpoint) and the token-revoke call on disconnect are wrapped in try/catch with Sentry capture of the response status code, the error body, and a correlation ID; the structured log includes the user_id, the provider, and the operation outcome (success / auth-error / network-error). This is the diagnostic trail for "I clicked Connect and nothing happened" reports. **Risk note:** this chat (EO 37) is ⚠️ in the prior plan and the Risk Map because token encryption is security-critical and the rotation runbook is non-negotiable [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. **Critical Path (canonical) restatement:** this chat opens the GCal chain **063 → 064 → 034**; the later-numbered onboarding chat 034-W (EO 52) hard-depends on the full 063→064 OAuth-plus-sync flow rather than a stub, so 063 (EO 37) must land before 034-W. The chain ordering is governed by the **Critical Path section (Part 10), which is canonical** for it [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 030, 012, 013, 008 (Stage 2 gating prereq is 030, with built foundations 008/012/013 assumed [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 37. Restates the later-numbered back-reference 034-W (EO 52) → 063, governed by the Critical Path section (canonical).

**End-of-session checks:** A user can connect Google Calendar. Tokens are encrypted at rest (verified by inspecting the integrations row). The audit trigger writes to `security_audit_log` on every integrations row INSERT and DELETE (verified by the chat 006 audit-schema.ts script and by inspecting `security_audit_log` after a test connect-then-disconnect cycle). The runbook is complete and committed.

### Chat 064 — Google Calendar Sync Logic, Token Refresh, Event Classification

*Block 8 · EO 44 · 🔵 🤖 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §6 (Google Calendar sync behavior, token refresh); chat 023 (`classifyCalendarEvent`); chat 063.

**Goal:** Implement the Google Calendar event fetch with automatic token refresh on expiry, the Haiku event classification for ambiguous events (e.g., a calendar event titled "Meeting with Sam" classified as a work block_type), and the integration of these events into plan synthesis as fixed constraints.

**Output:**
- `packages/shared/integrations/googleCalendar.ts` — `getTodayEvents(userId): Promise<CalendarEvent[]>` with automatic refresh
- Integration with the Layer 4 of plan synthesis context builders
- `last_synced_at` and `last_error` updates on the integrations row

**Implementation notes:** The token refresh logic checks the `integrations.expires_at` field before each call; if expired or within five minutes of expiry, it calls the Google OAuth token endpoint with the refresh token to get a new access token, then re-encrypts and updates the integrations row. If the refresh call fails (typically because the user has revoked access in their Google account), the integrations row transitions from `status='connected'` to `status='error'`, `last_error` is populated with the failure cause, every refresh attempt logs a Sentry breadcrumb with the user_id, the response status, and the error code on any non-2xx response (so transient errors that subsequently succeed remain visible in Sentry breadcrumbs even when `last_error` is overwritten on recovery), and the plan synthesis context builder explicitly checks `integrations.status` before treating calendar events as available: if `status='error'`, the synthesis call surfaces a chat 099 broken-integration banner trigger and degrades the plan with an empty calendar events array — no silent degradation, no further retry until the user explicitly reconnects. The reconnect banner in chat 099 reads the `status='error'` field as the surface trigger rather than `last_error IS NOT NULL`, so transient errors that the next sync recovers from do not flicker the banner. The event classification calls the batched Haiku classifier from chat 023 (`classifyCalendarEventsBatch`) when 2 or more ambiguous events need classification in a single sync (the common case at morning sync); exactly 1 ambiguous event uses the single `classifyCalendarEvent` call (no batching overhead for a one-element batch). Events with words like "gym" or "lunch" are classified by rules first and never reach the Haiku call. This chat (EO 44) is **not** ⚠️ in the prior plan; the event classification is the lightest AI-layer call in the GCal chain (rule-first classification with a Haiku fallback only for genuinely ambiguous titles) [doc:PHASE_4_BUILD_PLAN.md]. The 🤖 flag marks this as an AI-layer chat where prompt versioning matters (the classification prompt), but the Part 1 legend names no skill to invoke for 🤖, so it is carried as a flag with `Skills: —`, not expanded into an invented skill name [doc:PHASE_4_BUILD_PLAN_part1.md]. **Critical Path (canonical) restatement:** this chat is the middle of the GCal chain **063 → 064 → 034**; the later-numbered onboarding chat 034-W (EO 52) requires the full sync behavior — not just OAuth connection — so 064 (EO 44) must land before 034-W. The chain ordering is governed by the **Critical Path section (Part 10), which is canonical** for it [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 063, 023 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 44, after 063 (EO 37). Restates the later-numbered back-reference 034-W (EO 52) → 064, governed by the Critical Path section (canonical).

**End-of-session checks:** A user with Google Calendar connected sees their calendar events as fixed blocks in the daily plan. Token refresh works automatically.

### Chat 065 — Google Calendar Push Webhook Channel Registration and Receiver

*Block 8 · EO 72 · 🔵 · Skills: — · 🚧 · Window N · CD-flags: —*

**Load at session start:** Google Calendar Push Notifications API documentation; chat 064.

**Goal:** Register a push webhook channel with Google so that calendar changes propagate to the application in near-real time rather than only at plan generation time. Implement the receiver endpoint that validates the Google headers and triggers an incremental sync. This chat is partially Cutover-blocked (🚧): channel registration requires the production HTTPS endpoint, but the receiver endpoint can be implemented and tested with mock requests in development.

**Output:**
- `apps/web/app/webhooks/google-calendar/route.ts` — POST handler that validates the `X-Goog-Resource-State` and `X-Goog-Channel-Token` headers, then triggers an incremental sync via the channel's resource URI
- `apps/web/lib/googleCalendar/registerWatch.ts` — the channel registration function called when an integration is connected

**Implementation notes:** Channel registration is Cutover-blocked because Google requires an HTTPS endpoint with a verified domain (the Google Site Verification step in Cutover C-17). In development, channels are not registered, and the sync logic from chat 064 runs only at plan generation time. After Cutover, channels are registered automatically when integrations are created. Every receipt logs a structured entry with the `X-Goog-Channel-ID`, `X-Goog-Resource-ID`, `X-Goog-Message-Number`, and the `X-Goog-Channel-Token` validation result. On token-mismatch, the receiver returns 401 with no sync trigger and a Sentry alert (the only legitimate sender is Google, so a mismatch indicates either a misconfigured channel or an attempted spoof). On successful receipt, the incremental sync trigger outcome (success / error / no-changes) is appended to the same log entry so the full receipt-to-sync flow is observable in a single Sentry event. **Flag note:** this chat (EO 72) carries the 🚧 flag forward from the prior plan because channel registration cannot run until the Cutover Block completes (C-17 domain verification) [doc:PHASE_4_BUILD_PLAN.md][doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 064, plus Cutover C-17 for full functionality (Stage 2 gating prereq is 064 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 72; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** The receiver endpoint validates mock requests correctly. The channel registration code is correct (verified against the Google API documentation).

### Chat 066 — Google Calendar Channel Renewal Worker

*Block 8 · EO 73 · 🟣 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** Chat 065; Google Calendar push channel expiration policy (max 7 days).

**Goal:** Build the Cloudflare Worker module that runs daily and renews Google Calendar push channels that are expiring within 24 hours. Without this module, push sync silently dies after a week of channel expiration.

**Output:**
- `workers/daily-cron/modules/gcal-channel-renewal.ts` — the channel renewal module dispatched from the consolidated daily-cron worker at the 5am UTC tick (per Chat 001 Decision 20); no longer a standalone `workers/gcal-channel-renewal/` directory
- `docs/RUNBOOKS/GCAL_CHANNEL_RENEWAL.md` — the operational runbook covering (a) detection of silent multi-day worker failure via the integrations-table query for channels with expiration in the past; (b) manual channel re-registration procedure for affected users; (c) decision tree on whether to email affected users; (d) post-fix verification steps; (e) how to confirm the worker is firing on schedule via the daily-cron logs

**Implementation notes:** The module queries integrations where the channel expiration is within 24 hours, re-registers the channel via Google's API, and updates the integrations row with the new expiration. Each module run logs start time, end time, integrations processed, and renewals attempted / succeeded / failed counts to `completion_log` with `event_type='gcal_channel_renewal_run'`. Failed renewals are individually logged to Sentry with the user_id and the Google API error. The chat 097a alerting layer fires if the module does not execute its 5am UTC dispatch within a 90-minute window (worker-didn't-run defense). The 🟣 package color reflects the Cloudflare Worker output, per the Part 1 legend [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chat 065 (Stage 2 gating prereq [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 73; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** The worker runs locally via wrangler and successfully renews a test channel.

### Chat 067 — Google Calendar Conflict Resolution

*Block 8 · EO 74 · 🎩 🔵 · Skills: caveman, stop-slop · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §6 (Conflict resolution); chat 045 (ambient line for prompt display).

**Goal:** Implement the conflict resolution logic: when a Google Calendar sync delivers a new or modified event that overlaps an existing AI-placed block, the block is silently set to `rescheduled` status and removed from the visible plan, and a butler-voice prompt offers to regenerate the rest of the day.

**Output:**
- `packages/shared/integrations/googleCalendar.conflict.ts` — conflict detection logic
- The integration with the ambient line and butler prompt UI for surfacing the resolution choice
- A `completion_log` write with `event_type=plan_regenerated` and `trigger source=calendar_conflict`
- PostHog events `calendar_conflict_detected` (on detection, with payload `{conflict_count, user_action_pending}`) and `calendar_conflict_resolved` (on user action, with payload `{user_action: 'regenerated' | 'dismissed', conflict_count}`) so post-launch analysis of conflict frequency and resolution choices is queryable. Add both events to chat 096's PostHog taxonomy

**Implementation notes:** The conflict detection runs after each calendar sync. It checks for overlap between the new/modified event and existing blocks; for each conflict, the block's status is updated to `rescheduled` and the block is removed from the timeline. The butler-voice prompt appears in the ambient-line surface: "Your plan needs another look. Shall I redo the rest of today?" If accepted, plan generation fires for the affected day. If dismissed, the plan remains in its post-removal state. Precedence ordering with chat 056: this chat's conflict resolution runs FIRST on every calendar sync (AI-placed overlapping blocks set to `rescheduled`); chat 056's reflow runs SECOND on any task displacement that results. Documented in both chats so the order is unambiguous. **Skill / 🎩 note (copy-authoring test):** this chat **authors a new user-facing butler-voice prompt string** (the calendar-conflict regen prompt surfaced via the ambient line) rather than consuming a pre-existing library entry; copy originates here, so the 🎩 voice-gate flag and `Skills: caveman, stop-slop` sit on this chat per the copy-authoring test [doc:PHASE_4_BUILD_PLAN_part1.md]. The chat loads chat 045 for the ambient-line *display surface* but authors the prompt *copy* itself. **Risk note:** this chat (EO 74) is ⚠️ in the prior plan and the Risk Map (a missed conflict leaves a stale plan or a regen loop) [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. 

**Dependencies:** Chats 064, 045 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 74; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** A test scenario with a conflicting event triggers the prompt correctly. Acceptance regenerates the plan. Dismissal leaves the gap.

*(Chats 068, 069, and 070 were deleted intentionally — the features they covered have been removed. The numbering skips them; there are no chats 068–070. New chats start from 071.)*

---

## Block 9 — Cloudflare Workers

Block 9 builds the scheduled workers that handle autonomous timed actions. Per Chat 001 Decision 20 (cron consolidation pattern), the Block 9 footprint on Cloudflare Workers is:

- `cache-prewarm` — HTTP-triggered, no cron (chat 071); fires from the iOS alarm path
- `daily-cron` — single consolidated worker that dispatches by hour-of-UTC to its registered modules: trial-reminder and dunning-check (chat 072), hard-delete (chat 073), reconciliation (chat 074), bill-reminder and apns-token-cleanup (chat 075), gcal-channel-renewal (chat 066), spend-monitor (chat 097a). The apple-pki-monitor (chat 086a) is intentionally kept as a standalone weekly-cron worker because its weekly schedule does not compose cleanly with daily-cron's hourly dispatch model; standalone keeps the worker logic simple. The Cloudflare Workers paid-tier cron-trigger budget is 250 per account, so the one extra trigger from 086a is well within budget.
- `live-activity-pusher` — stays separate (chat 080) because of its tight CPU budget and 5-minute cron cadence

Each chat in this block still describes its own logic; the worker boundary is purely a deployment concern. The consolidation keeps the cron-job count under the Cloudflare Workers free-tier ceiling without changing the per-feature implementation. Block organization is preserved for readability; the actual run order is the EO column of the Part 1 master table — the Block 9 chats are interleaved across **EO 81 through EO 92** on the build track [doc:PHASE_4_BUILD_PLAN_part1.md]. Two late-binding references govern Block 9 chats and are restated inline below: **072 → 091** (canonical in the Critical Path section) and the cross-block dependencies **073 → 080** and **075 → 080** (carried as ordinary cross-block dependencies, not Critical-Path back-references).

### Chat 071 — Cache Pre-Warm Worker

*Block 9 · EO 83 · 🟣 🤖 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §10 (Cloudflare Workers, cron triggers); TECHNICAL_SPEC.md §5 (Cache pre-warm strategy); chats 021, 022 (context builders and synthesizePlan); chat 059b (iOS alarm firing path).

**Goal:** Build the Cloudflare Worker that warms the Anthropic prompt cache shortly before a user opens the app each morning, dropping first-plan latency from approximately 8 seconds to approximately 2 seconds on cache-hit mornings. The warm trigger is event-driven (fired by the iOS alarm path in chat 059b for mobile users with sleep alarms configured) rather than cron-based; this targets warming to users who are about to open the app and avoids the wasted spend of broadcast-style warming.

**Output:**
- `workers/cache-prewarm/index.ts` — the worker entry point exposing a single HTTP endpoint `/warm?userId=X` authenticated via an internal shared-secret
- `workers/cache-prewarm/wrangler.toml` — no cron schedule; the worker runs only on HTTP trigger
- The iOS alarm firing path in chat 059b calls this worker via fetch when the alarm fires; web users and mobile users without alarms get cold-cache first-plan generation (acceptable; cold-cache adds ~6 seconds, which is fine for users who are not in a morning-ritual mode)
- The worker logic: read the user's `last_warmed_at` column; if it was within the past 5 minutes, no-op (avoids double-warm on rapid alarm dismiss-then-snooze); otherwise, make a lightweight Anthropic call with Layer 1, Layer 2, and Layer 3 cache markers populated but Layer 4 left empty; update `users.last_warmed_at` to now; log to `completion_log` with `event_type=cache_prewarm`
- Sentry breadcrumbs for each warm attempt
- CPU time monitoring (the worker must complete within Cloudflare's 10ms CPU limit on the free tier or 50ms on the paid tier; the warm call's network wait is not CPU time)

**Implementation notes:** The earlier design used a per-minute cron with timezone-aware queries to warm the cache during a 5:20–5:30 local window; that design wasted significant spend because the 5-minute Anthropic cache TTL meant warms more than 5 minutes before app open were entirely wasted, and users opening the app outside the window got cold cache anyway. The alarm-triggered design warms only when the user is about to open the app (statistical likelihood is high: the alarm just fired). The `last_warmed_at` deduplication prevents the snooze loop from triggering N warm calls in 10 minutes. The warm path is iOS-sleep-alarm-only: web users, Android users, and iOS users without the sleep module enabled do NOT get pre-warm and see cold-cache first-plan latency (~6 seconds added). This is an acceptable cost trade because those cohorts produce lower-stakes first impressions (web users typically check Vesper on desktop in mid-morning rather than as a morning ritual; Android is V1.5). The Anthropic spend formula in chat 097a (`max($5/day floor, $1.20/user/month × (active+trial users) / 30)`) explicitly accounts for the lower cache-hit rate across the non-prewarmed cohorts: cost per first plan is ~$0.060 cold versus ~$0.036 warm (per the operative AI-cost numbers locked in chat 019's token budget: cold = 10K input × $3/M + 2K output × $15/M = $0.030 + $0.030 = $0.060; warm assumes 9K of the 10K input is cache-shared at 0.1× input rate while 1K is fresh per-call: warm = 9K × $3/M × 0.1 + 1K × $3/M + 2K × $15/M = $0.0027 + $0.003 + $0.030 = $0.0357 ≈ $0.036), so the budget formula assumes a blended cost weighted by the iOS-sleep-alarm penetration rate observed in PostHog. The warm savings per first plan are ~$0.024 (40% reduction); the prewarm-for-iOS-sleep-alarm-cohort decision remains correct at the rederived numbers because even a 40% cost reduction on a high-volume morning-ritual cohort is material. The Anthropic call uses the same context builders as the real plan generation but with an empty Layer 4 (no calendar events, no pending tasks, no energy score); the call's only purpose is to populate the cache. The worker logs each warm attempt to `completion_log` with `event_type=cache_prewarm` and the user_id; this enables post-launch analysis of cache hit rates. The 🤖 flag marks this as an AI-layer chat where prompt versioning matters (the warm call must mirror the real synthesis prompt's cache-marker layout or the warm is wasted), but the Part 1 legend names no skill to invoke for 🤖, so `Skills: —` [doc:PHASE_4_BUILD_PLAN_part1.md]. **Risk note:** this chat (EO 83) is ⚠️ in the prior plan and the Risk Map (a cache-marker mismatch silently wastes spend without any visible failure) [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. 

**Dependencies:** Chats 021, 022, 059b, 005 (`last_warmed_at` column) (Stage 2 gating prereqs are 021, 022, 059b, with built foundation 005 assumed [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 83; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** The worker runs locally via wrangler and produces a cache hit on a subsequent real plan generation call. The chat 059b alarm firing path successfully POSTs to `/warm`. CPU time per invocation is within limits. A double-fire (alarm dismiss + immediate snooze) is correctly deduplicated by `last_warmed_at`.

### Chat 072 — Trial Reminder and Dunning Check Workers

*Block 9 · EO 90 · 🟣 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §10 (Cloudflare Workers); LAYER_5_BUSINESS_MONETIZATION.md (trial reminder schedule, dunning policy); chat 091 (Resend templates; this chat consumes templates that chat 091 produces, so it ships after chat 091).

**Goal:** Build two modules under the consolidated `daily-cron` worker (per Chat 001 Decision 20). The trial reminder module runs once per hour from inside the consolidated worker, identifying each user whose local 9am has just passed and who is at a trial-end checkpoint; it sends Resend emails plus sets in-app banner flags at two-day, one-day, and zero-day trial-end checkpoints (trial day 5, day 6, and day 7 respectively for the 7-day trial). The query is timezone-aware via the `start_of_local_day` Postgres function from chat 004 rather than referencing chat 071's HTTP-triggered pattern: the 2-day reminder uses `SELECT * FROM users WHERE date_trunc('day', start_of_local_day(timezone)) = date_trunc('day', trial_ends_at - interval '2 days')`, with analogous queries for the 1-day and 0-day checkpoints. The dunning check module runs once daily at 4am UTC and transitions users whose past_due window has elapsed (seven days per Tech Spec) into read_only status.

**Output:**
- `workers/daily-cron/modules/trial-reminder.ts` — the trial reminder module dispatched from the consolidated daily-cron worker at the appropriate hour tick
- `workers/daily-cron/modules/dunning-check.ts` — the dunning check module dispatched at the 4am UTC tick
- The `workers/daily-cron/wrangler.toml` cron registration covers both modules; there is no longer a standalone `workers/trial-reminder/` or `workers/dunning-check/` directory
- Both modules use the auth-aware Resend SDK for email delivery
- The dunning check module invokes the subscription state machine transition function from chat 081 to move users to read_only

**Implementation notes:** The trial reminder worker computes for each user whether today is two days before `trial_ends_at`, one day before, or the day-of (`trial_ends_at` == current local date). For each matching user, it sends the corresponding Resend email template and sets a banner flag on the user record so the app surfaces the reminder visually. The 7-day trial leaves no room for a 3-day-before reminder (that would land on day 4 of 7, too early to be useful); the compressed schedule of day-5, day-6, day-7 reminders matches the trial length. The dunning check worker queries users where `subscription_status='past_due'` and the past_due transition was more than seven days ago; for each, it transitions to read_only via the state machine. Both workers log each notification or transition to `completion_log` for analytics. **Skill / 🎩 note (copy-authoring test):** the prior-plan meta line carried 🎩 on this chat [doc:PHASE_4_BUILD_PLAN.md], but applying the copy-authoring test, this chat **adds no new user-facing copy** — the trial-reminder email copy is authored in chat **091** (Resend templates 1, EO 11, which the master table scopes to "auth + trial reminders"), and this chat only *consumes* those templates and *sets* banner flags. The copy came through the voice gate in chat 091, so this chat shows `Skills: —` and carries no 🎩. **Divergence flagged, not reconciled:** the prior-plan 🎩 on 072 is reassigned to 091 by the copy-authoring test; the divergence is recorded here rather than silently patched [doc:PHASE_4_BUILD_PLAN_part1.md]. This chat (EO 90) is not ⚠️ in the prior plan. **Critical Path (canonical) restatement:** this chat declares a hard dependency on the later-numbered chat **091** (Resend templates 1) — the **072 → 091** back-reference in the Part 1 How-to-Use list. The trial reminder module imports the email components from chat 091 directly, and TypeScript compile fails if a referenced template is missing, eliminating the risk of placeholder copy reaching production. The ordering (091 lands before 072 despite 091's lower chat number) is governed by the **Critical Path section (Part 10), which is canonical** for it [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 030 (subscription state machine stub for the dunning-check `transitionToReadOnly` function name), 081 (full subscription state machine implementation — the dunning-check module's `transitionToReadOnly` call against chat 030's stub compiles in Block 9 but the real transition behavior is gated on chat 081 landing; the trial-reminder module is unaffected by 081), 091 (Resend templates; hard dependency, not stub — the trial reminder worker imports the email components from chat 091 directly) (Stage 2 gating prereqs are 030, 081, 091 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 90. Restates the later-numbered back-reference 072 → 091, governed by the Critical Path section (canonical).

**End-of-session checks:** The trial reminder worker correctly identifies test users at the two-day, one-day, and day-of points and sends the expected emails. The dunning check worker correctly transitions test users from past_due to read_only after the configured window.

### Chat 073 — Hard-Delete Worker with Stripe Cleanup

*Block 9 · EO 91 · 🟣 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §10 (hard-delete worker); TECHNICAL_SPEC.md §4 (Account Deletion Flow); chat 030 (account delete API).

**Goal:** Build the daily worker that finds users whose `deletion_requested_at` is more than 30 days old, computes the SHA-256 hash of their email and inserts it into `deleted_user_email_hashes`, cancels their Stripe subscription if any remains active, deletes their Stripe Customer record, and then deletes the users row (which cascades via foreign keys to every child table). Verify cascade behavior before deploying to production.

**Output:**
- `workers/daily-cron/modules/hard-delete.ts` — the hard-delete module dispatched from the consolidated daily-cron worker at the 2am UTC tick (per Chat 001 Decision 20); no longer a standalone `workers/hard-delete/` directory
- A pre-deployment verification script in `workers/daily-cron/scripts/verify-hard-delete-cascade.ts` that creates a test user, populates child rows in every table, runs the deletion, and confirms all child rows are gone
- Sentry info-level log for each successful deletion
- A `docs/RUNBOOKS/HARD_DELETE_RECOVERY.md` runbook describing what to do if a deletion is run incorrectly (the answer is essentially nothing; the operation is irreversible)

**Implementation notes:** This chat carries elevated risk because hard deletion is irreversible. The cascade verification script is non-negotiable; without it, a missing `ON DELETE CASCADE` on any table would cause the deletion to fail (good) or leave orphan rows (bad). The script tests every child table: `user_profiles`, `daily_plans`, `blocks`, `tasks`, `weekly_priorities`, `medications`, `recurring_errands`, `bills`, `integrations`, `push_tokens`, `subscriptions`, `completion_log`, `security_audit_log`, `referral_credits`, `calendar_events`, `hydration_log`, `email_queue`, `delayed_jobs`, and `cancellation_events`. Note that `security_audit_log` uses `ON DELETE CASCADE` per the V1 retention policy from chat 003; audit rows are wiped along with the user, which aligns with GDPR/CCPA right-to-erasure and is acceptable because the product is not HIPAA-covered. Before invoking the SQL DELETE on `users` (and therefore the cascade), the module ends every active Live Activity for the user: it queries the user's active block set, then calls the live-activity-pusher worker's immediate-trigger endpoint with `action='end'` for each active block, sequentially. This step runs BEFORE the push_tokens cascade so that the worker still has valid tokens to authenticate the end-call. Without this, devices would continue showing the orphan activity until ActivityKit's stale-date expiry hours later. The Stripe cleanup is essential because if the Stripe subscription continues to exist, the user is charged on the next renewal even though their Vesper account is gone. The cancellation-then-delete sequence handles Stripe's internal propagation delay: `stripe.subscriptions.cancel(subId, …, { idempotencyKey: "hard-delete-cancel-{userId}" })` is called first, followed by polling `stripe.subscriptions.retrieve(subId)` until status returns 'canceled' or up to 5 retries with 500ms backoff; only then is `stripe.customers.del(customerId, { idempotencyKey: "hard-delete-del-{userId}" })` called. Both outbound Stripe calls pass an explicit Idempotency-Key per chat 084's Stripe outbound-idempotency convention, so a retry of the hard-delete module after a partial failure does not produce duplicate cancel attempts or duplicate del attempts. Without this poll, an immediate customer deletion can fail with "customer has active subscriptions" because Stripe takes 100–500ms to mark the subscription canceled internally. **Risk note:** this chat (EO 91) is ⚠️ in the prior plan and the Risk Map because hard deletion is irreversible [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. 

**Dependencies:** Chats 030 (account delete sets the trigger field), 005 (`deleted_user_email_hashes` table), 080 (live-activity-pusher immediate-trigger endpoint) (Stage 2 gating prereqs are 030 and 080, with built foundation 005 assumed [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). **Cross-block dependency note (carried, not a Critical-Path back-reference):** the end-active-Live-Activities-before-cascade step is a hard cross-block dependency from Block 9 to Block 10 — it requires chat 080's HTTP immediate-trigger endpoint and the `LIVE_ACTIVITY_TRIGGER_SECRET` to authenticate end-calls. Either chat 080 ships before chat 073's logic completes, or chat 073's first build stubs the LA-end step and a follow-up chat after chat 080 integrates it; the second option leaves a documented gap where deleted users' devices retain orphan Dynamic Island activities until ActivityKit's stale-date fires hours later. This 073 → 080 reference is **not** in the canonical Critical-Path back-reference list and is therefore carried here as an ordinary cross-block dependency with its integration-gap note, not pointed to the Critical Path section. Runs at EO 91.

**End-of-session checks:** The verification script confirms all cascade behaviors work. The worker runs successfully against a test user. The Stripe customer is deleted. The user's row and all child rows are gone. The email hash is inserted into `deleted_user_email_hashes`.

### Chat 074 — Reconciliation Worker

*Block 9 · EO 92 · 🟣 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §10 (reconciliation worker); chat 084 (Stripe webhook handler); chats 087, 088 (Apple ASSN V2 worker). This chat must ship after chats 084, 087, and 088 because it consumes the `subscription_events` table that those chats populate.

**Goal:** Build the nightly worker that compares the canonical subscription state in the `subscriptions` table against the source-of-truth events in `subscription_events`. For each user, it determines whether the `subscriptions` table accurately reflects the most recent active event from either Stripe or Apple. When there is a discrepancy, it logs the conflict to Sentry for manual review and, in low-risk cases, automatically corrects the `subscriptions` row.

**Output:**
- `workers/daily-cron/modules/reconciliation.ts` — the reconciliation module dispatched from the consolidated daily-cron worker at the 3am UTC tick (per Chat 001 Decision 20) plus an HTTP-triggered path exposed on the same worker for inline calls; no longer a standalone `workers/reconciliation/` directory
- Inline reconciliation triggers: chats 084 and 087/088 (Stripe and Apple webhook workers) insert a row into the `delayed_jobs` table from chat 005 with `job_type='reconcile_subscription'`, `payload={ userId }`, and `scheduled_for = now() + interval '5 minutes'`; the daily-cron worker (running at each hour tick) picks up due `delayed_jobs` rows and dispatches them to the reconciliation HTTP endpoint, marking `processed_at` on success. This replaces the prior Upstash QStash delay-queue dependency end-to-end
- Reconciliation logic that handles the cross-provider precedence rule: most recent active event wins; if Stripe shows active and Apple shows active, the more recently updated wins
- Sentry alerts for any unresolvable discrepancy

**Implementation notes:** Cross-provider reconciliation is subtle because a user may have an active Stripe subscription from a previous web sign-up and an active Apple subscription from a later iOS sign-up. The application has a one-row-per-user constraint on `subscriptions`, but the source-of-truth events show both. The precedence rule resolves this: the most recent active event determines the canonical subscription. The 5-minute delayed inline trigger (now via `delayed_jobs` rather than QStash) ensures a paying user does not sit in a wrong-state read_only for up to 23 hours waiting for the nightly cron. Upstash Redis remains in the architecture for rate limiting (chat 009), the heartbeat-extended idempotency lock (chat 025), and the per-user circuit breaker (chat 022); only the QStash delay-queue dependency is removed in favor of the in-database `delayed_jobs` table. The worker logs each reconciliation outcome to `completion_log`; manual review surfaces happen via Sentry alerts on the unresolvable cases (e.g., both providers show conflicting cancellation dates within the same hour). **Risk note:** this chat (EO 92) is ⚠️ in the prior plan and the Risk Map because a wrong reconciliation can revoke a paying user's access or grant a cancelled user continued access [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. **Critical Path (canonical) restatement:** this chat declares hard dependencies on the higher-numbered chats **084, 087, and 088** — the **074 → 084/087/088** back-reference in the Part 1 How-to-Use list, which touches Block 9 (074) and Block 11 (084/087/088). It consumes the `subscription_events` table those chats populate, so it must ship after all three (which by EO already precede it: 084 EO 75, 087 EO 78, 088 EO 79, 074 EO 92). The ordering is governed by the **Critical Path section (Part 10), which is canonical** for it [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 084, 087, 088 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 92, after 084 (EO 75), 087 (EO 78), and 088 (EO 79). Restates the higher-numbered back-reference 074 → 084/087/088, governed by the Critical Path section (canonical).

**End-of-session checks:** A test scenario with conflicting Stripe and Apple states produces the correct canonical state. The worker correctly logs ambiguous cases to Sentry.

### Chat 075 — Bill Reminder Worker and APNs Token Cleanup Worker

*Block 9 · EO 81 · 🟣 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PRD §6.7 (bill reminder copy, authored in chat 061); chat 061 (bills CRUD and the bill-due-tomorrow butler-line library entry); chat 080 (live-activity-pusher generates 410 responses).

**Goal:** Build two modules. The bill reminder module runs daily at 9am in each user's local time and queues a butler-voice in-app notification one day before each upcoming bill due date. The APNs token cleanup module handles the case where the live-activity-pusher worker receives a 410 Gone response from Apple's APNs servers, indicating that the device's push token is invalid and should be removed from the database.

**Output:**
- `workers/daily-cron/modules/bill-reminder.ts` — the bill reminder module dispatched from the consolidated daily-cron worker; the daily-cron dispatches at hour-of-UTC ticks (matching chat 072's pattern), and on each tick the module queries users whose local time is within the 9am hour using the `start_of_local_day` Postgres function and a timezone offset filter, then for each matching user identifies bills due within 24 hours and queues a butler-voice in-app reminder; no longer a standalone `workers/bill-reminder/` directory and no per-user cron registration (per Chat 001 Decision 20)
- `workers/daily-cron/modules/apns-token-cleanup.ts` — the APNs cleanup module dispatched from daily-cron; reads recent 410 Gone responses logged by the live-activity-pusher worker and nulls the matching `push_tokens` rows
- The `workers/daily-cron/wrangler.toml` cron registration covers both modules
- The bill reminder copy is voice-gated and uses the butler line library entry "Your [bill name] is due tomorrow." (authored in chat 061; consumed verbatim here)

**Implementation notes:** The bill reminder is an in-app notification surface, not a push notification, because the privacy posture forbids push notifications for financial reminders. The notification is delivered as an ambient line on the next app open; the prior Dynamic Island prompt for bill reminders is removed (in-app ambient line only — financial reminders never surface on the Dynamic Island per the privacy posture). The APNs cleanup logic processes 410 responses from the APNs servers (the response indicates that the device's token is no longer registered with Apple) and nulls the corresponding `push_tokens` row. Without this cleanup, the live-activity-pusher worker continues attempting to deliver to dead tokens, wasting Cloudflare Worker invocations and adding noise to Sentry logs. Each module run (bill-reminder and apns-token-cleanup) logs to `completion_log` with the module name, items processed, and success/failure counts; Sentry breadcrumbs cover any APNs API call failure (apns-token-cleanup side) or any in-app notification dispatch failure (bill-reminder side). The chat 097a alerting layer fires if either module fails to execute its scheduled tick within a 90-minute window. **Skill / 🎩 note (copy-authoring test):** the prior-plan meta line carried 🎩 on this chat [doc:PHASE_4_BUILD_PLAN.md], but applying the copy-authoring test, this chat **adds no new user-facing copy** — the bill-due-tomorrow butler line is authored in chat **061** (which Part 6 explicitly names as the author of that library entry [doc:PHASE_4_BUILD_PLAN_part6.md]) and is consumed here verbatim. The copy came through the voice gate in chat 061, so this chat shows `Skills: —` and carries no 🎩. **Divergence flagged, not reconciled:** the prior-plan 🎩 on 075 is reassigned to 061 by the copy-authoring test; the divergence is recorded here rather than silently patched [doc:PHASE_4_BUILD_PLAN_part1.md]. This chat (EO 81) is not ⚠️ in the prior plan.

**Dependencies:** Chats 061, 080 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). **Cross-block dependency note (carried, not a Critical-Path back-reference):** the APNs-cleanup module consumes the 410 Gone responses generated by the higher-numbered chat 080 (live-activity-pusher, Block 10); this 075 → 080 reference is **not** in the canonical Critical-Path back-reference list and is carried here as an ordinary cross-block dependency, not pointed to the Critical Path section. Runs at EO 81.

**End-of-session checks:** The bill reminder worker correctly identifies upcoming bills and queues the butler line. The APNs cleanup correctly nulls a test invalid token.

---

## Block 10 — Live Activity and Push Notifications

Block 10 implements the iOS Dynamic Island Live Activity feature plus the underlying push notification infrastructure. The SwiftUI widget extension is genuine native iOS work that requires manual Xcode setup beyond what Expo provides, which is why chats 077 and 078 are **build-track native** (build-track on Swift, not the design track) per Stage 2 §1 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. The live-activity-pusher worker drives the Live Activity transitions on a five-minute cron schedule plus an immediate-trigger path for user actions. Full end-to-end verification requires a physical iPhone 14 Pro or newer and the Apple Developer Program enrollment from Cutover. Block organization is preserved for readability; the actual run order is the EO column of the Part 1 master table — the Block 10 chats are interleaved across **EO 14 through EO 82** on the build track [doc:PHASE_4_BUILD_PLAN_part1.md].

### Chat 076 — Push Token Infrastructure

*Block 10 · EO 39 · 🟢 🔵 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §7 (Live Activity push tokens); TECHNICAL_SPEC.md §9 (push-tokens API endpoints); chat 030 (the push-tokens API scaffold); chat 013 (mobile shell).

**Goal:** Wire the push token registration flow on app launch. The mobile app, when it boots, requests both the regular APNs token (for standard push notifications) and the Live Activity push-to-start token (for Dynamic Island lifecycle pushes) via expo-notifications, then reports both to the server via POST /push-tokens. Tokens persist across app launches per device_id.

**Output:**
- `apps/mobile/lib/pushTokens.ts` — the token registration logic that fires on app launch from the root layout
- The push tokens are reported to POST /push-tokens with the platform set to 'ios' and both token strings included
- The DELETE /push-tokens/:deviceId is called on sign-out
- `docs/RUNBOOKS/APNS_KEY_ROTATION.md` — the operational runbook covering APNs .p8 key rotation: (a) Apple-side procedure to generate a replacement .p8, capture the new Key ID, and confirm Team ID is unchanged; (b) Cloudflare-side procedure to roll the `APNS_PRIVATE_KEY` and `APNS_KEY_ID` secrets across every worker that signs APNs JWTs (live-activity-pusher per chat 080, apns-token-cleanup per chat 075); (c) zero-downtime sequencing: Apple permits up to two active APNs keys per team simultaneously, so the runbook adds the new key alongside the old, verifies push delivery on a test device with the new key, then retires the old key; (d) post-rotation verification: confirm pushes are still landing on a sample of production devices via the live-activity-pusher logs; (e) emergency-rotation variant for compromised-key response with abbreviated grace-window guidance

**Implementation notes:** Both APNs token types are needed: the regular token is for standard push notifications (medication reminders, fallback Live Activity transitions), and the live_activity_token is for the push-to-start mechanism that wakes up the Live Activity for the next block. The two tokens are different strings; both are obtained via expo-notifications APIs. The device_id is a stable device identifier generated once on first launch and persisted in expo-secure-store. Real APNs token retrieval requires the production APNs keys from Cutover step C-08; in development, expo-notifications returns development tokens that work against the development APNs servers. Each token registration emits PostHog event `push_token_registered` with payload `{platform, has_live_activity_token, device_id_hash}` (device_id is hashed before sending to avoid sending the raw stable device identifier to PostHog), and any registration failure is captured to Sentry with the expo-notifications error code and the platform. Add the event to chat 096's PostHog taxonomy. The 🟢 🔵 colors reflect the mobile registration logic and the web-side push-tokens API surface, per the Part 1 legend [doc:PHASE_4_BUILD_PLAN_part1.md]. This chat (EO 39) is not ⚠️ in the prior plan.

**Dependencies:** Chats 030, 013 (Stage 2 gating prereq is 030, with built foundation 013 assumed [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 39; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** A fresh mobile app install registers tokens correctly. The `push_tokens` table contains the expected row. Sign-out deletes the row. The audit trigger writes to `security_audit_log` on every `push_tokens` row INSERT and DELETE (verified by the chat 006 audit-schema.ts script and by inspecting `security_audit_log` after a test install-then-signout cycle on a development device).

### Chat 077 — SwiftUI Live Activity Widget Extension Setup

*Block 10 · EO 14 · 🟢 · Skills: — · ⚠️ 🚧 · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §7 (SwiftUI Widget Extension); LAYER_4_EXPERIENCE_IDENTITY.md (Dynamic Island design specifications, design tokens); the 107 native visual spec (the design track supplies the visual spec; the build track implements it in SwiftUI); Apple's WidgetKit and ActivityKit documentation.

**Goal:** Set up the SwiftUI Widget Extension target in the iOS project so that subsequent chats can implement the widget's UI and behavior. This requires running `expo prebuild` to generate the iOS project, then manually adding a Widget Extension target in Xcode (Expo does not have first-class config-plugin support for Live Activity widget extensions). Configure the target's bundle identifier, deployment target, shared keychain access group, and app group identifier so that the widget can read shared state from the main app.

**Output:**
- `apps/mobile/ios/VesperLiveActivity/` — the directory containing the SwiftUI widget extension target after manual Xcode setup
- The bundle identifier `com.vesper.app.liveactivity` configured
- Deployment target iOS 17.2 set (raised from 16.1 per H-10 decision; matches the main app target so the Widget Extension and main app share the same iOS floor)
- Shared keychain access group `$(AppIdentifierPrefix)com.vesper.app` configured on both the main app and the widget extension
- App group identifier `group.com.vesper.app` configured similarly
- ActivityAttributes and ContentState Swift type declarations in `VesperLiveActivity/ActivityModels.swift`, generated from a single shared JSON Schema source-of-truth at `packages/shared/src/liveActivity/schema.json`; the same schema generates the TypeScript types consumed by chat 079's JS bridge via a small codegen step (`pnpm gen:live-activity-types`) so the Swift and TypeScript representations cannot drift apart
- Apple App Group identifier `group.com.vesper.app` registered as a sub-step of Apple Developer Portal step C-05; the identifier appears in both the main app's entitlements and the widget extension's entitlements so they can share UserDefaults and Keychain items
- `apps/mobile/app.config.js` updated with the iOS infoPlist entries `NSSupportsLiveActivities: true` and `NSSupportsLiveActivitiesFrequentUpdates: true`; these keys are required at runtime for Live Activities to function and for high-frequency push updates respectively, and without them the widget extension builds successfully but Live Activities silently fail to start on real devices
- `docs/RUNBOOKS/IOS_WIDGET_REBUILD.md` — runbook explaining the manual Xcode steps so that they can be re-applied if `expo prebuild --clean` is ever run (which regenerates the iOS project and would lose the target)

**Implementation notes:** This chat has a strong manual component; the founder runs Xcode and adds the target manually, with the chat directing each step. The runbook is essential because Expo prebuild regenerates the iOS project from scratch when run with --clean, which would wipe the manually-added target. Future prebuilds without --clean preserve the manual additions, but the runbook covers the recovery path. ActivityAttributes are the static metadata for a Live Activity (the block ID, the block type); ContentState is the mutable state (current time progress, completion status) that can be updated via push without restarting the Live Activity. The shared keychain access group and app group identifier allow the widget extension to read the user's auth token and current plan state without requiring its own auth mechanism. **Ownership note:** at EO 14 this is **build-track native** work — the build track owns the SwiftUI / WidgetKit / ActivityKit native target setup, with the design track supplying only the visual spec via 107, per Stage 2 §1 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. This chat is ⚠️ 🚧 in the prior plan: ⚠️ because manual Xcode work outside Expo's automation is error-prone (configuration errors yield build or runtime failures that are hard to diagnose), and 🚧 because the target depends on the Apple Developer Portal app-group registration (Cutover C-05). Elevated-risk handling per the ⚠️ flag [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. The `frontend-design` skill is reserved for the pure design-system chats (107/107a/108a); this chat *consumes* the 107 native visual spec but does not invoke frontend-design, so `Skills: —` [doc:PHASE_4_BUILD_PLAN_part1.md]. EO 14 is early because the chat depends only on the built mobile shell (chat 013) plus the Apple Developer Portal registration.

**Dependencies:** Chat 013 (Stage 2 lists no gating unbuilt prereq; native call per §1; Cutover C-05 app-group registration [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 14; no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** The widget extension target builds successfully in Xcode. A test Live Activity can be initiated from the main app's debug menu. The runbook is complete and committed.

### Chat 078 — SwiftUI Live Activity Widget UI

*Block 10 · EO 33 · 🟢 · Skills: — · ⚠️ 🚧 · Window N · CD-flags: —*

**Load at session start:** Chat 077 (widget extension target exists); LAYER_4_EXPERIENCE_IDENTITY.md (full Dynamic Island design with all three states); the 107 native visual spec / DesignTokens values (the design track supplies the spec; the build track implements in SwiftUI); Apple's ActivityKit and Dynamic Island design guidelines.

**Goal:** Implement the SwiftUI views for the Live Activity widget covering all three required states: compact leading (the icon plus a two-character abbreviation of the current block type), compact trailing (a countdown timer in JetBrains Mono bronze), and expanded (the full block title, end time, and two action buttons for Mark Complete and Reschedule, plus a strip showing the next block). All three views use the Layer 4 design tokens (espresso, cream, bronze) translated into Swift constants.

**Output:**
- `VesperLiveActivity/LiveActivityView.swift` — the main widget view file containing all three view variants
- `VesperLiveActivity/DesignTokens.swift` — the design tokens translated to Swift constants (Color.espresso, Color.cream, Color.bronze; Font.jetBrainsMono for monospace), generated from the 107 native token spec
- `VesperLiveActivity/ActionIntents.swift` — the App Intents that handle the Mark Complete and Reschedule button taps from the expanded view

**Implementation notes:** Live Activity widgets must be implemented in SwiftUI; React Native cannot render in the Dynamic Island. The design tokens from Layer 4 (specifically the cream/espresso/bronze palette) translate to SwiftUI Color values with hex initializers; the canonical values come from the 107 native token spec via `DesignTokens.swift` so the native surface cannot drift from the web/RN design system. The action buttons in the expanded view are implemented as App Intents (Apple's interactivity framework introduced in iOS 17); each intent, when triggered, performs the action via the app's shared state (mark complete writes to a queue read by the main app on next launch, or makes a direct API call if network is available). The simulator can preview Live Activities through Xcode's debug menu; full physical-device testing happens in chat 105. **Ownership note:** at EO 33 this is **build-track native** work — the build track owns the three SwiftUI view variants and `DesignTokens.swift`, with the design track supplying only the 107 native visual spec, per Stage 2 §1 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. This chat is ⚠️ 🚧 in the prior plan: ⚠️ because SwiftUI itself is a learning curve for developers used to React Native and each of the three view variants must render correctly while respecting the design tokens, and 🚧 because it depends on the Cutover-gated widget-extension setup in chat 077. Elevated-risk handling per the ⚠️ flag [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. The `frontend-design` skill is reserved for 107/107a/108a; this chat consumes the 107 native spec but does not invoke frontend-design, so `Skills: —` [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chat 077 (Stage 2 gating prereq; native per §1 [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 33, after 077 (EO 14); no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** All three view variants render correctly in Xcode previews. The design tokens match Layer 4 specifications (via the 107 native token spec). The action intents are wired and trigger correctly when tapped in preview mode.

### Chat 079 — expo-live-activities JS Bridge

*Block 10 · EO 80 · 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** Chat 078 (widget UI exists); TECHNICAL_SPEC.md §7 (Mobile-Side Live Activity API); the expo-live-activities library documentation.

**Goal:** Build the JavaScript bridge that allows the React Native code to start, end, and update Live Activities. The bridge wraps the native ActivityKit APIs with TypeScript functions. The Mark Complete action handler in the widget extension routes through the bridge to call PATCH /blocks with the block's ID. The Reschedule action handler opens the app to the plan view at the relevant block.

**Output:**
- `apps/mobile/lib/liveActivities.ts` — the TypeScript wrapper exposing `startActivity(block: Block)`, `endActivity(activityId: string)`, `updateActivity(activityId: string, state: Partial<ContentState>)`
- `apps/mobile/lib/liveActivityHandlers.ts` — the handlers that respond to Mark Complete and Reschedule callbacks from the widget extension
- The plan view integration so that block transitions trigger startActivity for the current block and endActivity for the prior block

**Implementation notes:** The bridge is a thin wrapper over expo-live-activities. The Mark Complete callback comes through as a JS event when the user taps the button in the expanded Dynamic Island; the handler reads the block ID from the activity's static attributes and calls PATCH /blocks to mark it complete. The Reschedule callback opens the app via a deep link (`vesper://plan?focus=blockId`) that the plan view interprets to scroll to and expand the relevant block. Limited simulator testing is possible via Xcode's Live Activity preview; full integration testing requires a physical device and happens in chat 105. The bridge emits PostHog events `live_activity_started`, `live_activity_ended`, and `live_activity_update_failed` on every lifecycle call with payload `{block_id, success, error_code?}`; Sentry captures any thrown error from the underlying expo-live-activities call with the block_id and the activity attribute set. Push-side logging (the APNs delivery path) is owned by chat 080; device-side logging (the bridge call path) is owned here so the two surfaces produce a complete activity-lifecycle trail. Add the three events to chat 096's PostHog taxonomy. This chat (EO 80) is the JS/TypeScript bridge layer (build-track, not native Swift) — plain build-track rather than build-track native even though it sits between the native widget (078, build-track native) and the pusher worker (080, build-track); it is not ⚠️ in the prior plan.

**Dependencies:** Chats 078, 027 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 80, after 078 (EO 33); no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** The bridge functions call through to the native side correctly. Mark Complete callback successfully writes to the API in a simulator integration test. Deep link from Reschedule opens the plan view correctly.

### Chat 080 — Live Activity Pusher Worker with Immediate-Trigger Path

*Block 10 · EO 82 · 🟣 · Skills: — · ⚠️ 🚧 · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §7 (live-activity-pusher worker); TECHNICAL_SPEC.md §10 (Cloudflare Workers); the APNs push API documentation; chat 076 (push tokens infrastructure); chats 077–079 (widget and bridge).

**Goal:** Build the Cloudflare Worker that drives Live Activity transitions via APNs push. The worker runs every five minutes (not every minute) and handles only the start-the-next-Live-Activity case where the next block starts within thirty minutes; routine in-progress-to-end transitions are handled device-side via ActivityKit's `staleDate` parameter so the Dynamic Island updates locally at the exact block boundary without requiring a push. The worker exposes an immediate-trigger HTTP endpoint that the PATCH /blocks API and the batch reorder endpoint call when a user marks a block complete or reorders the day, so that the Dynamic Island updates within seconds rather than waiting for the cron cycle.

**Output:**
- `workers/live-activity-pusher/index.ts` — the worker with both the cron-scheduled path and the HTTP-triggered path
- `wrangler.toml` entry with cron `*/5 * * * *` (every five minutes)
- APNs JWT signing using the `jose` library with the .p8 key from Cutover step C-07; the signed JWT is cached at module scope for 50 minutes so each warm worker invocation reuses the JWT rather than re-signing per push
- The chain-to-next-block logic: when a block ends, if the next block starts within 30 minutes, start its Live Activity immediately; otherwise, no Live Activity until closer to the next block's start time
- Payload size enforcement: block titles are truncated to 80 characters before APNs payload assembly to stay under the 4KB Live Activity payload limit. Budget breakdown: APNs Live Activity payloads cap at 4KB; the fixed-overhead fields (icon reference, countdown timer state, next-block strip, push payload metadata, and base64 expansion overhead) consume ~400 bytes; the title is the only variable-length field, and 80 ASCII characters leaves ~3.6KB of headroom for the remaining fields and worst-case UTF-8 expansion. Truncations are logged to Sentry with the original length so prompt iterations can constrain title length over time
- Shared-secret storage for the immediate-trigger HTTP endpoint: the endpoint authenticates inbound calls via a `LIVE_ACTIVITY_TRIGGER_SECRET` Cloudflare Worker secret set via `wrangler secret put LIVE_ACTIVITY_TRIGGER_SECRET`; this secret is referenced by the Vesper API (chats 027 and 029 call the endpoint after PATCH /blocks and POST /plans/:date/reorder) and the production value is provisioned during the Cutover Block adjacent to C-08
- Fallback path for non-Dynamic-Island devices: when `live_activity_token` is null on the `push_tokens` row, the worker sends a standard APNs push notification with the block info as a banner notification instead
- Sentry breadcrumbs for each push attempt; 410 Gone responses route to the APNs cleanup worker from chat 075

**Implementation notes:** The earlier design fired the cron every minute and handled all transitions via push; this proved both excessive (1440 cron invocations per day per user across all workers) and laggy (the cosmetic transition between two adjacent blocks could be off by up to 60 seconds depending on when the cron fired relative to the block boundary). The new design uses ActivityKit's `staleDate` parameter, set at activity-start time to the block's end time, so the device handles the cosmetic transition locally with no network involvement. Push is reserved for state-change events: user actions (mark complete, reschedule), AI plan regeneration, and the start-the-next-Live-Activity hand-off. APNs JWT signing is non-trivial because the JWT must be signed with the .p8 EC private key from Apple, with the correct algorithm (ES256), the correct claims (iss = team ID, iat = current timestamp), and the JWT must be regenerated approximately every hour (Apple rotates token validity). The `jose` library handles the signing; the .p8 key content is stored as a Cloudflare Worker secret (set via `wrangler secret put APNS_PRIVATE_KEY`). The module-scope JWT cache uses the standard Cloudflare Workers warm-isolate pattern: the JWT is stored in a module-level variable with the sign timestamp; on each push, the worker re-uses the cached JWT if it is less than 50 minutes old and re-signs otherwise. The immediate-trigger HTTP endpoint accepts a block ID and the action (start, update, end), authenticates the caller as the internal Vesper API (via a shared secret), and sends the push synchronously. The chain-to-next-block logic is critical to UX; without it, the user sees the Dynamic Island go blank after a block ends, then re-appear when the next block starts, which feels jarring. With chaining and `staleDate`, the transition is smooth: the device locally ends the activity at the block boundary, and a queued push from the worker starts the next block's activity if it begins within thirty minutes. **Risk note:** this chat (EO 82) is ⚠️ 🚧 in the prior plan: ⚠️ because APNs JWT signing, payload-size budgeting, and the staleDate/push hand-off are each silently-breakable, and 🚧 because the production APNs key and immediate-trigger secret are provisioned in the Cutover Block [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. This worker is the upstream of the cross-block dependencies declared in chats 073 (end-active-LA-before-cascade) and 075 (410-cleanup); both reference this chat's immediate-trigger endpoint and 410-logging, carried in those chats as ordinary cross-block dependencies.

**Dependencies:** Chats 076, 079, 027, 075 (Stage 2 gating prereqs [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]). Runs at EO 82, after 076 (EO 39) and 079 (EO 80); no later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** The worker correctly identifies upcoming block transitions and constructs valid APNs payloads. The immediate-trigger endpoint authenticates correctly. The fallback for non-DI devices sends a standard push. The cron path runs within CPU time limits.

---

<!-- PHASE_4_BUILD_PLAN.md — Part 8 of 10. Body continues here; conventions, legend, per-chat template, and master reordered-sequence table live in Part 1. Concatenate Parts 1→10 (a/b sub-parts in letter order) head-to-tail. -->

---

## Authoring Note for Part 8 (Block 11)

Like Parts 4–7, this part contains no built-foundation chats. Stage 1 asserts 001–020 built and 021+ unbuilt [doc:PHASE_4_REPLAN_STAGE_1_ANALYSIS.md], so every chat in Block 11 is not-yet-built work that appears in the Part 1 master reordered-sequence table and therefore carries a **real EO and a real Model** taken verbatim from that table [doc:PHASE_4_BUILD_PLAN_part1.md]. No EO is recorded as `—`. Every meta line below was re-derived directly from the Part 1 master table from scratch rather than carried from any prior draft or from memory.

**One split pair, no folds, one window chat in this part.** Per the Part 1 file-split plan and master table, Block 11 (081–090b) contains exactly one `-V`/`-W` split — chat **089** — and no folded chats [doc:PHASE_4_BUILD_PLAN_part1.md]. Both halves are documented here, inside the original chat's Block 11, because the split is a sequencing-and-ownership device, not a relocation. The design-track visual half **089-V** is the single Block 11 window chat: per the master table and Stage 2 §5 it carries `Window Y (Fwin F14)`; every other Block 11 chat reads `Window N` and carries no `Fwin F#` counter [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md][doc:PHASE_4_BUILD_PLAN_part1.md]. The wiring half **089-W** is `Window N` in normal build-track sequence. The thirteen rendered entries are 081, 082, 083, 084, 085, 086, 086a, 087, 088, 089-V, 089-W, 090, 090b — each at its own master-table EO and Model.

**Block membership and the excluded deferred chat.** The deferred V1.5 export chat **090a** is **excluded** from this part. Per the Part 1 file-split plan it appears only in the "Deferred to V1.5" section of Part 10; it is not in the master reordered-sequence table and has no EO [doc:PHASE_4_BUILD_PLAN_part1.md]. The Cloudflare R2 dependency it carried is removed from V1 entirely and no R2 bucket is provisioned at Cutover [doc:PHASE_4_BUILD_PLAN.md]. Block 11 membership otherwise follows the master table exactly: 090b (biometric lock) is in Block 11 at EO 40, not deferred.

**File-split-plan count agrees with the master table (no discrepancy to flag).** The Part 1 file-split plan lists Part 8 as "**13 entries**" with the parenthetical "Block 11 (081–090b, with 089 `-V`/`-W`; excludes deferred 090a)" [doc:PHASE_4_BUILD_PLAN_part1.md]. Counting the master-table-rendered body: twelve non-deferred Block 11 IDs (081, 082, 083, 084, 085, 086, 086a, 087, 088, 089, 090, 090b) with 089 rendered as a `-V`/`-W` pair yields **13 entries**, matching the file-split-plan figure. Unlike Part 6 (whose fold made the file-split-plan "19" disagree with the master-table-rendered "17"), Part 8's two counts coincide, so there is **no count discrepancy to flag** here. Thirteen full-detail entries in one block fit a single response, so no `8a`/`8b` split is needed.

**Skill / 🎩 propagation (copy-authoring test).** Following the Part 4–7 precedent, the 🎩 voice-gate flag and `Skills: caveman, stop-slop` sit on the chat (or split half) that actually authors user-facing butler copy. Two prior-plan Block 11 meta lines carry 🎩 — **089** and **090** [doc:PHASE_4_BUILD_PLAN.md]. Applying the copy-authoring test:

- **090** (non-split) authors *new* user-facing butler copy — the cancellation-reason surface, the deletion-confirmation message, and the 30-day grace banner — so it keeps **🎩** and `Skills: caveman, stop-slop`.
- **089** is split. The user-facing lifecycle copy (the trial-end screen line, the day-6 soft-prompt copy, the past-due and read-only banner copy, the archived welcome-back line, the billing-section copy) is composed at the **visual** stage, so the 🎩 flag and `Skills: caveman, stop-slop` go on the copy-authoring half **089-V** (the design-cluster window half), exactly as 044-V and 046-V carried the gate for their pairs [doc:PHASE_4_BUILD_PLAN_part5.md]. The wiring half **089-W** adds no new user-facing copy — it wires the same composed surfaces to the state machine and the Stripe/Apple flows — so it shows **`Skills: —`** and carries **no 🎩**, with the one-line rationale "adds no new copy — the lifecycle copy came through the gate in 089-V."

Chat **082** builds the read-only banner *component*, and its prior-plan meta line carried **no 🎩** [doc:PHASE_4_BUILD_PLAN.md]; the subscription-lifecycle banner copy is finalized through the voice gate in 089 (which carries 🎩 and, per the prior plan, "polishes the copy" of the read-only banner), so 082 follows its original and shows **`Skills: —`** with no 🎩. No Part 8 chat carries 🗄️ (the `drizzle-best-practices` skill) — Block 11 authors state-machine modules, API completions, and worker handlers, not Drizzle migrations; the subscription/event/cancellation tables it reads were migrated in Block 1's chat 005 [doc:PHASE_4_BUILD_PLAN.md]. No Part 8 chat carries 🤖 (no prompt-versioned AI-layer call in this block; a 🤖-only chat would in any case show `Skills: —` because 🤖 names no skill [doc:PHASE_4_BUILD_PLAN_part1.md]). The `frontend-design` skill is reserved for the pure design-system chats (107 / 107a / 108a) and is used by **no** Part 8 chat — 089-V *consumes* the 107/107a primitives and the LAYER_4 copy library but invokes `caveman, stop-slop` for its copy gate, not `frontend-design` [doc:PHASE_4_BUILD_PLAN_part1.md].

**Meta-line emoji ordering (per Part 2/4/5/6/7).** A 🎩-only build chat leads with the skill emoji then colors (090: `🎩 🔵 🟢`); a design-track visual/static half puts colors then 🎩 (089-V: `🔵 🟢 🎩`); every other chat is colors-only in package order. No 🤖 chat appears here, so the "colors then 🤖 then 🎩" ordering is not exercised in this part.

**CD-flags and the Fwin-vs-CD-flag caveat.** No Part 8 chat reads or consumes a CANNOT-DETERMINE flag — every meta line below reads `CD-flags: —` [doc:PHASE_4_BUILD_PLAN_part1.md]. The single window chat **089-V** carries `Fwin F14`; that token shares an `F#` shape with the carried-forward CD-flags F1–F4 but is unrelated and lives in a different field, so it is restated field-scoped on 089-V below in the 046-W / 060 precedent form. Because no Block 11 chat carries a CD-flag, the caveat binds no other meta line in this part.

**Critical Path back-references in this part.** The Part 1 How-to-Use back-reference list includes one reference that governs Part 8 chats: **074 → 084/087/088** [doc:PHASE_4_BUILD_PLAN_part1.md]. The Block 9 reconciliation worker 074 (EO 92) hard-depends on the Stripe webhook handler 084 and the two Apple Server Notifications V2 chats 087 and 088 landing first; 074's module can be scaffolded in Block 9 but its logic completes only after these Block 11 chats land [doc:PHASE_4_BUILD_PLAN.md]. That back-reference is restated inline in 084, 087, and 088 below, with the **Critical Path section (Part 10) canonical** for the ordering. No other Critical-Path back-reference governs a Part 8 chat.

**Block-internal ordering.** The prior plan's Block 11 dependency chain is 081 first; 082, 083, 085 follow 081; 084 follows 083; 086 follows 085; 087 follows 086; 088 follows 087; 089 follows 084 and 086; 090 follows 089 [doc:PHASE_4_BUILD_PLAN.md]. The master table re-sequences these into a dependency-valid EO order that interleaves Block 11 across **EO 38 through EO 86** on the build track (with 089-V pulled forward to EO 25 inside the design-cluster window), preserving every internal dependency; the chat-number order in which the entries appear below is for readability, and the EO column of the master table is canonical for sequencing [doc:PHASE_4_BUILD_PLAN_part1.md].

---

## Block 11 — Payments and Subscription Lifecycle

Block 11 is one of the highest-stakes blocks in Phase 4 because errors here translate directly into lost revenue or locked-out paying users. The subscription state machine module is built first as the canonical source of truth for state transitions. Read-only mode enforcement is treated as cross-cutting because it touches every mutation API and every UI surface. Stripe and Apple integrations land next, with the Apple Server Notifications V2 handler split across two chats because it must handle fifteen distinct notification types. The lifecycle UI ties everything together. Block organization is preserved for readability; the actual run order is the EO column of the Part 1 master table, not the chat-number order in which the entries appear below — the Block 11 chats are interleaved across **EO 38 through EO 86** on the build track, with the design-track visual half 089-V pulled forward to **EO 25** inside the ≤11-day design-cluster window [doc:PHASE_4_BUILD_PLAN_part1.md].

### Chat 081 — Subscription State Machine Module

*Block 11 · EO 38 · 🟡 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §8 (Subscription State Machine); LAYER_5_BUSINESS_MONETIZATION.md (all subscription lifecycle states and transitions); the subscriptions table schema.

**Goal:** Implement the subscription state machine as a typed TypeScript module in `@vesper/shared`. Every transition function validates that the source state allows the destination state, applies any required side effects (canceling Stripe subscription on deletion_scheduled, etc.), and writes the new state to the subscriptions table atomically. Unit tests cover every legitimate transition and verify that illegitimate transitions throw.

**Output:**
- `packages/shared/src/subscriptionState.ts` — exports the state machine with types `SubscriptionState = 'trial' | 'active' | 'past_due' | 'read_only' | 'archived' | 'deletion_scheduled' | 'deleted'` and transition functions like `transitionToActive(userId, paymentEvent)`, `transitionToPastDue(userId, failedInvoice)`, `transitionToReadOnly(userId, reason)`; `transitionToActive` is responsible for minting a unique 6-character referral code on the `users.referral_code` column if the user does not yet have one (this logic moves from chat 095 to this chat so it lives next to the state transition that triggers it; chat 095-W consumes the existing column rather than minting)
- Unit tests in `packages/shared/src/__tests__/subscriptionState.test.ts` covering every transition and every illegitimate transition, plus tests specifically for the referral-code mint path: first-time `transitionToActive` populates the column; subsequent transitions are idempotent and do not change the existing code
- `docs/SUBSCRIPTION_STATE_MACHINE.md` — a Mermaid state diagram showing all states and transitions plus the prose explanation of each transition's side effects

**Implementation notes:** State machine errors are among the highest-impact bugs because they translate to revenue loss (a paying user incorrectly transitioned to read_only) or fraud exposure (a non-paying user incorrectly transitioned to active). Every transition is implemented as a discrete function rather than a generic `transition(from, to)` so that the type system enforces correct usage. Each transition checks the current state in the database, validates the transition is allowed, applies side effects (e.g., transition to deletion_scheduled calls the Stripe cancellation API), and writes the new state. The transitions are atomic within Postgres transactions; each transition begins with `SELECT * FROM subscriptions WHERE user_id = $1 FOR UPDATE` inside the transaction, which row-locks the subscription against concurrent updates. This is essential because Stripe and Apple webhooks can fire concurrent transitions for the same user (a Stripe `customer.subscription.updated` and an Apple `DID_RENEW` arriving within milliseconds of each other); without the row lock, both transitions read the same pre-state and one overwrites the other. A transition that fails midway rolls back. **Risk note:** this chat (EO 38) is ⚠️ in the prior plan and the Risk Map because a transition bug is a direct revenue or fraud event [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. This chat is the canonical state-transition module that every other Block 11 chat (082, 084, 086, 087, 088, 089-W, 090) invokes; it is first in the block-internal dependency chain.

**Dependencies:** Chat 030 (subscription scaffold exists), chat 005 (subscriptions table exists). Both at lower EO; first in its Block 11 chain. No later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** Unit tests pass for every transition. The state diagram in the runbook is accurate. A test transition from trial to active correctly updates the database row. The audit trigger on the subscriptions table is verified — a test transition from trial to active produces a corresponding row in `security_audit_log` with the correct user_id, old_values, new_values, and operation type.

### Chat 082 — Read-Only Mode Enforcement (Cross-Cutting)

*Block 11 · EO 84 · 🔵 🟢 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** LAYER_5_BUSINESS_MONETIZATION.md (read-only mode definition); chat 081 (state machine); every mutation API route from Block 4; every UI mutation surface from Block 6.

**Goal:** Implement the cross-cutting enforcement of read-only mode. When a user's subscription_status is in {read_only, archived, deletion_scheduled}, all mutation API routes return 403 Forbidden with the READ_ONLY_MODE error code; all UI surfaces that allow mutation display a banner explaining the state and disable mutation affordances; settings, cancellation, restore, and resubscribe surfaces remain accessible.

**Output:**
- `packages/shared/src/api/readOnlyGate.ts` — a middleware that wraps mutation endpoints and rejects requests when the user's subscription_status is in the restricted set
- Every mutation route in Block 4 and beyond updated to use the readOnlyGate. The full enumeration of mutation routes the gate must cover: PATCH /blocks, POST /blocks, POST /plans/:date/reorder (batch reorder from chat 029), POST /ai/command, PUT /weekly-priorities, POST /tasks, PATCH /tasks/:id, DELETE /tasks/:id, PUT /profile, PATCH /profile/modules/:moduleId, POST /energy, POST /plans/generate, POST /medications, PATCH /medications/:id, DELETE /medications/:id, POST /bills, PATCH /bills/:id, DELETE /bills/:id, POST /recurring-errands, PATCH /recurring-errands/:id, DELETE /recurring-errands/:id, POST /integrations/google-calendar/connect, DELETE /integrations/:provider, POST /calendar-events, PATCH /calendar-events/:id, DELETE /calendar-events/:id, POST /hydration
- `apps/web/components/ReadOnlyBanner.tsx` and `apps/mobile/components/ReadOnlyBanner.tsx` — the persistent banner shown on the plan view, tasks view, and module views when in restricted state
- Plan view, tasks view, and module views updated to disable mutation buttons and surface the banner

**Implementation notes:** Read-only mode is the difference between a graceful payment failure UX and an abrupt one. A user whose payment fails should see a calm "your payment didn't go through, I'll keep things running" message rather than seeing the app suddenly stop working. The banner is voice-aligned copy that explains the state and offers a CTA to resolve it (resubscribe or update payment method via the portal); this chat builds the banner *component and its trigger logic*, while the banner's user-facing line is finalized through the caveman/stop-slop voice gate in chat 089 (which carries 🎩 and, per the prior plan, polishes the read-only banner copy), so 082 itself authors no new gated copy and shows `Skills: —` with no 🎩 [doc:PHASE_4_BUILD_PLAN.md]. The mutation gates return the same response shape regardless of the route, so the client UI can handle 403 READ_ONLY_MODE uniformly. Each gate reads `subscription_status` inside the mutation's database transaction with `SELECT subscription_status FROM subscriptions WHERE user_id = $1 FOR SHARE` so a concurrent webhook-driven transition cannot allow the mutation to commit between the read and the write; the `FOR SHARE` lock blocks any state-changing transition until the mutation transaction completes, which is the correct semantic given mutations are short-lived and webhook transitions are infrequent. **Risk note:** this chat (EO 84) is ⚠️ in the prior plan and the Risk Map because a gap in the gate enumeration silently exposes a mutation path to a non-paying user [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. 

**Dependencies:** Chat 081, all Block 4 chats. All at lower EO (081 at EO 38; the Block 4 mutation routes precede this in the topological walk). No later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** A user manually transitioned to read_only cannot make any mutation through any API. The banner displays correctly on all relevant UI surfaces. Settings and resubscribe remain accessible.

### Chat 083 — Stripe Checkout and Customer Portal Completion plus Cutover Runbook

*Block 11 · EO 58 · 🔵 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §8 (Stripe Checkout and Customer Portal); chat 030 (the route scaffolds); the Stripe SDK documentation; LAYER_5_BUSINESS_MONETIZATION.md (pricing tier configuration).

**Goal:** Complete the Stripe Checkout and Customer Portal integration. The Checkout session is created with the correct line items, success URL, cancel URL, customer email, and metadata (vesper_user_id) for webhook attribution. The Portal session is created with the correct customer ID and configuration options. Author the production-cutover runbook for swapping test keys to production keys.

**Output:**
- `apps/web/app/api/v1/subscription/checkout/route.ts` updated from chat 030 stub to full implementation
- `apps/web/app/api/v1/subscription/portal/route.ts` updated similarly
- `docs/RUNBOOKS/STRIPE_CUTOVER.md` — the runbook covering the test-to-production key swap procedure, the webhook endpoint reconfiguration, and the verification steps

**Implementation notes:** The Checkout session is the first paid touchpoint for web users. The configuration includes: `mode: 'subscription'`, `line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }]`, `success_url` and `cancel_url` pointing to vesper.day routes, `customer_email` from the authenticated user, `metadata: { vesper_user_id: user.id }`, and `automatic_tax: { enabled: true }` for US sales tax. The `automatic_tax: { enabled: true }` setting requires Stripe Tax onboarding to be complete in the Stripe dashboard before the first paid Checkout session — onboarding includes registration in each US state with tax nexus and acceptance of Stripe Tax terms. The STRIPE_CUTOVER.md runbook documents this as a prerequisite to the test-to-live key swap. The Portal session is simpler: just `customer: stripeCustomerId` plus a return URL. The Cutover runbook is critical because the test-to-production swap is a multi-step process that, if done out of order, results in production users hitting test infrastructure (or vice versa). This chat (EO 58) is not ⚠️ in the prior plan.

**Dependencies:** Chats 030, 081. Both at lower EO (081 at EO 38). No later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** A Checkout session creates correctly in test mode and the redirect URL works. The Portal session opens the Stripe-hosted page correctly. The runbook is complete.

### Chat 084 — Stripe Webhook Handler (Cloudflare Worker)

*Block 11 · EO 75 · 🟣 · Skills: — · ⚠️ · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §8 (Stripe webhook handler); chat 081 (state machine); the Stripe webhook event types documentation.

**Goal:** Implement the Stripe webhook handler as a Cloudflare Worker. The handler verifies the webhook signature using the raw request body (not parsed JSON) with the signature-verification `tolerance` parameter set to a year (effectively disabling timestamp replay-window enforcement) so that Stripe's days-long retry behavior on failed deliveries does not result in lost events. Idempotency is enforced solely via the (provider, event_id) unique constraint on subscription_events. Each event type is dispatched to the appropriate state machine transition, and the full event payload is written to subscription_events for audit.

**Output:**
- `workers/stripe-webhook/index.ts` — the worker
- `wrangler.toml` entry
- Event handlers for: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.trial_will_end`. The `trial_will_end` handler does not transition state; it writes the event to subscription_events and sets a `pending_trial_reminder` flag on the subscriptions row which the chat 072 trial-reminder module reads as a redundancy signal alongside its own date-based scheduling.
- Idempotency check via INSERT INTO subscription_events ... ON CONFLICT DO NOTHING; if conflict, return 200 immediately (already processed)
- Per-subscription monotonic ordering check: before any state transition, the handler reads `subscriptions.last_event_at`; if the inbound event's timestamp is older than `last_event_at - interval '24 hours'` (a 24-hour grace window to tolerate clock skew and Stripe's own retry semantics), the handler logs the event to subscription_events for the audit trail but skips the transition and returns 200. This prevents regression transitions when delayed deliveries arrive after a more-recent event has already advanced the canonical state.
- A 5-minute delayed reconciliation trigger for the affected user via an INSERT into the `delayed_jobs` table from chat 005 (`job_type='reconcile_subscription'`, `payload={ userId }`, `scheduled_for = now() + interval '5 minutes'`); this replaces the prior Upstash QStash delay queue

**Implementation notes:** Stripe webhook signature verification must use the raw request body because the signature is computed against the byte stream Stripe sent; any modification (including JSON parse and re-stringify) breaks the signature. The Cloudflare Worker pattern is `const raw = await request.text(); const event = stripe.webhooks.constructEvent(raw, signature, secret, tolerance)` with `tolerance: 31536000` (one year in seconds). The default tolerance of 300 seconds (5 minutes) would silently reject Stripe retries that arrive hours or days after the original event, causing lost state transitions; the long tolerance plus the unique-constraint idempotency plus the per-subscription monotonic ordering check is the correct combination because Stripe guarantees delivery within their multi-day retry window but does not guarantee in-order delivery. The event handler dispatches via a switch on event.type; each handler invokes the appropriate state machine transition from chat 081 inside its own database transaction with row-level locking on the subscriptions row. **Risk note:** this chat (EO 75) is ⚠️ in the prior plan and the Risk Map because signature handling and delivery-ordering bugs are silent revenue events [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. **Critical Path (canonical) restatement:** this chat is upstream of the Block 9 reconciliation worker **074** (EO 92), which hard-depends on 084 plus 087 and 088 landing first — the back-reference **074 → 084/087/088**. 074's reconciliation module may be scaffolded in Block 9 but its logic completes only after 084 (EO 75) lands; the ordering is governed by the **Critical Path section (Part 10), which is canonical** for it [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md].

**Dependencies:** Chats 081, 083. Both at lower EO (081 at EO 38, 083 at EO 58). Restates the later-numbered back-reference 074 (EO 92) → 084, governed by the Critical Path section (canonical); no later-EO dependency of 084's own.

**End-of-session checks:** A test webhook delivery via Stripe CLI is correctly processed. A deliberate signature mismatch returns 400. A replayed webhook returns 200 without re-processing. The subscription state transitions correctly for each event type.

### Chat 085 — Apple StoreKit 2 Integration (Mobile)

*Block 11 · EO 57 · 🟢 · Skills: — · 🚧 · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §8 (Apple StoreKit 2); Apple's StoreKit 2 documentation; chat 030 (subscription API scaffold).

**Goal:** Implement the StoreKit 2 in-app purchase flow on iOS. The app fetches the subscription product from the App Store, presents the purchase UI to the user, and on successful purchase, sends the signed JWS transaction to the `/subscription/apple-verify` API endpoint. Also wire the `showManageSubscriptions()` API for the settings surface so users can manage their Apple subscription from within the app.

**Output:**
- `apps/mobile/lib/storeKit.ts` — TypeScript wrapper around the StoreKit 2 APIs via the appropriate Expo or React Native bridge
- `apps/mobile/lib/storeKit.config.ts` — the product identifier `com.vesper.standard.monthly` configured
- `apps/mobile/screens/SubscriptionUpgrade.tsx` — the upgrade UI invoked when a trial-end user wants to subscribe via Apple
- `apps/mobile/lib/storeKit.testConfig.ts` — a StoreKit Configuration File reference for local Xcode testing without real App Store products

**Implementation notes:** StoreKit 2 is the modern Apple in-app purchase framework (versus the legacy StoreKit 1 with receipt validation against verifyReceipt). Purchases return a `signedTransaction.jws` string that contains the full transaction data signed by Apple; this is the payload sent to the apple-verify endpoint. The StoreKit Configuration File is a JSON file that lets Xcode simulate purchases against fake products during development, removing the need for a real App Store Connect product configuration during early development. Real product configuration happens at Cutover step C-11, which is why this chat is **🚧 (cannot run to completion until the Cutover Block completes)** for its real-product path; the StoreKit Configuration File path is exercisable beforehand. This chat (EO 57) is not ⚠️ in the prior plan. Although the surface is native-adjacent (iOS in-app purchase), it is a TypeScript bridge wrapper in `@vesper/mobile`, not a SwiftUI/WidgetKit/ActivityKit target, so it is build-track (not build-track native) and there is no Stage-2 §1 native-ownership conflict to flag [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md][doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 030, 013. Both at lower EO. No later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Carries 🚧 — its real-product path cannot complete until the Cutover Block provisions the App Store Connect product (C-11).

**End-of-session checks:** A test purchase via the StoreKit Configuration File succeeds in the simulator. The signed JWS transaction is captured and sent to the verify endpoint. The showManageSubscriptions surface opens correctly.

### Chat 086 — Apple Receipt Verification API

*Block 11 · EO 76 · 🔵 · Skills: — · ⚠️ 🚧 · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §8 (Apple receipt verification, JWS public key handling); Apple's App Store Server API documentation; chat 081 (state machine); chat 030 (apple-verify stub).

**Goal:** Implement the `/subscription/apple-verify` endpoint that takes a signed JWS transaction from StoreKit, verifies the signature against Apple's public keys (fetched from Apple's JWKS endpoint with a 1-hour cache), and on successful verification, transitions the user's subscription state to active and writes the transaction to subscription_events.

**Output:**
- `apps/web/app/api/v1/subscription/apple-verify/route.ts` updated from chat 030 stub to full implementation
- `apps/web/lib/apple/jws.ts` — the JWS verification logic that extracts the certificate chain from the JWS `x5c` header and validates against pinned Apple Root CA G3
- `apps/web/lib/apple/keyCache.ts` — the 1-hour cache for Apple's intermediate certificates
- `docs/RUNBOOKS/APPLE_ROOT_CA_ROTATION.md` — authored in this chat; documents how to discover Apple's next published root, add it to the pinned set alongside the current root, verify a sample of production transactions against the new root in shadow, and finally retire the old root once Apple deprecates it

**Implementation notes:** Apple's JWS verification is non-trivial. The signed transaction is a JWS string with three dot-separated parts: header (which contains the `x5c` certificate chain), payload, and signature. The verifier extracts the certificate chain from the JWS `x5c` header, validates that the root certificate matches one of the pinned Apple Root CA certificates (currently Apple Root CA G3), and verifies the signature with the leaf certificate's public key. To eliminate ambiguity: Apple StoreKit 2 JWS transactions use this `x5c`-header-driven certificate-chain verification rooted in the pinned Apple Root CA G3 — they do NOT use a JWKS endpoint. The endpoint `https://appleid.apple.com/auth/keys` is the JWKS endpoint for Sign In with Apple identity tokens (a separate flow used by the Apple OAuth sign-in path in chats 010/011), not by this StoreKit verifier. Conflating the two paths produces verification failures that look like Apple key problems but are actually wrong-endpoint problems; this chat documents the distinction inline. The pinning approach is forward-rotation-aware: the implementation pins both the current Apple Root CA G3 and the announced next root, with the runbook authored here documenting how to discover and add a new pinned root when Apple publishes one. The chat 086a worker auto-monitors expiry dates and Sentry-alerts at the 6-months-before-expiry mark. The implementation uses the `jose` library for the JWS verification primitives. The 1-hour cache on Apple's intermediate certificates is critical because Apple rotates intermediates; without caching, every transaction verification makes a network call to Apple, which adds latency. With caching, repeated verifications use the cached certs until the cache expires. **Risk note:** this chat (EO 76) is ⚠️ in the prior plan and the Risk Map because a wrong-root or wrong-endpoint mistake silently fails all Apple verifications [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. Carries 🚧 — production verification cannot be exercised end-to-end until the Cutover Block configures Apple's production environment.

**Dependencies:** Chats 085, 081. Both at lower EO (081 at EO 38, 085 at EO 57). No later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Carries 🚧.

**End-of-session checks:** A test JWS transaction (using a development-signed transaction from StoreKit Configuration File) verifies correctly. A deliberately tampered JWS rejects with the expected error. The cache TTL works as expected.

### Chat 086a — Apple PKI Monitor Worker

*Block 11 · EO 77 · 🟣 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** Chat 086 (JWS verification with pinned root certificates); Apple's PKI bundle documentation.

**Goal:** Build a Cloudflare Worker that runs weekly and verifies the pinned Apple Root CA certificates from chat 086 are still within their valid date range with sufficient runway. The worker fetches Apple's published PKI bundle, compares against the pinned roots in the application, and Sentry-alerts when any pinned root is within six months of expiry. This is the operational early-warning system that prevents the silent-breakage failure mode where all Apple receipt verifications start failing simultaneously when a root cert expires unnoticed.

**Output:**
- `workers/apple-pki-monitor/index.ts` — the worker
- `wrangler.toml` entry with cron `0 12 * * 1` (every Monday at noon UTC)
- The worker fetches Apple's published PKI bundle URL, parses the certificate chain, compares the leaf and intermediate expiry dates against the pinned constants in chat 086's verifier
- Sentry alert (high severity) when any pinned root's expiry is within 180 days
- `docs/RUNBOOKS/APPLE_PKI_MONITOR.md` — alert-handler runbook describing what to do when the apple-pki-monitor Sentry alert fires

**Implementation notes:** Apple publishes upcoming root certificate rotations well in advance via the Apple Developer documentation; the worker's purpose is to surface that information into the team's normal monitoring channel rather than relying on a calendar reminder set months ago. Six months of runway is enough to update the pinned roots in a routine deploy. This worker stays a standalone Cloudflare Worker rather than folding into `daily-cron` because its weekly Monday-noon schedule does not compose cleanly with daily-cron's hourly hour-of-UTC dispatch model — a deployment constraint carried forward from the Chat 001 Decision 20 worker-consolidation note [doc:PHASE_4_BUILD_PLAN.md]. This chat (EO 77) is not ⚠️ in the prior plan.

**Dependencies:** Chat 086. At lower EO (086 at EO 76). No later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** The worker runs locally and successfully fetches Apple's PKI bundle. A simulated near-expiry condition correctly fires the Sentry alert.

### Chat 087 — Apple Server Notifications V2 Worker, Part 1

*Block 11 · EO 78 · 🟣 · Skills: — · ⚠️ 🚧 · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §8 (Apple Server Notifications V2); Apple's ASSN V2 documentation; chat 086 (JWS verification logic to share); chat 081 (state machine).

**Goal:** Implement the first half of the Apple Server Notifications V2 webhook handler. ASSN V2 is the push-based notification system Apple uses to inform the server of subscription lifecycle events (renewals, cancellations, refunds, etc.). The handler verifies the signed payload using the same JWS infrastructure as chat 086, then dispatches the five most common notification types to the appropriate state machine transitions.

**Output:**
- `workers/apple-assn/index.ts` — the worker
- `wrangler.toml` entry
- Handlers for: SUBSCRIBED, DID_RENEW, EXPIRED, REVOKE, REFUND
- Each handler verifies the payload, writes to subscription_events with idempotency, and invokes the state machine transition

**Implementation notes:** ASSN V2 payloads are signed JWS with the same verification mechanism as StoreKit transactions, so the JWS infrastructure from chat 086 is reused, including the same pinned root certificate approach. Signature verification uses an effectively unbounded timestamp tolerance because Apple, like Stripe, retries failed webhook deliveries over multiple days; the idempotency guard on subscription_events' (provider, event_id) unique constraint is the sole replay protection. The notification type is in the JWS payload's `notificationType` field. SUBSCRIBED indicates a new subscription (transition to active or activate from trial). DID_RENEW indicates a successful renewal (no state change typically, but extend the period_end). EXPIRED indicates a subscription has expired without renewal (transition to read_only). REVOKE indicates Apple has refunded and revoked access (transition to archived). REFUND is similar but for cases where the user keeps access for a period (record the event but no immediate state change). Each handler triggers the chat 074 reconciliation worker via an INSERT into the `delayed_jobs` table from chat 005 (`job_type='reconcile_subscription'`, `payload={ userId }`, `scheduled_for = now() + interval '5 minutes'`); this replaces the prior Upstash QStash delayed-trigger dependency. **Risk note:** this chat (EO 78) is ⚠️ in the prior plan and the Risk Map because misclassifying a notification type drives a wrong state transition [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. Carries 🚧 — production ASSN delivery cannot be verified end-to-end until the Cutover Block configures the App Store Connect webhook URL. **Critical Path (canonical) restatement:** this chat is upstream of the Block 9 reconciliation worker **074** (EO 92), which hard-depends on 084 plus 087 and 088 landing first — the back-reference **074 → 084/087/088**. 074's logic completes only after 087 (EO 78) lands; the ordering is governed by the **Critical Path section (Part 10), which is canonical** for it [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md].

**Dependencies:** Chats 086, 081. Both at lower EO (081 at EO 38, 086 at EO 76). Restates the later-numbered back-reference 074 (EO 92) → 087, governed by the Critical Path section (canonical); no later-EO dependency of 087's own. Carries 🚧.

**End-of-session checks:** Test notifications for each of the five types are correctly processed. The subscription_events table is updated. State transitions occur correctly.

### Chat 088 — Apple Server Notifications V2 Worker, Part 2

*Block 11 · EO 79 · 🟣 · Skills: — · ⚠️ 🚧 · Window N · CD-flags: —*

**Load at session start:** Chat 087; the remaining ten ASSN V2 notification types from Apple's documentation.

**Goal:** Implement the second half of the ASSN V2 handler, covering the remaining ten notification types. These are less common but each requires correct handling to avoid edge-case bugs in payment state.

**Output:**
- The `workers/apple-assn/index.ts` worker extended with handlers for: DID_CHANGE_RENEWAL_PREF, DID_CHANGE_RENEWAL_STATUS, DID_FAIL_TO_RENEW, GRACE_PERIOD_EXPIRED, OFFER_REDEEMED, PRICE_INCREASE, REFUND_DECLINED, REFUND_REVERSED, RENEWAL_EXTENDED, TEST
- TEST handler simply logs the event and returns 200 (used to verify the webhook endpoint configuration in App Store Connect)
- Each handler follows the same pattern: verify, write to events, transition state if applicable

**Implementation notes:** DID_FAIL_TO_RENEW indicates a failed renewal attempt, similar to Stripe's invoice.payment_failed; transition to past_due. GRACE_PERIOD_EXPIRED indicates the grace period after a failed renewal has elapsed without resolution; transition to read_only. PRICE_INCREASE indicates Apple is about to raise the price for a user; record the event but no immediate state change (Apple handles the user consent flow). The TEST notification type is used by App Store Connect to verify the webhook URL is reachable; the handler must respond 200 within a short window or App Store Connect rejects the URL configuration. Like chat 087's handlers, each transition in this chat enqueues a 5-minute delayed reconciliation via an INSERT into the `delayed_jobs` table rather than via Upstash QStash. **Risk note:** this chat (EO 79) is ⚠️ in the prior plan and the Risk Map because the rarer notification types are the easiest to mishandle and the hardest to catch in testing [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. Carries 🚧 — the TEST-notification verification against the production webhook URL happens during the Cutover Block. **Critical Path (canonical) restatement:** this chat completes the ASSN V2 handler that the Block 9 reconciliation worker **074** (EO 92) hard-depends on — the back-reference **074 → 084/087/088**. 074's logic completes only after 088 (EO 79, the last of the three upstream chats) lands; the ordering is governed by the **Critical Path section (Part 10), which is canonical** for it [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md].

**Dependencies:** Chat 087. At lower EO (087 at EO 78). Restates the later-numbered back-reference 074 (EO 92) → 088, governed by the Critical Path section (canonical); no later-EO dependency of 088's own. Carries 🚧.

**End-of-session checks:** Test notifications for each of the remaining ten types are correctly processed. The TEST notification correctly responds 200 from a simulated App Store Connect verification request.

### Chat 089-V — Subscription Lifecycle UI (Visual / Static)

*Block 11 · EO 25 · 🔵 🟢 🎩 · Skills: caveman, stop-slop · — · Window Y (Fwin F14) · CD-flags: —*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (subscription lifecycle copy library); LAYER_5_BUSINESS_MONETIZATION.md (each state's UX); PRD §3.4 (subscription touchpoints); chats 107/107a (the design system and component library these surfaces compose from).

**Goal:** Build the user-facing UI surfaces for every subscription lifecycle state as static, design-locked surfaces composed from the 107a primitives: the trial-end screen with Continue and End options, the day-5 mid-trial payment-method capture surface, the day-6 soft prompt, the past-due banner, the read-only banner polish, the archived welcome-back state, and the settings billing section. This is the visual half: every surface renders against mocked or schema-shaped sample state (the trial-end ledger, banner states, and billing section), with no purchase-flow or state-machine wiring — the binding to the real state machine and the Stripe/Apple flows is deferred to 089-W. As a design-cluster-window chat (Fwin F14) it depends only on already-built foundations plus the design system per the Part 1 window note, and runs while the build track builds the payments backend spine in parallel [doc:PHASE_4_BUILD_PLAN_part1.md].

**Output:**
- `apps/web/components/subscription/TrialEndScreen.tsx` and the mobile equivalent — the trial-end screen with two CTAs ("Continue with Vesper"; "End trial"), rendered against a mocked trial-end ledger; CTA targets are stubbed for 089-W to wire
- `apps/web/components/subscription/MidTrialPaymentMethodCapture.tsx` and the mobile equivalent — the day-5 mid-trial payment-method capture surface; OPTIONAL and OPT-IN; voice-gated copy explaining that capturing a payment method now enables one-tap upgrade tomorrow with no surprise charges; the Setup-Intent / Apple-Pay-token capture itself is wired in 089-W
- `apps/web/components/subscription/TrialDay6Prompt.tsx` and the mobile equivalent — the day-6 soft-prompt surface (one day before trial end), with both branch layouts (captured-payment-method one-tap layout and not-captured informational layout) rendered statically; the branch *selection* and push/email fallback are wired in 089-W
- `apps/web/components/subscription/PastDueBanner.tsx` and the mobile equivalent — the persistent past-due banner layout and copy
- `apps/web/components/subscription/ReadOnlyBanner.tsx` polish — the banner component is built in chat 082; this chat finalizes its voice-gated copy
- `apps/web/components/subscription/ArchivedWelcomeBack.tsx` and the mobile equivalent — the resubscribe-from-archived surface ("Welcome back. Everything is as you left it.")
- `apps/web/app/(app)/settings/billing/page.tsx` and the mobile equivalent — the settings billing section layout with the portal/manage placeholder link

**Implementation notes:** Every copy string in these surfaces passes through the caveman/stop-slop voice gate at authoring time. **The 🎩 flag is propagated here, to the copy-authoring half:** the trial-end line, the day-6 soft-prompt copy, the past-due and read-only banner copy, the archived welcome-back line, and the billing-section copy are user-facing butler copy cleared through the voice gate, so the visual half owns the gate interaction; 089-W wires behavior only, adds no new copy, and shows `Skills: —` — matching the 044-V / 046-V precedent where the visual half carried the gate for its pair [doc:PHASE_4_BUILD_PLAN_part5.md]. The trial-end screen is the highest-conversion surface in the application; the copy is intentionally calm and not pushy ("your week is up" rather than "don't lose access"). The day-5 capture frames the value plainly and stresses that no charge occurs. Per the Stage-2 objection on `-V`/`-W` separability, this `-V` half is built against the **committed** subscription-status and lifecycle copy contracts (LAYER_4 / LAYER_5) rather than a speculative shape, so the wiring half is plumbing if those contracts hold; if a contract shifts during wiring, the rework is concentrated in 089-W where the state-machine binding is explicit, not hidden in the static surfaces [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. **Window vs CD-flag scoping:** `Fwin F14` is the fourteenth window-chat position and is unrelated to any `CD-flag F#`; this chat carries no CD-flag, and the `Fwin#` and `CD-flags` fields are read field-scoped per the Part 1 naming caveat [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 107a (component library) and the committed LAYER_4 lifecycle copy library; per the Part 1 window note the chat depends only on already-built foundations plus the design system earlier in the same cluster and on **no unbuilt build-track chat** [doc:PHASE_4_BUILD_PLAN_part1.md]. Runs at EO 25 inside the window; its visual output gates its own wiring half 089-W (EO 85). No later-EO dependency.

**End-of-session checks:** Each lifecycle state's surface renders correctly with the right voice-gated copy, composed from 107a primitives. The trial-end, day-5, day-6, past-due, read-only, archived, and billing surfaces are design-locked against mocked state. The surfaces are ready for 089-W to rewire to the state machine and the Stripe/Apple flows.

### Chat 089-W — Subscription Lifecycle Wiring (State Machine + Stripe/Apple)

*Block 11 · EO 85 · 🔵 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** 089-V (the design-locked lifecycle surfaces); chat 081 (state machine); chats 083, 086 (Stripe and Apple flows); chat 082 (read-only gate); LAYER_5_BUSINESS_MONETIZATION.md (each state's UX).

**Goal:** Rewire the static lifecycle surfaces from 089-V to the real subscription state machine and the live Stripe/Apple purchase flows. The trial-end and day-6 CTAs invoke Stripe Checkout (web) or StoreKit (mobile); the day-5 capture saves a real Stripe Setup Intent (web) or Apple Pay token (iOS); the day-6 prompt branches on whether a payment method was actually captured; the banners bind to the live `subscription_status`; the billing section opens the real Stripe portal (web) or `showManageSubscriptions` (mobile). This is the build-track wiring half; the `-V` half is not considered done until this ships.

**Output:**
- `TrialEndScreen` CTAs wired: "Continue with Vesper" → Checkout/StoreKit; "End trial" → transition to read_only without payment via the chat 081 state machine
- `MidTrialPaymentMethodCapture` wired: web saves the card via a Stripe Setup Intent (no charge); iOS captures an Apple Pay token via the StoreKit configuration; the captured method is stored against the user's record for the day-6 surface to read
- `TrialDay6Prompt` wired: the branch selection reads whether a payment method was captured on day 5 (one-tap Apple Pay biometric / Stripe Link single-tap charge for captured users; regular trial-end Checkout/StoreKit flow for non-capturing users); the prompt fires in-app on the morning of trial day 6 and via push (mobile) / email (web) with deep link, falling back to email plus a next-open in-app banner when push permission is denied so the conversion moment is never silently skipped
- Past-due banner wired to the live past_due state with a CTA to update payment via the portal; read-only banner wired with a resubscribe CTA; archived welcome-back shown on the first open after resubscribe from archived, skipped on subsequent opens
- Billing section wired to the real Stripe portal session (web) / `showManageSubscriptions` (mobile)
- Disable-on-click guard on every primary CTA that invokes Checkout or StoreKit (trial-end Continue, day-6 one-tap pay, past-due update-payment): the button disables on click before invoking the purchase flow and remains disabled until either the flow completes and the UI navigates away or the flow returns an error and the button resets with a user-visible error toast — without this guard a fast double-tap initiates two parallel purchase flows (duplicate Customer / Checkout Session / StoreKit transaction)

**Implementation notes:** This wiring half adds no new user-facing copy — the lifecycle copy came through the caveman/stop-slop voice gate in 089-V — so it carries no 🎩 and shows `Skills: —`. Because 089-V was built against the committed lifecycle and subscription-status contracts, wiring is plumbing rather than redesign: each surface already expects the state the live query returns. The day-6 timing (24 hours before trial end) gives a meaningful action window without feeling premature; the day-6 branch is the conversion-rate enhancement that captures committed users at low friction without the brand damage of a card-required-upfront flow. Push delivery on mobile falls back to email plus in-app banner when permission is denied. This chat (EO 85) is not ⚠️ in the prior plan. This chat consumes 089-V, 081, 082, 083, and 086 — all at lower EO (089-V at EO 25, 081 at EO 38, 083 at EO 58, 082 at EO 84, 086 at EO 76) — so no later-EO dependency applies and the Critical Path back-reference caveat does not bind this half. Completes the 089 pair.

**Dependencies:** Chats 089-V, 081, 082, 083, 086 (Stage 2 gating prereqs; the prior plan's 089 dependencies were 082, 083, 086, with 081 the state-machine source [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md][doc:PHASE_4_BUILD_PLAN.md]). Runs at EO 85; all prerequisites are at lower EO, so no later-EO hard dependency and the Critical Path back-reference caveat does not apply. Completes the 089 pair.

**End-of-session checks:** Each state's UI is wired to the live state machine and renders the right voice-gated copy from 089-V. The trial-end and day-6 CTAs route correctly through Checkout/StoreKit. The day-5 capture saves a real Setup Intent / Apple Pay token and the day-6 branch reads it correctly. The portal and manage-subscription links work. Every Checkout/StoreKit CTA is disable-on-click guarded against double-submission.

### Chat 090 — Cancellation Flow, Reason Capture, and Account Deletion UI

*Block 11 · EO 86 · 🎩 🔵 🟢 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** LAYER_5_BUSINESS_MONETIZATION.md (cancellation reason list); PRD §3.4 (cancellation touchpoints); chat 030 (account delete API); chat 089 (lifecycle UI).

**Goal:** Build the cancellation flow with the six-option reason dropdown plus an optional free-text field, the post-cancel 48-hour survey email queued for delivery via a worker, and the account deletion UI with the confirmation modal, 30-day grace banner, and restore link.

**Output:**
- `apps/web/components/subscription/CancellationFlow.tsx` and the mobile equivalent — the cancellation surface with the reasons (Price too high, Not using it enough, Found an alternative, Life change, Technical issues, Other), free-text input, and confirmation step
- The cancellation reason is captured in PostHog as the `subscription_canceled` event with properties including the reason, the free text, the user's subscription duration, and the user's archetype; in addition, a row is inserted into the `cancellation_events` table from chat 005 with the same reason, free_text, archetype, subscription_duration_days, and canceled_at so the data is queryable in the application database without round-tripping PostHog
- `apps/web/components/account/DeletionFlow.tsx` and the mobile equivalent — the deletion confirmation modal with the explicit message that data will be removed in 30 days; for iOS users whose subscription is Apple-managed, the flow displays a clear instruction directing them to also cancel via iOS Settings → Apple ID → Subscriptions before the 30-day grace elapses (server cannot cancel on their behalf), with an `itms-apps://` deeplink to that surface; for Stripe-managed subscribers, the server cancels synchronously per chat 030 and no extra action is required from the user
- `apps/web/components/account/DeletionGraceBanner.tsx` and the mobile equivalent — the banner displayed on every screen during the 30-day grace period with the restore link
- The post-cancel survey email is queued for delivery 48 hours after cancellation by inserting a row into the `email_queue` table from chat 005 with `template_name='post_cancel_survey'`, `scheduled_for = now() + interval '48 hours'`, and a payload carrying any context the template needs; the daily-cron worker (or a dedicated tick path) reads due rows and dispatches via Resend, marking `sent_at` on success

**Implementation notes:** Cancellation must be one tap from the settings billing section (no "click here, click there, click here" friction trail). The reason capture is a single dropdown plus an optional free text; submission is immediate. **The 🎩 flag is carried here:** this non-split chat authors *new* user-facing butler copy — the cancellation-reason surface, the deletion-confirmation message, and the grace banner — through the caveman/stop-slop voice gate, so it keeps 🎩 and `Skills: caveman, stop-slop`, matching the prior-plan meta line and the part-7 copy-authoring test for non-split chats [doc:PHASE_4_BUILD_PLAN_part7.md][doc:PHASE_4_BUILD_PLAN.md]. The PostHog event is essential for understanding why users cancel; the data informs future product decisions. The account deletion flow is separate from cancellation; users can cancel without deleting their account (their data remains accessible in read_only mode during the grace period and they can restore by resubscribing). Account deletion is the irrevocable path; the 30-day grace period is the safety net. The grace banner shows on every screen so users cannot accidentally lose their account by forgetting they requested deletion. This chat (EO 86) is not ⚠️ in the prior plan.

**Dependencies:** Chats 030, 089-W, 081 (the prior plan listed 030, 089, 081; the 089 reference resolves to the completed pair, i.e. 089-W [doc:PHASE_4_BUILD_PLAN.md]). All at lower EO (030 at EO 31, 081 at EO 38, 089-W at EO 85). No later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** A test cancellation flow completes correctly and emits the PostHog event with the right properties. The account deletion flow correctly sets deletion_requested_at. The grace banner displays on every screen during the grace period. The restore link correctly transitions the user back to read_only.

### Chat 090b — Biometric Lock Setting

*Block 11 · EO 40 · 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** PRD §6 (Medications and Finance modules); chat 011 (mobile auth with expo-secure-store); the `users.biometric_lock_enabled` column from chat 004.

**Goal:** Add an optional biometric lock setting (Face ID or Touch ID) that, when enabled, requires biometric authentication on every app cold start and on every foreground from background after more than 60 seconds. The setting is OFF by default; users who want extra privacy on the medications and finance surfaces enable it from Settings → Privacy.

**Output:**
- `apps/mobile/app/(tabs)/settings/privacy.tsx` — settings panel with the biometric lock toggle and a brief explanation of what it does
- `apps/mobile/lib/biometric.ts` — wrapper around `expo-local-authentication` that handles enrollment, prompts, and the failure-fallback flow (after three failed attempts, fall back to sign-out + re-sign-in via email magic link)
- `apps/mobile/components/BiometricGate.tsx` — the lock screen component shown on cold start and qualifying foreground transitions when the setting is enabled
- `apps/mobile/hooks/useBiometricLock.ts` — hook that integrates with the app lifecycle hook from chat 013 and enforces the lock at the correct moments
- The setting toggle calls PUT /profile to persist `biometric_lock_enabled` (the column already exists from chat 004's schema)

**Implementation notes:** Biometric lock is a privacy affordance for the sensitive medications and finance surfaces, not a security boundary against a determined attacker with the unlocked device; it is intentionally OFF by default so the default experience has no friction. The 60-second foreground grace prevents the lock from firing on every quick app switch while still re-locking after a meaningful absence. The three-failed-attempt fallback to magic-link re-auth avoids permanently locking a user out of their own account if biometric enrollment changes (e.g., a new Face ID enrollment invalidates the stored credential). This is a mobile-only surface (🟢) and reads the `biometric_lock_enabled` column already present from chat 004's schema, so no migration is authored here and no 🗄️ flag applies. This chat (EO 40) is not ⚠️ in the prior plan. Note its EO (40) places it early in the block-internal run despite its 090b number — the master table is canonical for sequencing and the chat-number order is for readability only [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 011, 013, 004 (the auth, lifecycle-hook, and schema foundations it composes). All at lower EO. No later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** With the setting ON, the app requires biometric auth on cold start and on foreground after >60 seconds in background. With the setting OFF (default), no lock fires. Three failed biometric attempts correctly fall back to sign-out + magic-link re-auth. The toggle persists `biometric_lock_enabled` via PUT /profile.

---

<!-- PHASE_4_BUILD_PLAN.md — Part 9a of 10. Body continues here; conventions, legend, per-chat template, and master reordered-sequence table live in Part 1. Part 9 self-splits into 9a (Block 12) and 9b (Block 13) on the block boundary; the -V/-W pairs 093 and 095 stay together in this file. Concatenate Parts 1→10 (a/b sub-parts in letter order) head-to-tail. -->

---

## Authoring Note for Part 9a (Block 12)

Like Parts 4–8, this part contains no built-foundation chats. Stage 1 asserts 001–020 built and 021+ unbuilt [doc:PHASE_4_REPLAN_STAGE_1_ANALYSIS.md], so every Block 12 chat is not-yet-built work. Every meta line below was **re-derived directly from the Part 1 master reordered-sequence table from scratch** rather than carried from any prior draft or from memory [doc:PHASE_4_BUILD_PLAN_part1.md].

**Self-split on a block boundary.** The Part 1 file-split plan lists Part 9 as "**21 entries**" covering Block 12 (091–097a, with 093/095 `-V`/`-W`) **and** Block 13 (098–105b), with the explicit instruction to "**self-split to 9a/9b if overflow**" [doc:PHASE_4_BUILD_PLAN_part1.md]. Twenty-one full-detail entries with two `-V`/`-W` pairs overflow a single response, so the part is split at the Block 12 / Block 13 boundary: **9a is Block 12, 9b is Block 13.** The split is on a block boundary and never mid-entry, and both `-V`/`-W` pairs in this part (093 and 095) are documented together here in their original Block 12, because a split-half pair must stay in the same file [doc:PHASE_4_BUILD_PLAN_part1.md].

**Two split pairs, no folds, two window chats in this part.** Per the Part 1 file-split plan and master table, Block 12 contains exactly two `-V`/`-W` splits — **093** and **095** — and no folded chats. Both halves of each are documented here, inside the original chat's Block 12, because the split is a sequencing-and-ownership device, not a relocation [doc:PHASE_4_BUILD_PLAN_part1.md]. The two design-track visual halves **093-V** and **095-V** are the only Block 12 window chats: per the master table and Stage 2 §5 they carry `Window Y (Fwin F4)` and `Window Y (Fwin F15)` respectively; every other Block 12 chat reads `Window N` and carries no `Fwin F#` counter [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md][doc:PHASE_4_BUILD_PLAN_part1.md].

**FLAG — `093-W` is not in the master table (discrepancy carried, not reconciled).** The Part 1 master reordered-sequence table sequences **093-V at EO 15** but contains **no row for 093-W**; the Stage 2 §4 full reordered sequence likewise has no 093-W row [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. Yet Stage 2 §3 explicitly splits 093 into a `-V` half (landing page + Three.js hero demo, canned templates, no account) and a `-W` half (wire waitlist signup POST to 031), and Stage 2 §5 states that **all `-W` wiring halves** run post-window on the build track [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. This is the inverse of the Part 6 fold pattern: where the master table renders 052/054 only as their `-W` halves with "`-V` folded in," it renders 093 only as its `-V` half with **no fold note and no `-W` row**. Per the Part 1 rule that the master table is authoritative for the meta line and any master-table-vs-Stage-2 / master-table-vs-file-split-plan conflict is **recorded and flagged, not patched**, this part renders 093-W as a full entry (it is named in the required Part 9 contents) but its meta line carries **no master-table EO** — the EO is **not determinable from the master table** and is therefore not invented. Its build-track assignment and `Window N` are taken from Stage 2 §5's "all `-W` halves are post-window build-track" statement, with that provenance flagged on the entry. The discrepancy is surfaced, not silently resolved.

**FLAG — file-split-plan entry count (21) vs master-table-rendered count (20).** Because the master table omits 093-W (above), the master-table-rendered body of Part 9 is **20 entries** (Block 12 = 9 master-table-rendered: 091, 092, 093-V, 094, 095-V, 095-W, 096, 097, 097a; Block 13 = 11) while the Part 1 file-split plan's parenthetical "**21 entries**" is a pre-split/pre-omission figure that counts a sequenced 093-W [doc:PHASE_4_BUILD_PLAN_part1.md]. Per the Part 1 rule for a file-split-plan-count-vs-master-table disagreement, the discrepancy is **flagged here and not reconciled**. Rendering 093-W as required by the Part 9 contents list brings the rendered count back to 21 entries, but its EO remains underivable from the master table per the flag above.

**Skill / 🎩 propagation (copy-authoring test).** Following the Part 4–8 precedent, the 🎩 voice-gate flag and `Skills: caveman, stop-slop` sit on the chat (or split half) that actually authors user-facing butler copy [doc:PHASE_4_BUILD_PLAN_part5.md][doc:PHASE_4_BUILD_PLAN_part8.md]. Applying the test to Block 12:

- **091** and **092** (non-split) author *new* user-facing butler copy — the auth/trial-reminder email bodies (091) and the waitlist/post-cancel/referral marketing email bodies (092) — through the caveman/stop-slop voice gate, so each keeps **🎩** and `Skills: caveman, stop-slop`, matching their prior-plan meta lines [doc:PHASE_4_BUILD_PLAN.md].
- **093** is split and its pre-split original carried 🎩. The landing-page user-facing copy (hero, section copy, the pricing/signup "iOS first. Android coming later." disclosure, the success-confirmation line) is authored at the **visual** stage, so the gate goes on the copy-authoring half **093-V**; it shows `Skills: caveman, stop-slop` and carries **🎩**. The wiring half **093-W** adds no new user-facing copy — it wires the existing signup form's POST to the chat-031 waitlist API — so it shows **`Skills: —`** and carries **no 🎩**, with the one-line rationale "adds no new copy — the landing copy came through the gate in 093-V," exactly as 089-W stood to 089-V [doc:PHASE_4_BUILD_PLAN_part8.md].
- **095** is split and its pre-split original carried 🎩. **Both** halves author new user-facing voice-gated copy: **095-V** authors the `/r/[code]` landing-page copy (the personalized greeting and the invalid-code soft-redirect page), and **095-W** authors the **referral settings-panel** copy ("Pass this along, if you like." plus the code/link surface) — which Stage 2 §3 explicitly places in the `-W` half, not the `-V` half [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. This is the case the copy-authoring test resolves to **both halves carrying the gate**: 095-W is **not** a no-new-copy wiring half (contrast 089-W and 093-W), because the settings panel introduces distinct new user-facing copy, so **095-V and 095-W each carry 🎩 and `Skills: caveman, stop-slop`**. This dual-gate reading is flagged explicitly on both entries.

No Block 12 chat carries 🗄️ (the `drizzle-best-practices` skill) — the block authors React Email components, marketing/referral surfaces, and analytics wiring, not Drizzle migrations; the `referral_credits` and `users.referral_code` tables/columns 095-W reads were migrated in Block 1 [doc:PHASE_4_BUILD_PLAN.md]. No Block 12 chat carries 🤖 (no prompt-versioned AI-layer call in this block; a 🤖-only chat would in any case show `Skills: —` because 🤖 names no skill [doc:PHASE_4_BUILD_PLAN_part1.md]). The `frontend-design` skill is reserved for the pure design-system chats (107 / 107a / 108a) and is used by **no** Block 12 chat — 093-V and 095-V *consume* the 107/107a primitives and the LAYER_4 copy library but invoke `caveman, stop-slop` for their copy gate, not `frontend-design` [doc:PHASE_4_BUILD_PLAN_part1.md].

**Meta-line emoji ordering (per Part 2/4/5/8).** A 🎩-only build chat leads with the skill emoji then colors (091/092: `🎩 🟡`; 095-W: `🎩 🔵 🟢`); a design-track visual/static half puts colors then 🎩 (093-V: `🔵 🎩`; 095-V: `🔵 🎩`); colors-only chats are in package order (094: `🔵`; 096/097: `🔵 🟢 🟣`; 097a: `🟣`). No 🤖 chat appears in Block 12, so the "colors then 🤖 then 🎩" ordering is not exercised here.

**CD-flags and the Fwin-vs-CD-flag caveat.** One Block 12 chat reads or consumes a CANNOT-DETERMINE flag: **095-W** consumes **F3** (the referral two-sidedness / attribution relationship) per the master table's `F3 C` entry at EO 87 [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]; every other Block 12 meta line reads `CD-flags: —`. The two window chats **093-V** (`Fwin F4`) and **095-V** (`Fwin F15`) carry a `Fwin F#` window counter that shares an `F#` shape with the carried-forward CD-flags F1–F4 but is unrelated and lives in a different field. The `Fwin F#` window counter and any `CD-flag F#` token share an `F#` shape but are unrelated and must be read field-scoped, per the Part 1 naming caveat — restated on 093-V, 095-V, and 095-W below in the 046-W / 060 precedent form. Note in particular that 095-V's `Fwin F15` and 095-W's `CD-flag F3` are different `F#` tokens in different fields on the two halves of the same chat.

**Critical Path back-reference in this part.** The Part 1 How-to-Use back-reference list includes one reference that governs a Block 12 chat: **072 → 091** [doc:PHASE_4_BUILD_PLAN_part1.md]. The Block 9 trial-reminder/dunning worker **072** (EO 90) hard-depends on the auth/trial-reminder email templates authored here in **091** (EO 11); 091 runs early and authors the copy, and 072 consumes it later. That back-reference is restated inline in 091 below, with the **Critical Path section (Part 10) canonical** for the ordering [doc:PHASE_4_BUILD_PLAN.md]. No other Critical-Path back-reference governs a Block 12 chat.

**Block-internal ordering.** The prior plan's Block 12 reads sequentially (091 → 097a) but the master table re-sequences these into a dependency-valid EO order that interleaves Block 12 across the build and design tracks: 091 lands very early (EO 11, on the critical path for 072), the two visual halves 093-V/095-V land inside the design-cluster window (EO 15 / EO 26), and the wiring and analytics chats land late (095-W EO 87, 092 EO 88, 094 EO 89, 096 EO 94, 097 EO 95, 097a EO 96). The chat-number order in which the entries appear below is for readability; **the EO column of the master table is canonical for sequencing** [doc:PHASE_4_BUILD_PLAN_part1.md].

---

## Block 12 — Waitlist and Launch Surfaces

Block 12 builds the public-facing surfaces of the application: the Resend email templates (split across two chats because each template is a voice-gated React Email component), the Three.js cinematic waitlist landing page, the SEO and Open Graph metadata, the referral landing page with attribution flow, and the analytics infrastructure that captures every PostHog event and Sentry breadcrumb. The waitlist landing page is the brand-defining surface; performance on mobile devices is non-negotiable. Two chats in this block are split into a design-track visual half (093-V, 095-V) inside the window and an build-track wiring half (093-W, 095-W) in normal sequence; both halves of each are documented here in Block 12.

### Chat 091 — Resend Email Templates Part 1: Auth and Trial Reminders

*Block 12 · EO 11 · 🎩 🟡 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (email copy library); LAYER_3_TECHNICAL_ARCHITECTURE.md (Resend integration); chat 017 (voice gate); the React Email documentation.

**Goal:** Author the five auth-related and trial-reminder React Email components: the welcome email sent after onboarding completion, the magic link email used for passwordless sign-in (already partially built in chat 010 but finalized here), and the three trial-reminder emails (two days before trial end, one day before, day of). Each email is a React Email component with voice-gated copy that renders correctly across Gmail, Outlook, Apple Mail, and the major mobile clients.

**Output:**
- `packages/shared/emails/WelcomeEmail.tsx` — sent on successful onboarding; voice-gated body explaining what to expect from the daily plan
- `packages/shared/emails/MagicLinkEmail.tsx` — finalized from chat 010 with voice gate verification
- `packages/shared/emails/Trial2DayEmail.tsx` — the two-days-before-trial-end reminder (sent on trial day 5)
- `packages/shared/emails/Trial1DayEmail.tsx` — the one-day-before reminder (sent on trial day 6, paired with the day-6 soft-prompt push)
- `packages/shared/emails/Trial0DayEmail.tsx` — the day-of reminder (sent on trial day 7)
- Each email exports a `subject` constant and a default-export React Email component
- Test rendering script `packages/shared/emails/__tests__/renderAll.ts` that renders each email to HTML and writes the output to `packages/shared/emails/output/` for visual review

**Implementation notes:** React Email components are JSX that renders to email-compatible HTML. The components use the React Email primitives (`<Container>`, `<Section>`, `<Heading>`, `<Text>`, `<Button>`) which handle the cross-client compatibility quirks. The cream-on-espresso brand palette translates to inline style attributes because email clients do not consistently support CSS classes. The voice gate is invoked on every text string during authoring; the components do not contain any string that has not passed the gate. **The 🎩 flag is carried here:** this non-split chat authors *new* user-facing butler copy — the welcome body, the trial-reminder bodies, and their subject lines — through the caveman/stop-slop voice gate, so it keeps 🎩 and `Skills: caveman, stop-slop`, matching the prior-plan meta line and the part-8 copy-authoring test for non-split chats [doc:PHASE_4_BUILD_PLAN_part8.md][doc:PHASE_4_BUILD_PLAN.md]. The trial reminder copy escalates in directness across the three checkpoints: the two-day email is purely informational ("Your trial ends in two days"), the one-day is gently nudging ("Tomorrow your trial ends") and pairs with chat 089's day-6 in-app and push surface as a cross-channel matched pair (the email and the push fire on the same trial day, carry the same CTA, and link to the same one-tap-pay or fallback Checkout/StoreKit destination depending on whether the user captured a payment method on day 5), the day-of is action-oriented ("Today your trial ends. Continue or end?"). All copy avoids exclamation marks and em-dashes per voice rules. The render-to-HTML test script enables visual review without requiring real email sends during authoring. This chat (EO 11) is not ⚠️ in the prior plan. **Critical Path (canonical) restatement:** the three trial-reminder templates authored here are consumed by the later Block 9 trial-reminder/dunning worker **072** (EO 90) — the back-reference **072 → 091**. 091 runs early (EO 11) and has no later-EO dependency of its own; 072 is the chat that depends on 091's output, and the ordering is governed by the **Critical Path section (Part 10), which is canonical** for it [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md].

**Dependencies:** Chats 017, 015. Both built foundations at lower EO. No later-EO hard dependency of 091's own; the back-reference is that the later chat 072 (EO 90) depends on this chat's templates, governed by the Critical Path section (canonical).

**End-of-session checks:** All five emails render to valid HTML. Visual review shows correct branding and copy. Subject lines are voice-gated. Test render produces output files for each template.

### Chat 092 — Resend Email Templates Part 2: Waitlist, Post-Cancel, Referral

*Block 12 · EO 88 · 🎩 🟡 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (email copy library, waitlist nurture sequence, post-cancel survey); LAYER_6_LAUNCH_GROWTH.md (waitlist conversion strategy); chat 017 (voice gate); chat 091 (email rendering pattern established).

**Goal:** Author the remaining three React Email templates: the waitlist nurture email sent at signup ("Building."), the waitlist launch-day email split into iOS and Android variants for the appropriate platform-specific CTAs, and the post-cancel 48-hour survey email that asks one open-ended question about what would have made Vesper work.

**Output:**
- `packages/shared/emails/WaitlistNurture.tsx` — the immediate-after-waitlist-signup email
- `packages/shared/emails/WaitlistLaunchIos.tsx` — the launch-day email for iOS waitlist signups with App Store link
- `packages/shared/emails/WaitlistLaunchAndroid.tsx` — the launch-day email for Android waitlist signups; the copy notes that Android is still in development and offers iOS access if relevant
- `packages/shared/emails/PostCancelSurvey.tsx` — sent 48 hours after subscription cancellation with one open question
- Each follows the same component pattern as chat 091

**Implementation notes:** Every marketing-class email template (WaitlistNurture, WaitlistLaunchIos, WaitlistLaunchAndroid, PostCancelSurvey) must include in its rendered output: (1) A functional one-click unsubscribe mechanism — both a `List-Unsubscribe` header (RFC 8058) emitted via the Resend send-request and a visible unsubscribe link in the email footer. The unsubscribe link routes to `https://vesper.day/unsubscribe?token={token}` and toggles the user's marketing-email preference; the unsubscribe MUST be one-click (no confirmation step, no sign-in required) per CAN-SPAM 2024 enforcement. (2) The founder's registered physical mailing address (PO box or virtual mailbox service such as iPostal1 or Anytime Mailbox; procurement is a founder pre-action handled before the first marketing send) in the footer, exactly as registered. (3) An honest, non-deceptive subject line (covered by the butler voice gate at Chat 098 end-to-end sweep). These requirements do NOT apply to the transactional templates from Chat 091 (auth, trial reminders, dunning); transactional emails are CAN-SPAM-exempt. Additionally, the marketing-class emails must be sent from the marketing subdomain `noreply@mail.vesper.day` (Cutover C-22a per H-4 decision), separate from the transactional `noreply@vesper.day` sender. **End-of-session gate:** NO marketing email send is enabled until (a) the physical mailing address is registered and pasted into the email template footer constant, (b) the unsubscribe endpoint is live and the one-click flow is tested end-to-end, and (c) the marketing subdomain DNS records (Cutover C-22a) are verified. The Chat 092 end-of-session checks block this work until all three gates pass. The waitlist nurture is intentionally short and resists the temptation to over-deliver before launch. The post-cancel survey is unusual in that it does not try to win the user back; the goal is data, not retention. The Android variant of the launch email acknowledges the Android user's situation honestly (Android is V1.5) rather than pretending the launch applies to them; this preserves trust with the Android waitlist segment. **The 🎩 flag is carried here:** this non-split chat authors *new* user-facing marketing-email copy through the voice gate, so it keeps 🎩 and `Skills: caveman, stop-slop`. This chat (EO 88) is not ⚠️ in the prior plan.

**Dependencies:** Chat 091. At lower EO (091 at EO 11). No later-EO hard dependency, so the Critical Path back-reference caveat does not apply.

**End-of-session checks:** All four emails render correctly. The two waitlist launch variants are distinct and platform-appropriate. The post-cancel survey copy is gentle and not pushy.

### Chat 093-V — Waitlist Landing Page with Three.js Cinematic (Visual / Static)

*Block 12 · EO 15 · 🔵 🎩 · Skills: caveman, stop-slop · ⚠️ · Window Y (Fwin F4) · CD-flags: —*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (Marketing Visual Language, landing page composition); LAYER_6_LAUNCH_GROWTH.md (landing page conversion strategy); OPEN_SOURCE_INVENTORY.md (Three.js, R3F); chats 107/107a (the design system and component library these surfaces compose from); chat 014 (CSP configuration / precompiled-shader strategy).

**Goal:** Build the public waitlist landing page at `apps/web/app/(marketing)/page.tsx` with five sections in the Layer 4 composition — hero with the Three.js cinematic scroll experience, "What Vesper does," modules, "How it works," and pricing plus signup — as a static, design-locked surface running on **canned templates with no account**. The page is fully responsive; performance on mobile devices is the constraint that drives every implementation decision because the target audience checks the link from their phone. This is the visual half: the signup form renders and validates client-side against the committed waitlist contract, but the binding of its POST to the real chat-031 waitlist API is deferred to 093-W. As a design-cluster-window chat (Fwin F4) it depends only on already-built foundations plus the design system per the Part 1 window note, and runs while the build track builds the backend spine in parallel [doc:PHASE_4_BUILD_PLAN_part1.md].

**Output:**
- `apps/web/app/(marketing)/page.tsx` — the landing page (static / canned, no account)
- `apps/web/components/marketing/HeroThreeScene.tsx` — the Three.js scene rendered with React Three Fiber, with scroll-driven camera and object animations
- `apps/web/components/marketing/WhatVesperDoes.tsx` — the second section explaining the product in one paragraph plus a visual
- `apps/web/components/marketing/ModulesSection.tsx` — the third section showcasing the seven modules in a grid
- `apps/web/components/marketing/HowItWorks.tsx` — the fourth section walking through the daily journey
- `apps/web/components/marketing/PricingAndSignup.tsx` — the fifth section with the $19.99 monthly subscription price and the waitlist signup form (email plus iOS/Android segmented control plus "Begin" button); the segmented control is accompanied by a prominent voice-gated disclosure positioned adjacent to it: "iOS first. Android coming later." (so Android-segment selectors understand the wait before they submit, not after); the form's submit handler is stubbed for 093-W to wire to POST /waitlist
- All copy is voice-gated
- The Three.js scene is performance-tuned: model assets compressed (Draco glTF), lighting baked into textures, instanced meshes for repeated geometry, dynamic LOD for low-end devices
- A fallback non-Three.js hero for devices that fail the WebGL capability detection and for users with `prefers-reduced-motion: reduce` (a static cream-to-espresso vertical gradient with the wordmark centered, per WCAG 2.3.3)

**Implementation notes:** This is the highest-stakes web surface in Phase 4 because the landing page is the application's first impression, which is why the prior plan marked it ⚠️. **The 🎩 flag is propagated here, to the copy-authoring half:** the hero copy, the section copy, the "iOS first. Android coming later." disclosure, and the signup-confirmation line are user-facing butler copy cleared through the caveman/stop-slop voice gate at the visual stage, so the visual half owns the gate interaction; 093-W wires behavior only, adds no new copy, and shows `Skills: —` — matching the 089-V precedent where the visual half carried the gate for its pair [doc:PHASE_4_BUILD_PLAN_part8.md]. Three.js performance on mobile is the technical risk: an unoptimized scene takes seconds to load on a mid-range Android phone, which destroys conversion; optimization tactics include compressed glTF (Draco), baked lighting, instanced meshes, and progressive scene complexity by detected device capability. Shaders are precompiled at build time via `vite-plugin-glsl` and loaded as static assets so the production CSP can omit `'unsafe-eval'` (cross-reference Decision 13 from chat 001 — the CSP omission and the precompiled-shader strategy are the same architectural decision viewed from two angles). **Risk note:** 093-V is a design-track window chat (EO 15) and retains the ⚠️ flag for the Three.js mobile-performance risk concentrated in this visual half; elevated-risk handling applies. **Window vs CD-flag scoping:** `Fwin F4` is the fourth window-chat position and is unrelated to any `CD-flag F#`; this chat carries no CD-flag, and the `Fwin#` and `CD-flags` fields are read field-scoped per the Part 1 naming caveat [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 107a (component library) and 014 (CSP / precompiled-shader configuration), plus the committed LAYER_4 marketing copy library; per the Part 1 window note the chat depends only on already-built foundations plus the design system earlier in the same cluster and on **no unbuilt build-track chat** — in particular it does **not** depend on the chat-031 waitlist API, whose binding is deferred to 093-W [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. Runs at EO 15 inside the window; its visual output gates its own wiring half 093-W. No later-EO dependency.

**End-of-session checks:** The page renders correctly on desktop, tablet, and mobile with the right voice-gated copy, composed from 107a primitives. Lighthouse mobile performance score is 90 or higher. The Three.js scene runs at 60fps on an iPhone 12 (mid-range target); the reduced-motion / no-WebGL fallback renders. The signup form validates client-side and is ready for 093-W to wire to POST /waitlist.

### Chat 093-W — Waitlist Signup POST Wiring

*Block 12 · EO — (not in master table — see flag) · 🔵 · Skills: — · — · Window N · CD-flags: —*

**FLAG (entry-level):** This chat has **no row in the Part 1 master reordered-sequence table and no row in the Stage 2 §4 full reordered sequence** [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. Its existence and scope come only from Stage 2 §3, which splits 093 into a `-V` half and a `-W` half ("wire waitlist signup POST to 031"), and Stage 2 §5, which states that all `-W` wiring halves run post-window on the build track. Because the master table is authoritative for the meta line but contains no 093-W row, its **EO is not determinable and is not invented** ("EO —"); its **build-track** assignment and **Window N** are carried from Stage 2 §5's "all `-W` halves are post-window build-track" statement, with that weaker provenance flagged here. This is the same master-table-vs-Stage-2 discrepancy described in the Part 9a authoring note; it is surfaced, not reconciled.

**Load at session start:** 093-V (the design-locked landing page and stubbed signup form); chat 031 (waitlist + referral APIs); LAYER_6_LAUNCH_GROWTH.md (waitlist conversion strategy).

**Goal:** Rewire the static signup form from 093-V to the real chat-031 waitlist API. The "Begin" submit handler POSTs the email plus the iOS/Android segment to POST /waitlist; on success the form is replaced with the voice-gated confirmation state authored in 093-V; on error the form surfaces a retryable error without losing the entered email. This is the build-track wiring half; the `-V` half is not considered done until this ships.

**Output:**
- `PricingAndSignup` submit handler wired: the form POSTs `{ email, platform }` to POST /waitlist (chat 031), replacing the optimistic client-side stub from 093-V
- Success path: the form is swapped for the confirmation state (the voice-gated copy already authored in 093-V is reused; no new copy is introduced here)
- Error path: a retryable inline error that preserves the entered email; duplicate-email and invalid-email responses from 031 map to distinct (already voice-gated) messages
- A disable-on-click guard on the "Begin" button so a fast double-tap does not fire two waitlist POSTs

**Implementation notes:** This wiring half adds no new user-facing copy — the landing copy and the confirmation/error strings came through the caveman/stop-slop voice gate in 093-V — so it carries no 🎩 and shows `Skills: —`, with the rationale "adds no new copy — the landing copy came through the gate in 093-V," matching the 089-W / 093-W-class wiring-half precedent [doc:PHASE_4_BUILD_PLAN_part8.md]. Because 093-V was built against the committed waitlist contract (the `{ email, platform }` shape POST /waitlist expects), the wiring is plumbing rather than redesign. **Track note:** Stage 2 §5 places all `-W` halves on the build track, so this entry is build-track; the **EO is left "—" because no master-table row sequences this chat** (see the entry-level flag). It composes 093-V and 031, both of which are sequenced (093-V at EO 15, 031 at EO 9), but its own position in the topological order is not recorded in the master table.

**Dependencies:** Chats 093-V (EO 15) and 031 (EO 9), both at sequenced lower EO. No later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Completes the 093 pair. **Note:** because 093-W is unsequenced in the master table, "lower EO" here is asserted relative to its prerequisites' EOs, not relative to a (nonexistent) 093-W EO.

**End-of-session checks:** The signup form POSTs to POST /waitlist and shows the confirmation state on success. The error path preserves the entered email and surfaces the right voice-gated message. The double-submission guard holds. The 093 pair is complete.

### Chat 094 — Landing Page SEO, Open Graph, and Sitemap

*Block 12 · EO 89 · 🔵 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** 093-V (landing page exists); Next.js Metadata API documentation; the Open Graph protocol specification.

**Goal:** Configure the SEO and Open Graph metadata for the marketing route group so that link previews on social media platforms render correctly with the Vesper brand. Generate the sitemap.xml and robots.txt files. Configure the favicon and the multi-size app icons referenced in the marketing pages.

**Output:**
- `apps/web/app/(marketing)/layout.tsx` updated with the Next.js `metadata` export including title, description, openGraph, twitter, robots, and viewport
- An OG image at `apps/web/public/og-image.png` (1200x630px, branded with the espresso/cream/bronze palette)
- A Twitter card image at `apps/web/public/twitter-card.png`
- `apps/web/app/sitemap.ts` — Next.js sitemap generator covering all public routes
- `apps/web/app/robots.ts` — Next.js robots.txt generator
- JSON-LD structured data embedded in the page head for SoftwareApplication schema
- Favicon and Apple Touch Icon assets in `apps/web/public/`
- The `/support` route referenced by chat 102's App Store Connect Support URL (per J-4), added in this chat so it is live by C-23 hosting

**Implementation notes:** SEO metadata for a marketing-first application is largely standard. The OG image is the visual that appears when someone shares the landing page link on Twitter, LinkedIn, iMessage, or Slack; the design uses the brand palette and includes a short tagline. The JSON-LD structured data helps search engines understand that Vesper is a SoftwareApplication with a subscription pricing model; this affects rich snippets in search results. The sitemap covers the public routes (/, /privacy, /terms; `/r/[code]` is excluded because referral codes are per-user) and submits to Google Search Console after Cutover. This chat authors no user-facing butler copy (metadata and structured data, not surface copy), so it carries no 🎩 and shows `Skills: —`, matching its prior-plan meta line. This chat (EO 89) is not ⚠️ in the prior plan.

**Dependencies:** Chat 093 (resolves to 093-V at EO 15, the landing page the metadata targets). At lower sequenced EO. No later-EO hard dependency.

**End-of-session checks:** A link preview test (e.g., via opengraph.xyz or LinkedIn Post Inspector) shows the correct OG image and metadata. The sitemap.xml renders correctly. The robots.txt is appropriately permissive. The `/support` route is live.

### Chat 095-V — Referral Landing Page (Visual / Static)

*Block 12 · EO 26 · 🔵 🎩 · Skills: caveman, stop-slop · — · Window Y (Fwin F15) · CD-flags: —*

**Load at session start:** LAYER_6_LAUNCH_GROWTH.md (referral program); LAYER_4_EXPERIENCE_IDENTITY.md (referral copy); chats 107/107a (design system and component library).

**Goal:** Build the referral landing page at `/r/[code]` as a static, design-locked surface composed from the 107a primitives: the valid-code state (a personalized greeting that hands off to the main landing page) and the invalid-code soft state (a brand-voiced "this invitation doesn't look right" page with a gentle auto-redirect). This is the visual half: the page renders against canned code states with no attribution cookie set and no API round-trip — the cookie attribution, mint-on-active, and settings panel are deferred to 095-W. As a design-cluster-window chat (Fwin F15) it depends only on already-built foundations plus the design system per the Part 1 window note, and runs while the build track builds the backend spine in parallel [doc:PHASE_4_BUILD_PLAN_part1.md].

**Output:**
- `apps/web/app/r/[code]/page.tsx` — the referral landing page visual: for a (canned) valid code, a personalized greeting that composes into the main landing page; for an invalid code, a soft brand-voiced page ("This invitation doesn't look right. Try the link again, or visit vesper.day.") with a 2-second auto-redirect to the main landing page and HTTP status 200 (search-engine-indexable as page-exists rather than 404). The attribution-cookie set and the redirect-to-API behavior are stubbed for 095-W to wire
- All copy is voice-gated

**Implementation notes:** **The 🎩 flag is propagated here, to a copy-authoring half:** the personalized greeting and the invalid-code soft-page copy are user-facing butler copy cleared through the caveman/stop-slop voice gate at the visual stage, so this half carries 🎩 and `Skills: caveman, stop-slop`. Note that — unlike 093, whose `-W` half adds no copy — 095's `-W` half *does* author distinct new user-facing copy (the settings panel), so the gate is carried on **both** halves of 095; see 095-W for the dual-gate rationale [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md][doc:PHASE_4_BUILD_PLAN_part8.md]. The invalid-code page returns HTTP 200 (not 404) so the URL indexes as page-exists; the 2-second auto-redirect keeps a mistyped code from dead-ending. **Window vs CD-flag scoping:** `Fwin F15` is the fifteenth (final) window-chat position and is unrelated to any `CD-flag F#` — in particular it is not the `CD-flag F3` that this chat's *wiring* half 095-W consumes; the `Fwin F#` window counter and the `CD-flag F#` token share an `F#` shape but are unrelated and must be read field-scoped per the Part 1 naming caveat [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 107/107a (design system and component library) and the committed LAYER_4/LAYER_6 referral copy; per the Part 1 window note the chat depends only on already-built foundations plus the design system earlier in the same cluster and on **no unbuilt build-track chat** [doc:PHASE_4_BUILD_PLAN_part1.md]. Runs at EO 26 inside the window; its visual output gates its own wiring half 095-W (EO 87). No later-EO dependency.

**End-of-session checks:** The valid-code and invalid-code states render correctly with the right voice-gated copy, composed from 107a primitives. The invalid-code page returns HTTP 200 and auto-redirects. The surface is ready for 095-W to wire to the cookie/attribution flow.

### Chat 095-W — Referral Attribution, Mint-on-Active, and Settings Panel

*Block 12 · EO 87 · 🎩 🔵 🟢 · Skills: caveman, stop-slop · — · Window N · CD-flags: F3 (C)*

**Load at session start:** 095-V (the design-locked referral landing page); TECHNICAL_SPEC.md §3.17 (`referral_credits` table); chat 031 (referral track API); chat 081 (subscription state machine — `transitionToActive` owns the mint trigger); the `users.referral_code` column (from the chat 006 schema, verified in chat 111); LAYER_6_LAUNCH_GROWTH.md (referral program).

**Goal:** Wire the referral system behind the 095-V landing page: the attribution cookie mechanism, the referral-code generation utility consumed by 081's mint-on-active transition, and the referral settings panel on web and mobile. The attribution cookie is set when someone visits `/r/[code]`; if that visitor signs up within 30 days, the referring user is credited via a `referral_credits` row when the referee converts to paid. This is the build-track wiring half; the `-V` half is not considered done until this ships.

**Output:**
- The `/r/[code]` page's cookie/attribution behavior wired: visiting the page validates the code and sets the attribution cookie via the chat-031 API, then redirects to the main landing page with the personalized greeting from 095-V
- `apps/web/lib/referral/codeGenerator.ts` — generates a unique 6-character alphanumeric referral code; verifies uniqueness against `users.referral_code`. This utility is **consumed by chat 081's `transitionToActive`, which owns the mint trigger**; this chat does NOT modify the state machine — the mint-on-active logic lives in chat 081, and this chat consumes the existing `users.referral_code` column rather than minting
- `apps/web/app/(app)/settings/referral/page.tsx` and `apps/mobile/app/(tabs)/settings/referral.tsx` — the referral settings panel showing the user's code, their referral link, and only the count of **applied** credits earned. Pending-status credits (referee signed up but not yet converted) are not surfaced to the referrer; this aligns with the butler-voice anti-gamification posture and avoids the disappointment surface when a pending credit voids without converting. The panel includes voice-gated copy ("Pass this along, if you like.") and the link with a copy button
- The referral counts query joins `users` (the referrer) with `referral_credits` filtered to `status='applied'`

**Implementation notes:** **The 🎩 flag is carried here as well as on 095-V — the dual-gate case.** Stage 2 §3 places the **settings panel** in the `-W` half [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md], and the settings panel introduces distinct new user-facing voice-gated copy ("Pass this along, if you like."; the code/link surface). By the copy-authoring test this makes 095-W a copy-authoring half rather than a no-new-copy wiring half (contrast 089-W and 093-W, which add no copy and show `Skills: —`), so it carries 🎩 and `Skills: caveman, stop-slop`. Both halves of 095 therefore carry the gate; this dual-gate reading is flagged explicitly rather than forced onto a single half. **CD-flag F3 (consume) and field-scoping:** the master table records `F3 C` for this chat at EO 87 — 095-W **consumes** the carried-forward CANNOT-DETERMINE flag **F3** (the `referral_credits` two-sidedness + `users` referral-attribution column question), resolved at build time by reading the migration bodies that chat 111 first verified. It also consumes the `users.referral_code` column that chat 081's `transitionToActive` mints on the first active transition. The `Fwin F#` window counter and this `CD-flag F#` token share an `F#` shape but are unrelated and must be read field-scoped: 095-W carries `CD-flag F3 (C)` and `Window N` (no `Fwin`), while its visual half 095-V carries `Fwin F15` and no CD-flag [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_REPLAN_STAGE_2_REORDER.md]. The referral code is a stable 6-character identifier the user can share in voice ("Try Vesper. Use my code, 4F7K2A.") or as a link; the credit amount and structure follows the Layer 6 specification. This chat (EO 87) is not ⚠️ in the prior plan.

**Dependencies:** Chats 095-V (EO 26), 031 (EO 9, waitlist/referral API holding F3), and 081 (EO 38, the state machine that owns the mint-on-active transition), plus the chat-006/111-verified `users.referral_code` column. All at lower EO. No later-EO hard dependency, so the Critical Path back-reference caveat does not apply. Completes the 095 pair.

**End-of-session checks:** A referral link correctly redirects with the attribution cookie set. A new signup via a referral link correctly creates a `referral_credits` row when the referee converts. The settings panel displays the correct code and the applied-credit count (pending credits hidden). The codeGenerator produces unique codes verified against `users.referral_code`. The 095 pair is complete.

### Chat 096 — PostHog Event Taxonomy and 3 Funnels

*Block 12 · EO 94 · 🔵 🟢 🟣 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §11 (PostHog event taxonomy, full event list); LAYER_6_LAUNCH_GROWTH.md (3 primary funnels: signup-to-activation, activation-to-paid, trial-to-D30); `docs/ARCHITECTURE_DECISIONS.md` (PostHog autocapture OFF decision).

**Goal:** Wire every PostHog event from the Tech Spec §11 taxonomy across all surfaces (web, mobile, and Cloudflare Workers where applicable). Configure the three primary funnels in the PostHog dashboard. Verify that `posthog.identify(userId)` is called consistently on auth state change. Verify that no PII is captured in event properties.

**Output:**
- `packages/shared/analytics/events.ts` — the event taxonomy as TypeScript types so each event has a strict shape; this is the source of truth for what each event captures
- `packages/shared/analytics/posthog.ts` — the PostHog client wrappers for `track(event, properties)` and `identify(userId)`
- Every product chat's relevant surfaces updated to emit the appropriate events
- The PostHog dashboard configured with the three funnels (manual configuration in PostHog's UI, screenshots saved to `docs/POSTHOG_FUNNELS.md`)
- Autocapture set to OFF in the PostHog client configuration

**Implementation notes:** The explicit taxonomy is the only set of events captured; autocapture is OFF because the explicit taxonomy is sufficient and autocapture would generate noise. The identify call is made on every auth state change (sign-in; sign-out resets the identity); the only property attached to identify is the user_id, never the email or any other PII. Event properties similarly avoid PII; for example, the `plan_generated` event records user_id, plan_date, the cache_hit boolean, and duration_ms, but not the contents of the plan. The `user_id` property is itself treated as PII for the App Store privacy questionnaire (chat 102 declares the four data categories as `data_linked: true` precisely because PostHog's `identify(userId)` connects events to identity); this consistency between the PostHog taxonomy and the App Privacy declarations is documented here so the questionnaire answers do not drift from the actual data flows. The three funnels measure the core conversion paths: signup-to-activation (signup_complete → first_plan_generated), activation-to-paid (first_plan_generated → subscription_started), and trial-to-D30 (subscription_started → still_active_at_day_30). The PostHog event-name taxonomy is the source of truth for every event name emitted by any chat in the build; as of the post-audit specification it must include the observability events introduced by the audit's Tier 3 fixes (the responsible emitting chat named in parentheses): `realtime_connection_state_changed` (037); `offline_queue_flush_started`, `offline_queue_flush_completed` (038); `nl_command_submitted`, `nl_command_parsed`, `nl_command_applied` (045); `alarm_scheduled`, `alarm_fired`, `alarm_dismissed` (059b); `medication_notification_schedule_failed` (060); `calendar_conflict_detected`, `calendar_conflict_resolved` (067); `push_token_registered` (076); `live_activity_started`, `live_activity_ended`, `live_activity_update_failed` (079); `rate_limit_tripped` (009, per I-009-b); plus the existing taxonomy events for sign-up, sign-in, subscription lifecycle, plan generation, and block completion. If 096 ships before any of the chats above, the taxonomy must still include the event names from the start so the wrapper compiles when the upstream chat lands; the Claude Code session executing 096 reads this Implementation note as authoritative for the initial taxonomy enumeration. This chat authors no user-facing butler copy, so it carries no 🎩 and shows `Skills: —`; it touches the AI layer only as an event sink, not via a prompt-versioned call, so it carries no 🤖. This chat (EO 94) is not ⚠️ in the prior plan.

**Dependencies:** All product chats from Blocks 4 through 11 (the surfaces it instruments). The master-table scope records the prerequisite as "Blocks 4–11" [doc:PHASE_4_BUILD_PLAN_part1.md]. No later-EO hard dependency.

**End-of-session checks:** Every event fires correctly from a manual test pass through the app. The identify calls happen at the right moments. PostHog dashboard funnels render with test data. No PII appears in the PostHog inspector.

### Chat 097 — Sentry Coverage, Vercel Analytics, Open-Metrics Dashboard

*Block 12 · EO 95 · 🔵 🟢 🟣 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** TECHNICAL_SPEC.md §11 (Sentry coverage, Vercel Analytics, public open-metrics dashboard); LAYER_6_LAUNCH_GROWTH.md (open metrics commitment); chat 096 (PostHog dashboard exists).

**Goal:** Complete the observability infrastructure. Verify Sentry source maps upload correctly for web, mobile, and Cloudflare Workers. Add user_id tagging to every Sentry event. Add prompt_version tagging to every AI-related Sentry event. Enable Vercel Analytics on the web application. Configure the public-share link for the PostHog open-metrics dashboard.

**Output:**
- Sentry source map upload verified for all three runtimes (web, mobile, workers); for each Cloudflare Worker, `upload_source_maps = true` is set in the worker's `wrangler.toml` so Sentry receives symbolicated stack traces (without this flag, worker errors arrive as obfuscated minified-bundle traces and are effectively undebuggable)
- `packages/shared/observability/sentryTags.ts` — exports `tagSentryUser(userId)` and `tagSentryPromptVersion(promptName, version)` for use throughout the application
- Every authenticated API route updated to call `tagSentryUser` early in the handler
- Every AI operation in `@vesper/ai` updated to call `tagSentryPromptVersion` before any potential error site
- Vercel Analytics enabled in `apps/web/app/layout.tsx` via `@vercel/analytics/react`
- The PostHog open-metrics dashboard share link configured; the URL captured in `docs/PUBLIC_METRICS.md`
- Stripe shared dashboard URL also captured in the same document

**Implementation notes:** Sentry source maps are uploaded by the CI workflow from chat 002 on every main-branch deploy. The user_id tag on every event is critical for incident response; without it, a Sentry error is anonymous and uncorrelatable with the affected user. The prompt_version tag enables analysis of which prompt version produced a given failure, essential when iterating on prompts. The Sentry sampling scale-down trigger from Chat 001 Decision 7 is implemented as a Sentry monthly-volume alert at 4,000 errors (80% of the 5,000-error Developer-tier monthly cap); when it fires, the founder manually reduces the production sampling rate from 100% via Sentry project settings (documented in `docs/RUNBOOKS/ALERTING.md`). At Vesper's expected early-launch scale, manual intervention at the 4K threshold is appropriate; automation (a daily-cron worker adjusting sampling via the Sentry config API) is deferred to V1.5. The public open-metrics dashboard is the Layer 6 transparency commitment; the PostHog public-share URL is added to the marketing page and the README. Adding `prompt_version` tagging *touches* the AI layer but does so as an observability wrapper, not a prompt-versioned model call, and authors no user-facing copy, so this chat carries neither 🤖 nor 🎩 and shows `Skills: —`, matching its prior-plan meta line. This chat (EO 95) is not ⚠️ in the prior plan.

**Dependencies:** Chat 096 and all product chats (the surfaces it instruments). At lower EO. No later-EO hard dependency.

**End-of-session checks:** Sentry stack traces are symbolicated correctly in production. User and prompt_version tags appear on relevant events. Vercel Analytics records page views. The open-metrics dashboard share link works and is publicly accessible.

### Chat 097a — Operational Alerting and Spend Monitoring

*Block 12 · EO 96 · 🟣 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** Chat 097 (observability infrastructure); chat 003 (incident response runbook); the Sentry, PostHog, and Anthropic dashboards.

**Goal:** Configure proactive alerting on operational thresholds so runaway costs, error spikes, and capacity ceilings surface in the founder's inbox before they become incidents. Without this, Sentry catches errors but not business-level signals like "Anthropic spend doubled overnight" or "Realtime connection count hit 75% of the free tier."

**Output:**
- Sentry alert rules: error rate above 50 per hour on any environment; any 5xx error on the live-activity-pusher worker; any error on the stripe-webhook or apple-assn workers
- PostHog cohort alerts: signup-rate-of-the-day drops more than 50% from the previous day; free-tier Realtime connection count crosses the upgrade threshold at 75 dual-device users (≈150 concurrent channels, 75% of the 200 ceiling per chat 003's SCALING_THRESHOLDS)
- Anthropic spend monitor: a module under the consolidated `daily-cron` worker at the 8am UTC tick (per Chat 001 Decision 20) — `workers/daily-cron/modules/spend-monitor.ts` — querying the Anthropic billing API for yesterday's spend and comparing against the daily budget `max($5/day floor, $1.20/user/month × (active+trial users) / 30)` [training: $1.20/user/month coefficient ⚠️ verify against LAYER_5 operative AI cost]. Sentry-alerts at 80% (warning), 100% (action — investigate), 200% (panic/paging). The $5/day floor handles the early-user period; the per-user term scales as the base grows. The Layer 3 projection assumed cache pre-warm covered all active users, but actual chat-071 coverage is iOS-sleep-alarm only, so the formula accounts for the lower blended cache-hit rate (cold-path ~$0.06 vs warm-path ~$0.020 per first plan)
- Stripe revenue-dip alert: a daily-cron module (`workers/daily-cron/modules/revenue-monitor.ts`) at the 9am UTC tick querying the Stripe Charges API for prior-24h gross_amount vs the trailing 7-day average; alert fires if prior-24h is below 50% of the 7-day average (suppressed during the seed window where there are fewer than 7 days of data). Sigma is paid-tier and not used; the cron-module approach uses the free Charges API
- All alerts route to the founder's email; Slack DM routing depends on Sentry plan tier (email-to-Slack relay via an incoming-webhook channel if direct DM requires the paid plan; documented in the alerting runbook)
- A new `docs/RUNBOOKS/ALERTING.md` summarizing every alert's source, threshold, and expected response

**Implementation notes:** The alerting goal is "no surprise crises" rather than "monitor everything"; alerts that fire frequently get ignored. The thresholds here are starting points, tuned during the first production month based on actual signal-to-noise. The spend monitor is the highest-value alert because Anthropic spend is the largest non-fixed cost; a runaway prompt change or misbehaving worker could 10x daily spend overnight without any user-facing error. The 80% / 100% / 200% ladder allows graduated response. This chat authors no user-facing copy (operational alert config and a runbook), so it carries no 🎩 and shows `Skills: —`; it is worker/infra work, hence 🟣. This chat (EO 96) carries no ⚠️ symbol on 097a's meta line (the Risk Map discusses 097a's blast radius in prose, but the per-chat meta flag is the authoritative source for the meta line, and it is unflagged), so this entry carries no ⚠️ [doc:PHASE_4_BUILD_PLAN.md].

**Dependencies:** Chat 097. At lower EO. No later-EO hard dependency.

**End-of-session checks:** A simulated error storm correctly fires the Sentry alert. A simulated Anthropic spend spike correctly fires the spend-monitor alert. The alerting runbook is complete.

---

<!-- PHASE_4_BUILD_PLAN.md — Part 9b of 10. Body continues here; conventions, legend, per-chat template, and master reordered-sequence table live in Part 1. Part 9 self-split into 9a (Block 12) and 9b (Block 13) on the block boundary. Concatenate Parts 1→10 (a/b sub-parts in letter order) head-to-tail. -->

---

## Authoring Note for Part 9b (Block 13)

This part is the Block 13 half of the self-split Part 9 (the split rationale, the `093-W` master-table-omission flag, and the file-split-plan-count-vs-master-table flag are recorded in the Part 9a authoring note). Stage 1 asserts 001–020 built and 021+ unbuilt [doc:PHASE_4_REPLAN_STAGE_1_ANALYSIS.md], so every Block 13 chat is not-yet-built work. Every meta line below was **re-derived directly from the Part 1 master reordered-sequence table from scratch** [doc:PHASE_4_BUILD_PLAN_part1.md].

**No splits, no folds, no window chats in this part.** Per the Part 1 file-split plan and master table, Block 13 (098–105b) contains no `-V`/`-W` splits and no folded chats; no Block 13 chat is a design-cluster window chat, so every meta line reads `Window N` and carries no `Fwin F#` counter [doc:PHASE_4_BUILD_PLAN_part1.md]. The eleven rendered entries are 098, 099, 100, 101, 101a, 102, 103, 104, 105, 105a, 105b — each at its own master-table EO and Model. The Part 1 file-split plan's "21 entries" figure for Part 9 is the two-block total; the Block 13 contribution rendered here is **11 entries**, which the master table renders in full with no omission (the 093-W omission flagged in 9a is a Block 12 item).

**🚧 Cutover-blocked chats.** Six Block 13 chats carry 🚧 on their prior-plan meta lines — **102, 103, 104, 105a, 105, 105b** — because each cannot run until specific Cutover steps complete (App Store Connect access, production-domain hosting, the sandbox/test billing setup, or the prior submission) [doc:PHASE_4_BUILD_PLAN.md]. The 🚧 flag is carried in each meta line's risk/dep field; the exact Cutover sequencing is governed by the Critical Path section (Part 10, canonical). 098, 099, 100, 101, and 101a carry no 🚧.

**Skill / 🎩 propagation (copy-authoring test).** Following the Part 4–8 precedent, the gate sits on the chat that authors user-facing butler copy [doc:PHASE_4_BUILD_PLAN_part8.md]. The Block 13 chats carrying 🎩 on their prior-plan meta lines are **098, 099, 100, 102, 103, 104** [doc:PHASE_4_BUILD_PLAN.md]:
- **098** *is* the voice-gate end-to-end sweep — it operates the caveman/stop-slop gate across every user-facing string in the build — so it carries 🎩 and `Skills: caveman, stop-slop`.
- **099** and **100** author new user-facing error-state copy through the gate, so each carries 🎩 and `Skills: caveman, stop-slop`. **100** additionally carries **🤖**: its 3-regen empathetic prompt is produced by the prompt-versioned Sonnet call from chat 023, so the AI-layer prompt-versioning flag applies. 🤖 names no skill, so 100's `Skills` field is `caveman, stop-slop` (from 🎩) only.
- **102, 103, 104** author user-facing metadata/caption/legal-page copy through the gate (App Store description and captions; privacy/terms pages where the legal voice allows), so each carries 🎩 and `Skills: caveman, stop-slop`.
- **101, 101a, 105, 105a, 105b** author no new user-facing butler copy (accessibility/perf audit; load/chaos drill; TestFlight submission; demo-account provisioning; rejection response), so each shows `Skills: —` and carries no 🎩.

No Block 13 chat carries 🗄️ (`drizzle-best-practices`) — Block 13 is audits, polish, error states, store assets, and submission, not Drizzle migrations [doc:PHASE_4_BUILD_PLAN_part1.md]. The `frontend-design` skill is reserved for the pure design-system chats (107 / 107a / 108a) and is used by no Block 13 chat [doc:PHASE_4_BUILD_PLAN_part1.md].

**Meta-line emoji ordering (per Part 2/4/5/8 and chat 029).** A 🎩-bearing build chat with no 🤖 leads with the skill emoji then colors (098: `🎩 🔵 🟢 🟡`; 099: `🎩 🔵 🟢`; 102/103: `🎩 🟢`; 104: `🎩 🔵`); a chat carrying 🤖 puts colors first, then 🤖, then 🎩 (100: `🔵 🟢 🤖 🎩`, per chat 029's precedent); colors-only chats are in package order (101: `🔵 🟢`; 101a: `🔵 🟣`; 105/105a/105b: `🟢`).

**Package colors for the cross-cutting / colorless prior-plan chats.** Three prior-plan Block 13 meta lines carried no package color — **098** (voice-gate sweep across all surfaces), **101** (accessibility/perf audit across web + mobile), and **101a** (load test + chaos drill) [doc:PHASE_4_BUILD_PLAN.md]. Following the Part 8 precedent for the colorless cross-cutting chat 082 (rendered `🔵 🟢` for the surfaces it enforces across), each is assigned the package color(s) of the surface(s) it operates on: 098 sweeps web + mobile + the shared email package, so `🔵 🟢 🟡`; 101 audits web + mobile, so `🔵 🟢`; 101a load-tests the plan-gen API route and the workers, so `🔵 🟣`. The assignment follows the touched surfaces, matching how Part 8 colored 082 [doc:PHASE_4_BUILD_PLAN_part8.md].

**CD-flags and the Fwin-vs-CD-flag caveat.** No Block 13 chat reads or consumes a CANNOT-DETERMINE flag — every meta line below reads `CD-flags: —` [doc:PHASE_4_BUILD_PLAN_part1.md]. No Block 13 chat is a window chat, so no `Fwin F#` counter appears in this part; the Part 1 Fwin-vs-CD-flag field-scoping caveat binds no Block 13 meta line.

**No Critical Path back-reference governs a Block 13 chat.** The Part 1 How-to-Use back-reference list (018→019, 020→022, 034→063/064, 056→057, 072→091, 074→084/087/088) contains no entry that governs a Block 13 chat; 072→091 governs Block 12's 091 (restated in 9a), and 074→084/087/088 governs Block 9/Block 11 chats [doc:PHASE_4_BUILD_PLAN_part1.md]. Block 13's dependencies are all on lower-EO chats and on the Cutover Block (for the 🚧 chats), with no later-numbered hard dependency requiring an inline Critical Path restatement.

**Block-internal ordering.** The prior plan's Block 13 chain runs the polish/error sweeps (098 → 099 → 100), then the audits (101, 101a), then the store-submission chain (102 → 103; 104; 105a → 105 → 105b). The master table re-sequences these into a dependency-valid EO order across EO 93 through EO 106; note in particular that **105a (demo-account provisioning) sits at EO 93, earlier than 105 (TestFlight submission) at EO 105**, because the seeded reviewer accounts must exist before submission. The entries below appear in chat-number order for readability (098, 099, 100, 101, 101a, 102, 103, 104, 105, 105a, 105b); **the EO column of the master table is canonical for sequencing** [doc:PHASE_4_BUILD_PLAN_part1.md].

---

## Block 13 — Polish and App Store Submission

Block 13 is the final block before submission. It is intentionally not feature work. The voice gate end-to-end sweep audits every user-facing surface. The error states sweep handles the unhappy paths. The accessibility and performance audit catches WCAG and Lighthouse issues. App Store metadata is authored. Screenshots are designed. Privacy policy and Terms of Service are written. The TestFlight build is submitted. The App Store submission is made.

### Chat 098 — Butler Voice Gate End-to-End Sweep

*Block 13 · EO 97 · 🎩 🔵 🟢 🟡 · Skills: caveman, stop-slop · ⚠️ · Window N · CD-flags: —*

**Load at session start:** PRD §5 (full Butler Voice Specification); LAYER_4_EXPERIENCE_IDENTITY.md (full voice rules and copy library); chat 017 (voice gate); every product chat from Blocks 4 through 12.

**Goal:** Audit every user-facing string across web, mobile, emails, and the marketing surface for voice compliance. The regex layer of the voice gate is run programmatically against every literal string in the codebase. The Haiku review layer is run against every AI-generated string with a known sample. Copy library reconciliation verifies that every line shipped to the user matches the Layer 4 specification.

**Output:**
- `packages/shared/scripts/voiceGateSweep.ts` — a script that walks the codebase, extracts every string literal in TSX/JSX files, filters to user-facing strings (heuristics based on usage context), and runs the regex layer against each
- A report file at `packages/shared/output/voice-gate-sweep-{timestamp}.md` listing every violation found
- Every violation fixed; the script re-run to confirm clean
- The Haiku review layer manually invoked on a sample of AI-generated outputs from the eval harness (chat 020) with the results reviewed
- A copy library reconciliation document confirming that every hardcoded line in the application matches the Layer 4 line library

**Implementation notes:** This is a manual-plus-automated audit chat. The script catches the easy cases (em-dashes, exclamation marks, prohibited strings) but cannot catch tone violations (overly chipper copy, validation-seeking phrases). The Haiku review layer is the second pass; running it on a sample of AI outputs from real plan generations surfaces drift between the prompt's stated behavior and the actual output. The copy library reconciliation is the most manual part: each hardcoded line is checked against the Layer 4 specification. This chat **operates** the caveman/stop-slop voice gate across every surface, so it carries 🎩 and `Skills: caveman, stop-slop`. **Package colors:** the prior-plan meta line carried no package color because the sweep is cross-cutting; following the Part 8 colorless-chat precedent (082 rendered `🔵 🟢`), this entry is colored for the surfaces it sweeps — web (🔵), mobile (🟢), and the shared email package (🟡) [doc:PHASE_4_BUILD_PLAN_part8.md][doc:PHASE_4_BUILD_PLAN.md]. **Risk note:** this chat (EO 97) is ⚠️ in the prior plan and the Risk Map (a miss results in brand contamination at launch — prohibited copy reaching users) [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. 

**Dependencies:** All prior chats (it sweeps every user-facing surface in the build). At lower EO (EO 97 sits near the end of the order). No later-EO hard dependency.

**End-of-session checks:** The voice gate sweep script reports zero violations. A manual sample of AI outputs passes the Haiku review. The copy library reconciliation is complete.

### Chat 099 — Error States Part 1: AI Fallback, Offline, Integration Errors

*Block 13 · EO 98 · 🎩 🔵 🟢 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** PRD edge cases section; LAYER_2_PRODUCT_SCOPE.md (locked edge case behaviors); chat 022 (synthesizePlan fallback); chat 038 (offline mutation queue); chat 064 (GCal sync).

**Goal:** Build and verify the unhappy-path UI surfaces for the AI fallback chain, offline state, and broken-integration errors. The AI fallback surface displays the apology line from chat 022 when the fallback chain produces a hardcoded plan. The offline state surface displays the cached plan with a sync-on-reconnect toast. The broken-integration banner surfaces on the integrations settings page and on the day view when an integration sync has failed.

**Output:**
- `apps/web/components/plan/AIFallbackBanner.tsx` and the mobile equivalent — the banner shown when the current plan was produced by the fallback chain; voice-gated copy
- `apps/web/components/plan/OfflineState.tsx` and the mobile equivalent — the indicator shown when the device is offline; the cached plan is still visible
- `apps/web/components/integrations/BrokenIntegrationBanner.tsx` and the mobile equivalent — the banner shown when `integrations.status='error'` (the field is the authoritative trigger; transient last_error values from successfully-recovered syncs do not flicker the banner). This is the same component as chat 063's settings-page reconnect banner, mounted in two places (settings → integrations page from 063, and the day view from this chat) so a user who never visits settings still sees the integration breakage and can act on it
- `apps/web/components/plan/DegradedModeBanner.tsx` and the mobile equivalent — the banner shown when this user's per-user synthesizePlan circuit breaker from chat 022 has opened (three Anthropic failures within five minutes for this user); reads "Working slower than usual. Plans will resume shortly." and remains until the breaker auto-closes. It reads the breaker state via `GET /api/v1/health/circuit-breaker` returning `{ open, opensAt?, closesAt? }` for the authenticated user; the component polls every 30 seconds while mounted (and unsubscribes on unmount). The app stays read-functional and new plan-generation requests serve the last-known plan with a refresh CTA
- All copy voice-gated

**Implementation notes:** Error states are where the application's voice is tested most rigorously because the user is frustrated and the copy must be calming rather than apologetic-to-the-point-of-self-flagellation. The AI fallback banner says "Working from your usual routine today" rather than "AI failed, sorry, please try again." The offline state shows the cached plan with a quiet indicator rather than a modal blocking interaction. The broken-integration banner offers a one-tap reconnect CTA rather than asking the user to figure out what to do. This chat authors new user-facing error-state copy through the voice gate, so it carries 🎩 and `Skills: caveman, stop-slop`. This chat (EO 98) is not ⚠️ in the prior plan.

**Dependencies:** Chats 022, 038, 064, 098 (the voice-gate sweep). All at lower EO (022 at EO 27, 038 at EO 45, 064 at EO 44, 098 at EO 97). No later-EO hard dependency.

**End-of-session checks:** Each error state renders correctly in test scenarios. The copy passes the voice gate. The reconnect CTA on the integration banner works.

### Chat 100 — Error States Part 2: Regen Prompt, Absence, 404, Auth Expired, Module Mini-Onboarding

*Block 13 · EO 99 · 🔵 🟢 🤖 🎩 · Skills: caveman, stop-slop · — · Window N · CD-flags: —*

**Load at session start:** PRD edge cases section; chat 023 (generateRegenerationPrompt); the auth flow; chat 035 (onboarding preferences).

**Goal:** Build the remaining error and edge-case UI surfaces. The 3-regen empathetic prompt fires after the user has regenerated their plan three times in a single day; the prompt is generated by the Sonnet call from chat 023. The 3+ day absence welcome-back surface displays when the user opens the app after more than three days away. The 404 and 500 pages are designed with the brand voice. The auth session-expired flow handles a stale session triggering re-sign-in. The module mini-onboarding is a one-to-two-screen sub-flow that fires when a user toggles a module ON mid-trial.

**Output:**
- `apps/web/components/plan/RegenerationPromptModal.tsx` and the mobile equivalent — surfaces after the third regeneration of the day; uses the Sonnet-generated empathetic prompt from chat 023
- `apps/web/components/plan/WelcomeBackBanner.tsx` and the mobile equivalent — surfaces on the first app open after 3+ days away
- `apps/web/app/not-found.tsx` and `apps/web/app/error.tsx` — 404 and 500 pages with brand voice
- `apps/mobile/app/+not-found.tsx` — mobile 404
- `apps/web/app/(auth)/session-expired/page.tsx` and the mobile equivalent — shown when an API call returns 401 due to expired session
- `apps/web/components/modules/ModuleMiniOnboarding.tsx` and the mobile equivalent — the 1–2 screen sub-flow when a module is toggled ON; collects the same preferences as the original onboarding for that module

**Implementation notes:** The 3-regen empathetic prompt is the application asking the user honestly what is not working with the plans; it surfaces only after three regenerations in a single local day, counted via a completion_log query (`SELECT COUNT(*) FROM completion_log WHERE user_id = $1 AND event_type IN ('plan_generated','plan_regenerated') AND created_at >= start_of_local_day($2)`, `$2` the user's timezone-aware day boundary). Counting via completion_log (rather than a per-plan regeneration_count column) correctly handles generating today's plus tomorrow's plan in one session; the threshold is per-day-of-activity, not per-plan-row. **The 🤖 flag is carried here:** the regen prompt is produced by the prompt-versioned Sonnet call from chat 023, so the AI-layer prompt-versioning flag applies; per the Part 1 legend 🤖 names no skill, so the `Skills` field carries only `caveman, stop-slop` (from 🎩) [doc:PHASE_4_BUILD_PLAN_part1.md]. The 3+ day absence welcome-back is a soft re-entry that acknowledges the gap without nagging. The 404 page uses the brand palette and a voice-gated line. The session-expired flow re-routes to sign-in with a return-to URL. The module mini-onboarding skips itself when the user already has stored preferences for the module being toggled ON (toggling OFF does not delete preferences, so toggling back ON restores prior state); the skip check reads the relevant slice of `user_profiles.modules_enabled` JSONB and renders the sub-flow only if the slice is missing or empty. **Emoji ordering:** with 🤖 present, colors lead, then 🤖, then 🎩 (`🔵 🟢 🤖 🎩`), per the chat-029 precedent [doc:PHASE_4_BUILD_PLAN_part1.md]. This chat (EO 99) is not ⚠️ in the prior plan.

**Dependencies:** Chats 023, 022, 035 (resolves to 035-W), 098. All at lower EO. No later-EO hard dependency.

**End-of-session checks:** Each surface renders correctly in test scenarios. The Sonnet regen prompt produces context-appropriate questions. The module mini-onboarding correctly persists preferences.

### Chat 101 — Accessibility and Performance Audit

*Block 13 · EO 100 · 🔵 🟢 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** WCAG 2.1 AA standard; Apple Accessibility Guidelines; the full web and mobile applications.

**Goal:** Run the accessibility and performance audits and fix critical issues. On web, run axe-core against every page and resolve violations. On mobile, run VoiceOver through the primary user flows and fix navigation issues. On the marketing landing page, run the Lighthouse mobile audit and resolve performance violations to achieve a score of 90 or higher.

**Output:**
- `apps/web/playwright.config.ts` updated to include axe-core integration tests
- A list of accessibility issues found and resolved in `docs/A11Y_AUDIT.md`
- Performance budgets documented in `docs/PERFORMANCE_BUDGETS.md` covering the marketing page (mobile Lighthouse 90+), the app shell first paint (under 2 seconds on a mid-range device), and the plan-view interaction latency (under 100ms for block actions)
- VoiceOver audit pass with critical issues fixed

**Implementation notes:** Accessibility is a real concern for some users and a soft requirement for App Store approval (Apple rejects apps that are clearly inaccessible). The axe-core integration covers programmatic issues like missing alt text, incorrect ARIA labels, and color-contrast violations. VoiceOver testing catches focus-order issues automation does not surface. The Lighthouse mobile audit on the landing page is the most demanding performance check; if the Three.js scene drops below 90, the chat 093-V optimizations need revisiting (further model compression, more aggressive LOD). This chat authors no user-facing copy, so it shows `Skills: —` and carries no 🎩. **Package colors:** the prior-plan meta line carried no color; following the Part 8 colorless-chat precedent it is colored for the surfaces it audits — web (🔵) and mobile (🟢) [doc:PHASE_4_BUILD_PLAN_part8.md]. **Risk note:** this chat (EO 100) — the Risk Map discusses it in prose (accessibility failures can cause App Store rejection), but the prior-plan meta line carries **no ⚠️ symbol**, and the per-chat meta flag is authoritative for the meta line, so this entry carries no ⚠️ [doc:PHASE_4_BUILD_PLAN.md].

**Dependencies:** All prior product chats. At lower EO. No later-EO hard dependency.

**End-of-session checks:** axe-core integration tests pass on all major pages. VoiceOver navigates the app correctly. Lighthouse mobile score is 90 or higher on the landing page.

### Chat 101a — Load Test and Chaos Drill Checklist

*Block 13 · EO 101 · 🔵 🟣 · Skills: — · — · Window N · CD-flags: —*

**Load at session start:** All chats from Block 4 through Block 11; the Anthropic and Supabase free-tier rate limits and connection caps.

**Goal:** Run a lightweight synthetic load test and a manual chaos drill against the staging environment to surface integration failures that single-user testing cannot reveal. The intent is to discover pool exhaustion, rate-limit collisions, and degraded-mode behavior before production users do.

**Output:**
- `scripts/load-test/synthesizePlan.ts` — a k6 or autocannon script that fires 50 concurrent POST /plans/generate requests against staging and reports p50/p95/p99 latency, error rates, and connection-pool utilization
- `docs/CHAOS_DRILL_CHECKLIST.md` — a manual chaos-test checklist with scenarios: (a) Anthropic API slowed to 30s response (simulated via a request interceptor); verify the circuit breaker opens and the degraded-mode banner shows; (b) Supabase paused for 5 minutes; verify graceful UI behavior; (c) Stripe webhook delivery delayed by 1 hour; verify the reconciliation worker catches up; (d) Cloudflare Worker CPU limit hit; verify the Sentry alert fires and the worker retries
- Test results documented in `docs/LOAD_TEST_RESULTS.md` with the date, configuration, and findings
- Any critical issues surfaced by the test filed as fix-before-launch items

**Implementation notes:** This is intentionally lightweight; full load-testing infrastructure is out of scope for V1. The 50-concurrent number is chosen because the Supavisor free tier has a 15-connection cap on transaction mode; 50 concurrent plan generates will provably exhaust this and surface the degraded behavior. The chaos drill is manual rather than automated because the goal is to verify the team's response runbooks, not to maintain a continuous chaos harness. This chat authors no user-facing copy (a load-test script and a chaos checklist), so it shows `Skills: —` and carries no 🎩. **Package colors:** the prior-plan meta line carried no color; following the Part 8 colorless-chat precedent it is colored for the surfaces it exercises — the plan-gen API route in `@vesper/web` (🔵) and the Cloudflare workers under chaos (🟣) [doc:PHASE_4_BUILD_PLAN_part8.md]. This chat (EO 101) is not ⚠️ in the prior plan.

**Dependencies:** All product chats; the staging environment running against production-equivalent infrastructure. At lower EO. No later-EO hard dependency.

**End-of-session checks:** Load test runs and produces a results document. Each chaos scenario is executed and the observed behavior documented. Critical issues are filed.

### Chat 102 — App Store Metadata and Privacy Manifest

*Block 13 · EO 102 · 🎩 🟢 · Skills: caveman, stop-slop · 🚧 · Window N · CD-flags: —*

**Load at session start:** LAYER_3_TECHNICAL_ARCHITECTURE.md (App Privacy questionnaire); Apple's App Store Connect documentation; Apple's Privacy Manifest documentation; chat 098 (voice-gate sweep).

**Goal:** Author the complete App Store Connect metadata for submission: app description (4000-char limit), subtitle (30 chars), keywords (100 chars), promotional text (170 chars), age-rating answers, App Privacy questionnaire answers covering all data categories from Tech Spec, the Apple Privacy Manifest file (`PrivacyInfo.xcprivacy`), and the localization metadata (English/US only at V1).

**Output:**
- `docs/APP_STORE_METADATA.md` containing every metadata field with its final voice-gated copy
- `apps/mobile/ios/Vesper/PrivacyInfo.xcprivacy` — the Privacy Manifest declaring every Required Reason API used in the production iOS build, generated by running Apple's Required Reason API audit tool against the actual build output rather than from memory, then populated with the discovered API usages and their declared reason codes
- App Privacy questionnaire answers in `docs/APP_PRIVACY_QUESTIONNAIRE.md` covering each data category collected (Contact Info: email; Identifiers: user ID; Usage Data: PostHog events; Diagnostics: Sentry crash data) with all four categories declared `data_linked: true` because PostHog's `identify(userId)` connects events to identity; Tracking declared `false` (no third-party tracking, no IDFA, no cross-app data sharing); the questionnaire also discloses every runtime subprocessor (matching the chat-104 list — Supabase, Anthropic, PostHog, Sentry, Stripe, Apple StoreKit/ASSN, Resend, Cloudflare Workers, Upstash Redis, Google OAuth + Calendar API) so the questionnaire and the public privacy policy are consistent
- Age rating set to 4+ with no objectionable content categories
- App Store Connect Support URL `https://vesper.day/support` (the `/support` route added in chat 094 per J-4; live by C-23 hosting); Marketing URL `https://vesper.day` (the landing page from 093); Privacy Policy URL `https://vesper.day/privacy` and Terms URL `https://vesper.day/terms` (the pages from 104)
- Family Sharing OFF on the subscription product (configured in App Store Connect at Cutover; this chat documents the requirement)

**Implementation notes:** App Store metadata is content work. The description is the primary App Store marketing surface; the first three lines are what users see before tapping More. The keywords field drives App Store search ranking. The Privacy Manifest is required for iOS 17.4+; Apple rejects apps that lack it or fail to declare specific Required Reason API usage. The manifest here is a DRAFT generated from a current development build; the FINAL committed manifest is regenerated in chat 105 against the production TestFlight build, because the Expo Modules and native dependencies in the dev build may differ from the production build and only the production build's audit reflects what Apple scans. Generating the manifest from a build scan rather than a guess avoids the under-declaration failure mode. The `data_linked: true` declaration on all four categories is the accurate posture given how PostHog operates; declaring `false` would be a misrepresentation surfacing in review as rejection. Tracking is `false` because Vesper does no cross-app tracking, uses no IDFA, and shares no data for advertising. **Forward-looking constraint:** any future addition of an analytics/attribution/marketing provider (AppsFlyer, Adjust, Branch, marketing-enabled Segment, Meta/TikTok SDK, Audience Network) re-triggers an ATT evaluation; the next chat adding any such provider must update the questionnaire, possibly adopt the ATT prompt, and re-submit metadata. This chat authors user-facing description/caption copy through the voice gate, so it carries 🎩 and `Skills: caveman, stop-slop`; the iOS metadata/manifest surface gives it 🟢; it carries 🚧 because App Store Connect access and the metadata fields depend on Cutover. This chat (EO 102) is not ⚠️ in the prior plan.

**Dependencies:** Cutover (for App Store Connect access) and chat 098. At lower EO. No later-EO hard dependency. Carries 🚧.

**End-of-session checks:** All metadata fields drafted and voice-gated. The Privacy Manifest validates via Apple's tooling. App Privacy answers match the actual data-collection patterns.

### Chat 103 — App Store Screenshots and Marketing Assets

*Block 13 · EO 103 · 🎩 🟢 · Skills: caveman, stop-slop · 🚧 · Window N · CD-flags: —*

**Load at session start:** LAYER_4_EXPERIENCE_IDENTITY.md (brand specification); App Store screenshot requirements (6.9", 6.7"); chat 102 (metadata exists).

**Goal:** Design and produce the App Store screenshots covering the required device sizes — 6.9" (iPhone 16 Pro Max) and 6.7" only. The 6.5" iPhone 11 Pro Max size is dropped (Apple no longer requires it for new submissions when 6.9" and 6.7" are supplied). Author the marketing icon (1024×1024) and any app preview video. Voice-gated copy on each screenshot's caption.

**Output:**
- Six screenshots per device size (6.9" and 6.7") showing: the day view with a populated plan, the natural-language input in action, the Dynamic Island Live Activity (compact and expanded), the weekly planning surface, the module library, and a subscription confirmation
- Each screenshot includes a caption banner with voice-gated copy (e.g., "Your day, planned for you" on the day view)
- The 1024×1024 marketing icon in the brand palette
- An optional 15–30 second app preview video (deferred to V1.5 if time-constrained)
- All assets stored in `apps/mobile/AppStoreAssets/`

**Implementation notes:** Screenshots are the primary visual sales pitch on the App Store. Each is a polished composition: a real-looking populated surface with the caption banner positioned for the device's safe area. The captions guide the user through the value proposition in screenshot order (day view headline "Your day, planned for you"; natural-language input "Just say what you need"; and so on). The marketing icon uses the espresso background with the bronze monogram, scaled to 1024×1024 with padding for App Store rounded-corner rendering. The app preview video is optional but increases conversion 15–25% per Apple's published data; if time permits it shows a 20-second walkthrough of the daily flow. This chat authors user-facing caption copy through the voice gate, so it carries 🎩 and `Skills: caveman, stop-slop`; the iOS store-asset surface gives it 🟢; it carries 🚧 (asset production depends on the Cutover-gated metadata/store setup). This chat (EO 103) is not ⚠️ in the prior plan.

**Dependencies:** Chat 102. At lower EO. No later-EO hard dependency. Carries 🚧.

**End-of-session checks:** All six screenshots at both required device sizes are produced and look professional. The marketing icon is 1024×1024 and brand-compliant. Captions are voice-gated.

### Chat 104 — Privacy Policy and Terms of Service Live Pages

*Block 13 · EO 104 · 🎩 🔵 · Skills: caveman, stop-slop · 🚧 · Window N · CD-flags: —*

**Load at session start:** LAYER_3_TECHNICAL_ARCHITECTURE.md (data handling, encryption, retention); the GDPR-equivalent requirements for US-based users (CCPA, state-level laws); Apple's required disclosures.

**Goal:** Author the privacy policy and terms of service as live pages on the production domain. Both are required for App Store submission. The privacy policy discloses every category of data collected, the retention periods, the full subprocessor list (Supabase, Anthropic, PostHog, Sentry, Stripe, Apple (StoreKit and App Store Server Notifications), Resend, Cloudflare (Workers), Upstash (Redis), Google (OAuth and Calendar API)), and the deletion process. The terms of service govern the user's relationship with Vesper including the subscription terms and cancellation rights.

**Output:**
- `apps/web/app/(marketing)/privacy/page.tsx` — the privacy policy page with the full text
- `apps/web/app/(marketing)/terms/page.tsx` — the terms of service page with the full text
- Both pages render under the marketing layout (no auth gate) and use the brand styling
- Cookie disclosure section in the privacy policy covering Supabase auth cookies, PostHog cookies, Stripe cookies, and the referral attribution cookie
- Data deletion process disclosed (the 30-day grace period, the hard-delete worker, the SHA-256 email hash retention)
- Voice-gated where the legal-document voice allows; legal language remains where required

**Implementation notes:** Privacy policy and terms are legal documents; their voice is appropriately formal rather than butler-tone, but the language is plain and not jargon-heavy. The policies cover every data category in the App Privacy questionnaire from chat 102. The cookie disclosure is required by some US states (and is best practice everywhere). The deletion-process disclosure is required by Apple's privacy guidelines. The hosted location on the production domain (Cutover-blocked) is what App Store submission requires; without these pages live, App Store review rejects. This chat authors user-facing page copy through the voice gate where the legal voice allows, so it carries 🎩 and `Skills: caveman, stop-slop`; the web pages give it 🔵; it carries 🚧 because hosting on the production domain depends on Cutover. This chat (EO 104) is not ⚠️ in the prior plan.

**Dependencies:** Cutover (for hosting on the production domain), chats 102, 098. At lower EO. No later-EO hard dependency. Carries 🚧.

**End-of-session checks:** Both pages render correctly at the production URL. The content covers every required disclosure. The voice is consistent with the brand.

### Chat 105 — TestFlight Build, Live Activity End-to-End Verification, App Store Submission

*Block 13 · EO 105 · 🟢 · Skills: — · ⚠️ 🚧 · Window N · CD-flags: —*

**Load at session start:** Chats 077-080 (Live Activity widget, bridge, worker); chat 102 (metadata); chat 103 (screenshots); chat 104 (privacy/terms); all Cutover steps completed.

**Goal:** Produce the production TestFlight build via `eas build --platform ios --profile production`, submit it to TestFlight via `eas submit`, add the founder to the internal testing group, and perform the full Live Activity end-to-end verification on a physical iPhone. After verification passes, submit the build to App Store Review with all metadata, screenshots, and privacy materials attached.

**Output:**
- A production TestFlight build available via `eas build`
- The build submitted to TestFlight via `eas submit`
- The founder added to the internal testing group in App Store Connect
- Privacy Manifest regenerated against the production TestFlight build (`apps/mobile/ios/Vesper/PrivacyInfo.xcprivacy`) — this supersedes the draft manifest authored in chat 102; the regeneration is non-negotiable because the production build may include native modules the dev build did not (Expo Modules' Required Reason API surface differs between dev and prod targets)
- Live Activity end-to-end verification on a physical iPhone 14 Pro or newer: block start → Dynamic Island populates correctly in compact and expanded states → Mark Complete tap → PATCH /blocks fires → Dynamic Island ends → the next block's Live Activity chains correctly → fallback APNs push works on a non-Dynamic-Island device (iPhone 14 or earlier)
- Multi-device Realtime sync verification added to the end-of-session checks: two physical devices signed into the same account observe each other's block mutations and plan regenerations within one second; the self-mutation filter drops echoes on the originating device; foregrounding the second device after a background period triggers the explicit refetch from chat 037 and picks up any broadcasts missed during background
- App Store submission with all metadata, screenshots, and privacy materials attached
- A submission tracking document at `docs/APP_STORE_SUBMISSION.md` capturing the submission date, the build version, and the review status

**Hardware requirements (verified in chat 001):** an iPhone 14 Pro or newer (Dynamic Island host) AND an iPhone 14 or earlier (non-Dynamic-Island fallback APNs push verification target). Both are listed on the chat 001 hardware checklist; both must be available before this chat begins.

**Implementation notes:** This is the final chat of Phase 4. The physical-device Live Activity verification is the highest-stakes test because the entire Block 10 work is unverifiable without it. If verification fails, the chat does not submit to App Store Review; instead, the issues are diagnosed and fixed in subsequent chats before resubmission. Common failure modes include: the widget extension's entitlements being mis-configured (the Live Activity fails to start), the APNs payload structure being wrong (the Dynamic Island does not update), the action intent's deep link being malformed (Mark Complete does not register). Each failure mode has a known fix path. The App Store submission, once made, enters Apple Review; review typically takes 24-72 hours. The chat ends when the submission is accepted into review (not when it is approved); approval and the public launch are Phase 5 work. This chat authors no new user-facing butler copy (build, verification, and submission), so it shows `Skills: —` and carries no 🎩. **Risk note:** this chat (EO 105) is ⚠️ in the prior plan and the Risk Map (the final gate before launch; failed verification means resubmission after fixes) [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. Carries 🚧 (all Cutover steps must complete first).

**Dependencies:** All Cutover steps, chats 077-080, 102, 103, 104, 105a (demo-account provisioning, at EO 93 — earlier in the order than this chat's EO 105, so the reviewer accounts exist before submission). All at lower EO. No later-EO hard dependency. Carries 🚧.

**End-of-session checks:** TestFlight build is live and installable. The founder has the build on a physical device. Live Activity verification passes all sub-tests. App Store Review status changes from "Prepare for Submission" to "Waiting for Review."

### Chat 105a — App Store Review Demo Account Provisioning

*Block 13 · EO 93 · 🟢 · Skills: — · ⚠️ 🚧 · Window N · CD-flags: —*

**Load at session start:** Chat 035 (onboarding flow, resolves to 035-W); chat 048 (seed migrations); chat 081 (subscription state machine).

**Goal:** Provision TWO fully-seeded demo accounts that Apple App Store reviewers can use to evaluate the application without needing real Google credentials, real medications, or real billing data. Without these, the reviewer hits the sign-in screen, cannot proceed past Google OAuth (which requires a real Gmail), and rejects the submission for being unreviewable. Two accounts are provisioned because the iOS purchase flow and the web purchase flow exercise different paid-state surfaces; documenting both gives reviewers a path for whichever surface they choose to evaluate.

**Output:**
- Demo account ONE — iOS: `vesper.review.ios@anthropic-vesper.test` created via the Supabase Auth admin API with a known password; an Apple StoreKit sandbox subscription provisioned via App Store Connect's sandbox tester flow; this is the primary account documented for the App Review reviewer flow
- Demo account TWO — web: `vesper.review.web@anthropic-vesper.test` created via the Supabase Auth admin API with a known password; a Stripe test-mode subscription provisioned via the Stripe Customer Portal in test mode; documented as a backup for any web-flow review path
- Both accounts walked through onboarding by the same idempotent script to populate `user_profiles` with a mixed-archetype configuration that exercises all seven modules
- Seed data on both accounts: a stubbed Google Calendar integration with a static event set (work events, a recurring weekly class, two upcoming appointments), three medications with realistic times, two bills with future due dates, two recurring errands, three pending tasks with mixed priority, and a prior week of completed plans showing completion history
- The paid-state UI surfaces are source-aware: on the iOS demo account, the billing section shows a "Manage via Apple Settings" CTA reflecting the Apple-managed source; on the web demo account, the billing section shows a "Manage via Customer Portal" CTA reflecting the Stripe-managed source. The UI surface follows the actual purchase source on each account so reviewers see authentic flows
- Both sets of credentials documented in the App Store Connect "App Review" notes field along with a 30-second walkthrough video showing the primary user flow
- `docs/APP_REVIEW_DEMO_ACCOUNT.md` capturing both sets of credentials, the seed data, and the refresh procedure (both accounts re-seeded before every submission via the same script)

**Implementation notes:** The demo accounts are critical because Apple reviewers cannot complete real OAuth flows; without credentialed accounts they have no way past the sign-in screen, and the rejection reason will be "unable to evaluate." The seed walkthrough script is idempotent so it can be re-run before every submission to reset both accounts to a known good state; it must be tested before C-21 so the seed data is known-good for the App Store Review pass. The subscriptions are sandbox (Apple) and test-mode (Stripe); both are appropriate for App Review and do not consume real funds. This chat authors no new user-facing butler copy (provisioning and seeding), so it shows `Skills: —` and carries no 🎩. **Risk note:** this chat (EO 93) is ⚠️ in the prior plan and the Risk Map (without working demo credentials the rejection reason is "unable to evaluate" and the resubmission cycle costs 1-3 days) [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN.md]. Carries 🚧. **Sequencing note:** its EO (93) sits earlier in the order than chat 105 (EO 105) despite the 105a number, because the seeded reviewer accounts must exist before submission; the master table is canonical for sequencing and the chat-number order is for readability only [doc:PHASE_4_BUILD_PLAN_part1.md].

**Dependencies:** Chats 035 (resolves to 035-W, EO 53), 048 (EO 28), 081 (EO 38). All at lower EO. No later-EO hard dependency. Carries 🚧.

**End-of-session checks:** Both demo accounts' credentials work for sign-in. Each account renders a populated day view with all seven modules visible. The paid-state UI on each account reflects the correct subscription source (Apple CTA on iOS, Stripe CTA on web). The walkthrough video is recorded and stored.

### Chat 105b — App Store Review Rejection Response (Conditional)

*Block 13 · EO 106 · 🟢 · Skills: — · 🚧 · Window N · CD-flags: —*

**Load at session start:** Chat 105 (initial submission); the specific rejection feedback from Apple if rejection occurs.

**Goal:** This chat runs only if Apple rejects the initial submission. Read Apple's specific rejection feedback, diagnose the issue, fix the root cause, and resubmit. Apple commonly rejects first submissions for sign-in flow issues, screenshot mismatches, metadata text concerns, or missing demo-account documentation; the response process for each is well-trodden but cannot be predicted in advance.

**Output:**
- The rejection reason documented in `docs/APP_STORE_SUBMISSION.md`
- The fix implemented (code change, metadata edit, or screenshot replacement as appropriate)
- A response message to App Review explaining the fix, sent through App Store Connect
- A resubmitted build if the fix required a code change; metadata-only fixes do not require a new build
- The new submission status tracked in the same document

**Implementation notes:** Common rejection categories and their responses: guideline 4.8 sign-in compliance (handled by chats 010, 011 enabling Apple Sign In; should not recur but if it does, the fix is verifying the Apple Sign In button is functional and prominent); guideline 5.1.1 privacy (handled by chats 102, 041 PostHog masking; if it recurs, the response audits the App Privacy questionnaire against the actual data flows); guideline 2.1 information needed (handled by chat 105a demo account; if it recurs, the response provides additional walkthrough material). The typical resolution cycle is 1-3 days per round; budget two rounds before approval. This chat may not be needed if the initial submission is accepted directly. It authors no new user-facing butler copy (rejection diagnosis and resubmission), so it shows `Skills: —` and carries no 🎩. This chat (EO 106, the last position in the order) carries no ⚠️ symbol in the prior-plan meta line, so this entry carries no ⚠️. Carries 🚧 (it acts on a Cutover-gated submission). It is conditional — it runs only on rejection.

**Dependencies:** Chat 105 (initial submission), conditional on rejection. At lower EO. No later-EO hard dependency. Carries 🚧.

**End-of-session checks:** The rejection feedback is fully addressed. The resubmission moves back to "Waiting for Review."

---

## Cutover Block

The Cutover Block is the sequence of thirty-one manual founder actions — twenty-nine integer-numbered steps C-01 through C-29 plus two letter-suffix steps C-22a and C-27a — that must complete before the chats marked 🚧 can ship [doc:PHASE_4_BUILD_PLAN_part1.md]. It is not a Claude Code session; the founder performs each step by hand. Some steps were submitted in Chat 001 (Apple Developer enrollment, Stripe identity verification) and reach activation here; others are net new at this point. The reorder does not alter any Cutover step number: every C-NN identifier below is immutable, because the Critical Path and the per-chat 🚧 gating both reference these numbers [doc:PHASE_4_BUILD_PLAN_part1.md].

The steps are sequential and order-dependent. Each step has dependencies on prior steps; skipping or reordering produces hard-to-diagnose production issues. The chats whose rendered meta lines in parts 2–9 carry 🚧 — 065, 077, 078, 080, 085, 086, 087, 088, 102, 103, 104, 105, 105a, and 105b — cannot run until the integer-numbered prerequisites named in their own dependency lines have cleared; the Cutover/chat sequencing relationship is stated canonically in the Critical Path section below. (The prior plan's Critical Path prose enumerated a slightly different Cutover-gated set; that divergence is recorded and flagged in the Critical Path section and in the Closing Notes, not patched here.)

### C-01: Purchase the production domain

Register `vesper.day` (or one of the documented alternatives if `vesper.day` is unavailable: `vesper.studio`, `vesper.house`). Use Cloudflare Registrar if possible (no markup over wholesale; native integration with the rest of the Cloudflare stack). The cost is approximately $11 per year. After purchase, confirm DNS hosting is set to Cloudflare's nameservers.

### C-02: Configure Vercel custom domain

In the Vercel dashboard for the production project, add `vesper.day` as a custom domain plus the `www.vesper.day` redirect. Vercel produces the required DNS records (one A record for the apex pointing at Vercel's IP, one CNAME for the www subdomain). Add these records in Cloudflare DNS. DNS propagation takes from minutes to hours; verify with `dig vesper.day` before proceeding.

### C-03: Bind Cloudflare Workers to vesper.day subdomains

For each Cloudflare Worker deployed, configure a custom route under the production domain (e.g., `stripe-webhook.vesper.day`, `apple-assn.vesper.day`, `live-activity-pusher.vesper.day`). The `wrangler.toml` for each worker is updated with the route. The DNS records required (CNAME pointing at the worker subdomain) are added in Cloudflare DNS.

### C-04: Apple Developer Program enrollment activates

The enrollment submitted in Chat 001 should be active by this point. Confirm in the Apple Developer dashboard that the account shows "Active" status and the membership renewal date is approximately one year out. If the enrollment has not activated, contact Apple Developer Support; the typical activation time is 24-48 hours, though some enrollments take a full week.

### C-05: Create Apple App ID with all required capabilities

In the Apple Developer Portal, create an App ID with the bundle identifier `com.vesper.app`. Enable the following capabilities: Push Notifications, Sign In with Apple, App Groups, and Live Activities. Each capability is a checkbox that requires the App ID to be re-saved. As a sub-step of enabling App Groups, register the App Group identifier `group.com.vesper.app` and select it on the App ID; this identifier is required by chat 077's widget extension and by the keychain-sharing configuration in chats 011 and 013, and both targets (main app and widget extension) reference the same identifier. Note that Live Activities is a relatively new capability; verify it appears in the list.

### C-06: Generate provisioning profile with Live Activities enabled

In the Apple Developer Portal, create a provisioning profile for the App ID with Live Activities capability enabled. Download the profile and provide it to EAS via `eas credentials`. Without this, the production build will not include the Live Activity entitlement and the widget extension will not function on real devices.

### C-07: Generate APNs authentication key

In the Apple Developer Portal under Keys, generate a new APNs Authentication Key. Download the `.p8` file. Capture the Key ID (displayed on the key detail page) and the Team ID (in the membership details). Both values are required for the live-activity-pusher worker to sign JWTs.

### C-08: Populate APNs secrets in Cloudflare Workers

For each Cloudflare Worker that signs APNs JWTs (live-activity-pusher and apns-token-cleanup primarily), set the following secrets via `wrangler secret put`: `APNS_PRIVATE_KEY` (the contents of the `.p8` file), `APNS_KEY_ID` (the captured Key ID), `APNS_TEAM_ID` (the captured Team ID). Verify the secrets are set by listing them via `wrangler secret list`. The shared-secret `LIVE_ACTIVITY_TRIGGER_SECRET` used by the immediate-trigger HTTP endpoint is provisioned adjacent to this step (referenced by chats 027 and 029, which call the endpoint after PATCH /blocks and POST /plans/:date/reorder) [doc:PHASE_4_BUILD_PLAN.md].

### C-09: Configure Apple Sign In

In the Apple Developer Portal, create a Services ID with Sign In with Apple enabled. Configure the redirect URI as `https://vesper.day/auth/callback`. Generate a Sign In with Apple authentication key. Populate the environment variables `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` in Vercel for the web application's production environment.

### C-10: Create App Store Connect app record

In App Store Connect, create a new app record with the bundle identifier `com.vesper.app` (which must match the Apple Developer Portal entry from C-05). Set the primary locale to English (US). Set the app's name to "Vesper" (or the chosen final brand name if "Vesper" is taken on the App Store).

### C-11: Create subscription product in App Store Connect

In App Store Connect, navigate to the app's In-App Purchases section and create a subscription product with the identifier `com.vesper.standard.monthly`. Set the price to $19.99 USD via App Store Connect's current pricing UI (Apple deprecated numbered price tiers in 2023; the current UI accepts a direct price selection from the supported price-point list — choose $19.99 USD from the price-point dropdown for the Monthly auto-renewable subscription). Set the subscription duration to 1 month. Set the family sharing option to OFF (Vesper is single-user). Configure the localized display name and description for the App Store presentation.

### C-12: Enroll in Apple Small Business Program

In App Store Connect, navigate to Agreements, Tax, and Banking and enroll in the Small Business Program. This reduces Apple's commission from 30% to 15% as long as the developer's calendar-year App Store proceeds remain under $1M USD; the reduction applies indefinitely under the cap, not just for the first year. Developers who exceed $1M in a calendar year exit the program for the remainder of that year plus the following year, then can re-enter when proceeds fall back below the cap. New developers qualify automatically (Vesper qualifies on this basis), but enrollment is NOT automatic — Apple reviews each enrollment, and the 15% rate begins 15 days after the end of the fiscal month in which Apple approves the enrollment (so the gap between submission and 15% can be 0–~45 days depending on timing). Enroll as early as possible after C-10 to ensure approval lands before C-21 (Stripe production keys) opens the door to paying transactions; any iOS transactions during the gap are billed at 30%. Verify approval status in App Store Connect before proceeding to C-21.

### C-13: Configure App Store Server Notifications V2 webhook URL

In App Store Connect, navigate to App Information and configure the production URL for App Store Server Notifications V2 (the URL of the apple-assn worker from chats 087 and 088, which is `https://apple-assn.vesper.day` after step C-03). Save the configuration. App Store Connect sends a test notification immediately to verify the URL; the worker must respond 200 to confirm.

### C-14: Family Sharing OFF verification

Verify that the Family Sharing setting on the subscription product is set to OFF (from step C-11). This is a separate verification because if it is mis-configured, multiple users can share one subscription, which is not the intended monetization model for Vesper.

### C-15: Production environment URL

In Vercel's production environment, set `NEXT_PUBLIC_APP_URL` to `https://vesper.day`. This is referenced throughout the application code (in OAuth callback URLs, Stripe Checkout success URLs, email link generation, and elsewhere). The application's behavior in production depends on this value being set correctly before deploy.

### C-16: Google OAuth production redirect URI

In Google Cloud Console for the Vesper OAuth client, add `https://vesper.day/auth/callback` as an authorized redirect URI. Without this, Google OAuth in production rejects callback requests with an "unauthorized redirect URI" error. The development redirect URI (`http://localhost:3000/auth/callback`) can remain alongside the production URI.

### C-17: Google Site Verification

In Google Search Console, add `vesper.day` as a property and verify ownership via the DNS TXT record method. Add the verification TXT record in Cloudflare DNS. This is required for Google Calendar push webhook channel registration (chat 065); without site verification, Google rejects watch requests for the domain. Chat 065 carries 🚧 in its rendered meta line [doc:PHASE_4_BUILD_PLAN_part7.md] precisely because its channel registration cannot succeed until this Cutover step clears.

### C-18: Supabase Auth site URL configuration

In the Supabase project dashboard, navigate to Authentication > URL Configuration and set the site URL to `https://vesper.day`. Add the same URL to the redirect allow-list. Also add `https://vesper.day/auth/callback` and `vesper://auth/callback` (the mobile deep link) to the allow-list. Without these, Supabase Auth rejects callbacks from production.

### C-19: Stripe identity verification activates

The Stripe identity verification submitted in Chat 001 should be active by this point. Confirm in the Stripe dashboard that the account shows "Verified" status and that payouts are enabled. If verification is still pending, contact Stripe support; the typical resolution time is 1-3 business days, though some accounts take longer.

### C-20: Configure Stripe production webhook endpoint

In the Stripe dashboard, navigate to Developers > Webhooks and add a new endpoint for the production environment pointing at the stripe-webhook worker URL (`https://stripe-webhook.vesper.day` after C-03). Subscribe to the events from chat 084: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.trial_will_end. Capture the new `STRIPE_WEBHOOK_SECRET` (this is different from the test mode secret). Set this secret in the stripe-webhook worker via `wrangler secret put`.

### C-21: Swap Stripe test keys to production keys

In Vercel's production environment and in the Cloudflare Workers' secrets, swap the Stripe test publishable key (`pk_test_*`) with the production publishable key (`pk_live_*`) and the test secret key (`sk_test_*`) with the production secret key (`sk_live_*`). Verify by initiating a test Checkout in production and confirming the Stripe-hosted page shows live mode. Do not check this in any environment that mixes test and live data; one or the other.

### C-22: Resend domain authentication

In the Resend dashboard, add `vesper.day` as a sending domain. Resend produces the required DNS records (SPF TXT record, DKIM TXT record, and a DMARC TXT record). All three records — SPF, DKIM, and DMARC — are REQUIRED at Cutover (DMARC is no longer optional). Add all records in Cloudflare DNS. Verify the domain in Resend; verification takes from minutes to hours depending on DNS propagation. Without these records, emails sent from `noreply@vesper.day` will be flagged as spam by most major email providers, and without DMARC specifically, Gmail and Yahoo enforcement policies reject bulk sends from the domain outright.

### C-22a: Marketing subdomain DNS provisioning

In Resend, add the marketing subdomain `mail.vesper.day` as a separate sending domain (Resend supports multiple verified domains per account). In the DNS provider (the same registrar used for `vesper.day`), add the SPF, DKIM, and DMARC records that Resend emits for `mail.vesper.day`. Wait for verification (typically 5-30 minutes; can be up to 24 hours for some registrars). The transactional sender `noreply@vesper.day` continues to send auth emails, trial reminders, dunning notices, and account notifications. The marketing sender `noreply@mail.vesper.day` sends waitlist nurture, launch-day announcements, and post-cancel surveys. This subdomain isolation protects transactional email deliverability — if marketing emails ever get flagged for spam, the damage is contained to the marketing subdomain's reputation and the auth/transactional sending continues to work.

Verification: send a test email from `noreply@mail.vesper.day` to a personal Gmail address; confirm it arrives, confirm SPF/DKIM/DMARC pass (visible in the Gmail "Show original" panel), confirm the rDNS resolves correctly.

Prerequisite: C-22 (transactional `vesper.day` domain authenticated). No subsequent integer-numbered step depends on C-22a directly; Chat 092 (marketing email templates) consumes this sender at build time.

### C-23: Host apple-app-site-association file

Place the `apple-app-site-association` file (prepared in chat 011 as a template) at the production URL `https://vesper.day/.well-known/apple-app-site-association`. The file is JSON and must be served with the `application/json` content type (Vercel handles this automatically for files in the `public/.well-known/` directory). Replace the placeholders in the template with the production Team ID and bundle identifier `com.vesper.app`. Verify by curling the URL; the response should be the JSON content with the correct headers. Additionally, run `curl https://vesper.day/.well-known/apple-app-site-association | jq '.applinks.details[0].appID'` and assert the output exactly matches `<production-team-id>.com.vesper.app`; a mismatch (typically caused by the dev build being signed with a different Team ID than the production cert) silently breaks Universal Links and cannot be detected after the fact except by user reports.

### C-24: Production smoke test

Execute the end-to-end smoke test against production: create a new user via Google OAuth on vesper.day, complete onboarding through the trial confirmation, observe the first plan being generated, mark a block complete via the day view, initiate a subscription Checkout flow, and verify the subscription_status transitions to active. The smoke test no longer requires a real card refund: use a Stripe test card if Stripe production is still in verification (C-20 not yet active), document the result, and re-run the test with a real card after Stripe verification completes — the post-verification re-run is the canonical smoke test, the pre-verification run is a structural-only check. If any step fails, do not proceed to App Store submission until resolved.

### C-25: Upstash Redis production provisioning

In the Upstash dashboard, create a production Redis database in the region nearest the primary Vercel deployment region. Capture `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Set both as environment variables in the Vercel production environment (rate limiting and idempotency lock from chats 009 and 025 read them) and as Cloudflare Worker secrets in every worker that uses Upstash for rate limiting, idempotency, or the per-user circuit breaker — set via `wrangler secret put UPSTASH_REDIS_REST_URL` and `wrangler secret put UPSTASH_REDIS_REST_TOKEN` in each worker's directory. Verify connectivity from a test request before proceeding.

### C-26: PostHog production project setup

In PostHog, create a production project. Capture the project API key (used by the client SDK in web and mobile) and the personal API key (used for source map upload and dashboard sharing). Set the project API key as `NEXT_PUBLIC_POSTHOG_KEY` in Vercel production environment and in the mobile app config (`app.config.js` extra). Set the personal API key as `POSTHOG_PERSONAL_API_KEY` in Vercel (Sentry-PostHog integration and source map uploader read it). Verify by emitting a test event from each surface.

### C-27: Sentry production project setup for web, mobile, and workers

In Sentry, create three production projects: `vesper-web`, `vesper-mobile`, and `vesper-workers`. Capture each project's DSN and the source map upload token. Set the DSNs as `SENTRY_DSN` in the Vercel production environment (web), the mobile app config (mobile), and as Cloudflare Worker secrets in each worker (workers). Set the source map upload tokens as `SENTRY_AUTH_TOKEN` in the CI environment for the relevant CI workflows (`.github/workflows/sentry-release.yml` from chat 002). Verify by triggering a deliberate test error in each runtime and confirming Sentry captures it with a symbolicated stack trace.

### C-27a: Daily-cron consolidated worker deploy and schedule verification

Deploy `workers/daily-cron` to Cloudflare Workers Paid with the `wrangler deploy` command from the worker's directory. The `wrangler.toml` for this worker contains the consolidated cron schedule covering all modules: hour-of-UTC ticks for the per-user-local dispatch modules (trial-reminder at 8am UTC reading per-user local-time filter; bill-reminder at every-hour-of-UTC reading per-user local-9am filter; dunning-check at 8am UTC), fixed-UTC ticks for the system-time modules (hard-delete at 2am UTC, reconciliation at 3am UTC, apns-token-cleanup co-scheduled with bill-reminder, spend-monitor at 8am UTC), the 5am UTC tick for gcal-channel-renewal, and any module-specific health-check sub-schedules. Verification: from the Cloudflare Workers dashboard, confirm the worker shows as deployed at the expected version; open the cron-triggers panel and confirm the schedule list matches the wrangler.toml declaration; manually trigger a dry-run of each module via the worker's `/dispatch?module=NAME&dryrun=true` endpoint (the daily-cron worker exposes this for operational verification) and confirm each module's dry-run returns 200 OK with the expected log lines in the Cloudflare logs. Prerequisite: all secrets the worker reads (Anthropic API key, Resend API key, Supabase service role key, Stripe secret key, APNS_PRIVATE_KEY, APNS_KEY_ID, APNS_TEAM_ID, LIVE_ACTIVITY_TRIGGER_SECRET) are set via `wrangler secret put` before this step. No subsequent integer-numbered Cutover step depends on C-27a directly, but the daily-cron worker must be live before App Store submission (C-23 onwards) so users created during alpha/beta have their trial-reminder and bill-reminder modules dispatching correctly.

### C-28: Deploy apple-pki-monitor worker

Deploy the `apple-pki-monitor` Cloudflare Worker authored in chat 086a. Verify the first scheduled cron run executes successfully and (in the no-impending-expiry case) emits no alert; if any alert fires on the first run, investigate the pinned root certificate state before submitting to App Store Review. This worker is the early-warning system for Apple Root CA expiry, and it MUST be active before App Store submission — without it, the team has no operational signal for the silent-breakage failure mode where Apple receipt verifications start failing on a long-tail expiry date.

### C-29: Stripe Apple Pay domain verification

Stripe Apple Pay on the web is enabled at V1; this step provisions the domain verification file Apple requires. Download the verification file from the Stripe dashboard (Settings → Payments → Apple Pay → Add new domain) and host it at `https://vesper.day/.well-known/apple-developer-merchantid-domain-association` (place the file under `apps/web/public/.well-known/` and deploy). In the Stripe dashboard, add `vesper.day` as a registered domain and trigger the verification check; Stripe pings the well-known URL and marks the domain verified on success. Confirm Apple Pay surfaces correctly in a test Stripe Checkout session on a real Safari + iCloud-signed-in iPhone — the Apple Pay button must appear in the Checkout payment-method picker. Without this step, web users see Stripe Checkout without an Apple Pay option, and the day-6 one-tap pay flow from chat 089 cannot use Apple Pay on web.

---

## Risk Map

The chats below carry elevated risk and require multiple iterations if needed and no shortcuts. Each is flagged with ⚠️ in its rendered meta line in parts 2–9; this map provides the prose explanation of why each chat is risky. The membership below is regenerated from the rendered chat headers across parts 2–9 as the source of truth [doc:PHASE_4_BUILD_PLAN_part1.md], rather than from memory.

**Risk-flagged chats, by rendered meta line:** 004, 005, 006, 014, 017, 019, 022, 025, 027, 037, 038, 043, 049, 051, 052-W, 053, 058, 059b, 060, 063, 067, 071, 073, 074, 077, 078, 080, 081, 082, 084, 086, 087, 088, 093-V, 098, 105, 105a [doc:PHASE_4_BUILD_PLAN_part4.md][doc:PHASE_4_BUILD_PLAN_part5.md][doc:PHASE_4_BUILD_PLAN_part6.md][doc:PHASE_4_BUILD_PLAN_part7.md][doc:PHASE_4_BUILD_PLAN_part8.md][doc:PHASE_4_BUILD_PLAN_part9a.md][doc:PHASE_4_BUILD_PLAN_part9b.md].

**Chat 004 — Migrations Part 1.** The first migrations establish the foundation tables. Errors here cascade through every subsequent chat because every API route depends on the Drizzle types generated from the schema. The risk is missing a column that a Tech Spec §9 API contract references; this is mitigated by the column audit in chat 006.

**Chat 005 — Migrations Part 2.** Same risk profile as chat 004 plus the additional risk of the security_audit_log trigger functions being mis-configured (specifically, missing SECURITY DEFINER or the wrong search_path). Mis-configured audit triggers either fail silently (no audit trail) or leak data via search-path injection.

**Chat 006 — First supabase db push plus Drizzle sync plus Zod plus RLS audit.** The most consequential chat in Block 1 because the database deployment is the point of no return for the schema. Errors discovered here are easier to fix than errors discovered after dozens of subsequent chats have been built against the schema.

**Chat 014 — Security headers and CSP for web.** The CSP is uniquely risky because it can be either too restrictive (breaking features in subtle ways) or too permissive (defeating its security purpose). The risk is compounded by the fact that CSP violations may not surface until specific third-party integrations are tested.

**Chat 017 — Butler voice gate.** The voice gate is the gate every subsequent user-facing copy chat must pass through. Bugs here mean either false positives (rejecting valid copy) or false negatives (allowing prohibited copy through), both of which degrade quality.

**Chat 019 — Layer 1 system prompt and DailyPlan JSON schema.** The highest-impact single chat in Phase 4. Plan quality is largely determined by this prompt. Iterations are essential; the eval harness from chat 020 should be re-run against any meaningful change.

**Chat 022 — synthesizePlan and fallback chain.** The fallback chain is non-trivial; bugs result in either the application silently failing without fallback (a blank plan view) or the fallback running when the primary call would have succeeded (degraded plan quality with no user notification). At EO 27 it runs after the chat-019 prompt audit folded into chat 112 (EO 5), so the prompt it synthesizes against is the audited, module-conditioned one [doc:PHASE_4_BUILD_PLAN_part1.md].

**Chat 025 — Plan generation API with streaming and idempotency.** The streaming behavior plus the idempotency lock plus the atomic write make this one of the most architecturally complex API routes. Errors include the lock not being released on failure (preventing future generations) or the atomic write being non-atomic (resulting in orphan blocks). It consumes carried-forward flag F1 (the `daily_plans` draft/approved-state question) at EO 34 [doc:PHASE_4_BUILD_PLAN_part1.md].

**Chat 027 — Block APIs with optimistic concurrency.** The optimistic concurrency check is the resolution to Open Question 2 from Tech Spec §14. Bugs result in silent data corruption: two devices' edits being applied in the wrong order with no toast notification.

**Chat 037 — Supabase Realtime client setup.** Realtime is genuinely hard to get right; reconnection logic, self-mutation filtering, and lifecycle management are all subtle. Bugs result in the user seeing stale data or seeing their own edits echo back.

**Chat 038 — TanStack Query offline mutation queue.** Similar risk profile to chat 037 plus the additional complexity of persistence on mobile and conflict resolution on reconnect.

**Chat 043 — Block drag-and-drop reorder.** The hardest UI interaction in the application; combines drag-and-drop with optimistic concurrency with accessibility (keyboard reorder for screen readers).

**Chat 049 — Fitness module: selection, adaptation, UI.** The Sonnet contextual adaptation prompt is one of the harder secondary AI prompts; it must produce structurally-correct output while modifying a template's parameters meaningfully. The chat is ⚠️ (EO 64); elevated-risk handling (extra iterations) applies.

**Chat 051 — Meal planning and grocery list.** The weekly Sonnet meal synthesis must produce a coherent week's worth of meals, not just seven independent days. Coherence is hard to achieve via prompting alone.

**Chat 052-W — Built-in calendar library evaluation and web implementation (052-V folded in).** Library choice is hard to reverse. FullCalendar versus react-big-calendar is a real decision that affects every calendar surface forward. The master table folds 052-V into 052-W as a single chat (EO 41); the calendar chrome was deferred from the design-cluster window per Stage 2 §5 and rebuilt here composing the 107/107a primitives [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Chat 053 — Built-in calendar mobile implementation.** RRULE recurrence on react-native-calendars is the open question; if the library does not support it natively, the in-app expansion pattern adds complexity.

**Chat 058 — Weekly planning steps 4 and 5.** The Sonnet weekly template generation is the most complex AI call in the application; it produces seven days of plans simultaneously with priority threading. The chat is ⚠️ (EO 69); elevated-risk handling (extra iterations) applies.

**Chat 059b — iOS alarm screen.** Native iOS work via Notification Service Extension is unfamiliar territory for most Expo developers and requires Xcode debugging. the build track owns this native Swift surface (built from the 107 visual spec, not by the design track) per Stage 2 §1; it is build-track native work [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Chat 060 — Medications module.** Medication data is the most sensitive in the application; RLS errors here are breach-class incidents. It consumes carried-forward flag F2 (the medications quiet-hours / fire-on-time default) at EO 54, which chat 111 reads first [doc:PHASE_4_BUILD_PLAN_part1.md].

**Chat 063 — Google Calendar OAuth, pgsodium encryption, key rotation runbook.** Token encryption is security-critical. The runbook is non-negotiable; rotating the encryption key without a runbook is improvising under pressure. It moves earlier on the build spine (EO 37) because the onboarding calendar branch in 034-W hard-depends on the full integration flow; see the Critical Path section's 063 → 064 → 034 note.

**Chat 067 — Google Calendar conflict resolution.** The silent-removal-plus-prompt model is subtle; bugs result in either over-aggressive removal (the user loses blocks they wanted to keep) or under-aggressive (conflicts go unresolved).

**Chat 071 — Cache pre-warm worker.** Timezone-aware queries plus tight CPU limits make this worker harder to write correctly than it appears.

**Chat 073 — Hard-delete worker.** Irreversible operations always require additional care. The cascade verification script is the safety net. Its end-active-Live-Activities-before-cascade step requires chat 080 (Block 10) to have landed first.

**Chat 074 — Reconciliation worker.** Cross-provider state precedence rules are subtle. Bugs result in users with the wrong subscription_status, which manifests either as locked-out paying users or unlocked non-paying users. Its logic completes only after chats 084, 087, and 088 from Block 11 land (EO 92, after EO 75/78/79); see the Critical Path section's 074 → 084/087/088 note.

**Chat 077 — SwiftUI Live Activity widget extension setup.** Manual Xcode work outside Expo's automation. Configuration errors result in build failures or runtime failures that are hard to diagnose. the build track owns this native surface per Stage 2 §1; it carries 🚧 in its rendered meta line and cannot ship until Cutover provisions the App Group, provisioning profile, and APNs key [doc:PHASE_4_BUILD_PLAN_part7.md].

**Chat 078 — SwiftUI Live Activity widget UI.** SwiftUI itself is a learning curve for developers used to React Native. The widget's three view variants must each render correctly and respect the design tokens emitted as `DesignTokens.swift` from chat 107. Native build-track ownership; carries 🚧.

**Chat 080 — Live Activity pusher worker with immediate-trigger path.** APNs JWT signing is non-trivial. The chain-to-next-block logic is subtle. Carries 🚧 because the immediate-trigger path and APNs signing depend on Cutover-provisioned secrets.

**Chat 081 — Subscription state machine module.** Wrong state transitions translate to revenue loss or locked-out paying users.

**Chat 082 — Read-only mode enforcement.** Cross-cutting changes that touch every mutation API and every UI surface. Easy to miss a route.

**Chat 084 — Stripe webhook handler.** Signature verification using raw body plus idempotency plus state transitions. Errors result in lost webhook events (and thus lost or duplicated state transitions).

**Chat 086 — Apple receipt verification.** JWS verification against rotating Apple keys. Errors result in accepting invalid purchases or rejecting valid ones. Carries 🚧.

**Chat 087 — Apple Server Notifications V2 worker part 1.** Five distinct notification types with state machine integration. Carries 🚧.

**Chat 088 — Apple Server Notifications V2 worker part 2.** Ten more notification types. Coverage of all fifteen is required for correct subscription state. Carries 🚧.

**Chat 093-V — Waitlist landing page with Three.js cinematic (visual / static).** Performance-sensitive brand-defining surface. Slow rendering on mobile devices destroys conversion. The risk lives on the design-track visual/static half (EO 15, Window Y, Fwin F4), which builds the five-section page and the Three.js cinematic hero on canned templates with no account; the wiring half (093-W) only attaches the signup POST to chat 031 and carries no ⚠️ [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Chat 098 — Butler voice gate end-to-end sweep.** A miss here results in brand contamination at launch (prohibited copy reaching users).

**Chat 105 — TestFlight build and Live Activity end-to-end verification and App Store submission.** The final gate before launch. Failed verification means resubmission after fixes. Carries 🚧.

**Chat 105a — Demo account provisioning.** Apple reviewers require credentialed accounts to evaluate the app behind sign-in. Without working demo credentials, the rejection reason is "unable to evaluate" and the resubmission cycle costs 1-3 days. The chat ships a seed walkthrough script that re-runs idempotently before every submission; the script must be tested before C-21 so the seed data is known-good for the App Store Review pass. Carries 🚧.

**Flagged Risk-Map discrepancies (recorded, not reconciled).** The prior `PHASE_4_BUILD_PLAN.md` Risk Map additionally listed Chat 086a (Apple PKI monitor), Chat 097a (operational alerting and spend monitoring), and Chat 101 (accessibility and performance audit) as ⚠️ chats, each with a rationale [doc:PHASE_4_BUILD_PLAN.md]. The rebuilt chat headers do not carry ⚠️ for any of these three: 086a renders without ⚠️ in part 8, and 097a and 101 render without ⚠️ in parts 9a and 9b respectively [doc:PHASE_4_BUILD_PLAN_part8.md][doc:PHASE_4_BUILD_PLAN_part9a.md][doc:PHASE_4_BUILD_PLAN_part9b.md]. Per the flag-rather-than-reconcile rule, the divergence between the prior plan's Risk Map membership and the rendered headers is recorded here and left unpatched; these three are therefore not members of the re-plan's ⚠️ set. The prior rationales remain available in the prior plan and are not re-asserted as current risk membership.

---

## Parallelization Map

The chats below can run concurrently on separate Claude Code terminals. The arrows indicate parallelization opportunities; chats that share a parallelization arrow can run in any order or simultaneously. The seven pairings carried as explicit ⇄ partner flags in the rendered meta lines are 010 ⇄ 011, 012 ⇄ 013, 025 ⇄ 026, 027 ⇄ 028, 030 ⇄ 031, 039 ⇄ 040, and 049 ⇄ 050 [doc:PHASE_4_BUILD_PLAN_part3.md][doc:PHASE_4_BUILD_PLAN_part4.md][doc:PHASE_4_BUILD_PLAN_part5.md][doc:PHASE_4_BUILD_PLAN_part6.md]. The block-level concurrency is described below, updated for the reorder without altering any chat number.

Above the block structure sits the re-plan's two-track axis: the design (F) track and the build (B) track run in parallel across the same calendar [doc:PHASE_4_BUILD_PLAN_part1.md]. The fifteen window chats form a self-contained F-track chain (106 → 107 → 107a, then the `-V` halves and 108a/089-V/095-V) that runs start-to-finish while the build track works the backend spine; no window chat depends on any unbuilt build-track chat, so the two tracks never block each other inside the window [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

**Design Cluster:** 106 → 107 → 107a, sequential on the design track (each depends on the prior). They precede every screen chat and every `-V` half by construction.

**Butler's Notebook:** 108 (build track, EO 12) runs ahead of 108a (F track, EO 24) so the visual card has a real API to wire against later; the two are not parallel because 108a's wiring half depends on 108, though the static card surface is built in the window independent of 108's completion [doc:PHASE_4_BUILD_PLAN_part2.md].

**Block 0:** Sequential. Chat 001 must complete first; chats 002 and 003 follow in order. (Carried as completed foundation work; EO — in the master table.)

**Block 1:** Mostly sequential. Chat 004 must complete before chat 005, which must complete before chat 006. Chat 007 follows 006. Chat 111 (new, EO 4) runs early as a cheap, high-unblock schema/Zod fix and reads flags F1/F2/F3 against the committed migrations before later chats consume them [doc:PHASE_4_BUILD_PLAN_part2.md].

**Block 2:** 010 and 011 (web and mobile auth) parallel (⇄). 012 and 013 (web and mobile shell) parallel (⇄). 014 follows 012. 015 (build gate) follows all of the above.

**Block 3:** 016 first. 017 follows 016. 018 and 019 can run in parallel (with 018 stubbing types from 019 until 019 lands; see the 018 → 019 back-reference in the Critical Path). 020 follows 019. 021 follows 019. 022 follows all of 017, 020, 021. 023 follows 017. Chat 112 (new, EO 5) runs before 022 to re-scope the fallback day plans and audit the chat-019 prompt (reading flag F4) so 022 synthesizes against the audited prompt [doc:PHASE_4_BUILD_PLAN_part3.md].

**Block 4:** 024 and 025 parallel. 026 follows 025 (⇄ 025 in its meta line for the retrieval-vs-generation split). 027 follows 026. 028 parallel with 027 (⇄). 029 follows 028. 030 and 031 parallel after 024 (⇄).

**Block 5:** Each screen chat is split into a design-track visual/static `-V` half (in the window) and a build-track wiring `-W` half (on the build track). The `-V` halves 032-V → 033-V → 034-V → 035-V → 036-V run in Fwin order F5–F9 inside the window, composing the 107/107a primitives; the `-W` halves slot into build-track EO order (032-W EO 46, 033-W EO 47, 034-W EO 52, 035-W EO 53, 036-W EO 63) and are sequenced by their wiring dependencies rather than by screen order [doc:PHASE_4_BUILD_PLAN_part4.md]. In particular 034-W follows 063 and 064 (Critical Path 063 → 064 → 034) and 036-W follows the real-synthesis trigger (025).

**Block 6:** 037 first. 038 follows 037. 039 and 040 parallel (⇄, web and mobile day view). 041-V is in the window (Fwin F10); 041-W (bind layouts to data) follows 039 and 040. 042 follows 041-W. 043 follows 042. 044-V is in the window (Fwin F11, the pre-agreed pressure valve); 044-W (honorific-aware selection) follows 035-W. 045 follows 044-W. 046-V is in the window (Fwin F12); 046-W (evening draft/approve loop, consuming flag F1) follows 042.

**Block 7:** 047 first. 048 follows 047. 049 and 050 parallel after 048 (⇄). 051 follows 050. 052-W (with 052-V folded in) is the calendar entry; 053 follows 052-W. 054-W (with 054-V folded in) follows 028. 055 follows 054-W. 056 follows 055 (and hard-depends on 057; Critical Path 056 → 057). 057 first for weekly planning; 058 follows 057. 059a and 059b parallel after 035-W (059b is native build-track, EO 13, pulled early). 060, 061, 062 parallel after 028.

**Block 8:** 063 first (chronologically; pgsodium runbook gate, EO 37). 064 follows 063. 065 follows 064 (carries 🚧; gated on Cutover C-17 site verification). 066 follows 065. 067 follows 064. (Chats 068, 069, 070 remain intentionally deleted per the local-intelligence removal; Block 8 runs 063 through 067 only.)

**Block 9:** Worker count is reduced by the Chat 001 Decision 20 consolidation: 071 (cache-prewarm, HTTP-triggered) stays separate; 072, 073, 074, 075, 066, and 097a all ship as modules under one `daily-cron` worker dispatched by hour-of-UTC; 080 (live-activity-pusher) stays separate because of its tight CPU budget and 5-minute cron cadence; 086a (apple-pki-monitor) stays separate because its weekly schedule does not compose cleanly with daily-cron's hourly dispatch model. Chat work itself still parallelizes — multiple terminals can run different chats from this block at once — but deployment converges on three workers (daily-cron, live-activity-pusher, apple-pki-monitor). 074 requires 084, 087, 088 from Block 11 to land first (Critical Path 074 → 084/087/088). 073 requires 080 from Block 10 for its end-active-Live-Activities-before-cascade step. 075's APNs cleanup module requires 080 from Block 10 (it reads the 410 Gone responses 080 logs).

**Block 10:** 076 first. 077 follows 076 (native, 🚧). 078 follows 077 (native, 🚧). 079 follows 078. 080 follows 079 (🚧).

**Block 11:** 081 first. 082 follows 081. 083 follows 081. 084 follows 083. 085 follows 081 (🚧). 086 follows 085 (🚧). 087 follows 086 (🚧). 088 follows 087 (🚧). 089-V is in the window (Fwin F14); 089-W follows 082, 083, 086, and 089-V. 090 follows 089-W. 090b (biometric lock, EO 40) runs independently after the mobile shell. (090a is deferred to V1.5 and appears only in the Deferred section.)

**Block 12:** 091 and 092 are SEQUENTIAL (not parallel): 092 establishes its component pattern from 091, so 091 must complete first. 091 itself ships BEFORE chat 072 in Block 9 because the trial-reminder module from 072 imports template components from 091 directly and TypeScript compile fails without them (cross-block dependency 091 → 072, reflected in the master table by 091 at EO 11 and 072 at EO 90) [doc:PHASE_4_BUILD_PLAN_part1.md]. 093-V is in the window (Fwin F4); 093-W wires the signup POST to 031. 094 follows 093-V (SEO/OG over the visual page). 095-V is in the window (Fwin F15); 095-W follows 031, 081, and 095-V. 096 follows the product chats. 097 follows 096. 097a follows 097.

**Block 13:** 098 follows everything. 099 and 100 parallel after 098. 101 follows 098. 101a follows the product surfaces and staging. 102 and 103 parallel after Cutover (both 🚧). 104 follows Cutover (🚧). 105 follows everything plus Cutover (🚧). 105a precedes 105 (🚧). 105b is conditional (🚧).

The practical effect of parallelization is that Block 2 can run on two terminals (web track, mobile track), the design track runs the entire window cluster concurrently with the build-track backend spine, Block 6 can run on two terminals after the shared Realtime and offline foundation, and many of the Block 7 module chats can run on three or four terminals simultaneously. The Cutover Block itself is sequential because each step depends on prior steps.

---

## Skill Invocation Map

Each chat that invokes a specific Claude Code skill is enumerated below. Skills are added to the session at the start of the chat that needs them. The lists are reconciled against the rendered chat headers in parts 2–9 as the source of truth: a chat appears in a given list if and only if its rendered meta line carries the corresponding skill flag or names the skill [doc:PHASE_4_BUILD_PLAN_part1.md].

**drizzle-best-practices (🗄️):** Chats 004, 005, 006, 048, 108, 111. Every migration-touching chat. The skill encodes correct patterns for foreign keys, RLS policies, check constraints, and the BEGIN/COMMIT wrap convention. Chats 108 (notebook migration + table + RLS) and 111 (schema/Zod stale-fixes plus the single early migration-read checkpoint) are added to this list relative to the prior plan because their rendered headers carry 🗄️ [doc:PHASE_4_BUILD_PLAN_part2.md].

**AI prompt versioning (🤖):** Chats 016, 017, 018, 019, 020, 021, 022, 023, 029, 049, 050, 051, 055, 058, 064, 071, 100, 112. Every chat that authors or modifies a prompt requires the version constant to be bumped atomically with the prompt change. Chat 112 (AI fallback re-scope plus the chat-019 prompt audit) is added relative to the prior plan because its rendered header carries 🤖 [doc:PHASE_4_BUILD_PLAN_part3.md].

**Butler voice gate (🎩, caveman + stop-slop):** Chats 010, 017, 018, 019, 023, 029, 032-V, 035-V, 036-V, 042, 044-V, 045, 046-V, 051, 056, 058, 059a, 061, 062, 067, 089-V, 090, 091, 092, 093-V, 095-V, 095-W, 098, 099, 100, 102, 103, 104, 108a, 112. Every chat that authors user-facing copy. For a split chat, the 🎩 flag and the `caveman, stop-slop` skill ride the copy-authoring half: the `-V` visual/static halves of 032, 035, 036, 044, 046, 089, and 093 author the user-facing butler copy and carry the gate, while their `-W` wiring halves add no new copy and carry no 🎩. Chat 095 is the exception where both halves author new copy, so both 095-V and 095-W carry the gate (the 095 precedent) [doc:PHASE_4_BUILD_PLAN_part9a.md]. Chat 108a (the notebook visual card) is added relative to the prior plan because it renders the inference line and the confirm/correct labels through the gate; chat 112 is added because its re-scoped fallback copy passes the gate [doc:PHASE_4_BUILD_PLAN_part2.md][doc:PHASE_4_BUILD_PLAN_part3.md].

**frontend-design:** Chats 107, 107a, 108a. This named skill is reserved for the pure design-system chats only — the design system and core primitives (107), the component library part 2 (107a), and the notebook visual card (108a) — and appears on no other block's halves [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN_part2.md]. Copy-bearing non-design-system halves use `caveman, stop-slop` instead, and halves that add no new copy show `Skills: —`.

**Flagged Skill-Map discrepancy (recorded, not reconciled).** The prior plan's Butler-voice-gate list included Chats 072 and 075 [doc:PHASE_4_BUILD_PLAN.md]. The rebuilt headers for both render with `Skills: —` and no 🎩 in part 7 [doc:PHASE_4_BUILD_PLAN_part7.md], so they are not members of the re-plan's 🎩 set. The divergence is recorded and left unpatched.

**Carried-forward baseline skills (from the prior plan, not re-derived from the re-plan meta lines).** The prior plan additionally recorded `superpowers` (TDD-focused) on the high-stakes, error-prone chats; `context-engineering-kit + caveman` as the always-on project baseline; and `stop-slop` as implicitly active on every chat with user-facing copy [doc:PHASE_4_BUILD_PLAN.md]. The re-plan's per-chat meta lines surface only the four flag-tracked skills above (🗄️, 🤖, 🎩, and the named `frontend-design`), so these baseline entries are carried verbatim from the prior plan rather than regenerated from the rendered headers; they remain in force as the project baseline.

---

## Critical Path

The critical path is the sequence of chats that must complete in order with no possible parallelization. These chats determine the minimum number of sequential Claude Code sessions required on the build track, regardless of how many terminals run in parallel. Execution order across the whole build is governed by the master reordered-sequence table's EO column, not by chat number and not by block order; this Critical Path section remains canonical for the specific late-binding back-references it has always governed [doc:PHASE_4_BUILD_PLAN_part1.md].

**Canonical late-binding back-references.** A small number of chats declare hard dependencies on later-numbered chats. This list is canonical and is restated here verbatim, re-derived against the master table:

- **Chat 018 → 019.** Chat 018 (hardcoded archetype fallback plans) hard-depends on chat 019's DailyPlan JSON schema; 018 stubs the types from 019 until 019 lands. Both are carried as built foundation (EO — in the master table) [doc:PHASE_4_BUILD_PLAN_part3.md].
- **Chat 020 → 022.** Chat 020 depends on later-numbered chat 022. 020 is built foundation (EO —); 022 sits at EO 27 [doc:PHASE_4_BUILD_PLAN_part1.md].
- **Chat 034 → 063/064.** The onboarding calendar branch in 034-W (EO 52) hard-depends on the full Google Calendar integration flow — OAuth in 063 (EO 37) and sync/refresh/classification in 064 (EO 44) — rather than a stub. The 063 → 064 → 034 ordering is load-bearing and resolves to the 034-W wiring half [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN_part5.md].
- **Chat 056 → 057.** Chat 056 (task reflow and over-commit prompt, EO 68) depends on the weekly planning steps in 057 (EO 56) [doc:PHASE_4_BUILD_PLAN_part1.md].
- **Chat 072 → 091.** Chat 072 (trial reminder module, EO 90) imports template components from 091 (EO 11) directly; TypeScript compile fails without them, so 091 ships first [doc:PHASE_4_BUILD_PLAN_part1.md].
- **Chat 074 → 084/087/088.** Chat 074 (reconciliation worker, EO 92) completes only after 084 (EO 75), 087 (EO 78), and 088 (EO 79) from Block 11 land; its module can be scaffolded earlier but its cross-provider precedence logic depends on those three [doc:PHASE_4_BUILD_PLAN_part1.md][doc:PHASE_4_BUILD_PLAN_part8.md].

A Claude Code session must consult this section before opening a chat if there is any doubt about whether its dependencies are satisfied; following chat numbers blindly produces build-order breaks at exactly these points. Each affected chat also restates this caveat inline in its Load-at-session-start or Dependencies line, so the rule is enforced at both the doc level (here) and the per-chat level [doc:PHASE_4_BUILD_PLAN_part1.md].

**The build-track critical path through Phase 4** (carried forward from the prior plan, with split-chat references resolved to the half on the spine): 001 → 002 → 004 → 005 → 006 → 007 → 008 → 017 → 019 → 020 → 022 → 025 → 026 → 037 → 038 → 039 → 041-W → 042 → 044-W → 045 → 063 → 064 → 081 → 082 → 084 → 086 → 091 → 098 → 105a → 105. That is thirty sequential chats. Chat 041 resolves to 041-W (EO 50) on the spine, because chat 042 (EO 51) requires the block-detail layouts bound to retrieved data; chat 044 resolves to 044-W (EO 59), because chat 045 (EO 60) follows the honorific-aware selection. The visual halves 041-V (Fwin F10) and 044-V (Fwin F11) sit on the parallel design track and are off the build spine.

Chat 063 (pgsodium encryption and Google Calendar OAuth) sits earlier on the build spine than its prior Block 8 position because chat 034-W now hard-depends on the full integration flow rather than a stub; chat 064 (GCal sync logic, token refresh, classification) joins the spine because 034-W's calendar branch requires the full sync behavior rather than just OAuth connection (the 063 → 064 → 034 ordering above). Chat 091 (Resend email templates part 1) is on the spine because chat 072 hard-depends on it. Chat 105a (demo account provisioning) lands just before chat 105 (App Store submission) because reviewers cannot evaluate the app without seeded credentials.

Every other chat in Phase 4 parallelizes around this spine. With three to four terminals running concurrently, total Phase 4 calendar time is approximately the spine length divided by daily session throughput, with the design-cluster window cluster running fully in parallel on the design track. The additional chats (086a, 090b, 097a, 101a, 105b) add roughly five non-critical-path sessions; 090a is deferred to V1.5 and is not part of Phase 4; 105b runs only if Apple rejects the initial submission.

**Cutover position on the critical path.** The Cutover Block sits between Blocks 11 and 12 on the critical path. The chats it gates are exactly those whose rendered meta lines carry 🚧 — 065, 077, 078, 080, 085, 086, 087, 088, 102, 103, 104, 105, 105a, and 105b — each of which cannot ship until its named integer-numbered Cutover prerequisites clear [doc:PHASE_4_BUILD_PLAN_part7.md][doc:PHASE_4_BUILD_PLAN_part8.md][doc:PHASE_4_BUILD_PLAN_part9b.md]. **Flagged discrepancy (recorded, not reconciled):** the prior plan's Critical Path prose enumerated the Cutover-gated set as 085, 086, 086a, 087, 088, 093 (production deploy), 102, 103, 104, 105a, and 105 [doc:PHASE_4_BUILD_PLAN.md]. The rendered-header 🚧 set differs — it drops 086a and 093 (neither renders with 🚧 in parts 8/9) and adds 065, 077, 078, 080, and 105b (which do render with 🚧 in parts 7/8/9b). The 🚧 flag in the rendered headers governs the gating; the prior-plan enumeration is recorded as a divergence and left unpatched.

---

## External Items Started Day 1

These items were submitted or acquired in Chat 001 because they have multi-day approval windows that would otherwise delay the Cutover Block.

**Apple Developer Program enrollment.** Submitted Day 1. Review window is typically 24-48 hours but can extend to a full week. Activation is required by Cutover step C-04.

**Stripe identity verification.** Submitted Day 1. Review window is typically 1-3 business days. Verification is required by Cutover step C-19.

**Domain registration.** Performed Day 1 if a domain choice has been made (recommended: register early to lock the chosen domain even if production deploy is weeks away). The cost is approximately $11 per year through Cloudflare Registrar. DNS propagation after registration takes minutes to hours.

**Resend domain authentication.** Started Day 1 once the domain is registered. The DNS records (SPF, DKIM, DMARC) take time to propagate; starting early ensures verification is complete before Cutover step C-22.

**Google Cloud Console OAuth consent screen.** If the application uses sensitive OAuth scopes (Vesper does not at V1; the Google Calendar scopes are non-sensitive), the consent screen requires Google review which can take weeks. At V1 this is not on the critical path; document the consideration for V1.5 if additional scopes are added.

**Expo account and EAS project initialization.** Performed Day 1. The Expo account is free; EAS project initialization is instant. Required for any mobile development thereafter.

**RapidAPI account creation for ExerciseDB.** Performed Day 1. The account is free; the API key is generated immediately. Required for chat 047 (seed sourcing).

**iPhone 14 Pro or newer hardware confirmation.** Confirmed Day 1. Live Activity testing in chat 105 requires a device with Dynamic Island, which is iPhone 14 Pro and newer. A non-Dynamic-Island iOS device (iPhone 14 or earlier) is also confirmed Day 1 for the fallback APNs push verification path in chat 105.

---

## Closing Notes

This document is the canonical reference for the Phase 4 Vesper V1 build. Each numbered chat is one Claude Code session, scoped to one coherent unit of work per Tech Spec §13. Execution order is the master reordered-sequence table's EO column in part 1, not the chat numbers and not the block order; chat numbers are immutable identifiers carried for cross-reference stability [doc:PHASE_4_BUILD_PLAN_part1.md]. The voice gate from chat 017 must be active for every user-facing copy chat that follows. The pgsodium runbook from chat 063 must exist before any production OAuth token is encrypted. The Cutover Block is sequential and order-dependent.

The re-plan sequences 109 carried-over chats (non-deferred) plus 13 split halves plus 7 new chats into 106 execution-ordered positions; the deferred V1.5 export chat 090a is excluded from the order [doc:PHASE_4_BUILD_PLAN_part1.md]. The build runs on two parallel tracks — the design track and the build track — with fifteen chats held inside the ≤11-day design-cluster window (Fwin F1–F15) and 044-V designated as the pre-agreed pressure valve, 108a as the alternate [doc:PHASE_4_BUILD_PLAN_part1.md]. Native Swift surfaces (059b, 077, 078) are built by the build track from a design-track-authored visual spec rather than by the design track [doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].

The Cutover Block contains thirty-one manual founder actions (twenty-nine integer-numbered steps C-01 through C-29 plus two letter-suffix steps C-22a and C-27a). The five V1-infrastructure additions sit at the tail of the integer range — Upstash Redis (C-25), PostHog (C-26), Sentry (C-27), apple-pki-monitor deploy (C-28), and Stripe Apple Pay domain verification (C-29) — and the two letter-suffix additions are C-22a (marketing subdomain `mail.vesper.day`, inserted between C-22 and C-23) and C-27a (daily-cron consolidated worker deploy, inserted between C-27 and C-28). No integer cascade is applied; the letter-suffix pattern preserves every cross-reference to integer step numbers.

After all chats and the Cutover steps complete, the application is submitted to App Store Review and the waitlist landing page is live on the production domain. Phase 5 covers launch coordination, App Store approval response, and the first month of operation.

**Carried discrepancies (recorded, not reconciled — do not "fix" these during assembly).**

- **093-W has no master-table row.** Its EO is left "—" and it is build-track per Stage 2 §5; it is not a master-table-sequenced entry [doc:PHASE_4_BUILD_PLAN_part9a.md][doc:PHASE_4_REPLAN_STAGE_2_REORDER.md].
- **Part 9 entry count.** The File-Split Plan in part 1 records "21 entries" for part 9 (a pre-fold/pre-split figure); the master-table-rendered count differs once folds and the missing 093-W row are accounted for. The discrepancy is flagged, not reconciled [doc:PHASE_4_BUILD_PLAN_part1.md].
- **Risk-Map membership.** The prior plan flagged 086a, 097a, and 101 as ⚠️; the rebuilt headers do not, so they are not members of the re-plan's ⚠️ set (see the Risk Map's flagged-discrepancies note).
- **Skill-Map 🎩 membership.** The prior plan listed 072 and 075 under the butler voice gate; the rebuilt headers render both with `Skills: —` and no 🎩, so they are not members of the re-plan's 🎩 set.
- **Cutover-gating enumeration.** The rendered-header 🚧 set differs from the prior plan's Critical Path Cutover enumeration (drops 086a and 093; adds 065, 077, 078, 080, 105b). The 🚧 flag governs; the divergence is flagged in the Critical Path section.
- **The `Fwin F#` window counter and the `CD-flag F#` tokens share an `F#` shape but are unrelated and must be read field-scoped:** `Fwin F1` is the first window chat (106); `CD-flag F1` is the `daily_plans` draft/approved-state migration question. They are namespaced by field (`Fwin#` vs `CD-flags`) [doc:PHASE_4_BUILD_PLAN_part1.md].

---

## Deferred to V1.5

Work originally scoped for V1 that has been moved out of Phase 4 lives here with rationale and a pointer back to the original chat spec. The deferred chat is excluded from the master reordered-sequence table and carries no EO; it is rendered only in this section [doc:PHASE_4_BUILD_PLAN_part1.md].

### Chat 090a — Data Export Endpoint and Worker (V1.5)

*Block 11 · EO — (deferred to V1.5; not in master sequence) · 🔵 🟣 · Skills: caveman, stop-slop · 🎩 · Window N · CD-flags: —*

**Rationale for deferral:** The CCPA-driven user-data export feature is non-blocking for App Store submission (Apple does not require an in-app export at V1; the data-deletion path satisfies the App Privacy posture). The Cloudflare R2 dependency the original spec assumed adds a paid-tier provider relationship and a signed-URL infrastructure that we are not willing to take on for V1 given the low expected request volume during the first months. Deferring keeps the V1 surface narrower and the V1 infrastructure smaller.

**Load at session start (V1.5):** TECHNICAL_SPEC.md §4 (Account section); LAYER_5_BUSINESS_MONETIZATION.md (data portability); chat 091 (email templates pattern).

**Goal (V1.5):** Build the data-export feature required by CCPA. The user requests an export via the settings panel; the request enqueues a background worker that gathers all user data into a JSON archive and emails the user a one-time download link via Resend.

**Output (V1.5):**
- `apps/web/app/api/v1/account/export/route.ts` — POST handler that creates an export-request row and enqueues the worker; rate-limited to one export per 24 hours per user
- `workers/data-export/index.ts` — Cloudflare Worker triggered on the export-request queue; gathers user_profiles, daily_plans, blocks, tasks, weekly_priorities, medications, recurring_errands, bills, integrations metadata (not tokens), subscription summary, completion_log, hydration_log, cancellation_events, calendar_events into a single JSON document; uploads to Cloudflare R2 (V1.5 R2 dependency introduced here) with a signed URL valid for 24 hours; emails the user the download link
- `apps/web/app/(app)/settings/account/page.tsx` updated to include a "Download Your Data" button with explanatory copy
- `packages/shared/emails/DataExportReady.tsx` — the email template with the download link and the 24-hour expiry note
- A new export_requests table

**Implementation notes (V1.5):** The integrations row data excludes encrypted OAuth tokens. The 24-hour expiry on the download link plus the rate limit on requests prevents abuse. R2 provisioning happens during V1.5 launch prep; it is NOT part of Phase 4 Cutover. The "Download Your Data" copy and the email template pass the butler voice gate (🎩) as user-facing copy, following the chat 091 template pattern.

---

## Assembly Instructions — Concatenating Parts 1–10 into `PHASE_4_BUILD_PLAN.md`

This part (File 10) is the final part of the chain. To reproduce the single canonical document, patch the parts head-to-tail in order, with any `a`/`b` sub-parts in letter order:

**1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9a → 9b → 10** (and, if File 10 itself self-split, → 10a → 10b in letter order; File 10 was produced as a single part and did not self-split).

Concatenate by appending each part's body to the running document in that exact order, preserving every immutable chat number and every non-chat section. The result is one `PHASE_4_BUILD_PLAN.md` whose front matter (part 1), Design Cluster / Butler's Notebook / Block 0 / Block 1 (part 2), Blocks 2–13 with their split `-V`/`-W` halves in their original blocks (parts 3–9b), and this non-chat tail (part 10) appear once each, in document order.

**Verify, before treating the assembly as complete:**

1. **No entry or section was truncated at a part boundary.** Each part ends on a block or section boundary; confirm that the last entry of every part is complete and that the first entry of the following part begins cleanly, with no half-rendered chat header, meta line, or section straddling a join.
2. **Every immutable chat number resolves.** The inline dependencies, the Cutover steps, the Risk Map, the Parallelization Map, the Skill Invocation Map, and the Critical Path all reference chat numbers; confirm each referenced number (and each `-V`/`-W` half) exists exactly once in the assembled body.
3. **Both halves of every split chat live in the same part as their original block**, and any master-table fold (052-V into 052-W, 054-V into 054-W) renders as a single chat, not two.
4. **090a appears only in the Deferred section of this part** and nowhere in the master table or the numbered body.

**Known carried discrepancy from part 9 — do NOT "fix" it during assembly.** Chat 093-W has no master-table row; its EO is left "—" and it is build-track per Stage 2 §5 (not a master-table row) [doc:PHASE_4_BUILD_PLAN_part9a.md]. The File-Split Plan's "21 entries" figure for part 9 is a pre-fold/pre-split count that disagrees with the master-table-rendered count; this is flagged, not reconciled [doc:PHASE_4_BUILD_PLAN_part1.md]. The assembler must preserve both as-is. The remaining carried discrepancies are catalogued in the Closing Notes above and are likewise to be preserved, not patched.

End of Phase 4 Build Plan.
