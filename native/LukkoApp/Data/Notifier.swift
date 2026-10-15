import Foundation
import UserNotifications
import LukkoKit

/// 通知の予約（Web 版 notify.js の syncReminders の写し）。予定か通知の設定が変わるたびに、予約を貼り直す
@MainActor
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
    static let shared = Notifier()
    let center = UNUserNotificationCenter.current()
    /// 押されたとき（AppModel が Engine に渡す）。中身を読み終える前に押されたぶんは、渡せるようになってから渡す
    var onTap: ((String?, String, String, [String: JSONValue]) -> Void)? {
        didSet {
            guard let onTap else { return }
            let list = pending
            pending = []
            for p in list { onTap(p.id, p.kind, p.action, p.extra) }
        }
    }
    private var pending: [(id: String?, kind: String, action: String, extra: [String: JSONValue])] = []
    private var categoriesSet = false
    /// 貼り直しは 1 つずつ（前の貼り直しの途中で次が始まると、消したあとに古い予約が残ることがある）
    private var running: Task<Void, Never>?

    /// 起動のいちばん初め（AppDelegate）で呼ぶ。通知を押してアプリが開いたときの知らせは、ここで受け取る役を決めておかないと届かない
    func attach() {
        center.delegate = self
    }

    func setUp() {
        center.delegate = self
        guard !categoriesSet else { return }
        categoriesSet = true
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
        let prev = running
        let task = Task { @MainActor in
            await prev?.value
            await self.apply(events: events, settings: settings)
        }
        running = task
        await task.value
    }

    private func apply(events: [JSONValue], settings: [String: JSONValue]) async {
        center.removeAllPendingNotificationRequests()
        let now = JSDate.local(Date().timeIntervalSince1970 * 1000, .current)
        let list = NotifyCore.buildSchedule(events.compactMap { $0.object }, settings, now: NotifyCore.LocalTime(now.y, now.m, now.d, now.h, now.min))
        if list.isEmpty { return }
        // 許可を聞くのはここだけ。説明の画面を挟まずに、iPhone の許可の画面を出す（5.1.1(iv)）
        let st = await center.notificationSettings()
        if st.authorizationStatus == .notDetermined {
            guard (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) == true else { return }
        } else if st.authorizationStatus == .denied { return }
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

    /// 通知の中身から、予定の id と種類を読む。いまの版（Capacitor）が予約した通知は、中身が cap_extra／extra の中に入っている
    nonisolated static func extra(_ info: [AnyHashable: Any]) -> [String: JSONValue] {
        var out: [String: JSONValue] = [:]
        func take(_ d: [AnyHashable: Any]) {
            for (k, v) in d {
                guard let k = k as? String else { continue }
                if let s = v as? String { out[k] = .string(s) }
                else if let n = v as? NSNumber { out[k] = .string(n.stringValue) }
            }
        }
        for key in ["cap_extra", "extra"] { if let d = info[key] as? [AnyHashable: Any] { take(d) } }
        take(info)
        return out
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let extra = Notifier.extra(response.notification.request.content.userInfo)
        let action = response.actionIdentifier == UNNotificationDefaultActionIdentifier ? "tap" : response.actionIdentifier
        let eventId = extra["eventId"]?.string
        let kind = extra["kind"]?.string ?? "worked"
        guard eventId != nil || extra["kind"] != nil else { return }
        await MainActor.run { Notifier.shared.deliver(eventId, kind, action, extra) }
    }

    private func deliver(_ id: String?, _ kind: String, _ action: String, _ extra: [String: JSONValue]) {
        if let onTap { onTap(id, kind, action, extra) } else { pending.append((id, kind, action, extra)) }
    }
}
