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
