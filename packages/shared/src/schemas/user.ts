import { z } from 'zod';

export const ArchetypeSchema = z.enum([
  'nine_to_five',
  'remote',
  'student',
  'athlete',
  'founder',
  'mixed',
]);
export type Archetype = z.infer<typeof ArchetypeSchema>;

export const SubscriptionStatusSchema = z.enum([
  'trial',
  'active',
  'past_due',
  'read_only',
  'archived',
  'deletion_scheduled',
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const TierSchema = z.enum(['standard', 'optimizer']);
export type Tier = z.infer<typeof TierSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  archetype: ArchetypeSchema,
  timezone: z.string(),
  locationLat: z.number().nullable(),
  locationLng: z.number().nullable(),
  honorific: z.enum(['sir', 'madam', 'none']),
  subscriptionStatus: SubscriptionStatusSchema,
  trialStartedAt: z.string().datetime().nullable(),
  trialEndsAt: z.string().datetime().nullable(),
  tier: TierSchema,
  referralCode: z.string().nullable(),
  onboardingCompletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;
