import Foundation

/// 種類の定義（Web 版 App.jsx の EXTRA_TYPES・PROFILES・extraType の写し）
public enum TypeDefs {
    public typealias Obj = [String: JSONValue]

    /// 最初から入っている4つのほかに持っている種類（使い方で出し分ける）
    public static let extra: [String: Obj] = [
        "work": ["key": .string("work"), "name": .string("仕事"), "color": .string("#6E85BE"), "uWord": .string("仮押さえ"), "cWord": .string("確定"), "uLabel": .string("仮押さえ"), "cLabel": .string("確定"),
                 "ask": .string("この仮押さえ、どうなった？"), "gone": .string("流れた"), "celeb": .string("確定しました")],
        "off": ["key": .string("off"), "name": .string("休み"), "color": .string("#5FA8A2"), "uWord": .string("希望休"), "cWord": .string("休み"), "uLabel": .string("希望休"), "cLabel": .string("休み"),
                "ask": .string("この休み、通りましたか？"), "gone": .string("通らなかった"), "celeb": .string("休み、通りました"), "free": .bool(true), "allDayDefault": .bool(true)],
        "family": ["key": .string("family"), "name": .string("家族"), "color": .string("#D0A0BC"), "uWord": .string("まだの家族の予定"), "cWord": .string("家族の予定"),
                   "ask": .string("この予定、どうなりました？")],
    ]

    /// JS：hex.replace('#','') を 2 文字ずつ parseInt(…, 16)。読めないところは NaN（色の値が壊れていても落ちない）
    static func hexRgb(_ hex: String) -> [Double] {
        let h = Array((hex.range(of: "#").map { hex.replacingCharacters(in: $0, with: "") } ?? hex).utf16)
        return [0, 2, 4].map { i -> Double in
            guard i < h.count else { return .nan }
            return JS.parseHex(String(decoding: h[i..<min(i + 2, h.count)], as: UTF16.self))
        }
    }
    static func mixHex(_ a: String, _ b: String, _ t: Double) -> [String] {
        let A = hexRgb(a), B = hexRgb(b)
        return A.indices.map { JS.numberToString(JS.round(A[$0] + (B[$0] - A[$0]) * t)) }
    }
    public static func paperOf(_ hex: String) -> String { let l = mixHex(hex, "#ffffff", 0.62); return "rgba(\(l[0]),\(l[1]),\(l[2]),.72)" }
    public static func darkOf(_ hex: String) -> String { let d = mixHex(hex, "#000000", 0.5); return "rgb(\(d[0]),\(d[1]),\(d[2]))" }

    public static func extraType(_ key: String) -> Obj? {
        guard var t = extra[key] else { return nil }
        let c = JS.string(t["color"])
        t["paper"] = .string(paperOf(c)); t["dark"] = .string(darkOf(c))
        return t
    }
}

extension AppCore {
    /// 種類を引く（保存されている種類 → 持っている種類 → 先頭の種類）
    public func T(_ key: JSONValue?) -> [String: JSONValue]? {
        if let t = types.first(where: { $0["key"] == key }) { return t }
        if case .string(let k)? = key, let t = TypeDefs.extraType(k) { return t }
        return types.first
    }

    var overrides: [String: JSONValue] { state["overrides"]?.object ?? [:] }
    var events: [[String: JSONValue]] { (state["events"]?.array ?? []).compactMap { $0.object } }
    func dayKey(_ y: Int, _ m: Int, _ d: Int) -> String { "\(y)-\(m)-\(d)" }

    public struct Free: Equatable {
        public var mark: String
        public var variant: String?
        public var note: String?
        public var ranges: [[Double]]
        public var win: [Double]
        public var full: Bool?
        public var json: JSONValue {
            var o: [String: JSONValue] = ["mark": .string(mark), "ranges": .array(ranges.map { .array($0.map { .number($0) }) }), "win": .array(win.map { .number($0) })]
            if let variant { o["variant"] = .string(variant) }
            if let note { o["note"] = .string(note) }
            if let full { o["full"] = .bool(full) }
            return .object(o)
        }
    }

    /// その日が空いているか（空き状況・空いてる日の画像・文字でコピーが同じ判定を使う）。
    /// overlay … 重ねて表示している iPhone のカレンダーの予定（設定でオンのときだけ渡す）
    public func dayFree(_ y: Int, _ m: Int, _ d: Int, overlay: [[String: JSONValue]] = []) -> Free {
        let cfg = settings
        let n = Civil.dayNo(y, m, d), dw = Civil.weekday(y, m, d)
        let hol = Holidays.name(y, m, d) != nil, offDay = hol || dw == 0 || dw == 6
        let winV = JS.or(offDay ? cfg["freeHd"] : cfg["freeWd"], .array([.number(540), .number(1320)]))
        let winArr = (winV?.array ?? []).map { JS.number($0) }
        let WS = winArr.count > 0 ? winArr[0] : .nan, WE = winArr.count > 1 ? winArr[1] : .nan
        let win = winArr
        func isFreeType(_ e: [String: JSONValue]) -> Bool { JS.truthy(T(e["type"])?["free"]) }
        let today = events.filter { e in
            JS.string(e["status"]) != "nakunatta" && (covers(e, n) || (!JS.truthy(e["allDay"]) && Self.evFrom(e) == n - 1 && WhenLib.spillsNextDay(e)))
        }
        let over = JS.truthy(cfg["overlayFree"]) ? Self.overlayOnDay(overlay, n) : []
        let stat = { (e: [String: JSONValue]) -> String in JS.string(e["status"]) }
        let offToday = today.contains { isFreeType($0) && (stat($0) == "kakutei" || stat($0) == "jisseki") }
        let conf = today.filter { (stat($0) == "kakutei" || stat($0) == "jisseki") && !isFreeType($0) }
        let unc = today.filter { stat($0) == "mikakutei" && !isFreeType($0) }
        if conf.contains(where: { JS.truthy($0["allDay"]) && covers($0, n) }) || over.contains(where: { JS.truthy($0["allDay"]) }) {
            return Free(mark: "×", ranges: [], win: win)
        }
        var iv: [[Double]] = []
        for sg in TimeGrid.segmentsForDay(conf, y, m, d) { iv.append([sg.a, sg.b]) }
        for sg in TimeGrid.segmentsForDay(over, y, m, d) { iv.append([sg.a, sg.b]) }
        if let wh = cfg["workHours"], JS.truthy(wh), !offDay, !offToday {
            let days = JS.or(wh["days"], .array([]))?.array ?? []
            if days.contains(where: { $0 == .number(Double(dw)) }) { iv.append([JS.number(wh["from"]), JS.number(wh["to"])]) }
        }
        let clip = JS.stableSorted(iv.map { [max($0[0], WS), min($0[1], WE)] }.filter { $0[1] > $0[0] }) { a, b in
            let x = a[0] - b[0]; return x == 0 || x.isNaN ? 0 : (x < 0 ? -1 : 1)
        }
        var merged: [[Double]] = []
        for x in clip {
            if let last = merged.last, x[0] <= last[1] { merged[merged.count - 1][1] = max(last[1], x[1]) } else { merged.append(x) }
        }
        var ranges: [[Double]] = []
        var cur = WS
        for r in merged { if r[0] - cur >= 60 { ranges.append([cur, r[0]]) }; cur = max(cur, r[1]) }
        if WE - cur >= 60 { ranges.append([cur, WE]) }
        if ranges.isEmpty { return Free(mark: "×", ranges: ranges, win: win) }
        let uncIn = TimeGrid.segmentsForDay(unc, y, m, d).contains { $0.a < WE && $0.b > WS } || unc.contains { JS.truthy($0["allDay"]) }
        if merged.isEmpty {
            if uncIn {
                let u = unc[0]
                return Free(mark: "△", variant: "adjust", note: JS.string(u["type"]) == "baito" && u["type"]?.string != nil ? "まだ希望を出しただけです" : "まだ候補なので調整できます", ranges: ranges, win: win, full: true)
            }
            return Free(mark: "○", ranges: ranges, win: win, full: true)
        }
        let note: String
        if ranges.count == 1 {
            let r = ranges[0]
            note = r[1] >= WE ? fmtMin(r[0]) + "以降なら空いてます" : r[0] <= WS ? fmtMin(r[1]) + "までなら空いてます" : fmtMin(r[0]) + "〜" + fmtMin(r[1]) + " なら空いてます"
        } else {
            note = ranges.map { r in r[1] >= WE ? fmtMin(r[0]) + "以降" : r[0] <= WS ? fmtMin(r[1]) + "まで" : fmtMin(r[0]) + "〜" + fmtMin(r[1]) }.joined(separator: "・") + " なら空いてます"
        }
        return Free(mark: "△", variant: "partial", note: note, ranges: ranges, win: win)
    }

    func covers(_ e: [String: JSONValue], _ n: Int) -> Bool { n >= Self.evFrom(e) && n <= Self.evTo(e) }

    static let DW = ["日", "月", "火", "水", "木", "金", "土"]
    func hLabel(_ x: Double) -> String {
        let H = (x / 60).rounded(.down), M = x.truncatingRemainder(dividingBy: 60)
        return M != 0 ? JS.numberToString(H) + ":" + pad2(M) : JS.numberToString(H) + "時"
    }

    /// 「10/3（金）19時以降」「10/4（土）終日」のような、文字で送る形の1日ぶん（空いていなければ nil）
    public func freeText(_ y: Int, _ m: Int, _ d: Int, _ polite: Bool, overlay: [[String: JSONValue]] = []) -> String? {
        let j = dayFree(y, m, d, overlay: overlay)
        let ov = overrides[dayKey(y, m, d)]
        let mark = JS.truthy(ov) ? JS.string(ov) : j.mark
        if mark == "×" { return nil }
        let when: String
        let ovs = JS.truthy(ov) ? JS.string(ov) : nil
        if ovs == "○" || (mark == "○" && j.full == true) {
            let w = j.win.isEmpty ? [540, 1320] : j.win
            let a = w[0], b = w.count > 1 ? w[1] : .nan
            when = (a <= 600 && b >= 1260) ? "終日" : (b >= 1320 ? hLabel(a) + "以降" : hLabel(a) + "〜" + hLabel(b))
        } else if ovs == "△" && j.ranges.isEmpty {
            when = polite ? "時間によっては可" : "時間しだい"
        } else {
            let WE = j.win.count > 1 ? j.win[1] : 1320
            when = j.ranges.map { r in r[1] >= WE ? hLabel(r[0]) + "以降" : hLabel(r[0]) + "〜" + hLabel(r[1]) }.joined(separator: "、")
        }
        return "\(m + 1)/\(d)（\(Self.DW[Civil.weekday(y, m, d)])）" + when
    }

    var todayParts: (y: Int, m: Int, d: Int) {
        let t = state["today"]?.object ?? [:]
        return (JS.int(t["y"]), JS.int(t["m"]), JS.int(t["d"]))
    }

    /// 空いてる日の画像のマス（level：free ○ / part △ / busy × / past 過ぎた日 / none 前の空き）
    public func freeCells(_ Y: Int, _ M: Int, overlay: [[String: JSONValue]] = []) -> [JSONValue] {
        let ws = JS.int(settings["weekStart"])
        let first = ((Civil.weekday(Y, M, 1) - ws + 7) % 7 + 7) % 7
        let dim = Civil.daysInMonth(Y, M)
        let t = todayParts
        let todayN = Civil.dayNo(t.y, t.m, t.d)
        var cells: [JSONValue] = Array(repeating: .object(["label": .string(""), "level": .string("none")]), count: max(0, first))
        for d in 1...dim {
            if Civil.dayNo(Y, M, d) < todayN { cells.append(.object(["label": .number(Double(d)), "level": .string("past")])); continue }
            let j = dayFree(Y, M, d, overlay: overlay)
            let ov = overrides[dayKey(Y, M, d)]
            let mark = JS.truthy(ov) ? JS.string(ov) : j.mark
            var level = mark == "○" ? "free" : mark == "△" ? "part" : "busy"
            var note = ""
            let w = j.win
            if level == "free" && !JS.truthy(ov) && !w.isEmpty && !(w[0] <= 600 && (w.count > 1 ? w[1] : .nan) >= 1260) { level = "part"; note = hLabel(w[0]) + "〜" }
            else if level == "part" && !j.ranges.isEmpty { note = hLabel(j.ranges[0][0]) + "〜" }
            cells.append(.object(["label": .number(Double(d)), "level": .string(level), "note": .string(note)]))
        }
        return cells
    }

    /// 文字で送る空いてる日。範囲・平日休日で絞り、ていねい版は前後に一言を添える
    public func freeTextBlock(_ so: [String: JSONValue], overlay: [[String: JSONValue]] = []) -> String {
        let t = todayParts, ws = JS.int(settings["weekStart"])
        let todayN = Civil.dayNo(t.y, t.m, t.d)
        var a = todayN, b = todayN + 13
        let wk0 = TimeGrid.weekStartNo(t.y, t.m, t.d, ws)
        let range = JS.string(so["range"])
        if range == "week" { a = todayN; b = wk0 + 6 }
        else if range == "next" { a = wk0 + 7; b = wk0 + 13 }
        else if range == "month" {
            let fy = state["freeYM"]?.object ?? [:]
            let Y = JS.int(fy["y"]), M = JS.int(fy["m"])
            a = max(todayN, Civil.dayNo(Y, M, 1)); b = Civil.dayNo(Y, M + 1, 0)
        }
        let polite = JS.truthy(so["polite"]), only = JS.string(so["only"])
        var lines: [String] = []
        if a <= b {
            for n in a...b {
                let o = Civil.fromDayNo(n)
                let dw = Civil.weekday(o.y, o.m, o.d)
                let off = dw == 0 || dw == 6 || Holidays.name(o.y, o.m, o.d) != nil
                if only == "wd" && off { continue }
                if only == "hd" && !off { continue }
                if let line = freeText(o.y, o.m, o.d, polite, overlay: overlay) { lines.append((polite ? "・" : "") + line) }
            }
        }
        let nm = (JS.truthy(so["name"]) ? JS.string(so["name"]) : "").jsTrimmed
        if lines.isEmpty { return polite ? "この期間は、あいにく空いている日がありません。" : "この期間は空いてる日がありません" }
        return polite ? "\(nm.isEmpty ? "" : nm + "の")空いている日程です。\n\(lines.joined(separator: "\n"))\nご都合のよい日をお知らせください。"
                      : "空いてる日\n\(lines.joined(separator: "\n"))"
    }
}
