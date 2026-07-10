import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Database } from '@vesper/db';

// Stub the decrypt path (NOT a module-graph mock of libsodium — this replaces the
// @vesper/db/encryption wrapper the function dynamic-imports, so no WASM loads).
vi.mock('@vesper/db/encryption', () => ({
  decryptToken: vi.fn().mockResolvedValue('plain-access-token'),
  encryptToken: vi.fn(),
}));

import { registerWatch } from './registerWatch';

const TOKEN = 'the-configured-channel-secret';
const APP_URL = 'https://vesper.day';

/** Fake Drizzle client whose execute() returns a single connected integration row. */
function connectedDb(): Database {
  return {
    execute: vi.fn().mockResolvedValue([
      { status: 'connected', access_token_encrypted: Buffer.from([1, 2, 3]) },
    ]),
  } as unknown as Database;
}

describe('registerWatch', () => {
  beforeEach(() => {
    process.env.GOOGLE_WEBHOOK_CHANNEL_TOKEN = TOKEN;
    process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_WEBHOOK_CHANNEL_TOKEN;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it('POSTs a well-formed events.watch request and maps the response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chan-xyz',
        resourceId: 'res-abc',
        expiration: '1893456000000',
      }),
    });

    const result = await registerWatch('11111111-1111-1111-1111-111111111111', {
      db: connectedDb(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      channelId: 'chan-xyz',
      expirationMs: 1893456000000,
    });

    // Response → { id, resourceId, expiration } mapping.
    expect(result).toEqual({
      id: 'chan-xyz',
      resourceId: 'res-abc',
      expiration: '1893456000000',
    });

    // Outgoing request: endpoint + method + Bearer + JSON body.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch',
    );
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer plain-access-token');

    const sent = JSON.parse(init.body as string);
    expect(sent).toEqual({
      id: 'chan-xyz',
      type: 'web_hook',
      address: 'https://vesper.day/webhooks/google-calendar',
      token: TOKEN,
      expiration: '1893456000000',
    });
  });

  it('omits expiration from the body when not requested', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'c', resourceId: 'r' }),
    });

    const result = await registerWatch('22222222-2222-2222-2222-222222222222', {
      db: connectedDb(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      channelId: 'c',
    });

    expect(result).toEqual({ id: 'c', resourceId: 'r', expiration: null });
    const sent = JSON.parse(fetchImpl.mock.calls[0]![1].body as string);
    expect(sent).not.toHaveProperty('expiration');
  });

  it('throws when Google returns a non-2xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    await expect(
      registerWatch('33333333-3333-3333-3333-333333333333', {
        db: connectedDb(),
        fetchImpl: fetchImpl as unknown as typeof fetch,
        channelId: 'c',
      }),
    ).rejects.toThrow('status 403');
  });

  it('throws when there is no connected integration', async () => {
    const emptyDb = { execute: vi.fn().mockResolvedValue([]) } as unknown as Database;
    const fetchImpl = vi.fn();
    await expect(
      registerWatch('44444444-4444-4444-4444-444444444444', {
        db: emptyDb,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow('No connected Google Calendar integration');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws when the channel token env is missing', async () => {
    delete process.env.GOOGLE_WEBHOOK_CHANNEL_TOKEN;
    await expect(
      registerWatch('55555555-5555-5555-5555-555555555555', {
        db: connectedDb(),
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toThrow('GOOGLE_WEBHOOK_CHANNEL_TOKEN');
  });
});
