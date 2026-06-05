import { sql } from 'drizzle-orm';
import * as t from 'drizzle-orm/pg-core';
import type { BaseProfile, ModulesEnabled } from './jsonb';

export const archetypeEnum = t.pgEnum('archetype_enum', [
  'nine_to_five',
  'remote',
  'student',
  'athlete',
  'founder',
  'mixed',
]);

export const honorificEnum = t.pgEnum('honorific_enum', ['sir', 'madam', 'none']);

export const subscriptionStatusEnum = t.pgEnum('subscription_status_enum', [
  'trial',
  'active',
  'past_due',
  'read_only',
  'archived',
  'deletion_scheduled',
]);

export const tierEnum = t.pgEnum('tier_enum', ['standard', 'optimizer']);

export const paymentSourceEnum = t.pgEnum('payment_source_enum', ['stripe', 'apple']);

export const users = t.pgTable(
  'users',
  {
    id: t.uuid('id').primaryKey(),
    email: t.text('email').notNull().unique(),
    archetype: archetypeEnum('archetype').notNull(),
    timezone: t.text('timezone').notNull().default('America/Los_Angeles'),
    locationLat: t.numeric('location_lat', { precision: 10, scale: 7 }),
    locationLng: t.numeric('location_lng', { precision: 10, scale: 7 }),
    honorific: honorificEnum('honorific').notNull().default('none'),
    subscriptionStatus: subscriptionStatusEnum('subscription_status')
      .notNull()
      .default('trial'),
    trialStartedAt: t.timestamp('trial_started_at', { withTimezone: true }),
    trialEndsAt: t.timestamp('trial_ends_at', { withTimezone: true }),
    deletionRequestedAt: t.timestamp('deletion_requested_at', { withTimezone: true }),
    tier: tierEnum('tier').notNull().default('standard'),
    paymentSource: paymentSourceEnum('payment_source'),
    referredByUserId: t
      .uuid('referred_by_user_id')
      .references((): t.AnyPgColumn => users.id, { onDelete: 'set null' }),
    referralCode: t.text('referral_code').unique(),
    onboardingCompletedAt: t.timestamp('onboarding_completed_at', { withTimezone: true }),
    createdAt: t
      .timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: t
      .timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    t.index('idx_users_subscription_status').on(table.subscriptionStatus),
    t
      .index('idx_users_trial_ends_at')
      .on(table.trialEndsAt)
      .where(sql`${table.subscriptionStatus} = 'trial'`),
    t
      .index('idx_users_deletion_requested_at')
      .on(table.deletionRequestedAt)
      .where(sql`${table.deletionRequestedAt} IS NOT NULL`),
    t
      .index('idx_users_referred_by_user_id')
      .on(table.referredByUserId)
      .where(sql`${table.referredByUserId} IS NOT NULL`),
  ],
);

export const userProfiles = t.pgTable('user_profiles', {
  userId: t
    .uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  baseProfile: t.jsonb('base_profile').$type<BaseProfile>().notNull().default(sql`'{}'`),
  baseProfileVersion: t.integer('base_profile_version').notNull().default(1),
  modulesEnabled: t
    .jsonb('modules_enabled')
    .$type<ModulesEnabled>()
    .notNull()
    .default(sql`'{}'`),
  createdAt: t
    .timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: t
    .timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const deletedUserEmailHashes = t.pgTable('deleted_user_email_hashes', {
  id: t.bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  emailHash: t.text('email_hash').notNull().unique(),
  deletedAt: t
    .timestamp('deleted_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
