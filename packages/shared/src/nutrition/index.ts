// Nutrition module boundary shapes (Chat ADD-B) — client-safe.
//
// LOCATION RATIONALE: this lives at the client-safe subpath `@vesper/shared/nutrition`
// (never the bare `@vesper/shared` barrel, which transitively pulls @vesper/db ->
// postgres and would drag server-only code into a client bundle). It is PURE Zod +
// TypeScript types — zero imports beyond zod, no server code — so the 'use client'
// web nutrition surface and the web API route both import from here. (Mobile types the
// slice locally per the moduleResolution:node exports-map limitation — see
// apps/mobile/lib/nutrition.ts.)
//
// FIELD MAPPING at the API boundary (camelCase request/response <-> snake_case column):
//   itemName          <-> item_name
//   recipeTemplateId  <-> recipe_template_id
//   quantityNote      <-> quantity_note
//   loggedAt          <-> logged_at
//
// SCOPE (PRD §6.3, method B): the food-log is a scaffold. DEEP nutrition fields
// (micronutrient / vitamin / RDA / calorie) are DEFERRED and are NOT modelled here.

import { z } from 'zod';

// --- Food log: POST request --------------------------------------------------
//
// itemName is REQUIRED (the NOT-NULL column with no default; user_id, the other
// NOT-NULL-no-default column, is supplied by the route from the session and is NEVER
// in the body). recipeTemplateId is set when the item was chosen from the food-search
// corpus; NULL/omitted for free-text. quantityNote is an optional, unstructured
// portion note. loggedAt is optional (DB defaults to now()).
export const PostFoodLogSchema = z
  .object({
    itemName: z.string().trim().min(1),
    recipeTemplateId: z.string().uuid().nullable().optional(),
    quantityNote: z.string().trim().min(1).nullable().optional(),
    loggedAt: z.string().datetime().optional(),
  })
  .strict();

export type PostFoodLogInput = z.infer<typeof PostFoodLogSchema>;

// --- Food log: response ------------------------------------------------------
//
// loggedAt / createdAt are ISO-8601 strings (timestamptz serialized). recipeTemplateId
// and quantityNote are null when absent.
export interface FoodLogEntry {
  id: string;
  loggedAt: string;
  itemName: string;
  recipeTemplateId: string | null;
  quantityNote: string | null;
}

export interface FoodLogListResponse {
  entries: FoodLogEntry[];
}

// --- Food search over the recipe corpus -------------------------------------
//
// A name-substring search over recipe_templates (the existing corpus; NO external
// food-nutrient database — DEFERRED per PRD §6.3). Results carry only the fields the
// food-search surface renders + the id the food-log POST links via recipeTemplateId.
export const FoodSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

export type FoodSearchQuery = z.infer<typeof FoodSearchQuerySchema>;

export interface FoodSearchResult {
  id: string;
  name: string;
  dietTags: string[];
  totalMinutes: number;
}

export interface FoodSearchResponse {
  results: FoodSearchResult[];
}

// --- AI recipe-modify --------------------------------------------------------
//
// Reuses the existing AI command infrastructure (a new versioned prompt + applier in
// @vesper/ai; NO new Anthropic model row). The Anthropic call is voice-gated; the
// modified text is user-visible butler copy. `request` is the modification the user
// asks for ("make it vegetarian", "halve the portions").
export const RecipeModifyRequestSchema = z
  .object({
    recipeName: z.string().trim().min(1),
    instructions: z.string().trim().min(1).optional(),
    request: z.string().trim().min(1),
  })
  .strict();

export type RecipeModifyRequest = z.infer<typeof RecipeModifyRequestSchema>;

export interface RecipeModifyResponse {
  modifiedRecipe: string;
}
