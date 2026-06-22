// Analytics shim (mobile). Thin, typed seam for the explicit PostHog event
// taxonomy. Autocapture stays OFF — these are explicit taxonomy events only
// [ARCHITECTURE_DECISIONS Decision 08].
//
// The full PostHog client + taxonomy registration lands in chat 096 (unbuilt,
// EO 95). This module is the seam chat 096 wires to PostHog; it deliberately
// does NOT import or configure posthog-react-native yet, and does not block on
// 096. Until then track() no-ops behind a dev guard (mirrors lib/sentry.ts,
// which no-ops when unconfigured) so callers never throw or block.
//
// Events this seam emits — names + payload shapes transcribed verbatim from
// TECHNICAL_SPEC §11 for chat 096 to register against PostHog:
//   alarm_scheduled  { wake_target_local: string; scheduled_at: string; snooze_minutes: number }
//   alarm_fired      { fired_at: string; latency_from_target_ms: number }
//   alarm_dismissed  { action: 'snooze' | 'stop'; dismissed_at: string }
//
// No PII is ever sent (Decision 08 / §11): payloads above carry only local
// time-of-day, ISO timestamps, a latency, and an enum action.

/** Strongly-typed event → payload map. Extend here as chat 096 grows it. */
export interface AnalyticsEventMap {
  alarm_scheduled: {
    wake_target_local: string;
    scheduled_at: string;
    snooze_minutes: number;
  };
  alarm_fired: {
    fired_at: string;
    latency_from_target_ms: number;
  };
  alarm_dismissed: {
    action: 'snooze' | 'stop';
    dismissed_at: string;
  };
  // Emitted by lib/pushTokens.ts on a successful push-token registration. No PII:
  // device_id is HASHED (device_id_hash) before emit — the raw stable id never
  // leaves the device [Decision 08 / §11]. Full taxonomy registration lands in 096.
  push_token_registered: {
    platform: 'ios';
    has_live_activity_token: boolean;
    device_id_hash: string;
  };
}

export type AnalyticsEvent = keyof AnalyticsEventMap;

/**
 * Emit a typed taxonomy event. No PostHog client exists yet (chat 096), so this
 * is a guarded dev-only log today and silent in release builds. The signature
 * is the stable contract chat 096 implements against — callers (lib/alarm.ts)
 * never change when PostHog is wired.
 */
export function track<E extends AnalyticsEvent>(
  event: E,
  payload: AnalyticsEventMap[E],
): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(`[analytics] ${event}`, payload);
  }
}
