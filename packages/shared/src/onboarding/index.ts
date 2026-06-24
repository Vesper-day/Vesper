// Client-safe entry for the onboarding resume-state machine (Chat 032-W spine).
//
// `'use client'` web onboarding files import `deriveOnboardingStep` from
// '@vesper/shared/onboarding' rather than the package barrel ('@vesper/shared'),
// because the barrel statically re-exports server-only modules (subscriptionState,
// api/auth) that pull @vesper/db -> postgres -> Node fs/net/tls/crypto into the
// client bundle and break `next build` with "Can't resolve 'fs'". This subpath
// touches ONLY ./state, which is pure (no @vesper/db, no react-native, no I/O).
//
// Mobile imports the same symbols from the bare barrel instead — its node-classic
// moduleResolution cannot resolve this subpath and Metro bundles via the `main`
// field, so the barrel->db pull is not a mobile gate failure. That web/mobile
// asymmetry is deliberate; see src/index.ts. Mirrors the 038 ./queries pattern.

export {
  deriveOnboardingStep,
  OnboardingStep,
} from './state';
export type {
  OnboardingArchetype,
  OnboardingHonorific,
  OnboardingUserFields,
  OnboardingProfileFields,
} from './state';
