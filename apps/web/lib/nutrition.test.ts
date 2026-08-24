import { describe, it, expect } from 'vitest';
import { foodLogEntryLabel, foodSearchResultLabel } from './nutrition';

// Pure helpers — no React render, no DOM — so they run as a plain unit test even
// though the web vitest env is jsdom.

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
