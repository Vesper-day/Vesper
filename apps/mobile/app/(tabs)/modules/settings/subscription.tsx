// Subscription upgrade surface (Chat 085 — the trial-end upgrade UI). Mounts as a
// sub-screen of the Settings stack (settings/_layout.tsx), reached from the entry
// in settings/index.tsx.
//
// Composes the Layer 4 / Chat 107 primitives (Card, Button) + named @vesper/ui
// tokens — no hardcoded hexes (the ActivityIndicator raw-color prop reads
// colors.bronze). The product NAME and PRICE are fetched from StoreKit at runtime
// (storeKit.fetchStandardProduct -> displayName / displayPrice) and NEVER
// hardcoded. Subscribe -> storeKit.purchaseStandard() -> POST the signed JWS to
// /api/v1/subscription/apple-verify via the thin client; that route is a 501 stub
// until chat 086, so a non-200 is surfaced as "verification pending" — no crash.
//
// The native StoreKit layer is inert in Expo Go (product fetch throws there); the
// real flow is Mac/EAS/Cutover-gated and deferred. This screen writes NOTHING to
// users.subscription_status — the server transitions state in chat 086.
//
// POSTHOG POSTURE: NO analytics capture is wired on this surface — no posthog
// import, no track() call. Autocapture is OFF at V1 [ARCHITECTURE_DECISIONS 08].
import { useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@vesper/ui';
import { Card, Button } from '../../../../components/ui';
import {
  fetchStandardProduct,
  purchaseStandard,
  showManageSubscriptions,
} from '../../../../lib/storeKit';
import { verifyApplePurchase } from '../../../../lib/subscription';

type FlowState =
  | { phase: 'idle' }
  | { phase: 'purchasing' }
  | { phase: 'pending' }
  | { phase: 'verified' }
  | { phase: 'error'; message: string };

export default function SubscriptionScreen(): React.JSX.Element {
  const [flow, setFlow] = useState<FlowState>({ phase: 'idle' });

  const {
    data: product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['subscription-product'],
    queryFn: fetchStandardProduct,
  });

  const onSubscribe = async (): Promise<void> => {
    setFlow({ phase: 'purchasing' });
    try {
      const purchase = await purchaseStandard();
      const outcome = await verifyApplePurchase(purchase);
      setFlow(outcome.status === 'verified' ? { phase: 'verified' } : { phase: 'pending' });
    } catch (err) {
      setFlow({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Something went wrong.',
      });
    }
  };

  const onManage = (): void => {
    void showManageSubscriptions();
  };

  return (
    <View className="flex-1 bg-espresso">
      <ScrollView contentContainerClassName="px-6 pb-10 pt-16">
        <Text className="mb-4 text-2xl text-cream">Subscription</Text>

        <Card className="mb-4 p-5">
          {isLoading ? (
            <ActivityIndicator color={colors.bronze} className="my-2" />
          ) : isError || !product ? (
            <Text className="text-sm text-cream-muted">
              The subscription is unavailable right now. Please try again later.
            </Text>
          ) : (
            <View>
              <Text className="text-lg font-semibold text-cream">{product.displayName}</Text>
              <Text className="mt-1 text-base text-bronze">{product.displayPrice}</Text>
            </View>
          )}
        </Card>

        {flow.phase === 'pending' && (
          <Text className="mb-3 text-sm text-cream-muted">
            Purchase received. Activation is pending.
          </Text>
        )}
        {flow.phase === 'verified' && (
          <Text className="mb-3 text-sm text-cream">Your subscription is active.</Text>
        )}
        {flow.phase === 'error' && (
          <Text className="mb-3 text-sm text-oxblood">{flow.message}</Text>
        )}

        <Button
          title={flow.phase === 'purchasing' ? 'Processing…' : 'Subscribe'}
          variant="primary"
          disabled={flow.phase === 'purchasing' || isLoading || isError || !product}
          onPress={onSubscribe}
          className="mb-3"
        />

        <Button title="Manage subscription" variant="secondary" onPress={onManage} />
      </ScrollView>
    </View>
  );
}
