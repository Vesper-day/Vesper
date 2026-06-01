# Backup Restore Drill

**Trigger:** Quarterly operational exercise.
**Frequency:** Once per quarter. First drill scheduled for Phase 5 (internal alpha, Month 6).
**Owner:** Founder (V1).
**Purpose:** Confirm that Supabase PITR (Point-in-Time Recovery) snapshots are restorable to the staging environment within the recovery time objective, and that restored data is consistent with production.

> **Note:** Supabase PITR requires Supabase Pro tier. This runbook becomes executable once the Pro upgrade occurs (see `docs/SCALING_THRESHOLDS.md`). The first drill is scheduled for Phase 5 after the upgrade is confirmed.

---

## Prerequisites

- Supabase Pro account with PITR enabled on the production project.
- A separate staging Supabase project (available with Pro; uses branch databases).
- Access to the Supabase dashboard and Supabase CLI.
- A known representative test user account in production with real plan data.

---

## Procedure

### 1. Identify the Recovery Point

In the Supabase dashboard:
- Navigate to **Database → Backups → Point in Time**.
- Select a recovery point approximately 24 hours prior to the drill.
- Note the exact timestamp: `YYYY-MM-DD HH:MM:SS UTC`.

### 2. Restore to Staging

```bash
# Using Supabase CLI — restore to the staging project
supabase db restore \
  --project-ref <STAGING_PROJECT_REF> \
  --recovery-target-time "YYYY-MM-DD HH:MM:SS+00" \
  --source-project-ref <PRODUCTION_PROJECT_REF>
```

Allow 10–30 minutes for the restore to complete depending on database size.

### 3. Verify Row Counts Match Production

Connect to staging using the Supabase SQL editor or `psql`:

```sql
-- Run on both production and staging; counts should match (within ~1% due to writes during restore)
SELECT
  'users'         AS tbl, COUNT(*) FROM auth.users
UNION ALL SELECT 'user_profiles',    COUNT(*) FROM user_profiles
UNION ALL SELECT 'daily_plans',      COUNT(*) FROM daily_plans
UNION ALL SELECT 'plan_blocks',      COUNT(*) FROM plan_blocks
UNION ALL SELECT 'subscriptions',    COUNT(*) FROM subscriptions
UNION ALL SELECT 'completion_log',   COUNT(*) FROM completion_log
ORDER BY tbl;
```

Acceptable variance: ≤1% difference on any table (expected due to writes between the recovery point and the drill time). Any table showing >5% variance requires investigation before the drill passes.

### 4. Representative User Round-Trip

Using the test user account identified in prerequisites:

1. Connect to the staging environment from a local development build (set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to staging values in `.env.local`).
2. Log in as the test user.
3. Verify:
   - User profile loads correctly (display name, timezone, enabled modules).
   - The most recent daily plan renders without errors.
   - At least one completed task appears in the history view.
   - Subscription state is reflected correctly (trial / active / etc.).
4. Attempt to generate a new plan. Confirm it succeeds against the staging DB.

### 5. Record Results

Document the following before closing the drill:

```
Drill date:
Recovery point timestamp:
Restore duration (minutes):
Row count comparison (pass/fail per table):
Representative user round-trip (pass/fail):
Any anomalies found:
Drill outcome (PASS / FAIL):
```

---

## Verification Criteria

The drill passes when:
- All row counts are within 1% of production.
- The representative user's profile, plan history, and subscription state are accurate.
- A new plan can be generated on staging without errors.

---

## If the Drill Fails

1. Do not panic — a drill failure is the reason drills exist.
2. Document the specific failure point in the drill record above.
3. Open a Supabase support ticket if the failure is in the PITR restore mechanism itself.
4. If the failure is in application code (data fails to render after a clean restore): the root cause is likely a schema drift between production and the application code. Run `supabase db diff` and investigate.
5. Re-run the drill within 2 weeks after resolving the root cause.
