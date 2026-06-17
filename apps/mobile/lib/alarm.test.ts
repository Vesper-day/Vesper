import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the native + transport seams so the module loads under the node test env
// (vitest.config.ts environment: 'node'). expo-notifications and react-native
// would otherwise touch native modules at import; ./api/client pulls supabase /
// expo-router; ./analytics is spied to assert taxonomy emission.
vi.mock('react-native', () => ({
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
  NativeModules: {},
}));

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: vi.fn(async () => 'notif-id-1'),
  cancelScheduledNotificationAsync: vi.fn(async () => undefined),
  setNotificationCategoryAsync: vi.fn(async () => ({})),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

vi.mock('./api/client', () => ({ apiClient: { get: vi.fn() } }));
vi.mock('./analytics', () => ({ track: vi.fn() }));

import * as Notifications from 'expo-notifications';
import { apiClient } from './api/client';
import { track } from './analytics';
import {
  nextOccurrence,
  scheduleAlarm,
  handleAlarmResponse,
  SNOOZE_MINUTES,
  SNOOZE_ACTION_ID,
  STOP_ACTION_ID,
} from './alarm';

const apiGet = vi.mocked(apiClient.get);
const trackMock = vi.mocked(track);
const scheduleMock = vi.mocked(Notifications.scheduleNotificationAsync);
const cancelMock = vi.mocked(Notifications.cancelScheduledNotificationAsync);

beforeEach(() => {
  vi.clearAllMocks();
  scheduleMock.mockResolvedValue('notif-id-1');
});

describe('nextOccurrence', () => {
  it('returns the same-day time when it is still ahead', () => {
    const now = new Date(2026, 5, 16, 5, 0, 0);
    const next = nextOccurrence('07:00', now);
    expect(next).not.toBeNull();
    expect(next?.getHours()).toBe(7);
    expect(next?.getMinutes()).toBe(0);
    expect(next?.getDate()).toBe(16);
  });

  it('rolls to tomorrow when the time has already passed today', () => {
    const now = new Date(2026, 5, 16, 8, 0, 0);
    const next = nextOccurrence('07:00', now);
    expect(next?.getDate()).toBe(17);
    expect(next?.getHours()).toBe(7);
  });

  it('rejects malformed or out-of-range times', () => {
    const now = new Date(2026, 5, 16, 5, 0, 0);
    expect(nextOccurrence('7:00', now)).toBeNull();
    expect(nextOccurrence('25:00', now)).toBeNull();
    expect(nextOccurrence('07:60', now)).toBeNull();
    expect(nextOccurrence('garbage', now)).toBeNull();
  });
});

describe('scheduleAlarm', () => {
  it('schedules and emits alarm_scheduled with snooze_minutes = 9', async () => {
    apiGet.mockResolvedValue({ profile: { baseProfile: { wakeTarget: '07:00' } } });
    const now = new Date(2026, 5, 16, 5, 0, 0);

    const id = await scheduleAlarm(now);

    expect(id).toBe('notif-id-1');
    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(
      'alarm_scheduled',
      expect.objectContaining({
        wake_target_local: '07:00',
        snooze_minutes: SNOOZE_MINUTES,
      }),
    );
    expect(SNOOZE_MINUTES).toBe(9);
  });

  it('no-ops (no schedule, no event) when the profile fetch throws', async () => {
    // Not-yet-onboarded user: '{}' base_profile fails BaseProfileSchema parse.
    apiGet.mockRejectedValue(new Error('parse error'));

    const id = await scheduleAlarm(new Date(2026, 5, 16, 5, 0, 0));

    expect(id).toBeNull();
    expect(scheduleMock).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalled();
  });

  it('no-ops when wakeTarget is absent', async () => {
    apiGet.mockResolvedValue({ profile: { baseProfile: { wakeTarget: undefined } } });

    const id = await scheduleAlarm(new Date(2026, 5, 16, 5, 0, 0));

    expect(id).toBeNull();
    expect(scheduleMock).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe('handleAlarmResponse', () => {
  it('SNOOZE re-arms the alarm and emits alarm_dismissed{action:snooze}', async () => {
    const response = {
      actionIdentifier: SNOOZE_ACTION_ID,
      notification: { request: { identifier: 'notif-id-1' } },
    } as unknown as Notifications.NotificationResponse;

    await handleAlarmResponse(response);

    expect(scheduleMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(
      'alarm_dismissed',
      expect.objectContaining({ action: 'snooze' }),
    );
  });

  it('STOP cancels the notification and emits alarm_dismissed{action:stop}', async () => {
    const response = {
      actionIdentifier: STOP_ACTION_ID,
      notification: { request: { identifier: 'notif-id-1' } },
    } as unknown as Notifications.NotificationResponse;

    await handleAlarmResponse(response);

    expect(cancelMock).toHaveBeenCalledWith('notif-id-1');
    expect(trackMock).toHaveBeenCalledWith(
      'alarm_dismissed',
      expect.objectContaining({ action: 'stop' }),
    );
  });
});
