import * as t from 'drizzle-orm/pg-core';
import { users } from './users';

export const medications = t.pgTable(
  'medications',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: t.text('name').notNull(),
    dosage: t.text('dosage').notNull(),
    scheduleTime: t.text('schedule_time').notNull(),
    notes: t.text('notes'),
    createdAt: t
      .timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: t
      .timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [t.index('idx_medications_user_id').on(table.userId)],
);

export const recurringErrands = t.pgTable(
  'recurring_errands',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: t.text('title').notNull(),
    location: t.text('location'),
    frequency: t.text('frequency').notNull(),
    estimatedMinutes: t.integer('estimated_minutes').notNull(),
    createdAt: t
      .timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: t
      .timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [t.index('idx_recurring_errands_user_id').on(table.userId)],
);

export const bills = t.pgTable(
  'bills',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: t.text('name').notNull(),
    amount: t.numeric('amount', { precision: 10, scale: 2 }).notNull(),
    dueDayOfMonth: t.integer('due_day_of_month').notNull(),
    autopay: t.boolean('autopay').notNull().default(false),
    createdAt: t
      .timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: t
      .timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [t.index('idx_bills_user_id').on(table.userId)],
);
