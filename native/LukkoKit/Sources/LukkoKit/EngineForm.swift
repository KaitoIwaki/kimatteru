import Foundation

/// 新しい予定／予定を編集の画面で押すもの（Web 版 renderVals の NEW の on〜 の写し）
extension Engine {
    func patchDraft(_ p: [String: JSONValue?]) { set(["draft": .object(Self.with(draftObj, p))]) }
    var pickYM: (y: Int, m: Int) {
        let dr = draftObj
        let y = (dr["pickY"] == nil || dr["pickY"] == .null) ? Int(JS.number(dr["y"])) : Int(JS.number(dr["pickY"]))
        let m = (dr["pickM"] == nil || dr["pickM"] == .null) ? Int(JS.number(dr["m"])) : Int(JS.number(dr["pickM"]))
        return (y, m)
    }

    /// 文字の欄（題名・場所・メモ・リンク）
    public func setDraftText(_ k: String, _ val: String) { patchDraft([k: .string(val)]) }

    /// よく入れる予定を押した：題名・種類・時刻・場所・リンク・勤務先・お知らせを前回と同じに
    public func applySuggest(_ i: Int) {
        let list = suggestList()
        guard i >= 0, i < list.count else { return }
        let e = list[i]
        haptic("light")
        let dr = draftObj
        var p: [String: JSONValue?] = ["title": e["title"], "type": e["type"], "place": JS.or(e["place"], ""), "memo": "", "link": JS.or(e["link"], ""),
                                       "jobId": JS.or(e["jobId"], dr["jobId"]), "remindMin": e["remindMin"]?.number != nil ? e["remindMin"] : dr["remindMin"]]
        if JS.truthy(e["allDay"]) { p["allDay"] = true } else { p["allDay"] = false; p["start"] = e["start"]; p["end"] = e["end"] }
        var added: [JSONValue] = []
        for x in (dr["added"]?.array ?? []) + (JS.truthy(e["place"]) ? ["place"] : []) + (JS.truthy(e["link"]) ? ["link"] : []) where !added.contains(x) { added.append(x) }
        p["added"] = .array(added)
        patchDraft(p)
    }
    /// 長さのボタン（終わり＝開始＋長さ）
    public func setDuration(_ m: Double) {
        haptic("light")
        patchDraft(["end": .string(core().addMin(JS.string(draftObj["start"]), m)), "picking": .null])
    }
    public func toggleCand() { haptic("light"); patchDraft(["cand": .bool(!JS.truthy(draftObj["cand"]))]) }
    public func toggleSecret() { haptic("light"); patchDraft(["secret": .bool(!JS.truthy(draftObj["secret"]))]) }
    /// 日にちをまだ決めない（同じものを押すとオフ。どちらにしても「まだ」にする）
    public func setSomeday(_ w: String) {
        haptic("light")
        patchDraft(["someday": draftObj["someday"] == .string(w) ? .null : .string(w), "status": "mikakutei", "picking": .null, "extraDays": []])
    }
    public func setStatus(_ k: String) { patchDraft(["status": .string(k)]) }

    // MARK: 日にちえらび
    /// 日にちの行（開くと、表示月を予定の月に戻す）
    public func tapDate() {
        let dr = draftObj
        patchDraft(["picking": dr["picking"] == "date" ? .null : "date", "pickY": dr["y"], "pickM": dr["m"], "pickedOnce": false, "pickYM": false])
    }
    public func shiftPick(_ n: Int) {
        let p = pickYM
        let o = Self.shiftMonth(["y": .number(Double(p.y)), "m": .number(Double(p.m))], n)
        patchDraft(["pickY": o["y"], "pickM": o["m"]])
    }
    public func tapYM() { haptic("light"); patchDraft(["pickYM": .bool(!JS.truthy(draftObj["pickYM"]))]) }
    public func shiftPickYear(_ n: Int) { patchDraft(["pickY": .number(Double(pickYM.y + n))]) }
    public func pickMonth(_ i: Int) { haptic("light"); patchDraft(["pickM": .number(Double(i)), "pickYM": false]) }
    /// 押した日だけを予定の日にする（複数日は外す）。もう予定の日なら何もしない
    public func pickDay(_ d: Int) {
        let p = pickYM, dr = draftObj
        if dr["y"] == .number(Double(p.y)) && dr["m"] == .number(Double(p.m)) && dr["day"] == .number(Double(d)) { return }
        haptic("light")
        patchDraft(["y": .number(Double(p.y)), "m": .number(Double(p.m)), "day": .number(Double(d)), "extraDays": [], "pickedOnce": true])
    }
    public func clearExtraDays() { patchDraft(["extraDays": []]) }

    // MARK: その場で勤務先を足す
    public func setNewJobName(_ s: String) { if let nj = state["newJob"]?.object { set(["newJob": .object(Self.with(nj, ["name": .string(s)]))]) } }
    /// 時給の欄（数字以外は捨てる。空なら 0、上限 99999）
    public func setNewJobHourly(_ s: String) {
        guard let nj = state["newJob"]?.object else { return }
        let digits = s.unicodeScalars.filter { $0.value >= 0x30 && $0.value <= 0x39 }
        let n = Double(String(String.UnicodeScalarView(digits)))
        set(["newJob": .object(Self.with(nj, ["hourly": .number(n.map { min(99999, $0) } ?? 0)]))])
    }
    public func bumpNewJobHourly(_ d: Double) {
        guard let nj = state["newJob"]?.object else { return }
        let h = JS.number(nj["hourly"]) + d
        set(["newJob": .object(Self.with(nj, ["hourly": .number(d < 0 ? max(0, h) : h)]))])
    }

    // MARK: 終日・何日間
    /// 終日の切り替え。選べるお知らせが違うので、当てはまらない値は「なし」に戻す
    public func toggleAllDay() {
        haptic("light")
        let dr = draftObj
        let allDay = !JS.truthy(dr["allDay"])
        let ok: [Double] = allDay ? [0, 1440] : [10, 30, 60, 1440]
        let keep: JSONValue = (dr["remindMin"]?.number).map { ok.contains($0) ? .number($0) : .null } ?? .null
        patchDraft(["allDay": .bool(allDay), "remindMin": keep, "picking": .null])
    }
    public func bumpSpan(_ d: Int) {
        haptic("light")
        let v = Int(JS.toInt32(draftObj["days"]))
        let cur = max(1, min(60, v != 0 ? v : 1)), next = cur + d
        if next < 1 || next > 60 { return }
        patchDraft(["days": .number(Double(next))])
    }

    // MARK: 行にたたむ・＋で足す
    /// 行を開く／閉じる（開けるのは一度に一つ）
    public func openRow(_ key: String) { haptic("light"); patchDraft(["picking": draftObj["picking"] == .string(key) ? .null : .string(key)]) }
    /// 時刻の行（触覚なし）
    public func tapTimeRow(_ field: String) { patchDraft(["picking": draftObj["picking"] == .string(field) ? .null : .string(field)]) }
    public func addRow(_ key: String) {
        haptic("light")
        patchDraft(["added": .array((draftObj["added"]?.array ?? []) + [.string(key)]), "picking": .string(key)])
    }
    /// ✕：行を消し、値も捨てる
    public func dropRow(_ key: String) {
        haptic("light")
        let clear: [String: JSONValue?] = key == "rep" ? ["repEvery": .null, "repDows": []] : key == "multi" ? ["extraDays": []]
            : key == "place" ? ["place": ""] : key == "memo" ? ["memo": ""] : key == "link" ? ["link": ""] : [:]
        let dr = draftObj
        var p = clear
        p["added"] = .array((dr["added"]?.array ?? []).filter { $0 != .string(key) })
        p["picking"] = dr["picking"] == .string(key) ? .null : (dr["picking"] ?? nil)
        patchDraft(p)
    }
    /// 複数日の行（開くと表示月を予定の月へ）
    public func tapMultiRow() {
        haptic("light")
        let dr = draftObj
        patchDraft(["picking": dr["picking"] == "multi" ? .null : "multi", "pickY": dr["y"], "pickM": dr["m"], "pickYM": false])
    }
    public func clearMulti() { haptic("light"); patchDraft(["extraDays": []]) }

    // MARK: くり返し
    public func setRepEvery(_ key: JSONValue) {
        haptic("light")
        let list = FormCore.spansFor(key)
        let cur = Int(JS.toInt32(draftObj["repSpan"]))
        let keep = list.contains { $0.m == cur }
        patchDraft(["repEvery": key, "repSpan": keep ? draftObj["repSpan"] : .number(Double(list[min(1, list.count - 1)].m))])
    }
    public func toggleRepNth(_ k: Int) {
        haptic("light")
        let dr = draftObj
        let myNth = min(5, (Int(JS.number(dr["day"])) - 1) / 7 + 1)
        let cur = (dr["repNth"]?.array ?? [])
        let base: [JSONValue] = cur.isEmpty ? [.number(Double(myNth))] : cur
        let kk = JSONValue.number(Double(k))
        let next = base.contains(kk) ? base.filter { $0 != kk } : base + [kk]
        patchDraft(["repNth": .array(next.isEmpty ? base : next)])
    }
    public func toggleRepDow(_ i: Int) {
        haptic("light")
        let dr = draftObj
        let myDow = Civil.weekday(Int(JS.number(dr["y"])), Int(JS.number(dr["m"])), Int(JS.number(dr["day"])))
        let cur = dr["repDows"]?.array ?? []
        let base: [JSONValue] = cur.isEmpty ? [.number(Double(myDow))] : cur
        let ii = JSONValue.number(Double(i))
        let next = base.contains(ii) ? base.filter { $0 != ii } : base + [ii]
        patchDraft(["repDows": .array(next.isEmpty ? base : next)])
    }
    public func setRepSpan(_ m: Int) { haptic("light"); patchDraft(["repSpan": .number(Double(m))]) }

    // MARK: お知らせ・時刻・種類
    public func setRemind(_ val: JSONValue) { haptic("light"); patchDraft(["remindMin": val]) }

    /// 時刻のドラム。開始を動かしたら、終わりも同じだけ動かす（長さを保つ）
    public func setWheel(_ field: String, unit: String, index idx: Int) {
        let dr = draftObj
        let parts = JS.string(dr[field]).components(separatedBy: ":").map { JS.number($0) }
        var h = parts.count > 0 ? parts[0] : .nan, m = parts.count > 1 ? parts[1] : .nan
        if unit == "h" { h = Double(min(23, max(0, idx))) } else { m = Double(min(55, max(0, idx * 5))) }
        func two(_ x: Double) -> String { let s = JS.numberToString(x); return s.count >= 2 ? s : String(repeating: "0", count: 2 - s.count) + s }
        let nv = two(h) + ":" + two(m)
        if dr[field] == .string(nv) { return }
        if field != "start" { patchDraft([field: .string(nv)]); return }
        let c = core()
        let d = c.mins(nv) - c.mins(JS.string(dr["start"]))
        patchDraft(["start": .string(nv), "end": .string(c.addMin(JS.string(dr["end"]), d))])
    }

    /// 「＋ 種類」：新しい種類の欄を開閉
    public func toggleNewType() { set(["newType": JS.truthy(state["newType"]) ? .null : ["name": "", "color": "#2F72C4"]]) }
    public func setNewType(name: String? = nil, color: String? = nil) {
        guard let nt = state["newType"]?.object else { return }
        var p: [String: JSONValue?] = [:]
        if let name { p["name"] = .string(name) }
        if let color { p["color"] = .string(color) }
        set(["newType": .object(Self.with(nt, p))])
    }
    public func cancelNewType() { set(["newType": .null]) }

    /// ✕（閉じる）。書きかけがあれば確かめる
    public func cancelForm() {
        if draftDirty() { haptic("light"); set(["discardAsk": true]); return }
        set(["screen": state["returnTo"]])
    }
}
