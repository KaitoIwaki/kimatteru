import Foundation

/// アプリ全体のしくみ（下のタブ・文字の大きさ・ウィジェットへ渡すかの印）。
/// Web 版 App.jsx の onNavCal・onNavFree・onNavReport・onNavSettings・onFab・_readSystemLook・evScale・_pushWidget の写し
public enum SystemCore {
    /// 下のタブが受け持つ画面（Web 版でタブを出す 4 つ）。それ以外の画面は nil（いまのタブのまま）
    public static func rootTab(_ screen: JSONValue?) -> String? {
        switch screen?.string {
        case "month", "free", "report", "settings": return screen?.string
        default: return nil
        }
    }

    /// iPhone の本文の大きさ（標準 17pt）を、予定の字の倍率にする。標準なら 1。上げすぎると月表示が収まらないので 1.35 まで（0.05 刻み）
    public static func sysZoom(bodyPointSize: Double) -> Double {
        let px = (bodyPointSize.isFinite && bodyPointSize != 0) ? bodyPointSize : 17
        return max(1, min(1.35, JS.round((px / 17) * 20) / 20))
    }

    /// ウィジェットへ送り直すかの印。予定の中身・数・種類の数・週のはじまりが前と同じなら送らない（Web 版の _widgetStamp）。
    /// Web 版は「名前を隠す」を切り替えたときに印を消して送り直す。ここでは印に入れておくことで同じにする
    public static func widgetStamp(_ state: [String: JSONValue]) -> JSONValue {
        let events = state["events"]?.array ?? []
        let types = state["types"]?.array ?? []
        let cfg = state["settings"] ?? .null
        return .array([.array(events), .number(Double(events.count)), .number(Double(types.count)),
                       cfg["weekStart"] ?? .null, .bool(JS.truthy(cfg["hideTitles"]))])
    }
}

extension Engine {
    /// 下のタブを押した（"month" "free" "report" "settings"、右の「＋」は "add"）。
    /// カレンダーを見ているときにもう一度押すと、今日の月へ戻る（iPhone のカレンダーと同じ）
    public func navTab(_ tab: String) {
        switch tab {
        case "month":
            if state["screen"] == str("month") { goToday(); return }
            set(["screen": str("month"), "dayNum": .null, "detailId": .null])
        case "free":
            set(["screen": str("free")])
        case "report":
            set(["screen": str("report")])
        case "settings":
            set(["screen": str("settings"), "editTypeKey": .null, "setPage": .null])
        case "add":
            // 今月を見ているなら今日、別の月を見ているならその月の 1 日から始める
            let t = today
            let ym = state["ym"] ?? .null
            let same = JS.int(ym["y"]) == t.y && JS.int(ym["m"]) == t.m
            openNew(same ? t.d : 1, str("month"))
        default:
            break
        }
    }
}
