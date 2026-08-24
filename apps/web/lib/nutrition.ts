// Pure, client-safe helpers for the web nutrition surface (Chat ADD-B).
//
// No React, no DOM, no @vesper/shared barrel — just formatting/label logic the page
// composes, so it is unit-testable as a plain module (mirrors lib/modules.ts). Response
// TYPES come from the client-safe @vesper/shared/nutrition subpath (never the bare
// barrel, which pulls @vesper/db -> postgres into the client bundle).
import type { FoodLogEntry, FoodSearchResult } from '@vesper/shared/nutrition';

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
