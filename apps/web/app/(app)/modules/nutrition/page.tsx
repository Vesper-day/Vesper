'use client';

// Web Nutrition surface (Chat ADD-B) — the first GENERATIVE module page, shipped at
// method-B functional-breadth scaffold depth (PRD §6.3): a daily food-log surface, a
// food-search surface over the recipe corpus, and an AI recipe-modify surface that
// reuses the existing AI command infrastructure. DEEP nutrition (micronutrient / RDA /
// calorie internals; external food-nutrient DB) is DEFERRED — the page names it and
// reserves a slot, and ships none of it.
//
// The Nutrition MODULE is OFF by default and gated on
// profile.modulesEnabled.nutrition.enabled. Reached from its card on the /modules list;
// self-gates so a deep link while the module is off shows the module-off state.
//
// IMPORT SAFETY: this 'use client' file imports NO @vesper/shared barrel (which would
// pull server-only code into the client bundle) — only the client-safe subpaths
// (@vesper/shared/copy, @vesper/shared/nutrition) and the pure @/lib/nutrition helpers.
// Chrome composes the 107/107a primitives (@/components/ui) + named @vesper/ui tokens.
// No visual polish here (a later Fable pass styles this page).
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button, Card, TextField } from '@/components/ui';
import { foodLogEntryLabel, foodSearchResultLabel } from '@/lib/nutrition';
import type {
  FoodLogListResponse,
  FoodLogEntry,
  FoodSearchResponse,
  RecipeModifyResponse,
} from '@vesper/shared/nutrition';
import {
  NUTRITION_HEADING,
  NUTRITION_INTRO,
  NUTRITION_MODULE_OFF_LINE,
  NUTRITION_FOOD_LOG_HEADING,
  NUTRITION_FOOD_LOG_EMPTY,
  NUTRITION_FOOD_LOG_ADD_LABEL,
  NUTRITION_FOOD_LOG_ITEM_PLACEHOLDER,
  NUTRITION_FOOD_LOG_QUANTITY_PLACEHOLDER,
  NUTRITION_SEARCH_HEADING,
  NUTRITION_SEARCH_HELP,
  NUTRITION_SEARCH_PLACEHOLDER,
  NUTRITION_SEARCH_EMPTY,
  NUTRITION_MODIFY_HEADING,
  NUTRITION_MODIFY_HELP,
  NUTRITION_MODIFY_RECIPE_PLACEHOLDER,
  NUTRITION_MODIFY_REQUEST_PLACEHOLDER,
  NUTRITION_MODIFY_SUBMIT_LABEL,
  NUTRITION_DEFERRED_SLOT_LINE,
} from '@vesper/shared/copy';

interface ProfileGate {
  profile: { modulesEnabled: { nutrition: { enabled: boolean } } };
}

// DELETE returns 204 with an empty body; the shared api.delete helper calls res.json()
// and would throw on it, so delete goes through a direct fetch (medications precedent).
async function deleteFoodLogRequest(id: string): Promise<void> {
  const res = await fetch(`/api/v1/nutrition/food-log/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
}

const FOOD_LOG_KEY = ['nutrition', 'food-log'] as const;

export default function NutritionPage(): React.JSX.Element {
  const { data: gate, isLoading: gateLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<ProfileGate>('/profile'),
  });

  if (gateLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="py-10 text-center text-sm text-cream-muted">Loading…</p>
      </main>
    );
  }

  const enabled = gate?.profile.modulesEnabled.nutrition.enabled ?? false;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-cream">{NUTRITION_HEADING}</h1>
        <p className="text-sm text-cream-muted">{NUTRITION_INTRO}</p>
      </header>

      {enabled ? (
        <div className="flex flex-col gap-6">
          <FoodLogSection />
          <SearchSection />
          <ModifySection />
          {/* Reserved slot for the DEFERRED deep-engine surfaces (PRD §6.3). */}
          <Card className="p-4">
            <p className="text-xs text-cream-faint">{NUTRITION_DEFERRED_SLOT_LINE}</p>
          </Card>
        </div>
      ) : (
        <Card className="p-6">
          <p className="text-sm font-medium text-cream">The Nutrition module is off.</p>
          <p className="mt-1 text-sm text-cream-muted">{NUTRITION_MODULE_OFF_LINE}</p>
        </Card>
      )}
    </main>
  );
}

// --- Food-log surface --------------------------------------------------------

function FoodLogSection(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [itemName, setItemName] = useState('');
  const [quantityNote, setQuantityNote] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: FOOD_LOG_KEY,
    queryFn: () => api.get<FoodLogListResponse>('/nutrition/food-log'),
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: FOOD_LOG_KEY }).then(() => undefined);

  const addMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<FoodLogEntry>('/nutrition/food-log', body),
    onSuccess: async () => {
      setItemName('');
      setQuantityNote('');
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFoodLogRequest(id),
    onSuccess: () => invalidate(),
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);

  const submit = (): void => {
    const name = itemName.trim();
    if (!name) return;
    const body: Record<string, unknown> = { itemName: name };
    if (quantityNote.trim()) body.quantityNote = quantityNote.trim();
    addMutation.mutate(body);
  };

  return (
    <Card className="p-4">
      <h2 className="mb-3 text-lg font-semibold text-cream">{NUTRITION_FOOD_LOG_HEADING}</h2>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <TextField
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder={NUTRITION_FOOD_LOG_ITEM_PLACEHOLDER}
          className="flex-1"
          aria-label="Food item"
        />
        <TextField
          value={quantityNote}
          onChange={(e) => setQuantityNote(e.target.value)}
          placeholder={NUTRITION_FOOD_LOG_QUANTITY_PLACEHOLDER}
          className="flex-1"
          aria-label="Portion note"
        />
        <Button onClick={submit} disabled={addMutation.isPending || itemName.trim() === ''}>
          {addMutation.isPending ? 'Saving…' : NUTRITION_FOOD_LOG_ADD_LABEL}
        </Button>
      </div>

      {isError ? (
        <p className="py-6 text-center text-sm text-oxblood">Could not load your food log.</p>
      ) : isLoading ? (
        <p className="py-6 text-center text-sm text-cream-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-cream-muted">{NUTRITION_FOOD_LOG_EMPTY}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-md border border-line-subtle px-3 py-2"
            >
              <p className="text-sm text-cream">{foodLogEntryLabel(entry)}</p>
              <button
                type="button"
                disabled={deleteMutation.isPending && deleteMutation.variables === entry.id}
                onClick={() => deleteMutation.mutate(entry.id)}
                className="rounded-md border border-oxblood px-2 py-1 text-xs text-oxblood"
              >
                {deleteMutation.isPending && deleteMutation.variables === entry.id ? '…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// --- Food-search surface -----------------------------------------------------

function SearchSection(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['nutrition', 'food-search', submitted],
    queryFn: () =>
      api.get<FoodSearchResponse>(
        `/nutrition/food-search?q=${encodeURIComponent(submitted ?? '')}`,
      ),
    enabled: submitted !== null && submitted.trim() !== '',
  });

  const logMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<FoodLogEntry>('/nutrition/food-log', body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: FOOD_LOG_KEY }).then(() => undefined),
  });

  const results = data?.results ?? [];

  return (
    <Card className="p-4">
      <h2 className="mb-1 text-lg font-semibold text-cream">{NUTRITION_SEARCH_HEADING}</h2>
      <p className="mb-3 text-xs text-cream-faint">{NUTRITION_SEARCH_HELP}</p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <TextField
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={NUTRITION_SEARCH_PLACEHOLDER}
          className="flex-1"
          aria-label="Search recipes"
        />
        <Button onClick={() => setSubmitted(term.trim())} disabled={term.trim() === ''}>
          Search
        </Button>
      </div>

      {isError ? (
        <p className="py-6 text-center text-sm text-oxblood">Could not search recipes.</p>
      ) : isFetching ? (
        <p className="py-6 text-center text-sm text-cream-muted">Searching…</p>
      ) : submitted && submitted.trim() !== '' && results.length === 0 ? (
        <p className="py-6 text-center text-sm text-cream-muted">{NUTRITION_SEARCH_EMPTY}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((result) => (
            <div
              key={result.id}
              className="flex items-center justify-between gap-3 rounded-md border border-line-subtle px-3 py-2"
            >
              <p className="text-sm text-cream">{foodSearchResultLabel(result)}</p>
              <button
                type="button"
                disabled={logMutation.isPending}
                onClick={() =>
                  logMutation.mutate({ itemName: result.name, recipeTemplateId: result.id })
                }
                className="rounded-md border border-line-subtle px-2 py-1 text-xs text-cream"
              >
                Log
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// --- AI recipe-modify surface ------------------------------------------------

function ModifySection(): React.JSX.Element {
  const [recipeName, setRecipeName] = useState('');
  const [request, setRequest] = useState('');

  const modifyMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post<RecipeModifyResponse>('/nutrition/recipe-modify', body),
  });

  const submit = (): void => {
    const name = recipeName.trim();
    const change = request.trim();
    if (!name || !change) return;
    modifyMutation.mutate({ recipeName: name, request: change });
  };

  return (
    <Card className="p-4">
      <h2 className="mb-1 text-lg font-semibold text-cream">{NUTRITION_MODIFY_HEADING}</h2>
      <p className="mb-3 text-xs text-cream-faint">{NUTRITION_MODIFY_HELP}</p>

      <div className="mb-3 flex flex-col gap-2">
        <TextField
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
          placeholder={NUTRITION_MODIFY_RECIPE_PLACEHOLDER}
          aria-label="Recipe name"
        />
        <TextField
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder={NUTRITION_MODIFY_REQUEST_PLACEHOLDER}
          aria-label="Requested change"
        />
        <Button
          onClick={submit}
          disabled={
            modifyMutation.isPending || recipeName.trim() === '' || request.trim() === ''
          }
        >
          {modifyMutation.isPending ? 'Working…' : NUTRITION_MODIFY_SUBMIT_LABEL}
        </Button>
      </div>

      {modifyMutation.isError && (
        <p className="text-sm text-oxblood">Could not adjust the recipe.</p>
      )}
      {modifyMutation.data && (
        <div className="rounded-md border border-line-subtle p-3">
          <p className="whitespace-pre-wrap text-sm text-cream">
            {modifyMutation.data.modifiedRecipe}
          </p>
        </div>
      )}
    </Card>
  );
}
