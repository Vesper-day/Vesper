// Thin expo-notifications wrapper for medication dose reminders (Chat 060). This is
// the ONLY medication-scheduling module that imports expo-notifications /
// react-native; the schedule COMPUTATION lives in the pure lib/medicationSchedule.ts
// (no RN/expo import) so it stays testable without a mock.
//
// Uses LOCAL notification scheduling (Notifications.scheduleNotificationAsync) — NOT
// getDevicePushTokenAsync — honoring the F2 rule: shift_out_of_quiet_hours = false
// fires the dose at its EXACT time (never silently delayed); the shift=true path is a
// defensive no-op today because the repo has no quiet-hours window source (see
// medicationSchedule.ts header).
//
// Failure handling: computing/scheduling a medication's reminders is wrapped so that
// on ANY throw we (a) capture to Sentry (lib/sentry.ts posture — no-ops without a DSN)
// and (b) emit the records-only medication_notification_schedule_failed event through
// the track() seam (lib/analytics.ts). PostHog is NOT wired here (chat 096). The
// failure payload carries NO PII — only the medication id, the count of scheduled
// times, and the error constructor name.
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { track } from './analytics';
import {
  computeMedicationReminders,
  type ReminderSpec,
  type MedicationFrequency,
} from './medicationSchedule';

/** The medication slice this wrapper needs (a subset of lib/medications.Medication).
 * Kept structural so callers can pass a full Medication. */
export interface SchedulableMedication {
  id: string;
  name: string;
  dose: string;
  frequency: MedicationFrequency;
  times: string[];
  startDate: string; // YYYY-MM-DD
  shiftOutOfQuietHours: boolean;
}

/**
 * Ensure the app may post local notifications — a SOFT gate. iOS forbids a second
 * system prompt once the user has denied, so this only calls requestPermissionsAsync
 * when the OS still allows asking (`canAskAgain`). When permission is denied and can
 * no longer be requested, the caller should show an in-app rationale and route the
 * user to Settings via {@link openNotificationSettings} (never re-prompt).
 *
 * @returns true when notifications are authorized (granted or provisional).
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false; // denied — do NOT re-prompt (iOS rule)
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Deep-link to the iOS Settings app so a user who previously denied can enable dose
 * reminders (the only path once canAskAgain is false). */
export async function openNotificationSettings(): Promise<void> {
  await Linking.openSettings();
}

/**
 * Foreground presentation for a dose notification: a red-priority (time-sensitive)
 * banner that shows even while the app is foregrounded. Register once near the app
 * root via Notifications.setNotificationHandler(makeDoseNotificationHandler()).
 */
export function makeDoseNotificationHandler(): Parameters<
  typeof Notifications.setNotificationHandler
>[0] {
  return {
    handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  };
}

function contentFor(med: SchedulableMedication): Notifications.NotificationContentInput {
  return {
    title: 'Medication reminder',
    // Local-only content (never leaves the device), so the med name/dose is safe here
    // — unlike the analytics payload, which carries NO med text.
    body: `${med.name} — ${med.dose}`,
    // Red-priority: dose reminders are time-sensitive (requires the entitlement in
    // app.config.js). NOT critical — critical is reserved for emergency alerts.
    interruptionLevel: 'timeSensitive',
    sound: 'default',
  };
}

function triggerFor(spec: ReminderSpec): Notifications.NotificationTriggerInput {
  if (spec.repeat === 'weekly') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: spec.weekday!, // present for weekly specs
      hour: spec.hour,
      minute: spec.minute,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: spec.hour,
    minute: spec.minute,
  };
}

function reportFailure(med: SchedulableMedication, scheduledCount: number, err: unknown): void {
  Sentry.captureException(err, {
    tags: { feature: 'medication_reminders' },
    extra: { medication_id: med.id, scheduled_times_count: scheduledCount },
  });
  track('medication_notification_schedule_failed', {
    medication_id: med.id,
    scheduled_times_count: scheduledCount,
    error_class: err instanceof Error ? err.constructor.name : 'Unknown',
  });
}

/**
 * Schedule all local dose reminders for one medication. Returns the notification ids
 * that were scheduled (empty when nothing could be scheduled). Never throws: any
 * failure — computing the specs (e.g. a malformed time) OR an individual
 * scheduleNotificationAsync call — is captured to Sentry and emitted through the
 * track() seam, then swallowed so the UI is not crashed.
 */
export async function scheduleMedicationReminders(
  med: SchedulableMedication,
): Promise<string[]> {
  let specs: ReminderSpec[];
  try {
    // quietWindow is intentionally omitted — no window source exists in the repo, so
    // the shift path no-ops and the fire-on-time default holds (F2).
    specs = computeMedicationReminders({
      times: med.times,
      frequency: med.frequency,
      startDate: med.startDate,
      shiftOutOfQuietHours: med.shiftOutOfQuietHours,
    });
  } catch (err) {
    reportFailure(med, med.times.length, err);
    return [];
  }

  const content = contentFor(med);
  const ids: string[] = [];
  for (const spec of specs) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: triggerFor(spec),
      });
      ids.push(id);
    } catch (err) {
      // Per-call guard: one failed dose does not abort the rest.
      reportFailure(med, specs.length, err);
    }
  }
  return ids;
}

/** Cancel previously scheduled dose reminders by their notification ids. */
export async function cancelMedicationReminders(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}
