// Pure helpers + local types for the mobile nutrition surface (Chat ADD-B).
//
// This file imports NO react-native, NO expo-router, and NO api client, so it is
// unit-testable in the node vitest env (mirrors lib/modules.ts). The nutrition screen
// does its fetches through the shared apiClient directly; this module holds only the
// wire TYPES and the label helpers the screen composes.
//
// TYPES are declared LOCALLY here (not imported from @vesper/shared) per the mobile
// moduleResolution:node limitation on the package root — the same local-slice pattern
// lib/medications.ts uses. They mirror the web @vesper/shared/nutrition contract 1:1.

/** Mirrors the serialized food-log entry (web operations serializeFoodLogEntry). */
export interface FoodLogEntry {
  id: string;
  loggedAt: string;
  itemName: string;
  recipeTemplateId: string | null;
  quantityNote: string | null;
}

/** Mirrors one food-search result (web FoodSearchResult). */
export interface FoodSearchResult {
  id: string;
  name: string;
  dietTags: string[];
  totalMinutes: number;
}

/**
 * One food-log row's label: the item name, plus the portion note when present.
 *
 * `foodLogEntryLabel({ itemName: 'Porridge', quantityNote: '1 bowl' })`
 *   -> `"Porridge, 1 bowl"`
 */
export function foodLogEntryLabel(
  entry: Pick<FoodLogEntry, 'itemName' | 'quantityNote'>,
): string {
  const note = entry.quantityNote?.trim();
  return note ? `${entry.itemName}, ${note}` : entry.itemName;
}

/**
 * One food-search result's label: the recipe name and its total time.
 *
 * `foodSearchResultLabel({ name: 'Chili', totalMinutes: 45 })` -> `"Chili, 45 min"`
 */
export function foodSearchResultLabel(
  result: Pick<FoodSearchResult, 'name' | 'totalMinutes'>,
): string {
  return `${result.name}, ${result.totalMinutes} min`;
}
