import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@vesper/db';
import { buildPlanContext } from '../planContext';
import { DAILY_PLAN_SYNTHESIS_PROMPT } from '../../prompts/dailyPlanSynthesis';

const baseProfile = {
  recurringCommitments: [],
  locationBoundEvents: [],
  goals: [],
  wakeTarget: '07:00',
  bedtimeTarget: '23:00',
  location: { lat: 1, lng: 2 },
  notificationPreferences: { morningKnockEnabled: true, alarmEnabled: false },
};

const modulesEnabled = {
  work: { enabled: true },
  fitness: { enabled: false, equipment: [] },
  nutrition: { enabled: false, dietTags: [], dislikes: [] },
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

function mockDb(): Database {
  const row: Row = {
    archetype: 'remote',
    timezone: 'UTC',
    locationLat: '1',
    locationLng: '2',
    baseProfile,
    modulesEnabled,
  };
  const chain: Chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    limit: () => Promise.resolve([row]),
  };
  return { select: () => chain } as unknown as Database;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('buildPlanContext', () => {
  it('assembles a 2-message array with cache_control on Layers 1/2/3 and none on Layer 4', async () => {
    const messages = await buildPlanContext(
      'user-1',
      '2026-06-14',
      6,
      [{ id: 'e1', title: 'Standup', startTime: '09:00', endTime: '09:30' }],
      [{ id: 't1', title: 'Ship', estimatedMinutes: 60, priority: 'high', deadline: null }],
      mockDb(),
    );

    // 1 system + 1 user-with-parts.
    expect(messages).toHaveLength(2);

    const [layer1, userMessage] = messages;

    // Layer 1 — system, equals the live constant, cached.
    expect(layer1?.role).toBe('system');
    expect(layer1?.content).toBe(DAILY_PLAN_SYNTHESIS_PROMPT);
    expect(layer1?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });

    expect(userMessage?.role).toBe('user');
    const parts = userMessage?.content;
    if (!Array.isArray(parts)) throw new Error('expected user message parts array');
    expect(parts).toHaveLength(3);

    // Layers 2 & 3 cached.
    expect(parts[0]?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });
    expect(parts[1]?.providerOptions).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    });

    // Layer 4 — volatile, NOT cached.
    expect(parts[2]?.providerOptions).toBeUndefined();
  });

  it('makes no network/AI call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await buildPlanContext('user-1', '2026-06-14', null, [], [], mockDb());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
