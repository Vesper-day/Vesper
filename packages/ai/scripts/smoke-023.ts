/* eslint-disable no-console */
// Chat 023 live smoke — exercises all 8 AI-operation scaffolds against the real
// Anthropic API. These functions issue no DB queries, so no Docker/Supabase is
// required; candidate sets are hand-built fixtures.
//
// Runs LIVE calls only when ANTHROPIC_API_KEY is set. Without the key it prints a
// skip notice and exits 0, so CI without secrets stays green.
//
//   pnpm --filter @vesper/ai smoke:023

import {
  parsePlanEditCommand,
  selectWorkoutTemplate,
  selectRecipeTemplate,
  classifyCalendarEvent,
  classifyCalendarEventsBatch,
  generateCheckInQuestion,
  suggestWeeklyPriorities,
  generateRegenerationPrompt,
} from '../src/index';
import type { WorkoutTemplate, RecipeTemplate } from '../src/context/templateSubset';

const WORKOUTS: WorkoutTemplate[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Full-body dumbbell circuit',
    goalTags: ['strength'],
    equipmentTags: ['dumbbells'],
    durationMinutes: 45,
    level: 'intermediate',
    intensityScore: 7,
    content: {},
    source: 'exercisedb',
    createdAt: new Date(),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Gentle mobility flow',
    goalTags: ['mobility'],
    equipmentTags: [],
    durationMinutes: 15,
    level: 'beginner',
    intensityScore: 2,
    content: {},
    source: 'exercisedb',
    createdAt: new Date(),
  },
];

const RECIPES: RecipeTemplate[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Sheet-pan salmon',
    cuisineTags: ['american'],
    dietTags: ['pescatarian'],
    prepMinutes: 10,
    cookMinutes: 20,
    totalMinutes: 30,
    difficulty: 'easy',
    macros: {},
    servings: 2,
    ingredients: [],
    instructions: [],
    imageUrl: null,
    source: 'themealdb',
    createdAt: new Date(),
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Quick veggie wrap',
    cuisineTags: ['mediterranean'],
    dietTags: ['vegetarian'],
    prepMinutes: 8,
    cookMinutes: 2,
    totalMinutes: 10,
    difficulty: 'easy',
    macros: {},
    servings: 1,
    ingredients: [],
    instructions: [],
    imageUrl: null,
    source: 'themealdb',
    createdAt: new Date(),
  },
];

async function run(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    const result = await fn();
    console.log(`\n[${label}]`);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`\n[${label}] FAILED:`, err instanceof Error ? err.message : err);
  }
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('skipping live smoke (no ANTHROPIC_API_KEY)');
    process.exit(0);
  }

  await run('parsePlanEditCommand', () => parsePlanEditCommand('move my workout to 7pm tonight'));
  await run('selectWorkoutTemplate', () =>
    selectWorkoutTemplate({
      fitnessPrefs: { goal: 'strength', equipment: ['dumbbells'], level: 'intermediate' },
      energyScore: 6,
      candidates: WORKOUTS,
    }),
  );
  await run('selectRecipeTemplate', () =>
    selectRecipeTemplate({
      nutritionPrefs: { dietTags: ['vegetarian'], cookingTimeMaxMinutes: 20 },
      energyScore: 4,
      candidates: RECIPES,
    }),
  );
  await run('classifyCalendarEvent', () => classifyCalendarEvent('Dentist appointment'));
  await run('classifyCalendarEventsBatch', () =>
    classifyCalendarEventsBatch(['Team standup', 'Evening run', 'Lunch with Sam']),
  );
  await run('generateCheckInQuestion', () =>
    generateCheckInQuestion({ localDate: 'Monday, June 15', recentEnergyScores: [7, 6, 8] }),
  );
  await run('suggestWeeklyPriorities', () =>
    suggestWeeklyPriorities({
      outstandingTasks: [
        { title: 'Finish onboarding flow', priority: 'high', estimatedMinutes: 180 },
        { title: 'Reply to investors', priority: 'medium', estimatedMinutes: 30 },
      ],
      priorWeekCompletion: { completed: 3, total: 5, priorPriorities: ['Ship beta', 'Rest'] },
    }),
  );
  await run('generateRegenerationPrompt', () =>
    generateRegenerationPrompt({ failedAttempts: 3, recentFeedback: 'the days feel too packed' }),
  );

  console.log('\nlive smoke complete');
}

void main();
