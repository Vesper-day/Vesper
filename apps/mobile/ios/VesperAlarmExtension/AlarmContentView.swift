// AlarmContentView.swift
//
// SwiftUI body of the Vesper alarm screen, hosted by the
// UNNotificationContentExtension (see NotificationViewController.swift). It
// renders the full-screen, edge-to-edge alarm surface shown above the system
// action buttons on the lock screen.
//
// IMPORTANT — button mechanics: the actual SNOOZE / STOP controls that the user
// taps are the system-rendered UNNotificationActions declared on the
// "vesperalarm" UNNotificationCategory (registered from RN in
// apps/mobile/lib/alarm.ts). They are what allow dismissal WITHOUT unlocking the
// device (isAuthenticationRequired:false). The two buttons drawn here are the
// edge-to-edge VISUAL affordances that mirror those actions; they are styled to
// fill the width per PRD §3.2. The Content Extension's
// UNNotificationExtensionDefaultContentHidden + custom view present this surface;
// the category actions sit directly beneath it.
//
// NOTE: This file is authored as committed text only. It is wired into the Xcode
// extension target in a Mac session — see docs/RUNBOOKS/IOS_ALARM_REBUILD.md.

import SwiftUI

struct AlarmContentView: View {
    /// The wake time to display, formatted "HH:mm" (local). Supplied by the host
    /// controller from the delivered notification; defaults to em dash if absent.
    var wakeTimeLabel: String = "—"

    // Espresso / cream design tokens (kept in sync by hand with @vesper/ui;
    // Swift cannot import the TS token package).
    private let espresso = Color(red: 0x1E / 255, green: 0x18 / 255, blue: 0x15 / 255)
    private let cream = Color(red: 0xF5 / 255, green: 0xEF / 255, blue: 0xE6 / 255)

    var body: some View {
        ZStack {
            espresso.ignoresSafeArea()

            VStack(spacing: 12) {
                Spacer()

                Text(wakeTimeLabel)
                    .font(.system(size: 64, weight: .light, design: .serif))
                    .foregroundColor(cream)

                Text("Good morning")
                    .font(.system(size: 18, weight: .regular, design: .serif))
                    .foregroundColor(cream.opacity(0.8))

                Spacer()

                // Edge-to-edge visual affordances. The dismiss-capable controls
                // are the category's UNNotificationActions beneath this view.
                VStack(spacing: 0) {
                    alarmButton(title: "Snooze", filled: false)
                    alarmButton(title: "Stop", filled: true)
                }
            }
        }
    }

    @ViewBuilder
    private func alarmButton(title: String, filled: Bool) -> some View {
        Text(title.uppercased())
            .font(.system(size: 17, weight: .semibold, design: .serif))
            .tracking(2)
            .foregroundColor(filled ? espresso : cream)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 22)
            .background(filled ? cream : Color.clear)
            .overlay(
                Rectangle()
                    .frame(height: 1)
                    .foregroundColor(cream.opacity(0.2)),
                alignment: .top
            )
    }
}
