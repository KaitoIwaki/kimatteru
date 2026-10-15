import Foundation

/// 予定を作る・直す・消す・決める・動かす（Web 版 App.jsx の save・doDelete・dlgPrimary ほかの写し）
extension Engine {
    // MARK: くり返しの日（Web 版 repeatAfter）
    public static let repeatUnits = ["day", "weekday", "week", "biweek", "month", "nth", "monthEnd", "year"]
    public static let maxRepeat = 200

    /// 本体の日のあとに続く日を、日番号で返す（本体は含まない）
    public static func repeatAfter(_ y: Int, _ m: Int, _ d: Int, _ every: JSONValue?, _ spanMonths: Int, _ dows: JSONValue?, _ nth: JSONValue?) -> [Int] {
        guard case .string(let ev)? = every, repeatUnits.contains(ev) else { return [] }
        let fromN = Civil.dayNo(y, m, d)
        let limitN = Civil.dayNo(y, m + spanMonths, d)
        var out: [Int] = []
        func push(_ n: Int) { if n > fromN && n <= limitN && out.count < maxRepeat { out.append(n) } }
        func dowOf(_ n: Int) -> Int { let o = Civil.fromDayNo(n); return Civil.weekday(o.y, o.m, o.d) }
        let myDow = Civil.weekday(y, m, d)
        let dowList = (dows?.array ?? []).map { JS.number($0) }
        let want: [Double] = dowList.isEmpty ? [Double(myDow)] : dowList
        if ev == "day" {
            var n = fromN + 1
            while n <= limitN && out.count < maxRepeat { out.append(n); n += 1 }
            return out
        }
        if ev == "weekday" {
            var n = fromN + 1
            while n <= limitN && out.count < maxRepeat { let w = dowOf(n); if w >= 1 && w <= 5 { out.append(n) }; n += 1 }
            return out
        }
        if ev == "week" || ev == "biweek" {
            let week0 = fromN - myDow
            var n = fromN + 1
            while n <= limitN && out.count < maxRepeat {
                defer { n += 1 }
                if !want.contains(Double(dowOf(n))) { continue }
                if ev == "biweek" && Int((Double(n - week0) / 7).rounded(.down)) % 2 != 0 { continue }
                out.append(n)
            }
            return out
        }
        if ev == "nth" || ev == "monthEnd" {
            let nthList = (nth?.array ?? []).map { JS.number($0) }
            let ks: [Double] = nthList.isEmpty ? [Double(min(5, (d - 1) / 7 + 1))] : nthList
            var i = 0
            while out.count < maxRepeat && i < 1 + spanMonths + 1 {
                defer { i += 1 }
                let c = Civil.fromDayNo(Civil.dayNo(y, m + i, 1))
                let Y = c.y, M = c.m
                let dim = Civil.daysInMonth(Y, M)
                var days: [Int] = []
                if ev == "monthEnd" { days.append(dim) }
                else {
                    for w in want {
                        let first = 1 + JS.int(.number((w - Double(Civil.weekday(Y, M, 1)) + 7).truncatingRemainder(dividingBy: 7)))
                        for k in ks {
                            let dd = k == 5 ? first + 7 * ((dim - first) / 7) : first + 7 * (JS.int(.number(k)) - 1)
                            if dd <= dim { days.append(dd) }
                        }
                    }
                }
                for dd in Array(Set(days)).sorted() { push(Civil.dayNo(Y, M, dd)) }
            }
            return out.sorted()
        }
        let step = ev == "month" ? 1 : 12
        var i = step
        while out.count < maxRepeat {
            defer { i += step }
            let t = Civil.fromDayNo(Civil.dayNo(y, m + i, 1))
            let dim = Civil.daysInMonth(t.y, t.m)
            if Civil.dayNo(t.y, t.m, 1) > limitN { break }
            if d > dim { continue }
            push(Civil.dayNo(t.y, t.m, d))
            if Civil.dayNo(t.y, t.m, min(d, dim)) > limitN { break }
        }
        return out
    }

    var localNow: (h: Int, min: Int) {
        var cal = Calendar(identifier: .gregorian); cal.timeZone = timeZone
        let c = cal.dateComponents([.hour, .minute], from: Date(timeIntervalSince1970: now / 1000))
        return (c.hour!, c.minute!)
    }

    // MARK: 新しい予定の画面を開く
    public func openNew(_ day: Int, _ ret: JSONValue?, _ opts: Obj? = nil) {
        let o = opts ?? [:]
        let ymO = state["ym"]?.object ?? [:]
        let ymY: JSONValue = (o["y"] != nil && o["y"] != .null) ? o["y"]! : (ymO["y"] ?? .null)
        let ymM: JSONValue = (o["m"] != nil && o["m"] != .null) ? o["m"]! : (ymO["m"] ?? .null)
        let vis = visibleTypes()
        let last = settings["lastType"]
        let type: JSONValue = vis.contains(where: { $0["key"] == last }) ? last! : (vis.first?["key"] ?? .string("yoji"))
        let tt = core().T(type) ?? [:]
        var dt = defTimes(type)
        let t = today
        let c = core()
        if case .number(let st)? = o["start"] {
            let a = max(0, min(1410, st))
            dt = (c.fmtMin(a), c.fmtMin(min(1439, a + 60)))
        } else if ymY == .number(Double(t.y)) && ymM == .number(Double(t.m)) && day == t.d && !JS.truthy(tt["defStart"]) {
            let ln = localNow
            let next = (Double(ln.h * 60 + ln.min + 1) / 30).rounded(.up) * 30
            if next <= 22 * 60 { dt = (c.fmtMin(next), c.fmtMin(next + 60)) }
        }
        let cfg = settings
        let allDay: Bool = (o["allDay"] != nil && o["allDay"] != .null) ? JS.truthy(o["allDay"]) : (JS.truthy(tt["allDayDefault"]) && o["start"]?.number == nil)
        let remindMin: JSONValue = allDay ? (cfg["remindAllDay"]?.number.map { .number($0) } ?? .null) : (cfg["remindTimed"]?.number.map { .number($0) } ?? .null)
        let job = (state["jobs"]?.array ?? []).compactMap { $0.object }.first { !JS.truthy($0["retired"]) }
        var draft: Obj = ["editingId": .null, "title": str(""), "type": type, "status": str("kakutei"), "start": str(dt.start), "end": str(dt.end),
                          "y": ymY, "m": ymM, "day": num(Double(day)), "pickY": ymY, "pickM": ymM, "extraDays": .array([]), "allDay": .bool(allDay), "days": num(1),
                          "remindMin": remindMin, "place": str(""), "memo": str(""), "link": str(""), "repEvery": .null, "repSpan": num(3), "repDows": .array([]),
                          "added": .array([]), "picking": .null, "someday": .null, "cand": .bool(false), "secret": .bool(false)]
        if let jid = job?["id"] { draft["jobId"] = jid }
        set(["screen": str("new"), "returnTo": ret, "newType": .null, "draft": .object(draft)])
    }

    // MARK: 予定を直す画面を開く
    public func openEdit(_ ev: Obj, _ ret: JSONValue?) {
        let isJ = ev["status"] == str("jisseki")
        var added: [JSONValue] = []
        if JS.truthy(ev["place"]) { added.append(str("place")) }
        if JS.truthy(ev["link"]) { added.append(str("link")) }
        if JS.truthy(ev["memo"]) { added.append(str("memo")) }
        var draft: Obj = ["editingId": ev["id"] ?? .null, "start": ev["start"] ?? .null,
                          "end": (isJ ? JS.or(ev["actualEnd"], ev["end"]) : ev["end"]) ?? .null,
                          "y": ev["y"] ?? .null, "m": ev["m"] ?? .null, "day": ev["day"] ?? .null, "pickY": ev["y"] ?? .null, "pickM": ev["m"] ?? .null,
                          "extraDays": .array([]), "allDay": .bool(JS.truthy(ev["allDay"])), "days": num(Double(AppCore.evSpan(ev))),
                          "remindMin": ev["remindMin"]?.number.map { .number($0) } ?? .null,
                          "place": JS.or(ev["place"], str("")) ?? str(""), "memo": JS.or(ev["memo"], str("")) ?? str(""), "link": JS.or(ev["link"], str("")) ?? str(""),
                          "secret": .bool(JS.truthy(ev["secret"])), "repEvery": .null, "repSpan": num(3), "repDows": .array([]), "added": .array(added), "picking": .null]
        for k in ["title", "type", "status", "jobId"] { if let v = ev[k] { draft[k] = v } }
        set(["screen": str("new"), "returnTo": JS.or(ret, str("month")), "newType": .null, "detailId": .null, "draft": .object(draft)])
    }

    // MARK: 保存
    public func save(_ scope: String? = nil) {
        let dr = state["draft"]?.object ?? [:]
        let daysI = Int(JS.toInt32(dr["days"]))
        let span = JS.truthy(dr["allDay"]) ? max(1, min(60, daysI != 0 ? daysI : 1)) : 1
        let spanField: JSONValue? = span > 1 ? num(Double(span)) : nil
        let remindField: JSONValue? = dr["remindMin"]?.number.map { .number($0) }
        func trimmed(_ k: String) -> JSONValue? {
            let s = (JS.truthy(dr[k]) ? JS.string(dr[k]) : "").jsTrimmed
            return s.isEmpty ? nil : str(s)
        }
        let placeField = trimmed("place"), memoField = trimmed("memo"), linkField = trimmed("link")
        let secretField: JSONValue? = JS.truthy(dr["secret"]) ? .bool(true) : nil
        let title: JSONValue = JS.or(dr["title"], str("無題")) ?? str("無題")
        let isBaito = dr["type"] == str("baito")
        func rememberType() -> JSONValue { .object(Self.with(settings, ["lastType": dr["type"]])) }
        func back() -> JSONValue {
            let r = state["returnTo"]
            if case .string(let s)? = r, ["day", "list", "detail", "free", "month"].contains(s) { return str(s == "detail" ? "month" : s) }
            return str("month")
        }
        let dy = JS.int(dr["y"]), dm = JS.int(dr["m"]), dd = JS.int(dr["day"])

        if JS.truthy(dr["editingId"]) {
            let eid = dr["editingId"]
            let orig = events.first { $0["id"] == eid }
            if scope == nil, let orig, JS.truthy(orig["repId"]) {
                let rest = events.filter { $0["repId"] == orig["repId"] && AppCore.evFrom($0) > AppCore.evFrom(orig) }.count
                if rest > 0 { set(["repEditAsk": .object(["rest": num(Double(rest))])]); return }
            }
            let isJ = dr["status"] == str("jisseki")
            func patchOf(_ e: Obj) -> Obj {
                var base = Self.with(e, ["type": dr["type"], "title": title, "y": dr["y"], "m": dr["m"], "day": dr["day"], "start": dr["start"], "status": dr["status"],
                                         "allDay": dr["allDay"], "days": spanField, "remindMin": remindField, "place": placeField, "memo": memoField, "link": linkField,
                                         "secret": secretField, "jobId": isBaito ? dr["jobId"] : nil, "updatedAt": num(now)])
                if isJ { base = Self.with(base, ["actualEnd": dr["end"]]) } else { base = Self.with(base, ["end": dr["end"], "actualEnd": nil]) }
                return base
            }
            func restPatch(_ e: Obj) -> Obj {
                guard let orig else { return e }
                var out = Self.with(e, ["updatedAt": num(now)])
                let shift = Civil.dayNo(dy, dm, dd) - AppCore.evFrom(orig)
                if shift != 0 { let o = Civil.fromDayNo(AppCore.evFrom(e) + shift); out["y"] = num(Double(o.y)); out["m"] = num(Double(o.m)); out["day"] = num(Double(o.d)) }
                let fields: [(String, JSONValue?)] = [("type", dr["type"]), ("title", title), ("start", dr["start"]), ("end", dr["end"]), ("allDay", dr["allDay"]), ("days", spanField),
                    ("remindMin", remindField), ("place", placeField), ("memo", memoField), ("link", linkField), ("secret", secretField), ("status", dr["status"])]
                for (k, v) in fields {
                    let same = (orig[k] ?? .null) == (v ?? .null)
                    if !same && !(k == "end" && isJ) { if let v { out[k] = v } else { out.removeValue(forKey: k) } }
                }
                return out
            }
            let b = back()
            let list = events.map { e -> JSONValue in
                if e["id"] == eid { return .object(patchOf(e)) }
                if scope == "rest", let orig, JS.truthy(orig["repId"]), e["repId"] == orig["repId"], AppCore.evFrom(e) > AppCore.evFrom(orig) { return .object(restPatch(e)) }
                return .object(e)
            }
            set(["screen": b, "detailId": .null, "dayNum": b == str("day") ? dr["day"] : .null, "ym": .object(["y": dr["y"] ?? .null, "m": dr["m"] ?? .null]),
                 "repEditAsk": .null, "settings": rememberType(), "events": .array(list)])
            return
        }
        // 日にちをまだ決めない予定は、棚に置く
        if JS.truthy(dr["someday"]) {
            let t = today
            let sid = uid("s"), nid = uid("n")
            let ev = Self.with(["id": str(nid), "type": dr["type"] ?? .null, "title": title, "start": dr["start"] ?? .null, "end": dr["end"] ?? .null, "allDay": dr["allDay"] ?? .null, "status": str("mikakutei")],
                               ["days": spanField, "remindMin": remindField, "place": placeField, "memo": memoField, "link": linkField, "secret": secretField, "jobId": isBaito ? dr["jobId"] : nil])
            let item: Obj = ["id": str(sid), "when": dr["someday"]!, "title": title, "type": dr["type"] ?? .null, "y": num(Double(t.y)), "m": num(Double(t.m)), "day": num(Double(t.d)), "at": num(now), "ev": .object(ev)]
            set(["screen": back(), "someday": .array([.object(item)] + (state["someday"]?.array ?? [])), "settings": rememberType()])
            toast("「\(JS.string(title))」を「\(Self.somedayLabel[JS.string(dr["someday"])] ?? "undefined")」に置きました")
            return
        }
        let rep = Self.repeatAfter(dy, dm, dd, dr["repEvery"], Int(JS.toInt32(dr["repSpan"])), dr["repDows"], dr["repNth"]).map { Civil.fromDayNo($0) }.map { [$0.y, $0.m, $0.d] }
        var placeOn: [[Double]] = [[Double(dy), Double(dm), Double(dd)]]
        for k in dr["extraDays"]?.array ?? [] { placeOn.append(JS.string(k).components(separatedBy: "-").map { JS.number($0) }) }
        for r in rep { placeOn.append(r.map { Double($0) }) }
        let base = now
        let tag = uid("n")
        let repId: JSONValue? = rep.isEmpty ? nil : str(uid("r"))
        let candId: JSONValue? = (JS.truthy(dr["cand"]) && dr["status"] == str("mikakutei") && !(dr["extraDays"]?.array ?? []).isEmpty) ? str(uid("k")) : nil
        let made: [JSONValue] = placeOn.enumerated().map { i, p in
            let o: Obj = ["id": str("\(tag)-\(i)"), "type": dr["type"] ?? .null, "title": title, "y": num(p.count > 0 ? p[0] : .nan), "m": num(p.count > 1 ? p[1] : .nan), "day": num(p.count > 2 ? p[2] : .nan),
                          "start": dr["start"] ?? .null, "end": dr["end"] ?? .null, "status": dr["status"] ?? .null, "allDay": dr["allDay"] ?? .null, "updatedAt": num(base)]
            return .object(Self.with(o, ["days": spanField, "remindMin": remindField, "place": placeField, "memo": memoField, "link": linkField, "secret": secretField,
                                         "repId": repId, "candId": candId, "jobId": isBaito ? dr["jobId"] : nil,
                                         "want": dr["status"] == str("mikakutei") ? .array([dr["start"] ?? .null, dr["end"] ?? .null]) : nil]))
        }
        set(["screen": back(), "ym": .object(["y": dr["y"] ?? .null, "m": dr["m"] ?? .null]), "events": .array((state["events"]?.array ?? []) + made), "settings": rememberType()])
    }

    // MARK: 消す・戻す
    public func askDelete(_ id: JSONValue) { set(["confirmDelete": id, "deleteRest": .bool(false)]) }

    public func doDelete() {
        let id = state["confirmDelete"]
        let all = JS.truthy(state["deleteRest"])
        let ev = events.first { $0["id"] == id }
        func gone(_ e: Obj) -> Bool {
            if e["id"] == id { return true }
            guard all, let ev, JS.truthy(ev["repId"]) else { return false }
            return e["repId"] == ev["repId"] && AppCore.evFrom(e) >= AppCore.evFrom(ev)
        }
        let removed = events.filter(gone)
        let detailId = state["detailId"]
        let rt = state["returnTo"]
        let screen: JSONValue? = detailId == id ? (rt == str("detail") ? str("month") : (JS.or(rt, str("month")))) : state["screen"]
        set(["events": eventsArray(events.filter { !gone($0) }), "confirmDelete": .null, "deleteRest": .bool(false), "dialog": .null, "swipeRow": .null,
             "trash": .array(Array((removed.map { JSONValue.object(["ev": .object($0), "at": num(now)]) } + (state["trash"]?.array ?? [])).prefix(400))),
             "screen": screen, "detailId": detailId == id ? .null : detailId])
        if !removed.isEmpty {
            showUndo(removed.count > 1 ? "\(removed.count)件を削除しました" : "「\(JS.string(removed[0]["title"]))」を削除しました",
                     .object(["kind": str("del"), "ids": .array(removed.map { $0["id"] ?? .null })]))
        }
    }

    public func restoreTrash(_ ids: [JSONValue], _ quiet: Bool = false) {
        let trash = state["trash"]?.array ?? []
        let hit = trash.filter { x in ids.contains { $0 == x["ev"]?["id"] } }
        let shelf: [JSONValue] = hit.filter { JS.truthy($0["someday"]) }.compactMap { $0["someday"]?.object }.map { .object(Self.with($0, ["at": num(now)])) }
        let evs = Loader.sanitizeEvents(.array(hit.filter { !JS.truthy($0["someday"]) }.map { $0["ev"] ?? .null }), makeId: { self.uid("x") })
            .compactMap { $0.object }.map { JSONValue.object(Self.with($0, ["updatedAt": num(now)])) }
        let kept: [JSONValue] = evs.map { $0["id"] ?? .null } + shelf.map { ($0["ev"].flatMap { JS.truthy($0) ? $0["id"] : $0 }) ?? .null }
        let someday: JSONValue? = shelf.isEmpty ? state["someday"] : .array(shelf + (state["someday"]?.array ?? []).filter { x in !shelf.contains { $0["id"] == x["id"] } })
        set(["events": .array((state["events"]?.array ?? []).filter { e in !kept.contains { $0 == e["id"] } } + evs),
             "someday": someday, "trash": .array(trash.filter { x in !kept.contains { $0 == x["ev"]?["id"] } })])
        if !quiet { toast("\(evs.count + shelf.count)件を戻しました") }
    }

    /// 取り消し（直前の削除・決定・動かす・片づけ）
    public func undoLast() {
        guard let u = state["undo"], JS.truthy(u) else { return }
        cancel(named["undo"])
        let d = u["data"] ?? .null
        switch d["kind"]?.string {
        case "del": restoreTrash(d["ids"]?.array ?? [], true)
        case "status":
            let id = d["id"], prev = d["prev"]?.object ?? [:]
            let keys = undoPrevKeys
            set(["events": eventsArray(events.map { e in
                guard e["id"] == id else { return e }
                var r = e
                for k in keys { if let v = prev[k] { r[k] = v } else { r.removeValue(forKey: k) } }
                r["updatedAt"] = num(now)
                return r
            }), "morph": .null])
        case "many":
            let prev = d["prev"]?.object ?? [:]
            set(["events": eventsArray(events.map { e in
                guard let id = e["id"], case .object(let p)? = prev[JS.string(id)] else { return e }
                var r = e
                for (k, v) in p { r[k] = v }
                r["updatedAt"] = num(now)
                return r
            })])
        default: break
        }
        set(["undo": .null])
    }

    // MARK: 「どうなった？」の小窓
    public func openDialog(_ ev: Obj, _ mode: String, _ ret: JSONValue?) {
        let again = mode == "worked" && ev["status"] == str("jisseki")
        let hasWant = mode == "confirm" && JS.truthy(ev["want"])
        let origS = hasWant ? (ev["want"]?.array?.first ?? .null) : (ev["start"] ?? .null)
        let origE = again ? (JS.or(ev["actualEnd"], ev["end"]) ?? .null) : (hasWant ? ((ev["want"]?.array ?? []).dropFirst().first ?? .null) : (ev["end"] ?? .null))
        var dialog: Obj = ["id": ev["id"] ?? .null, "mode": str(mode), "y": ev["y"] ?? .null, "m": ev["m"] ?? .null, "day": ev["day"] ?? .null,
                           "start": origS, "end": origE, "origS": origS, "origE": origE, "breakMin": num(core().breakMin(ev)), "picking": .null]
        if let t = ev["type"] { dialog["type"] = t }
        if let t = ev["title"] { dialog["title"] = t }
        set(["returnTo": JS.or(ret, state["returnTo"]), "dialog": .object(dialog)])
    }
    public func patchDlg(_ k: String, _ d: Double) {
        var dl = state["dialog"]?.object ?? [:]
        dl[k] = str(core().addMin(JS.string(dl[k]), d))
        set(["dialog": .object(dl)])
    }

    /// 予定を書き換えるところは全部ここを通る（更新時刻も押す）。値が nil の項目は「無い」にする
    public func updateEvent(_ id: JSONValue?, _ patch: [String: JSONValue?]) {
        set(["events": eventsArray(events.map { e in e["id"] == id ? Self.with(Self.with(e, patch), ["updatedAt": num(now)]) : e })])
    }

    public func dlgPrimary() {
        guard let d = state["dialog"]?.object else { return }
        let did = d["id"]
        if d["mode"] == str("worked") {
            let ev0 = events.first { $0["id"] == did }
            let hourly: JSONValue? = (ev0 != nil && ev0!["type"] == str("baito")) ? core().hourlyFor(ev0!) : nil
            let brk = JS.number(d["breakMin"])
            updateEvent(did, ["status": str("jisseki"), "start": d["start"], "actualEnd": d["end"], "breakMin": brk > 0 ? d["breakMin"] : nil, "hourly": hourly])
            set(["dialog": .null])
            return
        }
        let ev0 = events.first { $0["id"] == did }
        var prev: Obj? = nil
        if let ev0 { prev = [:]; for k in ["status", "start", "end", "want"] { if let v = ev0[k] { prev![k] = v } } }
        updateEvent(did, ["start": d["start"], "end": d["end"], "want": .array([d["origS"] ?? .null, d["origE"] ?? .null])])
        set(["dialog": .null, "screen": str("month"), "dayNum": .null, "detailId": .null, "morph": .object(["id": did ?? .null, "phase": str("dash")]),
             "ym": ev0.map { .object(["y": $0["y"] ?? .null, "m": $0["m"] ?? .null]) } ?? state["ym"]])
        let morphIs = { [weak self] () -> Bool in guard let m = self?.state["morph"], JS.truthy(m) else { return false }; return m["id"] == did }
        later(150) { [weak self] in if morphIs() { self?.set(["morph": .object(["id": did ?? .null, "phase": .string("fill")])]) } }
        later(470) { [weak self] in if morphIs() { self?.set(["morph": .object(["id": did ?? .null, "phase": .string("settle")])]) } }
        later(760) { [weak self] in
            guard let self, morphIs() else { return }
            self.updateEvent(did, ["status": self.str("kakutei")])
            let cc = JS.truthy(self.settings["confirmCount"]) ? JS.number(self.settings["confirmCount"]) : 0
            self.set(["morph": .null, "settings": .object(Self.with(self.settings, ["confirmCount": self.num(cc + 1)]))])
            self.later(600) { [weak self] in self?.maybeAskReview("confirm") }
            let others = (ev0 != nil && JS.truthy(ev0!["candId"])) ? self.events.filter { $0["candId"] == ev0!["candId"] && $0["id"] != did && $0["status"] == self.str("mikakutei") } : []
            if !others.isEmpty {
                self.set(["candAsk": .object(["id": did ?? .null, "title": ev0!["title"] ?? .null, "ids": .array(others.map { $0["id"] ?? .null })])])
            } else if let prev {
                self.undoPrevKeys = ["status", "start", "end", "want"]
                self.showUndo("「\(JS.string(ev0!["title"]))」を確定しました", .object(["kind": self.str("status"), "id": did ?? .null, "prev": .object(prev)]))
            }
        }
    }

    public func dlgNakunatta() {
        guard let d = state["dialog"]?.object else { return }
        let did = d["id"]
        let ev0 = events.first { $0["id"] == did }
        updateEvent(did, ["status": str("nakunatta")])
        let isDetail = state["detailId"] == did
        set(["dialog": .null, "screen": isDetail ? state["returnTo"] : state["screen"], "detailId": isDetail ? .null : state["detailId"]])
        if let ev0 {
            let gone = core().T(ev0["type"])?["gone"]
            undoPrevKeys = ["status"]
            var prev: Obj = [:]; if let s = ev0["status"] { prev["status"] = s }
            showUndo("「\(JS.string(ev0["title"]))」を\(JS.truthy(gone) ? JS.string(gone) : "無くなった")にしました", .object(["kind": str("status"), "id": did ?? .null, "prev": .object(prev)]))
        }
    }

    // MARK: 動かす・棚
    public func moveEvent(_ id: JSONValue?, to: (y: Int, m: Int, d: Int)?, status: String) {
        guard let to, let ev0 = events.first(where: { $0["id"] == id }) else { return }
        var prev: Obj = [:]
        for k in ["y", "m", "day", "status", "movedFrom"] { if let v = ev0[k] { prev[k] = v } }
        let movedFrom: JSONValue = JS.truthy(ev0["movedFrom"]) ? ev0["movedFrom"]! : .object(["y": ev0["y"] ?? .null, "m": ev0["m"] ?? .null, "day": ev0["day"] ?? .null])
        updateEvent(id, ["y": num(Double(to.y)), "m": num(Double(to.m)), "day": num(Double(to.d)), "status": str(status), "movedFrom": movedFrom, "candId": ev0["candId"]])
        set(["dialog": .null, "screen": state["screen"] == str("detail") ? str("detail") : state["screen"], "ym": .object(["y": num(Double(to.y)), "m": num(Double(to.m))])])
        undoPrevKeys = ["y", "m", "day", "status", "movedFrom"]
        showUndo("「\(JS.string(ev0["title"]))」を\(to.m + 1)月\(to.d)日に動かしました", .object(["kind": str("status"), "id": id ?? .null, "prev": .object(prev)]))
    }

    public func toSomeday(_ id: JSONValue?, _ when: String) {
        guard let ev0 = events.first(where: { $0["id"] == id }) else { return }
        let t = today
        let item: Obj = ["id": str(uid("s")), "when": str(when), "title": ev0["title"] ?? .null, "type": ev0["type"] ?? .null,
                         "y": num(Double(t.y)), "m": num(Double(t.m)), "day": num(Double(t.d)), "at": num(now), "ev": .object(Self.with(ev0, ["status": str("mikakutei")]))]
        let isDetail = state["detailId"] == id
        set(["events": eventsArray(events.filter { $0["id"] != id }), "someday": .array([.object(item)] + (state["someday"]?.array ?? [])),
             "gone": goneAdd([id ?? .null]), "dialog": .null, "detailId": isDetail ? .null : state["detailId"], "screen": isDetail ? str("month") : state["screen"]])
        toast("「\(JS.string(ev0["title"]))」を「\(Self.somedayLabel[when] ?? "undefined")」に置きました")
    }

    public func placeSomeday(_ sid: JSONValue?, _ y: Int, _ m: Int, _ d: Int) {
        guard let it = (state["someday"]?.array ?? []).compactMap({ $0.object }).first(where: { $0["id"] == sid }) else { return }
        var base: Obj
        if let e = it["ev"]?.object, JS.truthy(it["ev"]) { base = e }
        else { let dt = defTimes(it["type"]); base = ["id": str(uid("n")), "type": it["type"] ?? .null, "title": it["title"] ?? .null, "start": str(dt.start), "end": str(dt.end), "allDay": .bool(false)] }
        var ev = Self.with(base, ["y": num(Double(y)), "m": num(Double(m)), "day": num(Double(d)), "status": str("mikakutei"), "updatedAt": num(now)])
        if !JS.truthy(ev["id"]) { ev["id"] = str(uid("n")) }
        set(["someday": .array((state["someday"]?.array ?? []).filter { $0["id"] != sid }), "events": .array((state["events"]?.array ?? []) + [.object(ev)]),
             "somedayPick": .null, "ym": .object(["y": num(Double(y)), "m": num(Double(m))]), "gone": goneAdd([sid ?? .null])])
        toast("\(m + 1)月\(d)日に置きました")
    }

    public func dropSomeday(_ sid: JSONValue?) {
        guard let it = (state["someday"]?.array ?? []).compactMap({ $0.object }).first(where: { $0["id"] == sid }) else { return }
        let trash: JSONValue? = JS.truthy(it["ev"])
            ? .array(Array(([JSONValue.object(["ev": it["ev"]!, "someday": .object(it), "at": num(now)])] + (state["trash"]?.array ?? [])).prefix(400)))
            : state["trash"]
        set(["someday": .array((state["someday"]?.array ?? []).filter { $0["id"] != sid }), "gone": goneAdd([sid ?? .null]), "trash": trash])
    }

    /// 候補日のうち1つが決まったとき、残りの候補を「無くなった」にする
    public func settleCandidates(_ yes: Bool) {
        guard let a = state["candAsk"], JS.truthy(a) else { return }
        if !yes { set(["candAsk": .null]); return }
        let ids = a["ids"]?.array ?? []
        var prev: Obj = [:]
        for id in ids { prev[JS.string(id)] = .object(["status": str("mikakutei")]) }
        set(["candAsk": .null, "events": eventsArray(events.map { e in ids.contains { $0 == e["id"] } ? Self.with(e, ["status": str("nakunatta"), "updatedAt": num(now)]) : e })])
        showUndo("ほかの候補\(ids.count)件を片づけました", .object(["kind": str("many"), "prev": .object(prev)]))
    }
}
