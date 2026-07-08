# Chat 060 — Medications Module — Resolution Record

Scope: dual-surface. Web CRUD API + web surface + mobile surface + local-notification
scheduling for the Medications MODULE. BUILD + VERIFY, not a migration task — the
`medications` table, its RLS policies, and the `audit_medications_changes` trigger
already exist on the live DB (migrations 0006 + 0011 + migration 20's shift column).
NO migration, NO new column / trigger / enum, NO new dependency, NO live PostHog.

Precedents mirrored: the Tasks API group (chat 028 — `apps/web/app/api/v1/tasks/*`),
the mobile Tasks client (chat 054-W — `apps/mobile/lib/tasks.ts`), `lib/alarm.ts` for
the expo-notifications posture, and the 107a UI primitives (`components/ui/*`).

## Files authored (NEW)

- `apps/web/app/api/v1/medications/operations.ts` — pure CRUD + colocated Zod
- `apps/web/app/api/v1/medications/route.ts` — GET (200, createRoute) + POST (201, custom wrapper)
- `apps/web/app/api/v1/medications/[id]/route.ts` — PATCH (200, createRoute) + DELETE (204, custom wrapper)
- `apps/web/app/api/v1/medications/medications.integration.test.ts` — pure (ungated) + integration (gated) suites
- `apps/web/app/(app)/medications/page.tsx` — web surface, module-gated
- `apps/mobile/app/(tabs)/settings/medications.tsx` — mobile surface (settings stack sub-screen)
- `apps/mobile/lib/medications.ts` + `apps/mobile/lib/medications.test.ts` — thin CRUD client
- `apps/mobile/lib/medicationSchedule.ts` + `apps/mobile/lib/medicationSchedule.test.ts` — PURE schedule helpers (no RN/expo import)
- `apps/mobile/lib/medicationReminders.ts` — expo-notifications wrapper + Sentry/analytics failure seam
- `packages/db/scripts/verify-medications-rls-audit.mjs` — direct-SQL RLS + audit verifier
- `docs/CHAT_060_RESOLUTION_RECORD.md` — this file

## Files edited

- `packages/db/src/schema/modules.ts` — re-synced the `medications` Drizzle model to the LIVE applied DDL (see below). NOT a migration.
- `apps/mobile/lib/analytics.ts` — added `medication_notification_schedule_failed` to the typed event map.
- `apps/mobile/app/(tabs)/settings/_layout.tsx` — registered the `medications` stack screen.
- `apps/mobile/app/(tabs)/settings/index.tsx` — added the module-gated Medications link.

## Live-DB contract verification (direct SQL, chat 060)

Introspected the local DB via a postgres-js script (psql not installed; audit-schema.ts
absent — neither used). Confirmed the `medications` table matches the authoritative
contract column-for-column, INCLUDING `shift_out_of_quiet_hours boolean NOT NULL
DEFAULT false` (migration 20 IS applied locally). Enum `medication_frequency_enum` =
{daily, twice_daily, weekly, custom}. `times` is `time[] NOT NULL DEFAULT '{}'`.

RLS (verified by `verify-medications-rls-audit.mjs`, 16/16 PASS):

| Op | Policy | Predicate |
|---|---|---|
| SELECT | `medications_select_own` | `USING (auth.uid() = user_id)` |
| INSERT | `medications_insert_own` | `WITH CHECK (auth.uid() = user_id)` |
| UPDATE | `medications_update_own` | `USING + WITH CHECK (auth.uid() = user_id)` |
| DELETE | `medications_delete_own` | `USING (auth.uid() = user_id)` |

Row security is ENABLED. The script ALSO proves live enforcement (as a second
`authenticated` user: cannot SELECT another user's row; the WITH CHECK blocks an INSERT
owned by another user). The `audit_medications_changes` trigger (SECURITY DEFINER, AFTER
I/U/D) writes exactly ONE `security_audit_log` row per op with the correct
`table_name='medications'`, `row_id`, `user_id`, and `operation` (INSERT → new only;
UPDATE → old+new; DELETE → old only).

## Drizzle stub reconciliation (modules.ts)

**Branch taken: USE THE DRIZZLE MODEL, after re-syncing it.** The pre-existing
pull-generated `medications` stub had drifted — it modelled `dosage text` + `schedule_time
text` and lacked `frequency`, `times`, `start_date`, `end_date`, `shift_out_of_quiet_hours`.
That stub pre-dated migration 0011 and no code referenced the stale fields (grep clean
across `apps/` + `packages/`). Re-synced the stub to the LIVE applied DDL so the ORM path
is typed correctly. This authors NO migration — the columns, the enum, the RLS policies,
and the audit trigger already exist on the DB; the TS model was simply behind. A future
`drizzle-kit pull` would produce the same definition.

## Determinations

**#4 Mount + module-gate.** Medications is a MODULE, OFF by default, gated on
`modulesEnabled.medication.enabled` (the `modules_enabled` JSONB uses the singular key
`medication`). NOT a core tab.
- **Web:** the app shell (`app/(app)/layout.tsx`) has NO persistent nav — pages are
  reached by in-page links — so there is no always-on nav entry to add. The page fetches
  `GET /api/v1/profile` and renders a "module off" card until the module is enabled.
- **Mobile:** the tab navigator is a FIXED four-tab bar (plan, tasks, calendar, settings).
  Adding a top-level tab was forbidden, so Medications mounts as a **Stack sub-screen of
  Settings** (`settings/medications.tsx`, registered in `settings/_layout.tsx`), reached
  from a link in `settings/index.tsx` that is hidden while the module is off; the screen
  ALSO self-gates so a deep link while off shows the module-off state.

**#5 Quiet-hours window source: ABSENT.** The repo has NO quiet-hours window utility
(046/059a not landed) — only `BaseProfile.wakeTarget` / `bedtimeTarget` exist. So the
`shift_out_of_quiet_hours = true` path is wired as a DEFENSIVE NO-OP: `applyQuietHoursShift`
returns the dose time unchanged when no window is supplied, so the fire-on-time default
holds. The window logic (including a wrap-past-midnight window) is implemented in full in
the pure helper so that when a window source lands, ONLY the caller changes — not the core.

## F2 scheduling contract

Fire-on-time is the DEFAULT and is enforced in the pure `medicationSchedule.ts`:
`shift_out_of_quiet_hours = false` NEVER delays a dose (unit-tested). `= true` shifts a
dose out of the quiet-hours window ONLY when a window is supplied (no-op today, per #5).
Frequency mapping: daily / twice_daily / custom → one DAILY reminder per time; weekly →
one WEEKLY reminder per time on the start-date weekday (Apple/expo convention 1=Sun..7=Sat).
`medicationReminders.ts` maps specs to expo-notifications LOCAL triggers (DAILY/WEEKLY —
never `getDevicePushTokenAsync`), with a red-priority (`interruptionLevel: 'timeSensitive'`)
foreground banner and a SOFT permission gate (requests only when `canAskAgain`; otherwise
routes to iOS Settings via `Linking.openSettings()` — never re-prompts after denial).

## Analytics

The one event this chat emits — `medication_notification_schedule_failed
{ medication_id, scheduled_times_count, error_class }` — goes ONLY through the existing
mobile `track()` seam (`lib/analytics.ts`). Autocapture stays OFF; no `posthog.capture`;
no analytics on form inputs / sensitive fields. PostHog wiring is chat 096 (unbuilt). On a
schedule throw the wrapper ALSO captures to Sentry (`lib/sentry.ts`, no-ops without a DSN).
The failure payload carries NO PII (only the row id, a count, and the error constructor
name); local notification CONTENT may carry the med name/dose (on-device only, never emitted).

## Tests

- Ungated `describe('Medications validation (pure)')` — Zod assertions, run under plain `pnpm test`.
- Gated `describeDb('Medications API (integration)')` (VESPER_DB_TESTS) — drives the DB-layer
  functions against local Supabase (54322): POST 201 + defaults, omitted-times → `[]`,
  GET own-rows-only, PATCH partial, endDate < startDate → 400, PATCH/DELETE another user's
  id → 404, DELETE then row gone + second DELETE 404. Seeds via `auth.users` so the
  `on_auth_user_created` trigger creates `public.users`.
- `medications.test.ts` (mobile thin client), `medicationSchedule.test.ts` (pure F2 helpers).

## DURABLE FOLLOW-UP — pre-existing audit-cascade FK hazard (NOT introduced by chat 060)

`security_audit_log.user_id` FK → `users(id)` is **NON-deferrable**, and the audit trigger
fires on BOTH `medications` and `integrations`. Consequence: a HARD delete of a user who
owns an audited row (e.g. `DELETE FROM auth.users`, or Supabase admin "delete user")
cascades → the audited child row is deleted → the AFTER trigger inserts a
`security_audit_log` row referencing the user being deleted in the SAME statement → FK
violation → the whole delete fails.

- This is LATENT and PRE-EXISTING (migrations 0006 + 0011); chat 060 is simply the first
  surface to populate `medications` and thus the first to trip it. `integrations` has the
  identical exposure.
- It was never observed because production account deletion is a SOFT delete (30-day grace;
  `apps/web/app/api/v1/account/operations.ts`), which never hard-deletes the user inline.
- The chat-060 integration test's `afterEach` was fixed to delete child `medications` FIRST
  (trigger fires while the user still exists → OK), then the user; the accumulated
  `security_audit_log` rows then cascade-delete cleanly. The verify script does the same
  (explicit medication delete before user delete).
- **RECOMMENDATION for a future chat (requires a migration — deliberately NOT authored
  here):** make `security_audit_log_user_id_fkey` `DEFERRABLE INITIALLY DEFERRED` (the FK
  check then runs at COMMIT, by which point the audit row has itself cascade-deleted), OR
  ensure every hard-purge path deletes audited children before the user. Until then, any
  hard user-deletion routine MUST delete `medications` + `integrations` first.

## Non-blocking notes

- **Screen ↔ scheduler wiring deferred.** The reminder engine (pure compute + expo wrapper
  + failure telemetry) is built and unit-tested, but the mobile surface does NOT yet call
  `scheduleMedicationReminders` on save. Correct notification lifecycle (schedule on create,
  cancel+reschedule on edit, cancel on delete) needs persisted notification-ids per
  medication; a partial version would leak duplicate notifications. Left as its own unit of
  work rather than shipped half-correct.
- **Mobile picker is text-entry** (TimePicker → "HH:mm", DatePicker → "YYYY-MM-DD") until a
  future on-device wheel pass — matches the 107a primitive mechanism.

## Flags created / closed

- CLOSED: #4 mount+gate (web self-gating page; mobile settings-stack sub-screen).
- CLOSED: #5 quiet-hours (ABSENT → shift=true is a defensive no-op; fire-on-time default).
- CLOSED: Drizzle stub skew (re-synced to live DDL).
- OPEN (durable, cross-cutting): audit-cascade FK hazard — see DURABLE FOLLOW-UP above.
