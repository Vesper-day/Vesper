// Thin mobile client for the Medications module (Chat 060). Wraps the EXISTING
// /api/v1/medications route set through the shared mobile API client
// (lib/api/client) — it does NOT re-implement CRUD and does NOT open a second
// transport or session path (mirrors lib/tasks.ts / lib/calendarEvents.ts).
//
// Field mapping (camelCase request/response <-> snake_case column) is handled by the
// route; this module speaks the route's camelCase contract verbatim:
//   name, dose, frequency, times, startDate <-> start_date, endDate <-> end_date,
//   notes, shiftOutOfQuietHours <-> shift_out_of_quiet_hours.
//
// user_id is session-derived by the route and NEVER sent.
import { apiClient } from './api/client';

export type MedicationFrequency = 'daily' | 'twice_daily' | 'weekly' | 'custom';

/** Mirrors the serialized medication (web operations.ts MedicationResponse). times
 * is a "HH:MM[:SS]" string[]; startDate/endDate are "YYYY-MM-DD" (endDate null when
 * open-ended). NO createdAt / updatedAt. */
export interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: MedicationFrequency;
  times: string[];
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
  notes: string | null;
  shiftOutOfQuietHours: boolean;
}

interface MedicationListResponse {
  medications: Medication[];
}

/** Create payload — name/dose/frequency/startDate required; times defaults []; the
 * remaining fields OMITTED when not given (the route fills DB defaults). */
export interface CreateMedicationInput {
  name: string;
  dose: string;
  frequency: MedicationFrequency;
  times?: string[];
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD, or null for open-ended
  notes?: string;
  shiftOutOfQuietHours?: boolean;
}

/** Partial-update payload — every field optional; `endDate: null` clears it. */
export interface UpdateMedicationInput {
  name?: string;
  dose?: string;
  frequency?: MedicationFrequency;
  times?: string[];
  startDate?: string;
  endDate?: string | null;
  notes?: string | null;
  shiftOutOfQuietHours?: boolean;
}

/** List the user's medications. The route returns a FIXED server order (name ASC,
 * then start_date ASC) and exposes no sort/filter param. */
export async function listMedications(): Promise<Medication[]> {
  const res = await apiClient.get<MedicationListResponse>('/medications');
  return res.medications;
}

/** Create one medication. Only provided optional fields are sent so the route/DB
 * defaults apply for the rest. */
export async function createMedication(input: CreateMedicationInput): Promise<Medication> {
  const body: Record<string, unknown> = {
    name: input.name,
    dose: input.dose,
    frequency: input.frequency,
    startDate: input.startDate,
  };
  if (input.times !== undefined) body.times = input.times;
  if (input.endDate !== undefined) body.endDate = input.endDate;
  if (input.notes !== undefined) body.notes = input.notes;
  if (input.shiftOutOfQuietHours !== undefined) {
    body.shiftOutOfQuietHours = input.shiftOutOfQuietHours;
  }
  return apiClient.post<Medication>('/medications', body);
}

/** Partial-update one medication by id. Only provided fields are sent; a present
 * key (including `endDate: null` / `notes: null`) is forwarded verbatim. */
export async function updateMedication(
  id: string,
  patch: UpdateMedicationInput,
): Promise<Medication> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.dose !== undefined) body.dose = patch.dose;
  if (patch.frequency !== undefined) body.frequency = patch.frequency;
  if (patch.times !== undefined) body.times = patch.times;
  if (patch.startDate !== undefined) body.startDate = patch.startDate;
  if ('endDate' in patch) body.endDate = patch.endDate;
  if ('notes' in patch) body.notes = patch.notes;
  if (patch.shiftOutOfQuietHours !== undefined) {
    body.shiftOutOfQuietHours = patch.shiftOutOfQuietHours;
  }
  return apiClient.patch<Medication>(`/medications/${id}`, body);
}

/** Hard-delete one medication by id (route returns 204; the client maps it to void). */
export async function deleteMedication(id: string): Promise<void> {
  await apiClient.delete<void>(`/medications/${id}`);
}
