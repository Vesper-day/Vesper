import { describe, it, expect } from 'vitest';
import { liftLogEntryLabel, workoutScheduleItemLabel } from './fitness';

// Pure helpers — no react-native, no expo-router imported, so this runs clean in the
// node vitest env.

describe('liftLogEntryLabel', () => {
  it('renders the exercise, set, reps, and weight when all are present', () => {
    expect(
      liftLogEntryLabel({
        exerciseName: 'Bench press',
        setNumber: 2,
        reps: 8,
        weight: 60,
        weightUnit: 'kg',
      }),
    ).toBe('Bench press: set 2, 8 reps, 60 kg');
  });

  it('omits the weight for a bodyweight set (weight null)', () => {
    expect(
      liftLogEntryLabel({
        exerciseName: 'Push-up',
        setNumber: 1,
        reps: 12,
        weight: null,
        weightUnit: null,
      }),
    ).toBe('Push-up: set 1, 12 reps');
  });

  it('renders just the set index when reps and weight are absent', () => {
    expect(
      liftLogEntryLabel({
        exerciseName: 'Plank',
        setNumber: 3,
        reps: null,
        weight: null,
        weightUnit: null,
      }),
    ).toBe('Plank: set 3');
  });
});

describe('workoutScheduleItemLabel', () => {
  it('renders "<name>: <duration> min, <level>"', () => {
    expect(
      workoutScheduleItemLabel({
        name: 'Full body',
        durationMinutes: 30,
        level: 'intermediate',
      }),
    ).toBe('Full body: 30 min, intermediate');
  });
});
