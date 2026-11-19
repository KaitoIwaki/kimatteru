import Foundation

/// 候補日をまとめて見る（2.3）。予定の詳細の「候補をカレンダーで見る」から、月の画面で同じ候補の予定だけを目立たせ、ほかを薄くする。
/// 保存しない（アプリを開き直したら消える）。候補が全部片づいたら（まだの候補が無くなったら）自然に消える
extension Engine {
    public struct CandFocus: Equatable {
        public var title: String
        public var ids: Set<String>
    }

    /// 今まとめて見ている候補。無ければ nil
    public func candFocus() -> CandFocus? {
        guard let cid = state["candFocus"], JS.truthy(cid) else { return nil }
        let g = events.filter { $0["candId"] == cid && $0["status"] == "mikakutei" }
        guard !g.isEmpty else { return nil }
        let title = JS.string(g.first?["title"])
        return CandFocus(title: title.isEmpty ? "予定" : title, ids: Set(g.map { JS.string($0["id"]) }))
    }

    /// 詳細から：その予定の候補を月の画面でまとめて見る（いちばん早い候補の月へ）
    public func focusCandidates(_ id: JSONValue?) {
        guard let ev = events.first(where: { $0["id"] == id }), let cid = ev["candId"], JS.truthy(cid) else { return }
        haptic("light")
        let g = events.filter { $0["candId"] == cid }.sorted { AppCore.evFrom($0) < AppCore.evFrom($1) }
        let first = g.first ?? ev
        set(["candFocus": cid, "screen": "month", "detailId": .null, "dayNum": .null,
             "ym": ["y": first["y"] ?? .null, "m": first["m"] ?? .null]])
    }

    public func clearCandFocus() { haptic("light"); set(["candFocus": nil]) }
}
