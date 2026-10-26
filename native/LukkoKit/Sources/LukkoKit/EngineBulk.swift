import Foundation

/// 一覧で選んだ予定を、まとめて直す・消す（一覧と探すの「選択」）。
/// どちらも 5 秒の「元に戻す」を出す。消した予定は「最近消した予定」にも入る（30 日）
extension Engine {
    /// 選んだ予定を、全部同じ時間（start〜end）にする。直し方は予定の画面で時間を直したときと同じ：
    /// 働いた記録は「終わり」を actualEnd に、ほかは end に入れる。終日の予定は時間のある 1 日の予定になる
    public func bulkSetTime(_ ids: [JSONValue], start: String, end: String) {
        let pick = Set(ids.compactMap { $0.string })
        let hit = events.filter { pick.contains(JS.string($0["id"])) }
        guard !hit.isEmpty, start != end else { return }
        haptic("success")
        var prev: Obj = [:]
        for e in hit { prev[JS.string(e["id"])] = .object(e) }
        set(["events": eventsArray(events.map { e in
            guard pick.contains(JS.string(e["id"])) else { return e }
            var r = Self.with(e, ["start": str(start), "allDay": .bool(false), "days": nil, "updatedAt": num(now)])
            if e["status"] == str("jisseki") { r["actualEnd"] = str(end) } else { r = Self.with(r, ["end": str(end), "actualEnd": nil]) }
            return r
        })])
        showUndo("\(hit.count)件を \(start)〜\(end) にしました", .object(["kind": str("full"), "prev": .object(prev)]))
    }

    /// 選んだ予定をまとめて消す（最近消した予定へ）
    public func bulkDelete(_ ids: [JSONValue]) {
        let pick = Set(ids.compactMap { $0.string })
        let removed = events.filter { pick.contains(JS.string($0["id"])) }
        guard !removed.isEmpty else { return }
        haptic("light")
        // 一度にたくさん消しても、今消した分は全部「最近消した予定」に入れる（元に戻すのに要る）
        let trash = Array((removed.map { JSONValue.object(["ev": .object($0), "at": num(now)]) } + (state["trash"]?.array ?? [])).prefix(max(400, removed.count)))
        let detailId = state["detailId"]
        set(["events": eventsArray(events.filter { !pick.contains(JS.string($0["id"])) }), "trash": .array(trash), "swipeRow": .null,
             "detailId": pick.contains(JS.string(detailId)) ? .null : detailId])
        showUndo(removed.count > 1 ? "\(removed.count)件を削除しました" : "「\(JS.string(removed[0]["title"]))」を削除しました",
                 .object(["kind": str("del"), "ids": .array(removed.map { $0["id"] ?? .null })]))
    }

    /// 元に戻す（kind "full"）：直す前の予定をそのまま戻す
    func undoFull(_ prev: Obj) {
        set(["events": eventsArray(events.map { e in
            guard case .object(let p)? = prev[JS.string(e["id"])] else { return e }
            return Self.with(p, ["updatedAt": num(now)])
        })])
    }
}
