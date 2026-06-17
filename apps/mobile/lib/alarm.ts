// Native alarm scheduling (mobile) — TECHNICAL_SPEC §11 / PRD §3.2.
//
// The alarm is a LOCAL notification scheduled via expo-notifications at the
// user's wake target. It makes ZERO Anthropic/Supabase calls at fire time. The
// full-screen lock-screen UI (two edge-to-edge SNOOZE/STOP buttons, dismissible
// without unlock) is delivered by the native VesperAlarmExtension
// (UNNotificationContentExtension) + the "vesper-alarm" UNNotificationCategory
// registered below; see apps/mobile/ios/VesperAlarmExtension/* and
// docs/RUNBOOKS/IOS_ALARM_REBUILD.md.
//
// Dismiss-without-unlock is controlled by isAuthenticationRequired:false on both
// actions (NOT by opensAppToForeground, which only governs background handling).
//
// fired_at is stamped by the Content Extension's didReceive into the shared
// app-group UserDefaults (group.com.vesper.app); the RN side reads that hand-off
// on next foreground (useAlarmForegroundSync) and emits alarm_fired then.
//
// HARD CONSTRAINT: no @vesper/db value import. The canonical wake-target type is
// BaseProfile.wakeTarget (packages/db/src/schema/jsonb/base-profile.ts, Chat
// 111 — single top-level source of truth). BaseProfile is re-exported type-only
// by @vesper/shared, but @vesper/shared ships an `exports` map that mobile's
// classic moduleResolution:'node' (expo/tsconfig.base) cannot resolve, so the
// one field consumed here is typed locally (ProfileReadResponse) and kept in
// lockstep with BaseProfile.wakeTarget.
import { useEffect } from 'react';
import { AppState, NativeModules, type AppStateStatus } from 'react-native';
import { set, addDays, addMinutes, isAfter } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { apiClient } from './api/client';
import { track } from './analytics';

/** Category id wiring the local notification to the Content Extension. Apple
 * forbids ':' and '-' in category identifiers, so this is a flat slug. */
export const ALARM_CATEGORY_ID = 'vesperalarm';
export const SNOOZE_ACTION_ID = 'vesperalarm.snooze';
export const STOP_ACTION_ID = 'vesperalarm.stop';

/** Fixed snooze delay. Not configurable at V1 [PRD §3.2]. */
export const SNOOZE_MINUTES = 9;

const ALARM_TITLE = 'Good morning';
const ALARM_BODY = 'Your day is ready.';

/** Minimal read shape for GET /api/v1/profile. The endpoint returns the body
 * unwrapped — no envelope (packages/shared/src/api/response.ts) — as
 * { user, profile } (apps/web/app/api/v1/profile/route.ts + schemas.ts). Only
 * the wakeTarget slice is consumed. wakeTarget is a required string on the real
 * BaseProfileSchema (Chat 111); typed optional here purely as defensiveness for
 * the absent-field guard below. */
interface ProfileReadResponse {
  profile: { baseProfile: { wakeTarget?: string } };
}

/**
 * Register the alarm notification category and its two actions. SNOOZE and STOP
 * are both background-handled (opensAppToForeground:false) and BOTH dismissible
 * without unlocking the device (isAuthenticationRequired:false). Idempotent —
 * safe to call on every app start. Call once during notification setup.
 */
export async function registerAlarmCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(ALARM_CATEGORY_ID, [
    {
      identifier: SNOOZE_ACTION_ID,
      buttonTitle: 'Snooze',
      options: {
        opensAppToForeground: false, // background-handled; NOT the no-unlock control
        isAuthenticationRequired: false, // dismiss without unlock
        isDestructive: false,
      },
    },
    {
      identifier: STOP_ACTION_ID,
      buttonTitle: 'Stop',
      options: {
        opensAppToForeground: false,
        isAuthenticationRequired: false, // dismiss without unlock
        isDestructive: true,
      },
    },
  ]);
}

/**
 * Next clock occurrence of an "HH:MM" local time-of-day, relative to `now`.
 * Returns null for a malformed/invalid string. If the time has already passed
 * today, rolls to the same time tomorrow.
 */
export function nextOccurrence(wakeTarget: string, now: Date): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(wakeTarget);
  if (!match) return null;
  const [, hh, mm] = match;
  if (hh === undefined || mm === undefined) return null;
  const hours = Number(hh);
  const minutes = Number(mm);
  if (hours > 23 || minutes > 59) return null;
  let fireAt = set(now, { hours, minutes, seconds: 0, milliseconds: 0 });
  if (!isAfter(fireAt, now)) fireAt = addDays(fireAt, 1);
  return fireAt;
}

function buildAlarmContent(): Notifications.NotificationContentInput {
  return {
    title: ALARM_TITLE,
    body: ALARM_BODY,
    categoryIdentifier: ALARM_CATEGORY_ID,
    // Time-sensitive, NOT critical — critical is reserved for emergency alerts
    // [PRD §3.2]. Requires the time-sensitive entitlement (app.config.js).
    interruptionLevel: 'timeSensitive',
    sound: 'default',
  };
}

function scheduleAt(date: Date): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: buildAlarmContent(),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

/**
 * Schedule the alarm at the user's wake target. Reads baseProfile.wakeTarget
 * (the single, canonical, top-level source of truth — Chat 111) via the shared
 * API client. Emits alarm_scheduled on success and returns the notification id.
 *
 * Returns null and emits NOTHING when there is no usable wake target:
 *   - the profile fetch/parse throws — a not-yet-onboarded user has a '{}'
 *     base_profile that BaseProfileSchema rejects, so parsing throws rather than
 *     returning an empty field (CHAT_111_RESOLUTION_RECORD §282-283);
 *   - wakeTarget is absent/empty;
 *   - wakeTarget is not a valid "HH:MM".
 */
export async function scheduleAlarm(now: Date = new Date()): Promise<string | null> {
  let wakeTarget: string | undefined;
  try {
    const { profile } = await apiClient.get<ProfileReadResponse>('/profile');
    wakeTarget = profile.baseProfile.wakeTarget;
  } catch {
    return null;
  }
  if (!wakeTarget) return null;

  const fireAt = nextOccurrence(wakeTarget, now);
  if (!fireAt) return null;

  const id = await scheduleAt(fireAt);
  track('alarm_scheduled', {
    wake_target_local: wakeTarget,
    scheduled_at: fireAt.toISOString(),
    snooze_minutes: SNOOZE_MINUTES,
  });
  return id;
}

/** Cancel a scheduled alarm by its notification id. */
export function cancelAlarm(identifier: string): Promise<void> {
  return Notifications.cancelScheduledNotificationAsync(identifier);
}

/**
 * Handle a SNOOZE/STOP response from the alarm notification.
 *   - SNOOZE: re-arm the alarm a fixed 9 minutes out and emit alarm_dismissed
 *     { action: 'snooze' }.
 *   - STOP: cancel the scheduled notification and emit alarm_dismissed
 *     { action: 'stop' }.
 *
 * STOP → energy check-in routing (PRD §3.2) is intentionally NOT handled here;
 * a no-unlock STOP cannot foreground the app. See CHAT_059B_RESOLUTION_RECORD.md
 * (RECORD 2) — deferred to the screen-flow chat.
 */
export async function handleAlarmResponse(
  response: Notifications.NotificationResponse,
): Promise<void> {
  const dismissedAt = new Date().toISOString();
  const { actionIdentifier } = response;

  if (actionIdentifier === SNOOZE_ACTION_ID) {
    await scheduleAt(addMinutes(new Date(), SNOOZE_MINUTES));
    track('alarm_dismissed', { action: 'snooze', dismissed_at: dismissedAt });
    return;
  }

  if (actionIdentifier === STOP_ACTION_ID) {
    await cancelAlarm(response.notification.request.identifier);
    track('alarm_dismissed', { action: 'stop', dismissed_at: dismissedAt });
  }
}

/** Hand-off written by the Content Extension into the shared app group. */
interface AlarmFiredHandoff {
  firedAt: string;
  latencyFromTargetMs: number;
}

interface AlarmBridgeModule {
  /** Read and clear the most recent fired hand-off, or null if none. */
  consumeFiredHandoff(): Promise<AlarmFiredHandoff | null>;
}

/**
 * Resolve the native bridge that reads the app-group UserDefaults hand-off.
 * The bridge is a native module added in the Mac/Xcode session (deferred — see
 * IOS_ALARM_REBUILD.md); until it exists this returns null and the read no-ops,
 * matching the defensiveness of lib/sentry.ts.
 */
function getAlarmBridge(): AlarmBridgeModule | null {
  const mod = (NativeModules as Record<string, unknown>).VesperAlarmBridge;
  if (mod && typeof (mod as AlarmBridgeModule).consumeFiredHandoff === 'function') {
    return mod as AlarmBridgeModule;
  }
  return null;
}

/**
 * Read the app-group fired hand-off (if any) and emit alarm_fired. The Content
 * Extension stamps fired_at when the custom UI is DISPLAYED (≈ alarm shown), so
 * latency_from_target_ms measures target→shown — see CHAT_059B_RESOLUTION_RECORD.md
 * RECORD 1. Safe to call repeatedly; the bridge clears the hand-off on read.
 */
export async function processAlarmFiredHandoff(): Promise<void> {
  const bridge = getAlarmBridge();
  if (!bridge) return;
  let handoff: AlarmFiredHandoff | null;
  try {
    handoff = await bridge.consumeFiredHandoff();
  } catch {
    return;
  }
  if (!handoff) return;
  track('alarm_fired', {
    fired_at: handoff.firedAt,
    latency_from_target_ms: handoff.latencyFromTargetMs,
  });
}

/**
 * Foreground sync hook. Mirrors hooks/useAppLifecycle.ts: on every transition to
 * 'active' it drains the app-group fired hand-off and emits alarm_fired. Mount
 * once near the root, alongside useAppLifecycle.
 */
export function useAlarmForegroundSync(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        void processAlarmFiredHandoff();
      }
    });
    return () => subscription.remove();
  }, []);
}
