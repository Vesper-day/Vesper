import { describe, it, expect } from 'vitest';
import { MODULE_CARDS, isModuleEnabled, type ModuleGate } from './modules';

// Pure catalog + gate helper — no react-native, no expo-router imported, so this
// runs clean in the node vitest env.

describe('MODULE_CARDS', () => {
  it('lists the landed reminder-list modules in list order', () => {
    expect(MODULE_CARDS.map((c) => c.key)).toEqual(['medications', 'bills']);
  });

  it('routes every card to a /modules/<name> full page (no dead card)', () => {
    for (const card of MODULE_CARDS) {
      expect(card.route).toBe(`/modules/${card.key}`);
    }
  });

  it('pins the SINGULAR gate keys (medication, finance — not bills)', () => {
    const byKey = Object.fromEntries(MODULE_CARDS.map((c) => [c.key, c.gateKey]));
    expect(byKey.medications).toBe('medication');
    expect(byKey.bills).toBe('finance');
  });
});

describe('isModuleEnabled', () => {
  const gate = (mods: Record<string, { enabled: boolean }>): ModuleGate => ({
    profile: { modulesEnabled: mods },
  });

  it('reads the enabled flag off the singular key', () => {
    expect(isModuleEnabled(gate({ medication: { enabled: true } }), 'medication')).toBe(true);
    expect(isModuleEnabled(gate({ finance: { enabled: false } }), 'finance')).toBe(false);
  });

  it('reads a missing gate / missing key as off', () => {
    expect(isModuleEnabled(undefined, 'medication')).toBe(false);
    expect(isModuleEnabled(gate({}), 'finance')).toBe(false);
  });
});
