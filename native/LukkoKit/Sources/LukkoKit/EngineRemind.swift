import Foundation

/// 予定のお知らせを 2 つまで（2.2）。
///
/// 保存の形：今までの `remindMin` は残し、2 つ目を `remindMin2` に入れる。保存のときは近いほう（小さいほう）を `remindMin`、遠いほうを `remindMin2` にする。
/// 古い版は `remindMin2` を知らないので、1 つ目（始まりに近いほう）だけが鳴る。
/// 古い版が「なし」にしたり終日に切り替えたりしても `remindMin2` は残るので、読む側で確かめてから使う（`second`）
public enum RemindPair {
    /// 選べる値（終日と時刻ありで違う）
    public static func options(allDay: Bool) -> [(JSONValue, String)] { allDay ? FormCore.remindAllDay : FormCore.remindTimed }

    /// 2 つ目のお知らせ。1 つ目があり、それと違い、今の終日／時刻ありの選択肢に入っているときだけ
    public static func second(_ o: [String: JSONValue]) -> Double? {
        guard case .number(let a)? = o["remindMin"], a >= 0, case .number(let b)? = o["remindMin2"], b >= 0, b != a else { return nil }
        let ok = options(allDay: JS.truthy(o["allDay"])).compactMap { $0.0.number }
        return ok.contains(b) ? b : nil
    }

    /// 保存する 2 つの項目（近いほう・遠いほう）。2 つ目が無ければ、2 つ目は nil（項目ごと消す）
    public static func fields(_ dr: [String: JSONValue]) -> (JSONValue?, JSONValue?) {
        guard let a = dr["remindMin"]?.number else { return (nil, nil) }
        guard let b = second(dr) else { return (.number(a), nil) }
        return (.number(min(a, b)), .number(max(a, b)))
    }

    /// 選んでいる値（遠い順：前日・1時間前）
    public static func picked(_ o: [String: JSONValue]) -> [Double] {
        guard case .number(let a)? = o["remindMin"], a >= 0 else { return [] }
        if let b = second(o) { return [max(a, b), min(a, b)] }
        return [a]
    }

    /// 選択肢の名前で並べる（「前日・1時間前」）
    public static func labels(_ o: [String: JSONValue]) -> [String] {
        let opts = options(allDay: JS.truthy(o["allDay"]))
        return picked(o).map { v in opts.first { $0.0.number == v }?.1 ?? AppCore.remindWord(v, o["allDay"]) }
    }
}

extension AppCore {
    /// 選択肢に無い値の名前（remindLabel と同じ言い方）
    static func remindWord(_ m: Double, _ allDay: JSONValue?) -> String {
        if JS.truthy(allDay) { return m == 0 ? "当日の朝" : JS.numberToString(m / 1440) + "日前" }
        if m >= 1440 { return JS.numberToString(m / 1440) + "日前" }
        if m >= 60 { return JS.numberToString(JS.round(m / 60)) + "時間前" }
        return JS.numberToString(m) + "分前"
    }
}

extension Engine {
    /// お知らせの丸を押す：付ける・外す。2 つ付いているときに 3 つ目を押すと、先に付けたほうが外れる。「なし」で全部外す
    public func toggleRemind(_ val: JSONValue) {
        haptic("light")
        let dr = draftObj
        guard case .number(let v) = val else { patchDraft(["remindMin": .null, "remindMin2": nil]); return }
        var cur: [Double] = []   // 付けた順
        if case .number(let a)? = dr["remindMin"], a >= 0 { cur.append(a) }
        if !cur.isEmpty, let b = RemindPair.second(dr) { cur.append(b) }
        if let i = cur.firstIndex(of: v) { cur.remove(at: i) } else { cur.append(v); if cur.count > 2 { cur.removeFirst() } }
        patchDraft(["remindMin": cur.first.map { .number($0) } ?? .null, "remindMin2": cur.count > 1 ? .number(cur[1]) : nil])
    }
}
