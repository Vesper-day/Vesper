export { anthropicProvider, anthropicSdk, MODELS } from './client';
export type { Model } from './client';
export { voiceGate } from './voiceGate';
export { getFallbackPlan } from './fallback';

// Chat 016 additions: SDK wrappers, cache config, cost tracker, prompt-versioning types.
export * from './cacheConfig';
export * from './streamText';
export * from './generateText';
export * from './generateObject';
export * from './cost/tracker';
export * from './prompts/types';

export * from './prompts/dailyPlanSynthesis';
export * from './prompts/weeklyTemplateSynthesis';
export * from './prompts/weekly-review';
export * from './prompts/template-selection';
export * from './prompts/nl-command';
export * from './prompts/calendar-classify';
export * from './prompts/checkin-question';
export * from './prompts/empathy-regeneration';

// Chat 023: AI operation scaffolds (not yet invoked; called by later chats).
export {
  parsePlanEditCommand,
  PlanEditCommandSchema,
} from './parsePlanEditCommand';
export type {
  PlanEditCommand,
  AddBlockInput,
  ParseTelemetry,
  ParsePlanEditCommandOptions,
} from './parsePlanEditCommand';
// Chat 029: butler-tone confirmation copy for the NL command endpoint. Constants
// (not a runtime model call) so the unknown-branch clarification is deterministic.
export {
  confirmationLineFor,
  UNKNOWN_COMMAND_CLARIFICATION,
} from './confirmation';
export { selectWorkoutTemplate } from './selectWorkoutTemplate';
export type { WorkoutSelectionInput } from './selectWorkoutTemplate';
export { selectRecipeTemplate } from './selectRecipeTemplate';
export type { RecipeSelectionInput } from './selectRecipeTemplate';
// Chat ADD-B: nutrition module AI recipe-modify applier (reuses generateText — voice
// gate + cost + breaker seam; no new Anthropic model row).
export { modifyRecipe, MODIFY_RECIPE_PROMPT_VERSION } from './modifyRecipe';
export type { ModifyRecipeInput } from './modifyRecipe';
export { RECIPE_MODIFY_PROMPT, RECIPE_MODIFY_VERSION } from './prompts/recipe-modify';
export { classifyCalendarEvent, CalendarClassificationSchema } from './classifyCalendarEvent';
export { classifyCalendarEventsBatch } from './classifyCalendarEventsBatch';
export { generateCheckInQuestion } from './generateCheckInQuestion';
export type { CheckInContext } from './generateCheckInQuestion';
export { suggestWeeklyPriorities } from './suggestWeeklyPriorities';
export type { OutstandingTask, WeeklyPrioritiesInput } from './suggestWeeklyPriorities';
export { generateRegenerationPrompt } from './generateRegenerationPrompt';
export type { RegenerationContext } from './generateRegenerationPrompt';

// Chat 021: context builders + cache wiring (supersedes the pre-111 context.ts stub).
export { buildPlanContext } from './context/planContext';
export type { PlanContext, CalendarEvent, PendingTask } from './context/planContext';
export { buildUserContext } from './context/userContext';
export type { UserContext } from './context/userContext';
export { buildTemplateSubset } from './context/templateSubset';
export type {
  TemplateSubset,
  WorkoutTemplate,
  RecipeTemplate,
} from './context/templateSubset';
export { recordCacheObservation, classifyCacheOutcome } from './context/cacheObservability';
export type { CacheObservation, CacheOutcome } from './context/cacheObservability';

// Chat 022: daily-plan synthesis + three-step fallback chain.
export { synthesizePlan } from './synthesizePlan';
export type { DailyPlanChunk } from './synthesizePlan';
// APOLOGY_LINE is the fixed note prefix serveFallback prepends to a served
// fallback plan (LOCKED Decision 6). The chat-025 route is the orchestrating
// consumer: it detects "this plan was served from the fallback chain" by the
// note prefix and surfaces source:'fallback' + fallbackNotice. Re-exported here
// so that detection has a single source of truth (no duplicated magic string).
export { APOLOGY_LINE } from './synthesizePlan';
export { readBreakerState } from './synthesizePlan.circuitBreaker';
export type { BreakerState } from './synthesizePlan.circuitBreaker';

// Chat 058: weekly-template synthesis (7-day plan generation with priority threading).
export {
  synthesizeWeeklyTemplate,
  applyWeeklyConstraints,
  buildWeeklyContext,
  dateForDayIndex,
  addDaysUtc,
  WeeklyTemplateSchema,
  WeeklyDaySchema,
  WeeklyConstraintsSchema,
  EMPTY_WEEKLY_CONSTRAINTS,
  DAYS_IN_WEEK,
} from './weeklyTemplate';
export type {
  WeeklyTemplate,
  WeeklyDay,
  WeeklyConstraints,
  WeeklyPausedModule,
  WeeklyFixedNote,
  SynthesizeWeeklyTemplateParams,
  WeeklyTemplateResult,
} from './weeklyTemplate';

// Chat 064: Google Calendar today-sync (token refresh + event classification).
// Feeds the Layer-4 calendarEvents array consumed by buildPlanContext.
export { getTodayEvents } from './integrations/googleCalendar';
export type { GetTodayEventsOptions } from './integrations/googleCalendar';

// Chat 065 (re-homed by 066): Google Calendar push-channel registration (events.watch).
// Lives here so the 066 daily-cron renewal worker can import it worker-safely;
// apps/web/lib/googleCalendar/registerWatch.ts re-exports from here.
export { registerWatch } from './integrations/registerWatch';
export type { WatchChannel, RegisterWatchOptions } from './integrations/registerWatch';

// Chat 066: single channel-state persistence path (the write for registerWatch's return).
export { persistChannelState } from './integrations/persistChannelState';
export type { ChannelState, PersistChannelStateOptions } from './integrations/persistChannelState';
