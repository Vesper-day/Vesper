import { describe, it, expect } from 'vitest';
import {
  selectExpiringRoots,
  EXPIRY_THRESHOLD_DAYS,
  type MonitoredRoot,
} from './selectExpiringRoots.logic';

const NOW = new Date('2026-07-13T00:00:00.000Z');
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * MS_PER_DAY);

describe('selectExpiringRoots', () => {
  const nearExpiry: MonitoredRoot = {
    name: 'near',
    sha256: 'aa',
    notAfter: daysFromNow(90), // within 180
  };
  const healthy: MonitoredRoot = {
    name: 'healthy',
    sha256: 'bb',
    notAfter: daysFromNow(400), // well outside 180
  };
  const expired: MonitoredRoot = {
    name: 'expired',
    sha256: 'cc',
    notAfter: daysFromNow(-5), // already past
  };

  it('selects a root within the 180-day window', () => {
    const selected = selectExpiringRoots([nearExpiry, healthy], NOW).map((r) => r.name);
    expect(selected).toEqual(['near']);
  });

  it('returns none for a fully healthy set', () => {
    expect(selectExpiringRoots([healthy], NOW)).toEqual([]);
  });

  it('selects a root at exactly the 180-day boundary (inclusive)', () => {
    const edge: MonitoredRoot = {
      name: 'edge',
      sha256: 'dd',
      notAfter: daysFromNow(EXPIRY_THRESHOLD_DAYS), // notAfter === now + 180d
    };
    expect(selectExpiringRoots([edge], NOW).map((r) => r.name)).toEqual(['edge']);
  });

  it('selects an already-expired root and reports negative daysRemaining', () => {
    const [got] = selectExpiringRoots([expired], NOW);
    expect(got?.name).toBe('expired');
    expect(got?.daysRemaining).toBe(-5);
  });

  it('reports whole-days remaining for a near-expiry root', () => {
    const [got] = selectExpiringRoots([nearExpiry], NOW);
    expect(got?.daysRemaining).toBe(90);
  });

  it('honours a custom thresholdDays', () => {
    // At a 30-day threshold, the 90-day root is healthy.
    expect(selectExpiringRoots([nearExpiry], NOW, 30)).toEqual([]);
  });
});
