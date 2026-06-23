// @vitest-environment node
//
// Unit tests for the mobile calendar-events client (calendarEvents.ts). The module
// imports only ./api/client, which transitively pulls supabase + expo-router +
// react-native (native at import), so under the node test env we mock ./api/client
// wholesale (pushTokens.test.ts precedent). No real transport is touched.
//
// Coverage: CRUD calls hit the right route + method; the camelCase<->contract write
// body is exact (only the four series fields — instance-shaped extras are dropped so
// an expanded instance is never written back); the inverted-range guard rejects
// before any network call; the list maps server-expanded instances (incl. the
// recurring flag) straight through. There is NO client-side RRULE expander to test:
// recurrence is expanded SERVER-SIDE (see calendarEvents.ts header) and this client
// consumes already-expanded instances.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from './api/client';
import {
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  InvertedRangeError,
  type CalendarEventInstance,
} from './calendarEvents';

const getMock = vi.mocked(apiClient.get);
const postMock = vi.mocked(apiClient.post);
const patchMock = vi.mocked(apiClient.patch);
const deleteMock = vi.mocked(apiClient.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listCalendarEvents', () => {
  it('GETs the window-scoped route with both bounds URL-encoded and returns instances', async () => {
    const instances: CalendarEventInstance[] = [
      {
        id: 'one-off',
        title: 'Dentist',
        startTime: '2026-06-10T14:00:00.000Z',
        endTime: '2026-06-10T15:00:00.000Z',
        rrule: null,
        recurring: false,
      },
      // Two expanded instances of one weekly series — they share the series id and
      // carry the series rrule (already expanded by the server).
      {
        id: 'series-1',
        title: 'Standup',
        startTime: '2026-06-08T09:00:00.000Z',
        endTime: '2026-06-08T09:15:00.000Z',
        rrule: 'FREQ=WEEKLY;BYDAY=MO,WE',
        recurring: true,
      },
      {
        id: 'series-1',
        title: 'Standup',
        startTime: '2026-06-10T09:00:00.000Z',
        endTime: '2026-06-10T09:15:00.000Z',
        rrule: 'FREQ=WEEKLY;BYDAY=MO,WE',
        recurring: true,
      },
    ];
    getMock.mockResolvedValue({ events: instances });

    const out = await listCalendarEvents({
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-30T00:00:00.000Z',
    });

    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith(
      '/calendar-events?start=2026-06-01T00%3A00%3A00.000Z&end=2026-06-30T00%3A00%3A00.000Z',
    );
    expect(out).toHaveLength(3);
    // Both expanded instances of the series surface, sharing the series id + rrule.
    const recurring = out.filter((e) => e.recurring);
    expect(recurring).toHaveLength(2);
    expect(new Set(recurring.map((e) => e.id))).toEqual(new Set(['series-1']));
    expect(recurring.every((e) => e.rrule === 'FREQ=WEEKLY;BYDAY=MO,WE')).toBe(true);
  });
});

describe('createCalendarEvent', () => {
  it('POSTs exactly the four series fields and returns the stored series row', async () => {
    postMock.mockResolvedValue({
      event: {
        id: 'new-id',
        title: 'Gym',
        startTime: '2026-06-12T07:00:00.000Z',
        endTime: '2026-06-12T08:00:00.000Z',
        rrule: 'FREQ=DAILY',
      },
    });

    const series = await createCalendarEvent({
      title: 'Gym',
      startTime: '2026-06-12T07:00:00.000Z',
      endTime: '2026-06-12T08:00:00.000Z',
      rrule: 'FREQ=DAILY',
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    const [path, body] = postMock.mock.calls[0]!;
    expect(path).toBe('/calendar-events');
    expect(body).toEqual({
      title: 'Gym',
      startTime: '2026-06-12T07:00:00.000Z',
      endTime: '2026-06-12T08:00:00.000Z',
      rrule: 'FREQ=DAILY',
    });
    expect(series.id).toBe('new-id');
  });

  it('defaults an omitted rrule to null (one-off)', async () => {
    postMock.mockResolvedValue({
      event: {
        id: 'x',
        title: 'Lunch',
        startTime: '2026-06-12T12:00:00.000Z',
        endTime: '2026-06-12T13:00:00.000Z',
        rrule: null,
      },
    });

    await createCalendarEvent({
      title: 'Lunch',
      startTime: '2026-06-12T12:00:00.000Z',
      endTime: '2026-06-12T13:00:00.000Z',
    });

    expect(postMock.mock.calls[0]![1]).toMatchObject({ rrule: null });
  });

  it('rejects an inverted range (end <= start) BEFORE any network call', async () => {
    await expect(
      createCalendarEvent({
        title: 'Backwards',
        startTime: '2026-06-12T10:00:00.000Z',
        endTime: '2026-06-12T09:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(InvertedRangeError);
    // Equal bounds are also inverted (strict >).
    await expect(
      createCalendarEvent({
        title: 'Zero-length',
        startTime: '2026-06-12T10:00:00.000Z',
        endTime: '2026-06-12T10:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(InvertedRangeError);
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe('updateCalendarEvent', () => {
  it('PATCHes the SERIES id with the whole-series body (no per-instance fields leak)', async () => {
    patchMock.mockResolvedValue({
      event: {
        id: 'series-1',
        title: 'Standup (moved)',
        startTime: '2026-06-08T09:30:00.000Z',
        endTime: '2026-06-08T09:45:00.000Z',
        rrule: 'FREQ=WEEKLY;BYDAY=MO,WE',
      },
    });

    // Caller hands in an instance-shaped object (id + recurring present). Those must
    // NOT reach the wire — only the series fields are written, so a recurring series
    // is edited as a whole and an expanded instance is never sent back.
    const instanceShaped = {
      id: 'series-1',
      recurring: true,
      title: 'Standup (moved)',
      startTime: '2026-06-08T09:30:00.000Z',
      endTime: '2026-06-08T09:45:00.000Z',
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE',
    } as unknown as Parameters<typeof updateCalendarEvent>[1];

    await updateCalendarEvent('series-1', instanceShaped);

    expect(patchMock).toHaveBeenCalledTimes(1);
    const [path, body] = patchMock.mock.calls[0]!;
    expect(path).toBe('/calendar-events/series-1');
    expect(body).toEqual({
      title: 'Standup (moved)',
      startTime: '2026-06-08T09:30:00.000Z',
      endTime: '2026-06-08T09:45:00.000Z',
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE',
    });
    // Hard assertion: instance-only keys never crossed the boundary.
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('recurring');
  });

  it('rejects an inverted range before the network call', async () => {
    await expect(
      updateCalendarEvent('series-1', {
        title: 'Bad',
        startTime: '2026-06-08T10:00:00.000Z',
        endTime: '2026-06-08T09:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(InvertedRangeError);
    expect(patchMock).not.toHaveBeenCalled();
  });
});

describe('deleteCalendarEvent', () => {
  it('DELETEs the series-scoped route by id', async () => {
    deleteMock.mockResolvedValue(undefined as never);
    await deleteCalendarEvent('series-1');
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith('/calendar-events/series-1');
  });
});
