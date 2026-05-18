import * as t from 'drizzle-orm/pg-core';
import { users } from './users';

export const subscriptions = t.pgTable(
  'subscriptions',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    userId: t
      .uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    stripeCustomerId: t.text('stripe_customer_id').unique(),
    stripeSubscriptionId: t.text('stripe_subscription_id').unique(),
    appleOriginalTransactionId: t.text('apple_original_transaction_id').unique(),
    currentPeriodStart: t.timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: t.timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: t.boolean('cancel_at_period_end').notNull().default(false),
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
    t.index('idx_subscriptions_stripe_customer_id').on(table.stripeCustomerId),
  ],
);

export const subscriptionEvents = t.pgTable('subscription_events', {
  id: t.uuid('id').defaultRandom().primaryKey(),
  userId: t
    .uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  eventType: t.text('event_type').notNull(),
  provider: t.text('provider').notNull(),
  rawPayload: t.jsonb('raw_payload').notNull(),
  processedAt: t
    .timestamp('processed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
