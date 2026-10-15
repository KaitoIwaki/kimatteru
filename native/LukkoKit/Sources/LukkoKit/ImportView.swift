import Foundation

/// 予定の取り込みの画面の中身（Web 版 renderVals の「予定の取り込み」の写し）
public struct ImportView: Equatable {
    public struct Row: Equatable {
        public var key: JSONValue, title: String, on: Bool, kindTag: String, place: String, when: String
        public var typeName: String, typeBg: String, typeInk: String, typeLine: String
    }
    public struct Cal: Equatable {
        public var id: JSONValue, label: String, color: String, on: Bool, typeName: String, typeBg: String, typeInk: String
    }
    public struct Chip: Equatable { public var key: String, label: String, sel: Bool }

    public var phase = "", error = "", denied = false
    public var count = "0", onCount = "0", allOn = false, guessText = ""
    public var rows: [Row] = []
    public var bulkChips: [Chip] = []
    public var added = "0", doneDetail = "", doneDashed = "", undoShown = false
    public var cals: [Cal] = []
    public var rangeChips: [Chip] = []
    public var calsOnCount = 0
    public var none = false, fromIcs = false, tidy = false, tidied = ""
    public var otherOpen = false, askOpen = false, bulkOpen = false
    /// Outlook や Yahoo! の予定が出てこないときの手順（iOS の版で言い方が違うので両方書く）
    public var otherSteps: [String] = []
}

extension Engine {
    public func importView(sysDark: Bool = false) -> ImportView {
        let st = state, c = core()
        let dark = c.isDark(sysDark: sysDark)
        let im = state["imp"] ?? .null
        let found = im["found"]?.array ?? []
        var v = ImportView()
        v.phase = JS.string(im["phase"])
        v.error = JS.truthy(im["error"]) ? JS.string(im["error"]) : ""
        v.denied = JS.truthy(im["denied"])
        v.count = String(found.count)
        v.onCount = String(found.filter { JS.truthy($0["on"]) }.count)
        v.allOn = !found.isEmpty && found.allSatisfy { JS.truthy($0["on"]) }
        let g = found.filter { JS.truthy($0["guessed"]) }.count
        v.guessText = g > 0 ? "名前から\(g)件の種類を当てました。ちがっていたら押して直せます。" : ""
        v.bulkChips = visibleTypes().map { .init(key: JS.string($0["key"]), label: JS.string($0["name"]), sel: false) }
        let types = typesList
        v.rows = found.map { e in
            let ty = types.first { $0["key"] == e["type"] } ?? types.first ?? [:]
            let hex = JS.string(ty["color"])
            let kind = e["kind"] == "changed" ? "変わった（前は \(JS.string(e["was"]))）" : e["kind"] == "gone" ? "元で消えた・消すなら選ぶ" : ""
            let span: String
            if JS.truthy(e["allDay"]) { span = JS.number(e["days"]) > 1 ? JS.string(e["days"]) + "日間" : "終日" }
            else { span = JS.string(e["start"]) + "–" + JS.string(e["end"]) }
            let when = "\(JS.string(.number(JS.number(e["m"]) + 1)))/\(JS.string(e["day"]))　" + span + (e["status"] == "mikakutei" ? "　まだ" : "")
            return .init(key: e["key"] ?? .null, title: JS.string(e["title"]), on: JS.truthy(e["on"]), kindTag: kind,
                         place: JS.truthy(e["place"]) ? JS.string(e["place"]) : "", when: when,
                         typeName: JS.string(ty["name"]), typeBg: c.softFill(hex, dark: dark), typeInk: c.inkOn(hex, dark: dark), typeLine: c.softLine(hex, dark: dark))
        }
        v.added = JS.string(JS.or(im["added"], .number(0)))
        var parts: [String] = []
        if JS.truthy(im["updated"]) { parts.append("\(JS.string(im["updated"]))件を元に合わせて直しました") }
        if JS.truthy(im["removed"]) { parts.append("元で消えた\(JS.string(im["removed"]))件を消しました（最近消した予定から戻せます）") }
        if JS.truthy(im["withPlace"]) { parts.append("場所つき \(JS.string(im["withPlace"]))件") }
        if JS.truthy(im["multi"]) { parts.append("何日も続く予定 \(JS.string(im["multi"]))件") }
        v.doneDetail = parts.joined(separator: "・")
        v.doneDashed = JS.truthy(im["dashed"]) ? "「仮」「候補」などが付いた\(JS.string(im["dashed"]))件は、点線（まだ）で置きました。" : ""
        v.undoShown = im["phase"] == "done" && !JS.truthy(im["tidied"]) && JS.truthy(st["settings"]?["lastImport"]) && JS.number(JS.or(im["added"], .number(0))) > 0
        v.cals = (im["cals"]?.array ?? []).map { cal in
            let ty = JS.truthy(cal["type"]) ? types.first { $0["key"] == cal["type"] } : nil
            let hex = JS.string(ty?["color"])
            return .init(id: cal["id"] ?? .null, label: JS.string(cal["title"]), color: JS.string(cal["color"]), on: JS.truthy(cal["on"]),
                         typeName: ty.map { JS.string($0["name"]) } ?? "名前から当てる",
                         typeBg: ty != nil ? c.softFill(hex, dark: dark) : "var(--bg2)", typeInk: ty != nil ? c.inkOn(hex, dark: dark) : "var(--ink-mut)")
        }
        let range = JS.truthy(im["range"]) ? JS.string(im["range"]) : "month"
        v.rangeChips = [("month", "先月から"), ("year", "今年のはじめから"), ("back", "1年前から")].map { .init(key: $0.0, label: $0.1, sel: range == $0.0) }
        v.calsOnCount = (im["cals"]?.array ?? []).filter { JS.truthy($0["on"]) }.count
        v.none = im["phase"] == "found" && found.isEmpty
        v.fromIcs = im["source"] == "ics"
        v.tidy = im["source"] == "tidy"
        v.tidied = JS.truthy(im["tidied"]) ? JS.string(im["tidied"]) : ""
        v.otherOpen = JS.truthy(im["otherOpen"])
        v.askOpen = JS.truthy(im["askOpen"])
        v.bulkOpen = JS.truthy(im["bulkOpen"])
        v.otherSteps = [
            "設定アプリを開く",
            "「アプリ」→「カレンダー」と進む（iOS 17 以前は、そのまま「カレンダー」）",
            "「カレンダーアカウント」（または「アカウント」）→「アカウントを追加」で、使っているサービスを選ぶ",
            "この画面に戻って、もう一度「続ける」を押す",
        ]
        return v
    }

    /// 取り込みの画面のたたみ（"other"＝ほかのカレンダー・"ask"＝次に iPhone が聞くこと・"bulk"＝まとめて種類を変える）
    public func toggleImportFold(_ key: String) {
        haptic("light")
        let k = key + "Open"
        setImp([k: .bool(!JS.truthy(impObj[k]))])
    }
    /// 取り込みの画面から出る（やめる・←）
    public func importBack() { set(["screen": "settings"]) }
    /// 取り込みが済んで「カレンダーを見る」
    public func importDone() { set(["screen": "month"]) }
}
