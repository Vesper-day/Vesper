# Retention Policy

This document defines how long Vesper retains user-generated and system-generated data, and the planned automated retention mechanisms for V1.5.

---

## V1 Acceptance

For the first twelve months following V1 launch, the following tables grow unbounded:

| Table | Why unbounded at V1 |
|---|---|
| `completion_log` | Every task completion, check-in response, and hydration log entry appends a new row. At V1 user counts this is acceptable; at scale it becomes a storage and query-performance concern. |
| `security_audit_log` | All auth events, permission checks, and sensitive-data accesses. Unbounded retention is intentional for the first year to provide a complete audit trail for any security investigations. |

"Unbounded" means no automated deletion runs against these tables during V1. Manual cleanup is not expected. Row counts will be monitored as part of the quarterly operational review.

**Accepted risk:** If the first twelve months produce an unexpectedly large user base (>10,000 users), `completion_log` growth could approach Supabase's storage limits before the V1.5 retention worker is deployed. The mitigation is the Supabase Pro upgrade (which raises storage limits) and the scaling threshold alert at `docs/SCALING_THRESHOLDS.md`.

---

## V1.5 Retention Worker

The planned V1.5 release introduces an automated retention worker deployed as a Cloudflare Worker on a nightly cron schedule. Its behavior:

### completion_log

Rows older than 90 days are rolled up into daily aggregates and deleted.

- **Aggregate table:** `completion_log_daily_agg` — one row per user per day, containing counts by block type and module.
- **Retention:** The aggregate rows are retained indefinitely. The raw `completion_log` rows are deleted after successful aggregation.
- **Why 90 days:** Ninety days of raw completion data supports all planned weekly and monthly review features. Beyond 90 days, the daily aggregate is sufficient for trend analysis.

### security_audit_log

Retention is split by row type:

| Row type | Retention period | Rationale |
|---|---|---|
| Medication-related events (any row where `context->>'module' = 'medication'`) | 7 years | HIPAA-aligned; medication audit records require long-term retention for medical record purposes. |
| All other audit rows (auth events, permission checks, non-medication data access) | 1 year | Standard security audit retention aligned with common compliance frameworks. |

- **Deletion:** The retention worker deletes rows past their retention period in batches of 1,000 to avoid long-running transactions.
- **No archival:** Rows are deleted, not archived. If archival is required before deletion, this must be added to the V1.5 spec before the worker ships.

---

## Future Considerations

The following are not in scope for V1 or V1.5 but are recorded here for future planning:

- **GDPR right-to-erasure:** Handled separately by the hard-delete worker (Chat 073), which removes all user data on account deletion. This is not a retention policy — it is an on-demand deletion.
- **Backup retention:** Supabase PITR backups are retained per Supabase's tier policy (7 days on Pro). This is an infrastructure concern, not an application concern.
- **Analytics event retention:** PostHog retains events for 1 year on the free tier. No action required at V1.
