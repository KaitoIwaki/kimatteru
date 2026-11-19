import Foundation

/// ウィジェットから「決まった」にする（2.4）。
///
/// ウィジェットのボタンは、共有の置き場（App Group）に「この予定が決まった」という頼みを書くだけ。
/// 予定のファイルを書き換えるのはアプリだけにしておく（ウィジェットとアプリと iCloud 同期が同時に書いて、予定が消えないように）。
/// アプリを開いたときに頼みを読んで、ここで反映する
public enum WidgetConfirm {
    /// 共有の置き場のキー。中身は "<押した時刻のミリ秒>|<予定の id>" の並び
    public static let key = "widgetConfirms"
    public static let maxKept = 50

    public static func entry(id: String, atMs: Double) -> String { "\(Int(atMs))|\(id)" }
    /// 頼みから予定の id を取り出す（形の崩れたものは捨てる）
    public static func ids(_ entries: [String]) -> [String] {
        entries.compactMap { s in
            guard let bar = s.firstIndex(of: "|") else { return nil }
            let id = String(s[s.index(after: bar)...])
            return id.isEmpty ? nil : id
        }
    }
}

extension Engine {
    /// ウィジェットで押された「決まった」を反映する（まだ点線の予定だけ）。反映した数。元に戻すも出す
    @discardableResult
    public func applyWidgetConfirms(_ ids: [String]) -> Int {
        let pick = Set(ids)
        let hit = events.filter { pick.contains(JS.string($0["id"])) && $0["status"] == "mikakutei" }
        guard !hit.isEmpty else { return 0 }
        var prev: Obj = [:]
        for e in hit { prev[JS.string(e["id"])] = .object(e) }
        set(["events": eventsArray(events.map { e in
            guard pick.contains(JS.string(e["id"])), e["status"] == "mikakutei" else { return e }
            return Self.with(e, ["status": "kakutei", "updatedAt": num(now)])
        })])
        let t = JS.string(hit[0]["title"])
        showUndo(hit.count == 1 ? "ウィジェットで「\(t.isEmpty ? "予定" : t)」が決まりました" : "ウィジェットで\(hit.count)件が決まりました",
                 .object(["kind": str("full"), "prev": .object(prev)]))
        return hit.count
    }
}
