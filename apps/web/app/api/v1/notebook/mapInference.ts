// Row → NotebookInference mapper, shared by the read / confirm / correct ops.
//
// Drizzle's `timestamp` columns deserialize to JS Date; we coerce defensively
// (Date | string) and emit ISO-8601 strings to match the Zod response shape.
import type { NotebookInference } from '@vesper/shared';

export interface NotebookInferenceRow {
  id: string;
  userId: string;
  inferenceText: string;
  inferenceType: string;
  state: 'pending' | 'confirmed' | 'corrected';
  correctedText: string | null;
  surfacedAt: Date | string | null;
  resolvedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const toIsoOrNull = (value: Date | string | null): string | null =>
  value === null ? null : toIso(value);

export function mapInference(row: NotebookInferenceRow): NotebookInference {
  return {
    id: row.id,
    userId: row.userId,
    inferenceText: row.inferenceText,
    inferenceType: row.inferenceType,
    state: row.state,
    correctedText: row.correctedText,
    surfacedAt: toIsoOrNull(row.surfacedAt),
    resolvedAt: toIsoOrNull(row.resolvedAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}
