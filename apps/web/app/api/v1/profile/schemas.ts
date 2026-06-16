// Request Zod + response-shape types for the Profile + Energy API groups (§9).
//
// Co-located per the chat-024 contract. Body schemas validate against the REAL
// post-111 BaseProfileSchema / ModulesEnabledSchema imported from @vesper/db —
// there is intentionally ZERO local re-declaration of the base_profile shape, so
// there is no opportunity to drift from the 111-corrected source of truth.
import { z } from 'zod';
import {
  BaseProfileSchema,
  ModulesEnabledSchema,
  type BaseProfile,
  type ModulesEnabled,
} from '@vesper/db';

// --- DB enum mirrors (kept in lockstep with packages/db/src/schema/users.ts) ---
export const ArchetypeSchema = z.enum([
  'nine_to_five',
  'remote',
  'student',
  'athlete',
  'founder',
  'mixed',
]);
export const HonorificSchema = z.enum(['sir', 'madam', 'none']);

// The seven module keys, in the exact order ModulesEnabledSchema declares them.
// A compile-time check below fails the build if this tuple ever drifts from the
// real ModulesEnabledSchema keys (e.g. a future module is added).
export const MODULE_KEYS = [
  'work',
  'fitness',
  'nutrition',
  'sleep',
  'medication',
  'errands',
  'finance',
] as const;

export type ModuleId = (typeof MODULE_KEYS)[number];

// Drift guard: ModuleId MUST equal keyof ModulesEnabled. If a key is added to
// ModulesEnabledSchema without updating MODULE_KEYS, one of these assignments
// becomes a type error.
type _ModuleKeysCoverShape = keyof ModulesEnabled extends ModuleId ? true : never;
type _ShapeCoversModuleKeys = ModuleId extends keyof ModulesEnabled ? true : never;
const _moduleKeyCheck: _ModuleKeysCoverShape & _ShapeCoversModuleKeys = true;
void _moduleKeyCheck;

export const ModuleIdSchema = z.enum(MODULE_KEYS);

// --- PUT /api/v1/profile body (all fields optional, partial update) ---
export const UpdateProfileRequestSchema = z
  .object({
    archetype: ArchetypeSchema.optional(),
    timezone: z.string().min(1).optional(),
    honorific: HonorificSchema.optional(),
    baseProfile: BaseProfileSchema.optional(),
    modulesEnabled: ModulesEnabledSchema.optional(),
  })
  .strict();

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

// --- PATCH /api/v1/profile/modules/[moduleId] body ---
export const ModuleToggleRequestSchema = z
  .object({ enabled: z.boolean() })
  .strict();

export type ModuleToggleRequest = z.infer<typeof ModuleToggleRequestSchema>;

// --- POST /api/v1/energy body ---
// score: integer 1..10. loggedAt: optional ISO timestamp, defaults to now() at
// write time. Energy logging is plan-INDEPENDENT (§9), so there is deliberately
// no plan_date input — the canonical energy_logged value shape is { score }.
export const EnergyLogRequestSchema = z
  .object({
    score: z.number().int().min(1).max(10),
    loggedAt: z.string().datetime().optional(),
  })
  .strict();

export type EnergyLogRequest = z.infer<typeof EnergyLogRequestSchema>;

// --- Response shapes (§9) ---
export interface ProfileResponse {
  user: {
    id: string;
    email: string;
    archetype: z.infer<typeof ArchetypeSchema>;
    timezone: string;
    honorific: z.infer<typeof HonorificSchema>;
    subscriptionStatus:
      | 'trial'
      | 'active'
      | 'past_due'
      | 'read_only'
      | 'archived'
      | 'deletion_scheduled';
    tier: 'standard' | 'optimizer';
    onboardingCompletedAt: string | null;
  };
  profile: {
    baseProfile: BaseProfile;
    baseProfileVersion: number;
    modulesEnabled: ModulesEnabled;
  };
}

export interface ModuleToggleResponse {
  moduleId: ModuleId;
  enabled: boolean;
  baseProfileVersion: number;
}

export interface EnergyLogResponse {
  logged: {
    id: string;
    score: number;
    loggedAt: string;
  };
}
