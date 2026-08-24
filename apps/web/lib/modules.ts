// Module catalog for the web Modules surface (ADD-A). Pure data + a gate-status
// helper — no React, no DOM, no @vesper/shared barrel — so it is unit-testable as
// a plain module. The /modules list page composes its rounded cards from
// MODULE_CARDS; the Settings entry is pinned separately at the bottom of the list
// (it is not a module and is not in this catalog).
//
// Gate keys are SINGULAR and live: medications gate on modulesEnabled.medication,
// bills (the Finance module) gate on modulesEnabled.finance (key `finance`, NOT
// `bills`). See docs/MODULE_MOUNT_CONTRACT.md.

export type ModuleGateKey = 'medication' | 'finance';

export interface ModuleCard {
  /** Stable id / route slug. */
  key: 'medications' | 'bills';
  title: string;
  subtitle: string;
  /** Absolute Next.js route to the module's full page. */
  route: string;
  /** Profile gate key (singular) this module reads. */
  gateKey: ModuleGateKey;
}

// The reminder-list modules that have a landed full page (ADD-A), in list order.
// Generative modules (fitness/nutrition/sleep) and errands (062) join this list
// when their pages land — they are intentionally absent now so no card routes to
// a page that does not exist.
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
