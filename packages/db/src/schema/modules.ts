import * as t from 'drizzle-orm/pg-core';
import { users } from './users';

// medication_frequency_enum — live on the DB since migration 0006 (verified via
// direct introspection, chat 060). Modelled here so the ORM `frequency` column is
// typed; this is NOT a migration (the enum already exists on the applied schema).
export const medicationFrequencyEnum = t.pgEnum('medication_frequency_enum', [
  'daily',
  'twice_daily',
  'weekly',
  'custom',
]);

// medications — the LIVE applied schema (migrations 0006 + 0011 + migration 20's
// shift_out_of_quiet_hours column), confirmed column-for-column by direct
// information_schema introspection in chat 060. The earlier pull-generated model
// here (dosage / schedule_time) predated 0011 and had drifted from the DB; this
// definition re-syncs the ORM model to the already-applied DDL. No migration is
// authored — the columns, the enum, the RLS policies, and the
// audit_medications_changes trigger already exist on the DB.
//   times: time[] NOT NULL DEFAULT '{}' (Drizzle .time() rows come back as
//     "HH:MM:SS" strings; the array default is supplied by the DB when omitted).
//   shift_out_of_quiet_hours: false = fire at the EXACT scheduled time (the safe
//     default for a dose); true = explicit per-med opt-in to shift out of the
//     quiet-hours window (chat 060 F2 contract).
export const medications = t.pgTable(
  'medications',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: t.text('name').notNull(),
    dose: t.text('dose').notNull(),
    frequency: medicationFrequencyEnum('frequency').notNull(),
    times: t.time('times').array().notNull(),
    startDate: t.date('start_date').notNull(),
    endDate: t.date('end_date'),
    notes: t.text('notes'),
    shiftOutOfQuietHours: t
      .boolean('shift_out_of_quiet_hours')
      .notNull()
      .default(false),
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
