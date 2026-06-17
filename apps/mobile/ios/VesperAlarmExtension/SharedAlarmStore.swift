// SharedAlarmStore.swift
//
// Single source of truth for the app-group identifier and the keys used to hand
// fired_at / latency from the Content Extension to the RN runtime. Both the
// extension (writer) and the future RN native bridge (reader — added in the Mac
// session) import these constants so the contract cannot drift.
//
// The app group "group.com.vesper.app" matches app.config.js
// (ios.entitlements['com.apple.security.application-groups']) and
// VesperAlarmExtension.entitlements.
//
// The RN reader is apps/mobile/lib/alarm.ts → getAlarmBridge()/consumeFiredHandoff;
// the native module backing it is DEFERRED to the Mac session
// (docs/RUNBOOKS/IOS_ALARM_REBUILD.md).
//
// NOTE: Authored as committed text only.

import Foundation

enum SharedAlarmStore {
    static let appGroupId = "group.com.vesper.app"

    enum Keys {
        static let firedAt = "vesper.alarm.firedAt"            // ISO-8601 string
        static let latencyFromTargetMs = "vesper.alarm.latencyFromTargetMs" // Int
    }

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    /// Called by the Content Extension at display time.
    static func writeFiredHandoff(firedAt: Date, latencyFromTargetMs: Int) {
        guard let defaults else { return }
        let iso = ISO8601DateFormatter().string(from: firedAt)
        defaults.set(iso, forKey: Keys.firedAt)
        defaults.set(latencyFromTargetMs, forKey: Keys.latencyFromTargetMs)
    }

    /// Read-and-clear, mirroring the RN bridge's consumeFiredHandoff() contract.
    static func consumeFiredHandoff() -> (firedAt: String, latencyFromTargetMs: Int)? {
        guard let defaults, let iso = defaults.string(forKey: Keys.firedAt) else { return nil }
        let latency = defaults.integer(forKey: Keys.latencyFromTargetMs)
        defaults.removeObject(forKey: Keys.firedAt)
        defaults.removeObject(forKey: Keys.latencyFromTargetMs)
        return (iso, latency)
    }
}
