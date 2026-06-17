// NotificationViewController.swift
//
// UNNotificationContentExtension principal class for the Vesper alarm. Hosts the
// SwiftUI AlarmContentView and — critically — stamps the fired_at hand-off into
// the shared app group when the custom UI is DISPLAYED.
//
// Why this is the fired_at site (and NOT a UNNotificationServiceExtension):
// a Service Extension only runs for REMOTE pushes carrying mutable-content; it
// is never invoked for a LOCAL scheduled notification, which is what the Vesper
// alarm is. The Content Extension's didReceive(_:) is the earliest reliable hook
// that runs when the alarm is actually shown, so it is where fired_at is
// recorded. See CHAT_059B_RESOLUTION_RECORD.md (RECORD 1): because didReceive
// fires at DISPLAY time, latency_from_target_ms measures target→shown, not
// target→delivery.
//
// The RN side reads/clears this hand-off on next foreground and emits the
// alarm_fired PostHog event (apps/mobile/lib/alarm.ts processAlarmFiredHandoff).
//
// NOTE: Authored as committed text only; wired into the Xcode target in a Mac
// session — see docs/RUNBOOKS/IOS_ALARM_REBUILD.md.

import UIKit
import SwiftUI
import UserNotifications
import UserNotificationsUI

final class NotificationViewController: UIViewController, UNNotificationContentExtension {
    private var hosting: UIHostingController<AlarmContentView>?

    override func viewDidLoad() {
        super.viewDidLoad()
        let controller = UIHostingController(rootView: AlarmContentView())
        addChild(controller)
        controller.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(controller.view)
        NSLayoutConstraint.activate([
            controller.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            controller.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            controller.view.topAnchor.constraint(equalTo: view.topAnchor),
            controller.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        controller.didMove(toParent: self)
        hosting = controller
    }

    func didReceive(_ notification: UNNotification) {
        // Stamp the fired hand-off at display time.
        let now = Date()
        let target = notification.request.trigger.flatMap { trigger -> Date? in
            (trigger as? UNCalendarNotificationTrigger)?.nextTriggerDate()
        } ?? now
        let latencyMs = Int(now.timeIntervalSince(target) * 1000)

        SharedAlarmStore.writeFiredHandoff(firedAt: now, latencyFromTargetMs: latencyMs)

        // Reflect the wake time in the UI.
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        hosting?.rootView = AlarmContentView(wakeTimeLabel: formatter.string(from: target))
    }
}
