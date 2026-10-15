import Foundation

/// まとめ（Web 版 renderVals の report の写し）
public struct ReportView: Equatable {
    public struct Head: Equatable { public var num: String, unit: String, rest: String }
    public struct Bar: Equatable { public var label: Int, hours: Double, isCur: Bool, height: Int, color: String }
    public struct PayRow: Equatable { public var name: String, head: String, range: String, wage: String, times: Int }
    public var monthLabel = "", yearLabel = "", empty = false, tab = "month"
    public var monthKinds: [JSONValue] = [], yearKinds: [JSONValue] = []
    public var monthNone = false
    public var monthHead = Head(num: "0", unit: "時間", rest: ""), monthSub = ""
    public var yearHead = Head(num: "0", unit: "時間", rest: ""), yearSub = ""
    public var bars: [Bar] = []
    public var wageShown = false
    public var monthHours = "", monthWage = "", monthDays = ""
    public var yearHours = "", yearWage = "", yearDays = ""
    public var priorText = "", priorLabel = "", priorHint = "", priorValue = "", priorOpen = false
    public var monthJobs: [JSONValue] = [], yearJobs: [JSONValue] = []
    public var overMonth = "", overYear = "", leave = ""
    public var payRows: [PayRow] = []
}

extension AppCore {
    /// 大きく出す数字。時間があれば時間、無ければ日。分は小さく添える
    public func spentHead(_ h: Double, _ d: Double) -> ReportView.Head {
        if h > 0 {
            let H = h.rounded(.down), Mi = JS.round((h - H) * 60)
            if H > 0 { return .init(num: JS.numberToString(H), unit: "時間", rest: Mi != 0 ? JS.numberToString(Mi) + "分" : "") }
            return .init(num: JS.numberToString(Mi), unit: "分", rest: "")
        }
        if d > 0 { return .init(num: JS.numberToString(d), unit: "日", rest: "") }
        return .init(num: "0", unit: "時間", rest: "")
    }
}

extension Engine {
    public func reportView() -> ReportView {
        var v = ReportView()
        let c = core()
        let ym = state["ym"] ?? .null
        let Y = JS.int(ym["y"]), M = JS.int(ym["m"])
        let yV = JSONValue.number(Double(Y)), mV = JSONValue.number(Double(M))
        let spent = events.filter { ($0["status"] == "kakutei" || $0["status"] == "jisseki") && !JS.truthy($0["noReport"]) }
        let moK = c.timeBreakdown(spent.filter { $0["y"] == yV && $0["m"] == mV })
        let yrK = c.timeBreakdown(spent.filter { $0["y"] == yV })
        func tot(_ ks: [JSONValue]) -> (h: Double, d: Double, t: Double) {
            ks.reduce((0, 0, 0)) { a, k in (a.0 + JS.number(k["hours"]), a.1 + JS.number(k["days"]), a.2 + JS.number(k["times"])) }
        }
        let tm = tot(moK), ty = tot(yrK)
        v.monthLabel = "\(M + 1)月"; v.yearLabel = "\(Y)年"
        v.empty = spent.isEmpty
        v.tab = JS.string(JS.or(state["repTab"], "month"))
        v.monthKinds = moK; v.yearKinds = yrK
        v.monthNone = moK.isEmpty
        v.monthHead = c.spentHead(tm.h, tm.d); v.monthSub = "\(JS.numberToString(tm.t))件の予定"
        v.yearHead = c.spentHead(ty.h, ty.d); v.yearSub = "\(JS.numberToString(ty.t))件の予定"
        let perMonth = (0..<12).map { i in spent.filter { $0["y"] == yV && $0["m"] == .number(Double(i)) }.reduce(0.0) { $0 + c.spentHours($1) } }
        let peak = max(1, perMonth.max() ?? 0)
        v.bars = perMonth.enumerated().map { i, h in
            .init(label: i + 1, hours: h, isCur: i == M, height: max(3, Int(JS.round(h / peak * 74))),
                  color: i == M ? "var(--ink)" : (h > 0 ? "var(--ink-faint)" : "var(--line)"))
        }
        let doneAll = events.filter { $0["status"] == "jisseki" && $0["type"] == "baito" && !JS.truthy($0["noReport"]) }
        v.wageShown = doneAll.contains { $0["y"] == yV }
        func sum(_ list: [Obj]) -> (hours: Double, wage: Double, days: Int) {
            (list.reduce(0) { $0 + c.paidHours($1) }, list.reduce(0) { $0 + c.wage($1) }, list.count)
        }
        let mo = sum(doneAll.filter { $0["y"] == yV && $0["m"] == mV }), yr = sum(doneAll.filter { $0["y"] == yV })
        v.monthHours = c.fmtHours(mo.hours); v.monthWage = c.fmtWage(mo.wage); v.monthDays = String(mo.days)
        v.yearHours = c.fmtHours(yr.hours)
        let prior = c.priorFor(Y)
        v.yearWage = c.fmtWage(yr.wage + prior)
        v.priorText = prior != 0 ? "うち " + c.fmtWage(prior) + " は使い始める前の分として手で入れた額で、時間と日数には入っていません。" : ""
        v.priorLabel = prior != 0 ? c.fmtWage(prior) : "未設定"
        v.priorHint = "\(Y)年の、記録を始める前に稼いだぶん"
        v.priorValue = prior != 0 ? JS.numberToString(prior) : ""
        v.priorOpen = JS.truthy(state["priorOpen"])
        v.yearDays = String(yr.days)
        v.monthJobs = c.jobBreakdown(doneAll.filter { $0["y"] == yV && $0["m"] == mV })
        v.yearJobs = c.jobBreakdown(doneAll.filter { $0["y"] == yV })
        // 予定より延びた時間（残業）
        func over(_ list: [Obj]) -> (m: Double, n: Int) {
            var m = 0.0, n = 0
            for e in list {
                if !JS.truthy(e["actualEnd"]) || JS.truthy(e["allDay"]) { continue }
                let plan = ((c.mins(JS.string(e["end"])) - c.mins(JS.string(e["start"]))) + 1440).truncatingRemainder(dividingBy: 1440)
                let act = ((c.mins(JS.string(e["actualEnd"])) - c.mins(JS.string(e["start"]))) + 1440).truncatingRemainder(dividingBy: 1440)
                if act > plan { m += act - plan; n += 1 }
            }
            return (m, n)
        }
        let done = events.filter { $0["status"] == "jisseki" && ($0["type"] == "baito" || $0["type"] == "work") }
        let om = over(done.filter { $0["y"] == yV && $0["m"] == mV }), oy = over(done.filter { $0["y"] == yV })
        v.overMonth = om.n > 0 ? "予定より延びた時間 \(c.fmtHours(om.m / 60))（\(om.n)回）" : ""
        v.overYear = oy.n > 0 ? "予定より延びた時間 \(c.fmtHours(oy.m / 60))（\(oy.n)回）" : ""
        v.leave = leaveSummary()?["short"]?.string ?? ""
        // 締め日と給料日で数えた給料
        v.payRows = jobsList.filter { JS.truthy($0["closeDay"]) }.map { j in
            let cl = JS.int(j["closeDay"]), p = JS.truthy(j["payDay"]) ? JS.int(j["payDay"]) : 0
            let endD = cl >= 31 ? Civil.fromDayNo(Civil.dayNo(Y, M + 1, 0)) : Civil.fromDayNo(Civil.dayNo(Y, M, cl))
            let startD = cl >= 31 ? Civil.fromDayNo(Civil.dayNo(Y, M, 1)) : Civil.fromDayNo(Civil.dayNo(Y, M - 1, cl + 1))
            let a = Civil.dayNo(startD.y, startD.m, startD.d), b = Civil.dayNo(endD.y, endD.m, endD.d)
            let list = events.filter { $0["jobId"] == j["id"] && $0["status"] == "jisseki" && AppCore.evFrom($0) >= a && AppCore.evFrom($0) <= b }
            let wage = JS.round(list.reduce(0) { $0 + c.wage($1) })
            var head = "\(endD.m + 1)/\(endD.d)締め"
            if p != 0 {
                let payM = (p > cl && cl < 31) ? endD.m : endD.m + 1
                let pd = p >= 31 ? Civil.fromDayNo(Civil.dayNo(endD.y, payM + 1, 0)) : Civil.fromDayNo(Civil.dayNo(endD.y, payM, p))
                head = "\(pd.m + 1)月\(pd.d)日に入る分"
            }
            return .init(name: JS.string(JS.or(j["name"], "（名前なし）")), head: head, range: "\(startD.m + 1)/\(startD.d)〜\(endD.m + 1)/\(endD.d)", wage: c.fmtWage(wage), times: list.count)
        }
        return v
    }

    public func setRepTab(_ k: String) { haptic("light"); set(["repTab": .string(k)]) }
    public func togglePrior() { haptic("light"); set(["priorOpen": .bool(!JS.truthy(state["priorOpen"]))]) }
    /// 使い始める前の額の欄（数字だけ・8 桁まで）
    public func setPriorText(_ s: String) {
        let y = JS.int(state["ym"]?["y"])
        let digits = String(String.UnicodeScalarView(s.unicodeScalars.filter { $0.value >= 0x30 && $0.value <= 0x39 }.prefix(8)))
        setPrior(y, digits.isEmpty ? .number(0) : .number(Double(digits) ?? 0))
    }
    /// まとめの年を送る（月はそのまま）
    public func shiftRepYear(_ n: Int) {
        let ym = state["ym"] ?? .null
        set(["ym": ["y": .number(JS.number(ym["y"]) + Double(n)), "m": ym["m"] ?? .null]])
    }
    /// 月ごとの棒を押す：その月へ
    public func openRepMonth(_ i: Int) { set(["ym": ["y": state["ym"]?["y"] ?? .null, "m": .number(Double(i))], "repTab": "month"]) }
}
