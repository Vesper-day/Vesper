const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// SDK 53 enables Metro package.json "exports" resolution by default. That makes Metro
// resolve the bare @vesper/shared barrel through a path that pulls server-only code into
// the mobile bundle (src/index.ts re-exports subscriptionState.ts -> node:crypto and
// @vesper/db -> postgres -> node fs/net/tls), which fails to bundle for iOS. Disabling
// package.json exports resolution restores the SDK-52 "main"-field behavior the mobile
// bundle relied on. See PERSISTENT: @vesper/shared BARREL pulls server code into client
// bundles (038); revisit when the shared barrel is split (future 081 cleanup).
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: './global.css' });
