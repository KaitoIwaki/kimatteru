import Foundation

/// 使い方で変わる言葉（Web 版の words）
public struct Words: Equatable {
    public var job, jobNone, jobAdd, jobThis, jobEg, wageHead, shift, titleEg, placeEg, typeEg, remindTitle: String
}

/// 新しい予定／予定を編集の画面の中身（Web 版 renderVals の NEW の写し）
public struct FormView {
    public struct Chip: Equatable {
        public var key: JSONValue; public var label: String; public var sel: Bool
        public init(key: JSONValue, label: String, sel: Bool) { self.key = key; self.label = label; self.sel = sel }
    }
    public struct Cell: Equatable {
        public var day: Int?, isMain: Bool, isExtra: Bool, isToday: Bool, color: String, weight: Int
        public var bg: String, border: String
    }
    public struct Suggest: Equatable { public var label: String; public var color: String }

    public var newTitle = "", titlePlaceholder = "", titleAutoFocus = false, editing = false
    public var draftColor = "", draftColorDeep = ""
    public var suggests: [Suggest] = []
    public var durChips: [Chip] = []
    public var overlapNote = ""
    public var candShown = false, candOn = false
    public var somedayChips: [Chip] = [], somedayOn = false, somedayText = ""
    public var secretOn = false
    // 日にち
    public var dateLabel = "", dateOpen = false, dateExtraCount = 0, dateSummary = "", dateHint = ""
    public var datePickLabel = "", ymPickOpen = false, ymYearLabel = ""
    public var ymMonths: [Chip] = []
    public var dateWeekdays: [(label: String, color: String)] = []
    public var dateCells: [Cell] = []
    // 勤務先
    public var jobPickerShown = false, jobWordNew = "", jobThisNew = ""
    public var jobChips: [Chip] = [], jobNone = Chip(key: .null, label: "", sel: false)
    public var newJobShown = false, newJobName = "", newJobEg = "", newJobHourly = ""
    // 終日・何日間
    public var timed = true, spanDays = 1, spanCountLabel = "", spanRangeLabel = "", spanHint = ""
    // 行にたたむ
    public var rowTypeOpen = false, typeValue = "", typeColor = ""
    public var rowJobOpen = false, jobValue = ""
    public var addChips: [Chip] = []
    public var repRowShown = false, multiRowShown = false, placeRowShown = false, memoRowShown = false, linkRowShown = false
    public var rowLinkOpen = false, linkValue = ""
    public var rowPlaceOpen = false, placeValue = "", placePlaceholder = ""
    public var rowMemoOpen = false, memoValue = ""
    // 複数日
    public var rowMultiOpen = false, multiValue = "", multiClearShown = false, multiHint = "", multiPickLabel = ""
    public var multiCells: [Cell] = []
    // くり返し
    public var rowRepOpen = false, repValue = "", repNthShown = false, repUntilShown = false, repDowShown = false, repHint = ""
    public var repNthChips: [Chip] = [], repEveryChips: [Chip] = [], repDowChips: [Chip] = [], repWeekChips: [Chip] = []
    // お知らせ
    public var rowRemindOpen = false, remindValue = "", remindNote = ""
    public var remindSeg: [Chip] = []
    // 時刻
    public var startValue = "", endValue = "", startOpen = false, endOpen = false
    public var startDateText = "", endDateText = "", endNextDay = false, crossNote = ""
    // 種類
    public var chips: [(key: JSONValue, label: String, sel: Bool, color: String)] = []
    public var newTypeShown = false, newTypeName = "", newTypeEg = "", newTypeColor = ""
    public var swatches: [(hex: String, sel: Bool)] = []
    // 決まってる／まだ
    public var seg: [Chip] = []
    public var previewExplain = ""
    public var previewDashed = false, previewBg = "", previewBorder = ""
}

public enum FormCore {
    public static let pal = ["#8B7AB8", "#7FAE85", "#D2916A", "#A85C6B", "#C7A24A", "#6FA8B8", "#6E85BE", "#D0A0BC", "#9C7F6E", "#5FA8A2", "#8A8A8A", "#55555F"]
    public static let repeatUnits: [(key: String, label: String)] = [("day", "毎日"), ("weekday", "平日"), ("week", "毎週"), ("biweek", "2週ごと"),
                                                                      ("month", "毎月◯日"), ("nth", "毎月 第◯曜日"), ("monthEnd", "月末"), ("year", "毎年")]
    public static let repeatSpans: [String: [(m: Int, label: String)]] = [
        "day": [(1, "1か月"), (3, "3か月"), (6, "半年")],
        "weekday": [(1, "1か月"), (3, "3か月"), (6, "半年")],
        "week": [(1, "1か月"), (3, "3か月"), (6, "半年"), (12, "1年")],
        "biweek": [(3, "3か月"), (6, "半年"), (12, "1年")],
        "month": [(6, "半年"), (12, "1年"), (24, "2年")],
        "nth": [(6, "半年"), (12, "1年"), (24, "2年")],
        "monthEnd": [(6, "半年"), (12, "1年"), (24, "2年")],
        "year": [(36, "3年"), (60, "5年"), (120, "10年")],
    ]
    public static func spansFor(_ every: JSONValue?) -> [(m: Int, label: String)] {
        if case .string(let k)? = every, let s = repeatSpans[k] { return s }
        return repeatSpans["week"]!
    }
    public static let nthLabel = [1: "第1", 2: "第2", 3: "第3", 4: "第4", 5: "最終"]
    public static let somedayWhen = ["week", "month", "next", "someday"]
    static let dow = ["日", "月", "火", "水", "木", "金", "土"]
    public static let remindAllDay: [(JSONValue, String)] = [(.null, "なし"), (0, "当日の朝"), (1440, "前日の朝"), (2880, "2日前"), (4320, "3日前"), (10080, "1週間前")]
    public static let remindTimed: [(JSONValue, String)] = [(.null, "なし"), (10, "10分前"), (30, "30分前"), (60, "1時間前"), (180, "3時間前"), (1440, "前日"), (2880, "2日前"), (4320, "3日前"), (10080, "1週間前")]
    public static let durations: [(Int, String)] = [(30, "30分"), (60, "1時間"), (90, "1時間半"), (120, "2時間"), (180, "3時間")]
}

extension AppCore {
    public func words() -> Words {
        let p = profile(), stu = p == "student"
        let wt = types.first { $0["key"] == "baito" }
        let wname = (wt.map { JS.truthy($0["name"]) && $0["name"] != "バイト" } ?? false) ? JS.string(wt?["name"]) : (stu ? "バイト" : "勤務")
        return Words(job: stu ? "バイト先" : "勤務先", jobNone: stu ? "バイト先なし" : "勤務先なし", jobAdd: stu ? "バイト先を追加" : "勤務先を追加",
                     jobThis: stu ? "このバイト先を追加" : "この勤務先を追加",
                     jobEg: stu ? "バイト先の名前（例：マクド、塾）" : "勤務先の名前（例：〇〇病院、駅前店）",
                     wageHead: stu ? "バイトと給料" : "働いた時間と給料", shift: wname,
                     titleEg: p == "work" ? "タイトル（例：定例、〇〇社 打ち合わせ）" : p == "family" ? "タイトル（例：保育園の面談、通院）"
                        : p == "shift" ? "タイトル（例：日勤、通院）" : p == "free" ? "タイトル（例：〇〇社 納品、打ち合わせ）" : "タイトル",
                     placeEg: stu ? "店名や住所（例：渋谷駅、○○カフェ）" : "住所や会議室（例：本社 5F 会議室A、〇〇クリニック）",
                     typeEg: stu ? "種類の名前（例：ジム、勉強）" : "種類の名前（例：通院、習い事）",
                     remindTitle: stu ? "おつかれさま" : "お疲れさまでした")
    }

    /// 小さなカレンダーのマス（日にちえらび・複数日えらび）
    func pickCells(_ pY: Int, _ pM: Int, _ dr: [String: JSONValue], multi: Bool) -> [FormView.Cell] {
        let ws = JS.int(settings["weekStart"])
        let first = ((Civil.weekday(pY, pM, 1) - ws) % 7 + 7) % 7
        let dim = Civil.daysInMonth(pY, pM)
        let extras = (dr["extraDays"]?.array ?? [])
        let t = state["today"]
        var cells: [FormView.Cell] = Array(repeating: .init(day: nil, isMain: false, isExtra: false, isToday: false, color: "", weight: 0, bg: "", border: ""), count: first)
        for d2 in 1...dim {
            let isMain = dr["y"] == .number(Double(pY)) && dr["m"] == .number(Double(pM)) && dr["day"] == .number(Double(d2))
            let isExtra = extras.contains(.string("\(pY)-\(pM)-\(d2)"))
            let sel = isMain || isExtra
            let isToday = t?["y"] == .number(Double(pY)) && t?["m"] == .number(Double(pM)) && t?["d"] == .number(Double(d2))
            let dw2 = Civil.weekday(pY, pM, d2)
            let c2 = (Holidays.name(pY, pM, d2) != nil || dw2 == 0) ? "var(--sun)" : dw2 == 6 ? "var(--sat)" : "var(--ink-soft)"
            let border = isExtra ? "1.5px solid var(--ink)" : (!multi && !sel && isToday) ? "1px solid var(--line)" : "1px solid transparent"
            cells.append(.init(day: d2, isMain: isMain, isExtra: isExtra, isToday: isToday, color: isMain ? "var(--card)" : c2,
                               weight: multi ? (sel ? 700 : 500) : (sel ? 700 : (isToday ? 700 : 500)),
                               bg: isMain ? "var(--ink)" : isExtra ? "var(--bg2)" : "transparent", border: border))
        }
        return cells
    }
}

extension Engine {
    /// 新しい予定／予定を編集の画面の中身
    public func formView() -> FormView {
        let st = state, c = core()
        let dr = draftObj
        let dt = c.T(dr["type"]) ?? [:]
        let W = c.words()
        var v = FormView()
        let editing = JS.truthy(dr["editingId"])
        v.editing = editing
        v.newTitle = editing ? "予定を編集" : "新しい予定"
        v.titlePlaceholder = W.titleEg
        v.draftColor = JS.string(dt["color"])
        v.draftColorDeep = AppCore.rgb(TypeDefs.mixHex(JS.string(dt["color"]), "#000000", 0.35))
        v.titleAutoFocus = st["screen"] == "new" && !editing && !JS.truthy(dr["title"])
        // よく入れる予定（ここ 3 か月で多い題名。打ち始めたら、その字を含むものに絞る）
        if st["screen"] == "new" && !editing {
            v.suggests = suggestList().map { .init(label: JS.string($0["title"]), color: JS.string(c.T($0["type"])?["color"])) }
        }
        let allDay = JS.truthy(dr["allDay"])
        if !allDay {
            let len = ((c.mins(JS.string(dr["end"])) - c.mins(JS.string(dr["start"]))) + 1440).truncatingRemainder(dividingBy: 1440)
            v.durChips = FormCore.durations.map { .init(key: .number(Double($0.0)), label: $0.1, sel: len == Double($0.0)) }
        }
        // 時間の重なり（止めはしない。知らせるだけ）
        if st["screen"] == "new" && !allDay && !JS.truthy(dr["someday"]) {
            let a = c.mins(JS.string(dr["start"])), b0 = c.mins(JS.string(dr["end"]))
            let b = b0 <= a ? 1440 : b0
            let n = Civil.dayNo(JS.int(dr["y"]), JS.int(dr["m"]), JS.int(dr["day"]))
            let hit = events.filter { e in e["id"] != dr["editingId"] && e["status"] != "nakunatta" && !JS.truthy(e["allDay"]) && AppCore.evFrom(e) == n }
                .filter { e in let x = c.mins(JS.string(e["start"])), y0 = WhenLib.busyEndMin(e); return x < b && y0 > a }
            if let h = hit.first {
                v.overlapNote = "この時間は「\(JS.string(h["title"]))」\(h["status"] == "mikakutei" ? "（まだの予定）" : "")と重なっています" + (hit.count > 1 ? "（ほか\(hit.count - 1)件）" : "")
            }
        }
        let extras = (dr["extraDays"]?.array ?? []).count
        v.candShown = dr["status"] == "mikakutei" && extras > 0 && !editing
        v.candOn = JS.truthy(dr["cand"])
        if !editing { v.somedayChips = FormCore.somedayWhen.map { .init(key: .string($0), label: MonthCore.somedayLabel[$0]!, sel: dr["someday"] == .string($0)) } }
        v.somedayOn = JS.truthy(dr["someday"])
        v.somedayText = JS.truthy(dr["someday"]) ? (MonthCore.somedayLabel[JS.string(dr["someday"])] ?? "undefined") + "（日が決まったら、棚からカレンダーへ移せます）" : ""
        v.secretOn = JS.truthy(dr["secret"])
        // 日にち
        let y = JS.int(dr["y"]), m = JS.int(dr["m"]), day = JS.int(dr["day"])
        v.dateLabel = "\(JS.string(dr["y"]))年\(JS.string(.number(JS.number(dr["m"]) + 1)))月\(JS.string(dr["day"]))日（\(FormCore.dow[Civil.weekday(y, m, day)])）"
        v.dateOpen = dr["picking"] == "date"
        v.dateExtraCount = extras
        v.dateSummary = extras > 0 ? "ほか\(extras)日" : ""
        v.dateHint = v.dateOpen ? "日をえらんでください" : ""
        let pY = (dr["pickY"] == nil || dr["pickY"] == .null) ? y : JS.int(dr["pickY"])
        let pM = (dr["pickM"] == nil || dr["pickM"] == .null) ? m : JS.int(dr["pickM"])
        v.datePickLabel = "\(pY)年\(pM + 1)月"
        v.ymPickOpen = JS.truthy(dr["pickYM"])
        v.ymYearLabel = String(pY)
        v.ymMonths = (0..<12).map { .init(key: .number(Double($0)), label: "\($0 + 1)月", sel: $0 == pM) }
        let ws = JS.int(settings["weekStart"])
        v.dateWeekdays = (0..<7).map { i in let dw = (i + ws) % 7; return (FormCore.dow[dw], dw == 0 ? "var(--sun)" : dw == 6 ? "var(--sat)" : "var(--ink-faint)") }
        v.dateCells = c.pickCells(pY, pM, dr, multi: false)
        // 勤務先
        v.jobPickerShown = dr["type"] == "baito"
        v.jobWordNew = W.job; v.jobThisNew = W.jobThis
        v.jobChips = jobsList.map { j in .init(key: j["id"] ?? .null, label: JS.string(JS.or(j["name"], "名前なし")) + "　¥" + JS.string(j["hourly"]), sel: j["id"] == dr["jobId"]) }
        v.jobNone = .init(key: .null, label: W.jobNone, sel: !JS.truthy(dr["jobId"]))
        if let nj = st["newJob"], JS.truthy(nj) {
            v.newJobShown = true
            v.newJobName = JS.string(nj["name"]); v.newJobEg = W.jobEg; v.newJobHourly = JS.string(nj["hourly"])
        }
        v.timed = !allDay
        let n = max(1, min(60, Int(JS.toInt32(dr["days"])) != 0 ? Int(JS.toInt32(dr["days"])) : 1))
        v.spanDays = n
        v.spanCountLabel = n == 1 ? "1日" : "\(n)日間"
        v.spanRangeLabel = n == 1 ? "" : c.spanLabel(["y": dr["y"] ?? .null, "m": dr["m"] ?? .null, "day": dr["day"] ?? .null, "days": .number(Double(n))])
        v.spanHint = n == 1 ? "2日以上にすると、カレンダーで1本の帯になります" : ""
        // 行にたたむ
        let picking = dr["picking"]
        v.rowTypeOpen = picking == "type"; v.typeValue = JS.string(dt["name"]); v.typeColor = JS.string(dt["color"])
        v.rowJobOpen = picking == "job"
        let j = jobsList.first { $0["id"] == dr["jobId"] }
        v.jobValue = j.map { JS.string(JS.or($0["name"], "名前なし")) } ?? "設定の時給"
        let added = (dr["added"]?.array ?? []).map { JS.string($0) }
        let addable: [(String, String, Bool)] = [("rep", "くり返し", editing), ("multi", "複数日", editing), ("place", "場所", false), ("link", "Web会議・リンク", false), ("memo", "メモ", false)]
        v.addChips = addable.filter { !$0.2 && !added.contains($0.0) }.map { .init(key: .string($0.0), label: $0.1, sel: false) }
        v.repRowShown = added.contains("rep") && !editing
        v.multiRowShown = added.contains("multi") && !editing
        v.placeRowShown = added.contains("place"); v.memoRowShown = added.contains("memo"); v.linkRowShown = added.contains("link")
        v.rowLinkOpen = picking == "link"
        let link = JS.string(JS.or(dr["link"], "")).jsTrimmed
        if link.isEmpty { v.linkValue = "なし" } else {
            let bare = link.replacingOccurrences(of: "^https?://", with: "", options: .regularExpression)
            v.linkValue = JS.slice16(bare, 22) + (link.utf16.count > 30 ? "…" : "")
        }
        v.rowPlaceOpen = picking == "place"
        let place = JS.string(JS.or(dr["place"], "")).jsTrimmed
        v.placeValue = place.isEmpty ? "なし" : place
        v.placePlaceholder = W.placeEg
        v.rowMemoOpen = picking == "memo"
        let memo = JS.string(JS.or(dr["memo"], "")).jsTrimmed
        if memo.isEmpty { v.memoValue = "なし" } else {
            let firstLine = memo.components(separatedBy: "\n").first ?? ""
            v.memoValue = JS.slice16(firstLine, 12) + (memo.utf16.count > 12 || memo.contains("\n") ? "…" : "")
        }
        // 複数日
        v.rowMultiOpen = picking == "multi"
        v.multiValue = extras > 0 ? "ほか\(extras)日" : "なし"
        v.multiClearShown = extras > 0
        v.multiHint = extras > 0 ? "この予定を、ぜんぶで\(extras + 1)日に置きます" : "同じ予定を置きたい日を、タップしてえらんでください"
        v.multiPickLabel = "\(pY)年\(pM + 1)月"
        v.multiCells = c.pickCells(pY, pM, dr, multi: true)
        // くり返し
        v.rowRepOpen = picking == "rep"
        let myDow = Civil.weekday(y, m, day)
        let dows = (dr["repDows"]?.array ?? []).map { JS.int($0) }
        let span = Int(JS.toInt32(dr["repSpan"])) != 0 ? Int(JS.toInt32(dr["repSpan"])) : 3
        let nth = (dr["repNth"]?.array ?? []).map { JS.int($0) }
        let made = Engine.repeatAfter(y, m, day, dr["repEvery"], span, dr["repDows"], dr["repNth"])
        let dowText = dows.isEmpty ? FormCore.dow[myDow] : dows.sorted { String($0) < String($1) }.map { FormCore.dow.indices.contains($0) ? FormCore.dow[$0] : "" }.joined(separator: "・")
        let myNth = min(5, (day - 1) / 7 + 1)
        let every = dr["repEvery"]
        switch every?.string {
        case nil where !JS.truthy(every): v.repValue = "なし"
        case "day": v.repValue = "毎日"
        case "weekday": v.repValue = "平日（月〜金）"
        case "week": v.repValue = "毎週" + dowText
        case "biweek": v.repValue = "2週ごと " + dowText
        case "month": v.repValue = "毎月\(day)日"
        case "nth": v.repValue = "毎月 \((nth.isEmpty ? [myNth] : nth).sorted { String($0) < String($1) }.map { FormCore.nthLabel[$0] ?? "" }.joined(separator: "・")) \(dowText)曜"
        case "monthEnd": v.repValue = "毎月 月末"
        default: v.repValue = JS.truthy(every) ? "毎年\(m + 1)月\(day)日" : "なし"
        }
        v.repNthShown = every == "nth"
        v.repNthChips = [1, 2, 3, 4, 5].map { k in .init(key: .number(Double(k)), label: FormCore.nthLabel[k]!, sel: nth.isEmpty ? k == myNth : nth.contains(k)) }
        let curEvery: JSONValue = JS.truthy(every) ? every! : .null
        v.repEveryChips = [FormView.Chip(key: .null, label: "なし", sel: curEvery == .null)] + FormCore.repeatUnits.map { .init(key: .string($0.key), label: $0.label, sel: curEvery == .string($0.key)) }
        v.repUntilShown = JS.truthy(every)
        v.repDowShown = ["week", "biweek", "nth"].contains(every?.string ?? "")
        v.repDowChips = (0..<7).map { i in .init(key: .number(Double(i)), label: FormCore.dow[i], sel: dows.isEmpty ? i == myDow : dows.contains(i)) }
        v.repWeekChips = FormCore.spansFor(every).map { .init(key: .number(Double($0.m)), label: $0.label, sel: span == $0.m) }
        if let lastN = made.last {
            let last = Civil.fromDayNo(lastN)
            v.repHint = "\(last.y != y ? "\(last.y)年" : "")\(last.m + 1)月\(last.d)日まで、ぜんぶで\(made.count + 1)件つくります"
        } else { v.repHint = JS.truthy(every) ? "この長さでは、ほかに置ける日がありません" : "" }
        // お知らせ
        v.rowRemindOpen = picking == "remind"
        v.remindValue = JS.truthy(settings["notifyOff"]) ? "通知はオフ" : (dr["remindMin"]?.number != nil ? c.remindLabel(dr["remindMin"], dr["allDay"]) : "なし")
        let cur: JSONValue = dr["remindMin"]?.number.map { .number($0) } ?? .null
        v.remindSeg = (allDay ? FormCore.remindAllDay : FormCore.remindTimed).map { .init(key: $0.0, label: $0.1, sel: cur == $0.0) }
        if case .number(let r) = cur {
            v.remindNote = allDay ? (r == 0 ? "当日の朝9時にお知らせします" : "\(JS.numberToString(r / 1440))日前の朝9時にお知らせします")
                : (r >= 1440 ? "\(JS.numberToString(r / 1440))日前の同じ時刻にお知らせします"
                   : "始まる\(r >= 60 ? JS.numberToString(JS.round(r / 60)) + "時間" : JS.numberToString(r) + "分")前にお知らせします")
        }
        // 時刻
        v.startValue = JS.string(dr["start"]); v.endValue = JS.string(dr["end"])
        v.startOpen = picking == "start"; v.endOpen = picking == "end"
        func fmtDay(_ o: (y: Int, m: Int, d: Int)) -> String { "\(o.m + 1)月\(o.d)日（\(FormCore.dow[Civil.weekday(o.y, o.m, o.d)])）" }
        v.startDateText = fmtDay((y, m, day))
        let wraps = !allDay && WhenLib.endsNextDay(["start": dr["start"] ?? .null, "end": dr["end"] ?? .null])
        let endN = Civil.dayNo(y, m, day) + (allDay ? n - 1 : (wraps ? 1 : 0))
        v.endDateText = fmtDay(Civil.fromDayNo(endN))
        v.endNextDay = wraps
        v.crossNote = wraps ? "日をまたぐので、終わりは翌日です" : ""
        // 種類（隠した種類は出さない。いまの種類なら出す）
        v.chips = typesList.filter { !JS.truthy($0["hidden"]) || $0["key"] == dr["type"] }.map { t in (t["key"] ?? .null, JS.string(t["name"]), dr["type"] == t["key"], JS.string(t["color"])) }
        if let nt = st["newType"], JS.truthy(nt) {
            v.newTypeShown = true
            v.newTypeName = JS.string(nt["name"]); v.newTypeEg = W.typeEg; v.newTypeColor = JS.string(nt["color"])
            v.swatches = FormCore.pal.map { ($0, nt["color"] == .string($0)) }
        }
        // 決まってる／まだ（言葉は種類ごと）
        v.seg = [.init(key: "kakutei", label: JS.string(JS.or(dt["cLabel"], "決まってる")), sel: dr["status"] == "kakutei"),
                 .init(key: "mikakutei", label: JS.string(JS.or(dt["uLabel"], "まだ不確定")), sel: dr["status"] == "mikakutei")]
        let und = dr["status"] == "mikakutei"
        v.previewExplain = und ? JS.string(dt["uWord"]) + "として、点線で置かれます" : JS.string(dt["cWord"]) + "として、塗りで置かれます"
        v.previewDashed = und
        v.previewBg = JS.string(und ? dt["paper"] : dt["color"])
        v.previewBorder = und ? "1.5px dashed " + JS.string(dt["color"]) : ""
        return v
    }

    /// よく入れる予定の元（最後の回）。多い順に 6 つまで
    func suggestList() -> [Obj] {
        let dr = draftObj
        let t = today
        let since = Civil.dayNo(t.y, t.m, t.d) - 92
        let q = JS.string(JS.or(dr["title"], "")).jsTrimmed
        var order: [String] = []
        var by: [String: (n: Int, last: Obj)] = [:]
        for e in events {
            if e["status"] == "nakunatta" || AppCore.evFrom(e) < since { continue }
            let title = JS.string(JS.or(e["title"], "")).jsTrimmed
            if title.isEmpty || e["title"] == "無題" { continue }
            let k = JS.string(e["type"]) + "|" + title
            if var cur = by[k] {
                cur.n += 1
                if AppCore.evFrom(e) > AppCore.evFrom(cur.last) { cur.last = e }
                by[k] = cur
            } else { order.append(k); by[k] = (1, e) }
        }
        var list = order.map { by[$0]! }.filter { $0.n >= 2 || !q.isEmpty }
        if !q.isEmpty { list = list.filter { let tt = JS.string($0.last["title"]); return ImportCore.includes(tt, q) && tt != q } }
        list = JS.stableSorted(list) { a, b in b.n - a.n < 0 ? -1 : (b.n - a.n > 0 ? 1 : 0) }
        return list.prefix(6).map { $0.last }
    }
}
