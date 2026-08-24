// GET /api/v1/nutrition/food-search?q=<term>&limit=<n> — name-substring search over the
// recipe_templates corpus (200).
//
// Fixed 200, so it uses createRoute (auth + version-gate + §9 error mapping). The query
// params are read from the request URL and validated by the boundary Zod in
// ../operations (an empty `q` -> 400). NO external food-nutrient database is queried
// (DEFERRED per PRD §6.3). Core logic lives in the sibling ../operations module.
import { createRoute } from '@vesper/shared';
import { createDrizzleClient } from '@vesper/db';
import type { FoodSearchResponse } from '@vesper/shared/nutrition';
import { searchFoodCorpus } from '../operations';

export const GET = createRoute<FoodSearchResponse>(async ({ request }) => {
  const params = new URL(request.url).searchParams;
  const query: Record<string, string> = {};
  const q = params.get('q');
  if (q !== null) query.q = q;
  const limit = params.get('limit');
  if (limit !== null) query.limit = limit;
  return searchFoodCorpus(createDrizzleClient(), query);
});
