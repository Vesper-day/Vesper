import * as t from 'drizzle-orm/pg-core';
import { users } from './users';

export const integrationProviderEnum = t.pgEnum('integration_provider_enum', [
  'google_calendar',
]);

export const integrationStatusEnum = t.pgEnum('integration_status_enum', [
  'connected',
  'disconnected',
  'error',
]);

export const integrations = t.pgTable(
  'integrations',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: integrationProviderEnum('provider').notNull(),
    status: integrationStatusEnum('status').notNull().default('connected'),
    encryptedAccessToken: t.text('encrypted_access_token'),
    encryptedRefreshToken: t.text('encrypted_refresh_token'),
    tokenExpiresAt: t.timestamp('token_expires_at', { withTimezone: true }),
    scopes: t.text('scopes').array().notNull().default([]),
    // Google Calendar push-channel state (migration 24, Chat 066). All nullable —
    // a not-yet-registered integration has no channel. registerWatch returns
    // { id, resourceId, expiration }; the renewal worker + 065 receiver read these.
    // NOTE: this model is otherwise stale vs the live table (chat-063/064 write the
    // integrations row with raw SQL against the real bytea columns, not this model);
    // these three are added to match migration 24, not to reconcile the pre-existing skew.
    channelId: t.text('channel_id'),
    resourceId: t.text('resource_id'),
    channelExpiration: t.timestamp('channel_expiration', { withTimezone: true }),
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
    t.unique('integrations_user_id_provider_unique').on(table.userId, table.provider),
    t.index('idx_integrations_user_id').on(table.userId),
    // Receiver maps an incoming push → user by channel_id on every webhook (migration 24).
    t.index('idx_integrations_channel_id').on(table.channelId),
  ],
);

export const pushTokens = t.pgTable(
  'push_tokens',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: t.text('token').notNull().unique(),
    platform: t.text('platform').notNull().default('ios'),
    deviceId: t.text('device_id'),
    createdAt: t
      .timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: t
      .timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [t.index('idx_push_tokens_user_id').on(table.userId)],
);
