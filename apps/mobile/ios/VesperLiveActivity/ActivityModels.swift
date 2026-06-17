// GENERATED — DO NOT EDIT.
// Source of truth: packages/shared/src/liveActivity/schema.json
// Regenerate: pnpm gen:live-activity-types
//
// Authored as committed text only; the VesperLiveActivity target is created and
// wired into the Xcode project in a Mac session — see
// docs/RUNBOOKS/IOS_WIDGET_REBUILD.md.

import ActivityKit
import Foundation

struct VesperBlockAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Block UUID (matches the static attribute).
        var blockId: String
        // Module slug, e.g. "fitness". Plain string — NOT coupled to BlockTypeSchema.
        var blockType: String
        // Block title shown in the expanded view.
        var title: String
        // 2-char module abbreviation, e.g. "GY".
        var abbreviation: String
        // ISO8601 block end; parsed on-device to render the countdown.
        var endTime: String
        // Server hint; the device recomputes from endTime each minute.
        var minutesRemaining: Int
        // Nullable — title of the next block, when pre-armed.
        var nextBlockTitle: String?
        // Nullable — ISO8601 start of the next block, when pre-armed.
        var nextBlockStart: String?
    }

    // Static attribute — the block UUID this activity tracks.
    var blockId: String
}
