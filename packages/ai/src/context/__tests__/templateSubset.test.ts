import { describe, expect, it } from 'vitest';
import type { ModulesEnabled } from '@vesper/db';
import { buildTemplateSubset } from '../templateSubset';

const modulesEnabled: ModulesEnabled = {
  work: { enabled: true },
  fitness: { enabled: true, equipment: [] },
  nutrition: { enabled: true, dietTags: [], dislikes: [] },
  sleep: { enabled: true },
  errands: { enabled: false },
  medication: { enabled: false },
  finance: { enabled: false },
};

describe('buildTemplateSubset (stub)', () => {
  it('returns empty workout and recipe lists without querying the DB', async () => {
    const subset = await buildTemplateSubset(modulesEnabled);
    expect(subset).toEqual({ workouts: [], recipes: [] });
  });
});
