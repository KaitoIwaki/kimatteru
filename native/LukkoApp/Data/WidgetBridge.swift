import Foundation
import WidgetKit
import LukkoKit

/// ウィジェットへの受け渡し（いまの版の WidgetBridge.swift・widgetbridge.js の写し）。
///
/// ウィジェットは別のプログラムなので、App Group という共有の置き場に JSON を書き、ウィジェットがそれを読む。
/// 置き場の名前（group.com.kimatteru.app）とキー（widget）は、いまの版・ウィジェット・entitlements の 4 か所でそろえる。
/// 1 か所でも違うと、エラーにならずに黙って届かなくなる。
enum WidgetBridge {
    static let appGroup = "group.com.kimatteru.app"
    static let storeKey = "widget"

    /// 渡した結果（設定の診断で見る）
    struct Result: Equatable {
        var ok: Bool
        var size = 0
        var days = 0
        var why = ""
    }

    /// いまの予定をウィジェットへ渡す。失敗しても投げない（ウィジェットが古いままより、予定の保存が止まるほうがずっと困る）
    @discardableResult
    static func push(_ state: [String: JSONValue], now: Date = Date()) -> Result {
        let ms = (now.timeIntervalSince1970 * 1000).rounded(.down)
        let t = JSDate.local(ms, .current)
        let payload = WidgetCore.buildPayload(state, today: (t.y, t.m, t.d), atMs: ms)
        let json = JSJSON.stringify(payload)
        // suiteName が App Group として登録されていないと nil になる（たいていは entitlements の付け忘れか名前違い）
        guard let store = UserDefaults(suiteName: appGroup) else {
            return Result(ok: false, why: "共有の置き場を開けませんでした（App Group の名前を確かめてください）")
        }
        store.set(json, forKey: storeKey)
        // 描き直させる。呼ばないと、iOS の都合のいい時間まで古いまま（呼んでもすぐとは限らない）
        WidgetCenter.shared.reloadAllTimelines()
        return Result(ok: true, size: json.utf16.count, days: payload["days"]?.object?.count ?? 0)
    }
}
