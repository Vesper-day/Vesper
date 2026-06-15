import { afterEach, describe, expect, it, vi } from 'vitest';

const generateObjectMock = vi.fn();
vi.mock('../generateObject', () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));

import { selectWorkoutTemplate } from '../selectWorkoutTemplate';
import { selectRecipeTemplate } from '../selectRecipeTemplate';
import type { WorkoutTemplate, RecipeTemplate } from '../context/templateSubset';

afterEach(() => {
  vi.clearAllMocks();
});

const W1 = '11111111-1111-4111-8111-111111111111';
const W2 = '22222222-2222-4222-8222-222222222222';
const R1 = '33333333-3333-4333-8333-333333333333';
const R2 = '44444444-4444-4444-8444-444444444444';

function workout(id: string, intensityScore: number): WorkoutTemplate {
  return {
    id,
    name: `Workout ${id.slice(0, 4)}`,
    goalTags: ['strength'],
    equipmentTags: ['dumbbells'],
    durationMinutes: 30,
    level: 'intermediate',
    intensityScore,
    content: {},
    source: 'exercisedb',
    createdAt: new Date('2026-06-01T00:00:00Z'),
  };
}

function recipe(id: string, totalMinutes: number): RecipeTemplate {
  return {
    id,
    name: `Recipe ${id.slice(0, 4)}`,
    cuisineTags: ['italian'],
    dietTags: ['vegetarian'],
    prepMinutes: 10,
    cookMinutes: totalMinutes - 10,
    totalMinutes,
    difficulty: 'easy',
    macros: {},
    servings: 2,
    ingredients: [],
    instructions: [],
    imageUrl: null,
    source: 'themealdb',
    createdAt: new Date('2026-06-01T00:00:00Z'),
  };
}

describe('selectWorkoutTemplate', () => {
  const candidates = [workout(W1, 8), workout(W2, 3)];

  it('returns the AI-chosen id when it is in the candidate set', async () => {
    generateObjectMock.mockResolvedValue({ object: { templateId: W1 } });
    await expect(
      selectWorkoutTemplate({ fitnessPrefs: { goal: 'strength' }, energyScore: 7, candidates }),
    ).resolves.toBe(W1);
  });

  it('falls back to the lowest-intensity candidate when the AI returns null', async () => {
    generateObjectMock.mockResolvedValue({ object: { templateId: null } });
    await expect(
      selectWorkoutTemplate({ fitnessPrefs: {}, energyScore: null, candidates }),
    ).resolves.toBe(W2); // intensity 3 < 8
  });

  it('falls back when the AI returns an id outside the candidate set', async () => {
    generateObjectMock.mockResolvedValue({
      object: { templateId: '99999999-9999-4999-8999-999999999999' },
    });
    await expect(
      selectWorkoutTemplate({ fitnessPrefs: {}, energyScore: 5, candidates }),
    ).resolves.toBe(W2);
  });

  it('throws on an empty candidate set', async () => {
    await expect(
      selectWorkoutTemplate({ fitnessPrefs: {}, energyScore: 5, candidates: [] }),
    ).rejects.toThrow(/empty/);
  });
});

describe('selectRecipeTemplate', () => {
  const candidates = [recipe(R1, 45), recipe(R2, 15)];

  it('returns the AI-chosen id when it is in the candidate set', async () => {
    generateObjectMock.mockResolvedValue({ object: { templateId: R1 } });
    await expect(
      selectRecipeTemplate({ nutritionPrefs: { dietTags: ['vegetarian'] }, energyScore: 6, candidates }),
    ).resolves.toBe(R1);
  });

  it('falls back to the lowest total-minutes candidate when the AI returns null', async () => {
    generateObjectMock.mockResolvedValue({ object: { templateId: null } });
    await expect(
      selectRecipeTemplate({ nutritionPrefs: {}, energyScore: null, candidates }),
    ).resolves.toBe(R2); // 15min < 45min
  });

  it('throws on an empty candidate set', async () => {
    await expect(
      selectRecipeTemplate({ nutritionPrefs: {}, energyScore: 5, candidates: [] }),
    ).rejects.toThrow(/empty/);
  });
});
