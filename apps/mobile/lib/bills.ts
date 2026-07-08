// Thin mobile client for the Finance/Bills module (Chat 061). Wraps the /api/v1/bills
// route set through the shared mobile API client (lib/api/client) — it does NOT
// re-implement CRUD and does NOT open a second transport or session path (mirrors
// lib/medications.ts / lib/tasks.ts / lib/calendarEvents.ts).
//
// Field mapping (camelCase request/response <-> snake_case column) is handled by the
// route; this module speaks the route's camelCase contract verbatim:
//   name, amount, dueDayOfMonth <-> due_day_of_month, frequency, category.
//
// user_id is session-derived by the route and NEVER sent.
import { apiClient } from './api/client';

export type BillFrequency = 'monthly' | 'quarterly' | 'annually' | 'one_time';

/** Mirrors the serialized bill (web operations.ts BillResponse). amount is a number
 * (dollars, 2dp) or null; dueDayOfMonth is 1..31 or null. NO createdAt / updatedAt. */
export interface Bill {
  id: string;
  name: string;
  amount: number | null;
  dueDayOfMonth: number | null;
  frequency: BillFrequency;
  category: string | null;
}

interface BillListResponse {
  bills: Bill[];
}

/** Create payload — name/frequency required; amount/dueDayOfMonth/category are
 * OMITTED when not given (the route stores NULL for the nullable columns). */
export interface CreateBillInput {
  name: string;
  frequency: BillFrequency;
  amount?: number | null;
  dueDayOfMonth?: number | null;
  category?: string | null;
}

/** Partial-update payload — every field optional; an explicit `null` clears the
 * (nullable) column. */
export interface UpdateBillInput {
  name?: string;
  frequency?: BillFrequency;
  amount?: number | null;
  dueDayOfMonth?: number | null;
  category?: string | null;
}

/** List the user's bills. The route returns a FIXED server order (due_day ASC NULLS
 * LAST, then name ASC) and exposes no sort/filter param. */
export async function listBills(): Promise<Bill[]> {
  const res = await apiClient.get<BillListResponse>('/bills');
  return res.bills;
}

/** Create one bill. Only provided optional fields are sent so the route/DB store
 * NULL for the rest. */
export async function createBill(input: CreateBillInput): Promise<Bill> {
  const body: Record<string, unknown> = {
    name: input.name,
    frequency: input.frequency,
  };
  if (input.amount !== undefined) body.amount = input.amount;
  if (input.dueDayOfMonth !== undefined) body.dueDayOfMonth = input.dueDayOfMonth;
  if (input.category !== undefined) body.category = input.category;
  return apiClient.post<Bill>('/bills', body);
}

/** Partial-update one bill by id. Only provided keys are sent; a present key
 * (including `amount: null` / `dueDayOfMonth: null` / `category: null`) is forwarded
 * verbatim so the route clears that column. */
export async function updateBill(id: string, patch: UpdateBillInput): Promise<Bill> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.frequency !== undefined) body.frequency = patch.frequency;
  if ('amount' in patch) body.amount = patch.amount;
  if ('dueDayOfMonth' in patch) body.dueDayOfMonth = patch.dueDayOfMonth;
  if ('category' in patch) body.category = patch.category;
  return apiClient.patch<Bill>(`/bills/${id}`, body);
}

/** Hard-delete one bill by id (route returns 204; the client maps it to void). */
export async function deleteBill(id: string): Promise<void> {
  await apiClient.delete<void>(`/bills/${id}`);
}
