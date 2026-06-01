# Runbooks

Operational runbooks for Vesper V1. Each runbook is authored in the chat number noted below. Runbooks marked "this chat" were authored in Chat 003.

> **Before any runbook procedure:** verify you have access to the Supabase dashboard, Cloudflare dashboard, Vercel dashboard, Sentry, and PostHog. Keep this index open as a reference for which runbook covers which incident type.

## Index

| Runbook | Responsible Chat | Summary |
|---|---|---|
| [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) | Chat 003 (this chat) | First-response playbook for API 500-storm, DB saturation, Anthropic spend spike, payment outage, Realtime flood |
| [BACKUP_RESTORE_DRILL.md](BACKUP_RESTORE_DRILL.md) | Chat 003 (this chat) | Quarterly Supabase PITR restore drill procedure |
| [PGSODIUM_KEY_ROTATION.md](PGSODIUM_KEY_ROTATION.md) | Chat 063 | Rotate the pgsodium root key used to encrypt OAuth tokens in the integrations table |
| [GCAL_CHANNEL_RENEWAL.md](GCAL_CHANNEL_RENEWAL.md) | Chat 066 | Manually renew Google Calendar push notification channels before expiry |
| [HARD_DELETE_RECOVERY.md](HARD_DELETE_RECOVERY.md) | Chat 073 | Recover a user accidentally caught by the hard-delete worker |
| [APNS_KEY_ROTATION.md](APNS_KEY_ROTATION.md) | Chat 076 | Rotate the APNs .p8 key for Live Activity push delivery |
| [IOS_WIDGET_REBUILD.md](IOS_WIDGET_REBUILD.md) | Chat 077 | Rebuild and resubmit the iOS widget extension after an API change |
| [STRIPE_CUTOVER.md](STRIPE_CUTOVER.md) | Chat 083 | Cut Stripe from test mode to live mode; swap keys and verify webhooks |
| [APPLE_ROOT_CA_ROTATION.md](APPLE_ROOT_CA_ROTATION.md) | Chat 086 | Update the pinned Apple root CA bundle used for JWS verification |
| [APPLE_PKI_MONITOR.md](APPLE_PKI_MONITOR.md) | Chat 086a | Manual inspection procedure for the Apple PKI monitoring worker |
| [ALERTING.md](ALERTING.md) | Chat 097a | Configure and test all Sentry and PostHog alert rules |
| [IOS_ALARM_REBUILD.md](IOS_ALARM_REBUILD.md) | Chat 059b | Rebuild the alarm notification extension after an iOS SDK update |

## Runbook Template

When authoring a new runbook, use this structure:

```markdown
# RUNBOOK_NAME

**Trigger:** What condition requires this runbook.
**Frequency:** How often this is expected to run (quarterly, on-demand, etc.).
**Owner:** Founder (V1).

## Detection

How to know this condition has occurred.

## Procedure

Numbered steps.

## Verification

How to confirm the procedure succeeded.

## Rollback

What to do if the procedure makes things worse.

## Post-Incident Review

- What happened
- Timeline
- Root cause
- Action items
```
