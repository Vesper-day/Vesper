// Unit tests for the onboarding resume-state machine (Chat 032-W spine).
// Zero mocks: deriveOnboardingStep is pure and takes plain objects.
import { describe, it, expect } from 'vitest';
import {
  deriveOnboardingStep,
  OnboardingStep,
  type OnboardingUserFields,
} from './state';

/** A user with every field-gated onboarding screen satisfied. */
const fullyPopulated: OnboardingUserFields = {
  archetype: 'nine_to_five',
  locationLat: '37.7749000',
  locationLng: '-122.4194000',
  sleepTargetBedtime: '23:00',
  sleepTargetWake: '07:00',
  honorific: 'sir',
  onboardingCompletedAt: null,
};

describe('deriveOnboardingStep', () => {
  it('resumes at Archetype (Screen 3) when archetype is absent', () => {
    const user: OnboardingUserFields = { ...fullyPopulated, archetype: null };
    expect(deriveOnboardingStep(user)).toBe(OnboardingStep.Archetype);
  });

  it('resumes at Archetype before any later screen, even if later fields are also absent', () => {
    const user: OnboardingUserFields = {
      archetype: null,
      locationLat: null,
      locationLng: null,
      sleepTargetBedtime: null,
      sleepTargetWake: null,
      honorific: null,
    };
    expect(deriveOnboardingStep(user)).toBe(OnboardingStep.Archetype);
  });

  it('resumes at WakeBedLocation (Screen 5) when location_lat/lng is absent', () => {
    const user: OnboardingUserFields = {
      ...fullyPopulated,
      locationLat: null,
      locationLng: null,
    };
    expect(deriveOnboardingStep(user)).toBe(OnboardingStep.WakeBedLocation);
  });

  it('resumes at WakeBedLocation when sleep_target is absent (location present)', () => {
    const user: OnboardingUserFields = {
      ...fullyPopulated,
      sleepTargetBedtime: null,
      sleepTargetWake: null,
    };
    expect(deriveOnboardingStep(user)).toBe(OnboardingStep.WakeBedLocation);
  });

  it('resumes at WakeBedLocation when only one of the four scalars is missing', () => {
    const user: OnboardingUserFields = { ...fullyPopulated, sleepTargetWake: null };
    expect(deriveOnboardingStep(user)).toBe(OnboardingStep.WakeBedLocation);
  });

  it('treats an empty-string scalar as not populated', () => {
    const user: OnboardingUserFields = { ...fullyPopulated, locationLat: '   ' };
    expect(deriveOnboardingStep(user)).toBe(OnboardingStep.WakeBedLocation);
  });

  it('resumes at FormOfAddress (Screen 10) when honorific is not yet chosen', () => {
    const user: OnboardingUserFields = { ...fullyPopulated, honorific: null };
    expect(deriveOnboardingStep(user)).toBe(OnboardingStep.FormOfAddress);
  });

  it('treats an explicit honorific of "none" as chosen (advances past Form of Address)', () => {
    const user: OnboardingUserFields = { ...fullyPopulated, honorific: 'none' };
    expect(deriveOnboardingStep(user)).toBe(OnboardingStep.Done);
  });

  it('returns Done (Screen 14) when every field-gated screen is satisfied', () => {
    expect(deriveOnboardingStep(fullyPopulated)).toBe(OnboardingStep.Done);
  });

  it('short-circuits to Done when onboardingCompletedAt is set, regardless of field gaps', () => {
    const user: OnboardingUserFields = {
      archetype: null,
      locationLat: null,
      locationLng: null,
      sleepTargetBedtime: null,
      sleepTargetWake: null,
      honorific: null,
      onboardingCompletedAt: '2026-06-24T12:00:00.000Z',
    };
    expect(deriveOnboardingStep(user)).toBe(OnboardingStep.Done);
  });

  it('accepts numeric (not just string) location values', () => {
    const user: OnboardingUserFields = {
      ...fullyPopulated,
      locationLat: 37.7749,
      locationLng: -122.4194,
    };
    expect(deriveOnboardingStep(user)).toBe(OnboardingStep.Done);
  });

  it('mid-flow resume: archetype + location/sleep set but honorific pending → FormOfAddress', () => {
    const user: OnboardingUserFields = {
      archetype: 'student',
      locationLat: '40.7128000',
      locationLng: '-74.0060000',
      sleepTargetBedtime: '00:30',
      sleepTargetWake: '08:00',
      honorific: null,
      onboardingCompletedAt: null,
    };
    expect(deriveOnboardingStep(user)).toBe(OnboardingStep.FormOfAddress);
  });

  it('ignores the reserved profile argument in the provisional map', () => {
    const user: OnboardingUserFields = { ...fullyPopulated, archetype: null };
    expect(deriveOnboardingStep(user, { modulesEnabled: { work: true } })).toBe(
      OnboardingStep.Archetype,
    );
  });
});
