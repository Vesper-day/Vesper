import { describe, it, expect } from 'vitest';
import { successResponse, errorResponse } from '../response';
import { ErrorCode } from '../../errors';

describe('successResponse', () => {
  it('serializes data UNWRAPPED (no envelope) with given status', async () => {
    const res = successResponse({ plan: { id: 'p1' } }, 201);
    expect(res.status).toBe(201);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.json()).toEqual({ plan: { id: 'p1' } });
  });

  it('defaults status to 200', () => {
    expect(successResponse({ tasks: [] }).status).toBe(200);
  });
});

describe('errorResponse', () => {
  it('body is exactly { error: { code, message } } with given status', async () => {
    const res = errorResponse(ErrorCode.NOT_FOUND, 'nope', 404);
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'nope' },
    });
  });
});
