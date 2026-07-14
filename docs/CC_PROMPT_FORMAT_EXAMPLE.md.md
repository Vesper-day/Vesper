# CC_PROMPT_FORMAT_EXAMPLE — Canonical Claude Code prompt format

Read this before writing ANY Claude Code prompt. The kickoff/template specifies
the deliverable wrapper and the construction RULES; THIS file specifies the
**body format** of the prompt itself. Match it.

---

## House format (mandatory)

1. **Header line**, then a 2–3 sentence scope statement that names what NOT to do:
   `Task: Phase 4 / Chat [N] — [title] ([one-line scope]).`
   Then: build-vs-migration framing, recon-then-build statement, explicit exclusions.

2. **Section delimiters are `== CAPS ==`** — never markdown `##`, never `────` rules.

3. **Fixed section order:**
   - `== AUTHORITATIVE CONTRACT (... treat as fixed; verify, do not re-derive) ==`
     — verbatim schema (snake_case, every column/type/nullability/default/constraint),
       field mapping (camelCase ↔ snake_case), any transcribed inventory/contract text.
   - `== [CHAT-SPECIFIC GAP / HEADLINE] (resolve via live-repo determination) ==`
     — one section per open question, each framed as: if X then Y, else Z, and state which.
   - `== DETERMINE FROM THE LIVE REPO (file-truth — read the files, do not assume) ==`
     — numbered list of exactly what CC reads/confirms live.
   - `== OUTPUTS ==`
     — `NEW FILE N — path` + one-line description + inline unit-test asserts under each.
   - `== CONSTRAINTS RECAP ==`
   - `== AFTER YOU BUILD ==`
     — the self-run offline gate, then a HARD CHECKPOINT: the agent runs pnpm test/type-check/lint/build
       itself (3-min per-test cap, fix-and-rerun on hang/fail), STOPS at offline-green, hands the operator
       the DB-gated smoke and waits; only on smoke-pass + "proceed" does it commit (Persistent append ->
       git add -A -> repo-files.txt -> commit -> push -> PR).

4. **Voice: plain declarative build instructions.** No `[doc:]` source tags, no terse
   mode, no objection-first, no "I don't know is valid" — none of the chat behavioral
   rules are carried into the prompt. Those are for the kickoff chat only.

5. **Recon-then-build is the DEFAULT.** No plan-mode gate unless the operator explicitly
   opts in for that chat (see template: plan mode is decoupled from the skeleton — a ⚠️
   master-table marking does NOT by itself emit a plan gate).

6. **Open decisions resolve as build-time determinations, not approval round-trips.**
   Pattern: "DETERMINE the convention, pick accordingly, build it, and STATE which you
   chose and why in your final report." Do not insert a STOP-for-approval unless plan
   mode was explicitly opted in.

---

## Worked example — Chat 090b (recon-then-build, no plan gate)

This is the reference shape. Mirror its delimiters, its OUTPUTS layout (NEW FILE N —
path + inline asserts), its DETERMINE numbering, and its AFTER YOU BUILD gate.

```
Task: Phase 4 / Chat 090b — Biometric Lock Setting (mobile-only privacy gate).

You are adding an optional biometric lock (Face ID / Touch ID) to the Vesper mobile app,
persisting the toggle through the EXISTING web PUT /profile API. This is a build task, not a
migration task. Do NOT author any DB migration, new DB column, new trigger, or native Swift.
Do NOT build server-side enforcement and do NOT encrypt local data — this is a client-side
privacy gate only, OFF by default. Recon the live repo first, then build directly — no
plan-mode gate.

== AUTHORITATIVE CONTRACT (from TECHNICAL_SPEC; treat as fixed spec, do not re-derive) ==

PUT /api/v1/profile  (authenticated; updates the user's base profile; increments
  base_profile_version atomically when baseProfile is provided)
  request body (all fields optional; only provided fields updated):
    {
      "archetype": "nine_to_five",
      "timezone": "America/New_York",
      "honorific": "none",
      "baseProfile": { ...base_profile JSONB... },
      "modulesEnabled": { ...modules_enabled JSONB... }
    }
  response: 200 (updated profile shape)

  NOTE — the documented body above does NOT list biometricLockEnabled. See PERSISTENCE GAP.

users column (snake_case; live schema, already exists — do NOT recreate):
  biometric_lock_enabled boolean NOT NULL DEFAULT false
    — powers the optional iOS biometric lock setting; iOS-only at V1, with web relying on
      the OS lock screen as the equivalent layer.
  This is a TOP-LEVEL users scalar, NOT inside the base_profile JSONB.

Field mapping at the API boundary (camelCase request -> snake_case column):
  biometricLockEnabled -> biometric_lock_enabled

== PERSISTENCE GAP (resolve via live-repo determination) ==

The toggle must persist biometric_lock_enabled via PUT /profile, but the documented PUT body
does not enumerate biometricLockEnabled. Therefore DETERMINE from the live route files whether
biometricLockEnabled is already accepted and mapped:
  - If ALREADY accepted and mapped to biometric_lock_enabled: make NO web edit, and say so.
  - If NOT (route is partial): extend the PUT /profile Zod schema to accept biometricLockEnabled
    as an optional boolean, and extend the handler to map it to biometric_lock_enabled and
    update that one scalar.
Because the column is NOT NULL DEFAULT false, an absent value is fine; an explicit toggle
supplies true or false. Do NOT author a migration, column, or trigger.

== DETERMINE FROM THE LIVE REPO (file-truth — read the actual files, do not assume) ==

1. PUT /profile completeness: read apps/web/app/api/v1/profile/schemas.ts, operations.ts,
   route.ts. Does it already accept biometricLockEnabled and persist biometric_lock_enabled?
   Extend ONLY if partial; otherwise make no web edit and say so. Do not gratuitously rewrite
   a working route.
2. Lifecycle mount point: useBiometricLock must mount in apps/mobile/app/_layout.tsx the same
   way usePushTokenRegistration is mounted in the root navigator (the chat-076 pattern). Read
   the live _layout.tsx wiring and follow that exact pattern. Do not invent a second mount path.
3. Sign-out fallback path: the three-failed-attempt fallback must route through the EXISTING
   shared sign-out in apps/mobile/store/auth.ts (chat 076 made signOut() call
   unregisterPushTokenForDevice() BEFORE supabase.auth.signOut()). Read it live and reuse it;
   do NOT author a second sign-out path. Editing store/auth.ts is the change that previously
   broke auth.test.ts — if you touch it, the full test suite is mandatory (see AFTER).
4. device_id / secure-store reuse: reuse the existing apps/mobile/lib/auth/secureStorage.ts
   helper for any persisted state rather than adding a second secure-store wrapper.
5. expo-local-authentication dependency: read apps/mobile/package.json. State whether it is an
   installed dependency (add it if missing) and whether it runs in Expo Go on Expo SDK 52 (it
   is a standard Expo module and is expected to, unlike a custom native module). The operator
   needs to know if on-device Face ID is testable in Expo Go without an EAS build.

== OUTPUTS ==

NEW FILE 1 — apps/mobile/app/(tabs)/settings/privacy.tsx
  Settings -> Privacy panel: the biometric lock toggle plus a short plain-language explanation
  of what it does. Sits beside the existing settings/index.tsx and settings/integrations.tsx —
  match their structure and styling. The toggle calls PUT /api/v1/profile with
  { biometricLockEnabled: <bool> }.

NEW FILE 2 — apps/mobile/lib/biometric.ts
  Wrapper over expo-local-authentication: enrollment check (hardware present + enrolled),
  prompt function, and the failure handling. After three failed attempts, fall back to
  sign-out + re-sign-in via email magic link, routed through store/auth.ts signOut (DETERMINE
  #3). Unit test (biometric.test.ts) with react-native, expo-local-authentication,
  expo-secure-store MOCKED: asserts the prompt path, the three-fail -> signOut + magic-link
  path.

NEW FILE 3 — apps/mobile/components/BiometricGate.tsx
  Lock-screen component shown on cold start and qualifying foreground transitions when the
  setting is ON. While locked, obscure app content and present the biometric prompt / retry
  affordance.

NEW FILE 4 — apps/mobile/hooks/useBiometricLock.ts
  Hook that integrates the existing chat-013 app-lifecycle hook
  (apps/mobile/hooks/useAppLifecycle.ts) and enforces the lock: lock on cold start when ON;
  lock on foreground when backgrounded > 60 seconds; do NOT lock on foreground when
  backgrounded <= 60 seconds (the grace window for quick app switches). Unit test
  (useBiometricLock.test.ts) with react-native, expo-local-authentication, expo-secure-store,
  and useAppLifecycle MOCKED, asserting: OFF (default) fires no lock; ON requires auth on cold
  start; ON requires auth on foreground after > 60s backgrounded; <= 60s foreground does NOT
  re-lock; three fails route through store/auth signOut + magic-link.

POSSIBLE EDIT — the PUT /profile schema + handler, ONLY if DETERMINE #1 found the route partial.

== CONSTRAINTS RECAP ==
No migration, no new column, no new trigger, no native Swift, no server-side enforcement, no
local-data encryption. OFF by default. One optional scalar persisted via PUT /profile. Any
mobile module importing react-native (directly or transitively) MUST be mocked in every vitest
unit test that pulls it in, or vite's SSR transform fails on react-native's Flow source. psql
is NOT installed — any row/column verification runs through the in-repo Postgres Node client
at packages/db/src/client.ts via a tiny Node script, never psql. pnpm build is judged as "no
NEW errors vs main" — do not chase the pre-existing @types/react 18-vs-19 skew.

== AFTER YOU BUILD ==
Author the four mobile files + their unit tests (and the PUT /profile schema/handler extension ONLY if
you determined the route is partial). Then run the full offline gate YOURSELF from the repo root —
pnpm test, pnpm type-check, pnpm lint, pnpm build — plus the chat-specific offline tests. Run each test
under a 3-minute cap; if a test hangs past the cap or fails, stop it, inspect, fix, and rerun before
treating the gate as green (fix-driven reruns only, no blind looping). Run the suites covering every
file you TOUCH, not just files you created (if you edited store/auth.ts, run auth.test.ts too). pnpm
build is judged as no NEW errors vs main — do not chase the @types/react 18-vs-19 skew.
When the offline gate is green, STOP. Do NOT commit, do NOT push, do NOT open a PR yet. Hand me the
DB-gated verify smoke command against local Supabase (VESPER_DB_TESTS=1 with Docker + supabase start)
and WAIT — this is a HARD CHECKPOINT. Paste only the command(s) I run myself, then stop and wait for me
to paste results back.
  - If the smoke fails: fix, re-run the offline gate, and present the smoke command again. Still no commit.
  - If the smoke passes and I say proceed: THEN do the commit sequence — append any future-relevant flags
    this chat surfaced to docs/Persistent.md in the existing entry shape (### TITLE / **Owner** /
    **Relevant-to** / **Status** / **Detail**, and bump "Last updated:"; flags created/closed, cross-chat
    determinations, stubs opened/closed — not one-off build trivia) -> git add -A -> git ls-files >
    repo-files.txt -> git add repo-files.txt -> commit with a descriptive message -> push the branch ->
    open a PR via the GitHub MCP tool (gh is not available on this Windows machine). Report the PR URL.
    Do NOT author a resolution doc.
```
