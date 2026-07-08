// @vitest-environment node
//
// Unit tests for the mobile bills client (bills.ts) — the Chat 061 Finance module.
// The module imports only ./api/client, which transitively pulls supabase +
// expo-router + react-native (native at import), so under the node test env we mock
// ./api/client wholesale (medications.test.ts / tasks.test.ts precedent). No real
// transport runs.
//
// Coverage: each CRUD call hits the right method + path; create sends only the
// provided optional fields; update forwards present keys verbatim (incl.
// amount:null / dueDayOfMonth:null / category:null) and omits absent keys; the
// camelCase <-> snake_case contract (dueDayOfMonth) is passed through as-is.
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
  listBills,
  createBill,
  updateBill,
  deleteBill,
  type Bill,
} from './bills';

const getMock = vi.mocked(apiClient.get);
const postMock = vi.mocked(apiClient.post);
const patchMock = vi.mocked(apiClient.patch);
const deleteMock = vi.mocked(apiClient.delete);

const SAMPLE: Bill = {
  id: 'b1',
  name: 'Rent',
  amount: 1200,
  dueDayOfMonth: 1,
  frequency: 'monthly',
  category: 'Housing',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listBills', () => {
  it('GETs /bills and returns the array', async () => {
    getMock.mockResolvedValue({ bills: [SAMPLE] });
    const out = await listBills();
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/bills');
    expect(out).toEqual([SAMPLE]);
  });
});

describe('createBill', () => {
  it('POSTs only the required fields when nothing optional is given', async () => {
    postMock.mockResolvedValue(SAMPLE);
    await createBill({ name: 'Rent', frequency: 'monthly' });
    expect(postMock).toHaveBeenCalledTimes(1);
    const [path, body] = postMock.mock.calls[0]!;
    expect(path).toBe('/bills');
    expect(body).toEqual({ name: 'Rent', frequency: 'monthly' });
    expect(body).not.toHaveProperty('amount');
    expect(body).not.toHaveProperty('dueDayOfMonth');
    expect(body).not.toHaveProperty('category');
  });

  it('includes amount, dueDayOfMonth, and category when provided', async () => {
    postMock.mockResolvedValue(SAMPLE);
    await createBill({
      name: 'Internet',
      frequency: 'monthly',
      amount: 59.99,
      dueDayOfMonth: 15,
      category: 'Utilities',
    });
    expect(postMock.mock.calls[0]![1]).toEqual({
      name: 'Internet',
      frequency: 'monthly',
      amount: 59.99,
      dueDayOfMonth: 15,
      category: 'Utilities',
    });
  });
});

describe('updateBill', () => {
  it('PATCHes /bills/:id with only the provided fields', async () => {
    patchMock.mockResolvedValue({ ...SAMPLE, amount: 1300 });
    await updateBill('b1', { amount: 1300, frequency: 'quarterly' });
    expect(patchMock).toHaveBeenCalledTimes(1);
    const [path, body] = patchMock.mock.calls[0]!;
    expect(path).toBe('/bills/b1');
    expect(body).toEqual({ amount: 1300, frequency: 'quarterly' });
  });

  it('forwards amount:null / dueDayOfMonth:null / category:null (explicit key clears the column)', async () => {
    patchMock.mockResolvedValue(SAMPLE);
    await updateBill('b1', { amount: null, dueDayOfMonth: null, category: null });
    expect(patchMock.mock.calls[0]![1]).toEqual({
      amount: null,
      dueDayOfMonth: null,
      category: null,
    });
  });

  it('omits amount/dueDayOfMonth/category entirely when the key is absent', async () => {
    patchMock.mockResolvedValue(SAMPLE);
    await updateBill('b1', { name: 'Renamed' });
    const body = patchMock.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).toEqual({ name: 'Renamed' });
    expect(body).not.toHaveProperty('amount');
    expect(body).not.toHaveProperty('dueDayOfMonth');
    expect(body).not.toHaveProperty('category');
  });
});

describe('deleteBill', () => {
  it('DELETEs /bills/:id', async () => {
    deleteMock.mockResolvedValue(undefined as never);
    await deleteBill('b1');
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith('/bills/b1');
  });
});
