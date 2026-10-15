import Foundation

/// 起動・日付の変わり目・画面の行き来（Web 版 App.jsx の state の初期値・componentDidMount・_checkToday・_onReturn ほかの写し）
extension Engine {
    /// 今日（地元の日付）
    public static func todayParts(_ now: Double, _ tz: TimeZone) -> JSONValue {
        let p = JSDate.local(now, tz)
        return ["y": .number(Double(p.y)), "m": .number(Double(p.m)), "d": .number(Double(p.d))]
    }
    /// 月を n ヶ月ずらす
    public static func shiftMonth(_ ym: JSONValue?, _ n: Int) -> JSONValue {
        let y = JS.int(ym?["y"]), m = JS.int(ym?["m"])
        let total = y * 12 + m + n
        let ny = Int((Double(total) / 12).rounded(.down))
        return ["y": .number(Double(ny)), "m": .number(Double(total - ny * 12))]
    }

    /// 保存していない中身も含めた、はじめの状態（Web 版の state = {...} と同じ）
    public static func defaultState(now: Double, tz: TimeZone) -> [String: JSONValue] {
        let t = todayParts(now, tz)
        let ym: JSONValue = ["y": t["y"]!, "m": t["m"]!]
        return [
            "screen": "month", "wageOn": false, "dialog": .null, "detailId": .null, "dayNum": .null, "returnTo": "month",
            "newType": .null, "overrides": [:], "notif": .null, "editTypeKey": .null, "docKey": .null, "confirmDelete": .null,
            "imp": ["phase": "idle", "found": [], "type": "yoji", "error": ""],
            "swipe": ["dx": 0, "animating": false],
            "swipeRow": .null,
            "notices": [], "lastSeenVersion": .null, "noticeOpen": .null,
            "trash": [], "someday": [], "gone": [],
            "jobs": [], "editJobId": .null, "newJob": .null, "supports": [],
            "ym": ym, "freeYM": ym, "freeDir": 0, "today": t,
            "shareChoices": ["o1": .null, "o2": .null, "o3": .null], "shareSubmitted": false, "shareToast": false, "shareMsg": "", "morph": .null,
            "settings": ["hourly": 1120, "weekStart": 0, "remind": true, "hideCanceled": false, "dark": false, "onboarded": false, "priorWage": [:]],
            "onboard": ["step": 0, "demo": "dash"],
            "draft": ["title": "", "type": "yoji", "status": "kakutei", "start": "10:00", "end": "11:00", "y": t["y"]!, "m": t["m"]!, "day": t["d"]!, "allDay": false, "picking": .null],
            "types": .array(Loader.builtinTypes.map { .object($0) }),
            "events": [],
        ]
    }

    /// 起動したときの中身。保存されていたもの（無ければ nil）を、はじめの状態に重ねる（Web 版の constructor）
    public static func initialState(saved: [String: JSONValue]?, now: Double, tz: TimeZone, makeId: () -> String) -> [String: JSONValue] {
        var st = defaultState(now: now, tz: tz)
        guard let saved else { return st }
        for (k, v) in Loader.load(saved, now: now, makeId: makeId) { st[k] = v }
        return st
    }

    /// 起動の直後（componentDidMount のうち、中身を変えるもの）
    public func boot(version: String) {
        set(["notices": .array(NoticesCore.syncInfoNotices(state["notices"]?.array ?? [], current: version, lastSeen: state["lastSeenVersion"], now: now)),
             "lastSeenVersion": str(version)])
        refreshNotif()
        if !JS.truthy(settings["firstUseAt"]) { set(["settings": .object(Self.with(settings, ["firstUseAt": num(now)]))]) }
        pruneTrash()
    }

    /// 終わったのにまだ実績を入れていないバイトを、お知らせに溜める（変わったときだけ書く）
    public func refreshNotif() {
        let cur = state["notices"]?.array ?? []
        let next = NoticesCore.syncShiftNotices(cur, state["events"]?.array ?? [], now: now, tz: timeZone)
        let changed = next.count != cur.count || next.indices.contains { next[$0]["id"] != (cur.indices.contains($0) ? cur[$0]["id"] : nil) }
        if changed { set(["notices": .array(next)]) }
    }

    /// 日付が変わっていたら「今日」を進める
    public func checkToday() {
        let t = Self.todayParts(now, timeZone)
        if t != state["today"] { set(["today": t]) }
    }

    /// アプリに戻ってきたとき。30 分以上ほかのアプリにいたら、今月のカレンダーに戻す（書きかけのときは戻さない）。
    /// 返すのは「ロックを確かめ直すか」
    @discardableResult
    public func onReturn(awayMs: Double, lockAvailable: Bool) -> Bool {
        let t = Self.todayParts(now, timeZone)
        var patch: [String: JSONValue?] = [:]
        if t != state["today"] { patch["today"] = t }
        if awayMs > 30 * 60_000, case .string(let sc)? = state["screen"], ["month", "day", "detail", "free", "report"].contains(sc) {
            patch["screen"] = .some(.string("month")); patch["ym"] = .some(.object(["y": t["y"]!, "m": t["m"]!]))
            patch["dayNum"] = .some(.null); patch["detailId"] = .some(.null); patch["detailMenu"] = .some(.bool(false))
        }
        var relock = false
        if JS.truthy(settings["lock"]) && lockAvailable && awayMs > 30_000 { patch["locked"] = .some(.bool(true)); relock = true }
        if !patch.isEmpty { set(patch) }
        maybeAskReview("open")
        refreshNotif()
        return relock
    }

    // MARK: 画面の行き来

    /// 予定を押したとき。今日と過ぎた日のまだの予定は「どうなった？」、ほかは中身（詳細）を開く
    public func openFor(_ ev: Obj, _ from: JSONValue? = nil) {
        let ret = JS.or(from, state["returnTo"])
        let t = today
        let future = Civil.dayNo(JS.int(ev["y"]), JS.int(ev["m"]), JS.int(ev["day"])) > Civil.dayNo(t.y, t.m, t.d)
        if ev["status"] == str("mikakutei") && !future { openDialog(ev, "confirm", ret); return }
        set(["screen": "detail", "detailId": ev["id"] ?? .null, "returnTo": ret])
    }
    public func openDay(_ d: Int) { set(["screen": "day", "dayNum": num(Double(d)), "returnTo": "month", "swipeRow": .null, "dayFrom": "month", "dayDir": 0]) }
    /// 今日の月へ戻って、今日のマスを一瞬光らせる
    public func goToday() {
        haptic("light")
        let t = today
        set(["ym": ["y": num(Double(t.y)), "m": num(Double(t.m))], "dayNum": .null, "weekAnchor": .null, "flashToday": num(now)])
    }
    public func shiftMonthBy(_ n: Int) { set(["ym": Self.shiftMonth(state["ym"], n), "dayNum": .null]) }
    /// 空き状況の月送り（送った向きを持っておく）
    public func shiftFree(_ dir: Int) {
        haptic("light")
        set(["freeYM": Self.shiftMonth(state["freeYM"], dir), "freeDir": num(Double(dir))])
    }

    /// 書きかけの予定があるか（キャンセルを押したときに確かめる）
    public func draftDirty() -> Bool {
        guard state["screen"] == str("new") else { return false }
        let dr = draftObj
        func t(_ v: JSONValue?) -> String { (JS.truthy(v) ? JS.string(v) : "").jsTrimmed }
        if !JS.truthy(dr["editingId"]) { return !(t(dr["title"]).isEmpty && t(dr["place"]).isEmpty && t(dr["memo"]).isEmpty && t(dr["link"]).isEmpty) }
        guard let e = events.first(where: { $0["id"] == dr["editingId"] }) else { return false }
        let end = e["status"] == str("jisseki") ? JS.or(e["actualEnd"], e["end"]) : e["end"]
        return t(dr["title"]) != t(e["title"]) || dr["type"] != e["type"] || dr["start"] != e["start"] || dr["end"] != end
            || dr["y"] != e["y"] || dr["m"] != e["m"] || dr["day"] != e["day"] || dr["status"] != e["status"] || JS.truthy(dr["allDay"]) != JS.truthy(e["allDay"])
            || t(dr["place"]) != t(e["place"]) || t(dr["memo"]) != t(e["memo"]) || t(dr["link"]) != t(e["link"])
    }

    /// 予定を人に送る文（「10/3（金）19:00〜21:00 歓迎会 @渋谷」）。共有シートには、この文とその 1 件の .ics を渡す
    public func shareText(_ ev: Obj) -> String {
        let dw = ["日", "月", "火", "水", "木", "金", "土"]
        let y = JS.int(ev["y"]), m = JS.int(ev["m"]), d = JS.int(ev["day"])
        let span = AppCore.evSpan(ev)
        let when = "\(m + 1)/\(d)（\(dw[Civil.weekday(y, m, d)])）" + (JS.truthy(ev["allDay"]) ? (span > 1 ? "から\(span)日間" : " 終日") : " \(JS.string(ev["start"]))〜\(JS.string(ev["end"]))")
        let place = JS.string(ev["place"])
        let isUrl = place.range(of: "^https?:", options: .regularExpression) != nil
        var lines = ["\(when) \(JS.string(ev["title"]))\(JS.truthy(ev["place"]) && !isUrl ? " @" + place : "")\(ev["status"] == str("mikakutei") ? "（まだ仮）" : "")"]
        if JS.truthy(ev["link"]) { lines.append(JS.string(ev["link"])) }
        if JS.truthy(ev["place"]) && !isUrl { lines.append("地図：https://maps.apple.com/?q=" + JS.encodeURIComponent(place)) }
        return lines.joined(separator: "\n")
    }

    /// お知らせを開く・全部読んだにする
    public func openNotice(_ id: JSONValue?) {
        haptic("light")
        set(["noticeOpen": id ?? .null, "notices": .array((state["notices"]?.array ?? []).map { n in
            n["id"] == id ? .object(Self.with(n.object ?? [:], ["read": true])) : n
        })])
    }
    public func markAllRead() {
        haptic("light")
        set(["notices": .array((state["notices"]?.array ?? []).map { .object(Self.with($0.object ?? [:], ["read": true])) })])
    }
}

extension JS {
    /// JS の encodeURIComponent
    public static func encodeURIComponent(_ s: String) -> String {
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")
        return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? s
    }
}

extension Engine {
    /// 通知を押して開いたとき（Web 版 componentDidMount の onNotificationTap の写し）。
    /// actionId はふつうに押したとき "tap"。ボタンなら "yes" "no" "asplanned" "open"
    public func handleNotificationTap(eventId: String?, kind: String, actionId: String, extra: [String: JSONValue]) {
        // まとめのお知らせ：その日の一覧を開く
        if kind == "morning", let day = extra["day"], JS.truthy(day) {
            let p = JS.string(day).components(separatedBy: "-").map { JS.number($0) }
            let y = JS.int(.number(p.count > 0 ? p[0] : .nan)), m = JS.int(.number(p.count > 1 ? p[1] : .nan)), d = JS.int(.number(p.count > 2 ? p[2] : .nan))
            set(["screen": "day", "dayNum": .number(Double(d)), "ym": ["y": .number(Double(y)), "m": .number(Double(m))], "returnTo": "month", "dayFrom": "month", "swipeRow": .null])
            return
        }
        // 日曜の見直し：まだの予定の一覧を開く
        if kind == "weekly" { set(["screen": "list", "listTab": "undecided", "returnTo": "month"]); return }
        guard let ev = events.first(where: { JS.string($0["id"]) == (eventId ?? "undefined") }) else { return }
        let ym: JSONValue = ["y": ev["y"] ?? .null, "m": ev["m"] ?? .null]
        if actionId == "yes" && ev["status"] == "mikakutei" {
            undoPrevKeys = ["status"]
            updateEvent(ev["id"], ["status": "kakutei"])
            set(["screen": "month", "ym": ym])
            showUndo("「\(JS.string(ev["title"]))」を確定にしました", ["kind": "status", "id": ev["id"] ?? .null, "prev": ["status": ev["status"] ?? .null]])
            return
        }
        if actionId == "no" && ev["status"] == "mikakutei" {
            undoPrevKeys = ["status"]
            updateEvent(ev["id"], ["status": "nakunatta"])
            set(["screen": "month", "ym": ym])
            let gone = JS.string(JS.or(core().T(ev["type"])?["gone"], "無くなった"))
            showUndo("「\(JS.string(ev["title"]))」を\(gone)にしました", ["kind": "status", "id": ev["id"] ?? .null, "prev": ["status": ev["status"] ?? .null]])
            return
        }
        if actionId == "asplanned" && ev["status"] == "kakutei" {
            var prev: Obj = [:]
            for k in ["status", "actualEnd", "hourly"] { if let v = ev[k] { prev[k] = v } }
            undoPrevKeys = ["status", "actualEnd", "hourly"]
            updateEvent(ev["id"], ["status": "jisseki", "actualEnd": ev["end"], "hourly": ev["type"] == "baito" ? core().hourlyFor(ev) : nil])
            showUndo("「\(JS.string(ev["title"]))」を予定どおりで記録しました", ["kind": "status", "id": ev["id"] ?? .null, "prev": .object(prev)])
            return
        }
        if kind == "remind" {
            set(["ym": ym])
            openFor(ev, "month")
            return
        }
        openDialog(ev, "worked", "month")
    }
}
