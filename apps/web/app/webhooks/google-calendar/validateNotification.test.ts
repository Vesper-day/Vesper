import { describe, it, expect } from 'vitest';
import { classifyNotification } from './validateNotification';

const TOKEN = 'the-configured-channel-secret';

/** Build a Web Headers from a plain map (undefined values are simply omitted). */
function h(map: Record<string, string | undefined>): Headers {
  const headers = new Headers();
  for (const [k, v] of Object.entries(map)) {
    if (v !== undefined) headers.set(k, v);
  }
  return headers;
}

describe('classifyNotification', () => {
  it('valid token + exists → { action: sync, tokenValid: true }', () => {
    const result = classifyNotification(
      h({
        'x-goog-channel-token': TOKEN,
        'x-goog-channel-id': 'chan-1',
        'x-goog-resource-id': 'res-1',
        'x-goog-message-number': '42',
        'x-goog-resource-state': 'exists',
        'x-goog-resource-uri': 'https://www.googleapis.com/calendar/v3/...',
      }),
      TOKEN,
    );
    expect(result.action).toBe('sync');
    expect(result.tokenValid).toBe(true);
    expect(result.channelId).toBe('chan-1');
    expect(result.resourceId).toBe('res-1');
    expect(result.messageNumber).toBe('42');
  });

  it('valid token + sync handshake → { action: ack, tokenValid: true } (no sync)', () => {
    const result = classifyNotification(
      h({
        'x-goog-channel-token': TOKEN,
        'x-goog-channel-id': 'chan-1',
        'x-goog-resource-id': 'res-1',
        'x-goog-message-number': '1',
        'x-goog-resource-state': 'sync',
      }),
      TOKEN,
    );
    expect(result.action).toBe('ack');
    expect(result.tokenValid).toBe(true);
  });

  it('token mismatch → tokenValid:false (route maps to 401, no sync)', () => {
    const result = classifyNotification(
      h({
        'x-goog-channel-token': 'spoofed-or-stale-token',
        'x-goog-channel-id': 'chan-1',
        'x-goog-resource-state': 'exists',
      }),
      TOKEN,
    );
    expect(result.tokenValid).toBe(false);
  });

  it('missing token header → tokenValid:false', () => {
    const result = classifyNotification(
      h({ 'x-goog-channel-id': 'chan-1', 'x-goog-resource-state': 'exists' }),
      TOKEN,
    );
    expect(result.tokenValid).toBe(false);
  });

  it('no configured secret → fail closed (tokenValid:false even if a token is sent)', () => {
    const result = classifyNotification(
      h({ 'x-goog-channel-token': TOKEN, 'x-goog-channel-id': 'c', 'x-goog-resource-state': 'sync' }),
      undefined,
    );
    expect(result.tokenValid).toBe(false);
  });

  it('malformed (missing resource-state) → action:ignore', () => {
    const result = classifyNotification(
      h({ 'x-goog-channel-token': TOKEN, 'x-goog-channel-id': 'chan-1' }),
      TOKEN,
    );
    expect(result.action).toBe('ignore');
  });

  it('malformed (missing channel-id) → action:ignore', () => {
    const result = classifyNotification(
      h({ 'x-goog-channel-token': TOKEN, 'x-goog-resource-state': 'exists' }),
      TOKEN,
    );
    expect(result.action).toBe('ignore');
  });

  it('empty header set → action:ignore, tokenValid:false', () => {
    const result = classifyNotification(h({}), TOKEN);
    expect(result.action).toBe('ignore');
    expect(result.tokenValid).toBe(false);
  });

  it('not_exists state (valid token) → action:ignore (no sync)', () => {
    const result = classifyNotification(
      h({
        'x-goog-channel-token': TOKEN,
        'x-goog-channel-id': 'chan-1',
        'x-goog-resource-state': 'not_exists',
      }),
      TOKEN,
    );
    expect(result.action).toBe('ignore');
    expect(result.tokenValid).toBe(true);
  });
});
