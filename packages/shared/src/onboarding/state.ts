// Onboarding resume-state machine (Chat 032-W spine).
//
// `deriveOnboardingStep` returns the screen a user should resume at, DERIVED from
// which onboarding fields are populated rather than from a stored `onboarding_step`
// column. This makes resume robust to a user signing in on a second device
// mid-flow (PHASE_4_BUILD_PLAN chat 032-W: "derived from which fields have been
// populated rather than a separate column").
//
// PURITY CONTRACT: this module imports nothing platform-specific — no @vesper/db,
// no react-native, no I/O. It takes already-fetched plain objects and returns a
// step. It is unit-testable with zero mocks. The CALLER (the web / mobile
// onboarding shell — deferred to post-032-V) is responsible for fetching the
// users + user_profiles rows and projecting them into the input shapes below.
//
// ── PROVISIONAL MAP (pending 032-V) ──────────────────────────────────────────
// The 032-V visual surfaces do not exist yet (Fable window chat, not shipped), so
// the step ↔ screen ordering here is derived from PRD §3.1 ALONE and is marked
// PROVISIONAL. Two known tensions, both resolved conservatively and documented:
//
//  1. Build-plan vs PRD numbering conflict. The PHASE_4_BUILD_PLAN partial map
//     ("no archetype → step 4; no location_lat → step 6; no sleep_target → step 7")
//     uses integers that do NOT match PRD §3.1 screen numbers (archetype = Screen 3,
//     Wake/Bed/Location = Screen 5). Per the chat-032-W contract the build-plan
//     integers are NOT fixed truth; PRD §3.1 is the canonical screen order, so the
//     steps below follow PRD screen identities, not the build-plan integers.
//
//  2. Field coverage. The chat contract names four field groups to key on:
//     archetype, location_lat/lng, sleep_target_bedtime/wake, honorific. Those gate
//     PRD Screens 3, 5, 5, and 10 respectively. Screens that are NOT gated by one of
//     these four fields (Screen 4 Calendar — branch-dependent, no scalar in the
//     field set; Screen 6 Starting Module; Screen 7 Module Preferences; Screens 8–9
//     plan gen/reveal; Screen 11 Goals; Screens 12–13 trial/tour) are NOT derivable
//     from the available signals and are therefore NOT emitted by this provisional
//     machine. When 032-V (+ 033-V/034-V/035-V/036-V) land, the modules_enabled /
//     base_profile / goals signals will fill those gaps and the Screen-4 branch
//     split (calendar-connected vs no-existing-plan) may reshape the ordering.

/** Archetype enum mirror (users.archetype). Local copy keeps this module pure. */
export type OnboardingArchetype =
  | 'nine_to_five'
  | 'remote'
  | 'student'
  | 'athlete'
  | 'founder'
  | 'mixed';

/** Honorific enum mirror (users.honorific). Local copy keeps this module pure. */
export type OnboardingHonorific = 'sir' | 'madam' | 'none';

/**
 * The screen a user should resume at, keyed to PRD §3.1 screen identities. Values
 * are stable string ids (not the PRD integers, which the build plan and PRD
 * disagree on). Only the field-gated screens + the terminal step are ever returned
 * by {@link deriveOnboardingStep}; the remaining ids are declared for completeness
 * and forward use by the post-032-V shell.
 */
export enum OnboardingStep {
  Welcome = 'welcome', // Screen 1
  Authentication = 'authentication', // Screen 2
  Archetype = 'archetype', // Screen 3 — gated by users.archetype
  Calendar = 'calendar', // Screen 4 — branch-dependent (not field-derived here)
  WakeBedLocation = 'wake_bed_location', // Screen 5 — gated by location + sleep_target
  StartingModule = 'starting_module', // Screen 6
  ModulePreferences = 'module_preferences', // Screen 7
  FirstPlanGeneration = 'first_plan_generation', // Screen 8
  FirstPlanReveal = 'first_plan_reveal', // Screen 9
  FormOfAddress = 'form_of_address', // Screen 10 — gated by users.honorific
  Goals = 'goals', // Screen 11
  TrialConfirmation = 'trial_confirmation', // Screen 12
  FeatureTour = 'feature_tour', // Screen 13
  Done = 'done', // Screen 14 — terminal
}

/**
 * The subset of the `users` row relevant to onboarding resume. Every field is
 * optional/nullable: a `null`/`undefined`/empty value means "not yet populated".
 *
 * Honorific note: `users.honorific` is `NOT NULL DEFAULT 'none'` at the DB level,
 * so a freshly-created row reads `'none'` whether or not the user reached the
 * Form-of-Address screen. This pure function therefore intentionally does NOT see
 * the DB default — the caller must pass `null`/`undefined` for honorific until the
 * user has explicitly chosen one (e.g. disambiguated via `onboardingCompletedAt`
 * or an app-level "honorific chosen" marker). A concrete `'sir' | 'madam' | 'none'`
 * passed in is treated as an explicit selection.
 */
export interface OnboardingUserFields {
  archetype?: OnboardingArchetype | null;
  /** numeric(10,7) — Drizzle returns numerics as strings; accept either. */
  locationLat?: number | string | null;
  locationLng?: number | string | null;
  /** time HH:MM (local). */
  sleepTargetBedtime?: string | null;
  sleepTargetWake?: string | null;
  honorific?: OnboardingHonorific | null;
  /** Completion flag (users.onboarding_completed_at). Set ⇒ terminal. */
  onboardingCompletedAt?: string | Date | null;
}

/**
 * The subset of the `user_profiles` row relevant to onboarding. Reserved for the
 * post-032-V machine (modules_enabled / base_profile gate Screens 6–7); the
 * provisional derivation does not yet read it, but the signature is fixed now so
 * the shell and tests bind to the final shape.
 */
export interface OnboardingProfileFields {
  modulesEnabled?: Record<string, unknown> | null;
  baseProfile?: Record<string, unknown> | null;
}

/** True when a scalar field carries a real value (not null/undefined/empty string). */
function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/**
 * Derive the screen a user should resume at from their populated onboarding fields.
 *
 * Evaluation order (terminal guard first, then earliest incomplete PRD screen):
 *   1. onboardingCompletedAt set            → Done            (Screen 14)
 *   2. archetype not populated              → Archetype       (Screen 3)
 *   3. location or sleep_target incomplete  → WakeBedLocation (Screen 5)
 *   4. honorific not chosen                 → FormOfAddress   (Screen 10)
 *   5. all field-gated screens satisfied    → Done            (Screen 14)
 *
 * @param user    projected `users` row (see {@link OnboardingUserFields})
 * @param profile projected `user_profiles` row (reserved; unused in provisional map)
 */
export function deriveOnboardingStep(
  user: OnboardingUserFields,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  profile?: OnboardingProfileFields,
): OnboardingStep {
  // 1. Terminal guard — an explicit completion timestamp wins over field state.
  if (isPopulated(user.onboardingCompletedAt)) {
    return OnboardingStep.Done;
  }

  // 2. Screen 3 — Archetype Selection.
  if (!isPopulated(user.archetype)) {
    return OnboardingStep.Archetype;
  }

  // 3. Screen 5 — Wake, Bed, and Location. All four scalars are collected on this
  //    single screen, so any one missing resumes the whole screen.
  const wakeBedLocationComplete =
    isPopulated(user.locationLat) &&
    isPopulated(user.locationLng) &&
    isPopulated(user.sleepTargetBedtime) &&
    isPopulated(user.sleepTargetWake);
  if (!wakeBedLocationComplete) {
    return OnboardingStep.WakeBedLocation;
  }

  // 4. Screen 10 — Form of Address (honorific). See honorific note on the input
  //    type: a null/undefined here means "not yet chosen".
  if (!isPopulated(user.honorific)) {
    return OnboardingStep.FormOfAddress;
  }

  // 5. All field-gated screens satisfied.
  return OnboardingStep.Done;
}
