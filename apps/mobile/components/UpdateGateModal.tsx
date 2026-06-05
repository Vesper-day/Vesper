import { Modal, View, Text, Pressable, Linking } from 'react-native';
import { useUpdateGateStore, APP_STORE_ID } from '../lib/api/client';

/**
 * Full-screen, NON-dismissible update gate. Shown when the API returns
 * 426 Upgrade Required (the client is below MIN_APP_VERSION). There is no close
 * affordance — the only exit is installing the new build from the App Store.
 *
 * Copy is fixed for this chat and intentionally NOT voice-gated.
 * Surfaces are styled with named Layer 4 tokens only.
 */
export function UpdateGateModal(): React.JSX.Element {
  const required = useUpdateGateStore((s) => s.required);

  return (
    <Modal
      visible={required}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      // Non-dismissible: swallow the hardware/back dismiss request.
      onRequestClose={() => {}}
    >
      <View className="flex-1 items-center justify-center bg-espresso px-8">
        <Text className="mb-8 text-center text-xl text-cream">
          Vesper has updated. Update to continue.
        </Text>
        <Pressable
          accessibilityRole="button"
          className="rounded-lg bg-bronze px-6 py-3"
          onPress={() => {
            void Linking.openURL(`itms-apps://apps.apple.com/app/id${APP_STORE_ID}`);
          }}
        >
          <Text className="text-base font-semibold text-espresso">Update</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
