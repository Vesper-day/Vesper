// VesperLiveActivityBundle.swift
//
// @main entry point for the VesperLiveActivity widget extension. Declares the
// WidgetBundle and a single placeholder ActivityConfiguration bound to the
// generated `VesperBlockAttributes` (ActivityModels.swift). The real Dynamic
// Island / lock-screen surfaces and design tokens (Fraunces, JetBrains Mono,
// bronze/cream, the compact-leading/trailing/expanded regions per TECHNICAL_SPEC
// §7) are OUT OF SCOPE here — they land in chat 078. See the TODO(078) markers.
//
// Authored as committed text only; the VesperLiveActivity target is created and
// wired into the Xcode project in a Mac session — see
// docs/RUNBOOKS/IOS_WIDGET_REBUILD.md. This file does not build on Windows.

import ActivityKit
import SwiftUI
import WidgetKit

@main
struct VesperLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        VesperBlockLiveActivity()
    }
}

// Placeholder Live Activity configuration. The closures below render trivial
// text so the target compiles once wired on a Mac; chat 078 replaces them with
// the real SwiftUI views and design tokens.
struct VesperBlockLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: VesperBlockAttributes.self) { context in
            // TODO(078): lock-screen / banner presentation. Placeholder only.
            VStack(alignment: .leading) {
                Text(context.state.title)
                Text("\(context.state.minutesRemaining) min")
            }
            .padding()
        } dynamicIsland: { context in
            // TODO(078): real compact-leading (abbreviation + module icon),
            // compact-trailing (countdown / radial arc), and expanded regions
            // (title, end time, Mark complete / Reschedule, next-block strip).
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.abbreviation)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.minutesRemaining)m")
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.title)
                }
            } compactLeading: {
                Text(context.state.abbreviation)
            } compactTrailing: {
                Text("\(context.state.minutesRemaining)m")
            } minimal: {
                Text(context.state.abbreviation)
            }
        }
    }
}
