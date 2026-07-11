import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Database } from '@vesper/db';

// @sentry/nextjs is imported transitively by the module + the @vesper/ai barrel. Mock
// it so captureException/captureMessage are inert no-ops in the test graph.
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

import {
  selectChannelsToRenew,
  RENEWAL_WINDOW_MS,
  type RenewableIntegration,
} from './gcal-channel-renewal.logic';
import { runGcalChannelRenewal } from './gcal-channel-renewal';

const NOW = new Date('2026-07-10T00:00:00.000Z');
const within24h = new Date('2026-07-10T12:00:00.000Z'); // +12h
const outside24h = new Date('2026-07-15T00:00:00.000Z'); // +5d
const past = new Date('2026-07-09T00:00:00.000Z'); // already expired

// --- Pure decision helper (offline, no mocks) ---------------------------------
describe('selectChannelsToRenew', () => {
  const rows: RenewableIntegration[] = [
    { id: 'a', userId: 'ua', status: 'connected', channelExpiration: within24h },
    { id: 'b', userId: 'ub', status: 'connected', channelExpiration: outside24h },
    { id: 'c', userId: 'uc', status: 'disconnected', channelExpiration: within24h },
    { id: 'd', userId: 'ud', status: 'connected', channelExpiration: null },
    { id: 'e', userId: 'ue', status: 'connected', channelExpiration: past },
    { id: 'f', userId: 'uf', status: 'error', channelExpiration: past },
  ];

  it('selects only connected channels expiring within 24h (past included)', () => {
    const selected = selectChannelsToRenew(rows, NOW).map((r) => r.id);
    expect(selected.sort()).toEqual(['a', 'e']); // within24h + past-expired connected
  });

  it('excludes non-connected channels even when within the window', () => {
    const selected = selectChannelsToRenew(rows, NOW).map((r) => r.id);
    expect(selected).not.toContain('c'); // disconnected
    expect(selected).not.toContain('f'); // error
  });

  it('excludes channels with no expiration and channels outside the window', () => {
    const selected = selectChannelsToRenew(rows, NOW).map((r) => r.id);
    expect(selected).not.toContain('b'); // outside 24h
    expect(selected).not.toContain('d'); // null expiration
  });

  it('respects the exact 24h boundary via windowMs', () => {
    const exactlyAtEdge = new Date(NOW.getTime() + RENEWAL_WINDOW_MS);
    const edgeRows: RenewableIntegration[] = [
      { id: 'edge', userId: 'u', status: 'connected', channelExpiration: exactlyAtEdge },
    ];
    // <= threshold, so the edge is inclusive.
    expect(selectChannelsToRenew(edgeRows, NOW).map((r) => r.id)).toEqual(['edge']);
  });
});

// --- Module (Google fetch + DB mocked via injected deps) ----------------------
describe('runGcalChannelRenewal', () => {
  /** Fake Drizzle client returning the given raw integrations rows from execute(). */
  function dbReturning(rows: unknown[]): Database {
    return { execute: vi.fn().mockResolvedValue(rows) } as unknown as Database;
  }

  const rawRows = [
    { id: 'a', user_id: 'ua', status: 'connected', channel_expiration: within24h.toISOString() },
    { id: 'b', user_id: 'ub', status: 'connected', channel_expiration: outside24h.toISOString() },
    { id: 'e', user_id: 'ue', status: 'connected', channel_expiration: past.toISOString() },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renews only within-24h connected channels and persists the new channel state', async () => {
    const registerWatchImpl = vi.fn().mockResolvedValue({
      id: 'new-chan',
      resourceId: 'new-res',
      expiration: '1900000000000',
    });
    const persistChannelStateImpl = vi.fn().mockResolvedValue(undefined);

    const summary = await runGcalChannelRenewal({
      db: dbReturning(rawRows),
      now: NOW,
      registerWatchImpl,
      persistChannelStateImpl,
    });

    // Only 'ua' (within 24h) and 'ue' (past) are attempted; 'ub' (outside) is not.
    expect(summary).toEqual({ attempted: 2, succeeded: 2, failed: 0 });
    expect(registerWatchImpl).toHaveBeenCalledTimes(2);
    const renewedUsers = registerWatchImpl.mock.calls.map((c) => c[0]).sort();
    expect(renewedUsers).toEqual(['ua', 'ue']);
    expect(registerWatchImpl).not.toHaveBeenCalledWith('ub', expect.anything());

    // Each success persists the returned channel handle for that user.
    expect(persistChannelStateImpl).toHaveBeenCalledTimes(2);
    expect(persistChannelStateImpl).toHaveBeenCalledWith(
      'ua',
      { id: 'new-chan', resourceId: 'new-res', expiration: '1900000000000' },
      expect.anything(),
    );
  });

  it('isolates a single failed renewal — the batch continues and counts are correct', async () => {
    // 'ue' fails (e.g. revoked token / Google 4xx); 'ua' still succeeds.
    const registerWatchImpl = vi.fn(async (userId: string) => {
      if (userId === 'ue') throw new Error('Google events.watch failed (status 403).');
      return { id: 'c', resourceId: 'r', expiration: null };
    });
    const persistChannelStateImpl = vi.fn().mockResolvedValue(undefined);

    const summary = await runGcalChannelRenewal({
      db: dbReturning(rawRows),
      now: NOW,
      registerWatchImpl,
      persistChannelStateImpl,
    });

    expect(summary).toEqual({ attempted: 2, succeeded: 1, failed: 1 });
    // Both were attempted — the failure of 'ue' did not abort processing of 'ua'.
    expect(registerWatchImpl).toHaveBeenCalledTimes(2);
    // Only the successful user's state was persisted.
    expect(persistChannelStateImpl).toHaveBeenCalledTimes(1);
    expect(persistChannelStateImpl).toHaveBeenCalledWith('ua', expect.anything(), expect.anything());
  });
});
