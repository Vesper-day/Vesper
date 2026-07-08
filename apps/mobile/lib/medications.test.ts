// @vitest-environment node
//
// Unit tests for the mobile medications client (medications.ts). The module imports
// only ./api/client, which transitively pulls supabase + expo-router + react-native
// (native at import), so under the node test env we mock ./api/client wholesale
// (tasks.test.ts / calendarEvents.test.ts precedent). No real transport runs.
//
// Coverage: each CRUD call hits the right method + path; create sends only the
// provided optional fields; update forwards present keys verbatim (incl. endDate:null
// / notes:null) and omits absent keys; the camelCase contract is passed through as-is.
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
  listMedications,
  createMedication,
  updateMedication,
  deleteMedication,
  type Medication,
} from './medications';

const getMock = vi.mocked(apiClient.get);
const postMock = vi.mocked(apiClient.post);
const patchMock = vi.mocked(apiClient.patch);
const deleteMock = vi.mocked(apiClient.delete);

const SAMPLE: Medication = {
  id: 'm1',
  name: 'Metformin',
  dose: '500mg',
  frequency: 'twice_daily',
  times: ['08:00:00', '20:00:00'],
  startDate: '2026-07-01',
  endDate: null,
  notes: null,
  shiftOutOfQuietHours: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listMedications', () => {
  it('GETs /medications and returns the array', async () => {
    getMock.mockResolvedValue({ medications: [SAMPLE] });
    const out = await listMedications();
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/medications');
    expect(out).toEqual([SAMPLE]);
  });
});

describe('createMedication', () => {
  it('POSTs only the required fields when nothing optional is given', async () => {
    postMock.mockResolvedValue(SAMPLE);
    await createMedication({
      name: 'Vitamin D',
      dose: '1000IU',
      frequency: 'daily',
      startDate: '2026-07-01',
    });
    expect(postMock).toHaveBeenCalledTimes(1);
    const [path, body] = postMock.mock.calls[0]!;
    expect(path).toBe('/medications');
    expect(body).toEqual({
      name: 'Vitamin D',
      dose: '1000IU',
      frequency: 'daily',
      startDate: '2026-07-01',
    });
    expect(body).not.toHaveProperty('times');
    expect(body).not.toHaveProperty('endDate');
    expect(body).not.toHaveProperty('shiftOutOfQuietHours');
  });

  it('includes times, endDate, notes, and shift flag when provided', async () => {
    postMock.mockResolvedValue(SAMPLE);
    await createMedication({
      name: 'Metformin',
      dose: '500mg',
      frequency: 'twice_daily',
      times: ['08:00', '20:00'],
      startDate: '2026-07-01',
      endDate: '2026-12-31',
      notes: 'with food',
      shiftOutOfQuietHours: true,
    });
    expect(postMock.mock.calls[0]![1]).toEqual({
      name: 'Metformin',
      dose: '500mg',
      frequency: 'twice_daily',
      times: ['08:00', '20:00'],
      startDate: '2026-07-01',
      endDate: '2026-12-31',
      notes: 'with food',
      shiftOutOfQuietHours: true,
    });
  });
});

describe('updateMedication', () => {
  it('PATCHes /medications/:id with only the provided fields', async () => {
    patchMock.mockResolvedValue({ ...SAMPLE, dose: '1000mg' });
    await updateMedication('m1', { dose: '1000mg', shiftOutOfQuietHours: true });
    expect(patchMock).toHaveBeenCalledTimes(1);
    const [path, body] = patchMock.mock.calls[0]!;
    expect(path).toBe('/medications/m1');
    expect(body).toEqual({ dose: '1000mg', shiftOutOfQuietHours: true });
  });

  it('forwards endDate:null and notes:null (explicit key clears the column)', async () => {
    patchMock.mockResolvedValue(SAMPLE);
    await updateMedication('m1', { endDate: null, notes: null });
    expect(patchMock.mock.calls[0]![1]).toEqual({ endDate: null, notes: null });
  });

  it('omits endDate/notes entirely when the key is absent', async () => {
    patchMock.mockResolvedValue(SAMPLE);
    await updateMedication('m1', { name: 'Renamed' });
    const body = patchMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).toEqual({ name: 'Renamed' });
    expect(body).not.toHaveProperty('endDate');
    expect(body).not.toHaveProperty('notes');
  });
});

describe('deleteMedication', () => {
  it('DELETEs /medications/:id', async () => {
    deleteMock.mockResolvedValue(undefined as never);
    await deleteMedication('m1');
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith('/medications/m1');
  });
});
