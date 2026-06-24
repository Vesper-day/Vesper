import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createConflictToast,
  CONFLICT_TOAST_SINGLE,
  CONFLICT_TOAST_MULTI,
  CONFLICT_TOAST_COALESCE_WINDOW_MS,
} from './conflictToast';

describe('createConflictToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces two 409s within 5s into ONE toast with the multi-event copy', () => {
    const emit = vi.fn();
    const toast = createConflictToast({ emit });

    toast.notify();
    vi.advanceTimersByTime(CONFLICT_TOAST_COALESCE_WINDOW_MS - 1);
    toast.notify(); // second 409 still inside the window
    expect(emit).not.toHaveBeenCalled(); // window not closed yet

    vi.advanceTimersByTime(1); // close the window
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(CONFLICT_TOAST_MULTI);
  });

  it('emits the single-event copy for a lone 409', () => {
    const emit = vi.fn();
    const toast = createConflictToast({ emit });

    toast.notify();
    vi.advanceTimersByTime(CONFLICT_TOAST_COALESCE_WINDOW_MS);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(CONFLICT_TOAST_SINGLE);
  });

  it('opens a fresh window after the previous one closes', () => {
    const emit = vi.fn();
    const toast = createConflictToast({ emit });

    toast.notify();
    vi.advanceTimersByTime(CONFLICT_TOAST_COALESCE_WINDOW_MS);
    expect(emit).toHaveBeenLastCalledWith(CONFLICT_TOAST_SINGLE);

    toast.notify();
    toast.notify();
    vi.advanceTimersByTime(CONFLICT_TOAST_COALESCE_WINDOW_MS);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenLastCalledWith(CONFLICT_TOAST_MULTI);
  });

  it('the two strings are the exact, voice-gate-exempt contract copy (em-dash intact)', () => {
    expect(CONFLICT_TOAST_SINGLE).toBe('Your other device edited this — refreshed');
    expect(CONFLICT_TOAST_MULTI).toBe('Refreshed — your other device made changes');
  });
});
