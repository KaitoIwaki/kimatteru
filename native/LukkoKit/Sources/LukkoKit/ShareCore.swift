import Foundation

/// 空いてる日をシェア（Web 版の screen='share'）の画面の中身（renderVals の shareShown の写し）
public struct ShareView: Equatable {
    /// 送り方の札。value は shareOpt にそのまま入れる値
    public struct Chip: Equatable { public var label: String; public var value: JSONValue; public var sel: Bool }
    /// 見本のマス（level：free ○ / part △ / busy × / past 過ぎた日 / none 月の頭の空き）
    public struct Cell: Equatable { public var label: Int?; public var level: String; public var note: String }
    public var weekdays: [String] = []
    public var monthLabel = ""
    public var lead = "", title = ""
    public var legend: [String] = []
    public var cells: [Cell] = []
    public var rangeChips: [Chip] = [], onlyChips: [Chip] = [], toneChips: [Chip] = []
    public var name = ""
    public var text = ""
    public var sign = false
    public var toast = false, toastMsg = ""
}

/// 空いてる日の画像に渡すもの（sharecard.js の drawFreeCard の引数）
public struct ShareFreeCard: Equatable {
    public var monthLabel: Int
    public var weekdays: [String]
    public var cells: [ShareView.Cell]
    public var lead: String, title: String
    public var legend: [String]
    public var signSub: String
    /// 書き出すファイルの名前（LUKKO-空いてる日-2026-10.png）
    public var fileName: String
}

/// まとめカードのバイト先の行（_jobBreakdown の 1 行）
public struct ShareCardJob: Equatable {
    public var name: String, color: String
    public var hourly: Int?
    public var times: Int
    public var hours: String, wage: String
}

/// 今月のまとめ（drawMonthCard の引数）
public struct ShareMonthCard: Equatable {
    public var yearMonth: String
    public var wageUnit: String, wageNum: String
    public var hours: String
    public var days: Int
    public var jobs: [ShareCardJob]
}

/// 今年のまとめ（drawYearCard の引数）
public struct ShareYearCard: Equatable {
    public var year: String
    public var wageUnit: String, wageNum: String
    public var hours: String
    public var jobs: [ShareCardJob]
    public var months: [Double]
    public var note: String
}

/// まとめカード（月か年）。プレビューと書き出しに同じものを使う
public enum ShareSummaryCard: Equatable {
    case month(ShareMonthCard)
    case year(ShareYearCard)
}

extension AppCore {
    /// 重ねて表示している予定のうち、その日にかかるもの（Web 版の _overlayFor(n, n+1)）
    static func overlayOnDay(_ all: [[String: JSONValue]], _ n: Int) -> [[String: JSONValue]] {
        if all.isEmpty { return all }
        return all.filter { e in
            let f = evFrom(e), l = evTo(e) + (WhenLib.endsNextDay(e) ? 1 : 0)
            return l >= n && f < n + 1
        }
    }

    /// ふつう版と、仕事の相手に送る ていねい版（Web 版 freeWords）
    public func freeWords(_ so: [String: JSONValue]) -> (lead: String, title: (Int) -> String, legend: [String]) {
        let nm = (JS.truthy(so["name"]) ? JS.string(so["name"]) : "").jsTrimmed
        if JS.truthy(so["polite"]) {
            return (nm.isEmpty ? "空き状況" : nm + "の空き状況", { "\($0)月の空き状況" }, ["終日可", "時間によって可", "予定あり"])
        }
        return (nm.isEmpty ? "わたしの空いてる日" : nm + "の空いてる日", { "\($0)月のあいてる日" }, ["空いてる", "時間による", "予定あり"])
    }

    /// 空いてる日の画像のマス（JSON の形から、画面と画像で使う形へ）
    public func shareCells(_ Y: Int, _ M: Int, overlay: [[String: JSONValue]] = []) -> [ShareView.Cell] {
        freeCells(Y, M, overlay: overlay).map { c in
            let label: Int? = JS.truthy(c["label"]) ? JS.int(c["label"]) : nil
            return .init(label: label, level: JS.string(c["level"]), note: JS.truthy(c["note"]) ? JS.string(c["note"]) : "")
        }
    }

    /// 今月・今年のまとめカードの中身（Web 版 _buildCard）。対象はバイトの実績（まとめに入れない印は見ない）
    public func summaryCard(year: Bool) -> ShareSummaryCard {
        let ym = state["ym"] ?? .null
        let Y = JS.int(ym["y"]), M = JS.int(ym["m"])
        let yV = JSONValue.number(Double(Y)), mV = JSONValue.number(Double(M))
        let all = (state["events"]?.array ?? []).compactMap { $0.object }
        func jobsOf(_ list: [Obj]) -> [ShareCardJob] {
            jobBreakdown(list).map { j in
                .init(name: JS.string(j["name"]), color: JS.string(j["color"]),
                      hourly: j["hourly"].flatMap { $0 == .null ? nil : JS.int($0) },
                      times: JS.int(j["times"]), hours: JS.string(j["hours"]), wage: JS.string(j["wage"]))
            }
        }
        if year {
            let yr = all.filter { $0["y"] == yV && $0["status"] == "jisseki" && $0["type"] == "baito" }
            let prior = priorFor(Y)
            let sum = JS.round(yr.reduce(0) { $0 + wage($1) }) + prior
            return .year(.init(year: "\(Y)年", wageUnit: "¥", wageNum: JS.groupedInt(sum),
                               hours: fmtHours(yr.reduce(0) { $0 + paidHours($1) }),
                               jobs: jobsOf(yr),
                               months: (0..<12).map { i in yr.filter { $0["m"] == .number(Double(i)) }.reduce(0) { $0 + paidHours($1) } },
                               note: prior != 0 ? "うち ¥\(JS.groupedInt(prior)) は使い始める前の分" : ""))
        }
        let jis = all.filter { $0["y"] == yV && $0["m"] == mV && $0["status"] == "jisseki" && $0["type"] == "baito" }
        return .month(.init(yearMonth: "\(Y)年 \(M + 1)月", wageUnit: "¥", wageNum: JS.groupedInt(JS.round(jis.reduce(0) { $0 + wage($1) })),
                            hours: fmtHours(jis.reduce(0) { $0 + paidHours($1) }), days: jis.count, jobs: jobsOf(jis)))
    }
}

extension Engine {
    /// 空いてる日を送るときの選び方（範囲・平日休日・言い回し・名前・署名）。保存はしない
    public func shareOpt() -> Obj {
        var o: Obj = ["range": "2w", "only": "all", "polite": .bool(core().profile() != "student"), "name": "", "sign": false]
        for (k, v) in state["shareOpt"]?.object ?? [:] { o[k] = v }
        return o
    }

    /// 空いてる日をシェアの画面の中身。月は空き状況で見ている月、判定は空き状況と同じ（手で直した印も入る）
    public func shareView(overlay: [Obj] = []) -> ShareView {
        let c = core()
        var v = ShareView()
        let swl = ["日", "月", "火", "水", "木", "金", "土"]
        let sws = JS.int(settings["weekStart"])
        let so = shareOpt()
        let fy = state["freeYM"] ?? .null
        let shY = JS.int(fy["y"]), shM = JS.int(fy["m"])
        v.weekdays = (0..<7).map { swl[(($0 + sws) % 7 + 7) % 7] }
        v.monthLabel = String(shM + 1)
        let W = c.freeWords(so)
        v.lead = W.lead; v.title = W.title(shM + 1); v.legend = W.legend
        v.cells = c.shareCells(shY, shM, overlay: overlay)
        v.rangeChips = [("week", "今週"), ("next", "来週"), ("2w", "2週間"), ("month", "\(shM + 1)月")].map { k, l in
            .init(label: l, value: .string(k), sel: so["range"] == .string(k))
        }
        v.onlyChips = [("all", "すべて"), ("wd", "平日だけ"), ("hd", "休日だけ")].map { k, l in
            .init(label: l, value: .string(k), sel: so["only"] == .string(k))
        }
        v.toneChips = [(false, "ふつう"), (true, "ていねい")].map { k, l in
            .init(label: l, value: .bool(k), sel: so["polite"] == .bool(k))
        }
        v.name = JS.truthy(so["name"]) ? JS.string(so["name"]) : ""
        v.text = c.freeTextBlock(so, overlay: overlay)
        v.sign = JS.truthy(so["sign"])
        v.toast = JS.truthy(state["shareToast"])
        v.toastMsg = JS.truthy(state["shareMsg"]) ? JS.string(state["shareMsg"]) : ""
        return v
    }

    /// 送り方の札を押す（範囲・平日休日・言い回し・署名）
    public func setShareOpt(_ key: String, _ value: JSONValue) {
        haptic("light")
        set(["shareOpt": .object(Self.with(shareOpt(), [key: value]))])
    }
    public func toggleShareSign() { setShareOpt("sign", .bool(!JS.truthy(shareOpt()["sign"]))) }
    /// 名前の欄（16 字まで。JS の slice(0,16) と同じく UTF-16 で数える）
    public func setShareName(_ s: String) {
        let u = Array(s.utf16)
        let val = u.count <= 16 ? s : String(decoding: u[0..<16], as: UTF16.self)
        set(["shareOpt": .object(Self.with(shareOpt(), ["name": .string(val)]))])
    }

    /// 文字でコピー。copy は実際に写して、利用者に見せるひとことを返す
    public func copyFreeText(overlay: [Obj] = [], _ copy: (String) -> String) {
        haptic("light")
        let msg = copy(core().freeTextBlock(shareOpt(), overlay: overlay))
        if !msg.isEmpty { toast(msg) }
        maybeAskReview("share")
    }

    /// 画像で送る：空いてる日のカードに渡すもの
    public func freeCard(overlay: [Obj] = []) -> ShareFreeCard {
        let c = core()
        let ws = JS.int(settings["weekStart"])
        let wl = ["日", "月", "火", "水", "木", "金", "土"]
        let fy = state["freeYM"] ?? .null
        let FY = JS.int(fy["y"]), FM = JS.int(fy["m"])
        let so = shareOpt()
        let W = c.freeWords(so)
        let mm = String(FM + 1)
        return .init(monthLabel: FM + 1, weekdays: (0..<7).map { wl[(($0 + ws) % 7 + 7) % 7] }, cells: c.shareCells(FY, FM, overlay: overlay),
                     lead: W.lead, title: W.title(FM + 1), legend: W.legend,
                     signSub: JS.truthy(so["sign"]) ? "空いてる日だけを送れるカレンダー（App Store で「LUKKO」）" : "",
                     fileName: "LUKKO-空いてる日-\(FY)-\(mm.count < 2 ? "0" + mm : mm).png")
    }

    /// まとめカードの中身と、書き出すファイルの名前
    public func summaryCard() -> ShareSummaryCard { core().summaryCard(year: state["cardKind"] == "year") }
    public func summaryCardFileName() -> String {
        let ym = state["ym"] ?? .null
        let Y = JS.int(ym["y"]), M = JS.int(ym["m"])
        return state["cardKind"] == "year" ? "LUKKO-まとめ-\(Y).png" : "LUKKO-まとめ-\(Y)-\(M + 1).png"
    }
    /// 見出し（今月のまとめ／今年のまとめ）
    public func summaryCardTitle() -> String { state["cardKind"] == "year" ? "今年のまとめ" : "今月のまとめ" }

    /// 画像で送る／画像にしてシェアを押した（tapLight）
    public func shareCardTapped() { haptic("light") }
    /// 共有シートを閉じた。空いてる日を送ったあとは、評価の小窓の候補
    public func shareCardDone(free: Bool) { if free { maybeAskReview("share") } }
    /// 画像が作れなかった（画面の中に小さく出す）
    public func shareCardFailed() { toast("画像を作れませんでした") }

    // MARK: 開く・閉じる（Web 版 onOpenShare・onShareClose・onOpenMonthCard・onOpenYearCard・onOpenSummary・onSummaryClose）
    public func openShare() {
        haptic("light")
        set(["screen": "share", "shareToast": false, "cardFrom": state["screen"] ?? .null])
    }
    public func closeShare() { set(["screen": JS.or(state["cardFrom"], "settings")]) }
    public func openMonthCard() { haptic("light"); set(["screen": "summary", "shareToast": false, "cardKind": "month", "cardFrom": "report"]) }
    public func openYearCard() { haptic("light"); set(["screen": "summary", "shareToast": false, "cardKind": "year", "cardFrom": "report"]) }
    /// 月表示の下の「◯月の実績合計」から（触感なし）
    public func openSummary() { set(["screen": "summary", "shareToast": false, "cardKind": "month", "cardFrom": state["screen"] ?? .null]) }
    public func closeSummary() { set(["screen": JS.or(state["cardFrom"], "month")]) }
}
