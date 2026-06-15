import { z } from 'zod';

const RecurringCommitmentSchema = z.object({
  title: z.string(),
  frequency: z.string(),
  time: z.string(),
  dayOfWeek: z.string().optional(),
});

const LocationBoundEventSchema = z.object({
  title: z.string(),
  location: z.string(),
  time: z.string(),
  dayOfWeek: z.string().optional(),
});

const GoalSchema = z.object({
  category: z.string(),
  description: z.string(),
});

// Coordinate pair. Canonical home location for the user, set at onboarding.
// The users-row columns location_lat / location_lng (migration 2) MAY remain
// nullable as a web manual-coordinate fallback — that is a DB-layer concession.
// The Zod contract is strict: location is always present post-onboarding.
const LocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

// Chat 111 §5.2 / §5.3 — notification preferences.
// - morningKnockEnabled: the morning-knock notification on/off.
// - alarmEnabled: explicit alarm opt-in (alarm on vs off). §5.2.
// There is intentionally NO wake-time field here: the single source of truth for
// the user's wake time is BaseProfile.wakeTarget (§5.1 de-dup mandate). The
// cache-prewarm key (below) is keyed to that canonical wakeTarget, NOT to alarm
// adoption.
export const NotificationPreferencesSchema = z.object({
  morningKnockEnabled: z.boolean(),
  alarmEnabled: z.boolean(),
});

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;

export const BaseProfileSchema = z.object({
  workSchedulePattern: z
    .object({
      days: z.array(z.string()),
      start: z.string(),
      end: z.string(),
    })
    .optional(),
  recurringCommitments: z.array(RecurringCommitmentSchema).default([]),
  locationBoundEvents: z.array(LocationBoundEventSchema).default([]),
  goals: z.array(GoalSchema).default([]),
  // Chat 111 §5.1 — wake/bed are first-class, always-present, top-level fields.
  // Previously duplicated + optional under preferences.* AND modules.sleep.* ;
  // de-duped here as the single source of truth. HH:MM local time-of-day.
  wakeTarget: z.string(),
  bedtimeTarget: z.string(),
  // Chat 111 §5.1 — location promoted to a first-class, always-present field.
  location: LocationSchema,
  // Chat 111 §5.2 / §5.3 — notification preferences shape.
  notificationPreferences: NotificationPreferencesSchema,
});

export type BaseProfile = z.infer<typeof BaseProfileSchema>;

// Chat 111 §5.3 — cache-prewarm key CONVENTION (shape only).
// Chat 021 wires the actual prewarm path; this file only fixes the key format so
// downstream code derives the same key. The key is a function of the user and
// their canonical wake time (BaseProfile.wakeTarget) — never of alarm adoption.
export const CACHE_PREWARM_KEY_PREFIX = 'plan-prewarm';

export function cachePrewarmKey(userId: string, wakeTarget: string): string {
  return `${CACHE_PREWARM_KEY_PREFIX}:${userId}:${wakeTarget}`;
}
