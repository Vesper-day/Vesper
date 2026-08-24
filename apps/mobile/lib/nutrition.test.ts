import { describe, it, expect } from 'vitest';
import { foodLogEntryLabel, foodSearchResultLabel } from './nutrition';

// Pure helpers — no react-native, no expo-router, no api client imported, so this runs
// clean in the node vitest env (no RN mock needed).

describe('foodLogEntryLabel', () => {
  it('appends the portion note when present', () => {
    expect(
      foodLogEntryLabel({ itemName: 'Porridge', quantityNote: '1 bowl' }),
    ).toBe('Porridge, 1 bowl');
  });

  it('returns just the item name when the note is null or blank', () => {
    expect(foodLogEntryLabel({ itemName: 'Apple', quantityNote: null })).toBe('Apple');
    expect(foodLogEntryLabel({ itemName: 'Apple', quantityNote: '   ' })).toBe('Apple');
  });
});

describe('foodSearchResultLabel', () => {
  it('renders "<name>, <total> min"', () => {
    expect(foodSearchResultLabel({ name: 'Chili', totalMinutes: 45 })).toBe('Chili, 45 min');
  });
});
