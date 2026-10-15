import Foundation
import UserNotifications
import LukkoKit

/// 通知の予約（Web 版 notify.js の syncReminders の写し）。予定か通知の設定が変わるたびに、予約を貼り直す
@MainActor
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Notifier()
    let center = UNUserNotificationCenter.current()
    /// 押されたとき（AppModel が Engine に渡す）
    var onTap: ((String?, String, String, [String: JSONValue]) -> Void)?

    func setUp() {
        center.delegate = self
        let undecided = UNNotificationCategory(identifier: "UNDECIDED", actions: [
            UNNotificationAction(identifier: "yes", title: "決まった", options: [.foreground]),
            UNNotificationAction(identifier: "no", title: "無くなった", options: [.foreground, .destructive]),
        ], intentIdentifiers: [])
        let worked = UNNotificationCategory(identifier: "WORKED", actions: [
            UNNotificationAction(identifier: "asplanned", title: "予定どおり記録する", options: [.foreground]),
            UNNotificationAction(identifier: "open", title: "開いて直す", options: [.foreground]),
        ], intentIdentifiers: [])
        center.setNotificationCategories([undecided, worked])
    }

    /// 既存の予約を消してから貼り直す。出すものがあるときだけ許可を聞く（起動しただけで許可を出さない）
    func sync(events: [JSONValue], settings: [String: JSONValue]) async {
        center.removeAllPendingNotificationRequests()
        let now = JSDate.local(Date().timeIntervalSince1970 * 1000, .current)
        let list = NotifyCore.buildSchedule(events.compactMap { $0.object }, settings, now: NotifyCore.LocalTime(now.y, now.m, now.d, now.h, now.min))
        if list.isEmpty { return }
        let st = await center.notificationSettings()
        if st.authorizationStatus == .notDetermined {
            guard (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) == true else { return }
        } else if st.authorizationStatus == .denied { return }
        var cal = Calendar(identifier: .gregorian); cal.timeZone = .current
        for n in list {
            let c = UNMutableNotificationContent()
            c.title = JS.string(n.title)
            c.body = n.body
            c.sound = .default
            var info: [String: Any] = [:]
            for (k, v) in n.extra { info[k] = JS.string(v) }
            c.userInfo = info
            if let a = n.actionTypeId { c.categoryIdentifier = a }
            let comps = DateComponents(year: n.at.y, month: n.at.m + 1, day: n.at.d, hour: n.at.h, minute: n.at.min)
            let req = UNNotificationRequest(identifier: String(n.id), content: c, trigger: UNCalendarNotificationTrigger(dateMatching: comps, repeats: false))
            try? await center.add(req)
        }
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        var extra: [String: JSONValue] = [:]
        for (k, v) in info { if let k = k as? String, let s = v as? String { extra[k] = .string(s) } }
        let action = response.actionIdentifier == UNNotificationDefaultActionIdentifier ? "tap" : response.actionIdentifier
        let eventId = extra["eventId"]?.string
        let kind = extra["kind"]?.string ?? "worked"
        guard eventId != nil || extra["kind"] != nil else { return }
        await MainActor.run { Notifier.shared.onTap?(eventId, kind, action, extra) }
    }
}
