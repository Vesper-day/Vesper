// TODO: replace with Drizzle inferred types after Chat 006 runs drizzle-kit pull
// and emits the canonical TypeScript types from the applied schema.

import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Plain TS interfaces — mirrors the Drizzle schema in src/schema/*.ts
// ---------------------------------------------------------------------------

type Archetype = 'nine_to_five' | 'remote' | 'student' | 'athlete' | 'founder' | 'mixed';
type Honorific = 'sir' | 'madam' | 'none';
type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'read_only' | 'archived' | 'deletion_scheduled';
type Tier = 'standard' | 'optimizer';
type PaymentSource = 'stripe' | 'apple';

type BlockType = 'work' | 'fitness' | 'nutrition' | 'sleep' | 'errands' | 'medication' | 'finance' | 'focus' | 'commute' | 'custom';
type BlockStatus = 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'rescheduled';
type BlockSource = 'ai_generated' | 'user_added' | 'google_calendar' | 'recurring';

type Priority = 'low' | 'medium' | 'high';
type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface UserRow {
  id: string;
  email: string;
  archetype: Archetype;
  timezone: string;
  locationLat?: string | null;
  locationLng?: string | null;
  honorific: Honorific;
  subscriptionStatus: SubscriptionStatus;
  trialStartedAt?: Date | null;
  trialEndsAt?: Date | null;
  deletionRequestedAt?: Date | null;
  tier: Tier;
  paymentSource?: PaymentSource | null;
  referredByUserId?: string | null;
  referralCode?: string | null;
  onboardingCompletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyPlanRow {
  id: string;
  userId: string;
  planDate: string; // YYYY-MM-DD
  generatedAt: Date;
  energyScore?: number | null;
  regenerationCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BlockRow {
  id: string;
  dailyPlanId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  blockType: BlockType;
  title: string;
  status: BlockStatus;
  details: Record<string, unknown>;
  source: BlockSource;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskRow {
  id: string;
  userId: string;
  title: string;
  estimatedMinutes: number;
  deadline?: Date | null;
  priority: Priority;
  status: TaskStatus;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowPlus(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createUser(overrides: Partial<UserRow> = {}): UserRow {
  const now = new Date();
  return {
    id: randomUUID(),
    email: `test-${Date.now()}@example.com`,
    archetype: 'nine_to_five',
    timezone: 'America/Los_Angeles',
    locationLat: null,
    locationLng: null,
    honorific: 'none',
    subscriptionStatus: 'trial',
    trialStartedAt: now,
    trialEndsAt: nowPlus(14 * 24 * 60), // 14-day trial
    deletionRequestedAt: null,
    tier: 'standard',
    paymentSource: null,
    referredByUserId: null,
    referralCode: null,
    onboardingCompletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createPlan(overrides: Partial<DailyPlanRow> = {}): DailyPlanRow {
  const now = new Date();
  return {
    id: randomUUID(),
    userId: randomUUID(),
    planDate: todayIso(),
    generatedAt: now,
    energyScore: null,
    regenerationCount: 0,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createBlock(overrides: Partial<BlockRow> = {}): BlockRow {
  const now = new Date();
  const start = nowPlus(60);
  const end = nowPlus(120);
  return {
    id: randomUUID(),
    dailyPlanId: randomUUID(),
    userId: randomUUID(),
    startTime: start,
    endTime: end,
    blockType: 'work',
    title: 'Test block',
    status: 'scheduled',
    details: {},
    source: 'user_added',
    displayOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createTask(overrides: Partial<TaskRow> = {}): TaskRow {
  const now = new Date();
  return {
    id: randomUUID(),
    userId: randomUUID(),
    title: 'Test task',
    estimatedMinutes: 30,
    deadline: null,
    priority: 'medium',
    status: 'pending',
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
