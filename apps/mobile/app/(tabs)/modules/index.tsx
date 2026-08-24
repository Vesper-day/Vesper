// Modules list (ADD-A) — the home screen of the "Modules" tab. A vertically
// scrollable column of rounded @vesper/ui-token Cards (107 primitive), one card
// per landed module, each routing to its own full page; a "Settings" card is
// pinned at the bottom, routing into the re-parented settings sub-stack.
//
// Cards route to self-gating pages, so a module card is shown whether the module
// is on or off (never a dead toggle); an at-a-glance On/Off hint is read from the
// same GET /api/v1/profile gate the pages use (singular keys medication /
// finance). Card composition + tokens only — no token or 107/107a primitive VALUE
// is changed here. See docs/MODULE_MOUNT_CONTRACT.md.
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Link, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../../components/ui';
import { apiClient } from '../../../lib/api/client';
import { MODULE_CARDS, isModuleEnabled, type ModuleGate } from '../../../lib/modules';

export default function ModulesScreen(): React.JSX.Element {
  const { data: gate } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<ModuleGate>('/profile'),
  });

  return (
    <View className="flex-1 bg-espresso">
      <ScrollView contentContainerClassName="px-6 pb-10 pt-16">
        <Text className="mb-6 text-2xl text-cream">Modules</Text>

        {MODULE_CARDS.map((card) => {
          const on = isModuleEnabled(gate, card.gateKey);
          return (
            // Cast: the typed-routes union in .expo/types is only regenerated when
            // the Expo dev server runs, so a freshly-added route is not yet in it.
            // The path is valid at runtime (groups are URL-transparent).
            <Link key={card.key} href={card.route as Href} asChild>
              <Pressable accessibilityRole="button" className="mb-3">
                <Card className="flex-row items-center justify-between p-4">
                  <View className="flex-1 pr-3">
                    <Text className="text-base text-cream">{card.title}</Text>
                    <Text className="text-sm text-cream-faint">{card.subtitle}</Text>
                  </View>
                  <Text className="text-xs text-cream-muted">{on ? 'On' : 'Off'}</Text>
                </Card>
              </Pressable>
            </Link>
          );
        })}

        {/* Settings — pinned at the bottom of the list, not a module. Opens the
            re-parented settings sub-stack. */}
        <Link href={'/modules/settings' as Href} asChild>
          <Pressable accessibilityRole="button" className="mt-3">
            <Card className="flex-row items-center justify-between p-4">
              <View className="flex-1 pr-3">
                <Text className="text-base text-cream">Settings</Text>
                <Text className="text-sm text-cream-faint">
                  Integrations, privacy, and subscription
                </Text>
              </View>
              <Text className="text-xs text-cream-muted">›</Text>
            </Card>
          </Pressable>
        </Link>
      </ScrollView>
    </View>
  );
}
