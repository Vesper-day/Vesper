// Mobile-local mirror of the §9 GET PlanResponse contract (build chat 040).
//
// The RENDER SOURCE for the mobile day view is the camelCase / ISO-string / server-
// computed-status shape emitted by GET /api/v1/plans/date/[date] — the same contract
// apps/web/app/api/v1/plans/operations.ts declares (PlanResponse / PlanBlock). Mobile
// cannot import that web module (no apps/web dependency), so the shape is MIRRORED
// here by hand. This is deliberately NOT @vesper/shared's DailyPlanSchema (that is the
// synthesis-OUTPUT shape: HH:MM times, no id/status) — never render against that.
//
// Pure types only — no react-native, no I/O — so the pure helpers (planViewHelpers)
// that reference PlanBlock stay unit-testable without pulling RN into the test graph.

export type EffectiveBlockStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'skipped'
  | 'rescheduled';

export type BlockType =
  | 'work'
  | 'fitness'
  | 'nutrition'
  | 'sleep'
  | 'errands'
  | 'medication'
  | 'finance'
  | 'focus'
  | 'commute'
  | 'custom';

export type BlockSource =
  | 'ai_generated'
  | 'user_added'
  | 'google_calendar'
  | 'recurring';

export interface PlanBlock {
  id: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  blockType: BlockType;
  title: string;
  /** Server-COMPUTED effective status — rendered AS-IS (never recomputed client-side). */
  status: EffectiveBlockStatus;
  source: BlockSource;
  displayOrder: number;
  details: Record<string, unknown>;
}

export interface Plan {
  id: string;
  planDate: string; // YYYY-MM-DD
  generatedAt: string; // ISO 8601
  energyScore: number | null;
  regenerationCount: number;
  blocks: PlanBlock[];
}

export interface PlanResponse {
  plan: Plan;
}
