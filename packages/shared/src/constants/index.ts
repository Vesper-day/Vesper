import type { Archetype, BlockType, SubscriptionStatus } from '../schemas';

export const ARCHETYPE_DISPLAY_NAMES: Record<Archetype, string> = {
  nine_to_five: 'Nine to Five',
  remote: 'Remote',
  student: 'Student',
  athlete: 'Athlete',
  founder: 'Founder',
  mixed: 'Mixed',
};

export const BLOCK_TYPE_ABBREVIATIONS: Record<BlockType, string> = {
  work: 'WRK',
  fitness: 'FIT',
  nutrition: 'NUT',
  sleep: 'SLP',
  errands: 'ERR',
  medication: 'MED',
  finance: 'FIN',
  focus: 'FOC',
  commute: 'COM',
  custom: 'CUS',
};

export const MODULE_DISPLAY_ORDER: BlockType[] = [
  'work',
  'fitness',
  'nutrition',
  'sleep',
  'errands',
  'medication',
  'finance',
];

export const SUBSCRIPTION_STATE_LABELS: Record<SubscriptionStatus, string> = {
  trial: 'Free Trial',
  active: 'Active',
  past_due: 'Past Due',
  read_only: 'Read Only',
  archived: 'Archived',
  deletion_scheduled: 'Scheduled for Deletion',
};

export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

export const TRIAL_DURATION_DAYS = 7;

export const MAX_WEEKLY_PRIORITIES = 5;
export const MIN_WEEKLY_PRIORITIES = 3;

export const ENERGY_SCORE_MIN = 1;
export const ENERGY_SCORE_MAX = 10;

export const MAX_PLAN_REGENERATIONS_BEFORE_EMPATHY = 3;
