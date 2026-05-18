import * as t from 'drizzle-orm/pg-core';
import { users } from './users';

export const waitlist = t.pgTable(
  'waitlist',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    email: t.text('email').notNull().unique(),
    referralCode: t.text('referral_code'),
    referredBy: t.text('referred_by'),
    joinedAt: t
      .timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    convertedAt: t.timestamp('converted_at', { withTimezone: true }),
  },
  (table) => [t.index('idx_waitlist_email').on(table.email)],
);

export const referralCredits = t.pgTable(
  'referral_credits',
  {
    id: t.uuid('id').defaultRandom().primaryKey(),
    referrerId: t
      .uuid('referrer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refereeId: t
      .uuid('referee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    creditType: t.text('credit_type').notNull(),
    creditedAt: t
      .timestamp('credited_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    t.index('idx_referral_credits_referrer_id').on(table.referrerId),
  ],
);
