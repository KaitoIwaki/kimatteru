import Foundation

/// 設定の画面の中身（Web 版 _settingsVals の写し）
public struct SettingsView: Equatable {
    public struct Opt: Equatable { public var key: JSONValue; public var label: String; public var sel: Bool }
    public struct TypeRow: Equatable {
        public var key: JSONValue, name: String, color: String, hidden: Bool, open: Bool, hint: String, usedCount: Int
        public var uWord: String, cWord: String, hideLabel: String, canUp: Bool, canDown: Bool, canDelete: Bool, deleting: Bool
        public var moveTo: [(key: JSONValue, label: String)]
        public static func == (a: TypeRow, b: TypeRow) -> Bool {
            a.key == b.key && a.name == b.name && a.hidden == b.hidden && a.open == b.open && a.hint == b.hint && a.usedCount == b.usedCount && a.uWord == b.uWord
                && a.cWord == b.cWord && a.hideLabel == b.hideLabel && a.canUp == b.canUp && a.canDown == b.canDown && a.canDelete == b.canDelete && a.deleting == b.deleting
                && a.moveTo.map { [$0.key, .string($0.label)] } == b.moveTo.map { [$0.key, .string($0.label)] }
        }
    }
    public struct JobRow: Equatable {
        public var id: JSONValue, name: String, hourly: String, open: Bool, retired: Bool, retireLabel: String, rateNote: Bool
        public var closeDay: Int, payDay: Int, templates: [String], usedCount: Int
    }
    public struct TrashRow: Equatable { public var key: JSONValue; public var title: String; public var when: String; public var gone: String }

    public var page = "", backLabel = "", pageTitle = ""
    public var notifyOn = true
    public var profileLabel = ""
    public var profileOpts: [Opt] = [], profileRetireShown = false, profileRetireOn = false
    public var typeRows: [TypeRow] = []
    public var themeSeg: [Opt] = [], fontSeg: [Opt] = [], themeLabel = "", fontLabel = ""
    public var barTime = false, kariMark = false, hideCanceled = false
    public var freeWd: [Double] = [], freeHd: [Double] = [], freeWdLabel = "", freeHdLabel = ""
    public var workHoursOn = false, workFrom = 0.0, workTo = 0.0, workDays: [Bool] = [], workLabel = ""
    public var morning = false, morningAt = 450.0, evening = false, weekly = false, hideTitles = false, remind = false
    public var remindTimedSeg: [Opt] = [], remindAllDaySeg: [Opt] = [], remindTimedLabel = "", remindAllDayLabel = ""
    public var jobWord = "", jobAddLabel = "", jobEg = "", wageHead = ""
    public var wageFeatureSeg: [Opt] = [], wageFeatureLabel = ""
    public var jobRows: [JobRow] = []
    public var retiredCount = 0, showRetired = false, jobsEmpty = true, jobsLabel = ""
    public var leaveShown = false, leaveGrant = "", leaveStart = 0, leaveText = "", leaveLabel = ""
    public var lastBackupText = "", lastExportText = ""
    public var trashCount = 0, trashRows: [TrashRow] = []
    public var undoImportShown = false, undoImportLabel = ""
    public var overlayOn = false, overlayLabel = "", exportCal = false, backupLabel = "", lastExportLabel = ""
    public var sync = false, syncSub = "", lock = false
    public var typeCount = 0, typeDots: [String] = []
    // 設定の中の画面で使う残り（Web 版 _settingsVals・renderVals のうち、ここまでに無かったもの）
    public var weekSeg: [Opt] = []
    public var remindRowShown = false, overlayFree = false, overlayCalsShown = false, syncShown = true
    public var newTypeShown = false, newTypeName = "", newTypeEg = "", newTypeColor = ""
    public var tplNewShown = false, tplSym = "", tplName = "", tplFrom = 0.0, tplTo = 0.0, tplBrk = 0.0, tplAllDay = false
    public var tidyCount = 0
    public var backupListShown = false, backupRows: [Engine.BackupRow] = []
    public var pasteOpen = false, backupText = "", backupError = "", restoreDisabled = true
    public var trashShown = false
}

extension Engine {
    static let setParent = ["work": "free", "jobs": "wage", "leave": "wage", "overlay": "iphone", "backup": "data", "files": "data"]

    public func settingsView() -> SettingsView {
        var v = SettingsView()
        let c = core(), cfg = settings, W = c.words()
        let page = JS.string(JS.or(state["setPage"], ""))
        v.page = page
        v.backLabel = Self.setParent[page] != nil ? "戻る" : "設定"
        let titles = ["support": "応援する", "display": "カレンダーと表示", "free": "空き状況", "notify": "通知", "wage": W.wageHead.isEmpty ? "給料" : W.wageHead,
                      "iphone": "iPhone のカレンダー", "data": "保存と安全", "help": "ヘルプ", "types": "予定の種類", "work": "勤務時間", "jobs": W.job,
                      "leave": "有給", "overlay": "重ねて表示", "backup": "控えと機種変更", "files": "ファイルで出し入れ"]
        v.pageTitle = titles[page] ?? ""
        func hm(_ m: Double) -> String { c.fmtMin(m).replacingOccurrences(of: "^0(\\d):", with: "$1:", options: .regularExpression) }
        func pick(_ o: [SettingsView.Opt]) -> String { o.first { $0.sel }?.label ?? "" }
        v.notifyOn = !JS.truthy(cfg["notifyOff"])
        let pk = c.profile()
        v.profileLabel = Profile.all[pk]?.label ?? ""
        if let ps = state["profileSheet"], JS.truthy(ps) {
            v.profileOpts = Profile.keys.map { .init(key: .string($0), label: Profile.all[$0]!.label, sel: $0 == pk) }
            v.profileRetireShown = pk == "student" && jobsList.contains { !JS.truthy($0["retired"]) }
            v.profileRetireOn = JS.truthy(ps["retire"])
        }
        let types = typesList
        v.typeCount = types.count
        v.typeDots = types.prefix(6).map { JS.string($0["color"]) }
        v.typeRows = types.enumerated().map { i, t in
            let open = state["editTypeKey"] == t["key"]
            let deleting = state["typeDelete"] == t["key"]
            return .init(key: t["key"] ?? .null, name: JS.string(t["name"]), color: JS.string(t["color"]), hidden: JS.truthy(t["hidden"]), open: open,
                         hint: open ? "" : (JS.truthy(t["hidden"]) ? "隠している" : "名前と色"), usedCount: events.filter { $0["type"] == t["key"] }.count,
                         uWord: JS.string(JS.or(t["uWord"], "")), cWord: JS.string(JS.or(t["cWord"], "")), hideLabel: JS.truthy(t["hidden"]) ? "出す" : "隠す",
                         canUp: i > 0, canDown: i < types.count - 1, canDelete: types.count > 1, deleting: deleting,
                         moveTo: deleting ? types.filter { $0["key"] != t["key"] }.map { ($0["key"] ?? .null, JS.string($0["name"])) } : [])
        }
        let theme = JS.truthy(cfg["theme"]) ? JS.string(cfg["theme"]) : (JS.truthy(cfg["dark"]) ? "dark" : "light")
        v.themeSeg = [("auto", "iPhoneに合わせる"), ("light", "明るい"), ("dark", "暗い")].map { .init(key: .string($0.0), label: $0.1, sel: theme == $0.0) }
        let fs0: JSONValue = cfg["fontScale"]?.number.map { .number($0) } ?? "auto"
        v.fontSeg = [(JSONValue.string("auto"), "iPhoneに合わせる"), (.number(1), "標準"), (.number(1.12), "大きめ"), (.number(1.25), "特大")].map { .init(key: $0.0, label: $0.1, sel: fs0 == $0.0) }
        v.themeLabel = pick(v.themeSeg); v.fontLabel = pick(v.fontSeg)
        v.barTime = JS.truthy(cfg["barTime"]); v.kariMark = JS.truthy(cfg["kariMark"]); v.hideCanceled = JS.truthy(cfg["hideCanceled"])
        let wd = JS.truthy(cfg["freeWd"]) ? (cfg["freeWd"]?.array ?? []).map { JS.number($0) } : [540, 1320]
        let hd = JS.truthy(cfg["freeHd"]) ? (cfg["freeHd"]?.array ?? []).map { JS.number($0) } : [540, 1320]
        v.freeWd = wd; v.freeHd = hd
        func pair(_ a: [Double]) -> String { hm(a.count > 0 ? a[0] : .nan) + "〜" + hm(a.count > 1 ? a[1] : .nan) }
        v.freeWdLabel = pair(wd); v.freeHdLabel = pair(hd)
        let wh = cfg["workHours"].flatMap { JS.truthy($0) ? $0 : nil }
        v.workHoursOn = wh != nil
        if let wh {
            v.workFrom = JS.number(wh["from"]); v.workTo = JS.number(wh["to"])
            let days = (wh["days"]?.array ?? []).map { JS.number($0) }
            v.workDays = (0..<7).map { days.contains(Double($0)) }
            let dn = ["日", "月", "火", "水", "木", "金", "土"]
            let ds = days.sorted()
            let run = ds.count > 2 && ds.enumerated().allSatisfy { i, d in i == 0 || d == ds[i - 1] + 1 }
            func name(_ d: Double) -> String { let i = JS.int(.number(d)); return dn.indices.contains(i) ? dn[i] : "" }
            v.workLabel = ds.isEmpty ? "曜日なし" : (run ? name(ds[0]) + "〜" + name(ds[ds.count - 1]) : ds.map(name).joined()) + " " + hm(JS.number(wh["from"])) + "〜" + hm(JS.number(wh["to"]))
        } else { v.workLabel = "なし" }
        v.morning = JS.truthy(cfg["morning"]); v.morningAt = cfg["morningAt"]?.number ?? 450
        v.evening = JS.truthy(cfg["evening"]); v.weekly = JS.truthy(cfg["weekly"]); v.hideTitles = JS.truthy(cfg["hideTitles"]); v.remind = JS.truthy(cfg["remind"])
        let rt: JSONValue = cfg["remindTimed"]?.number.map { .number($0) } ?? .null
        let ra: JSONValue = cfg["remindAllDay"]?.number.map { .number($0) } ?? .null
        v.remindTimedSeg = [(JSONValue.null, "なし"), (.number(10), "10分前"), (.number(30), "30分前"), (.number(60), "1時間前")].map { .init(key: $0.0, label: $0.1, sel: rt == $0.0) }
        v.remindAllDaySeg = [(JSONValue.null, "なし"), (.number(0), "当日の朝"), (.number(1440), "前日の朝")].map { .init(key: $0.0, label: $0.1, sel: ra == $0.0) }
        v.remindTimedLabel = pick(v.remindTimedSeg); v.remindAllDayLabel = pick(v.remindAllDaySeg)
        v.jobWord = W.job; v.jobAddLabel = W.jobAdd; v.jobEg = W.jobEg; v.wageHead = W.wageHead
        let wf = JS.or(cfg["wageFeature"], "auto")
        v.wageFeatureSeg = [("auto", "記録があれば"), ("on", "いつも"), ("off", "使わない")].map { .init(key: .string($0.0), label: $0.1, sel: wf == .string($0.0)) }
        v.wageFeatureLabel = pick(v.wageFeatureSeg)
        let showRetired = JS.truthy(state["showRetired"])
        v.jobRows = jobsList.filter { !JS.truthy($0["retired"]) || showRetired }.map { j in
            .init(id: j["id"] ?? .null, name: JS.string(JS.or(j["name"], "（名前なし）")) + (JS.truthy(j["retired"]) ? "（辞めた）" : ""), hourly: JS.string(j["hourly"]),
                  open: state["editJobId"] == j["id"], retired: JS.truthy(j["retired"]), retireLabel: JS.truthy(j["retired"]) ? "辞めたを取り消す" : "辞めた（しまう）",
                  rateNote: state["rateNote"] == j["id"], closeDay: JS.truthy(j["closeDay"]) ? JS.int(j["closeDay"]) : 0, payDay: JS.truthy(j["payDay"]) ? JS.int(j["payDay"]) : 0,
                  templates: (j["templates"]?.array ?? []).map { t in
                      "\(JS.string(t["sym"]))　\(JS.string(JS.or(t["name"], ""))) \(JS.truthy(t["allDay"]) ? "（休み）" : c.fmtMin(JS.number(t["from"])) + "–" + c.fmtMin(JS.number(t["to"])))"
                  },
                  usedCount: events.filter { $0["jobId"] == j["id"] }.count)
        }
        v.retiredCount = jobsList.filter { JS.truthy($0["retired"]) }.count
        v.showRetired = showRetired
        let act = jobsList.filter { !JS.truthy($0["retired"]) }
        v.jobsEmpty = act.isEmpty
        v.jobsLabel = act.isEmpty ? "なし" : JS.string(JS.or(act[0]["name"], "（名前なし）")) + (act.count > 1 ? " ほか\(act.count - 1)" : "")
        let pl = cfg["paidLeave"].flatMap { JS.truthy($0) ? $0 : nil }
        v.leaveShown = pl != nil
        let ls = pl != nil ? leaveSummary() : nil
        if let pl {
            v.leaveGrant = JS.string(pl["grant"]); v.leaveStart = JS.int(pl["start"])
            v.leaveText = ls?["text"]?.string ?? ""
        }
        if let s = ls?["short"]?.string {
            v.leaveLabel = s.replacingOccurrences(of: "^有給 ", with: "", options: .regularExpression).replacingOccurrences(of: "（.*$", with: "", options: .regularExpression)
        } else { v.leaveLabel = "オフ" }
        func d0(_ ms: JSONValue?) -> String {
            guard JS.truthy(ms) else { return "" }
            let p = JSDate.local(JSDate.ms(ms), timeZone)
            return "\(p.m + 1)月\(p.d)日"
        }
        v.lastBackupText = JS.truthy(cfg["lastAutoBackup"]) ? "自動の控え：\(d0(cfg["lastAutoBackup"]))（毎日1回、端末の中に7日分）" : "自動の控え：まだありません（予定を入れると、毎日1回とります）"
        v.lastExportText = JS.truthy(cfg["lastExportAt"]) ? "書き出した控え：\(d0(cfg["lastExportAt"]))" : "書き出した控え：まだ取っていません"
        let tr = (state["trash"]?.array ?? []).compactMap { $0.object }
        v.trashCount = tr.count
        if JS.truthy(state["trashOpen"]) {
            v.trashRows = tr.prefix(100).map { x in
                let ev = x["ev"] ?? .null
                return .init(key: ev["id"] ?? .null, title: JS.string(ev["title"]),
                             when: JS.truthy(x["someday"]) ? "日にち未定" : "\(JS.string(.number(JS.number(ev["m"]) + 1)))/\(JS.string(ev["day"]))", gone: "\(d0(x["at"]))に削除")
            }
        }
        if let li = cfg["lastImport"], JS.truthy(li), JS.truthy(li["tag"]) {
            let prefix = JS.string(li["tag"]) + "-"
            let n = events.filter { JS.string($0["id"]).utf16.starts(with: prefix.utf16) }.count
            v.undoImportShown = n > 0
            if n > 0 { v.undoImportLabel = "最後の取り込みを取り消す（\(n)件）" }
        }
        v.overlayOn = JS.truthy(cfg["overlayOn"])
        v.overlayLabel = v.overlayOn ? "\((cfg["overlayIds"]?.array ?? []).count)つ" : "オフ"
        v.exportCal = JS.truthy(cfg["exportCal"])
        v.backupLabel = JS.truthy(cfg["lastAutoBackup"]) ? d0(cfg["lastAutoBackup"]) : ""
        v.lastExportLabel = JS.truthy(cfg["lastExportAt"]) ? d0(cfg["lastExportAt"]) : ""
        v.sync = JS.truthy(cfg["sync"])
        if v.sync {
            if JS.truthy(cfg["lastSyncAt"]) {
                let p = JSDate.local(JSDate.ms(cfg["lastSyncAt"]), timeZone)
                v.syncSub = "最後に合わせた時刻 \(p.h):" + (p.min < 10 ? "0\(p.min)" : "\(p.min)")
            } else { v.syncSub = "合わせています…" }
        }
        v.lock = JS.truthy(cfg["lock"])
        let ws = cfg["weekStart"]
        v.weekSeg = [(0, "日曜日"), (1, "月曜日")].map { .init(key: .number(Double($0.0)), label: $0.1, sel: ws == .number(Double($0.0))) }
        // 「働いたあとに記録を聞く」：勤務先が 1 つでもある（辞めたも含む）。通知はいつも使える（iPhone）
        v.remindRowShown = !jobsList.isEmpty
        v.overlayFree = JS.truthy(cfg["overlayFree"])
        v.overlayCalsShown = !(state["overlayCals"]?.array ?? []).isEmpty
        if let nt = state["newType"], JS.truthy(nt) {
            v.newTypeShown = true
            v.newTypeName = JS.string(nt["name"]); v.newTypeEg = W.typeEg; v.newTypeColor = JS.string(nt["color"])
        }
        if let t = state["tplNew"], JS.truthy(t) {
            v.tplNewShown = true
            v.tplSym = JS.string(t["sym"]); v.tplName = JS.string(t["name"])
            v.tplFrom = JS.number(t["from"]); v.tplTo = JS.number(t["to"]); v.tplBrk = JS.number(t["brk"]); v.tplAllDay = JS.truthy(t["allDay"])
        }
        v.tidyCount = tidyTargets().count
        v.backupListShown = JS.truthy(state["backupListOpen"])
        v.backupRows = backupRows()
        v.pasteOpen = JS.truthy(state["pasteOpen"])
        v.backupText = JS.string(JS.or(state["backupText"], ""))
        v.backupError = JS.string(JS.or(state["backupError"], ""))
        v.restoreDisabled = JS.trim(v.backupText).isEmpty
        v.trashShown = JS.truthy(state["trashOpen"])
        return v
    }

    // MARK: 設定で押すもの
    public func setPage(_ p: String?) { haptic("light"); set(["setPage": p.map { .string($0) } ?? .null, "editTypeKey": .null, "editJobId": .null, "typeDelete": .null]) }
    public func setBack() {
        haptic("light")
        let p = JS.string(JS.or(state["setPage"], ""))
        set(["setPage": Self.setParent[p].map { .string($0) } ?? .null, "editTypeKey": .null, "editJobId": .null, "typeDelete": .null, "newType": .null])
    }
    public func setTheme(_ k: String) { haptic("light"); set(["settings": .object(Self.with(settings, ["theme": .string(k), "dark": .bool(k == "dark")]))]) }
    public func setFontScale(_ k: JSONValue) { haptic("light"); setSetting("fontScale", k == "auto" ? nil : k) }
    public func setSeg(_ key: String, _ val: JSONValue) { haptic("light"); setSetting(key, val) }
    public func toggleSetting(_ key: String) { setSetting(key, .bool(!JS.truthy(settings[key]))) }
    /// 空き状況の時間（終わりが始まり以下になる選び方は入れない）
    public func setFreeRange(_ key: String, _ i: Int, _ val: Double) {
        var n = JS.truthy(settings[key]) ? (settings[key]?.array ?? []).map { JS.number($0) } : [540, 1320]
        while n.count < 2 { n.append(.nan) }
        n[i] = val
        if n[1] > n[0] { setSetting(key, .array(n.map { .number($0) })) }
    }
    public func toggleWorkHours() {
        setSetting("workHours", JS.truthy(settings["workHours"]) ? JSONValue.null : JSONValue.object(["days": [1, 2, 3, 4, 5], "from": 540, "to": 1080]))
    }
    public func setWorkTime(from: Double? = nil, to: Double? = nil) {
        guard let wh = settings["workHours"]?.object else { return }
        if let from, from < JS.number(wh["to"]) { setSetting("workHours", .object(Self.with(wh, ["from": .number(from)]))) }
        if let to, to > JS.number(wh["from"]) { setSetting("workHours", .object(Self.with(wh, ["to": .number(to)]))) }
    }
    public func toggleWorkDay(_ i: Int) {
        guard let wh = settings["workHours"]?.object else { return }
        haptic("light")
        let days = wh["days"]?.array ?? []
        let d = JSONValue.number(Double(i))
        setSetting("workHours", .object(Self.with(wh, ["days": .array(days.contains(d) ? days.filter { $0 != d } : days + [d])])))
    }
    public func toggleLeave() { setSetting("paidLeave", JS.truthy(settings["paidLeave"]) ? JSONValue.null : JSONValue.object(["grant": 10, "start": 3])) }
    public func setLeaveGrant(_ s: String) {
        guard let pl = settings["paidLeave"]?.object else { return }
        let cleaned = String(String.UnicodeScalarView(s.unicodeScalars.filter { ($0.value >= 0x30 && $0.value <= 0x39) || $0 == "." }))
        // JS の parseFloat：頭から読める数の形だけ
        let m = cleaned.range(of: "^[0-9]*\\.?[0-9]+|^[0-9]+", options: .regularExpression).map { Double(cleaned[$0]) ?? .nan } ?? .nan
        setSetting("paidLeave", .object(Self.with(pl, ["grant": .number(m.isNaN ? 0 : min(60, m))])))
    }
    public func setLeaveStart(_ m: Int) { if let pl = settings["paidLeave"]?.object { setSetting("paidLeave", .object(Self.with(pl, ["start": .number(Double(m))]))) } }
    public func toggleShowRetired() { haptic("light"); set(["showRetired": .bool(!JS.truthy(state["showRetired"]))]) }
    public func editJobRow(_ id: JSONValue?) { set(["editJobId": state["editJobId"] == id ? .null : (id ?? .null)]) }
    public func editTypeRow(_ key: JSONValue?) { set(["editTypeKey": state["editTypeKey"] == key ? .null : (key ?? .null), "typeDelete": .null]) }
    public func askDeleteType(_ key: JSONValue?) { haptic("light"); set(["typeDelete": key ?? .null]) }
    public func askRemoveJob(_ id: JSONValue?) { haptic("light"); set(["confirmJob": id ?? .null]) }
    public func setJobDay(_ id: JSONValue?, close: Int? = nil, pay: Int? = nil) {
        if let close { patchJob(id, ["closeDay": close == 0 ? .null : .number(Double(close))]) }
        if let pay { patchJob(id, ["payDay": pay == 0 ? .null : .number(Double(pay))]) }
    }
    public func setJobHourlyText(_ id: JSONValue?, _ s: String) {
        let digits = s.unicodeScalars.filter { $0.value >= 0x30 && $0.value <= 0x39 }
        let n = Double(String(String.UnicodeScalarView(digits)))
        patchJob(id, ["hourly": .number(n.map { min(99999, $0) } ?? 0)])
    }
    public func removeTemplate(_ jobId: JSONValue?, _ k: Int) {
        guard let j = jobsList.first(where: { $0["id"] == jobId }) else { return }
        haptic("light")
        let tpls = (j["templates"]?.array ?? []).enumerated().map { x, t -> JSONValue in
            (t["id"] != nil && t["id"] != .null) ? t : .object(Self.with(t.object ?? [:], ["id": .string(String(x))]))
        }.enumerated().filter { $0.offset != k }.map { $0.element }
        patchJob(jobId, ["templates": .array(tpls)])
    }
    public func openTemplateNew(_ jobId: JSONValue?) {
        haptic("light")
        set(["tplNew": ["jobId": jobId ?? .null, "sym": "", "name": "", "from": 510, "to": 1050, "brk": 60, "allDay": false]])
    }
    public func patchTemplateNew(_ p: [String: JSONValue?]) { if let t = state["tplNew"]?.object { set(["tplNew": .object(Self.with(t, p))]) } }
    public func saveTemplateNew() {
        guard let t = state["tplNew"]?.object else { return }
        let sym = JS.string(JS.or(t["sym"], "")).jsTrimmed
        if sym.isEmpty { return }
        haptic("light")
        let tpl: JSONValue = ["id": .string(uid("p")), "sym": .string(sym), "name": .string(JS.string(JS.or(t["name"], "")).jsTrimmed),
                              "from": t["from"] ?? .null, "to": t["to"] ?? .null, "brk": t["brk"] ?? .null, "allDay": .bool(JS.truthy(t["allDay"]))]
        set(["tplNew": .null, "jobs": .array(jobsList.map { j in
            j["id"] == t["jobId"] ? .object(Self.with(j, ["templates": .array((j["templates"]?.array ?? []) + [tpl])])) : .object(j)
        })])
    }
    public func openProfileSheet() { haptic("light"); set(["profileSheet": ["retire": false]]) }
    public func toggleProfileRetire() { haptic("light"); if let ps = state["profileSheet"]?.object { set(["profileSheet": .object(Self.with(ps, ["retire": .bool(!JS.truthy(ps["retire"]))]))]) } }
    public func pickProfile(_ k: String) { setProfile(k, JS.truthy(state["profileSheet"]?["retire"]) && k != "student") }
    public func replayGuide() {
        haptic("light")
        set(["settings": .object(Self.with(settings, ["onboarded": false])), "onboard": ["step": 0, "demo": "dash", "picked": .string(core().profile()), "replay": true]])
    }
}
