import Foundation

/// 予定を別の日へ動かす（月の画面で帯を長押しして、別の日に置く）。
/// 時刻・何日間・お知らせはそのまま、始まりの日だけを変える。5 秒の「元に戻す」を出す。
/// 動かせるのは、決まった予定と点線の予定だけ（働いた記録と、無くなった予定は動かさない）
extension Engine {
    public static let dragPrefix = "lukko-event:"

    public func canMove(_ ev: Obj) -> Bool {
        let st = JS.string(ev["status"])
        return st == "kakutei" || st == "mikakutei"
    }

    public func moveEvent(_ id: JSONValue?, to y: Int, _ m: Int, _ d: Int) {
        guard let ev = events.first(where: { $0["id"] == id }), canMove(ev) else { return }
        let to = Civil.dayNo(y, m, d)
        guard to != AppCore.evFrom(ev) else { return }
        haptic("success")
        let c = Civil.fromDayNo(to)
        let key = JS.string(ev["id"])
        set(["events": eventsArray(events.map { e in
            guard JS.string(e["id"]) == key else { return e }
            return Self.with(e, ["y": num(Double(c.y)), "m": num(Double(c.m)), "day": num(Double(c.d)), "updatedAt": num(now)])
        })])
        let title = JS.string(ev["title"])
        showUndo("「\(title.isEmpty ? "予定" : title)」を\(c.m + 1)月\(c.d)日に動かしました", .object(["kind": str("full"), "prev": .object([key: .object(ev)])]))
    }

    /// 運んできた文字から、予定の id を取り出す（ほかのアプリから運ばれた文字は受け取らない）
    public static func draggedId(_ items: [String]) -> String? {
        items.first { $0.hasPrefix(dragPrefix) }.map { String($0.dropFirst(dragPrefix.count)) }
    }
}

extension Engine {
    /// 長押しで運べる予定の id
    public func movableIds() -> [String] { events.filter { canMove($0) }.map { JS.string($0["id"]) } }
}
