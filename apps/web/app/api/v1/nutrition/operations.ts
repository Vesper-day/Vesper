// Nutrition module DB/AI-layer core logic (Chat ADD-B), shared by:
//   GET    /api/v1/nutrition/food-log        -> listTodayFoodLog
//   POST   /api/v1/nutrition/food-log        -> createFoodLogEntry
//   DELETE /api/v1/nutrition/food-log/[id]   -> deleteFoodLogEntry
//   GET    /api/v1/nutrition/food-search     -> searchFoodCorpus
//   POST   /api/v1/nutrition/recipe-modify   -> runRecipeModify
//
// Mirrors medications/operations.ts: the pure functions live in this plain sibling
// module (a Next.js App Router route.ts may export only HTTP-method handlers + segment
// config). The route handlers import them; the integration test drives them directly
// against the chat-002 local-Supabase test DB.
//
// SCHEMA SOURCE: the Drizzle `foodLogEntries` model in packages/db/src/schema/modules.ts
// (migration 25). user_id ALWAYS comes from the authenticated session — NEVER from the
// request body. The boundary Zod lives in the client-safe @vesper/shared/nutrition
// subpath so the web 'use client' surface and this route share one contract.
//
// DEEP nutrition (micronutrient / vitamin / RDA / calorie) and external food-nutrient
// DB wiring are DEFERRED (PRD §6.3) — this module ships none of them.
import { z } from 'zod';
import {
  foodLogEntries,
  recipeTemplates,
  eq,
  and,
  sql,
  desc,
  type Database,
} from '@vesper/db';
import { ApiError, ErrorCode } from '@vesper/shared';
import {
  PostFoodLogSchema,
  FoodSearchQuerySchema,
  RecipeModifyRequestSchema,
  type FoodLogEntry,
  type FoodLogListResponse,
  type FoodSearchResponse,
  type RecipeModifyResponse,
} from '@vesper/shared/nutrition';
import { modifyRecipe } from '@vesper/ai';

// Guards the [id] path param only (bodies are validated by the boundary Zod above).
const ENTRY_UUID = z.string().uuid();

type FoodLogRow = typeof foodLogEntries.$inferSelect;

function serializeFoodLogEntry(row: FoodLogRow): FoodLogEntry {
  return {
    id: row.id,
    loggedAt: row.loggedAt.toISOString(),
    itemName: row.itemName,
    recipeTemplateId: row.recipeTemplateId ?? null,
    quantityNote: row.quantityNote ?? null,
  };
}

// --- GET /nutrition/food-log -------------------------------------------------

/**
 * List the user's food-log entries for THEIR current local day, newest first. The day
 * boundary is derived by query against start_of_local_day(tz) — the SAME derivation the
 * hydration counter uses (migration 14 / TECHNICAL_SPEC.md §3 table 21) — so "today" is
 * the user's today, not the server's. user-scoped; returns only rows owned by userId.
 */
export async function listTodayFoodLog(
  db: Database,
  userId: string,
  timezone: string,
): Promise<FoodLogListResponse> {
  const rows = await db
    .select()
    .from(foodLogEntries)
    .where(
      and(
        eq(foodLogEntries.userId, userId),
        sql`${foodLogEntries.loggedAt} >= start_of_local_day(${timezone})`,
      ),
    )
    .orderBy(desc(foodLogEntries.loggedAt));

  return { entries: rows.map(serializeFoodLogEntry) };
}

// --- POST /nutrition/food-log ------------------------------------------------

/**
 * Create a food-log entry for the user. user_id comes from the authenticated session
 * (NEVER the body). Supplies both NOT-NULL-no-default columns: user_id (session) and
 * item_name (required in the body). recipe_template_id / quantity_note / logged_at are
 * optional (the DB defaults logged_at to now()). Throws {@link ApiError} 400 on a
 * validation failure (e.g. a missing item_name).
 */
export async function createFoodLogEntry(
  db: Database,
  userId: string,
  rawBody: unknown,
): Promise<FoodLogEntry> {
  const parsed = PostFoodLogSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;

  const [row] = await db
    .insert(foodLogEntries)
    .values({
      userId,
      itemName: input.itemName,
      ...(input.recipeTemplateId !== undefined && input.recipeTemplateId !== null
        ? { recipeTemplateId: input.recipeTemplateId }
        : {}),
      ...(input.quantityNote !== undefined && input.quantityNote !== null
        ? { quantityNote: input.quantityNote }
        : {}),
      ...(input.loggedAt !== undefined ? { loggedAt: new Date(input.loggedAt) } : {}),
    })
    .returning();

  if (!row) {
    throw new ApiError(ErrorCode.INTERNAL_ERROR, 'Food-log insert returned no row.');
  }
  return serializeFoodLogEntry(row);
}

// --- DELETE /nutrition/food-log/[id] -----------------------------------------

/**
 * HARD-delete one of the user's food-log entries. Throws {@link ApiError} 404 when the
 * row is absent or not owned by the caller.
 */
export async function deleteFoodLogEntry(
  db: Database,
  userId: string,
  entryId: unknown,
): Promise<void> {
  if (typeof entryId !== 'string' || !ENTRY_UUID.safeParse(entryId).success) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Food-log entry not found.');
  }

  const deleted = await db
    .delete(foodLogEntries)
    .where(and(eq(foodLogEntries.id, entryId), eq(foodLogEntries.userId, userId)))
    .returning({ id: foodLogEntries.id });

  if (deleted.length === 0) {
    throw new ApiError(ErrorCode.NOT_FOUND, 'Food-log entry not found.');
  }
}

// --- GET /nutrition/food-search ----------------------------------------------

const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Name-substring search over the recipe_templates corpus (the EXISTING corpus; NO
 * external food-nutrient database — DEFERRED per PRD §6.3). Returns only the fields the
 * food-search surface renders plus the id the food-log POST links via recipeTemplateId.
 * Throws {@link ApiError} 400 on a validation failure (e.g. an empty query).
 */
export async function searchFoodCorpus(
  db: Database,
  rawQuery: unknown,
): Promise<FoodSearchResponse> {
  const parsed = FoodSearchQuerySchema.safeParse(rawQuery);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid search query.',
    );
  }
  const { q, limit } = parsed.data;

  const rows = await db
    .select({
      id: recipeTemplates.id,
      name: recipeTemplates.name,
      dietTags: recipeTemplates.dietTags,
      totalMinutes: recipeTemplates.totalMinutes,
    })
    .from(recipeTemplates)
    .where(sql`${recipeTemplates.name} ILIKE ${'%' + q + '%'}`)
    .orderBy(recipeTemplates.name)
    .limit(limit ?? DEFAULT_SEARCH_LIMIT);

  return {
    results: rows.map((r) => ({
      id: r.id,
      name: r.name,
      dietTags: r.dietTags,
      totalMinutes: r.totalMinutes,
    })),
  };
}

// --- POST /nutrition/recipe-modify -------------------------------------------

/**
 * Adjust a recipe to a requested change, via the reused AI command infrastructure
 * (@vesper/ai modifyRecipe — generateText's voice gate + cost + breaker seam). The
 * returned string is voice-gated before it reaches here. STATELESS — no DB access.
 * Throws {@link ApiError} 400 on a validation failure.
 */
export async function runRecipeModify(rawBody: unknown): Promise<RecipeModifyResponse> {
  const parsed = RecipeModifyRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ApiError(
      ErrorCode.INVALID_REQUEST,
      parsed.error.issues[0]?.message ?? 'Invalid request body.',
    );
  }
  const input = parsed.data;

  const modifiedRecipe = await modifyRecipe({
    recipeName: input.recipeName,
    ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
    request: input.request,
  });

  return { modifiedRecipe };
}
