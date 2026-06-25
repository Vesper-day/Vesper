const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Metro package.json "exports" resolution stays ON (SDK 53+ default). The mobile
// bundle imports @vesper/shared only via client-safe subpaths ('@vesper/shared/queries'
// and '@vesper/shared/realtime'), so the bare barrel's server-only re-exports
// (subscriptionState.ts -> node:crypto and api/auth -> @vesper/db -> postgres -> node
// fs/net/tls) never enter the mobile module graph. The 053 exports-off hatch was
// removed in the 081 barrel split; see PERSISTENT 081 / 038.

module.exports = withNativeWind(config, { input: './global.css' });
