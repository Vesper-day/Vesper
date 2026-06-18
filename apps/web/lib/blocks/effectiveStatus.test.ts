// Offline unit test for computeEffectiveStatus (no DB, no network).
// Run: pnpm --filter @vesper/web test -- effectiveStatus
import { describe, it, expect } from 'vitest';
import { computeEffectiveStatus } from './effectiveStatus';

describe('computeEffectiveStatus', () => {
  const start = new Date('2026-06-15T09:00:00.000Z');
  const end = new Date('2026-06-15T10:00:00.000Z');

  it("derives 'in_progress' for a scheduled block when now is in [start, end)", () => {
    const now = new Date('2026-06-15T09:30:00.000Z');
    expect(computeEffectiveStatus('scheduled', start, end, now)).toBe('in_progress');
  });

  it('returns scheduled at the exact start instant (inclusive lower bound)', () => {
    expect(computeEffectiveStatus('scheduled', start, end, start)).toBe('in_progress');
  });

  it('returns scheduled at the exact end instant (exclusive upper bound)', () => {
    expect(computeEffectiveStatus('scheduled', start, end, end)).toBe('scheduled');
  });

  it('returns scheduled when now is before the window', () => {
    const now = new Date('2026-06-15T08:59:59.000Z');
    expect(computeEffectiveStatus('scheduled', start, end, now)).toBe('scheduled');
  });

  it('returns scheduled when now is after the window', () => {
    const now = new Date('2026-06-15T10:00:01.000Z');
    expect(computeEffectiveStatus('scheduled', start, end, now)).toBe('scheduled');
  });

  it('passes non-scheduled statuses through unchanged even inside the window', () => {
    const now = new Date('2026-06-15T09:30:00.000Z');
    expect(computeEffectiveStatus('completed', start, end, now)).toBe('completed');
    expect(computeEffectiveStatus('skipped', start, end, now)).toBe('skipped');
    expect(computeEffectiveStatus('rescheduled', start, end, now)).toBe('rescheduled');
  });

  it('returns the stored status when times are null (user-added blocks may omit them)', () => {
    const now = new Date('2026-06-15T09:30:00.000Z');
    expect(computeEffectiveStatus('scheduled', null, null, now)).toBe('scheduled');
    expect(computeEffectiveStatus('scheduled', start, null, now)).toBe('scheduled');
    expect(computeEffectiveStatus('scheduled', null, end, now)).toBe('scheduled');
  });

  it('returns scheduled when end is not after start (invalid interval)', () => {
    const now = new Date('2026-06-15T09:30:00.000Z');
    expect(computeEffectiveStatus('scheduled', end, start, now)).toBe('scheduled');
  });
});
