import Foundation

/// 点線の予定の「決める期限」（2.3）。
///
/// 点線で置いたまま返事を待っているうちに、気づいたら前日、を防ぐ。期限の日の朝 9 時に、まだ点線なら知らせる。
/// 保存の形：予定に `askBy: {y, m, d}`（m は 0 始まり）。点線の予定でだけ使い、決まった・無くなった予定では読まない。
/// 古い版はこの項目を知らないので、読まずに残す（消さない）
public enum AskBy {
    public static let notifyHour = 9

    /// 決める期限。点線の予定で、正しい日付のときだけ
    public static func date(_ o: [String: JSONValue]) -> (y: Int, m: Int, d: Int)? {
        guard JS.string(o["status"]) == "mikakutei", let a = o["askBy"]?.object,
              case .number(let y)? = a["y"], case .number(let m)? = a["m"], case .number(let d)? = a["d"],
              y.isFinite, m.isFinite, d.isFinite, y > 1900, y < 3000, m >= 0, m < 12, d >= 1, d <= 31 else { return nil }
        return Civil.fromDayNo(Civil.dayNo(Int(y), Int(m), Int(d)))
    }

    public static func object(_ d: (y: Int, m: Int, d: Int)) -> JSONValue {
        .object(["y": .number(Double(d.y)), "m": .number(Double(d.m)), "d": .number(Double(d.d))])
    }

    /// 「11月21日（金）」
    public static func label(_ d: (y: Int, m: Int, d: Int)) -> String {
        "\(d.m + 1)月\(d.d)日（\(FormCore.dow[Civil.weekday(d.y, d.m, d.d)])）"
    }

    public struct Choice: Equatable {
        public var key: String, label: String
        public var y: Int, m: Int, d: Int
    }

    /// 選べる期限。今日より後で、予定の日より前のものだけ（日にち未定なら、予定の日は問わない）
    public static func choices(today t: (y: Int, m: Int, d: Int), event: (y: Int, m: Int, d: Int)?) -> [Choice] {
        let tn = Civil.dayNo(t.y, t.m, t.d)
        let en = event.map { Civil.dayNo($0.y, $0.m, $0.d) }
        var raw: [(String, String, Int)] = [("tomorrow", "明日", tn + 1), ("3d", "3日後", tn + 3), ("1w", "1週間後", tn + 7)]
        if let en { raw.append(("eve", "予定の前日", en - 1)) }
        var out: [Choice] = []
        for (k, l, n) in raw where n > tn && (en == nil || n < en!) && !out.contains(where: { Civil.dayNo($0.y, $0.m, $0.d) == n }) {
            let c = Civil.fromDayNo(n)
            out.append(Choice(key: k, label: l, y: c.y, m: c.m, d: c.d))
        }
        return out
    }
}

extension Engine {
    /// 予定を作る画面の「決める期限」の丸。同じものを押すと外す。nil で外す
    public func setAskBy(_ key: String?) {
        haptic("light")
        let dr = draftObj
        guard let key, let c = askChoices(dr).first(where: { $0.key == key }) else { patchDraft(["askBy": nil]); return }
        if let cur = AskBy.date(dr), cur == (c.y, c.m, c.d) { patchDraft(["askBy": nil]); return }
        patchDraft(["askBy": AskBy.object((c.y, c.m, c.d))])
    }

    func askChoices(_ dr: Obj) -> [AskBy.Choice] {
        let someday = JS.truthy(dr["someday"])
        let ev: (y: Int, m: Int, d: Int)? = someday ? nil : (JS.int(dr["y"]), JS.int(dr["m"]), JS.int(dr["day"]))
        return AskBy.choices(today: today, event: ev)
    }

    /// 予定を作る画面に出す中身
    func fillAskBy(_ v: inout FormView, _ dr: Obj) {
        v.askShown = JS.string(dr["status"]) == "mikakutei"
        guard v.askShown else { return }
        v.askOpen = dr["picking"] == "askBy"
        let cur = AskBy.date(dr)
        v.askValue = cur.map { AskBy.label($0) } ?? "なし"
        v.askChips = [.init(key: .null, label: "なし", sel: cur == nil)] + askChoices(dr).map { c in
            .init(key: .string(c.key), label: c.label, sel: cur.map { $0 == (c.y, c.m, c.d) } ?? false)
        }
        v.askNote = cur.map { "\(AskBy.label($0))の朝\(AskBy.notifyHour)時に、まだ決まっていなければお知らせします" } ?? "期限の日の朝に、まだ決まっていなければお知らせします"
    }

    /// 予定の詳細に出す一行
    func askByText(_ ev: Obj) -> (text: String, late: Bool) {
        guard let d = AskBy.date(ev) else { return ("", false) }
        let t = today
        if Civil.dayNo(d.y, d.m, d.d) < Civil.dayNo(t.y, t.m, t.d) { return ("決める期限を過ぎています（\(AskBy.label(d))）", true) }
        return ("\(AskBy.label(d))までに決める", false)
    }
}
