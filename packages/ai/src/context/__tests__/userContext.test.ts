import { describe, expect, it } from 'vitest';
import type { Database } from '@vesper/db';
import { buildUserContext } from '../userContext';

// Post-111 valid base_profile / modules_enabled JSONB payloads.
const baseProfile = {
  recurringCommitments: [],
  locationBoundEvents: [],
  goals: [],
  wakeTarget: '07:00',
  bedtimeTarget: '23:00',
  location: { lat: 37.7749, lng: -122.4194 },
  notificationPreferences: { morningKnockEnabled: true, alarmEnabled: false },
};

const modulesEnabled = {
  work: { enabled: true },
  fitness: { enabled: true, goal: 'strength', equipment: ['barbell'], level: 'intermediate' },
  nutrition: { enabled: true, dietTags: ['high_protein'], dislikes: [] },
  sleep: { enabled: true },
  errands: { enabled: false },
  medication: { enabled: false },
  finance: { enabled: false },
};

type Row = {
  archetype: string;
  timezone: string;
  locationLat: string | null;
  locationLng: string | null;
  baseProfile: unknown;
  modulesEnabled: unknown;
};

type Chain = {
  from: () => Chain;
  innerJoin: () => Chain;
  where: () => Chain;
  limit: () => Promise<Row[]>;
};

// Minimal chainable Drizzle stub: select().from().innerJoin().where().limit().
function mockDb(row: Row | undefined): Database {
  const chain: Chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(row === undefined ? [] : [row]),
  };
  return { select: () => chain } as unknown as Database;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    archetype: 'founder',
    timezone: 'America/Los_Angeles',
    locationLat: '37.7749000',
    locationLng: '-122.4194000',
    baseProfile,
    modulesEnabled,
    ...overrides,
  };
}

describe('buildUserContext', () => {
  it('parses post-111 base_profile and modules_enabled and returns location as an object', async () => {
    const ctx = await buildUserContext('user-1', mockDb(row()));

    expect(ctx.userId).toBe('user-1');
    expect(ctx.archetype).toBe('founder');
    expect(ctx.timezone).toBe('America/Los_Angeles');

    // location is an OBJECT sourced from the users-row numeric columns.
    expect(ctx.location).toEqual({ lat: 37.7749, lng: -122.4194 });

    // Post-111 base-profile shape: top-level wake/bed/location/notificationPreferences.
    expect(ctx.baseProfile.wakeTarget).toBe('07:00');
    expect(ctx.baseProfile.bedtimeTarget).toBe('23:00');
    expect(ctx.baseProfile.location).toEqual({ lat: 37.7749, lng: -122.4194 });
    expect(ctx.baseProfile.notificationPreferences).toEqual({
      morningKnockEnabled: true,
      alarmEnabled: false,
    });

    // sleep module keeps `enabled` only (post-111).
    expect(ctx.modulesEnabled.sleep).toEqual({ enabled: true });
    expect(ctx.modulesEnabled.fitness.goal).toBe('strength');
    expect(ctx.modulesEnabled.nutrition.dietTags).toEqual(['high_protein']);
  });

  it('returns location: null when the users-row coordinates are null', async () => {
    const ctx = await buildUserContext(
      'user-2',
      mockDb(row({ locationLat: null, locationLng: null })),
    );
    expect(ctx.location).toBeNull();
  });

  it('throws when no user/profile row exists', async () => {
    await expect(buildUserContext('missing', mockDb(undefined))).rejects.toThrow(
      /no user\/profile row/,
    );
  });

  it('throws when base_profile fails the post-111 contract', async () => {
    // Missing required wakeTarget/location/etc -> BaseProfileSchema rejects.
    await expect(
      buildUserContext('user-3', mockDb(row({ baseProfile: {} }))),
    ).rejects.toThrow(/BaseProfileSchema/);
  });
});
