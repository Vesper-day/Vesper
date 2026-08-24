import { describe, it, expect } from 'vitest';
import { MODULE_CARDS, isModuleEnabled, type ModuleGate } from './modules';

// Pure catalog + gate helper — no React render, no DOM — so it runs as a plain
// unit test even though the web vitest env is jsdom.

describe('MODULE_CARDS', () => {
  it('lists the landed modules in list order (fitness ADD-C lands after nutrition)', () => {
    expect(MODULE_CARDS.map((c) => c.key)).toEqual([
      'medications',
      'bills',
      'nutrition',
      'fitness',
    ]);
  });

  it('routes every card to a /modules/<name> full page (no dead card)', () => {
    for (const card of MODULE_CARDS) {
      expect(card.route).toBe(`/modules/${card.key}`);
    }
  });

  it('pins the SINGULAR gate keys (medication, finance — not bills; nutrition)', () => {
    const byKey = Object.fromEntries(MODULE_CARDS.map((c) => [c.key, c.gateKey]));
    expect(byKey.medications).toBe('medication');
    expect(byKey.bills).toBe('finance');
    expect(byKey.nutrition).toBe('nutrition');
    expect(byKey.fitness).toBe('fitness');
  });
});

describe('isModuleEnabled', () => {
  const gate = (mods: Record<string, { enabled: boolean }>): ModuleGate => ({
    profile: { modulesEnabled: mods },
  });

  it('reads the enabled flag off the singular key', () => {
    expect(isModuleEnabled(gate({ medication: { enabled: true } }), 'medication')).toBe(true);
    expect(isModuleEnabled(gate({ finance: { enabled: false } }), 'finance')).toBe(false);
    expect(isModuleEnabled(gate({ nutrition: { enabled: true } }), 'nutrition')).toBe(true);
    expect(isModuleEnabled(gate({ fitness: { enabled: true } }), 'fitness')).toBe(true);
  });

  it('reads a missing gate / missing key as off', () => {
    expect(isModuleEnabled(undefined, 'medication')).toBe(false);
    expect(isModuleEnabled(gate({}), 'finance')).toBe(false);
  });
});
