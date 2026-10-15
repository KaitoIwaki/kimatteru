import Foundation

/// いつ空いてる？（空き状況）の画面の中身（Web 版 renderVals の freeShown の写し）
public struct FreeView: Equatable {
    public struct Tag: Equatable { public var text: String; public var time: String; public var style: [String: JSONValue] }
    public struct Row: Equatable {
        public var day: Int, dow: String, dowColor: String, hol: String, dayColor: String
        public var tags: [Tag]
        public var note: String, noteColor: String
        public var mark: String, markColor: String, markBorder: String, markBg: String, manual: Bool
        public var dim: Bool
        /// 手で直すときの鍵と、自動の印（cycleMark に渡す）
        public var key: String, auto: String
    }
    public var monthLabel = 0
    public var rows: [Row] = []
    public var cO = 0, cA = 0, cX = 0
}

extension AppCore {
    /// 帯の字（印つき。月表示より広い所で使う）
    public func pillText(_ ev: [String: JSONValue], wageOn: Bool) -> String {
        if ev["status"] == "mikakutei" { return "？" + JS.string(ev["title"]) }
        if ev["status"] == "jisseki" { return wageOn && ev["type"] == "baito" ? fmtWage(wage(ev)) : "✓" + JS.string(ev["title"]) }
        return JS.string(ev["title"])
    }

    public func freeView(_ fY: Int, _ fm: Int, dark: Bool, overlay: [[String: JSONValue]] = []) -> FreeView {
        var v = FreeView()
        v.monthLabel = fm + 1
        let dim = Civil.daysInMonth(fY, fm)
        let fdow = Civil.weekday(fY, fm, 1)
        let ov = overrides
        let wl = ["日", "月", "火", "水", "木", "金", "土"]
        for d in 1...dim {
            let dow = (fdow + d - 1) % 7
            let n = Civil.dayNo(fY, fm, d)
            let evs = events.filter { covers($0, n) && $0["status"] != "nakunatta" }
            let j = dayFree(fY, fm, d, overlay: overlay)
            let hol = Holidays.name(fY, fm, d)
            let key = "\(fY)-\(fm)-\(d)"
            let manual = JS.truthy(ov[key])
            let applied = manual ? JS.string(ov[key]) : j.mark
            if applied == "○" { v.cO += 1 } else if applied == "△" { v.cA += 1 } else { v.cX += 1 }
            var color = "#B9770F", border = "", bg = ""
            if applied == "○" { color = "#1D9E75" }
            else if applied == "×" { color = "#C1C5CC" }
            else {
                let variant = manual ? "manual" : (j.variant ?? "")
                if variant == "adjust" { border = "1.5px dashed #E0921C" }
                else if variant == "partial" { bg = "rgba(224,146,28,.14)" }
            }
            let showNote = !manual && applied == "△" && (j.note?.isEmpty == false)
            var winNote = ""
            if !manual && applied == "○", j.win.count == 2, !(j.win[0] <= 600 && j.win[1] >= 1260) { winNote = fmtMin(j.win[0]) + "以降" }
            let red = hol != nil || dow == 0
            let tags = evs.prefix(2).map { ev -> FreeView.Tag in
                let isJ = ev["status"] == "jisseki"
                let end = JS.string(isJ ? JS.or(ev["actualEnd"], ev["end"]) : ev["end"])
                return .init(text: pillText(ev, wageOn: false), time: JS.truthy(ev["allDay"]) ? "終日" : JS.string(ev["start"]) + "–" + end, style: pillStyle(ev, dark: dark))
            }
            v.rows.append(.init(day: d, dow: wl[dow], dowColor: red ? "var(--sun)" : dow == 6 ? "var(--sat)" : "var(--ink-mut)", hol: hol ?? "",
                                dayColor: red ? "var(--sun)" : dow == 6 ? "var(--sat)" : (applied == "○" ? "var(--ink-faint)" : "var(--ink)"),
                                tags: Array(tags), note: showNote ? (j.note ?? "") : winNote,
                                noteColor: showNote && j.variant == "adjust" ? "#B9770F" : "#9AA0A6",
                                mark: applied, markColor: color, markBorder: border, markBg: bg, manual: manual, dim: applied == "×", key: key, auto: j.mark))
        }
        return v
    }
}
