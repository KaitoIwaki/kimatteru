import Foundation

/// 使い方（Web 版 App.jsx の PROFILES の写し）
public struct Profile {
    public let label: String
    /// 種類の並び（キーと、その使い方での名前）
    public let types: [(String, String?)]
    public let weekStart: Int
    public let wd: [Int], hd: [Int]
    public let work: JSONValue

    public static let keys = ["student", "work", "shift", "free", "family"]
    public static let all: [String: Profile] = [
        "student": Profile(label: "学校とバイト", types: [("yoji", nil), ("baito", nil), ("asobi", nil), ("other", nil)], weekStart: 0, wd: [540, 1320], hd: [540, 1320], work: .null),
        "work": Profile(label: "会社の仕事", types: [("work", nil), ("yoji", nil), ("asobi", "プライベート"), ("family", nil), ("other", nil)], weekStart: 1, wd: [1140, 1380], hd: [600, 1320],
                        work: .object(["days": .array([1.0, 2, 3, 4, 5].map { JSONValue.number($0) }), "from": .number(540), "to": .number(1080)])),
        "shift": Profile(label: "シフト勤務", types: [("baito", "勤務"), ("off", nil), ("yoji", nil), ("asobi", "プライベート"), ("other", nil)], weekStart: 0, wd: [540, 1320], hd: [540, 1320], work: .null),
        "free": Profile(label: "フリーランス・副業", types: [("work", nil), ("baito", "副業"), ("yoji", nil), ("asobi", "プライベート"), ("other", nil)], weekStart: 1, wd: [600, 1320], hd: [600, 1320], work: .null),
        "family": Profile(label: "子育て・家族", types: [("family", "子ども・家族"), ("work", nil), ("yoji", nil), ("asobi", "自分"), ("other", nil)], weekStart: 0, wd: [540, 1260], hd: [540, 1260], work: .null),
    ]
    static let defaultNames = ["yoji": "用事", "baito": "バイト", "asobi": "遊び", "other": "その他", "work": "仕事", "off": "休み", "family": "家族"]
}

/// 予定のほかの操作（勤務先・種類・使い方・シフト入力・取り込み・整理・有給）。Web 版の同じ名前の操作の写し
extension Engine {
    var typesList: [Obj] { (state["types"]?.array ?? []).compactMap { $0.object } }
    var jobsList: [Obj] { (state["jobs"]?.array ?? []).compactMap { $0.object } }
    var draftObj: Obj { state["draft"]?.object ?? [:] }
    var impObj: Obj { state["imp"]?.object ?? [:] }
    func objs(_ list: [Obj]) -> JSONValue { .array(list.map { .object($0) }) }
    /// 最近消した予定の先頭に足す（400 件まで）
    func trashAdding(_ removed: [Obj]) -> JSONValue {
        .array(Array((removed.map { JSONValue.object(["ev": .object($0), "at": num(now)]) } + (state["trash"]?.array ?? [])).prefix(400)))
    }

    /// 使い方で変わる言葉（いまは勤務先の呼び名だけ使う）
    func wordJob() -> String { core().profile() == "student" ? "バイト先" : "勤務先" }

    // MARK: 使い方

    /// 使い方の答えを反映した種類と設定（Web 版 applyProfile）。名前は、その人が変えていなければだけ付け替える
    public func applyProfile(_ key: JSONValue?, _ s: Obj) -> (types: [JSONValue], settings: Obj)? {
        guard case .string(let pk)? = key, let p = Profile.all[pk] else { return nil }
        var cur = (s["types"]?.array ?? []).compactMap { $0.object }
        var listed: [Int] = []
        func untouched(_ t: Obj, _ k: String) -> Bool {
            if !JS.truthy(t["name"]) { return true }
            if let dn = Profile.defaultNames[k], t["name"] == .string(dn) { return true }
            return Profile.all.values.contains { pp in pp.types.contains { kk, nn in kk == k && nn != nil && t["name"] == .string(nn!) } }
        }
        for (k, name) in p.types {
            var idx = cur.firstIndex { $0["key"] == .string(k) }
            if idx == nil {
                guard let t = TypeDefs.extraType(k) else { continue }
                cur.append(t); idx = cur.count - 1
            }
            let i = idx!
            var t = cur[i]
            if untouched(t, k) {
                if let n = name ?? Profile.defaultNames[k] { t["name"] = .string(n) }
            }
            t.removeValue(forKey: "hidden")
            cur[i] = t
            listed.append(i)
        }
        let rest: [Obj] = cur.indices.filter { !listed.contains($0) }.map { i in
            let t = cur[i]
            let k = JS.string(t["key"])
            if k.hasPrefix("c") { return t }
            var r = t
            r["hidden"] = .bool(true)
            if untouched(t, k), let dn = Profile.defaultNames[k] { r["name"] = .string(dn) }
            return r
        }
        let types = listed.map { JSONValue.object(cur[$0]) } + rest.map { .object($0) }
        var st = s["settings"]?.object ?? [:]
        st["profile"] = .string(pk)
        st["weekStart"] = num(Double(p.weekStart))
        st["freeWd"] = .array(p.wd.map { num(Double($0)) })
        st["freeHd"] = .array(p.hd.map { num(Double($0)) })
        st["workHours"] = p.work
        st["kariMark"] = .bool(pk == "work" || pk == "free")
        return (types, st)
    }

    /// 使い方を変える。卒業・就職のときは、バイト先をまとめて「辞めた」にもできる
    public func setProfile(_ key: String, _ retireJobs: Bool) {
        haptic("light")
        guard let r = applyProfile(.string(key), state) else { return }
        let keepWeek = settings["weekStart"]
        var st = r.settings
        if JS.truthy(settings["onboarded"]) { if let keepWeek { st["weekStart"] = keepWeek } else { st.removeValue(forKey: "weekStart") } }
        if retireJobs { st["wageFeature"] = str("auto") }
        let jobs: JSONValue? = retireJobs ? objs(jobsList.map { Self.with($0, ["retired": .bool(true)]) }) : state["jobs"]
        set(["types": .array(r.types), "settings": .object(st), "jobs": jobs, "profileSheet": .null])
        toast("「\(Profile.all[key]?.label ?? "")」に合わせました。予定はそのままです")
    }

    /// 最初の 1 問の答え
    public func onboardPick(_ key: JSONValue?) {
        haptic("light")
        let ob = state["onboard"]?.object ?? [:]
        let next: JSONValue = .object(Self.with(ob, ["step": num(1), "picked": key, "demo": str("dash"), "fast": .bool(false)]))
        // 設定から見直すときは、同じ答えなら何も変えない
        if JS.truthy(ob["replay"]) && key == settings["profile"] { set(["onboard": next]); return }
        guard let r = applyProfile(key, state) else { return }
        if JS.truthy(ob["replay"]) {
            let s0 = settings
            let st = Self.with(r.settings, ["weekStart": s0["weekStart"], "workHours": s0["workHours"], "freeWd": s0["freeWd"], "freeHd": s0["freeHd"], "kariMark": s0["kariMark"]])
            set(["types": .array(r.types), "settings": .object(st), "onboard": next])
            return
        }
        set(["types": .array(r.types), "settings": .object(r.settings), "onboard": next])
    }

    public func finishOnboard(_ goImport: Bool) {
        haptic("heavy")
        let morning = JS.truthy(state["onboard"]?["morning"])
        var st = Self.with(settings, ["onboarded": .bool(true)])
        if morning { st["morning"] = .bool(true); st["morningAt"] = JS.or(settings["morningAt"], num(450)) }
        set(["settings": .object(st), "screen": str(goImport ? "import" : "month")])
        if goImport {
            set(["imp": .object(["phase": str("idle"), "found": .array([]), "type": str("yoji"), "error": str("")])])
            later(0) { [weak self] in self?.onAskImport() }
        }
    }

    // MARK: 勤務先

    public func addJob() {
        haptic("light")
        let id = str(uid("j"))
        let job = Self.with(["id": id, "name": str("")], ["hourly": settings["hourly"]])
        set(["jobs": .array((state["jobs"]?.array ?? []) + [.object(job)]), "editJobId": id])
    }

    /// 時給を変えるときは、それまでの働いた記録に「前の時給」を書き込んでから変える（過去の給料が変わらないように）
    public func patchJob(_ id: JSONValue?, _ patch: Obj) {
        let old = jobsList.first { $0["id"] == id }
        var rateChanged = false
        if let old, case .number? = patch["hourly"], patch["hourly"] != old["hourly"] { rateChanged = true }
        var evs = state["events"]
        if rateChanged, let old {
            evs = eventsArray(events.map { e in
                if e["jobId"] == id && e["status"] == str("jisseki"), e["hourly"]?.number == nil { return Self.with(e, ["hourly": old["hourly"]]) }
                return e
            })
        }
        set(["jobs": objs(jobsList.map { $0["id"] == id ? $0.merging(patch) { _, b in b } : $0 }), "events": evs,
             "rateNote": rateChanged ? (id ?? .null) : state["rateNote"]])
    }

    /// これまでの記録も、いまの時給で数え直す（書き込んだ時給を外す）
    public func recountJob(_ id: JSONValue?) {
        haptic("light")
        set(["events": eventsArray(events.map { e in
            (e["jobId"] == id && e["status"] == str("jisseki") && e["hourly"]?.number != nil) ? Self.with(e, ["hourly": nil, "updatedAt": num(now)]) : e
        }), "rateNote": .null])
        toast("これまでの記録を、いまの時給で数え直しました")
    }

    public func retireJob(_ id: JSONValue?, _ on: Bool) {
        haptic("light")
        set(["jobs": objs(jobsList.map { $0["id"] == id ? Self.with($0, ["retired": on ? .bool(true) : nil]) : $0 }), "editJobId": .null])
    }

    /// 消したバイト先の記録は、名前と時給を予定に書き込んで残す
    public func removeJob(_ id: JSONValue?) {
        let job = jobsList.first { $0["id"] == id }
        let list = events.map { e -> Obj in
            if e["jobId"] != id { return e }
            let isJ = e["status"] == str("jisseki")
            var r = e
            if isJ {
                r = Self.with(r, ["hourly": e["hourly"]?.number != nil ? e["hourly"] : job?["hourly"], "jobName": job?["name"]])
            }
            return Self.with(r, ["jobId": isJ ? e["jobId"] : nil, "updatedAt": num(now)])
        }
        set(["jobs": objs(jobsList.filter { $0["id"] != id }), "editJobId": .null, "confirmJob": .null,
             "gone": goneAdd([str("job:" + JS.string(id))]), "events": eventsArray(list)])
    }

    /// 予定の名前を、選んだ勤務先の名前にしてよいか（本人が書いた名前は残す）
    private func keepTitle(_ dr: Obj) -> Bool {
        let prev = jobsList.first { $0["id"] == dr["jobId"] }
        return JS.truthy(dr["title"]) && dr["title"] != prev?["name"]
    }

    public func pickJob(_ id: JSONValue?) {
        haptic("light")
        let dr = draftObj
        let job = jobsList.first { $0["id"] == id }
        let title: JSONValue? = keepTitle(dr) ? dr["title"] : (job != nil ? job!["name"] : dr["title"])
        set(["draft": .object(Self.with(dr, ["jobId": id, "title": title]))])
    }
    public func clearJob() { set(["draft": .object(Self.with(draftObj, ["jobId": nil]))]) }
    public func startNewJob() {
        haptic("light")
        set(["newJob": .object(Self.with(["name": str("")], ["hourly": settings["hourly"]]))])
    }
    public func cancelNewJob() { set(["newJob": .null]) }
    public func commitNewJob() {
        guard let nj = state["newJob"], JS.truthy(nj) else { return }
        haptic("light")
        let id = str(uid("j"))
        let t = (JS.truthy(nj["name"]) ? JS.string(nj["name"]) : "").jsTrimmed
        let name = t.isEmpty ? wordJob() : t
        let dr = draftObj
        let keep = keepTitle(dr)
        set(["jobs": .array((state["jobs"]?.array ?? []) + [.object(Self.with(["id": id, "name": str(name)], ["hourly": nj["hourly"]]))]), "newJob": .null,
             "draft": .object(Self.with(dr, ["jobId": id, "title": keep ? dr["title"] : str(name)]))])
    }

    // MARK: 複数日えらび
    public func toggleExtraDay(_ y: Int, _ m: Int, _ d: Int) {
        let key = str("\(y)-\(m)-\(d)")
        let dr = draftObj
        if dr["y"] == num(Double(y)) && dr["m"] == num(Double(m)) && dr["day"] == num(Double(d)) { return }
        let cur = dr["extraDays"].flatMap { JS.truthy($0) ? $0.array : nil } ?? []
        let next = cur.contains(key) ? cur.filter { $0 != key } : cur + [key]
        set(["draft": .object(Self.with(dr, ["extraDays": .array(next)]))])
    }

    // MARK: 種類

    public func moveType(_ key: JSONValue?, _ dir: Int) {
        haptic("light")
        var a = state["types"]?.array ?? []
        guard let i = a.firstIndex(where: { $0["key"] == key }) else { return }
        let j = i + dir
        if j < 0 || j >= a.count { return }
        a.swapAt(i, j)
        set(["types": .array(a)])
    }
    public func toggleTypeHidden(_ key: JSONValue?) {
        haptic("light")
        let visible = typesList.filter { !JS.truthy($0["hidden"]) && $0["key"] != key }
        if let t0 = typesList.first(where: { $0["key"] == key }), !JS.truthy(t0["hidden"]), visible.isEmpty { return }  // 最後の 1 つは隠せない
        set(["types": objs(typesList.map { $0["key"] == key ? Self.with($0, ["hidden": JS.truthy($0["hidden"]) ? nil : .bool(true)]) : $0 })])
    }
    /// 消すときは、その種類の予定を別の種類へ移す（予定は消さない）
    public func deleteType(_ key: JSONValue?, _ moveTo: JSONValue?) {
        guard let to = typesList.first(where: { $0["key"] == moveTo && $0["key"] != key }) else { return }
        haptic("heavy")
        set(["types": objs(typesList.filter { $0["key"] != key }), "editTypeKey": .null, "typeDelete": .null, "gone": goneAdd([str("type:" + JS.string(key))]),
             "events": eventsArray(events.map { $0["type"] == key ? Self.with($0, ["type": moveTo, "updatedAt": num(now)]) : $0 })])
        toast("予定を「\(JS.string(to["name"]))」へ移して、種類を消しました")
    }
    /// 種類ごとの呼び名（まだのとき／決まったとき）
    public func setTypeWords(_ key: JSONValue?, _ which: String, _ val: JSONValue?) {
        let v0 = str(JS.slice16(JS.string(JS.or(val, str(""))), 12))
        set(["types": objs(typesList.map { t in
            guard t["key"] == key else { return t }
            return which == "u" ? Self.with(t, ["uWord": v0, "uLabel": v0]) : Self.with(t, ["cWord": v0, "cLabel": v0])
        })])
    }
    /// 種類を変えたら、時間もその種類の既定に合わせる（本人が時刻をいじっていたら、そのまま）
    public func selectType(_ k: JSONValue?) {
        let dr = draftObj
        let cur = defTimes(dr["type"]), next = defTimes(k)
        let untouched = dr["start"] == str(cur.start) && dr["end"] == str(cur.end)
        set(["draft": .object(Self.with(dr, untouched ? ["type": k, "start": str(next.start), "end": str(next.end)] : ["type": k]))])
    }
    public func addType() {
        guard let nt = state["newType"], JS.truthy(nt) else { return }
        let t0 = (JS.truthy(nt["name"]) ? JS.string(nt["name"]) : "").jsTrimmed
        let name = t0.isEmpty ? "新しい種類" : t0
        let key = str(uid("c"))
        let hex = JS.string(nt["color"])
        let t: Obj = ["key": key, "name": str(name), "color": nt["color"] ?? .null, "paper": str(TypeDefs.paperOf(hex)), "dark": str(TypeDefs.darkOf(hex)),
                      "uWord": str("未確定の" + name), "cWord": str(name)]
        var tt = t
        if nt["color"] == nil { tt.removeValue(forKey: "color") }
        set(["types": .array((state["types"]?.array ?? []) + [.object(tt)]), "draft": .object(Self.with(draftObj, ["type": key])), "newType": .null])
    }
    public func recolorKey(_ key: JSONValue?, _ hex: String) {
        set(["types": objs(typesList.map { $0["key"] == key ? Self.with($0, ["color": str(hex), "paper": str(TypeDefs.paperOf(hex)), "dark": str(TypeDefs.darkOf(hex))]) : $0 })])
    }
    /// 自分で足した種類は、言い回しも名前から作り直す。最初からある種類は、名前だけ
    public func renameType(_ key: JSONValue?, _ name: JSONValue?) {
        set(["types": objs(typesList.map { t in
            guard t["key"] == key else { return t }
            if JS.string(t["key"]).hasPrefix("c") { return Self.with(t, ["name": name, "uWord": str("未確定の" + JS.string(name)), "cWord": name]) }
            return Self.with(t, ["name": name])
        })])
    }

    // MARK: 設定のこまかいもの
    public func setSetting(_ k: String, _ val: JSONValue?) { set(["settings": .object(Self.with(settings, [k: val]))]) }

    /// 前の勤務先での、その年の稼ぎ（年ごとに持つ）
    public func setPrior(_ y: Int, _ n: JSONValue?) {
        var r = JS.round(JS.number(n ?? .null))
        if r.isNaN || r == 0 { r = 0 }
        let v = max(0, min(99_999_999, r))
        var p: Obj = [:]
        if case .object(let cur)? = settings["priorWage"] { p = cur }
        if v != 0 { p[String(y)] = num(v) } else { p.removeValue(forKey: String(y)) }
        set(["settings": .object(Self.with(settings, ["priorWage": .object(p)]))])
    }

    /// 空き状況の印を ○ → △ → × と回す。自動の印に戻ったら、手で付けた印は外す
    public func cycleMark(_ day: String, _ auto: String) {
        let order = ["○", "△", "×"]
        let ov = state["overrides"]?.object ?? [:]
        let cur = JS.string(JS.or(ov[day], str(auto)))
        let next = order[((order.firstIndex(of: cur) ?? -1) + 1) % 3]
        var o = ov
        if next == auto { o.removeValue(forKey: day) } else { o[day] = str(next) }
        set(["overrides": .object(o)])
    }

    // MARK: シフト入力（型を選んで、マスを押すだけで置く）

    public func stampTemplates() -> [Obj] {
        var out: [Obj] = []
        for j in jobsList where !JS.truthy(j["retired"]) {
            for (i, t0) in (j["templates"]?.array ?? []).enumerated() {
                let t = t0.object ?? [:]
                let tid: String = (t["id"] == nil || t["id"] == .null) ? String(i) : JS.string(t["id"])
                out.append(Self.with(t, ["jobId": j["id"], "idx": num(Double(i)), "key": str(JS.string(j["id"]) + ":" + tid), "jobName": j["name"]]))
            }
        }
        return out
    }
    public func toggleStamp() {
        haptic("light")
        let tpls = stampTemplates()
        let on = JS.truthy(state["stamp"])
        set(["stamp": on ? .null : (tpls.isEmpty ? .null : .object(["key": tpls[0]["key"] ?? .null, "status": str("kakutei")])),
             "screen": tpls.isEmpty ? str("settings") : state["screen"], "setPage": tpls.isEmpty ? str("jobs") : state["setPage"], "typeListOpen": .bool(false)])
        if tpls.isEmpty { toast("設定の勤務先から「シフトの型」を足すと使えます", 3200) }
    }
    public func stampDay(_ Y: Int, _ M: Int, _ d: Int) {
        guard let sp = state["stamp"], JS.truthy(sp) else { return }
        guard let t = stampTemplates().first(where: { $0["key"] == sp["key"] }) else { return }
        haptic("light")
        let same = events.first { $0["stampKey"] == t["key"] && $0["y"] == num(Double(Y)) && $0["m"] == num(Double(M)) && $0["day"] == num(Double(d)) && $0["status"] != str("nakunatta") }
        // 同じ型がもう置いてあれば外す（働いた記録は外さない）
        if let same {
            if same["status"] == str("jisseki") { toast("働いた記録は、シフト入力では外せません"); return }
            set(["events": eventsArray(events.filter { $0["id"] != same["id"] }), "trash": trashAdding([same])])
            showUndo("\(M + 1)/\(d)の「\(JS.string(same["title"]))」を外しました", .object(["kind": str("del"), "ids": .array([same["id"] ?? .null])]))
            return
        }
        let hasOff = typesList.contains { $0["key"] == str("off") }
        let allDay = JS.truthy(t["allDay"])
        let c = core()
        let from = JS.number(t["from"]).truncatingRemainder(dividingBy: 1440), to = JS.number(t["to"]).truncatingRemainder(dividingBy: 1440)
        let title = JS.or(t["name"], allDay ? str("休み") : (JS.or(t["jobName"], str("勤務")) ?? str("勤務"))) ?? .null
        let ev = Self.with(["id": str(uid("t")), "type": str(allDay ? "off" : "baito"), "title": title, "y": num(Double(Y)), "m": num(Double(M)), "day": num(Double(d)),
                            "start": str(allDay ? "00:00" : c.fmtMin(from)), "end": str(allDay ? "23:59" : c.fmtMin(to)), "allDay": .bool(allDay),
                            "status": sp["status"] ?? .null, "stampKey": t["key"] ?? .null, "updatedAt": num(now)],
                           ["jobId": allDay ? nil : t["jobId"], "breakMin": JS.truthy(t["brk"]) ? t["brk"] : nil, "sym": t["sym"],
                            "want": sp["status"] == str("mikakutei") ? .array([str(c.fmtMin(from)), str(c.fmtMin(to))]) : nil])
        var st: [String: JSONValue?] = ["events": .array((state["events"]?.array ?? []) + [.object(ev)])]
        if allDay && !hasOff, let off = TypeDefs.extraType("off") { st["types"] = .array((state["types"]?.array ?? []) + [.object(off)]) }
        set(st)
    }
    /// この月の希望（点線の勤務）を、まとめて確定にする
    public func confirmMonthShifts() {
        let ym = state["ym"]?.object ?? [:]
        let list = events.filter { $0["y"] == ym["y"] && $0["m"] == ym["m"] && $0["status"] == str("mikakutei") && ($0["type"] == str("baito") || $0["type"] == str("off")) }
        if list.isEmpty { toast("この月の希望は、もう全部決まっています"); return }
        haptic("heavy")
        var prev: Obj = [:]
        for e in list { prev[JS.string(e["id"])] = .object(["status": str("mikakutei")]) }
        let ids = list.map { $0["id"] }
        set(["events": eventsArray(events.map { e in ids.contains(where: { $0 == e["id"] }) ? Self.with(e, ["status": str("kakutei"), "updatedAt": num(now)]) : e })])
        showUndo("\(JS.string(ym["m"].map { JSONValue.number(JS.number($0) + 1) }))月の希望\(list.count)件を確定にしました", .object(["kind": str("many"), "prev": .object(prev)]))
    }

    // MARK: 予定を写す
    public func openCopy(_ ev: Obj, _ ret: JSONValue?) {
        haptic("light")
        var added: [JSONValue] = []
        if JS.truthy(ev["place"]) { added.append(str("place")) }
        if JS.truthy(ev["link"]) { added.append(str("link")) }
        if JS.truthy(ev["memo"]) { added.append(str("memo")) }
        let draft = Self.with(["editingId": .null, "status": str(ev["status"] == str("mikakutei") ? "mikakutei" : "kakutei"),
                               "pickedOnce": .bool(false), "pickYM": .bool(false), "extraDays": .array([]), "allDay": .bool(JS.truthy(ev["allDay"])),
                               "days": num(Double(AppCore.evSpan(ev))), "remindMin": ev["remindMin"]?.number.map { .number($0) } ?? .null,
                               "place": JS.or(ev["place"], str("")) ?? str(""), "memo": JS.or(ev["memo"], str("")) ?? str(""), "link": JS.or(ev["link"], str("")) ?? str(""),
                               "secret": .bool(JS.truthy(ev["secret"])), "repEvery": .null, "repSpan": num(3), "repDows": .array([]), "added": .array(added), "picking": str("date")],
                              ["title": ev["title"], "type": ev["type"], "start": ev["start"], "end": ev["end"], "y": ev["y"], "m": ev["m"], "day": ev["day"],
                               "pickY": ev["y"], "pickM": ev["m"], "jobId": ev["jobId"]])
        set(["screen": str("new"), "returnTo": JS.or(ret, str("month")), "newType": .null, "detailId": .null, "draft": .object(draft)])
    }

    // MARK: iPhone のカレンダーから取り込む

    public func doImport() {
        let on = (impObj["found"]?.array ?? []).compactMap { $0.object }.filter { JS.truthy($0["on"]) }
        if on.isEmpty { return }
        haptic("heavy")
        let t0 = now
        if !events.isEmpty { onBackup("before") }  // 取り込む前の状態を控えに残す
        let tag = uid("i")
        let fresh = on.filter { !JS.truthy($0["kind"]) || $0["kind"] == str("new") }
        let add: [Obj] = fresh.enumerated().map { i, e in
            var o = Self.with(["id": str("\(tag)-\(i)"), "status": JS.or(e["status"], str("kakutei")) ?? .null, "updatedAt": num(t0)],
                              ["type": e["type"], "title": e["title"], "y": e["y"], "m": e["m"], "day": e["day"], "start": e["start"], "end": e["end"], "allDay": e["allDay"]])
            if JS.truthy(e["allDay"]) && JS.number(e["days"] ?? .null) > 1 { o["days"] = e["days"] }
            for k in ["memo", "place", "link", "srcId", "srcCal"] where JS.truthy(e[k]) { o[k] = e[k] }
            return o
        }
        // 直った予定：日付・時刻・題名・場所を元に合わせる（同じ予定が何度も出たら、あとのほう）
        var updKeys: [JSONValue?] = [], updVal: [Obj] = []
        for e in on where e["kind"] == str("changed") {
            if let i = updKeys.firstIndex(where: { $0 == e["existingId"] }) { updVal[i] = e } else { updKeys.append(e["existingId"]); updVal.append(e) }
        }
        var del: [JSONValue?] = []
        for e in on where e["kind"] == str("gone") { if !del.contains(where: { $0 == e["existingId"] }) { del.append(e["existingId"]) } }
        let isDel = { (e: Obj) in del.contains { $0 == e["id"] } }
        let removed = events.filter(isDel)
        let kept = events.filter { !isDel($0) }.map { e -> Obj in
            guard let i = updKeys.firstIndex(where: { $0 == e["id"] }) else { return e }
            let u = updVal[i]
            let multi = JS.truthy(u["allDay"]) && JS.number(u["days"] ?? .null) > 1
            return Self.with(e, ["title": u["title"], "y": u["y"], "m": u["m"], "day": u["day"], "start": u["start"], "end": u["end"], "allDay": u["allDay"],
                                 "days": multi ? u["days"] : nil, "place": JS.or(u["place"], e["place"]), "memo": JS.or(u["memo"], e["memo"]), "link": JS.or(u["link"], e["link"]),
                                 "updatedAt": num(t0)])
        }
        let lastImport: JSONValue? = add.isEmpty ? settings["lastImport"] : .object(["tag": str(tag), "at": num(t0)])
        let imp = Self.with(impObj, ["phase": str("done"), "added": num(Double(add.count)), "updated": num(Double(updKeys.count)), "removed": num(Double(del.count)),
                                     "withPlace": num(Double(add.filter { JS.truthy($0["place"]) }.count)),
                                     "multi": num(Double(add.filter { JS.number($0["days"] ?? .null) > 1 }.count)),
                                     "dashed": num(Double(add.filter { $0["status"] == str("mikakutei") }.count))])
        set(["events": eventsArray(kept + add), "trash": trashAdding(removed), "settings": .object(Self.with(settings, ["lastImport": lastImport])), "imp": .object(imp)])
    }

    /// 前回の取り込みを、まとめて取り消す
    public func undoImport() {
        guard let li = settings["lastImport"], JS.truthy(li), JS.truthy(li["tag"]) else { return }
        haptic("heavy")
        let prefix = JS.string(li["tag"]) + "-"
        func mine(_ e: Obj) -> Bool { JS.string(e["id"]).utf16.starts(with: prefix.utf16) }
        let gone = events.filter(mine)
        set(["events": eventsArray(events.filter { !mine($0) }), "trash": trashAdding(gone), "settings": .object(Self.with(settings, ["lastImport": .null])),
             "imp": .object(Self.with(impObj, ["phase": str("idle")])), "screen": state["screen"] == str("import") ? str("settings") : state["screen"]])
        toast("取り込んだ\(gone.count)件を取り消しました")
    }

    public func toggleImportRow(_ key: JSONValue?) {
        setFound { $0["key"] == key ? Self.with($0, ["on": .bool(!JS.truthy($0["on"]))]) : $0 }
    }
    public func setImportRowType(_ key: JSONValue?, _ type: JSONValue?) {
        setFound { $0["key"] == key ? Self.with($0, ["type": type]) : $0 }
    }
    public func setAllImport(_ on: Bool) { haptic("light"); setFound { Self.with($0, ["on": .bool(on)]) } }
    public func setAllImportType(_ type: JSONValue?) { haptic("light"); setFound { JS.truthy($0["on"]) ? Self.with($0, ["type": type]) : $0 } }
    private func setFound(_ f: (Obj) -> Obj) {
        let found = (impObj["found"]?.array ?? []).map { JSONValue.object(f($0.object ?? [:])) }
        set(["imp": .object(Self.with(impObj, ["found": .array(found)]))])
    }

    // MARK: 取り込んだ予定の整理（誕生日・祝日など）
    static let tidyWords = try! NSRegularExpression(pattern: "誕生日|birthday|七夕|七五三|バレンタイン|ホワイトデー|ハロウィン|クリスマス|イブ|母の日|父の日|敬老の日|節分|ひな祭り|ひなまつり|こどもの日|大晦日|正月|元日|成人の日|建国記念|春分|昭和の日|憲法記念|みどりの日|海の日|山の日|秋分|スポーツの日|文化の日|勤労感謝|天皇誕生日|祝日|休日|振替", options: [.caseInsensitive])

    public func tidyTargets() -> [Obj] {
        events.filter { e in
            guard JS.truthy(e["allDay"]), case .string(let id)? = e["id"], id.hasPrefix("i") else { return false }
            return !JS.truthy(e["noReport"])
        }
    }
    public func openTidy() {
        haptic("light")
        let sorted = JS.stableSorted(tidyTargets()) { a, b in
            let d = JS.orZero(JS.number(a["y"]) - JS.number(b["y"]))
            if d != 0 { return JS.sign(d) }
            let d2 = JS.orZero(JS.number(a["m"]) - JS.number(b["m"]))
            if d2 != 0 { return JS.sign(d2) }
            return JS.sign(JS.number(a["day"]) - JS.number(b["day"]))
        }
        let list: [JSONValue] = sorted.map { e in
            let title = JS.string(JS.or(e["title"], str("")))
            let hit = Self.tidyWords.firstMatch(in: title, range: NSRange(location: 0, length: (title as NSString).length)) != nil
            return .object(Self.with(["allDay": .bool(true), "on": .bool(hit)],
                                     ["key": e["id"], "id": e["id"], "title": e["title"], "y": e["y"], "m": e["m"], "day": e["day"], "start": e["start"], "end": e["end"],
                                      "type": e["type"], "status": e["status"]]))
        }
        set(["screen": str("import"), "imp": .object(Self.with(impObj, ["phase": str("found"), "found": .array(list), "error": str(""), "source": str("tidy"), "otherOpen": .bool(false)]))])
    }
    private func tidyIds() -> [JSONValue?] {
        var ids: [JSONValue?] = []
        for e in (impObj["found"]?.array ?? []).compactMap({ $0.object }) where JS.truthy(e["on"]) { if !ids.contains(where: { $0 == e["id"] }) { ids.append(e["id"]) } }
        return ids
    }
    /// まとめから外す。予定はカレンダーに残る
    public func tidySkip() {
        let ids = tidyIds()
        if ids.isEmpty { return }
        haptic("light")
        set(["events": eventsArray(events.map { e in ids.contains(where: { $0 == e["id"] }) ? Self.with(e, ["noReport": .bool(true), "updatedAt": num(now)]) : e }),
             "imp": .object(Self.with(impObj, ["phase": str("done"), "added": num(Double(ids.count)), "tidied": str("skip")]))])
    }
    /// 消す
    public func tidyDelete() {
        let ids = tidyIds()
        if ids.isEmpty { return }
        haptic("heavy")
        set(["events": eventsArray(events.filter { e in !ids.contains(where: { $0 == e["id"] }) }),
             "imp": .object(Self.with(impObj, ["phase": str("done"), "added": num(Double(ids.count)), "tidied": str("delete")]))])
    }

    // MARK: 有給のまとめ
    public func leaveSummary() -> JSONValue? {
        guard let pl = settings["paidLeave"], JS.truthy(pl) else { return nil }
        let t = today
        let start = JS.number(pl["start"] ?? .null)
        // 始まりの月が壊れていると、Web 版は「NaN日」と出す。こちらは落ちないように何も出さない
        if !start.isFinite { return nil }
        let y0 = Double(t.m) >= start ? t.y : t.y - 1
        let a = Civil.dayNo(y0, Int(start), 1), b = Civil.dayNo(y0 + 1, Int(start), 1) - 1
        var used = 0.0, planned = 0.0
        let c = core()
        let halfRe = try! NSRegularExpression(pattern: "半休|午前休|午後休|半日"), fullRe = try! NSRegularExpression(pattern: "有給|有休|年休")
        for e in events {
            if e["status"] == str("nakunatta") { continue }
            guard let ty = c.T(e["type"]), JS.truthy(ty["free"]) || e["type"] == str("off") else { continue }
            let title = JS.string(JS.or(e["title"], str("")))
            let r = NSRange(location: 0, length: (title as NSString).length)
            let half = halfRe.firstMatch(in: title, range: r) != nil, full = fullRe.firstMatch(in: title, range: r) != nil
            if !half && !full { continue }
            let f = max(a, AppCore.evFrom(e)), l = min(b, AppCore.evTo(e))
            if f > l { continue }
            let n = Double(l - f + 1) * (half ? 0.5 : 1)
            if e["status"] == str("mikakutei") { planned += n } else { used += n }
        }
        let grant = JS.truthy(pl["grant"]) ? JS.number(pl["grant"] ?? .null) : 0
        let rem = max(0, grant - used)
        func f1(_ x: Double) -> String { x == x.rounded() ? JS.numberToString(x) : String(format: "%.1f", x) }
        let text = "有給 あと\(f1(rem))日（\(y0)年\(JS.numberToString(start + 1))月から：\(f1(grant))日のうち \(f1(used))日使用\(planned != 0 ? "・希望 \(f1(planned))日" : "")）"
        let short = "有給 あと\(f1(rem))日" + (planned != 0 ? "（希望をぜんぶ取ると あと\(f1(max(0, rem - planned)))日）" : "")
        return .object(["rem": num(rem), "used": num(used), "planned": num(planned), "text": str(text), "short": str(short)])
    }

    // MARK: 30日たった「最近消した予定」を捨てる
    public func pruneTrash() {
        let t = state["trash"]?.array ?? []
        let kept = Loader.sanitizeTrash(.array(t), now: now)
        if kept.count != t.count { set(["trash": .array(kept)]) }
    }
}
