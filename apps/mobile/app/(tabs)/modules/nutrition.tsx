// Mobile Nutrition surface (Chat ADD-B) — the first GENERATIVE module screen, shipped
// at method-B functional-breadth scaffold depth (PRD §6.3): a daily food-log surface, a
// food-search surface over the recipe corpus, and an AI recipe-modify surface that
// reuses the existing AI command infrastructure. DEEP nutrition (micronutrient / RDA /
// calorie internals; external food-nutrient DB) is DEFERRED — this screen names it and
// reserves a slot, and ships none of it.
//
// The Nutrition MODULE is OFF by default and gated on modulesEnabled.nutrition.enabled —
// it is NOT a top-level tab. It mounts in the Modules stack ((tabs)/modules/_layout.tsx)
// at /modules/nutrition and is reached from its card on the Modules list; this screen
// ALSO self-gates so a deep link while the module is off shows the module-off state.
//
// Data reaches mobile only through /api/v1 (the shared apiClient). Copy comes from the
// client-safe @vesper/shared/copy subpath; the wire TYPES + label helpers come from the
// pure ../../../lib/nutrition module (no @vesper/shared barrel). Chrome composes the
// mobile 107a primitives + named @vesper/ui tokens. No visual polish (a later Fable pass
// styles this screen).
import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TextField } from '../../../components/ui';
import { apiClient } from '../../../lib/api/client';
import {
  foodLogEntryLabel,
  foodSearchResultLabel,
  type FoodLogEntry,
  type FoodSearchResult,
} from '../../../lib/nutrition';
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

// Bronze for the ActivityIndicator raw-color prop (verbatim from @vesper/ui tokens.ts).
const C = { bronze: '#B8884A' } as const;

interface ProfileGate {
  profile: { modulesEnabled: { nutrition: { enabled: boolean } } };
}

const FOOD_LOG_KEY = ['nutrition', 'food-log'] as const;

export default function NutritionScreen(): React.JSX.Element {
  const { data: gate, isLoading: gateLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<ProfileGate>('/profile'),
  });
  const enabled = gate?.profile.modulesEnabled.nutrition.enabled ?? false;

  if (gateLoading) {
    return (
      <View className="flex-1 bg-espresso px-6 pt-16">
        <ActivityIndicator color={C.bronze} className="my-6" />
      </View>
    );
  }

  if (!enabled) {
    return (
      <View className="flex-1 bg-espresso px-6 pt-16">
        <Text className="mb-2 text-2xl text-cream">{NUTRITION_HEADING}</Text>
        <Text className="text-sm text-cream-muted">{NUTRITION_MODULE_OFF_LINE}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-espresso">
      <ScrollView contentContainerClassName="px-6 pb-10 pt-16">
        <Text className="mb-1 text-2xl text-cream">{NUTRITION_HEADING}</Text>
        <Text className="mb-6 text-sm text-cream-muted">{NUTRITION_INTRO}</Text>

        <FoodLogSection />
        <SearchSection />
        <ModifySection />

        {/* Reserved slot for the DEFERRED deep-engine surfaces (PRD §6.3). */}
        <View className="mt-2 rounded-xl border border-line-subtle bg-surface p-4">
          <Text className="text-xs text-cream-faint">{NUTRITION_DEFERRED_SLOT_LINE}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// --- Food-log surface --------------------------------------------------------

function FoodLogSection(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [itemName, setItemName] = useState('');
  const [quantityNote, setQuantityNote] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: FOOD_LOG_KEY,
    queryFn: () => apiClient.get<{ entries: FoodLogEntry[] }>('/nutrition/food-log'),
  });

  const invalidate = (): Promise<void> =>
    queryClient.invalidateQueries({ queryKey: FOOD_LOG_KEY }).then(() => undefined);

  const addMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<FoodLogEntry>('/nutrition/food-log', body),
    onSuccess: async () => {
      setItemName('');
      setQuantityNote('');
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/nutrition/food-log/${id}`),
    onSuccess: () => invalidate(),
  });

  const entries = data?.entries ?? [];

  const submit = (): void => {
    const name = itemName.trim();
    if (!name) return;
    const body: Record<string, unknown> = { itemName: name };
    if (quantityNote.trim()) body.quantityNote = quantityNote.trim();
    addMutation.mutate(body);
  };

  return (
    <View className="mb-6 rounded-xl border border-line-subtle bg-surface p-4">
      <Text className="mb-3 text-lg font-semibold text-cream">{NUTRITION_FOOD_LOG_HEADING}</Text>

      <View className="mb-2">
        <TextField
          value={itemName}
          onChangeText={setItemName}
          placeholder={NUTRITION_FOOD_LOG_ITEM_PLACEHOLDER}
          className="mb-2"
        />
        <TextField
          value={quantityNote}
          onChangeText={setQuantityNote}
          placeholder={NUTRITION_FOOD_LOG_QUANTITY_PLACEHOLDER}
          className="mb-2"
        />
        <Pressable
          accessibilityRole="button"
          disabled={addMutation.isPending || itemName.trim() === ''}
          onPress={submit}
          className="self-start rounded-md bg-bronze px-3 py-2"
        >
          <Text className="text-sm font-medium text-espresso">
            {addMutation.isPending ? 'Saving…' : NUTRITION_FOOD_LOG_ADD_LABEL}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={C.bronze} className="my-4" />
      ) : isError ? (
        <Text className="py-4 text-center text-sm text-oxblood">Could not load your food log.</Text>
      ) : entries.length === 0 ? (
        <Text className="py-4 text-center text-sm text-cream-muted">{NUTRITION_FOOD_LOG_EMPTY}</Text>
      ) : (
        entries.map((entry) => {
          const deleting = deleteMutation.isPending && deleteMutation.variables === entry.id;
          return (
            <View
              key={entry.id}
              className="mt-2 flex-row items-center justify-between gap-3 rounded-md border border-line-subtle px-3 py-2"
            >
              <Text className="flex-1 text-sm text-cream">{foodLogEntryLabel(entry)}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => deleteMutation.mutate(entry.id)}
                className="rounded-md border border-oxblood px-2 py-1"
              >
                <Text className="text-xs text-oxblood">{deleting ? '…' : 'Remove'}</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </View>
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
      apiClient.get<{ results: FoodSearchResult[] }>(
        `/nutrition/food-search?q=${encodeURIComponent(submitted ?? '')}`,
      ),
    enabled: submitted !== null && submitted.trim() !== '',
  });

  const logMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<FoodLogEntry>('/nutrition/food-log', body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: FOOD_LOG_KEY }).then(() => undefined),
  });

  const results = data?.results ?? [];

  return (
    <View className="mb-6 rounded-xl border border-line-subtle bg-surface p-4">
      <Text className="mb-1 text-lg font-semibold text-cream">{NUTRITION_SEARCH_HEADING}</Text>
      <Text className="mb-3 text-xs text-cream-faint">{NUTRITION_SEARCH_HELP}</Text>

      <View className="mb-2">
        <TextField
          value={term}
          onChangeText={setTerm}
          placeholder={NUTRITION_SEARCH_PLACEHOLDER}
          className="mb-2"
        />
        <Pressable
          accessibilityRole="button"
          disabled={term.trim() === ''}
          onPress={() => setSubmitted(term.trim())}
          className="self-start rounded-md bg-bronze px-3 py-2"
        >
          <Text className="text-sm font-medium text-espresso">Search</Text>
        </Pressable>
      </View>

      {isFetching ? (
        <ActivityIndicator color={C.bronze} className="my-4" />
      ) : isError ? (
        <Text className="py-4 text-center text-sm text-oxblood">Could not search recipes.</Text>
      ) : submitted && submitted.trim() !== '' && results.length === 0 ? (
        <Text className="py-4 text-center text-sm text-cream-muted">{NUTRITION_SEARCH_EMPTY}</Text>
      ) : (
        results.map((result) => (
          <View
            key={result.id}
            className="mt-2 flex-row items-center justify-between gap-3 rounded-md border border-line-subtle px-3 py-2"
          >
            <Text className="flex-1 text-sm text-cream">{foodSearchResultLabel(result)}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={logMutation.isPending}
              onPress={() =>
                logMutation.mutate({ itemName: result.name, recipeTemplateId: result.id })
              }
              className="rounded-md border border-line-subtle px-2 py-1"
            >
              <Text className="text-xs text-cream">Log</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

// --- AI recipe-modify surface ------------------------------------------------

function ModifySection(): React.JSX.Element {
  const [recipeName, setRecipeName] = useState('');
  const [request, setRequest] = useState('');

  const modifyMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<{ modifiedRecipe: string }>('/nutrition/recipe-modify', body),
  });

  const submit = (): void => {
    const name = recipeName.trim();
    const change = request.trim();
    if (!name || !change) return;
    modifyMutation.mutate({ recipeName: name, request: change });
  };

  return (
    <View className="mb-6 rounded-xl border border-line-subtle bg-surface p-4">
      <Text className="mb-1 text-lg font-semibold text-cream">{NUTRITION_MODIFY_HEADING}</Text>
      <Text className="mb-3 text-xs text-cream-faint">{NUTRITION_MODIFY_HELP}</Text>

      <TextField
        value={recipeName}
        onChangeText={setRecipeName}
        placeholder={NUTRITION_MODIFY_RECIPE_PLACEHOLDER}
        className="mb-2"
      />
      <TextField
        value={request}
        onChangeText={setRequest}
        placeholder={NUTRITION_MODIFY_REQUEST_PLACEHOLDER}
        className="mb-2"
      />
      <Pressable
        accessibilityRole="button"
        disabled={modifyMutation.isPending || recipeName.trim() === '' || request.trim() === ''}
        onPress={submit}
        className="mb-3 self-start rounded-md bg-bronze px-3 py-2"
      >
        <Text className="text-sm font-medium text-espresso">
          {modifyMutation.isPending ? 'Working…' : NUTRITION_MODIFY_SUBMIT_LABEL}
        </Text>
      </Pressable>

      {modifyMutation.isError && (
        <Text className="text-sm text-oxblood">Could not adjust the recipe.</Text>
      )}
      {modifyMutation.data && (
        <View className="rounded-md border border-line-subtle p-3">
          <Text className="text-sm text-cream">{modifyMutation.data.modifiedRecipe}</Text>
        </View>
      )}
    </View>
  );
}
