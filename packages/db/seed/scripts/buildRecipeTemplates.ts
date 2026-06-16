// Build packages/db/seed/recipe_templates.json from TheMealDB (free, no API key).
//
// Primary source is the random endpoint (random.php returns ONE meal per call); we iterate
// and dedupe by idMeal + name until ~300 distinct meals are collected. random.php draws from
// a ~666-meal corpus, so collecting 300 distinct is cheap (coupon-collector ≈ a few hundred
// calls). A bounded a-z search.php enumeration backfills deterministically if the random
// phase plateaus before the target — both phases are "iterate + dedupe".
//
// TheMealDB carries no nutrition/timing/diet data, so:
//   * diet_tags  — derived via ingredient-based heuristics (+ category signal).
//   * prep/cook/total/servings/difficulty — derived from ingredient count & instruction
//     steps so the CHECKs (>=0, servings>0, difficulty enum) always hold.
//   * macros     — per-serving estimate by category.
// Every row is validated with recipeTemplateRow.parse() before writing; first failure throws.
// Run: tsx seed/scripts/buildRecipeTemplates.ts

import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { recipeTemplateRow, type RecipeTemplateRow } from './templateRowSchemas';

const OUT = resolve(__dirname, '../recipe_templates.json');
const TARGET = 300;
const RANDOM_URL = 'https://www.themealdb.com/api/json/v1/1/random.php';
const SEARCH_URL = 'https://www.themealdb.com/api/json/v1/1/search.php?f=';
const MAX_RANDOM_ATTEMPTS = 1500;

interface Meal {
  idMeal: string;
  strMeal: string;
  strCategory: string | null;
  strArea: string | null;
  strInstructions: string | null;
  strMealThumb: string | null;
  strTags: string | null;
  [key: string]: string | null;
}

async function getMeals(url: string): Promise<Meal[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TheMealDB ${url} -> HTTP ${res.status}`);
  const data = (await res.json()) as { meals: Meal[] | null };
  return data.meals ?? [];
}

// Collect distinct meals: random.php first, a-z backfill if short.
async function collectMeals(): Promise<Meal[]> {
  const byId = new Map<string, Meal>();
  const seenNames = new Set<string>();

  const add = (m: Meal): void => {
    const nameKey = (m.strMeal || '').trim().toLowerCase();
    if (!m.idMeal || byId.has(m.idMeal) || seenNames.has(nameKey)) return;
    byId.set(m.idMeal, m);
    seenNames.add(nameKey);
  };

  let attempts = 0;
  let sinceProgress = 0;
  while (byId.size < TARGET && attempts < MAX_RANDOM_ATTEMPTS && sinceProgress < 200) {
    attempts += 1;
    const before = byId.size;
    const meals = await getMeals(RANDOM_URL);
    if (meals[0]) add(meals[0]);
    sinceProgress = byId.size > before ? 0 : sinceProgress + 1;
  }
  console.log(`random.php: ${byId.size} distinct after ${attempts} calls.`);

  if (byId.size < TARGET) {
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    for (const L of letters) {
      if (byId.size >= TARGET) break;
      const meals = await getMeals(SEARCH_URL + L);
      for (const m of meals) {
        if (byId.size >= TARGET) break;
        add(m);
      }
    }
    console.log(`a-z backfill: ${byId.size} distinct total.`);
  }

  // Deterministic order by idMeal.
  return [...byId.values()].sort((a, b) => a.idMeal.localeCompare(b.idMeal));
}

// --- mapping helpers ---------------------------------------------------------

function ingredientPairs(meal: Meal): { name: string; measure: string }[] {
  const out: { name: string; measure: string }[] = [];
  for (let i = 1; i <= 20; i += 1) {
    const name = (meal[`strIngredient${i}`] || '').trim();
    const measure = (meal[`strMeasure${i}`] || '').trim();
    if (name) out.push({ name, measure });
  }
  return out;
}

function instructionSteps(meal: Meal): string[] {
  const raw = (meal.strInstructions || '').trim();
  if (!raw) return ['See source for full instructions.'];
  let steps = raw
    .split(/\r?\n+/)
    .map((s) => s.replace(/^\s*(?:step\s*)?\d+[).:]?\s*/i, '').trim())
    .filter((s) => s.length > 0);
  if (steps.length <= 1) {
    steps = raw
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return steps.length > 0 ? steps : [raw];
}

function normTag(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '_');
}

function cuisineTags(meal: Meal): string[] {
  const tags = new Set<string>();
  if (meal.strArea && meal.strArea.trim() && meal.strArea !== 'Unknown')
    tags.add(normTag(meal.strArea));
  if (meal.strCategory && meal.strCategory.trim()) tags.add(normTag(meal.strCategory));
  return [...tags];
}

const MEAT_POULTRY = [
  'beef', 'steak', 'pork', 'bacon', 'ham', 'sausage', 'lamb', 'mutton', 'veal', 'chicken',
  'turkey', 'duck', 'goat', 'prosciutto', 'chorizo', 'salami', 'pepperoni', 'meat', 'mince',
  'liver', 'gelatin', 'lard', 'pancetta', 'jamón', 'jamon', 'serrano', 'speck', 'mortadella',
  'guanciale', 'rabbit', 'venison', 'oxtail', 'gammon', 'black pudding', 'kielbasa',
  'frankfurter', 'meatball',
];
const FISH_SEAFOOD = [
  'fish', 'salmon', 'tuna', 'cod', 'haddock', 'prawn', 'shrimp', 'crab', 'lobster', 'anchov',
  'squid', 'mussel', 'clam', 'oyster', 'sardine', 'mackerel', 'seafood', 'scallop', 'caviar',
  'herring', 'trout', 'tilapia', 'pollock', 'snapper', 'octopus', 'calamari',
];
const DAIRY_EGG = [
  'milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'egg', 'honey', 'ghee',
  'parmesan', 'mozzarella', 'mascarpone', 'custard', 'paneer',
];
const DAIRY = [
  'milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'ghee', 'parmesan', 'mozzarella',
  'mascarpone', 'custard', 'paneer',
];
const GLUTEN = [
  'flour', 'bread', 'pasta', 'spaghetti', 'noodle', 'breadcrumb', 'barley', 'couscous',
  'cracker', 'biscuit', 'cake', 'pastry', 'wheat', 'soy sauce', 'beer', 'bun', 'tortilla',
  'dough', 'semolina', 'macaroni', 'penne', 'lasagne', 'lasagna',
];

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function dietTags(meal: Meal, ingredients: { name: string }[]): string[] {
  // Strictly ingredient-based: TheMealDB's category field is unreliable (e.g. meals with
  // chicken/ham land in its "Vegetarian" category), so we never trust it for veg/vegan.
  const blob = ingredients.map((i) => i.name.toLowerCase()).join(' | ');
  const category = (meal.strCategory || '').toLowerCase();
  const tags = new Set<string>();

  const meaty = hasAny(blob, MEAT_POULTRY);
  const fishy = hasAny(blob, FISH_SEAFOOD);
  const dairyEgg = hasAny(blob, DAIRY_EGG);

  if (!meaty && !fishy) {
    tags.add('vegetarian');
    if (!dairyEgg) tags.add('vegan');
  }
  if (fishy && !meaty) tags.add('pescatarian');
  if (!hasAny(blob, DAIRY)) tags.add('dairy_free');
  if (!hasAny(blob, GLUTEN) && category !== 'pasta') tags.add('gluten_free');

  return [...tags];
}

const MACROS_BY_CATEGORY: Record<
  string,
  { calories: number; protein_g: number; carbs_g: number; fat_g: number }
> = {
  beef: { calories: 520, protein_g: 38, carbs_g: 18, fat_g: 32 },
  chicken: { calories: 430, protein_g: 40, carbs_g: 15, fat_g: 22 },
  pork: { calories: 500, protein_g: 34, carbs_g: 14, fat_g: 34 },
  lamb: { calories: 540, protein_g: 36, carbs_g: 12, fat_g: 38 },
  goat: { calories: 480, protein_g: 36, carbs_g: 12, fat_g: 30 },
  seafood: { calories: 380, protein_g: 34, carbs_g: 18, fat_g: 18 },
  pasta: { calories: 600, protein_g: 22, carbs_g: 78, fat_g: 20 },
  dessert: { calories: 450, protein_g: 6, carbs_g: 62, fat_g: 20 },
  breakfast: { calories: 420, protein_g: 18, carbs_g: 42, fat_g: 20 },
  vegan: { calories: 360, protein_g: 14, carbs_g: 52, fat_g: 12 },
  vegetarian: { calories: 400, protein_g: 16, carbs_g: 50, fat_g: 16 },
  side: { calories: 250, protein_g: 6, carbs_g: 36, fat_g: 9 },
  starter: { calories: 300, protein_g: 14, carbs_g: 28, fat_g: 14 },
  miscellaneous: { calories: 420, protein_g: 18, carbs_g: 44, fat_g: 18 },
};

function macrosFor(meal: Meal): RecipeTemplateRow['macros'] {
  const key = (meal.strCategory || '').toLowerCase();
  return MACROS_BY_CATEGORY[key] ?? MACROS_BY_CATEGORY.miscellaneous;
}

const LONG_COOK = new Set(['beef', 'lamb', 'pork', 'goat']);

function timing(
  meal: Meal,
  nIngredients: number,
  nSteps: number,
): { prep: number; cook: number; total: number; difficulty: 'easy' | 'medium' | 'hard' } {
  const category = (meal.strCategory || '').toLowerCase();
  const prep = Math.min(45, 5 + nIngredients * 2);
  let cook = Math.min(180, 10 + nSteps * 5);
  if (LONG_COOK.has(category)) cook += 20;
  if (category === 'dessert') cook += 10;
  const total = prep + cook;

  let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  if (nIngredients <= 8 && nSteps <= 5) difficulty = 'easy';
  else if (nIngredients >= 14 || nSteps >= 10) difficulty = 'hard';

  return { prep, cook, total, difficulty };
}

function servingsFor(nIngredients: number): number {
  if (nIngredients >= 14) return 6;
  if (nIngredients <= 6) return 2;
  return 4;
}

function toRow(meal: Meal): RecipeTemplateRow {
  const ingredients = ingredientPairs(meal);
  const instructions = instructionSteps(meal);
  const { prep, cook, total, difficulty } = timing(meal, ingredients.length, instructions.length);
  const thumb = (meal.strMealThumb || '').trim();

  return {
    name: meal.strMeal.trim(),
    cuisine_tags: cuisineTags(meal),
    diet_tags: dietTags(meal, ingredients),
    prep_minutes: prep,
    cook_minutes: cook,
    total_minutes: total,
    difficulty,
    macros: macrosFor(meal),
    servings: servingsFor(ingredients.length),
    ingredients,
    instructions,
    image_url: thumb.length > 0 ? thumb : null,
    source: 'themealdb',
  };
}

async function main(): Promise<void> {
  const meals = await collectMeals();
  // Drop meals with no usable ingredients (would fail the >=1 ingredient invariant).
  const rows = meals
    .map(toRow)
    .filter((r) => r.ingredients.length > 0);

  rows.forEach((row, i) => {
    const parsed = recipeTemplateRow.safeParse(row);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path.join('.');
      const value = JSON.stringify(
        issue.path.reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], row),
      );
      throw new Error(
        `Row ${i} ("${row.name}") failed validation at "${field}": ${issue.message} (value=${value})`,
      );
    }
  });

  writeFileSync(OUT, JSON.stringify(rows, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${rows.length} recipe templates -> ${OUT}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
