import * as t from 'drizzle-orm/pg-core';
import { users } from './users';

export const completionLog = t.pgTable(
  'completion_log',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventName: t.text('event_name').notNull(),
    value: t.jsonb('value').notNull().default({}),
    occurredAt: t
      .timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    t.index('idx_completion_log_user_id_event').on(table.userId, table.eventName),
    t.index('idx_completion_log_occurred_at').on(table.occurredAt),
  ],
);

export const securityAuditLog = t.pgTable(
  'security_audit_log',
  {
    id: t.bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: t.uuid('user_id'),
    action: t.text('action').notNull(),
    ipAddress: t.text('ip_address'),
    userAgent: t.text('user_agent'),
    metadata: t.jsonb('metadata').notNull().default({}),
    createdAt: t
      .timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    t.index('idx_security_audit_log_user_id').on(table.userId),
    t.index('idx_security_audit_log_created_at').on(table.createdAt),
  ],
);
