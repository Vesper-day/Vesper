// Chat 064 — getTodayEvents unit tests. Everything external is mocked: the Google
// token + calendar HTTP calls (global.fetch), the 023 classifier, the encryption
// helper, the Sentry breadcrumb sink, and the Drizzle client. We assert the token
// refresh lifecycle, the error/reconnect flag, and the classification routing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock @vesper/db: a passthrough `sql` tag (captures the rendered text) and a
//     `db.execute` stub we program per test. createDrizzleClient returns it too.
interface CapturedQuery {
  text: string;
  values: unknown[];
}
function renderSql(strings: TemplateStringsArray, ...values: unknown[]): CapturedQuery {
  return { text: strings.join(' ? '), values };
}
const executeMock = vi.fn();
const mockDb = { execute: executeMock };
vi.mock('@vesper/db', () => ({
  createDrizzleClient: () => mockDb,
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => renderSql(strings, ...values),
}));

// --- Mock encryption helper.
const decryptTokenMock = vi.fn();
const encryptTokenMock = vi.fn();
vi.mock('@vesper/db/encryption', () => ({
  decryptToken: (...a: unknown[]) => decryptTokenMock(...a),
  encryptToken: (...a: unknown[]) => encryptTokenMock(...a),
}));

// --- Mock the 023 classifier (both forms).
const classifySingleMock = vi.fn();
const classifyBatchMock = vi.fn();
vi.mock('../classifyCalendarEvent', () => ({
  classifyCalendarEvent: (...a: unknown[]) => classifySingleMock(...a),
}));
vi.mock('../classifyCalendarEventsBatch', () => ({
  classifyCalendarEventsBatch: (...a: unknown[]) => classifyBatchMock(...a),
}));

// --- Mock Sentry breadcrumb sink.
const addBreadcrumbMock = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: (...a: unknown[]) => addBreadcrumbMock(...a),
  captureException: vi.fn(),
}));

import { getTodayEvents } from './googleCalendar';

const USER = '11111111-1111-1111-1111-111111111111';
const NOW = new Date('2026-06-23T12:00:00.000Z');

/** Find the executed query whose rendered SQL contains `needle`. */
function executedQueryWith(needle: string): CapturedQuery | undefined {
  return executeMock.mock.calls
    .map((c) => c[0] as CapturedQuery)
    .find((q) => q.text.includes(needle));
}

/** Program the first SELECT to return a single integrations row. */
function selectReturns(row: Record<string, unknown> | undefined): void {
  executeMock.mockImplementation((q: CapturedQuery) => {
    if (q.text.includes('SELECT status')) return Promise.resolve(row ? [row] : []);
    return Promise.resolve([]); // UPDATEs
  });
}

function googleCalendarOk(items: unknown[]): void {
  globalThis.fetch = vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({ access_token: 'fresh-access', expires_in: 3600 }), {
        status: 200,
      });
    }
    // calendar events endpoint
    return new Response(JSON.stringify({ items }), { status: 200 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'cid';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'csecret';
  decryptTokenMock.mockResolvedValue('decrypted-token');
  encryptTokenMock.mockResolvedValue(Buffer.from('new-ciphertext'));
  classifySingleMock.mockResolvedValue('work');
  classifyBatchMock.mockImplementation(async (titles: string[]) => titles.map(() => 'work'));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('getTodayEvents — token refresh lifecycle', () => {
  it('refreshes when the token is within 5 minutes of expiry', async () => {
    selectReturns({
      status: 'connected',
      access_token_encrypted: Buffer.from('a'),
      refresh_token_encrypted: Buffer.from('r'),
      expires_at: new Date(NOW.getTime() + 60 * 1000).toISOString(), // 1 min left
    });
    googleCalendarOk([]);

    await getTodayEvents(USER, { db: mockDb as never, now: NOW });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledToken = fetchMock.mock.calls.some((c) =>
      String(c[0]).includes('oauth2.googleapis.com/token'),
    );
    expect(calledToken).toBe(true);
  });

  it('does NOT refresh when the token is comfortably valid', async () => {
    selectReturns({
      status: 'connected',
      access_token_encrypted: Buffer.from('a'),
      refresh_token_encrypted: Buffer.from('r'),
      expires_at: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(), // 1h left
    });
    googleCalendarOk([]);

    await getTodayEvents(USER, { db: mockDb as never, now: NOW });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const calledToken = fetchMock.mock.calls.some((c) =>
      String(c[0]).includes('oauth2.googleapis.com/token'),
    );
    expect(calledToken).toBe(false);
  });

  it('on successful refresh: re-encrypts + writes the new token, and bumps last_synced_at', async () => {
    selectReturns({
      status: 'connected',
      access_token_encrypted: Buffer.from('a'),
      refresh_token_encrypted: Buffer.from('r'),
      expires_at: new Date(NOW.getTime() - 1000).toISOString(), // expired
    });
    googleCalendarOk([]);

    await getTodayEvents(USER, { db: mockDb as never, now: NOW });

    expect(encryptTokenMock).toHaveBeenCalledWith('fresh-access');
    expect(executedQueryWith('access_token_encrypted =')).toBeDefined();
    expect(executedQueryWith('last_synced_at = now()')).toBeDefined();
  });
});

describe('getTodayEvents — error / reconnect lifecycle', () => {
  it('on refresh failure: sets status=error + last_error, sets reconnect flag, returns [] and breadcrumbs', async () => {
    selectReturns({
      status: 'connected',
      access_token_encrypted: Buffer.from('a'),
      refresh_token_encrypted: Buffer.from('r'),
      expires_at: new Date(NOW.getTime() - 1000).toISOString(),
    });
    globalThis.fetch = vi.fn(async (input: unknown) => {
      if (String(input).includes('oauth2.googleapis.com/token')) {
        return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 });
      }
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;

    const events = await getTodayEvents(USER, { db: mockDb as never, now: NOW });

    expect(events).toEqual([]);
    const errQuery = executedQueryWith("status = 'error'");
    expect(errQuery).toBeDefined();
    expect(errQuery?.values).toContain(
      'Google rejected the token refresh (status 400, invalid_grant).',
    );
    // breadcrumb on the failing attempt
    const refreshCrumbs = addBreadcrumbMock.mock.calls.filter(
      (c) => (c[0] as { category: string }).category === 'integrations.google-calendar.refresh',
    );
    expect(refreshCrumbs.length).toBeGreaterThanOrEqual(1);
  });

  it('status != connected on entry: returns [], no Google call, reconnect flag affirmed', async () => {
    selectReturns({
      status: 'error',
      access_token_encrypted: Buffer.from('a'),
      refresh_token_encrypted: Buffer.from('r'),
      expires_at: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
    });
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    const events = await getTodayEvents(USER, { db: mockDb as never, now: NOW });

    expect(events).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(executedQueryWith("status = 'error'")).toBeDefined();
  });
});

describe('getTodayEvents — classification routing', () => {
  function connectedValid(): void {
    selectReturns({
      status: 'connected',
      access_token_encrypted: Buffer.from('a'),
      refresh_token_encrypted: Buffer.from('r'),
      expires_at: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
    });
  }

  function event(id: string, title: string): unknown {
    return {
      id,
      summary: title,
      start: { dateTime: '2026-06-23T09:00:00Z' },
      end: { dateTime: '2026-06-23T10:00:00Z' },
    };
  }

  it('a rule-matchable title ("gym") never calls the classifier', async () => {
    connectedValid();
    googleCalendarOk([event('e1', 'Morning gym session')]);

    const events = await getTodayEvents(USER, { db: mockDb as never, now: NOW });

    expect(events).toHaveLength(1);
    expect(classifySingleMock).not.toHaveBeenCalled();
    expect(classifyBatchMock).not.toHaveBeenCalled();
  });

  it('exactly 1 ambiguous title calls classifyCalendarEvent (not the batch)', async () => {
    connectedValid();
    googleCalendarOk([event('e1', 'Sync with Priya'), event('e2', 'gym')]);

    await getTodayEvents(USER, { db: mockDb as never, now: NOW });

    expect(classifySingleMock).toHaveBeenCalledTimes(1);
    expect(classifySingleMock).toHaveBeenCalledWith('Sync with Priya');
    expect(classifyBatchMock).not.toHaveBeenCalled();
  });

  it('2+ ambiguous titles call classifyCalendarEventsBatch exactly once', async () => {
    connectedValid();
    googleCalendarOk([
      event('e1', 'Sync with Priya'),
      event('e2', 'Project Falcon'),
      event('e3', 'gym'),
    ]);

    await getTodayEvents(USER, { db: mockDb as never, now: NOW });

    expect(classifyBatchMock).toHaveBeenCalledTimes(1);
    expect(classifyBatchMock).toHaveBeenCalledWith(['Sync with Priya', 'Project Falcon']);
    expect(classifySingleMock).not.toHaveBeenCalled();
  });
});
