import { sql } from 'drizzle-orm';
import * as t from 'drizzle-orm/pg-core';
import { users } from './users';

// Confirm/correct lifecycle of a single Butler's Notebook inference.
// Matches notebook_inference_state_enum in migration 20260601000021.
export const notebookInferenceStateEnum = t.pgEnum(
  'notebook_inference_state_enum',
  ['pending', 'confirmed', 'corrected'],
);

// notebook_inferences — hand-authored to match migration 20260601000021 exactly
// (packages/db/src/schema is a hand-stub until chat 006's drizzle-kit pull runs).
// camelCase keys / snake_case columns per templates.ts convention.
export const notebookInferences = t.pgTable(
  'notebook_inferences',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    inferenceText: t.text('inference_text').notNull(),
    inferenceType: t.text('inference_type').notNull(),
    state: notebookInferenceStateEnum('state').notNull().default('pending'),
    correctedText: t.text('corrected_text'),
    surfacedAt: t.timestamp('surfaced_at', { withTimezone: true }),
    resolvedAt: t.timestamp('resolved_at', { withTimezone: true }),
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
      .index('idx_notebook_inferences_user_created')
      .on(table.userId, table.createdAt.desc()),
    // Partial index for the due/pending read path.
    t
      .index('idx_notebook_inferences_user_pending')
      .on(table.userId)
      .where(sql`${table.state} = 'pending'`),
  ],
);
