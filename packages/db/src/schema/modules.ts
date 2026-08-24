import * as t from 'drizzle-orm/pg-core';
import { users } from './users';
import { recipeTemplates, workoutTemplates } from './templates';

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

// food_log_entries — the daily food-log surface of the nutrition module (Chat
// ADD-B). Modelled to the LIVE applied DDL (migration 25). One row per logged food
// item; the day's read-back is derived by query against start_of_local_day(tz)
// (mirrors the hydration counter, migration 14). recipe_template_id is set when the
// item was chosen from the food-search corpus (ON DELETE SET NULL); NULL for
// free-text. quantity_note is an optional, UNstructured portion note. DEEP nutrition
// columns (micronutrient / vitamin / RDA / calorie) are DEFERRED (PRD §6.3) and are
// intentionally NOT modelled here. user_id ALWAYS comes from the authenticated
// session — NEVER from the request body.
export const foodLogEntries = t.pgTable(
  'food_log_entries',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    loggedAt: t
      .timestamp('logged_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    itemName: t.text('item_name').notNull(),
    recipeTemplateId: t
      .uuid('recipe_template_id')
      .references(() => recipeTemplates.id, { onDelete: 'set null' }),
    quantityNote: t.text('quantity_note'),
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
    t
      .index('idx_food_log_entries_user_id_logged_at')
      .on(table.userId, table.loggedAt),
  ],
);

// lift_log_entries — the lift-logging surface of the fitness module (Chat ADD-C).
// Modelled to the LIVE applied DDL (migration 26). One row per logged set; the day's
// read-back is derived by query against start_of_local_day(tz) (mirrors the hydration
// counter, migration 14). workout_template_id is set when logging against a
// scheduled/selected workout (ON DELETE SET NULL); NULL for ad-hoc. set_number is
// 1-based (DB CHECK > 0); reps / weight are optional (DB CHECK >= 0 when present);
// weight_unit is 'kg' | 'lb' or NULL for bodyweight sets. DEEP fitness columns
// (bronze->platinum strength-rank; world-standard percentile mapping) are DEFERRED
// (PRD §6.2) and are intentionally NOT modelled here. user_id ALWAYS comes from the
// authenticated session — NEVER from the request body.
export const liftLogEntries = t.pgTable(
  'lift_log_entries',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    loggedAt: t
      .timestamp('logged_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    exerciseName: t.text('exercise_name').notNull(),
    workoutTemplateId: t
      .uuid('workout_template_id')
      .references(() => workoutTemplates.id, { onDelete: 'set null' }),
    setNumber: t.integer('set_number').notNull(),
    reps: t.integer('reps'),
    weight: t.numeric('weight', { precision: 7, scale: 2 }),
    weightUnit: t.text('weight_unit'),
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
    t
      .index('idx_lift_log_entries_user_id_logged_at')
      .on(table.userId, table.loggedAt),
  ],
);
