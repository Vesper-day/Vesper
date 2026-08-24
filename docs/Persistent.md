# PERSISTENT — Cross-Chat Open Flags

Last updated: after ADD-C landed (Fitness module method-B scaffold — NEW `lift_log_entries` table (migration **26**, `20260824000026_lift_log_entries.{sql,down.sql}` + supabase up-only mirror; own-row RLS on `auth.uid()=user_id`; cols id/user_id/logged_at/exercise_name/workout_template_id(FK workout_templates ON DELETE SET NULL)/set_number/reps/weight numeric(7,2)/weight_unit/created_at/updated_at; **three DB CHECK constraints** `set_number>0` + `reps>=0` + `weight>=0`; index `idx_lift_log_entries_user_id_logged_at`; NO strength-rank/percentile columns) + Drizzle model `liftLogEntries` in `packages/db/src/schema/modules.ts`; web routes `/api/v1/fitness/{lift-log,lift-log/[id],workouts,tailored}` + `operations.ts`; fitness page web `(app)/modules/fitness/page.tsx` + mobile `(tabs)/modules/fitness.tsx`, self-gating on `modulesEnabled.fitness.enabled`, three surfaces (workout-schedule + tailored-generation + lift-log) + reserved rank/percentile slot, composed from 107/107a primitives (NO token/primitive VALUE change), FIXED labels (NO new voice copy, no copy file); tailored-generation REUSES chat-049's `buildTemplateSubset`/`filterWorkouts` + `selectWorkoutTemplate` (Haiku + deterministic fallback) VERBATIM — NO new engine/prompt/model/prompt-version, Anthropic call MOCKED offline; lift-log "today" read-back reuses DB `start_of_local_day(tz)`; fitness boundary Zod at client-safe `@vesper/shared/fitness` subpath (NEW export); fitness card added to `apps/{web,mobile}/lib/modules.ts` (list order after nutrition; gateKey `fitness`) + mobile `(tabs)/modules/_layout.tsx` screen; typed-routes handled via existing web `href={{pathname}}` + mobile `as Href`. DEFERRED (named, slot reserved, shipped none): bronze→platinum strength-rank + world-standard percentile mapping. Offline gate green (test 15 tasks / type-check 16 / lint 11 / build 6) + DB smoke green (migration up/down 6/6, lift-log integration 11/11 own-row + local-day + FK + three CHECK rejections). The "MODULES-TAB NAV REFACTOR" flag now records **ADD-A + ADD-B + ADD-C ALL LANDED — module-scaffold chats COMPLETE**. Prior: after ADD-B landed (Nutrition module method-B scaffold — NEW `food_log_entries` table (migration **25**, `20260824000025_food_log_entries.{sql,down.sql}` + supabase up-only mirror; own-row RLS SELECT/INSERT/UPDATE/DELETE on `auth.uid()=user_id`; cols id/user_id/logged_at/item_name/recipe_template_id(FK recipe_templates ON DELETE SET NULL)/quantity_note/created_at/updated_at; NO deep-nutrition columns) + Drizzle model `foodLogEntries` in `packages/db/src/schema/modules.ts`; web routes `/api/v1/nutrition/{food-log,food-log/[id],food-search,recipe-modify}` + `operations.ts`; nutrition page web `(app)/modules/nutrition/page.tsx` + mobile `(tabs)/modules/nutrition.tsx`, self-gating on `modulesEnabled.nutrition.enabled`, three surfaces (food-log + food-search + AI recipe-modify) composed from 107/107a primitives (NO token/primitive VALUE change); AI recipe-modify REUSES the AI command infra via NEW `@vesper/ai` `modifyRecipe` applier + prompt `recipe-modify` version **`v1-20260824`** on `generateText` (voice gate + cost + breaker seam; NOT a synthesizePlan fork, NO new Anthropic model row, call MOCKED offline); food-log "today" read-back reuses DB `start_of_local_day(tz)` (hydration migration-14 precedent); food-search = `recipe_templates` name ILIKE (existing corpus, NO external food DB); nutrition boundary Zod at client-safe `@vesper/shared/nutrition` subpath (NEW export) + static copy at `@vesper/shared/copy` (not runtime-gated, 057 precedent); nutrition card added to `apps/{web,mobile}/lib/modules.ts` catalog (list order after bills; gateKey `nutrition`) + mobile `(tabs)/modules/_layout.tsx` screen; typed-routes handled via existing web `href={{pathname}}` + mobile `as Href`. DEFERRED (named, page reserves a slot, shipped none): micronutrient/vitamin/RDA/calorie internals + external food-nutrient DB. Offline gate green (test 15/15 tasks, type-check/lint/build clean) + DB smoke green (migrations up/down 5/5, food-log integration 11/11 own-row+local-day+FK). See "MODULES-TAB NAV REFACTOR" flag — now **ADD-A + ADD-B landed; ADD-C pending**. Prior: after ADD-A landed (Modules-tab navigation refactor — CODE: rebuilt the mobile tab bar to **plan / Modules / tasks / calendar** (Modules 2nd-from-left; old `settings` tab removed) in `apps/mobile/app/(tabs)/_layout.tsx`; NEW `(tabs)/modules/{_layout,index}` rounded-card list surface + NEW web `apps/web/app/(app)/modules/page.tsx` list (no web tab bar — web shell has no persistent nav); re-homed 060 medications + 061 bills (mobile → `(tabs)/modules/{medications,bills}.tsx`, web → `(app)/modules/{medications,bills}/page.tsx`) and the mobile settings sub-stack → `(tabs)/modules/settings/*` via `git mv` (logic UNCHANGED — CRUD/API/RLS/audit/notification/scheduler untouched, `api/v1/{medications,bills}/*` stay put); web settings LEFT at `/settings` (the `/settings/integrations/callback` OAuth redirect URI is fixed); NEW pure `apps/{web,mobile}/lib/modules.ts` card catalog + `isModuleEnabled` helper + tests pinning the SINGULAR `medication`/`finance` gate keys; NEW `docs/MODULE_MOUNT_CONTRACT.md` = durable SOURCE OF TRUTH for module surface locations; NO migration, NO token/primitive VALUE change; offline gate green (mobile 195, web 211 + 6 DB-skips, type-check/lint/build clean). See the "MODULES-TAB NAV REFACTOR" flag below — now **ADD-A landed**. Prior: after the DOCS-ONLY Modules-tab nav-refactor + method-B module-scaffold + design-track-overhaul planning pass (no code): appended addendum chats ADD-A/ADD-B/ADD-C/ADD-D to `PHASE_4_BUILD_PLAN.md` (corrective, no EO, master table untouched); added PRD §3.5 Modules-tab nav + §6.2/§6.3 method-B notes; added TECHNICAL_SPEC `food_log_entries`/`lift_log_entries` scaffold tables (deep columns deferred); re-scoped the 11 not-yet-run `-V` halves to the clean/Fable posture + new surfaces; added ADD-D (Fable polish of the already-shipped 107/107a + plan/day surfaces under a token-freeze contract); deprecated the immersive direction docs (VISUAL_DIRECTION_BANK_v2, ASSET_MANIFEST_KICKOFF, REEL sheets); recon confirmed NO immersive/AI-gen code shipped; 106/107/107a committed token values KEPT (Fable revises primitive styling only). See the two new flags below ("MODULES-TAB NAV REFACTOR…" and "DESIGN-TRACK OVERHAUL…"). Prior: after Chat 058 landed (Weekly Planning Steps 4 & 5 — module adjustments + 7-day synthesis + review grid + accept batch-write, web + mobile: NEW sibling `packages/ai/src/weeklyTemplate.ts` (`synthesizeWeeklyTemplate`, prompt `weekly-v1-20260822` in `prompts/weeklyTemplateSynthesis.ts`) reusing the live breaker/fallback/context/cache-shared-L1 primitives — NOT a fork of synthesizePlan; Step-4 TRANSIENT constraints `{pausedModules[{moduleType,dates[]}], recoveryDates[], fixedNotes[{date,note}]}` thread into the synthesis input ONLY, never `modules_enabled`; accept batch-writes 7×`daily_plans`+`blocks` by REUSING the daily `commitPlan` per-day — upsert-in-place on UNIQUE(user_id,plan_date) + delete-blocks-first — via a NEW minimal `/api/v1/plans/week/{generate,accept}` endpoint (flagged, no daily surface fit); `energyScore` widened to `number|null` for the null-energy weekly write; copy in `@vesper/shared/copy` subpath, NOT voice-gated; dismiss-fallback regeneration SHARES the `commitWeek` seam but is left UNWIRED/UNOWNED; NO migration. ⚠️ Upstash Redis instance is DEAD — the pre-existing daily-generate integration cases `active cap`/`idempotency lock` fail ENOTFOUND, environment-not-code, unrelated to 058). Prior: after Chat 056 landed (Tasks module — mid-day reflow engine + single butler-voice over-commit prompt on web + mobile: pure `packages/ai/scheduling/taskReflow.ts` composing 055's primitives unchanged and returning the unplaceable remainder explicitly instead of dropping it; unresolved-state CLIENT-SIDE ONLY so NO migration; mutation surface = chat-027 blocks PATCH `status:'rescheduled'`; defer = block-status change only, task row untouched; copy in `@vesper/shared/copy` subpath, NOT voice-gated; the 067 calendar-sync trigger seam is OPEN + UNWIRED and the OCC `planUpdatedAt` token forward flag is owned by 067). Prior: after Chat 088 landed (Apple App Store Server Notifications V2 webhook — part 2: EXTENDED the SAME `workers/apple-assn` worker with the remaining ten types + TEST — DID_FAIL_TO_RENEW→past_due (§8), GRACE_PERIOD_EXPIRED→read_only, REFUND_REVERSED→active+clear canceled_at, RENEWAL_EXTENDED→period update, DID_CHANGE_RENEWAL_STATUS→cancel_at_period_end flip, four audit-only types, TEST→200 fast; NO verify code added, NO migration; ⚠️ the spec-linked `referral_credits`→'applied' write on DID_CHANGE_RENEWAL_PREF is NOT authored and UNOWNED). Prior: Chat 087 landed (Apple App Store Server Notifications V2 webhook — part 1: standalone HTTP `fetch` Cloudflare Worker `vesper-apple-assn` verifying the outer envelope + inner transaction JWS and dispatching SUBSCRIBED/DID_RENEW/EXPIRED/REVOKE/REFUND to the §8 state machine; EXTRACTED 086's Apple JWS x5c verify + pinned roots into a NEW shared `@vesper/apple` package, apps/web/lib/apple/* now thin shims; NO migration). Prior: Chat 086a landed (Apple PKI Monitor — standalone weekly Cloudflare Worker that Sentry-alerts when a pinned Apple Root CA is within 180 days of expiry; re-pins 086's G3 DER, guarded by a byte/fingerprint parity test; NO DB). Prior: Chat 086 (Apple receipt verification — server-side StoreKit 2 JWS x5c-chain verify route + apple subscriptions upsert + subscription_events idempotency — CLOSES the apple-verify 501 stub), Chat 066 (Google Calendar channel-renewal daily-cron worker + channel-state migration 24 + channel→user mapping — CLOSES the 065 channel-state persistence + mapping gap), Chat 065 (GCal push webhook receiver + authored-but-uninvoked registerWatch — web), Chat 083 (Stripe Checkout + Customer Portal completion + cutover runbook — web billing; PR #77), Chat 085 (Apple StoreKit 2 IAP client — mobile iOS).

Read this file when writing any Claude Code prompt. Include only flags where
the current chat appears in the Relevant-to column. Do not paste the full file
into kickoffs — reference by flag name only.

---

## How to use

**When writing a kickoff:** List only the flag names relevant to that chat.
One line each. Full text is here; do not re-paste it.

**After a chat lands:** Add any new flags surfaced during the session. Upload
updated file to project knowledge.

---

## Open Flags

---

### MODULES-TAB NAV REFACTOR + METHOD-B SCAFFOLD (ADD-A + ADD-B + ADD-C ALL LANDED — module-scaffold chats COMPLETE)
**Owner:** ADD-A (Modules-tab navigation refactor — rebuild tab bar + re-home 060/061 + define mount contract); ADD-B (nutrition method-B scaffold); ADD-C (fitness method-B scaffold) — all in `PHASE_4_BUILD_PLAN.md` → Addendum, run out-of-sequence, no EO
**Relevant-to:** any chat touching a module surface, the mobile tab bar (`apps/mobile/app/(tabs)/_layout.tsx`), module backend wiring, the settings surfaces, or the fitness/nutrition/sleep/errands/medications/bills pages; chats 060/061/062 and the app shell 013; the `-V` halves 035-V and 041-V
**Status:** **ADD-A + ADD-B + ADD-C ALL LANDED — the addendum module-scaffold chats are COMPLETE.** ADD-A (nav refactor) + ADD-B (nutrition method-B scaffold: `food_log_entries` migration 25) + ADD-C (fitness method-B scaffold: `lift_log_entries` migration **26**, web routes `/api/v1/fitness/{lift-log,lift-log/[id],workouts,tailored}` + `operations.ts`, web/mobile fitness page self-gating on `modulesEnabled.fitness.enabled`, tailored-generation REUSES chat-049's `buildTemplateSubset`+`selectWorkoutTemplate` verbatim (NO new engine/prompt/model/prompt-version), fitness card in the catalog after nutrition; offline gate + DB smoke green — see the Last-updated summary at top). The master reordered-sequence table is **untouched** (no EO added). ADD-A is now the **live SOURCE OF TRUTH for module surface locations** — `docs/MODULE_MOUNT_CONTRACT.md`; 013's tab bar and the 060/061 original mount paths are **superseded** by the new Modules-tab tree (below).
**Detail:** Docs-only decisions encoded this pass (authoritative text in `PHASE_4_BUILD_PLAN.md` → Addendum, PRD §3.5/§6.2/§6.3, TECHNICAL_SPEC "Method-B Module Scaffold Tables", and the CLAUDE.md standing note):
- **Nav refactor (ADD-A).** Mobile tab bar → **plan / Modules / tasks / calendar** (Modules 2nd-from-left). The "settings" tab is renamed **Modules** = a vertically scrollable rounded-card list, **one card per module, every card routes to its own full page**. Actual settings (integrations/GCal, billing, privacy/biometric, referral, account) move to a **"Settings" card at the bottom** of the Modules list (nothing lost). Reminder-list modules (medications, bills, errands) → full management page; generative modules (fitness, nutrition, sleep) → richer page. **ADD-A is the SOURCE OF TRUTH for current module surface locations + the mount pattern** — future module chats read it FIRST, not the original chat paths. Landed 060 (meds) + 061 (bills) are **re-homed** (logic unchanged); errands (062, unbuilt) + future modules mount into ADD-A's contract.
- **ADD-A LANDED — actual paths (read `docs/MODULE_MOUNT_CONTRACT.md` FIRST).** Mobile: tab bar `(tabs)/_layout.tsx` = plan/Modules/tasks/calendar; Modules Stack `(tabs)/modules/_layout.tsx`; card list `(tabs)/modules/index.tsx`; module pages `(tabs)/modules/{medications,bills}.tsx`; settings sub-stack `(tabs)/modules/settings/{_layout,index,integrations,privacy,subscription}.tsx` (module routes `/modules/<name>`, settings `/modules/settings/<name>`). Web: list `(app)/modules/page.tsx`; pages `(app)/modules/{medications,bills}/page.tsx`; web settings LEFT at `/settings` (OAuth callback redirect-URI). **Web-parity mechanism:** git-mv the existing pages (`@/` alias imports are location-independent → zero import churn) + a standalone `/modules` list; **NO web tab bar** (web shell has no persistent nav). Card catalog + singular-gate helper = pure `apps/{web,mobile}/lib/modules.ts` (+ tests). Cards are ALWAYS shown (route to self-gating pages) with an On/Off hint — no dead toggle. Only medications + bills cards exist now (errands/fitness/nutrition/sleep join when their pages land). Settings enumerated + fully re-homed: mobile index/integrations/privacy/subscription, web page/integrations/integrations-callback — none dropped; no referral/account standalone route exists live (not fabricated). **NO migration, NO token/primitive value change.**
- **Method-B scope (ADD-B/ADD-C).** Modules ship at V1 as **functional-breadth scaffolds, not full depth.** Nutrition (ADD-B): daily food-log + food-search + AI recipe-modify (reusing existing AI command infra). Fitness (ADD-C): workout-schedule list + tailored generation (reusing 049's selection/adaptation) + lift-logging (sets/reps/weight). **DEFERRED (named, post-launch):** nutrition micronutrient/RDA/calorie internals + external food-nutrient DB; fitness bronze→platinum strength-rank + world-standard percentile mapping.
- **Scaffold tables (thin, deep columns deferred):** `food_log_entries` **AUTHORED by ADD-B as migration 25**. `lift_log_entries` **AUTHORED by ADD-C as migration 26** (`20260824000026_lift_log_entries.{sql,down.sql}` + supabase up-only mirror; live allocation Block 4-7 next-free integer = 26, NOT the TECHNICAL_SPEC's tentative #27; ADD-B consumed 25). `lift_log_entries` cols: id/user_id(FK users ON DELETE CASCADE)/logged_at/exercise_name/workout_template_id(FK workout_templates ON DELETE SET NULL)/set_number/reps/weight numeric(7,2)/weight_unit/created_at/updated_at; **three DB CHECK constraints** (`set_number > 0`; `reps >= 0` when present; `weight >= 0` when present) authored ON THE TABLE (not only Zod); own-row RLS SELECT/INSERT/UPDATE/DELETE on `auth.uid()=user_id`; index `idx_lift_log_entries_user_id_logged_at`; NO strength-rank/percentile columns. Drizzle model `liftLogEntries` in `packages/db/src/schema/modules.ts`; boundary Zod at client-safe `@vesper/shared/fitness` subpath (NEW export). Lift-log "today" read-back reuses DB `start_of_local_day(tz)`. Workout-schedule + tailored-generation need **no new table** (reuse chat-049's `buildTemplateSubset`/`filterWorkouts` over the 047/048 `workout_templates` corpus + `selectWorkoutTemplate` Haiku selection with deterministic fallback; Anthropic call MOCKED offline). ADD-C authored NO new voice copy (fixed labels only). **DEFERRED (named, page reserves a slot, shipped none):** fitness bronze→platinum strength-rank + world-standard percentile mapping. Offline gate green (test 15 tasks / type-check 16 / lint 11 / build 6, all clean) + DB smoke green (migration up/down reversibility 6/6, lift-log integration 11/11 own-row + local-day + FK + the three CHECK rejections).

---

### DESIGN-TRACK OVERHAUL — CLEAN POSTURE + FABLE MODEL (106/107/107a KEPT; -V halves re-scoped)
**Owner:** The design-track `-V` chats going forward (run on Fable, clean posture, per the priority order); **ADD-D** (Fable polish pass over the already-shipped design surfaces). No build-track removal follow-up — recon confirms no immersive code shipped.
**Relevant-to:** every not-yet-run `-V` visual half (032-V, 033-V, 034-V, 035-V, 036-V, 041-V, 044-V, 046-V, 089-V, 093-V, 095-V); any chat consuming `DESIGN_STRATEGY.md`, `VISUAL_DIRECTION_BANK_v2.md`, `ASSET_MANIFEST_KICKOFF.md`, or the REEL sheets; anyone choosing a per-chat model on the design track
**Status:** Open — posture + model re-scope encoded in docs; the re-scoped `-V` halves are **not yet run**. 106/107/107a committed outputs (DESIGN_SYSTEM.md, `@vesper/ui` tokens + primitives) are **untouched** — token/primitive values unchanged.
**Detail:** Authoritative text in `PHASE_4_BUILD_PLAN.md` → Addendum → "Design-Track Overhaul", the clean-posture banner in `DESIGN_STRATEGY.md`, and the CLAUDE.md standing note:
- **Posture.** DROP the immersive vision — no AI-generated imagery, no cinematic/immersive-scroll motion. Target a **clean, credible, shippable** modern-app look (restrained tokens, standard motion, conventional layouts; resume / YC-demo bar). Persuasion ethics + scorekeeping-as-absence unchanged.
- **Model carve-out (standing exception).** Design-track `-V` halves **run on the Fable model** against a finite ~$100 Fable budget (build track unchanged). **Option 1:** Fable authors styled component code directly (no Figma, no image pipeline).
- **KEEP vs DEPRECATE.** KEEP untouched: 106 `DESIGN_STRATEGY.md` (amended with the clean banner only), 107 `DESIGN_SYSTEM.md` + `@vesper/ui` tokens/primitives, 107a part-2 primitives, the native visual specs. DEPRECATE-superseded (content preserved + marked): `VISUAL_DIRECTION_BANK_v2.md`, `ASSET_MANIFEST_KICKOFF.md`, `docs/REEL_REFERENCE_SHEETS/`.
- **Re-scoped `-V` halves.** All 11 above carry an in-place RE-SCOPE pointer. Notable: 035-V + 041-V retarget to the **new Modules-tab + method-B scaffold** surfaces; 036-V drops "cinematic" loading/reveal; **093-V drops the Three.js/R3F cinematic-scroll hero** for a clean standard hero.
- **SHIPPED-CODE polish = ADD-D (Fable), under a TOKEN-FREEZE contract.** Recon (filesystem + deps): the ONLY shipped design code is the clean **107/107a** system (`packages/ui/src` tokens + `apps/*/components/ui` primitives) + the build-track plan/day surfaces (BlockCard/BlockTimeline/PlanSkeleton/week/settings) that compose from it — **no immersive/AI-gen code ever landed** (marketing page still `<h1>Vesper</h1>` stub; no `HeroThreeScene`; `three`/`gsap`/`lenis`/`vite-plugin-glsl` NOT installed). Those shipped surfaces are lifted to the finished bar by **ADD-D on Fable**, NOT hand-edited by the build model. **Token-freeze:** Fable may revise primitive **styling** + surface composition, but must **NOT change any token name/value** in `tokens.ts`/`tailwind.ts`/`DesignTokens.swift` (consumers read token names; new value = new token name only). The one allowed inverse: removing the unused `cinematic` band/easing token (zero consumers). Unbuilt `-V` surfaces are authored fresh on Fable.
- **Priority order (finite credits, shared by ADD-D + the `-V` halves).** ADD-D shipped design system + plan/day → onboarding (032-V/035-V/036-V) → plan/day detail (041-V/046-V) → Modules tab + top module pages (ADD-A + ADD-B/ADD-C) → landing/referral (093-V/095-V) → subscription/rest (089-V/033-V/034-V/044-V).
- **Landed-work status: RESOLVED by recon — no exposure.** 093-V's Three.js hero never shipped, so there is no removal follow-up; its re-scope is fully covered by editing its Goal in-place.

---

### WEEKLY STEPS 4 & 5 landed (058); dismiss-fallback regen OPEN + UNWIRED; Upstash instance DEAD
**Owner:** The dismiss-fallback chat (the Sunday-prompt-ignored → template+calendar regeneration trigger that would reuse the `commitWeek` seam); the operator (re-provision the dead Upstash Redis DB before the rate-limit/idempotency integration cases can be exercised)
**Relevant-to:** any chat touching the weekly-planning session, the weekly Sonnet synthesis, the `commitWeek`/`/plans/week/*` batch-write, the daily `commitPlan` persist path, the chat-020 daily-eval class, or the Upstash rate-limit/idempotency integration suite
**Status:** Open only on the dismiss-fallback trigger + the Upstash liveness note — the engaged Steps 4–5 (both surfaces), the weekly synthesis, the batch endpoint, the copy, and the mounts all shipped and green (full offline gate: test/type-check/lint/build — all packages pass, no NEW build errors vs main). NO 058-owned user-only check: the weekly Sonnet call is fully MOCKED offline and NO DB-gated 058 suite landed, so no live eval/DB smoke was required to land. No migration.
**Detail:** 058 built the final two steps of the Sunday weekly-planning session (module adjustments + 7-day synthesis + review grid + accept batch-write) on web + mobile, on top of 057's steps 1–3. Durable facts:
- **`weeklyTemplate.ts` is a NEW SIBLING, prompt is a VERSIONED artifact (the headline).** `packages/ai/src/weeklyTemplate.ts` exposes `synthesizeWeeklyTemplate(params)` producing SEVEN days (`WeeklyTemplateSchema` = `days[{dayIndex 0..6, plan: DailyPlanSchema}]`) with the week's priorities threaded across days. It is NOT a fork of `synthesizePlan.ts` — it REUSES the live primitives verbatim: `readBreakerState`/`recordFailure` (circuit breaker), `getFallbackPlan` (safe fallback week), `buildUserContext`/`buildTemplateSubset` (Layer-2/3 context), `getProviderOptions` (cache-shared L1 breakpoint — weekly pays the L1 at 0.1× as a cache read), `anthropicProvider`/`MODELS.SONNET`, `voiceGate`, `DailyPlanSchema`. The Layer-1 prompt lives in `packages/ai/src/prompts/weeklyTemplateSynthesis.ts`, version const **`WEEKLY_TEMPLATE_SYNTHESIS_VERSION = 'weekly-v1-20260822'`** — the artifact the chat-020 daily-eval CLASS can measure. NOTE: no weekly eval RUNNER was wired this chat (`eval/runPlanEval.ts` imports only the daily `generatePlanFromContext`); the weekly prompt is versioned but not yet measured by a runner.
- **GENERATE-ONLY boundary mirrored.** `synthesizeWeeklyTemplate` + `runWeekGeneration` (the `/plans/week/generate` seam) write NOTHING — they read the target week's priorities (READ-ONLY; the chat-029 API owns writes) and return the reviewable week. Persistence is a separate accept step. Breaker-open/fallback returns a safe seven-day shape (asserted in `weeklyTemplate.test.ts`).
- **STEP-4 TRANSIENT CONSTRAINTS shape (determination).** `WeeklyConstraintsSchema` = `{ pausedModules: [{ moduleType: BlockType, dates: ISODate[] }], recoveryDates: ISODate[], fixedNotes: [{ date: ISODate, note: string }] }` (all `.default([])`). Threaded into the synthesis input ONLY — a paused module yields no blocks of that type on its flagged dates; a recovery date yields no `fitness` block that day (both asserted). NEVER written to `modules_enabled` or any persistent module-preference store. The step-4 PURE builders (`buildWeekConstraints`, web `apps/web/lib/weekly-planning/weekConstraints.ts` + mobile `apps/mobile/lib/weekConstraints.ts`, DUPLICATED per the 057/040 twin precedent) assert selections→payload and that NOTHING maps to persistent prefs.
- **BATCH-WRITE SURFACE = a NEW endpoint reusing the daily `commitPlan` per-day (determination + FLAG).** The accept path is `commitWeek` in `apps/web/app/api/v1/plans/week/operations.ts`, invoked by `POST /api/v1/plans/week/accept`. It REUSES the daily persist path (`commitPlan` + `planExists` from `../generate/generatePlan`) once PER DAY — no second plan query, no second db client. Each day honors §3.3 write semantics: `daily_plans` UPSERT-IN-PLACE on UNIQUE(user_id, plan_date), and its `blocks` DELETED before the new ones insert (`commitPlan` already does exactly this). Per-day `plan_date` + block "HH:MM"→timestamptz boundaries derive from the user timezone via `commitPlan`'s `(date||' '||time)::timestamp AT TIME ZONE tz`. A NEW endpoint was required (FLAGGED): the daily `/plans/generate` route synthesizes+persists server-side and takes no client plan body, so no existing surface fit a client-provided reviewed week. `generatePlan.ts` `CommitPlanParams.energyScore` was widened `number → number|null` (the weekly batch has no per-day energy; `energy_score` is NULLABLE) — a backward-compatible widening, daily callers still pass a number.
- **DISMISS-FALLBACK scope (determination): OUT of 058, but the seam is SHARED.** PRD §3.3's dismiss-path (Sunday prompt ignored → regenerate next week from the prior template + calendar) would reuse the SAME `commitWeek` batch-write seam. 058 built the seam and wired ONLY the ENGAGED accept path to it; the dismiss trigger is NOT built or wired and remains **open/unowned**. 057 already shipped the Sunday-prompt dismissal UI client-only; 058 did not touch it and did not author a second regeneration trigger.
- **COPY convention + VOICE GATE (determination, unchanged from 056/057).** Step-4/5 lines added to `packages/shared/src/copy/index.ts` (`WEEK_ADJUST_*`, `WEEK_REVIEW_*`, ids `weekly_planning.module_adjustments` / `weekly_planning.plan_review`), consumed by BOTH surfaces via the client-safe **`@vesper/shared/copy` subpath** — never the bare barrel (pulls db→postgres into the client bundle). NOT voice-gated: the live `voiceGate`/`gatePlanStrings` is a runtime call over GENERATED `block.title`/`note` only; static UI copy has no gate call (057 precedent). Lines hand-authored to the gate's Tier-A/B rules + no-scorekeeping and asserted in `copy.test.ts`.
- **STEP-5 review grid + PURE helper.** Grids: web `apps/web/app/(app)/weekly-planning/Step5ReviewGrid.tsx` + mobile `apps/mobile/components/weekly-planning/Step5ReviewGrid.tsx`; the step-4 UIs are the sibling `Step4ModuleAdjustments.tsx` on each surface. PURE helpers `weekReview.ts` (web `apps/web/lib/weekly-planning/` + mobile `apps/mobile/lib/`, duplicated) assert the generated-week→grid mapping, accept→batch-write payload, and block-level adjustment mapping (no DOM render on web; react-native mocked on mobile). Both 057 hosts (`apps/web/app/(app)/weekly-planning/page.tsx`, mobile root `apps/mobile/app/weekly-planning.tsx`) were edited to MOUNT steps 4–5 into the existing stepper — no second session route, no rework of steps 1–3.
- **NO migration** — every column written by `commitWeek`/`commitPlan` (`daily_plans`: plan_date, energy_score NULLABLE, regeneration_count, metadata; `blocks`: the full generated-block set) confirmed live; nothing absent, so none authored. There is no weekly `completion_event_enum` value, so the weekly GENERATE emits no completion_log row (the per-day ACCEPT emits the existing `plan_generated`/`plan_regenerated` events).
- **⚠️ UPSTASH REDIS INSTANCE IS DEAD — a USER-ONLY LIVENESS check, environment-not-code, NOT a 058 regression (do not re-chase).** Two PRE-EXISTING daily-generate DB-integration cases — **`active cap: blocks the 6th generation within a rolling hour`** and **`idempotency lock: a second concurrent acquire is refused (409 condition)`**, in `apps/web/app/api/v1/plans/generate/generate.integration.test.ts` (lines ~194/~204) — fail with `getaddrinfo ENOTFOUND immune-bluebird-77217.upstash.io` when run with `VESPER_DB_TESTS=1` + Upstash tokens set. The tokens are shaped-valid but the Upstash free-tier DB no longer resolves in DNS (deleted/hibernated after ~1 month idle) — the endpoint is gone, NOT a code fault, and both cases live in the daily-generate rate-limit/idempotency paths (`lib/idempotency.ts`, `@vesper/shared` rate-limit) that 058 never touched. These are doubly-gated (Docker + local Supabase + `VESPER_DB_TESTS=1` + a LIVE Upstash) and skip cleanly offline — the full offline gate is green without them. Fix = re-provision an Upstash Redis DB + fresh `UPSTASH_REDIS_REST_URL`/`_TOKEN`; nothing in the repo. A later chat seeing these two ENOTFOUND failures must read them as the dead-instance liveness gap, not a weekly-planning regression.

---

### REFLOW ENGINE + OVER-COMMIT PROMPT landed (056); 067 calendar-sync trigger OPEN
**Owner:** Chat 067 (the calendar-sync conflict-resolution trigger that supplies both the displaced chunks AND the OCC token to the reflow engine + prompt)
**Relevant-to:** Chat 067; any chat touching the mid-day reflow path, the over-commit prompt on either plan surface, the §9 GET PlanResponse shape, or the chat-027 blocks PATCH
**Status:** Open only on the 067 trigger + the OCC-token forward flag — the pure reflow engine, both prompt surfaces, the copy, and the mounts all shipped and green (full offline gate: test/type-check/lint/build). No DB work, no migration, no DB smoke.
**Detail:** 056 built the mid-day reflow engine + the single butler-voice over-commit prompt (web + mobile). Durable facts:
- **067 SEAM OPEN + UNWIRED (the headline).** `packages/ai/src/scheduling/taskReflow.ts` exposes `reflowDisplacedChunks(input)` — PURE, no I/O/DB/model/clock (`now` injected), mirroring 055's `taskPlacement.ts`. It is wired into NOTHING: no calendar-sync path calls it. Precedence contract is **067-FIRST** (a new/modified event → AI-placed overlapping blocks set to `rescheduled`, removed from the visible plan) **THEN 056-SECOND** (reflow the resulting task displacement; an unplaceable remainder surfaces the prompt). Both plan hosts mount `<OverCommitPrompt items={[]} planUpdatedAt={null}/>` today, so it renders null until 067 feeds it.
- **055 PRIMITIVES REUSED UNCHANGED — no second algorithm/carver/sort.** Reflow composes `placeTasks` / `carveOpenWindows` / `calendarEventsToBusy` / `sortTasksForPlacement` (priority-DESC → deadline-ASC-nulls-last) verbatim; `taskPlacement.ts` was NOT edited. Reflow adds only: per-task-id chunk grouping (a split task's chunks summed into ONE reflow unit, keyed by the `details.tasks` id, never by title), `[now, deadlineCutoff)` window bounding via the SAME carver (a past-deadline fit is impossible by construction → deadline violation is never "silent"), and remainder recovery by CONSERVATION (`needed − placed`).
- **NOTHING IS SILENTLY DROPPED — the unplaceable remainder IS the prompt.** 055's V1 rule drops the remainder at the single-day horizon; 056 inverts that. `reflowDisplacedChunks` returns either `{resolution:'silent', placements}` (every chunk fit whole, after `now`, within deadline) or `{resolution:'over_commit', placements:[], unplaceable}` with the FULL conflicting set. On over_commit it applies NOTHING — the engine holds every item in its current state.
- **UNRESOLVED STATE = CLIENT-SIDE ONLY; NO MIGRATION (determination).** `block_status_enum` has no `unresolved`/conflict value and `blocks` has no conflict flag (both confirmed against the applied schema); the WORK variant of `BlockDetailsSchema` carries only `{blockType, tasks, focusMode}`. PRD §4.1's "holds all items in their current state" reads as: NOTHING is written when the conflict surfaces. The prompt is a transient surface over the already-fetched `['plan', planDate]` data; unresolved items are visually distinguished (dashed marker) until the user chooses, and the FIRST write is the confirm. Build against the live enum values (scheduled/in_progress/completed/skipped/rescheduled), not the PRD's pending/complete prose.
- **MUTATION SURFACE = chat-027 PATCH `/api/v1/blocks/[blockId]` with `status:'rescheduled'`.** Chosen over the chat-029 batch reorder because 029's `ReorderRequestSchema` carries ONLY `{id, displayOrder}` and cannot express a status change. Neither route was edited; no new route was authored. Deferring N blocks issues N PATCHes — NOT a per-item cascade (the user answers ONE prompt; the writes are the single consequence of that one confirmed choice).
- **DEFER = A BLOCK-STATUS CHANGE ONLY, never a task-row change.** `blocks` has no FK to `tasks`; the join runs through the WORK variant's `details.tasks` id array. Moving a chunk to tomorrow sets today's block `rescheduled` and leaves the task row untouched (status stays `pending` → it re-enters tomorrow's placement as a normal pending task; there is no `deferred` value in `task_status_enum`). `rescheduled` is also exactly what 067 writes when clearing overlapped blocks, so displacement and deferral leave the same trace.
- **⚠️ OCC-TOKEN FORWARD FLAG (owned by 067).** The chat-027 PATCH needs `planUpdatedAt` as its OCC replay token, but the §9 GET PlanResponse does NOT expose it. Both prompts take `planUpdatedAt` as a prop (null today); `buildOverCommitResolution` returns `ok:false, reason:'no-token'` rather than firing a blind PATCH that would 409. **067 must thread the token (from the plan fetch) alongside the items when it wires the trigger.** Until then the confirm stays inert by design.
- **COPY convention followed — `packages/shared/src/copy/`.** Authored the over-commit lines in `copy/index.ts` (exports `OVER_COMMIT_PROMPT_LINE`, `OVER_COMMIT_ITEMS_HEADING`, `OVER_COMMIT_KEEP_LABEL`, `OVER_COMMIT_DEFER_LABEL`, `OVER_COMMIT_CONFIRM_LABEL`, `overCommitItemLine(title, minutes)`, `OVER_COMMIT_COPY_ID='tasks.over_commit_prompt'`) consumed by BOTH surfaces via the client-safe **`@vesper/shared/copy` subpath** (added to the package `exports` map) — never the bare barrel (which pulls db → postgres into the client bundle), never inlined in two components.
- **VOICE GATE NOT APPLIED (determination).** The live gate (`packages/ai/voiceGate.ts`) is a runtime Anthropic call over GENERATED strings; `gatePlanStrings` covers only `block.title`/`block.note`. Static UI copy has no gate call to route through (057 precedent). The lines are instead hand-authored to the gate's Tier-A/B rules and asserted against them in `copy.test.ts` (no em-dash/exclamation/emoji/bare-AI, none of the §5.4 "Never Says" words, and no scorekeeping/streak/progress framing — the last a component-level prohibition, not just voice).
- **PURE-HELPER TEST PATTERN on both surfaces (no DOM render).** No `@testing-library/react` on web, no DOM lib on mobile, so the prompt's decision logic is extracted: web `overCommitResolution.ts` + mobile `overCommitHelpers.ts` (DUPLICATED per surface per the 040/057 twin precedent — mobile has no apps/web dep and reads its local `PlanBlock` mirror; only the COPY is shared). Both assert selection→PATCH mapping, nothing-fires-until-chosen, split-task-defers-together, and `collectTaskBlockIds` joining by id through `details.tasks` (work blocks only). **NO second plan query, client, placement algorithm, or mutation route authored.**

---

### STRIPE WEBHOOK HANDLER landed (084); Stripe live cutover OPEN
**Owner:** The Cutover operator (test→live key/Tax/webhook registration + `STRIPE_WEBHOOK_SECRET`); Chat 074 (delayed_jobs reconcile consumer)
**Relevant-to:** any chat touching subscription state, the subscriptions row, the web billing surface, or the reconcile-job queue; the Cutover chat
**Status:** Open — 083 (checkout+portal) + 084 (webhook handler) both shipped; only the live cutover (key swap, live webhook endpoint registration) NOT done
**Detail:** 083 completed the two web-only Stripe billing entry points on `@vesper/web`. Session creation ONLY — no state write, no webhook, no migration, no new copy. Durable facts:
- **Both routes were already correct on main** (Chat 030 landed more than "stubs"): `apps/web/app/api/v1/subscription/{checkout,portal}/route.ts` + pure builders in the co-located `operations.ts` + `schemas.ts`. 083 did NOT re-edit them (reuse directive; live repo = truth). It added the missing **portal unit tests** + the **runbook**.
- **checkout route** → `POST /api/v1/subscription/checkout` returns `{ url }` (Stripe-hosted Checkout). Builder `createCheckoutSession(stripe, {userId,email})` sets §8 params verbatim: `mode:'subscription'`, `line_items:[{price: STRIPE_PRICE_ID, quantity:1}]`, `customer_email`, `metadata:{vesper_user_id}`, `automatic_tax:{enabled:true}`, `subscription_data:{trial_period_days:0}`, success/cancel on `/settings/billing`. Throws `INTEGRATION_ERROR` if Stripe returns no url.
- **portal route** → `POST /api/v1/subscription/portal` returns `{ url }` (Stripe billing portal). Builder `createPortalSession(stripe, db, userId)` reads `stripe_customer_id` via **raw parameterized SQL** through the in-repo Postgres client (`db.execute(sql\`SELECT stripe_customer_id FROM subscriptions WHERE user_id = ${userId}::uuid\`)`) — the subscriptions Drizzle model is KNOWN-STALE (missing provider/status/stripe_customer_id/+others), so never use the ORM model for this read. **No `stripe_customer_id` (never checked out) ⇒ typed 409 CONFLICT**, before any Stripe call; the portal route NEVER creates a customer.
- **Seam mirrored (single, not a second one):** both routes use `createRoute<StripeUrlResponse>` (auth via the injected `user` + version-gate + §9 error map) and construct `new Stripe(STRIPE_SECRET_KEY)` in the route, injecting the client into the PURE builder so tests pass a plain-object mock (no module mock). `runtime='nodejs'` (Stripe SDK needs Node, not Edge).
- **URL base convention = `NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'`** (helper `appBaseUrl()` in operations.ts; matches the `getReferralCode` precedent). Not a hardcoded domain.
- **STRIPE_PRICE_ID read from env** (`requireEnv`) — the price ($19.99) and price id are NEVER hardcoded in app code. All Stripe env vars already in `.env.example` (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`) — no env change.
- **Test approach = PURE builders, Stripe MOCKED** in `subscription.integration.test.ts` "Stripe sessions (mocked)" suite (ungated, offline). 083 ADDED the portal happy-path (asserts `customer` + `return_url` + `{url:session.url}` mapping via a mocked `db.execute` returning a `stripe_customer_id` row) and the no-customer CONFLICT-without-DB case; the checkout params + INTEGRATION_ERROR tests pre-existed. The DB-gated integration suite (VESPER_DB_TESTS) still covers `getSubscription` + the DB-backed portal 409.
- **Runbook `docs/RUNBOOKS/STRIPE_CUTOVER.md`** (Chat 083, in README index): (1) Stripe Tax onboarding prerequisite — accept Tax terms + register nexus before first live Checkout (`automatic_tax` fails the session otherwise), confirm product tax code `txcd_10103001`; (2) test→live key swap ORDER — `STRIPE_SECRET_KEY`+`STRIPE_PRICE_ID` (both differ live) flipped LAST, after the live webhook exists; (3) webhook endpoint registration at the CF Worker `…/webhooks/stripe` + capture `STRIPE_WEBHOOK_SECRET` (handler itself is a later chat — out of scope); (4) verification (Checkout opens, Portal for a test customer — deferred until a `stripe_customer_id` exists post-webhook, automatic-tax renders, where to watch failures).
- **Explicitly OUT of 083:** no webhook handler, no state transition, no subscriptions-row write, no `users.subscription_status` write, no `subscriptionState.ts` call, no migration/column/trigger, no new voice/butler copy.

**084 — webhook handler landed (new CF Worker).** Durable facts:
- **Placement = a NEW per-worker dir `workers/stripe-webhook/`** (daily-cron is scheduled-only; an HTTP webhook is its own worker). Handler `src/index.ts`; `wrangler.toml` → `main = "src/index.ts"`, `name = "vesper-stripe-webhook"`, `compatibility_flags = ["nodejs_compat"]`, `[vars] RUNTIME = "worker"` (so `createDrizzleClient()` selects the Supavisor pooler). Siblings mirror the 066 worker: `package.json` / `tsconfig.json` (module ESNext, moduleResolution bundler, `lib ["ES2022","DOM"]` for Request/Response globals) / `vitest.config.ts`. NO cron triggers — HTTP `fetch` worker; default export 405s non-POST.
- **State-machine import = `@vesper/shared/subscriptionState` (a NEW export subpath added this chat).** The state machine was exported ONLY via the barrel, which pulls realtime/api-auth/react-email into the bundle. 084 ADDED `./subscriptionState` to `packages/shared/package.json` exports (worker pulls only `@vesper/db`, which it needs anyway) and rebuilt `@vesper/shared` (dist type emitted). Mirrors the queries/onboarding subpath pattern. The old throwing stubs at `apps/web/lib/subscription/stateMachine.ts` are NEVER called.
- **All subscriptions/subscription_events/delayed_jobs I/O is raw parameterized SQL** via `db.execute(sql\`…\`)` (subscriptions Drizzle model is KNOWN-STALE — same rule as 083). userId + current row resolved by raw lookup on `stripe_subscription_id` OR `stripe_customer_id`.
- **Signature verify on the RAW body BEFORE any parse.** `stripe@14.25.0` `constructEvent(payload, sigHeader, secret, tolerance?)` takes tolerance as a **POSITIONAL number, NOT a `{ tolerance }` object** (the object form type-errors) — called `constructEvent(raw, sig, secret, 31536000)`. Mismatch → `400`, no DB touch.
- **Six event → transition mappings** (pure `mapEventToTransition(type, objectStatus?)` in `src/dispatch.ts`, unit-tested): `customer.subscription.created` → `transitionToActive`; `customer.subscription.updated` dispatches on status (`active`→active, `past_due`→past_due, `canceled`|`unpaid`→read_only + set `canceled_at`, other→audit-only no-transition); `customer.subscription.deleted` → `transitionToReadOnly` + set `canceled_at`; `invoice.payment_succeeded` → `transitionToActive`; `invoice.payment_failed` → `transitionToPastDue`; `customer.subscription.trial_will_end` → NO transition, sets `pending_trial_reminder = true` (audit only).
- **Idempotency:** `INSERT INTO subscription_events … ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`; zero rows → replay → `200`, no re-process. (`subscription_events` already carries `UNIQUE(provider, event_id)` live.)
- **Monotonic-ordering guard:** reads `last_event_at`; inbound `event.created` older than `last_event_at − 24h` grace → audit + skip + `200`. Every real transition advances `last_event_at`.
- **Already-in-target guard = choice (a):** pre-read locked status, skip the transition when `current == target`. Needed because a healthy renewal while already `active` isn't a legal source for `transitionToActive` (the state machine would throw on normal traffic). `IllegalSubscriptionTransitionError` is caught → writes a `processing_error` audit row → `200` (no 5xx storm); other errors re-throw → 5xx (Stripe retries).
- **Reconcile enqueue:** on real transitions only, `INSERT INTO delayed_jobs (job_type, payload, scheduled_for) VALUES ('reconcile_subscription', jsonb_build_object('userId', $1), now() + interval '5 minutes')`. INERT until the Chat 074 tick worker consumes `delayed_jobs`.
- **Migration 31 authored** (`20260601000031_subscription_webhook_columns` — up + `.down` + supabase up-only mirror; suffix 31 = lowest free in Block 8-11, highest prior = 24). Both columns were ABSENT: `ALTER TABLE public.subscriptions ADD COLUMN last_event_at timestamptz` (nullable) `, ADD COLUMN pending_trial_reminder boolean NOT NULL DEFAULT false`. Additive-nullable, no enum/trigger. `canceled_at` (pre-existing) is now SET on cancel/delete (081 left it to this chat).
- **NO user-facing copy, NO web route, NO mobile code.** Worker + migration only.
- **Verification (operator ran local Supabase + author ran the rest):** first-ever `supabase db reset --local` applied migrations 24 AND 31 up clean (this was migration 24's first apply anywhere — no edit needed). Reversibility proven via the in-repo Postgres node client (`max: 1`, `sql.unsafe`) against `localhost:54322`: 31.down drops both cols → 31.up re-adds; 24.down → 24.up clean. Full offline gate green: type-check 12/12, test 11/11 (stripe-webhook incl.), lint 8/8, build 5/5 (web compiled).

---

### STOREKIT 2 IAP CLIENT landed (085); server verify + native/device path OPEN
**Owner:** Chat 086 (server-side JWS verify + subscriptions upsert); the Apple-dev-build / EAS / Cutover chat (native + on-device purchase)
**Relevant-to:** 086; any chat touching subscription state, the apple-verify route, or the mobile subscription surface; the EAS/Apple-Developer-Program chat
**Status:** Open — client steps 1–4 shipped; server verify (step 5) + all native/device verification NOT done
**Detail:** 085 built the iOS StoreKit 2 in-app purchase CLIENT + UI on `@vesper/mobile`. No DB, no migration, no server verify (apple-verify is still a 501 stub). Durable facts:
- **Native mechanism = `expo-iap@4.3.6`** (OpenIAP), ADDED as a dependency (neither it nor a native bridge pre-existed). Registered as a config plugin (bare `'expo-iap'`) in `apps/mobile/app.config.js`. The plugin's native mods run ONLY at prebuild/EAS — **inert in Expo Go** (native module absent there), so the real product-fetch / purchase-sheet / JWS path is UNTESTED until an EAS dev build. Peer deps are all `*`, zero runtime deps — low-risk install.
- **JWS field = `purchase.purchaseToken`** — the OpenIAP unified token carries the signed StoreKit 2 JWS on iOS. Mapped to the request body `{ jwsTransaction }` by the PURE helper `lib/subscriptionVerify.ts` (`toVerifyPayload`).
- **apple-verify is a 501 (NOT_IMPLEMENTED) stub** (`apps/web/app/api/v1/subscription/apple-verify/route.ts`) — request Zod `{ jwsTransaction }` in place for 086; full verify + subscriptions upsert is 086. The client treats **any non-200 as "verification pending" without crashing** (`classifyVerifyStatus`: 200→verified, else→pending). `apiClient` throws `ApiError(status)` on non-2xx, so the thin client `lib/subscription.ts` catches it, RE-THROWS the global gates (401/426, owned by `api/client`), and maps everything else (incl. 501) to pending.
- **`finishTransaction` is DELIBERATELY NOT called** by the client — the transaction stays in the StoreKit queue until 086 verifies server-side, so an unverified purchase is never dropped. 086 (or the client once 086 lands) must finish it after a verified 200.
- **Price is NEVER hardcoded** — product name + price render from the runtime-fetched `Product.displayName` / `Product.displayPrice`. `lib/storeKit.config.ts` holds only the product id `com.vesper.standard.monthly` (subscription group "Vesper", display "Vesper Standard") — no price const. `lib/storeKit.testConfig.ts` captures $19.99 ONLY as the Xcode LOCAL-simulation price for a deferred `.storekit` file — read by nothing at runtime.
- **Upgrade UI path = `apps/mobile/app/(tabs)/settings/subscription.tsx`** (a Settings-stack sub-screen, registered in `settings/_layout.tsx`; entry `<Link>` added to `settings/index.tsx`, always shown / not module-gated). Composed from the 107/107a primitives (`Card`, `Button`) + `@vesper/ui` `colors.bronze` (no hardcoded hex). Subscribe → `storeKit.purchaseStandard()` → `verifyApplePurchase()`; a 501 shows "Activation is pending." "Manage subscription" button → `storeKit.showManageSubscriptions()` → `deepLinkToSubscriptions()` (iOS system UI).
- **Mobile-graph safety:** imports only client-safe subpaths — no bare `@vesper/shared` barrel, no `subscriptionState` (server-side), no `api/auth`, no `@vesper/db`, no `@vesper/ai`. The pure helper imports nothing native (testable with no mock).
- **PostHog autocapture OFF** on the new screen — no posthog import, no `track()` call (Decision 08).
- **No new voice/butler copy** — fixed labels are minimal functional strings; product name/price come from StoreKit.
- **vitest globs already cover `lib/*.test.ts`** (`{src,lib,store,app,hooks,components}/**/*.{test,spec}.{ts,tsx}`) — no widen needed. Native-importing modules are mocked (`./api/client` wholesale; the ApiError stand-in is defined INSIDE the hoisted `vi.mock` factory, not top-level, or it errors "cannot access before initialization").

---

### completion_log.value IS NOT NULL (057 finding)
**Owner:** Informational — standing DB-schema constraint
**Relevant-to:** any chat that INSERTs into `completion_log` (analytics writes, plan-gen, block completion, any test seeding block/energy events)
**Status:** Open — standing fact
**Detail:** The applied `completion_log` (migration 20260601000010) columns are `(user_id, block_id, event_type, value, logged_at)` and **`value` is NOT NULL** — every INSERT must supply a `value` jsonb (use `'{}'::jsonb` when there's no payload). 057's DB-gated seed initially omitted it and hit `null value in column "value" ... violates not-null constraint`. `generatePlan.ts` / `logEnergy.ts` always pass a real `value`; mirror that. Reads stay raw parameterized SQL on the real columns (the ORM model `analytics.ts` is STALE — event_name/occurred_at — do not use it; chat-006 drizzle-kit pull is the durable fix). `block_id` is nullable (plan_* / energy rows omit it).

---

### WEEKLY-PLANNING SESSION — steps 1–3 landed (057); steps 4+ OPEN
**Owner:** Any future weekly-planning chat (steps 4+, plan-regeneration handoff)
**Relevant-to:** the chat building weekly-planning steps 4+; any chat touching weekly-priorities, the Sunday prompt, or `/weekly-review`
**Status:** Open — steps 1–3 shipped, steps 4+ / plan regeneration / regeneration handoff NOT built
**Detail:** 057 built steps 1–3 dual-surface (web `app/(app)/weekly-planning/page.tsx`, mobile `app/weekly-planning.tsx`). Key durable facts:
- **Target week = the COMING Monday** (`addDays(mondayOf(now),7)`) — a Sunday session plans the week ahead; surfaces pass `weekStart=comingMonday`, server derives the reviewed prior window `[targetMonday−7, targetMonday)`.
- **Step-1 completion source (DECISION A):** new thin **`GET /api/v1/weekly-review[?weekStart]`** reads `completion_log` block events; denominator = **actioned-share** `block_completed / (block_completed+block_skipped+block_rescheduled)`; `rate=null` when 0 actioned → plain "nothing to review yet" (never `weekly_priorities.completedAt`, which is structurally always null).
- **AI suggestion seam (DECISION B):** no route exposed `suggestWeeklyPriorities`, so 057 added thin stateless **`POST /api/v1/weekly-priorities/suggest`** (body-driven, mirrors `ai/command`); mobile reaches it via the thin client and NEVER imports `@vesper/ai`.
- **029 weekly-priorities API consumed as-is** — camelCase boundary, 3–5 enforced server-side, PUT items carry only `{ text, source }`; source flips `ai_suggested`→`user` on edit (pure `buildPrioritiesSubmission`, DUPLICATED per surface, not shared).
- **Step 3 (DECISION D):** READ-ONLY event review over the target-week Mon–Sun window via the landed `/calendar-events` range route; edits link out to the Calendar surface (web `/calendar`, mobile `/(tabs)/calendar`); Confirm persists nothing. No calendar CRUD/DELETE here (avoids the 054-W `.delete()` 204 bug).
- **Sunday-prompt dismissal (DECISION C):** client-only, NO API/DB. Web = `localStorage`; mobile = existing `secureStorageAdapter` (expo-secure-store; same adapter `device_id` uses — no new dep). Keyed `userId + targetWeekStartDate` (re-appears next Sunday, no cross-account leak). Two lines transcribed verbatim from PRD §6.7 — NOT voice-gated.
- **Mobile route placement:** mobile has no `(app)` route group (root Stack over `(auth)`+`(tabs)`); the session screen lives at **root `app/weekly-planning.tsx`** (NOT under `(tabs)`, which would register a stray 5th tab) and is reached via `router.push('/weekly-planning')`. Prompt hosted in the real `app/(tabs)/plan.tsx` day view (chat 040 — it is NOT a stub, contrary to earlier assumptions).

---

### TYPED ROUTES stale on a NEW route → standalone tsc fails (057 finding)
**Owner:** Informational — standing gotcha for any chat that adds a NEW route + links to it
**Relevant-to:** any chat adding a new web route (Next `experimental.typedRoutes`) or a new expo-router route and navigating to it (`Link href` / `router.push`)
**Status:** Open — standing
**Detail:** Both apps use typed routes. The literal route-type union is regenerated only by a build/dev run (web: `.next/types/*`; mobile: expo-router's generated types). `pnpm type-check` runs `tsc --noEmit` standalone against the STALE generated types, so a brand-new route fails: web `Type '"/x"' is not assignable to RouteImpl<...>`, mobile `Argument of type '"/x"' is not assignable to ... RelativePathString | ...`. Fixes that don't depend on regeneration: **web** — pass the `UrlObject` form `href={{ pathname: '/x' }}` (the Link union accepts `UrlObject`); **mobile** — `router.push('/x' as Href)` (`import { type Href } from 'expo-router'`; it is re-exported from the root via `export type * from './types'`). 057 hit this for `/weekly-planning` on both surfaces. Existing routes are unaffected (already in the generated types).

---

### pnpm build CRASHES with access violation on Windows (057 observation)
**Owner:** Informational — operator env (Windows)
**Relevant-to:** any chat running `pnpm build` in the local gate on Windows
**Status:** Open — environmental, non-deterministic
**Detail:** `next build` for `@vesper/web` on this Windows machine has crashed with exit code **3221225477** (`0xC0000005` STATUS_ACCESS_VIOLATION) during "Creating an optimized production build", AFTER type-check/lint were clean — i.e. a native SWC/Node crash, NOT a TS/lint error. Also: `pnpm type-check` can take ~18min (mobile `tsc` over RN types is genuinely slow) and the batch prompt "Terminate batch job (Y/N)?" can look like a hang — it's waiting on input, not stuck. Guidance: judge build "no NEW errors vs main" from the ERROR OUTPUT, not the crash exit; retry the build once; don't chase the crash as a code defect. The pre-existing `@types/react` 18-vs-19 skew in `apps/web` is a separate known non-issue.

---

### EXPO GO SDK 52-vs-54 RENDER BLOCK (053) — render walk RECORDED, operator-UNCONFIRMED
**Owner:** Operator env / SDK-bump owner
**Relevant-to:** any later mobile on-device verification; see the "EXPO GO SDK RENDER — VISUAL render pending" flag (the conservative truth)
**Status:** Open — a per-screen render walk was RECORDED (below), but the operator has NOT confirmed seeing screens render; treat on-device render as UNVERIFIED until the pending visual check is done. Contradicts nothing once read as "recorded, not verified."
**Detail:** SDK 52→54 bump (PRs #62/#63) + barrel split (PR #64) unblocked on-device render; bundle builds clean (2657 modules). An on-device Expo Go walk was RECORDED via a since-removed `__DEV__` sign-in bypass, but is operator-UNCONFIRMED (see Status). RECORDED RESULTS (reported pass — no redboxes; data/error states expected under bypass + unreachable API):
- 011 sign-in — pass (renders pre-bypass)
- 013 shell — pass (tab bar Plan/Tasks/Calendar/Settings, routed in)
- 054 plan — pass; minimal/near-stub appearance — RE-CHECK appearance once real data + plan synthesis reachable
- 054 tasks — pass (list UI, sort controls, new-task button; "could not load" data error expected)
- 053 calendar — pass (month grid, today highlighted; "could not load" data error expected)
- 063 settings + integrations — pass (settings tree, Connect button navigates)
- 090b privacy — pass (biometric toggle renders; "could not save" write error expected)
NOT covered by this walk (still open, separate track): real auth, real data, and button/mutation behavior — all blocked on a dev build (Apple enrollment + EAS) AND a phone-reachable API (web API currently localhost:3000, unreachable from device; hosted Supabase has no migrations yet). Custom-native screens 059b/077 remain Expo-Go-inert by design.

---

### MOBILE FUNCTIONAL/AUTH/DATA TEST — BLOCKED on dev build + reachable API
**Owner:** Apple Developer Program / dev-build chat; any mobile E2E chat
**Relevant-to:** Apple-dev-build chat; any chat scoping mobile functional (not render) verification
**Status:** Open — deferred to dev-build track
**Detail:** Mobile screens are RENDER-verified (see EXPO GO SDK flag) but NOT functionally verified. Two stacked blockers: (1) no real session on device — Expo Go can't complete any sign-in; needs expo-dev-client (Apple enrollment + EAS, no Mac). (2) Mobile data calls target the web API at `localhost:3000`, unreachable from a physical phone — needs the web app deployed or tunneled. Also: hosted Supabase project (`gexrqyaggqexpfidfwnp.supabase.co`) has NO migrations yet — DB must be migrated/seeded before data renders. Full functional walk needs all three: dev build + reachable+migrated backend.

---

### HOSTED SUPABASE PROJECT EXISTS (mobile on-device test)
**Owner:** Informational — operator env
**Relevant-to:** any chat scoping on-device mobile against a real backend
**Status:** Open — informational
**Detail:** A hosted Supabase project exists (`gexrqyaggqexpfidfwnp.supabase.co`, Free tier, us-west-2), Google provider enabled with the existing `GOOGLE_CLIENT_ID/SECRET` + the Supabase callback added to the Google OAuth client, and `vesper://auth/callback` in the redirect allow-list. `apps/mobile/.env.local` now carries `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` pointing at it (mobile reads `EXPO_PUBLIC_*`, not `NEXT_PUBLIC_*`). Project has NO migrations yet. The `NEXT_PUBLIC_SUPABASE_URL` in that file still points at the local stack (`127.0.0.1:54321`) — harmless for mobile (ignored), but stale if anything web-side ever reads it.

---

### TASKS DRIZZLE MODEL CURRENT
**Owner:** Informational — 028 finding
**Relevant-to:**  055, 056, any tasks-touching chat
**Status:** Open — informational
**Detail:** `packages/db/src/schema/daily-planning.ts` tasks table matches
TECHNICAL_SPEC §3 column-for-column (verified in 028); 028 used the Drizzle
model, NOT raw SQL. Stub drift is table-specific — still verify per-table, but
the tasks model needs no raw-SQL fallback.

---

### BIOMETRIC LOCK (090b — landed)
**Owner:** Cutover (Info.plist) + any mobile settings/auth chat
**Relevant-to:** Cutover Block (Face ID usage string); any chat touching PUT /profile, mobile settings, or store/auth.ts signOut
**Status:** Closed-feature / operational notes
**Detail:** `users.biometric_lock_enabled` is now writable via `PUT /api/v1/profile`
(`biometricLockEnabled` optional bool → `biometric_lock_enabled`). The 030/earlier route was
PARTIAL; 090b extended the Zod schema + handler. The handler writes the scalar via a raw SQL
`UPDATE` because `biometric_lock_enabled` exists in the migration but is MISSING from the
pull-generated Drizzle `users` model — a next `drizzle-kit pull` should surface it (same class as
MIGRATION/DB-INFRA STANDING; `db:pull` still broken). New mobile surface: Settings → Privacy →
Biometric lock, OFF by default, persists the server scalar + a local expo-secure-store cache. Lock
policy: required on cold start and on foreground after >60s background; 3 failed attempts →
shared `store/auth.ts` signOut + magic-link re-auth (no second sign-out path). New dep:
`expo-local-authentication ~15.0.2` (Expo SDK 52) — standard Expo module, testable in Expo Go on
iPhone, NO EAS build needed; `pnpm install` is required before mobile type-check/build.
`app.config.js` has the Face ID `Info.plist` usage string pre-staged — no-op for Expo Go, only
matters at the Cutover native build. `useBiometricLock` now owns the chat-013 `useAppLifecycle`
mount internally; the standalone `useAppLifecycle()` line was removed from `_layout`. PR #53.

---

### GCAL TOKEN ENCRYPTION MODEL (063 — decided)
**Owner:** Decided in 063; operational for GCal/encryption chats + Cutover
**Relevant-to:** 064, 034-W, any integrations/token chat; Cutover (prod key)
**Status:** Closed-decision / operational
**Detail:** App-side encryption. `packages/db/src/encryption.ts` uses a Node libsodium AEAD
binding keyed from `process.env.PGSODIUM_KEY` (nonce-prepended bytea ciphertext in
`integrations.access_token_encrypted` / `refresh_token_encrypted`). In-DB pgsodium key store
REJECTED — Supabase has pgsodium pending deprecation and advises against its Server Key
Management / Transparent Column Encryption. §14 #1 / LAYER_3 "pgsodium extension" + build-plan
"Supabase secret" wording are loose, superseded by §13. OAuth: manual {code,redirectUri}
exchange at oauth2.googleapis.com/token; dedicated callback page at
`apps/web/app/(app)/settings/integrations/callback/page.tsx`. Verified end-to-end (293-byte
ciphertext round-trips; connect→audit INSERT, disconnect→audit DELETE).
064 CONFIRMED the helpers are `encryptToken` / `decryptToken` (libsodium XChaCha20-Poly1305,
nonce-prepended bytea, no-AAD). Any consumer outside @vesper/db that imports the encryption helper
must DYNAMIC-import it — a static import pulls libsodium onto the graph and breaks vitest's SSR
transform (same class as the @vesper/db barrel rule). 064 loaded it via dynamic import for this reason.

---

### PGSODIUM_KEY — PROD KEY REQUIRED, IRREVERSIBLE (operational)
**Owner:** Cutover / deploy
**Relevant-to:** Cutover Block; any prod deploy
**Status:** Open — operational
**Detail:** The 063 `PGSODIUM_KEY` lives only in local `.env.local`. Production (Vercel) needs
its own unique `PGSODIUM_KEY`. If the prod key is lost, every stored OAuth token is permanently
unrecoverable (users must re-auth — see `PGSODIUM_KEY_ROTATION.md`). Do NOT reuse the local key
in prod; back up the prod key securely.

---

### PROD GOOGLE CALENDAR OAUTH CLIENT (063 — not prod-ready)
**Owner:** Cutover / deploy
**Relevant-to:** Cutover Block; 064; any GCal prod deploy
**Status:** Open — operational
**Detail:** 063 connect route currently FALLS BACK to `GOOGLE_CLIENT_ID/SECRET` (the
Supabase-Auth sign-in client) because `GOOGLE_OAUTH_*` aren't set. For prod: (a) create a
dedicated Calendar OAuth client with `calendar.readonly`, (b) register prod redirect
`https://vesper.day/settings/integrations/callback`, (c) set `GOOGLE_OAUTH_CLIENT_ID/SECRET` +
`NEXT_PUBLIC_GOOGLE_CLIENT_ID`, (d) submit the consent screen for Google verification
(unverified-app warning blocks scale beyond test users).

---

### LOCAL SENTRY DSN MISCONFIG (063)
**Owner:** Operator local env
**Relevant-to:** Any chat relying on local Sentry error capture
**Status:** Open — local-env hygiene
**Detail:** Local `.env.local` `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` hold an `sntryu_…` auth
token, not a DSN, so Sentry silently no-ops locally (no local error reporting). Not a code flag;
fix the DSN values if local Sentry visibility is wanted.

---

### STALE push_tokens + subscriptions + integrations + calendar_events + bills DRIZZLE MODELS
**Owner:** Informational — 030 + 063 findings (durable fix = drizzle-kit pull, currently BROKEN)
**Relevant-to:** 035-W (push_tokens); 081, 089-W, 072 (subscriptions); 064, 034-W (integrations), 53, any calendar touching chat
**Status:** Open — informational
**Detail:** STALE vs TECHNICAL_SPEC §3, confirmed: `push_tokens` (missing live_activity_token,
last_used_at; wrong uniqueness), `subscriptions` (missing provider, status, +5 cols), and
`integrations` (text vs bytea, phantom `scopes`, missing last_synced_at/last_error, 1-value enum,
063 finding). Use raw parameterized SQL against the migration columns. `db:pull` resync is BROKEN
(`./gel-core is not exported` — drizzle-kit↔drizzle-orm version mismatch); recipe to unbreak =
pin drizzle-kit 0.29.1 + drizzle-orm 0.38.4 then `db:pull`, or hand-correct. Stub drift is
table-specific: verify each table column-for-column; treat these three as known-stale → raw SQL.
- users (090b + 032-W): biometric_lock_enabled present in migration, MISSING from the pull-generated Drizzle users model → 090b wrote the scalar via raw SQL UPDATE. 032-W (CC-reported) found sleep_target_bedtime + sleep_target_wake ALSO absent from the hand-authored users.ts model (only location_lat/lng present); honorific IS present (users.ts:38). Same stale-TS-schema class — whoever wires the real user/profile fetch in the post-032-V onboarding shell may need a raw SQL read for the two sleep_target columns. Verify-per-table still holds.
- calendar_events (052-W): NO Drizzle model exists at all (not just stale) — 052-W ran all CRUD via raw parameterized SQL + validateSession + createDrizzleClient. Same db:pull-broken class. Next drizzle-kit pull should emit it; until then any calendar_events code stays raw SQL + verify columns per-table.
- bills (061): a `bills` Drizzle model DOES exist in `packages/db/src/schema/modules.ts` but has DRIFTED HARD from the live migration-0006 DDL - it carries a phantom `autopay boolean` column that does NOT exist on the DB, marks `amount`/`due_day_of_month` NOT NULL (both are NULLABLE live), and OMITS the real `frequency bill_frequency_enum NOT NULL` + `category text` columns. Using it would fail at runtime (insert of a non-existent column / missing NOT NULL frequency). 061 therefore ran ALL bills CRUD via raw parameterized SQL (calendar_events/push-tokens precedent) and did NOT edit the model (out of scope). A future drizzle-kit pull / schema-resync should replace the drifted stub; until then bills code stays raw SQL. Live bills cols (verified via node client): id, user_id, name(NN), amount numeric(10,2) NULL, due_day_of_month int NULL CHECK 1..31, frequency bill_frequency_enum{monthly,quarterly,annually,one_time} NN, category text NULL, created_at, updated_at.
- integrations (064): live column contract re-confirmed (11 cols, access/refresh_token bytea, the two
  enums) via the in-repo Postgres node client; 064 used raw parameterized SQL throughout. The
  audit_integrations_changes-on-UPDATE path was NOT exercised live (no google_calendar row in the local
  DB) — trigger is migration-11 infra, untouched; verify on the first real connect.

---

### GCAL EVENT SYNC (064 — landed)
**Owner:** Each later GCal consumer (034-W connect, 067 conflict UI, 099 reconnect banner, plan synthesis)
**Relevant-to:** 067, 099, 065; any chat importing getTodayEvents / CalendarEvent or reading integration sync state
**Status:** Open — landed-feature forward notes
**Detail:** 064 shipped getTodayEvents + automatic token refresh + rule-first/Haiku event classification + the
plan-synthesis wiring. PR #57.
- PLACEMENT DEVIATION (load-bearing): `getTodayEvents` AND the `CalendarEvent` type live in **@vesper/ai**, NOT
  @vesper/shared as the build-plan path said — @vesper/shared must not depend on @vesper/ai + @vesper/db. Any
  later importer uses **@vesper/ai**, not packages/shared/integrations.
- block_type IS COMPUTED BUT NOT CARRIED: the classifier runs (rule-first → batch 2+ / single 1 / none 0) but
  CalendarEvent stays `{id,title,startTime,endTime}` — the classification is breadcrumb-only and currently has
  NO consumer. 067 (conflict UI) must add a field to the event shape or a side channel, or the classify work
  stays inert. PlanContext.calendarEvents shape was deliberately left unchanged.
- RECONNECT-BANNER TRIGGER: the surface trigger is `integrations.status='error'`, NOT `last_error IS NOT NULL`,
  so a transient error the next sync recovers does not flicker the 099 banner. Sentry breadcrumb fires on every
  refresh attempt (so transient failures stay visible even after last_error is overwritten on recovery).
- DYNAMIC-IMPORT RULE: anything in @vesper/ai that needs @vesper/db/encryption must dynamic-import it (static
  import breaks vitest SSR via libsodium). See the GCAL TOKEN ENCRYPTION MODEL flag.
- getTodayEvents performs integrations bookkeeping writes (last_synced_at / status) inside the generate-only
  synthesis path — sync metadata, not plan persistence; within the Decision-4 boundary.

---

### GCAL PUSH WEBHOOK (065 — landed; channel-state persistence CLOSED by 066)
**Owner:** the Cutover operator (C-17 real channel registration — the only remaining open item)
**Relevant-to:** 034-W / Cutover (registerWatch call site); any chat touching the integrations row or GCal sync
**Status:** Channel-state persistence + channel→user mapping CLOSED by 066 (migration 24 + wired resolveChannelUser). Only real channel registration remains, Cutover-blocked (C-17).
**Detail:** 065 shipped the push-notification receiver + an authored-but-uninvoked `registerWatch`. 066 added the persistence + mapping (see GCAL CHANNEL RENEWAL (066) below).
- **ROUTE CONVENTION:** unauthenticated raw `POST` handler at `apps/web/app/webhooks/google-calendar/route.ts`
  (OUTSIDE /api/v1). `runtime='nodejs'`, `dynamic='force-dynamic'`. NO createRoute / validateSession /
  checkAppVersion — Google is the only caller and cannot present a session. No prior `app/webhooks/` route
  existed (Stripe/Apple webhooks are on Cloudflare Workers); it follows the `api/v1/internal/auth-event`
  secret-validated raw-handler shape (constant-time compare, fail-closed).
- **TOKEN VALIDATION = ENV SECRET, not a DB row:** the `X-Goog-Channel-Token` is validated (constant-time)
  against the deployment env var **`GOOGLE_WEBHOOK_CHANNEL_TOKEN`** (added to `.env.example`, placeholder only).
  Mismatch → 401 + Sentry alert + NO sync. NOT a per-channel DB value — integrations has no channel columns.
  The pure classifier `validateNotification.ts` (co-located; imports nothing native) maps headers →
  `{action:'ignore'|'ack'|'sync', tokenValid}`: `sync` state → ack (200, no sync); `exists` → trigger; else ignore.
- **SYNC SEAM = INLINE re-invocation of 064 `getTodayEvents`, NOT enqueued:** the `delayed_jobs` table exists
  (migration 16) but has ZERO code refs — no enqueue helper, no tick worker dispatching job_types — so the
  enqueue seam is not reusable. `exists` therefore RE-RUNS `getTodayEvents` (a re-fetch through the existing
  seam). There is **NO persisted Google syncToken anywhere** (no column), so this is NOT a true Google delta.
- **CHANNEL-STATE PERSISTENCE GAP — CLOSED by 066:** `events.watch` returns `{id, resourceId, expiration}`; 066's
  migration 24 added `integrations.channel_id / resource_id / channel_expiration` (all nullable; `channel_id` indexed),
  and `persistChannelState` (`@vesper/ai`) is the single write path. The **channel→user mapping is CLOSED** too:
  `resolveChannelUser` now does a real `SELECT user_id ... WHERE channel_id = $1` lookup (an unresolvable channel still
  logs `syncOutcome:'error'` + 200s — fail-soft unchanged). NO `sync_token` column (no delta anywhere; full re-fetch).
- **registerWatch AUTHORED BUT NOT INVOKED (re-homed to `@vesper/ai` by 066):** the implementation moved from
  `apps/web/lib/googleCalendar/registerWatch.ts` to `packages/ai/src/integrations/registerWatch.ts` so the daily-cron
  worker can import it worker-safely; the old path is now a thin re-export (065's landed test still passes). It calls
  `events.watch` (generated channel id, the same `GOOGLE_WEBHOOK_CHANNEL_TOKEN`, address
  `${NEXT_PUBLIC_APP_URL}/webhooks/google-calendar`, type `web_hook`), decrypts via `import('@vesper/db/encryption')`.
  Still nothing invokes it in dev — real channel registration is **Cutover-blocked (C-17)** (verified public HTTPS
  domain), deferred to 034-W / Cutover.
- **RECEIPT→SYNC = ONE Sentry event:** every receipt logs one structured `Sentry.captureMessage` entry carrying
  channel id / resource id / message number / token-validation result; on a triggered sync the outcome
  (success | no-changes | error) is appended to that same entry. Reuses 064's `@sentry/nextjs` — no second client.
- **ENV ADDED:** `GOOGLE_WEBHOOK_CHANNEL_TOKEN` (placeholder). `NEXT_PUBLIC_APP_URL` reused (already present) for the
  webhook address — no new base-URL var. NO migration / column / trigger / UI / React / mobile / butler copy authored.
- **TESTS:** pure `validateNotification.test.ts` (9 offline cases: valid+exists→sync, valid+sync→ack, mismatch/missing/
  no-secret→tokenValid:false, malformed→ignore, not_exists→ignore) + `registerWatch.test.ts` (5 cases, fetch mocked +
  `@vesper/db/encryption` decrypt stubbed — NO libsodium module-graph mock; asserts the watch request body + the
  `{id,resourceId,expiration}` mapping). Web vitest glob `{app,lib,components}/**` already covered both — no widening.

---

### GCAL CHANNEL RENEWAL (066 — landed)
**Owner:** the Cutover operator (C-17 first real channel registration; the worker is inert until then)
**Relevant-to:** 034-W / Cutover; any chat adding a daily-cron module; any chat touching the integrations channel columns or GCal push
**Status:** Landed — channel-state migration + renewal worker + channel→user mapping done; runs live only post-Cutover.
**Detail:** 066 built the daily renewal worker + the channel-state schema 065 had no column for, CLOSING the 065 persistence + mapping gap.
- **MIGRATION 24 — `20260601000024_gcal_channel_state`:** adds `integrations.channel_id text`, `resource_id text`,
  `channel_expiration timestamptz` (all NULLABLE — add-nullable pre-launch shape) + partial index
  `idx_integrations_channel_id ON (channel_id) WHERE channel_id IS NOT NULL` (receiver looks up user by channel_id per
  push). Suffix **24** (22 RETIRED per allocation doc, 23 taken; 24 is lowest genuinely-free in 14–30). BEGIN/COMMIT,
  matching `.down.sql` + up-only `supabase/migrations` mirror. **NO `sync_token`** (065 persists no delta), **NO enum value**
  (sink is Sentry-only, see below) — so the migration is pure reversible column-adds. Drizzle model
  `packages/db/src/schema/integrations.ts` extended with the 3 camelCase columns + the index (model otherwise still
  stale vs the real bytea columns — not reconciled here; channel state is read/written by raw SQL, per 063/064).
- **COMPLETION-LOG SINK = option B (Sentry-only), NOT a completion_log row:** the run is observed via ONE structured
  `Sentry.captureMessage('gcal-channel-renewal run', {attempted,succeeded,failed})`. Reason: `completion_log.user_id` is
  NOT NULL + FK, so there is no valid aggregate/run-level row, and per-user rows would need a non-reversible
  `ALTER TYPE completion_event_enum ADD VALUE`. This SUPERSEDES the build-plan's aggregate-completion_log line. Per-user
  FAILED renewals are still Sentry-logged individually (`renewal-failed`, carries userId + integrationId).
- **RENEWAL DECISION = pure helper `selectChannelsToRenew(rows, now)`** (`workers/daily-cron/modules/gcal-channel-renewal.logic.ts`,
  no I/O): select `status='connected'` AND `channel_expiration` non-null AND `<= now + 24h` (Decision 19; past-expiry
  included). The SQL is a COARSE prefilter (`provider='google_calendar' AND channel_id IS NOT NULL`); the precise
  connected+24h decision lives ONLY in the helper so the boundary is unit-tested offline. **Batch isolation:** each user's
  renewal is try/caught — one failure increments `failed`, Sentry-logs, and NEVER aborts the batch.
- **RENEWAL PATH:** `registerWatch(userId,{db})` (re-registers — Google has no extend) → `persistChannelState(userId,channel,{db})`
  writes the new `{id→channel_id, resourceId→resource_id, expiration→channel_expiration}`. Both from `@vesper/ai` (single
  registration + single persistence path — importable by the worker AND the deferred Cutover call site).
- **DAILY-CRON SCAFFOLD (Decision 20) — ESTABLISHED this chat:** `workers/daily-cron` did NOT exist; 066 scaffolds the
  MINIMAL consolidated shell — `wrangler.toml` (single hourly cron `0 * * * *`, `nodejs_compat`), `src/index.ts` dispatches
  hour-of-UTC → module, `gcal-channel-renewal` registered at the **05:00 UTC** tick. New workspace glob **`workers/*`**
  added to `pnpm-workspace.yaml`; package `@vesper/daily-cron`. Later daily modules (trial-reminder, dunning-check,
  hard-delete, reconciliation, bill-reminder, spend-monitor) extend the `HOURLY_DISPATCH` table — they do NOT restructure
  the shell. DB access = canonical `createDrizzleClient` (Supavisor pooler in worker ctx, Decision 04); real CF-runtime
  Postgres driver/binding (Hyperdrive) + Sentry transport are operator/Cutover concerns (worker inert pre-Cutover).
- **HEARTBEAT:** the one `run` summary message per dispatch is the signal the 097a "worker-didn't-run" defense keys on
  (expected within a 90-min window of the 05:00 UTC tick).
- **RESOLVE-CHANNEL-USER wired:** `apps/web/app/webhooks/google-calendar/resolveChannelUser.ts` (extracted from the 065
  route's null seam) does `SELECT user_id FROM integrations WHERE channel_id=$1 AND provider='google_calendar'`; injectable
  db for offline tests; route shape/token/runtime unchanged. Unresolvable → null → `syncOutcome:'error'` + 200 (fail-soft
  unchanged from 065).
- **RUNBOOK:** `docs/RUNBOOKS/GCAL_CHANNEL_RENEWAL.md` (detection query for past-expiry channels; manual re-register via the
  same registerWatch+persist path; email-affected decision tree; verification incl. confirming the worker fired). Index
  entry in `RUNBOOKS/README.md` pre-existed (already listed Chat 066) — no index edit.
- **ENV:** none new (065's `GOOGLE_WEBHOOK_CHANNEL_TOKEN` + `NEXT_PUBLIC_APP_URL` reused).
- **TESTS:** `gcal-channel-renewal.test.ts` (helper boundary offline: connected+24h/past selected, disconnected/error/null/
  outside-window excluded, edge inclusive; module with db+registerWatch+persist injected: only within-24h connected
  attempted, success persists mapped state, single failure isolated + counts correct) + `resolveChannelUser.test.ts`
  (seeded row→user, no row→null).

---

### CALENDAR (052-W + 53 — landed)
**Owner:** Each later calendar surface (053 mobile; any calendar UI/edit chat) + spec maintenance
**Relevant-to:** 053; any chat touching calendar_events, calendar UI, or recurrence
**Status:** Open — landed-feature forward notes
**Detail:** 052-W shipped the web built-in calendar (PR #54).
- LIBRARY: react-big-calendar (web only) — chosen over FullCalendar (lighter bundle, plain-CSS theme maps to @vesper/ui tokens, reuses installed date-fns). FullCalendar rrule plugin moot since recurrence is expanded in-app. Mobile (053) uses react-native-calendars, a separate decision.
- CRUD TRANSPORT: new /api/v1/calendar-events route set (raw parameterized SQL + validateSession + createDrizzleClient), matching the tasks/blocks/push-tokens own-row convention. Mobile + any later surface must CONSUME this route, not author a second transport.
- RECURRENCE: calendar_events stores ONLY the RRULE string + series start/end; instances are EXPANDED ON READ (rrule lib), never persisted. Editing a recurring event edits the WHOLE SERIES by id — no per-instance EXDATE/exceptions. "Edit this occurrence only" needs new design (likely an exceptions table → a migration).
- rbc-theme.css holds LITERAL token hexes (CSS can't read Tailwind tokens) — if @vesper/ui token values change, hand-sync rbc-theme.css (each hex is commented with its token name).
- NEW WEB DEPS: react-big-calendar, rrule, @types/react-big-calendar — pnpm install required before web type-check/build on a fresh checkout. react-big-calendar carries a React-18 peer warning under React 19 (same class as @hello-pangea/dnd); installs/builds fine.
- /calendar route not yet in any nav — page mounts under (app) but no link added (no nav shell exists; plan/week/tasks are stubs). Wire into nav when the app-shell chat lands.
- MIGRATION DOC DRIFT (to file): TECHNICAL_SPEC §3 says calendar_events lives in 000016 new_feature_tables — FALSE. Repo: 000016 = delayed_jobs; calendar_events = standalone 000018 (pkg + supabase mirrors). Repo = truth; spec needs correcting.
- 053 (mobile) shipped (PR #55). react-native-calendars@^1.1312.0 has NO native RRULE support; the existing GET /api/v1/calendar-events already returns server-expanded instances (operations.ts→recurrence.ts), so mobile CONSUMES server-expanded instances — no client expander, no rrule mobile dep (avoids drift from the canonical web expander). Files: apps/mobile/app/(tabs)/calendar.tsx, apps/mobile/lib/calendarEvents.ts (thin CRUD client over apps/mobile/lib/api/client.ts), + calendarEvents.test.ts. This thin-client + consume-existing-route shape is the parity pattern for later mobile surfaces (054-W).
- MOBILE DAILY-PLAN FIXED-BLOCK SURFACING = forward gap: apps/mobile plan.tsx / store/plan.ts are still stubs; surfacing calendar-events as fixed blocks in the mobile plan needs a server-synthesis change (apps/web / packages/ai owned) — out of 053 scope; no web/ai touched.

---

### DESIGN SYSTEM PART 2 (107a — landed)
**Owner:** Each later web/mobile UI chat composing form controls / pickers / butler-line / motion; the -V surface halves
**Relevant-to:** 093-V, 032-V, 033-V, 034-V, 035-V, 036-V, 041-V, 044-V, 046-V, 089-V, 095-V, any UI chat
**Status:** Closed — 107/107a DESIGN PRIMITIVES flag CLOSED; part-2 landed (PR #69). Forward notes only.
**Detail:** 107a (PR #69) closed the component library: part-2 primitives in apps/web/components/ui +
apps/mobile/components/ui — TextField, Toggle, Select (web-only), SegmentedControl, TimePicker, DatePicker,
ButlerVoice, and the motion primitives. Compose these; do not re-derive a second form/motion system.
- PICKERS: no picker lib in either app. Web = token-skinned native <input type="time">/<input type="date">
  (time = "HH:mm", date = "YYYY-MM-DD"), round-tripping wakeTarget/bedtimeTarget with zero conversion (matches
  TaskForm). Mobile = composed from TextField (onChangeText string entry); NO datetime-picker dep; the native
  wheel is a deferred on-device pass.
- MOTION: web = CSS transitions on the preset token classes (duration-quick/considered/instant + the standard-
  out/in easing classes) + a useReducedMotion hook over prefers-reduced-motion. Mobile = react-native-
  reanimated (live dep) — declarative FadeIn at band duration + the spring token (damping 18 / stiffness 150);
  reads motion tokens from @vesper/ui, never hardcoded; reduced via AccessibilityInfo.isReduceMotionEnabled →
  instant. (Verify no literal ms/cubic-bezier leaked into the motion files — shallow tests do not catch it.)
- BUTLER SURFACE: ButlerVoice is a THIN WRAPPER composing the existing 107 ButlerLine container — ONE
  container, a copy slot, no authored copy, renders nothing when empty. The copy library is still authored
  later (044). Not a scorekeeping surface.
- WEB/MOBILE ASYMMETRY: Select (native <select>) is web-only; mobile uses SegmentedControl for the select/
  segmented role (RN has no <select>). Stated in both index barrels + DESIGN_SYSTEM.md.
- MOBILE-ONLY NOTES (not relevant to web chats): the mobile TextInput placeholder rides the
  placeholder:text-cream-faint NativeWind variant (no inline hex) — depends on NativeWind v4 placeholder-
  variant support resolving on-device (gated build/lint/test only here). Mobile pickers are text-entry until a
  future on-device pass — same class as the existing expo-font/vellum on-device deferrals.
- NO TOKEN VALUE CHANGED by 107a → rbc-theme.css needed no sync.

---

### DESIGN STRATEGY (106 — landed)
**Owner:** Each design-build chat (107/107a) + every later `-V` surface half; the referral chats (095-V, 095-W)
**Relevant-to:** 107a, 095-V, 095-W, any `-V` visual half, any conversion/retention surface chat
**Status:** Open — landed-doc forward notes
**Detail:** Chat 106 committed `docs/DESIGN_STRATEGY.md` — the binding design-strategy doc every design-build
chat (107 onward) and every later `-V` half follows.
- REFERRAL IS TWO SURFACES: the strategy splits referral into §2.3a referee landing `/r/[code]` (built by
  095-V) and §2.3b referrer settings panel (built by 095-W). Each carries its own Layer 4 persuasion principle
  and its own 24-hr honesty bar — referee landing: Tactical empathy, real/disclosed discount, mistyped code
  soft-redirects, nothing baited; referrer panel: Reciprocity through "together" framing, mutual disclosed
  discount, applied-only, no count/leaderboard. Both UIs are NOT-YET-SCAFFOLDED; 095-V / 095-W build them.
- SCOREKEEPING IS A PRIMITIVE-LEVEL CONSTRAINT: §3 promotes the anti-scorekeeping/anti-gamification discipline
  from a voice rule to a layout+component constraint binding on every surface designed after the doc — no
  grade/score-as-headline/streak/badge/points/level/leaderboard/progress-bar primitive may be built into the
  library. Enforced as component ABSENCE (107 honored this).
- NATIVE SWIFT = BUILD-TRACK-FROM-SPEC: §5 assigns the native Swift surfaces (059b alarm, 077/078 Live
  Activity) to the build track, implemented from a design-track-authored visual spec delivered by 107. The
  design track does not author Swift.
- Persuasion-principle names in the strategy are traceable verbatim to LAYER_4_EXPERIENCE_IDENTITY.md
  "Persuasion Principles Quietly Applied."

---

### DESIGN SYSTEM (107 — landed)
**Owner:** Each later UI chat (composes from these primitives/tokens); 107a (part-2); the native build chats
(059b/077/078)
**Relevant-to:** 107a, every web/mobile UI chat, 059b, 077, 078, any chat editing packages/ui
**Status:** Open — landed-feature forward notes (PR #67)
**Detail:** Chat 107 consolidated the design system onto a single token home and built the part-1 primitives.
- CANONICAL TOKEN HOME = @vesper/ui: `packages/ui/src/tokens.ts` (raw token object) + `packages/ui/src/
  tailwind.ts` (preset), exported via `index.ts`. Web Tailwind and mobile NativeWind both consume the same
  preset; RN style consumers and the Swift mirror read the raw object. Do NOT stand up a second token system —
  extend these.
- PRIMITIVES: Card / Button / BlockRow / ButlerLine in BOTH `apps/web/components/ui/` and
  `apps/mobile/components/ui/`, plus the `cn` helper (web). Later screens compose from these, never re-derive
  tokens. `docs/DESIGN_SYSTEM.md` is the composition reference.
- SCOREKEEPING-AS-ABSENCE confirmed: no grade/score/streak/badge/points/level/leaderboard/progress-bar
  primitive exists in the library.
- FONTS NOT LOADED ON MOBILE: web loads Fraunces/Inter/JetBrains Mono via a Google-Fonts `@import` in
  `globals.css`; mobile `font-display`/`font-mono` classes resolve to family names only (no expo-font dep, no
  font assets). On device, ButlerLine/mono fall back to system fonts until a later on-device chat wires
  expo-font. (107 gate was build/lint only — never rendered on device.)
- WEB FONT @import IS RENDER-BLOCKING + not self-hosted (top of `globals.css`). If the waitlist/landing chat
  cares about LCP, migrate to next/font (needs layout.tsx edits) — deliberately deferred by 107.
- MOTION DURATION TOKENS ARE BAND MIDPOINTS: `duration-quick`=200ms, `duration-considered`=400ms, etc. are
  representative picks; the authoritative `[min,max]` bands live in `motion.duration.bands` (TS) / the Swift
  `*Band` constants. Do NOT treat a single duration token as a locked value — read the band.
- DesignTokens.swift lives at `apps/mobile/ios/Shared/`. The native build chats (059b/077/078) must add it to
  BOTH the VesperAlarmExtension and VesperLiveActivity target memberships and keep it hand-synced with
  `tokens.ts` — no automated check enforces the mirror. Visual specs are at `docs/native/` (alarm 059b, Live
  Activity 078).
- KEEP `packages/ui/src/tailwind.ts` TYPE-ONLY: the `index.ts` barrel now pulls `tailwind.ts`, which
  type-imports `tailwindcss` (erased at runtime → no tailwindcss in the RN bundle). A VALUE import from
  `tailwindcss` into `tailwind.ts` would leak into the mobile bundle via the barrel. Keep that file type-only.

---

### VITEST JSX RUNTIME + PRIMITIVE TESTS ARE SHALLOW (107)
**Owner:** Informational — standing test-infra constraint
**Relevant-to:** Any chat adding web or mobile component tests, or relying on the 107 primitive tests
**Status:** Open — standing
**Detail:** 107 set `esbuild: { jsx: 'automatic' }` in BOTH vitest configs (web tsconfig is `jsx: preserve` →
classic runtime → "React is not defined" without it). JSX no longer needs a React import, but any web component
using `forwardRef` or a VALUE use of React still needs its own `import * as React`. Also the 107 primitive
tests are SHALLOW: mobile tests call the component as a function and read `element.props.className` (NativeWind's
className→style transform is a build step that does not run under vitest); web tests assert class attributes via
react-dom/server markup, not computed CSS. A class typo that Tailwind/NativeWind silently drops at build still
PASSES these tests — a green primitive test is not proof the styles resolve.

---

### EXPO GO SDK RENDER — bundle wall cleared; on-device VISUAL render pending (053→081)
**Owner:** Operator (on-device visual confirm)
**Relevant-to:** Any 🟢 mobile chat needing an on-device Expo Go render check
**Status:** Open — narrowed to operator visual confirmation only
**Detail:** Two stacked blockers, both now down except the final visual check. (1) SDK MISMATCH — RESOLVED: project on Expo SDK 54 (staged 52→53→54, PRs #62 / SDK-54 / #64), App Store Expo Go is SDK 54, so it matches and the app loads on-device. (2) BUNDLE WALL — RESOLVED in 081 (#64): `expo export -p ios` previously failed both ways (hatch-on → node:crypto from subscriptionState; hatch-off → @vesper/db no main) because the mobile graph reached the server-pulling bare @vesper/shared barrel. 081 collapsed mobile onto client-safe subpaths and went Metro-exports-ON; `expo export -p ios` now bundles (2657 modules → 7.25 MB hbc). REMAINING: on-device VISUAL render unconfirmed — `cd apps/mobile && npx expo start`, scan QR. A clean bundle proves load, not render. Custom native bridges (Alarm / LiveActivity) do NOT load in Expo Go → return null by design; alarm/LA features are inert, not broken, in Expo Go — true test needs Mac/EAS. Retire fully only after the operator sees screens render.

---

### EXPO SDK 52→54 BUMP — LANDED (053 / 054)
**Owner:** Any later mobile chat assuming the old stack; SDK-bump maintenance
**Relevant-to:** Any 🟢 mobile chat; any chat citing SDK 52 / RN 0.76 / React 18 / Old-Arch assumptions
**Status:** Open — landed-feature forward notes
**Detail:** apps/mobile bumped 52→53→54 across three PRs (#62 = 53; SDK-54 PR merged; #64 = 081 unblock). Current mobile stack: expo ~54.0.35, react-native 0.81.5, react 19.1.0, New Architecture ON (newArchEnabled unset = SDK default), react-native-reanimated 4.1.x + react-native-worklets 0.5.1 (SDK pin — do NOT install worklets@latest, needs RN 0.83+), babel plugin path `react-native-worklets/plugin` (swapped from `react-native-reanimated/plugin`), expo-router 6.0.x (migration zero-code), @sentry/react-native 7.2.x. Config: Sentry v7 moved its Expo config plugin to the package ROOT (`@sentry/react-native`, was `/expo`); `expo-web-browser` config plugin added by `expo install --fix`. Now-DIRECT deps: react-native-safe-area-context ~5.6.x, react-native-svg. MOOT findings (absent from repo — do NOT re-scope as 54 work): expo-file-system (not a dep, zero imports → /legacy migration moot), SafeAreaView (zero usages → RN-0.81 deprecation migration moot), react-native-draggable-flatlist (dep present, ZERO imports — unused; Reanimated-4 drag-test "swing factor" moot; removal candidate, left in place). Custom Swift bridges' New-Arch native verification stays Mac/EAS-gated (OPERATOR HARDWARE) — not cleared by this bump nor by an Expo Go render.

---

### SENTRY ErrorEvent NAMESPACE (053 / 054 — resolved, watch)
**Owner:** Informational — watch on next @sentry/react-native bump
**Relevant-to:** Any chat editing apps/mobile/lib/sentry.ts or bumping @sentry/react-native
**Status:** Open — resolved, standing watch
**Detail:** @sentry/react-native ≥6.14 dropped `ErrorEvent` from its namespace (only `Event`, from @sentry/core). apps/mobile/lib/sentry.ts was made generic — `scrubEvent<E extends Sentry.Event>(event: E): E` — to round-trip the type `beforeSend` provides without naming ErrorEvent. Confirmed still valid under the 6→7 major (SDK 54). If a future Sentry bump changes the event-type surface again, this is the line to re-check.

---

### TASKS UI (054-W — landed)
**Owner:** Each later tasks surface (055 placement, 056 reflow, any task UI/edit chat); shared-api maintenance
**Relevant-to:** 055, 056; any chat using the shared apps/web lib/api.ts .delete() against a 204 route; any web component test
**Status:** Open — landed-feature forward notes
**Detail:** 054-W shipped the task list UI on web + mobile consuming the existing /api/v1/tasks (PR #__).
- SORT: client-side only (path b). A Priority↔Deadline toggle re-sorts the already-fetched list; default
  reproduces the server order (priority DESC, deadline ASC NULLS LAST). NO route/?sort change — GET exposes
  no sort param.
- in_progress: the list fetches the FULL set with no ?status (a ?status=in_progress would 400); status
  filter tabs + sort are client-side off each task's own status field; in_progress is SET via the edit
  form's status control and shown as a badge — never via a GET filter.
- DELETE 204 / SHARED lib/api.ts BUG (to fix): the shared apps/web lib/api.ts `.delete()` calls res.json()
  and throws on the empty 204 body. 054-W used a DIRECT fetch for task delete rather than editing the shared
  lib (calendar depends on it). ANY future client call to a 204-returning route via api.delete() hits this;
  fix = make api.delete() tolerate an empty body. NOT absorbed — owner = a shared-api cleanup chat.
- vitest discovery: apps/web/vitest.config.ts include + coverage globs were widened from {app,lib} to also
  include components, or new component tests aren't discovered by pnpm test.
- NO @testing-library/react in web deps: 054-W tested an EXTRACTED PURE helper (TaskForm buildSubmission:
  validation/payload builder) instead of a DOM render. Pattern for future web component logic tests until a
  DOM testing lib is added.
- Files: apps/web/components/tasks/{TaskList,TaskCard,TaskForm}.tsx (+ TaskForm.test.tsx), tasks/page.tsx
  mounts TaskList, plan/page.tsx adds a Link href="/tasks"; apps/mobile/lib/tasks.ts (thin CRUD client over
  lib/api/client; listTasks restricts ?status to pending|completed) (+ tasks.test.ts), app/(tabs)/tasks.tsx
  full RN list/card/form, app/(tabs)/plan.tsx adds a Link to /tasks.

---

### TASK PLACEMENT ALGORITHM (055 — landed)
**Owner:** 056 (mid-day reflow/over-commit consumes placement); any chat touching synthesis block output
**Relevant-to:** 056; @vesper/ai synthesis path; anyone reading work-block details.tasks
**Status:** Open — landed-feature forward notes
**Detail:** 055 shipped the deterministic greedy task→work-block placement inside plan synthesis (PR #78).
- PURE MODULE: `packages/ai/src/scheduling/taskPlacement.ts` (+ `.test.ts`, 14 offline tests). No I/O, no DB,
  no model call, no clock. Signature built against the LIVE `PendingTask` from context/planContext.ts
  (`{id,title,estimatedMinutes:number,priority:string,deadline:string|null}`), NOT the §3 snake_case row.
- CARRIER = live-schema truth, NOT build-plan prose. Build-plan says "task → focus block" but the committed
  chat-006 `BlockDetailsSchema` carries the list on the **WORK** variant (`tasks: z.array(z.string())`);
  `focus` is a notes-only GENERIC variant with NO task array. Output populates work `details.tasks`. Element
  = task **ID** string (the tasks-row uuid), NOT the title (2nd commit c75cbeb switched it). Rationale: titles
  are non-unique and a split task repeats across blocks, so a title cannot be joined back to a tasks row (two
  distinct same-title tasks would be indistinguishable); id is the durable join-back key that 056 reflow
  (move/re-status a displaced chunk) and completion logging need. Same id in >1 work block = unambiguously ONE
  split task. Placement OWNS every work block's tasks array when it runs (overwrites model placeholder titles,
  empties non-placed work blocks); model title-ish strings only survive on a ZERO-pending-task day where
  placement is a no-op and there is nothing to join. NO live consumer reads details.tasks today (persist
  stores details as opaque jsonb passthrough; no plan/tasks UI renders it; blocks has NO FK to tasks) — so
  this is forward-safety, no current runtime-behavior change.
- INTEGRATION = deterministic POST-PROCESS (path b), NOT prompt-side. `applyTaskPlacement(plan, pendingTasks,
  calendarEvents)` runs in synthesizePlan.fallback.ts on the GENERATED success path only (right after
  `outcome.plan`, before gatePlanStrings), threaded from synthesizePlan.ts via new optional
  FallbackChainParams `pendingTasks`/`calendarEvents` (default [] → no-op for breaker-open/eval/existing
  tests). NOT applied to the Step-3 hardcoded fallback. Model still decides WHEN work windows sit; the
  algorithm only fills them. NO prompt text changed → **NO version bump** (the 🤖 flag on 055 was a
  prediction; pure post-process closes it without a bump).
- NO VOICE GATE: placement writes only details.tasks (task ids / user's own task rows, never AI copy);
  gatePlanStrings only gates block.title + note, so tasks are never gated. Consistent, no new gate call.
- OPEN WINDOWS: the pure `placeTasks` TAKES windows as input (`OpenWindow{id,start,end}` minutes-from-
  midnight). Windows derived at the integration site FROM the model's work blocks, then `carveOpenWindows`
  subtracts busy intervals (`calendarEventsToBusy` maps timed events; ALL-DAY/date-only events skipped so
  they don't blank the day) → placement can never overlap a fixed calendar event. Carved sub-windows keep a
  `<blockIndex>::<k>` id so capacity is per-piece but placed ids group back (de-duped) per block.
- ALGO: sort priority DESC (high>medium>low) → deadline ASC nulls-last, stable (mirrors readPendingTasks
  fetch order). First-fit whole task into earliest window large enough; else split across LARGEST windows;
  leftover carries to next same-day window; once same-day windows exhausted the remainder is DROPPED (V1
  single-day horizon — cross-day/cross-week rebalance is V2). No min-chunk floor in V1 (MIN_CHUNK_MINUTES is
  a V2 refinement).
- NO migration / NO new column / NO new trigger / NO DB write / NO new persistence path / NO UI/route / NO
  new butler copy. Pure @vesper/ai build.
- Files: packages/ai/src/scheduling/taskPlacement.ts (+ .test.ts); synthesizePlan.fallback.ts (params +
  applyTaskPlacement call + imports); synthesizePlan.ts (forwards pendingTasks/calendarEvents).

---

### AUTH-EVENT VAULT SECRETS (operational)
**Owner:** Cutover / deploy
**Relevant-to:** Cutover Block; any staging/prod deploy chat
**Status:** Open — operational, not a code flag
**Detail:** 030's auth.users UPDATE trigger uses pg_net (`net.http_post`) and reads
two Supabase Vault secrets (`auth_event_secret`, `auth_event_base_url`). Both
FAIL-OPEN to a no-op when unset (so `supabase db reset` never blocks). In any
deployed env the secrets must be set manually or the orphan-push-token cleanup
silently does nothing. Mechanism (pg_net + Vault) was chosen, not spec-specified —
flagged for review.

---

### SUBSCRIPTION STATE MACHINE (081 — landed; consumers must re-point)
**Owner:** Each consuming chat (072 dunning; 082/084/086/087/088/089-W/090)
**Relevant-to:** 072, 082, 084, 086, 087, 088, 089-W, 090; account-delete owner
**Status:** Open — re-pointing required (highest 081 hazard)
**Detail:** Canonical state machine now lives at `packages/shared/src/subscriptionState.ts`
(re-exported from the shared index). The OLD `apps/web/lib/subscription/stateMachine.ts` still
holds 030's throwing stubs (`transitionToActive(_userId)` / `transitionToReadOnly(_userId)`) —
left untouched by 081. Every consumer must (a) switch the import to @vesper/shared AND (b) adopt
the new signature `fn(db, userId, reason?)` — breaking vs 030's `fn(userId)`; the caller must
thread a Database handle (the dunning worker needs a db client in context). Miss it → runtime
NOT_IMPLEMENTED throw. Other 081-created obligations:
- `requestDeletion` is NOT wired into account-delete — that route still does its own direct
  `users` UPDATE (operations.ts), so it does NOT fire provider side effects (Stripe cancel /
  `deletion_requested_at`). Account-delete owner must adopt `requestDeletion` or replicate them.
- Cancel transitions persist `cancellation_reason` but NOT `subscriptions.canceled_at`; future
  cancel work must set `canceled_at` (the §8 webhook handlers do).
- Referral mint: shared can't import apps/web, so 081 implemented the 6-char base62 generator
  INLINE in subscriptionState.ts. If `apps/web/lib/referral/codeGenerator.ts` later lands, 095-W
  must reuse shared's generator or keep both at 6-char base62 or formats drift.

---

### DELETION STRIPE-CANCEL DRIFT (081)
**Owner:** Reconciliation / hard-delete worker owner (074 / hard-delete chat)
**Relevant-to:** 074, hard-delete worker chat, dunning
**Status:** Open
**Detail:** 081 commits `deletion_scheduled` BEFORE the Stripe cancel (moved after commit to
avoid an un-rollbackable external call inside the txn). If the cancel fails, the row is
`deletion_scheduled` but the Stripe sub stays live → user keeps getting billed, silently, unless
a reconciliation sweep re-issues the cancel. No such sweep ships yet — the owning worker chat must
re-issue failed Stripe cancels for deletion_scheduled rows. Documented in
docs/SUBSCRIPTION_STATE_MACHINE.md.

---

### SUBSCRIPTIONS AUDIT TRIGGER GAP (081 finding #1 — to file)
**Owner:** Owning migration chat (006 / 008 / 011)
**Relevant-to:** 006, 008, 011; any subscriptions forensic/audit work
**Status:** Open — recommendation to file
**Detail:** No `subscriptions` AFTER UPDATE OF status trigger exists; §3 reasons
`subscription_events` covers history, but that table is webhook-only (`UNIQUE(provider,event_id)`)
so non-webhook transitions (trial-end→read_only, referral mint, account-delete→deletion_scheduled)
are unaudited anywhere. Recommend the owning migration chat add `audit_subscriptions_changes()`
AFTER UPDATE OF status → `security_audit_log`. 081 authored no trigger and verified by row update.

---

### referral_code LIVE TYPE = text, NOT varchar(6) (081 confirmed)
**Owner:** Informational / schema-audit correction
**Relevant-to:** Any users-schema or audit chat (006); 095-W
**Status:** Open — informational
**Detail:** Live `users.referral_code` is `text UNIQUE NULL` (migration …0002_users.sql), matching
TECHNICAL_SPEC §3. PHASE_4_BUILD_PLAN.md (L457, L515) and the audit-schema.ts assertion say
`varchar(6)` — WRONG. Encode/assert `text` (no length constraint); the mint is 6-char base62 regardless.

---

### PSQL NOT INSTALLED — USE THE IN-REPO POSTGRES NODE CLIENT
**Owner:** Operator local env (standing)
**Relevant-to:** Any chat verifying rows/triggers/schema by SQL
**Status:** Open — standing env constraint
**Detail:** `psql` is not installed on the Windows machine. Any DB/SQL verification (row inspection,
trigger/schema checks) must run through the Postgres Node client already in the repo
(`packages/db/src/client.ts`) via a tiny Node script, NOT `psql`. Kickoffs must state this.

---

### APPLE-VERIFY 501 STUB — CLOSED (086)
**Owner:** 086 (done)
**Relevant-to:** Any chat touching the apple-verify route, subscription state, Apple PKI rotation, or the mobile subscription surface; the Cutover chat
**Status:** CLOSED — server-side StoreKit 2 verify landed 086
**Detail:** `/api/v1/subscription/apple-verify` is now a full implementation (was a 501 NOT_IMPLEMENTED stub from 030). Durable facts:
- **JWS verify is x5c-CHAIN, NOT JWKS.** `apps/web/lib/apple/jws.ts` reads the leaf→intermediate→root chain from the JWS `x5c` protected header, requires the chain to terminate in a PINNED Apple root (the traveling root is NOT trusted), then verifies the JWS signature with the leaf public key via `jose`. Deliberately does NOT fetch `appleid.apple.com/auth/keys` (that JWKS is for Sign In with Apple identity tokens, chats 010/011 — wrong endpoint here). The chain is self-contained ⇒ **NO per-transaction network call to Apple.**
- **keyCache.ts caches the PARSED pinned root(s) only** — `apps/web/lib/apple/keyCache.ts` is a parse-memo of the inline base64 DER constants, NOT the build-plan's "1-hour cache for Apple's intermediate certificates." No JWKS, no network fetch, no TTL. (§8 authoritative over the build-plan wording.)
- **Pin set = inline base64 DER constants** in `apps/web/lib/apple/appleRootCerts.ts` (chose inline constant over a committed .cer asset). Holds TWO slots: current **Apple Root CA - G3** (populated) + an **upcoming-root** slot (empty `der`, filtered out by the accessor) so a PKI rotation is a data-only deploy, never an emergency. Rotation procedure: `docs/RUNBOOKS/APPLE_ROOT_CA_ROTATION.md` (indexed in RUNBOOKS/README.md, Chat 086).
- **event_id form for a StoreKit TRANSACTION** = `originalTransactionId + '_' + transactionId` (the §8 App Store Server Notification form — `origTxnId_notificationType_signedDate` — does not apply; a transaction has no notificationType/signedDate). Stable across re-posts ⇒ `subscription_events (provider, event_id) UNIQUE` is the idempotency key.
- **Idempotency guard keys on `processed_at`, NOT mere row existence.** The event is recorded (committed) BEFORE the upsert + transition, so an attempt that dies mid-flow leaves the row with `processed_at IS NULL`. On `ON CONFLICT` the route re-reads `processed_at`: SET ⇒ true replay (return state, no re-transition); NULL ⇒ a prior attempt was interrupted ⇒ RE-PROCESS (idempotent upsert + guarded transition), else a transient failure after event-record would strand a paid user in `trial` forever. Any future idempotent event-processor over subscription_events must follow this record-then-check-processed pattern, not a bare existence check.
- **subscriptions UPSERT** is raw parameterized SQL (the Drizzle model is KNOWN-STALE), `provider='apple'`, CHECK-compliant (apple_original_transaction_id set, all stripe ids NULLed on a provider switch), keyed `ON CONFLICT (user_id)`. Transition via `transitionToActive` from `@vesper/shared/subscriptionState`; an **already-in-target guard** pre-reads status and SKIPS the transition when already `active` (its legal sources are trial/past_due/read_only/archived, NOT active) so a replay/re-verify can never 5xx. Server does NOT finish the StoreKit transaction — the client finishes on a verified 200.
- **jose** (`^5.9.0`) added to `apps/web/package.json` for `compactVerify`/`importX509` (was NOT previously present).
- **Production E2E stays Cutover-blocked**: real signed transactions need the Apple Developer Program + an EAS dev build (expo-iap native module inert in Expo Go). The offline gate uses a dev-signed self-generated EC chain fixture — no Apple account/key needed.
- **Raw-SQL timestamp bind gotcha** (surfaced by the 086 DB smoke): postgres.js cannot serialize a JS `Date` through the Drizzle `sql\`\`` param path (`TypeError: ... Received an instance of Date`). Bind timestamps as ISO strings + cast `${iso}::timestamptz` (mirrors the persistChannelState / googleCalendar precedent). Applies to any chat writing timestamptz columns via raw parameterized SQL.
- **subscription_events test-isolation gotcha** (surfaced by the 086 DB smoke): `subscription_events.user_id` is `ON DELETE SET NULL`, NOT CASCADE — deleting `auth.users` ORPHANS the event rows rather than removing them, and their `(provider, event_id)` UNIQUE key then makes a later run's FIRST insert look like a replay (`ON CONFLICT DO NOTHING` → empty RETURNING → early return, no subscriptions row). Any DB-gated test touching subscription_events must delete the events explicitly in cleanup AND use unique event_ids per run.
- **VERIFY PIPELINE EXTRACTED TO `@vesper/apple` (087) — files below are now SHIMS.** `apps/web/lib/apple/{jws,keyCache,appleRootCerts}.ts` are each `export * from '@vesper/apple'` re-export shims; the real x5c verify + pinned-root source of truth moved to `packages/apple/src/`. `operations.ts` still imports `verifyAppleTransactionJws` BY NAME (the TXN-field-ASSERTING variant) — the split added a generic non-asserting `verifyAppleJws` for ASSN envelopes but did NOT re-point the route (verified: inner-txn assertion intact). Any chat editing the Apple verify logic edits `packages/apple/src/jws.ts` now, NOT the apps/web shim.

---

### @vesper/shared DIST-VS-SRC REBUILD ORDERING
**Owner:** No owner — note only
**Relevant-to:** Any chat adding new exports to @vesper/shared
**Status:** Open — standing build gotcha
**Detail:** @vesper/shared serves TYPES from `dist/` but RUNTIME from `src/`. New exports are invisible to a consumer type-check until shared is rebuilt: `pnpm --filter @vesper/shared build` BEFORE type-checking the consumer. Declared subpath exports (each: types → `./dist/<name>/index.d.ts`, default → `./src/<name>/index.ts`): `./queries`, `./onboarding`, and `./realtime` (added in 081 — `src/realtime/index.ts` re-exporting createRealtimeClient / createSelfMutationFilter / selfMutationFilter / SELF_MUTATION_WINDOW_MS + realtime types). A new export consumed by the web client must update BOTH `src/index.ts` (barrel) AND the relevant subpath entry, or web/mobile drift. See the @vesper/shared BARREL PULLS SERVER CODE flag.

---

### @vesper/shared BARREL PULLS SERVER CODE INTO CLIENT BUNDLES (038)
**Owner:** Future shared-barrel cleanup for WEB (unowned); mobile half resolved in 081
**Relevant-to:** Any new 'use client' web file importing @vesper/shared; any chat adding a shared export consumed by the web client (032-W, 039, 042, …)
**Status:** Open — ACTIVE for WEB only; MOBILE resolved (081)
**Detail:** The @vesper/shared barrel (`src/index.ts`) statically re-exports `subscriptionState` (node:crypto + @vesper/db) and `api/auth`/`api/route` → @vesper/db → postgres (Node fs/net/tls). Bare barrel is server-pulling; named subpaths are client-safe.
- WEB (still ACTIVE): ANY new `'use client'` web file importing the BARE `@vesper/shared` barrel breaks `next build` (`Can't resolve 'fs'`). Mitigation: import client-safe pieces from a SUBPATH (`@vesper/shared/queries`, `/onboarding`, `/realtime`), not the barrel. Web's bare-barrel `.` imports (createRoute/validateSession/ApiError across api routes) remain server-pulling BY DESIGN — the structural fix (Option B: make `.` client-safe) was deliberately REJECTED in 081 (would ripple to every web/api import). Web hazard persists intentionally.
- MOBILE (RESOLVED, 081 / #64): mobile imported the bare barrel only in providers.tsx + usePlanRealtime.ts. 081 switched them to `@vesper/shared/queries` and a NEW `@vesper/shared/realtime` subpath, then REMOVED the Metro exports hatch (now exports-ON). Mobile graph no longer reaches subscriptionState / api/auth / @vesper/db / node:crypto. `expo export -p ios` bundles clean.
- STALE prior wording (now false under SDK 54): the old "asymmetry is deliberate / mobile node-classic can't resolve subpaths (TS2307) / latent if Metro tightens / do NOT unify" notes are SUPERSEDED — SDK 54 set moduleResolution: bundler + customConditions: react-native, so mobile resolves subpaths and the asymmetry was deliberately collapsed on the mobile side.
- `sideEffects: false` still does NOT work here (tried/reverted in 038) — subpath exports are the mitigation.

---

### OFFLINE MUTATION QUEUE (038 — landed)
**Owner:** Each later block-mutation / day-view consumer (039, 042) + spec maintenance
**Relevant-to:** 039, 042; any chat editing apps/{web,mobile}/app/providers.tsx or the queue helpers
**Status:** Open — landed-feature forward notes
**Detail:** 038 shipped the TanStack Query offline mutation queue + conflict resolution.
- Files: `packages/shared/src/queries/mutationQueue.ts` + `conflictToast.ts` (+ tests), re-exported from the
  barrel AND `@vesper/shared/queries`. providers.tsx (web + mobile) wire the mutationCache + mutation
  defaults; mobile adds the shared mutation persister + cold-start hydrate (own AsyncStorage key, separate
  from chat-013's query cache) + foreground flush; web has NO mutation-cache persistence and flushes on the
  window `online` event. Single flush path (web online / mobile foreground); no NetInfo dep.
- conflictToast is a FIXED-window coalescer (NOT sliding/debounce): the 5s window opens on the first 409 and
  emits once; later 409s only bump the count, never reset the timer. There is intentionally NO clearTimeout /
  teardown — a chat "fixing" it to clear-on-new-409 would break the documented contract + the coalescing test.
- Constraints to preserve in ANY provider edit: self-mutation window = 60s; web has NO mutation-cache
  persistence (mobile only); 409 OPTIMISTIC_LOCK_FAILURE → invalidate + toast (never retried), distinct from
  other 4xx (dropped, surfaced via dev-log + Sentry breadcrumb) and network errors (backoff-retried).
- clientMutationId is minted once, persisted on the mutation, reused across retries AND cold-start rehydrate
  (so `(user_id, client_mutation_id)` idempotency holds); selfMutationFilter.record(id) fires at send.

---

### PLAN DAY VIEW (039 — landed)
**Owner:** Each later day-view consumer (041-V/041-W block detail, 042 block actions, 043 drag-reorder) + the energy/check-in chat + the icon-primitive chat
**Relevant-to:** 041-V, 041-W, 042, 043; any chat touching `apps/web/app/(app)/plan` or the `['plan', planDate]` cache
**Status:** Open — landed-feature forward notes (PR #__)
**Detail:** 039 shipped the web read-only vertical block timeline (skeleton / timeline / empty), Realtime-synced, day-rollover.
- MOUNT DEVIATION (load-bearing): the brief named `apps/web/app/(app)/page.tsx`, but that route-group index resolves to `/` and COLLIDES with `(marketing)/page.tsx` (`/`) → hard `next build` error (two parallel pages, same path). The day view mounts at **`apps/web/app/(app)/plan/page.tsx`** (route `/plan`) — the existing 054-W scaffold, now `'use client'`, Tasks link preserved. Any chat expecting the day view at `/` must use `/plan`.
- QUERY HOOK: `apps/web/hooks/usePlanQuery.ts`, cache key **`['plan', planDate]`** (planDate = `YYYY-MM-DD`), GET `/api/v1/plans/date/[date]` (NOT `/today` — client computes the local date). Throws `PlanQueryError{status, code, isPlanNotFound}`; a PLAN_NOT_FOUND 404 is retry-suppressed and drives the empty state. 041-W hydrates block detail from THIS cache — reuse the key, do not author a second plan query/client.
- RENDER CONTRACT: BlockTimeline/BlockCard render **§9 PlanResponse** (`apps/web/app/api/v1/plans/operations.ts`) ONLY — camelCase, ISO `startTime`/`endTime`, server-computed `status` rendered AS-IS (`in_progress` NOT recomputed client-side). Never DailyPlanSchema. All PlanResponse/PlanBlock imports are `import type` (erased → no `@vesper/db`→`fs` pull; see the @vesper/shared BARREL flag).
- REALTIME: reuses 037 `usePlanRealtime` + `selfMutationFilter` invalidating `['plan', planDate]`; `SELF_MUTATION_WINDOW_MS` (60s) constant, no hardcoded number. No second subscription; provider mutation defaults untouched (read-only render).
- SSE PATH: POST `/plans/generate` is a **HAND-ROLLED** SSE (`event: plan|done|error`), NOT the `@ai-sdk/react` data-stream protocol — the SDK gives no usable completion callback, so 039 consumes the stream MANUALLY (fetch + ReadableStream reader) inline in the page: `plan` frames raise the skeleton `filledCount`; the terminal `done` frame either shows the fallback empty state (`source:'fallback'` + `fallbackNotice`) or invalidates `['plan', planDate]` → BlockTimeline (SSE partials never render a real BlockCard). Any regeneration UI (042) reuses this consumer shape.
- GENERATE CTA ENERGY DEFAULT (flag): the empty-state "Generate plan" CTA posts `energyScore: 5` (DEFAULT_ENERGY_SCORE) — energy capture is the daily check-in surface, not this read-only view. The check-in/energy chat must feed a real score here.
- NO ICON PRIMITIVE: `@vesper/ui` exports tokens only (no icon component), so BlockCard uses a per-block-type unicode glyph. 041-V (visual half) swaps for a real icon primitive when one ships.
- DAY ROLLOVER: `useDayRollover` = `visibilitychange` (immediate foreground check) + 60s poll, both gated on pure `hasRolledOver`; advances to the CURRENT local date (browser IANA zone as the client proxy for the authoritative `users.timezone`). Pure helpers in `apps/web/components/plan/planViewHelpers.ts` (+test) — no DOM (web has no @testing-library/react; 054-W pure-helper pattern). NO vitest glob change (`components/**` already covered).

---

### PLAN DAY VIEW MOBILE (040 — landed)
**Owner:** Each later mobile day-view consumer (041-V/041-W block detail, 042 block actions, 043 drag-reorder) + the icon-primitive chat
**Relevant-to:** 041-V, 041-W, 042, 043; any chat touching `apps/mobile/app/(tabs)/plan.tsx`, `apps/mobile/components/plan/*`, or the mobile `['plan', planDate]` cache
**Status:** Open — landed-feature forward notes (PR #__)
**Detail:** 040 shipped the mobile RN read-only vertical block timeline (skeleton / timeline / empty), Realtime-synced, day-rollover, + mobile-only pull-to-refresh, swipe-to-reveal action affordance, and Reanimated layout animation. Replaced the 054-W near-stub at `apps/mobile/app/(tabs)/plan.tsx` (the router mounts `/(tabs)/plan` — confirmed in `app/_layout.tsx` RootNavigator; the build-plan's older `(tabs)/index.tsx` reference is stale).
- RENDER CONTRACT: BlockTimeline/BlockCard render the §9 PlanResponse (camelCase, ISO `startTime`/`endTime`, server-computed `status` AS-IS — `in_progress` NOT recomputed). Mobile cannot import `apps/web/.../operations.ts`, so the shape is MIRRORED by hand in `apps/mobile/components/plan/types.ts`. Never DailyPlanSchema.
- QUERY HOOK: `apps/mobile/hooks/usePlanQuery.ts`, cache key `['plan', planDate]` — SAME key usePlanRealtime invalidates + the chat-013 provider dehydrates to AsyncStorage. Goes through the shared `lib/api/client` (bearer + X-Vesper-Client/X-App-Version + 401/426 handling), NOT a bespoke fetch. Throws `PlanQueryError{status}`; `isPlanNotFound === (status===404)` — a status-based PLAN_NOT_FOUND signal (the web hook parses the §9 error code, but the mobile client throws a generic `ApiError(status)` and /plans/date only 404s for PLAN_NOT_FOUND; invalid date → 400). 404 retry-suppressed → empty state. 041-W hydrates block detail from THIS key — do not author a second plan query/client.
- SSE TRANSPORT (chat-040 determination = NON-STREAMING): RN core fetch cannot stream a body — Hermes exposes no ReadableStream reader on `res.body`, so the web 039 per-chunk `filledCount` pattern has no RN equivalent. Mobile shows PlanSkeleton for the DURATION of POST `/plans/generate`, then reads the fully-buffered `res.text()`, parses SSE frames for the terminal `done`/`error`, detects a `source:'fallback'` done frame (→ apology empty state), else invalidates `['plan', planDate]` → BlockTimeline. The settled timeline ALWAYS renders from the §9 GET, never the DailyPlan partial. (Generate uses a direct `fetch` to `${EXPO_PUBLIC_API_URL}/plans/generate` with the bearer — apiClient.post can't be used, it `res.json()`s an event-stream.) Generate CTA posts `energyScore: 5` (DEFAULT_ENERGY_SCORE) — same energy-default flag as 039; the check-in chat feeds a real score.
- ROLLOVER SHARE-VS-DUPLICATE (chat-040 determination = DUPLICATE): 039's rollover/tz math lives in web-local `apps/web/lib/dates/localDate.ts` + `apps/web/components/plan/planViewHelpers.ts` (un-importable from mobile). Rather than extract a new `@vesper/shared` export (index + subpath + rebuild-before-typecheck surface), the ~10-line pure Intl math is DUPLICATED in `apps/mobile/components/plan/planViewHelpers.ts` (`localDateInTimeZone`/`nextLocalMidnight`/`hasRolledOver`), kept equivalent to the web helper. NO shared edit. `useDayRollover` = AppState `'active'` foreground + 60s poll (RN app-lifecycle, NOT web visibilitychange, NOT expo-notifications), both gated on pure `hasRolledOver`.
- FOREGROUND SEAM: chat-013 `useAppLifecycle()` is `(): void` with no callback seam (already mounted at root via useBiometricLock, invalidates `['plan']` on foreground). Like usePlanRealtime, `useDayRollover` attaches its OWN AppState listener rather than a second useAppLifecycle mount — the pre-existing no-seam limitation persists.
- REALTIME: reuses chat-037 `usePlanRealtime(userId, planDate)` + `selfMutationFilter`; `SELF_MUTATION_WINDOW_MS` (60s) via `@vesper/shared/realtime` — no hardcoded number, no second subscription, provider mutation defaults untouched (read-only render).
- SWIPE AFFORDANCE = SHELLS ONLY (042 wires mutations): BlockCard is wrapped in `react-native-gesture-handler/ReanimatedSwipeable`; left-swipe reveals complete/skip/reschedule button SHELLS (no-op, `accessibilityState.disabled`). react-native-gesture-handler `~2.28.0` was ALREADY a dep (SDK-54 pin) — NO dep add, NO `pnpm install` needed. `GestureHandlerRootView` wraps the plan SCREEN subtree (not the root layout — self-contained; expo-router root-wrap not relied on).
- LAYOUT ANIMATION: `BlockTimeline` configures Reanimated `LinearTransition.springify()` with the @vesper/ui spring token (damping 18 / stiffness 150) + `FadeIn` at band `quick`, via the shared `components/ui/motion` helpers — never a hardcoded ms/stiffness. Reduced motion (`useReducedMotion` → AccessibilityInfo.isReduceMotionEnabled) drops both to instant. Did NOT bump reanimated (`~4.1.7`) or worklets (`0.5.1`) — SDK pin held.
- NO ICON PRIMITIVE (same as 039): BlockCard uses per-block-type unicode glyphs; 041-V swaps for a real icon primitive when one ships.
- PULL-TO-REFRESH: `RefreshControl` on the ScrollView; refetch attempted UNCONDITIONALLY (no NetInfo pre-gate); on error the chat-013 persisted cache stays rendered + a 2s `enqueueToast` "Showing your saved plan" (info) shows — no spinner-lock, no error state.
- PURE HELPERS / TESTS: `apps/mobile/components/plan/planViewHelpers.ts` (+`.test.ts`, 11 tests) holds the extracted blockSortComparator / selectEmptyStateVariant / rollover math — no RN import (no @testing-library in mobile deps; 054-W/039 pure-helper pattern). vitest `include` already covers `components/**`+`hooks/**` → NO glob change.

---

### MEDICATIONS MODULE (060 — landed)
**Owner:** Each later medications consumer (the screen↔scheduler wiring chat; any med UI/edit chat); quiet-hours-window chat (046/059a)
**Relevant-to:** Any chat touching `apps/web/app/api/v1/medications/*`, `apps/mobile/app/(tabs)/settings/medications.tsx`, `apps/mobile/lib/medication*`, or the medication reminder engine
**Status:** Open — landed-feature forward notes (PR #__)
**Detail:** 060 shipped the Medications module dual-surface: web CRUD API + web surface + mobile surface + a built-but-unwired local-notification scheduling engine. Table/RLS/audit-trigger already existed (migrations 0006 + 0011 + migration-20 shift column) — 060 authored NO migration.
- MODULE GATE: Medications is a MODULE, OFF by default, gated on `modulesEnabled.medication.enabled` — the `modules_enabled` JSONB uses the SINGULAR key `medication`. NOT a core tab.
- MOUNT PATTERN: web app shell has NO persistent nav, so the page (`app/(app)/medications/page.tsx`) self-gates via `GET /api/v1/profile`, rendering a "module off" card until enabled. Mobile tab bar is a FIXED four-tab (plan/tasks/calendar/settings) — a top-level tab was forbidden, so Medications mounts as a **Stack sub-screen of Settings** (`settings/medications.tsx`, registered in `settings/_layout.tsx`), reached from a link in `settings/index.tsx` hidden while off; the screen ALSO self-gates a deep link.
- SCREEN↔SCHEDULER WIRING DEFERRED (load-bearing gap): the reminder engine (pure `medicationSchedule.ts` compute + `medicationReminders.ts` expo-notifications wrapper + failure telemetry) is built and unit-tested, but the mobile surface does NOT yet call `scheduleMedicationReminders` on save. Correct lifecycle (schedule on create, cancel+reschedule on edit, cancel on delete) needs persisted notification-ids per medication — left as its own unit of work rather than shipped half-correct (a partial wire leaks duplicate notifications). This is the primary follow-up.
- F2 SCHEDULING CONTRACT: fire-on-time is the DEFAULT and enforced in the pure helper — `shift_out_of_quiet_hours=false` NEVER delays a dose. `=true` shifts out of a quiet-hours window ONLY when a window is supplied. Frequency map: daily/twice_daily/custom → one DAILY reminder per time; weekly → one WEEKLY reminder per time on the start-date weekday (expo convention 1=Sun..7=Sat). Reminders are LOCAL triggers only (never `getDevicePushTokenAsync`), timeSensitive foreground banner, SOFT permission gate (requests only when `canAskAgain`, else routes to iOS Settings — never re-prompts after denial).
- QUIET-HOURS WINDOW ABSENT: repo has NO quiet-hours window utility (046/059a not landed) — only `BaseProfile.wakeTarget`/`bedtimeTarget`. So `shift=true` is a DEFENSIVE NO-OP today (`applyQuietHoursShift` returns the dose time unchanged when no window supplied). Full window logic (incl. wrap-past-midnight) IS implemented in the pure helper, so when a window source lands ONLY the caller changes — not the core.
- MOBILE PICKER IS TEXT-ENTRY (TimePicker→"HH:mm", DatePicker→"YYYY-MM-DD") until a future on-device wheel pass — matches the 107a primitive mechanism.
- MEDICATIONS DRIZZLE MODEL NOW CURRENT: the pull-generated `medications` stub had drifted (modelled `dosage text`/`schedule_time text`, lacked `frequency`/`times`/`start_date`/`end_date`/`shift_out_of_quiet_hours`); 060 re-synced it to the LIVE applied DDL (enum `medication_frequency_enum`={daily,twice_daily,weekly,custom}; `times time[] NOT NULL DEFAULT '{}'`). No migration — a future `drizzle-kit pull` produces the same. The ORM path is now typed correctly; verify-per-table still holds.
- ANALYTICS: emits ONE event `medication_notification_schedule_failed {medication_id, scheduled_times_count, error_class}` via the mobile `track()` seam only (no PII — row id, count, error constructor name). Autocapture OFF. Pending 096 registration (see 096 PostHog TAXONOMY). On a schedule throw the wrapper ALSO captures to Sentry (no-ops without DSN). Local notification CONTENT may carry med name/dose (on-device only, never emitted).

---

### FINANCE/BILLS MODULE (061 — landed)
**Owner:** Bill reminder worker chat (075); copy-library chat (044); any bills UI/edit chat
**Relevant-to:** Any chat touching `apps/web/app/api/v1/bills/*`, `apps/web/app/(app)/bills/page.tsx`, `apps/mobile/app/(tabs)/settings/bills.tsx`, `apps/mobile/lib/bills.ts`, `packages/shared/src/copy/*`, or the bill reminder worker
**Status:** Open - landed-feature forward notes (PR #__)
**Detail:** 061 shipped the Finance/Bills module dual-surface: web CRUD API + web surface + mobile surface + a thin mobile client + one voice-gated butler-line copy entry. Table/RLS/two indexes already existed (migration 0006) - 061 authored NO migration, column, trigger, or enum. Simpler than medications (060): NO scheduling, NO times[]/quiet-hours, NO reminder worker (that is 075).
- MODULE GATE: gated on `modulesEnabled.finance.enabled` - the `modules_enabled` JSONB key is the SINGULAR `finance` (NOT `bills`). OFF by default, NOT a core tab.
- MOUNT PATTERN (mirrors 060): web page `app/(app)/bills/page.tsx` self-gates via `GET /api/v1/profile`, "module off" card until enabled. Mobile mounts as a Stack sub-screen of Settings at `apps/mobile/app/(tabs)/settings/bills.tsx` (registered in `settings/_layout.tsx`), reached from a link in `settings/index.tsx` hidden while off; the screen self-gates a deep link. (Actual settings dir is under `(tabs)/`; the kickoff's `app/settings/bills.tsx` was approximate.)
- RAW SQL, NOT ORM: bills Drizzle model is drifted/unusable - all CRUD via raw parameterized SQL. See STALE ... + bills DRIZZLE MODELS flag for the exact drift.
- RLS CONFIRMED STRICTEST (direct SQL, `packages/db/scripts/verify-bills-rls.mjs`): row security enabled; SELECT/INSERT/UPDATE/DELETE all own-row `auth.uid() = user_id`; live enforcement confirmed a 2nd user cannot SELECT/UPDATE/DELETE another user's bill and cannot INSERT a row owned by another user; both migration-0006 indexes present.
- BILLS-AUDIT DETERMINATION (drift filed): bills has NO `audit_bills_changes` trigger and is INTENTIONALLY EXCLUDED from audit coverage (TECHNICAL_SPEC §11/§19 - audit scoped to medications + integrations only). The verify script confirmed ABSENT. **PHASE_4_BUILD_PLAN §061 end-of-session checks are WRONG** - they assert a bills audit trigger "parallel to medications"; TECHNICAL_SPEC is authoritative, so those checks should be corrected. (Because bills has no audit trigger, it is NOT exposed to the AUDIT-CASCADE FK HAZARD.)
- BUTLER-LINE COPY HOME (new, for 044/075): the copy library (044) has not landed and the ButlerVoice/ButlerLine UI containers hold no authored copy, so 061 authored a minimal client-safe copy module at the NEW subpath `@vesper/shared/copy` (`packages/shared/src/copy/index.ts`, `./copy` added to shared `package.json` exports). Pure string/template, zero imports - safe for web, mobile, and a Cloudflare Worker (075). Entry: `billDueTomorrow(name) -> "<name> is due tomorrow."`, id `finance.bill_due_tomorrow`. 044 should consolidate this into the full copy library and re-point importers. 061 authored the line ONLY - it does NOT render it, schedule it, or build the reminder block/worker (075).
- POSTHOG POSTURE: NO analytics event emitted, NO live PostHog wired. Verified autocapture OFF on both surfaces (no `posthog.capture` on form inputs or amount fields), documented in both file headers. No `data-ph-no-capture` needed at V1 (session recording off); it becomes REQUIRED at V1.5 if recording is enabled on financial fields.
- WEB FREQUENCY CONTROL: used the `Select` native dropdown (4 values, longer labels read better) - note `Select` is a native `<select>`, so its `onChange` is EVENT-based (`e.target.value`), not value-based like `SegmentedControl`. Mobile uses `SegmentedControl`. amount + due-day are text-entry (inputMode/keyboardType numeric).
- TESTS: web `bills.integration.test.ts` = ungated pure-Zod suite (6) + VESPER_DB_TESTS-gated integration suite (8, all green live); mobile `lib/bills.test.ts` = 7 tests with `./api/client` mocked (method+path+camelCase<->snake_case mapping); shared `copy/copy.test.ts` = 2 pure string assertions. No vitest glob change needed - existing include globs already matched all new test paths.

---

### AUDIT-CASCADE FK HAZARD (060 finding — durable, cross-cutting)
**Owner:** Owning migration chat (make FK deferrable); hard-delete worker chat (074); account-delete owner
**Relevant-to:** 074, any hard-delete / user-purge path, any chat populating `medications` or `integrations`, migration chats (006/011)
**Status:** Open — LATENT + PRE-EXISTING (not introduced by 060); recommendation to file
**Detail:** `security_audit_log.user_id` FK → `users(id)` is **NON-deferrable**, and the audit trigger fires on BOTH `medications` and `integrations`. A HARD delete of a user who owns an audited row (e.g. `DELETE FROM auth.users`, or Supabase admin "delete user") cascades → the audited child row is deleted → the AFTER trigger inserts a `security_audit_log` row referencing the user being deleted in the SAME statement → FK violation → the whole delete fails.
- Pre-existing (migrations 0006 + 0011); 060 is simply the FIRST surface to populate `medications` and thus first to trip it. `integrations` has the identical exposure.
- Never observed because production account deletion is a SOFT delete (30-day grace; `apps/web/app/api/v1/account/operations.ts`), which never hard-deletes the user inline.
- 060's integration test `afterEach` + the verify script both delete child `medications` FIRST (trigger fires while the user still exists → OK), then the user; accumulated `security_audit_log` rows then cascade-delete cleanly.
- **RECOMMENDATION (requires a migration — deliberately NOT authored in 060):** make `security_audit_log_user_id_fkey` `DEFERRABLE INITIALLY DEFERRED` (FK check runs at COMMIT, by which point the audit row has itself cascade-deleted), OR ensure every hard-purge path deletes audited children before the user. **Until then, any hard user-deletion routine MUST delete `medications` + `integrations` first.**

---

### 032-W PARTIAL — spine landed, all screens/auth BLOCKED on 032-V (Fable)
**Owner:** 032-W completion (resumes when 032-V ships); 033-W (EO 47, gated on 032-W)
**Relevant-to:** 032-V, 032-W-resume, 033-W; any chat importing @vesper/shared/onboarding
**Status:** Open — partially built, blocked on hard prereq
**Detail:** Model claude-opus-4-8 (Fable deferred — Fable chats not run; 032-V the visual half never
shipped, absent from main and all branches [PHASE_4_BUILD_PLAN.md L1163]). Per operator call, 032-W built
ONLY the screen-independent spine; zero screens/shells/routes/auth authored.
LANDED:
- packages/shared/src/onboarding/state.ts — deriveOnboardingStep(user, profile): OnboardingStep, PURE
  (no @vesper/db, no RN, no I/O), + zero-mock state.test.ts.
- @vesper/shared/onboarding subpath export, mirroring 038 ./queries: src/onboarding/index.ts + barrel
  re-export + package.json exports["./onboarding"]. NO consumer imports it yet (the web shell that will is
  blocked) — expected. Subpath resolution UNVERIFIED until pnpm --filter @vesper/shared build runs at the
  gate; confirm green before relying on it.
- Honorific persistence: NO edit needed. PUT /profile already accepts honorific (schemas.ts:56,
  HonorificSchema sir|madam|none) and maps to users.honorific via typed Drizzle write (operations.ts:150);
  users.honorific present in live Drizzle model (users.ts:38).
PROVISIONAL field→step map (derived from PRD §3.1 ALONE — 032-V unreadable; marked provisional in code):
terminal-guard-first then earliest-incomplete PRD screen — onboarding_completed_at set → Done(14);
no archetype → Archetype(3); location_lat/lng OR sleep_target incomplete → WakeBedLocation(5); honorific
unchosen → FormOfAddress(10); else Done(14). Build-plan integers (archetype→4, location→6, sleep→7)
REJECTED — conflict PRD §3.1 (archetype=Screen 3, wake/bed/location=Screen 5); PRD screen identities used
as canonical. Honorific is NOT NULL DEFAULT 'none' so the column can't distinguish defaulted-vs-chose-none;
the pure fn relies on the CALLER passing null until an explicit choice (any concrete value incl. 'none' =
chosen) — documented on the input type. Screens not gated by the four contract fields (4-Calendar branch,
6-Module, 7-Prefs, 11-Goals, 12/13) are not derivable and not emitted; OnboardingProfileFields
(modules/base_profile) declared but reserved for post-032-V. The Screen-4 calendar-vs-no-plan branch split
may reshape ordering — RECONCILE the map against the real 032-V surfaces when they land.
BLOCKED on 032-V (resume post-Fable, on Opus): web (onboarding)/layout.tsx shell; mobile
(onboarding)/_layout.tsx shell (+ its deferred unit test); back-button affordance; per-screen
onboarding_step_completed analytics emission (records-only via the guarded dev-log seam — event is in the
§3 taxonomy [TECHNICAL_SPEC.md L2262], NOT yet emitted because emission lives in the blocked shells, so
nothing added to the 096 pending taxonomy); resume-on-entry UI; auth reposition (Google/Apple/magic-link
onto the repositioned sign-in surface); honorific-screen → PUT /profile call.
AUTH SURFACES THAT EXIST: standalone (auth)/sign-in only — web page.tsx, mobile sign-in.tsx, from 010/011.
The onboarding-repositioned sign-in surface 032-W targets does NOT exist (it's a 032-V surface). The
resume chat REUSES the 010/011 flows onto the repositioned surface — does not author a new auth path.
PR #__.

---

### STALE analytics.ts ORM
**Owner:** Dedicated cleanup chat (TBD — no current owner in build plan)
**Relevant-to:** 027, any chat writing to or reading from completion_log
**Status:** Open
**Detail:** `packages/db/src/schema/analytics.ts` declares `event_name`/`occurred_at`
but the applied migration `…0010_completion_log.sql` has `event_type` + `value jsonb`.
Any chat querying or writing completion_log must use REAL applied columns, not the stale
ORM. Do not absorb a full analytics.ts cleanup into a build chat — flag and defer to the
cleanup owner. 025 noted this; confirm at 025 resolution whether a cleanup chat was filed.

---

### 096 PostHog TAXONOMY
**Owner:** 096
**Relevant-to:** 025 (records-only), 059b, 096
**Status:** Open
**Detail:** 025 emits `plan_generated`/`plan_regenerated` to completion_log. These
await registration in chat 096 (with `plan_fallback_served` and 059b alarm events).
025 records-only; do not build 096 in any earlier chat.
Pending taxonomy events also include: `realtime_connection_state_changed` (037 —
states: subscribing, subscribed, error, closed, reconnecting; payload
{state, reason, plan_date, retry_count}). Emitted via a guarded dev-log seam in
both usePlanRealtime hooks; 096 registers + routes it through PostHog.
037 adds realtime_connection_state_changed (states: subscribing, subscribed, error, closed,
reconnecting; payload {state, reason, plan_date, retry_count}) to the pending 096 taxonomy.
038 emits offline_queue_flush_started {queued_mutation_count} and offline_queue_flush_completed
{succeeded_count, conflict_count, network_error_count, total_duration_ms} via the guarded dev-log seam
(records-only); both await registration/routing in 096.
076 adds `push_token_registered` {platform, has_live_activity_token, device_id_hash} (device_id
hashed via FNV-1a) to the pending 096 taxonomy; emitted via a guarded seam in
apps/mobile/lib/pushTokens.ts, awaits registration in 096.
060 adds `medication_notification_schedule_failed` {medication_id, scheduled_times_count, error_class}
(no PII) to the pending 096 taxonomy; emitted via the mobile track() seam in
apps/mobile/lib/medicationReminders.ts (+ Sentry capture), awaits registration in 096.

---

VITEST UPSTASH ENV — `apps/web/vitest.config.ts` does not load `.env.local`; integration tests need `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set in-shell before running the integration suite. Out of scope to fix in any build chat — just set the vars manually before each integration run.

---

### @types/react 18-vs-19 BUILD SKEW
**Owner:** Pre-existing / no owner — note only
**Relevant-to:** All @vesper/web chats (🔵)
**Status:** Open — pre-existing, do not fix
**Detail:** Root pnpm.overrides pins `@types/react` 18.3.28 monorepo-wide (React runtime 19) to silence a mobile type-check skew; load-bearing for apps/web. This pin was the deliberately-fragile item flagged to "revisit on a React/Expo bump" — that bump HAPPENED (SDK 52→54, React 18→19.1) and the pin HELD: mobile + web type-check/build stayed green at 18.3.28 through 53 and 54, no forced move (no new react-skew failure). The "revisit on bump" framing is spent; the pin survives 19.x runtime and STAYS until the web skew is fixed independently. Live note: `next build` for @vesper/web can still trip ONLY in generated `.next/types/validator.ts` (bigint→ReactNode) for untouched layout.tsx — pre-existing, intermittent (did not surface in the 081 run), do NOT absorb. expo-doctor under SDK 54 now warns it wants @types/react ~19.1.10 — NON-blocking, intentionally ignored (moving it re-opens the web skew).

---

### SUPABASE ADVISOR WARNINGS
**Owner:** Future repo-wide forward migration chat (TBD)
**Relevant-to:** Any chat running Supabase advisor / RLS work
**Status:** Open — track only
**Detail:** ~67 WARN-level `auth_rls_initplan` lints, pre-existing. Fixed by a future
repo-wide forward migration; no chat currently owns it. Before relying on the set,
confirm none is severity ERROR. Do NOT fix in any build chat.
**037 publication-RLS / chat-006 gate:** live advisor check found no ERROR-severity
security lints (the ~67 auth_rls_initplan WARNs are pre-existing and expected);
`blocks` confirmed present in the `supabase_realtime` publication. The
publication-RLS gate is satisfied for Realtime broadcasts.

---

### MIGRATION/DB-INFRA STANDING
**Owner:** Active — confirmed in 063
**Relevant-to:** Any chat verifying triggers/schema or resyncing Drizzle (081, 064, 076, …)
**Status:** Open — ACTIVE
**Detail:** `db:pull` confirmed BROKEN in 063 (`./gel-core is not exported` — drizzle-kit↔
drizzle-orm version mismatch); unbreak by pinning drizzle-kit 0.29.1 + drizzle-orm 0.38.4.
`audit-schema.ts` is absent (chat 006) AND not runnable — verify ANY audit/trigger/schema
expectation by DIRECT SQL on the live local DB, never the script. Supabase MCP misconfig;
`config.toml` reads `supabase/migrations` with no override.

---

### CHAT-029 REORDER client_mutation_id ECHO GAP
**Owner:** 029 follow-up (unassigned)
**Relevant-to:** 038; any chat wiring drag-reorder into the day view
**Status:** Open
**Detail:** The chat-029 reorder route writes displayOrder only — it does NOT accept
a clientMutationId header or write blocks.client_mutation_id per row (verified in 037).
Its Realtime broadcasts can't be self-filtered, so a device's own drag-reorder echoes
back (brief flicker). PATCH/POST (chat 027) are unaffected. Fix = add clientMutationId
pass-through + per-row write to the reorder route. NOT absorbed into 037.

---

### SELF-MUTATION WINDOW = 60s; §3 RECONCILE
**Owner:** Spec edit (operator)
**Relevant-to:** 038; spec maintenance
**Status:** Open
**Detail:** 037 set the self-mutation window to 60s (raised from 30s for mobile
background/foreground stalls). TECHNICAL_SPEC.md §3 still reads "30-second sliding
window" — reconcile §3 to 60s.

---

### LIVE ACTIVITY PUSH-TO-START TOKEN SOURCE (076 — resolved)
**Owner:** Native-bridge / widget chat (077/078) + Cutover
**Relevant-to:** 077, 078; any Live Activity push-to-start wiring; Cutover (APNs)
**Status:** Open — finding resolved; bridge wiring deferred
**Detail:** `expo-live-activities` is NOT a dependency. `expo-notifications@0.29.14` provides the regular
APNs token (`getDevicePushTokenAsync`) but no Live Activity push-to-start API. The LA push-to-start
token comes from the native `VesperLiveActivityBridge` (ActivityKit;
`NativeModules.VesperLiveActivityBridge.getPushToStartTokenAsync()`), mirroring `lib/alarm.ts`'s
`VesperAlarmBridge`. Returns null until that bridge is wired (deferred Mac/EAS session — see
IOS_WIDGET_REBUILD.md). Supersedes TECHNICAL_SPEC §7 "Token Storage" wording naming
expo-live-activities — loose spec wording, not the installed dep.

---

### RN CRYPTO ABSENT — node:crypto unavailable in RN (076; SDK now 54)
**Owner:** Informational — standing mobile constraint
**Relevant-to:** Any mobile (🟢) chat generating IDs or hashing client-side
**Status:** Open — fact, not a blocker
**Detail:** React Native has no `node:crypto`. 076 (under SDK 52) used a Math.random v4 UUID for `device_id` (persisted in expo-secure-store) and FNV-1a hex for `hashDeviceId` (not SHA-256) — fine because device_id is opaque/non-PII. After 081, node:crypto is NEVER in the mobile bundle graph (subscriptionState, its only user, is off the mobile graph) → inert fact, not a gate. If a real cryptographic hash/UUID is ever needed on mobile, add `expo-crypto` first. NEEDS RE-VERIFY UNDER SDK 54: the original 076 detail enumerated the SDK-52 winter-runtime polyfill set (TextDecoder/URL/URLSearchParams/FormData, no crypto). Whether SDK 54 / RN 0.81 changes that set is UNVERIFIED — do not assume the SDK-52 enumeration still holds; re-check against the SDK 54 runtime before relying on it.

---

### OPERATOR HARDWARE / TEST SURFACES (standing)
**Owner:** Operator env (standing)
**Relevant-to:** Any mobile (🟢) chat scoping on-device testing
**Status:** Open — standing fact
**Detail:** Operator has a physical iPhone for on-device mobile testing; NO Mac. Mac-gated work (native
Swift, Xcode, Expo native dev builds requiring macOS) stays deferred. iPhone-runnable: Expo Go (standard
Expo modules) and EAS cloud builds (no Mac needed). EAS install currently blocked on Apple Developer
Program enrollment. "Needs a device" is not "needs a Mac" — distinguish when scoping device E2E.

---

### CI: react-native imports must be mocked in vitest (076)
**Owner:** Informational — standing mobile-test constraint
**Relevant-to:** Any mobile (🟢) chat with vitest unit tests importing react-native (directly or transitively)
**Status:** Open — standing
**Detail:** Any mobile module that imports react-native (directly or transitively) must be mocked in
every vitest unit test that pulls it in, or vite's SSR transform fails parsing RN's Flow source
(`Expected 'from', got 'typeOf'`). Single-file local runs can hide this — run full `pnpm test` before
pushing. 076 hit this via store/auth.ts -> pushTokens.ts -> react-native.

---

### APPLE PKI MONITOR (086a — landed)
**Owner:** any chat editing the Apple root pin set (`apps/web/lib/apple/appleRootCerts.ts`) — especially the Apple-root-rotation chat that populates the `APPLE_ROOT_CA_UPCOMING` slot; the Cutover operator (deploy + real `SENTRY_DSN`)
**Relevant-to:** any chat touching `apps/web/lib/apple/appleRootCerts.ts`, `getPinnedAppleRoots`, or the apple-verify trust anchors; the Apple-root-rotation chat; the Cutover chat
**Status:** Landed — standalone weekly monitor worker built + green (offline gate + live Apple-cert smoke). Inert until Cutover deploy. Carries ONE future-error coupling (parity) below.
**Detail:** 086a built `workers/apple-pki-monitor/` — a STANDALONE weekly Cloudflare Worker (cron `0 12 * * 1`, Mon 12:00 UTC; SCHEDULED handler, NOT folded into `workers/daily-cron`; NO DB — fetch cert + compare dates only) that fires a HIGH-severity Sentry `captureMessage` when a pinned Apple root's live `notAfter` is ≤180 days out.
- **PARITY COUPLING — WILL FAIL A FUTURE CHAT'S GATE IF IGNORED (the reason this flag exists):** the worker RE-PINS 086's Apple Root CA - G3 DER + sha256 in `WORKER_PINNED_ROOTS` (`workers/apple-pki-monitor/index.ts`) because `apps/web` is a Next.js app with no package boundary a worker can import. `index.test.ts` asserts byte + fingerprint PARITY between that re-pin and 086's `APPLE_ROOT_CA_PINS`. **Any chat that adds or changes a root in `apps/web/lib/apple/appleRootCerts.ts` (e.g. populating the `APPLE_ROOT_CA_UPCOMING` slot during a rotation) MUST add the same root (name, sha256, Apple `url`, base64 DER) to `WORKER_PINNED_ROOTS`, or the worker's parity test fails.** That failure is the intentional sync reminder, not a bug — see `docs/RUNBOOKS/APPLE_PKI_MONITOR.md` step 3.
- **CROSS-TREE TEST IMPORT:** `index.test.ts` imports `../../apps/web/lib/apple/appleRootCerts` directly (relative, no alias). `appleRootCerts.ts` must stay IMPORT-PURE (zero deps — it currently is) or it drags a module graph into the worker's vitest. Do not add imports to that constant file.
- **APPLE RESOURCE + PARSER (confirmed live):** fetches `https://www.apple.com/certificateauthority/AppleRootCA-G3.cer` (individual published root download, not a bundle) and parses with `node:crypto` `X509Certificate` — requires `nodejs_compat` (set in `wrangler.toml`). If a `fetch-failed` alert ever fires, Apple may have moved the URL (update `url` in `WORKER_PINNED_ROOTS`).
- **DEPLOY/TRANSPORT = CUTOVER:** `wrangler.toml` has no `account_id`; real `SENTRY_DSN` + `wrangler deploy` are Cutover steps — the worker is inert (fires nothing) until then. Local `SENTRY_DSN` is the misconfigured `sntryu_` auth token (see LOCAL SENTRY DSN MISCONFIG), so tests MOCK Sentry.
- **PIN SET SHAPE (unchanged by 086a):** `APPLE_ROOT_CA_PINS` = two slots (G3 populated + empty `APPLE_ROOT_CA_UPCOMING`); `getPinnedAppleRoots()` (`keyCache.ts`) filters empty-`der` slots. The worker's identity guard also alerts (`fingerprint-mismatch`) if the live cert stops matching the pin. NO migration, NO copy of the constant beyond the parity-guarded re-pin.
- **RUNBOOK:** `docs/RUNBOOKS/APPLE_PKI_MONITOR.md` (alert handler → points at `APPLE_ROOT_CA_ROTATION.md` as the action); index entry in `RUNBOOKS/README.md` pre-existed (Chat 086a) — no index edit.

---

### APPLE ASSN V2 WORKER — PART 1 landed (087); part 2 CLOSED by 088; Apple cutover OPEN
**Owner:** The Cutover operator (wrangler deploy + App Store Connect webhook URL + `SUPABASE_DB_URL`/`SENTRY_DSN` secrets); Chat 074 (delayed_jobs reconcile consumer)
**Relevant-to:** any chat touching subscription state, the subscriptions row, the Apple verify pipeline, or the reconcile-job queue; the Cutover chat
**Status:** Part-2 type coverage CLOSED — Chat 088 wired the remaining ten types + TEST into the SAME worker (see the 088 entry below). Part-1 worker shipped + green (full offline gate + live-DB smoke 5/5). Still inert until the Cutover deploy.
**Detail:** 087 built `workers/apple-assn/` — a STANDALONE HTTP `fetch` Cloudflare Worker (`name = "vesper-apple-assn"`, `compatibility_flags = ["nodejs_compat"]`, `[vars] RUNTIME = "worker"`, **NO cron triggers** — not scheduled, not folded into `workers/daily-cron`; 405s non-POST) receiving Apple's `{ signedPayload }` ASSN V2 POST. Durable facts:
- **JWS VERIFY EXTRACTED to a NEW `@vesper/apple` package (the headline structural change).** 086's `apps/web/lib/apple/{jws,keyCache,appleRootCerts}.ts` moved to `packages/apple/src/`; apps/web files are now `export * from '@vesper/apple'` SHIMS. Chose EXTRACTION over the 086a re-implement+parity path because parity only guards the root-DER *bytes*, not the chain-verify *algorithm* — one shared implementation kills the verify-logic drift hazard entirely. `@vesper/apple` deps = `jose` ONLY (zero @vesper deps → no turbo cycle); serves types from `dist/`, runtime from `src/` (build BEFORE type-checking consumers, same rule as @vesper/shared). apps/web needed `@vesper/apple` added to `transpilePackages` (next.config.ts) + a `workspace:*` dep.
- **VERIFY SPLIT — outer AND inner both verified.** `jws.ts` now exports `verifyAppleJws` (generic chain-verify, NO field assert → the OUTER ASSN envelope that carries notificationType/subtype/signedDate) + `verifyAppleTransactionJws` (generic + txn-field assert → the INNER `data.signedTransactionInfo`). Trusting notificationType requires the outer signature; trusting the txn requires the inner. `operations.ts` (086 route) still binds `verifyAppleTransactionJws` by name — inner-txn assertion NOT downgraded by the split (verified).
- **FIVE §8 type→transition mappings** (pure `mapNotificationToTransition` in `src/dispatch.ts`, unit-tested): SUBSCRIBED → `transitionToActive`; DID_RENEW → period-window update ONLY (`current_period_start/end` from the inner txn, NO status transition); EXPIRED (**any** subtype) → `transitionToReadOnly`; REVOKE → `transitionToReadOnly`; REFUND → `transitionToReadOnly` + set `canceled_at`.
- **TWO build-plan §087 divergences — §8 WON (flagged):** build-plan impl-note said REVOKE→archived and REFUND→no-state-change; §8 table says REVOKE→**read_only** and REFUND→**read_only + set canceled_at**. Followed §8. (Consequence: REVOKE/REFUND against an already-`archived` row is an illegal source for `transitionToReadOnly` → caught + audited 200, never a 5xx.)
- **DID_FAIL_TO_RENEW was a PART-2 (088) type — audit-only in 087, now mapped to `transitionToPastDue` by 088.** Any unknown notificationType remains audit-only.
- **event_id = §8 COMPOSITE** `originalTransactionId + '_' + notificationType + '_' + signedDate` (the ASSN form — NOT 086's `origTxnId_transactionId` transaction form, NOT a bare notificationUUID). `(provider, event_id)` UNIQUE is the SOLE replay protection (no timestamp rejection — Apple retries for days).
- **Idempotency = 086 record-then-check-`processed_at` shape** (NOT 084's bare `DO NOTHING`): record the event committed BEFORE the transition; `ON CONFLICT` → re-read `processed_at` (SET ⇒ true replay, return; NULL ⇒ interrupted attempt ⇒ RE-PROCESS). `processed_at` set only after transition + reconcile enqueue succeed.
- **Guards:** already-in-target (pre-read locked status; `active`→skip SUBSCRIBED, `read_only`→skip EXPIRED/REVOKE/REFUND); `IllegalSubscriptionTransitionError` → `processing_error` audit row + 200; only unexpected/infra errors → `Sentry.captureException` + 500 (Apple retries). Monotonic-ordering guard on `last_event_at` (signedDate ms vs `last_event_at − 24h` grace); every real mutation advances `last_event_at`. Reconcile enqueue (`delayed_jobs('reconcile_subscription', {userId}, now()+'5 minutes')`) on every real mutation (transition OR period update).
- **User resolution:** raw lookup on `subscriptions.apple_original_transaction_id` (the ASSN can arrive before the client apple-verify path created the row → `user_id` null → recorded audit-only `no-user` 200; `subscription_events.user_id` is nullable). Worker does NOT INSERT subscriptions rows — the client apple-verify (086) owns row creation.
- **State machine via `@vesper/shared/subscriptionState` subpath** (NOT the barrel). All subscriptions/subscription_events/delayed_jobs I/O = raw parameterized SQL; timestamps bind ISO `${iso}::timestamptz` (postgres.js Date-serialize gotcha, same as 086).
- **NO migration** — every written column confirmed live: `current_period_start/end`, `canceled_at`, `apple_original_transaction_id`, `status`, provider CHECK (mig 8); `last_event_at` (mig 31); `subscription_events` UNIQUE + `processing_error` + `user_id ON DELETE SET NULL` (mig 8); `delayed_jobs` (mig 16); `payment_source_enum = (stripe, apple)` (mig 1).
- **NO Apple webhook shared secret** — the JWS signature (chain-to-pinned-root) IS the trust anchor (unlike Stripe's `STRIPE_WEBHOOK_SECRET`). **NO web route, NO mobile, NO copy.** DB-gated integration suite (`src/index.integration.test.ts`) deletes event rows by event_id (covers null-user rows) + unique event_ids per run (the 086 subscription_events isolation gotcha).

---

### APPLE ASSN V2 WORKER — PART 2 landed (088); ALL types wired; Apple cutover OPEN
**Owner:** The Cutover operator (App Store Connect webhook URL + the live TEST-notification probe); the referral chat / the operator (the UNOWNED `referral_credits` → `'applied'` write, below); Chat 074 (delayed_jobs reconcile consumer)
**Relevant-to:** any chat touching subscription state, the subscriptions row, `referral_credits`, the Apple verify pipeline, or the reconcile-job queue; the Cutover chat
**Status:** Open only on Cutover + the referral scope note — all fifteen ASSN V2 types + TEST are wired and green (full offline gate + live-DB smoke 11/11 against local Supabase). Worker still inert until deploy.
**Detail:** 088 EXTENDED the SAME `workers/apple-assn/src/{index.ts,dispatch.ts}` + the same three test files — no fork, no second worker, no second dispatch helper. Durable facts:
- **NO verify code added, `packages/apple/` UNTOUCHED.** 087's injection points reused verbatim: outer `verifyAppleJws` for every type that trusts only notificationType; inner `verifyAppleTransactionJws` for RENEWAL_EXTENDED (it needs the txn's `expiresDate`), exactly as DID_RENEW does.
- **TEN types + TEST, by SOURCE.** §8-TRANSCRIBED (the ONLY one of the ten §8 enumerates): **DID_FAIL_TO_RENEW → `transitionToPastDue`**. APPLE-DOCS-DETERMINED (ASSN V2 docs + build-plan §088 impl-notes, each cross-checked against the 081 legal-source map): **GRACE_PERIOD_EXPIRED** → `transitionToReadOnly`; **REFUND_REVERSED** → `transitionToActive` + CLEAR `canceled_at`; **RENEWAL_EXTENDED** → period-window update only, NO transition; **DID_CHANGE_RENEWAL_STATUS** → `cancel_at_period_end` flag only, NO transition (subtype DECIDES: `AUTO_RENEW_DISABLED` ⇒ true, `AUTO_RENEW_ENABLED` ⇒ false; absent/unknown subtype ⇒ audit-only, never guesses); **PRICE_INCREASE / OFFER_REDEEMED / REFUND_DECLINED / DID_CHANGE_RENEWAL_PREF** → audit-only; **TEST** → 200 fast, audit-only.
- **NO build-plan divergence in part 2** (unlike 087's two): the §088 impl-notes AGREE with §8 on DID_FAIL_TO_RENEW → past_due, and with the contract on GRACE_PERIOD_EXPIRED / PRICE_INCREASE / TEST. §8 remains authoritative if a future note diverges.
- **REFUND_REVERSED — the 081 determination (read live, do not re-derive).** `SOURCES_ACTIVE` in `packages/shared/src/subscriptionState.ts` = `[trial, past_due, read_only, archived]` — **`read_only` IS a legal source for `transitionToActive`**, so REFUND_REVERSED maps to a REAL transition + clearing `canceled_at` (which the paired REFUND had set), NOT the audit-only degrade. Also read live: `SOURCES_PAST_DUE = ['active']` ONLY (so DID_FAIL_TO_RENEW from any non-active source is a genuine illegal edge → audited 200) and `SOURCES_READ_ONLY = [trial, active, past_due]`.
- **TEST IS A FAST PATH — a deliberate flow exception.** App Store Connect REJECTS a slow webhook URL, so a TEST probe audit-logs the event + marks it processed and returns 200 in TWO statements: NO user lookup, NO `SELECT … FOR UPDATE`, NO transition, NO reconcile enqueue. Implemented by resolving the descriptor BEFORE any I/O and branching at the top of the try block. Do not "unify" it back into the main flow.
- **RECONCILE NOW FIRES ON THREE MUTATION KINDS, not transitions only:** status transition OR period-window update (DID_RENEW / RENEWAL_EXTENDED) OR `cancel_at_period_end` flag write (DID_CHANGE_RENEWAL_STATUS). `isMutation()` in dispatch.ts is the single predicate; it is FALSE for `test` and `none`. Every real mutation also advances `last_event_at`.
- **Descriptor gained a TRI-STATE field.** `setCancelAtPeriodEnd: boolean | null` — `null` ⇒ no flag write; `false` is a MEANINGFUL write (AUTO_RENEW_ENABLED), so a plain boolean would have collapsed "write false" into "don't write". Also added `clearCanceledAt` (REFUND_REVERSED) alongside 087's `setCanceledAt` (REFUND). Kinds extended to `active | past_due | read_only | renew | renewal_status | test | none`.
- **`TransitionFns` gained `transitionToPastDue`** (injectable, defaults to the real `@vesper/shared/subscriptionState` fn). Any test constructing a `TransitionFns` literal must supply all three.
- **087's insert was extracted to a `recordEvent()` helper** so the TEST fast path and the main flow share ONE idempotency insert (no duplicated ON CONFLICT SQL). Idempotency shape itself unchanged: record-then-check-`processed_at`.
- **NO migration — every written column confirmed live BEFORE building:** `cancel_at_period_end` (boolean NOT NULL DEFAULT false), `current_period_end`, `canceled_at` (all mig 8); `last_event_at` (mig 31); `provider`/`event_id`/`processed_at` on `subscription_events` (mig 8). Nothing was absent, so nothing was authored.
- **⚠️ SCOPE FLAG — `referral_credits` → `'applied'` write is spec-linked to DID_CHANGE_RENEWAL_PREF but was NOT authored, and is UNOWNED.** TECHNICAL_SPEC §Payments (referral section, ~line 1566) states the `referral_credits` row transitions to `applied` with `applied_to_provider='apple'` and `provider_discount_id` = the promotional-offer id, **signaled by a `DID_CHANGE_RENEWAL_PREF` notification**. 088 records that type AUDIT-ONLY and deliberately does NOT write `referral_credits` — that table is outside 088's subscription-state scope. **Whoever owns the Apple referral-redemption path must wire this write** (likely by extending this worker's DID_CHANGE_RENEWAL_PREF branch). Until then the Apple half of referral credit application is NOT implemented anywhere.
- **NO web route, NO mobile, NO copy.** Production webhook URL + the live TEST-notification verification against it remain Cutover concerns (087's 🚧 carries forward).

---

## Standing Deferrals (carry for closure, do not action in build chats)

These are not open flags — they are known deferrals with no action required
in any current build chat. Listed here so they don't re-surface as questions.

- **077 + 059b native iOS halves** — DEFERRED to a Mac session
- **@vesper/ui gaps** — deferred
- **Local dev auth config** — deferred
- **Stripe identity (C-20)** — Cutover step
- **Sentry release placeholders** — Cutover step
- **Founder mailing-address + marketing DNS (C-22a)** — Cutover step
- **091 follow-ups (PR #31)** — deferred
- **@vesper/ai dist-rebuild ordering** — deferred
- **On-device StoreKit 2 purchase E2E (085)** — real product fetch / native payment sheet / signed JWS
  need an EAS dev build (expo-iap native module is inert in Expo Go); the local `.storekit` Xcode file and
  simulator run need a Mac. The `expo-iap` config plugin's native mods are untested until an EAS prebuild.
  Blocked on Apple Developer Program + EAS. Defer until then; server verify is chat 086.
- **On-device APNs / Live Activity push-to-start test (076)** — blocked on Apple Developer Program
  ($99) + APNs .p8 + the native VesperLiveActivityBridge being wired. EAS cloud build needs no Mac
  but is blocked on the Apple-account work; Expo Go does NOT work on SDK 52 (no remote push token /
  no native modules). Defer the real-token E2E.

