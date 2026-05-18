import { sql } from 'drizzle-orm';
import * as t from 'drizzle-orm/pg-core';
import { users } from './users';

export const priorityEnum = t.pgEnum('priority_enum', ['low', 'medium', 'high']);

export const taskStatusEnum = t.pgEnum('task_status_enum', [
  'pending',
  'in_progress',
  'completed',
]);

export const blockTypeEnum = t.pgEnum('block_type_enum', [
  'work',
  'fitness',
  'nutrition',
  'sleep',
  'errands',
  'medication',
  'finance',
  'focus',
  'commute',
  'custom',
]);

export const blockStatusEnum = t.pgEnum('block_status_enum', [
  'scheduled',
  'in_progress',
  'completed',
  'skipped',
  'rescheduled',
]);

export const blockSourceEnum = t.pgEnum('block_source_enum', [
  'ai_generated',
  'user_added',
  'google_calendar',
  'recurring',
]);

export const dailyPlans = t.pgTable(
  'daily_plans',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planDate: t.date('plan_date').notNull(),
    generatedAt: t
      .timestamp('generated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    energyScore: t.integer('energy_score'),
    regenerationCount: t.integer('regeneration_count').notNull().default(0),
    metadata: t.jsonb('metadata').notNull().default({}),
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
    t.unique('daily_plans_user_id_plan_date_unique').on(table.userId, table.planDate),
    t.index('idx_daily_plans_plan_date').on(table.planDate),
    t.check(
      'energy_score_range',
      sql`${table.energyScore} IS NULL OR (${table.energyScore} BETWEEN 1 AND 10)`,
    ),
  ],
);

export const blocks = t.pgTable(
  'blocks',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    dailyPlanId: t
      .uuid('daily_plan_id')
      .notNull()
      .references(() => dailyPlans.id, { onDelete: 'cascade' }),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startTime: t.timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: t.timestamp('end_time', { withTimezone: true }).notNull(),
    blockType: blockTypeEnum('block_type').notNull(),
    title: t.text('title').notNull(),
    status: blockStatusEnum('status').notNull().default('scheduled'),
    details: t.jsonb('details').notNull().default({}),
    source: blockSourceEnum('source').notNull(),
    displayOrder: t.integer('display_order').notNull().default(0),
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
    t.index('idx_blocks_daily_plan_id').on(table.dailyPlanId),
    t.index('idx_blocks_user_id_start_time').on(table.userId, table.startTime),
    t.index('idx_blocks_user_id_status').on(table.userId, table.status),
    t.check('end_after_start', sql`${table.endTime} > ${table.startTime}`),
  ],
);

export const tasks = t.pgTable(
  'tasks',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: t.text('title').notNull(),
    estimatedMinutes: t.integer('estimated_minutes').notNull(),
    deadline: t.timestamp('deadline', { withTimezone: true }),
    priority: priorityEnum('priority').notNull().default('medium'),
    status: taskStatusEnum('status').notNull().default('pending'),
    completedAt: t.timestamp('completed_at', { withTimezone: true }),
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
    t.index('idx_tasks_user_id_status').on(table.userId, table.status),
    t
      .index('idx_tasks_user_id_deadline')
      .on(table.userId, table.deadline)
      .where(
        sql`${table.deadline} IS NOT NULL AND ${table.status} != 'completed'`,
      ),
    t.check('estimated_minutes_positive', sql`${table.estimatedMinutes} > 0`),
  ],
);

export const weeklyPriorities = t.pgTable(
  'weekly_priorities',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekStartDate: t.date('week_start_date').notNull(),
    priorities: t.jsonb('priorities').notNull().default([]),
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
      .unique('weekly_priorities_user_id_week_unique')
      .on(table.userId, table.weekStartDate),
  ],
);
