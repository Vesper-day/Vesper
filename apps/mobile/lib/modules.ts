// Module catalog for the Modules tab (ADD-A). Pure data + a gate-status helper —
// this file imports NO react-native and NO expo-router, so it is unit-testable in
// the node vitest env. The Modules index screen composes its rounded cards from
// MODULE_CARDS; the Settings entry is pinned separately at the bottom of the list
// (it is not a module and is not in this catalog).
//
// Gate keys are SINGULAR and live: medications gate on modulesEnabled.medication,
// bills (the Finance module) gate on modulesEnabled.finance (key `finance`, NOT
// `bills`). See docs/MODULE_MOUNT_CONTRACT.md.

export type ModuleGateKey = 'medication' | 'finance' | 'nutrition';

export interface ModuleCard {
  /** Stable id / route slug. */
  key: 'medications' | 'bills' | 'nutrition';
  title: string;
  subtitle: string;
  /** Absolute expo-router path to the module's full page. */
  route: string;
  /** Profile gate key (singular) this module reads. */
  gateKey: ModuleGateKey;
}

// The modules that have a landed full page, in list order. Nutrition (ADD-B) is the
// first GENERATIVE module to land — a method-B functional-breadth scaffold page (PRD
// §6.3). The remaining generative modules (fitness/sleep) and errands (062) join this
// list when their pages land — intentionally absent now so no card routes to a page
// that does not exist.
export const MODULE_CARDS: readonly ModuleCard[] = [
  {
    key: 'medications',
    title: 'Medications',
    subtitle: 'Doses and reminders',
    route: '/modules/medications',
    gateKey: 'medication',
  },
  {
    key: 'bills',
    title: 'Bills',
    subtitle: 'Due days and reminders',
    route: '/modules/bills',
    gateKey: 'finance',
  },
  {
    key: 'nutrition',
    title: 'Nutrition',
    subtitle: 'Food log and recipes',
    route: '/modules/nutrition',
    gateKey: 'nutrition',
  },
];

export interface ModuleGate {
  profile: { modulesEnabled: Record<string, { enabled: boolean } | undefined> };
}

// Reads a module's live enabled flag from the profile gate. A missing or still-
// loading gate reads as off; the module page self-gates either way.
export function isModuleEnabled(
  gate: ModuleGate | undefined,
  key: ModuleGateKey,
): boolean {
  return gate?.profile.modulesEnabled?.[key]?.enabled ?? false;
}
