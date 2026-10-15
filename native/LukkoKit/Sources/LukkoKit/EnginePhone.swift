import Foundation

/// iPhone のカレンダー・.ics からの取り込みの流れ（Web 版 App.jsx の runScan・runRead・runIcs の写し）
/// 待ち（await）をはさむ処理は @MainActor にする。付けないと、待ちのあとが裏のスレッドで動き、画面と同時に中身（state）を書き換えて落ちる（許可のあとに落ちていた）
extension Engine {
    func setImp(_ patch: [String: JSONValue?]) { set(["imp": .object(Self.with(impObj, patch))]) }

    /// まだ許可を聞いていない人には、説明を挟まずにすぐ iPhone の許可の画面を出す（5.1.1(iv)）
    @MainActor public func askImportNow() async {
        guard phone != nil else { return }
        let st = await PhoneCal.checkAccess(phone)
        if st == "prompt" && state["screen"] == str("import") { await runScan() }
    }

    @MainActor public func openImport() async {
        set(["screen": str("import"), "imp": .object(["phase": str("idle"), "found": .array([]), "type": str("yoji"), "error": str("")])])
        await askImportNow()
    }

    /// 許可をもらって、読むカレンダーを選んでもらう（選び方は覚えておく）
    @MainActor public func runScan() async {
        haptic("light")
        setImp(["phase": str("scanning"), "error": str("")])
        let perm = await PhoneCal.askAccess(phone)
        if perm != "granted" {
            setImp(["phase": str("idle"), "denied": .bool(perm != "unavailable"),
                    "error": str(perm == "unavailable" ? "この端末では取り込みを使えません。" : "カレンダーを読む許可が下りませんでした。設定アプリで「カレンダー」を許可すると取り込めます。")])
            return
        }
        let cals = await PhoneCal.listImportCalendars(phone)
        let mem = settings["importCals"].flatMap { JS.truthy($0) ? $0.object : nil } ?? [:]
        let rows: [JSONValue] = cals.map { c in
            let m = mem[JS.string(c["id"])]
            let on: Bool = (m.map { JS.truthy($0) } ?? false) ? (m?["on"] != .bool(false)) : true
            let type: JSONValue = (m.map { JS.truthy($0) } ?? false) ? (JS.or(m?["type"], str("")) ?? str("")) : str("")
            return .object(Self.with(c.object ?? [:], ["on": .bool(on), "type": type]))
        }
        if rows.isEmpty { await runRead([]); return }
        setImp(["phase": str("cals"), "cals": .array(rows), "range": JS.or(impObj["range"], str("month"))])
    }

    /// 選んだカレンダーを読む。2 回目からは、前に取り込んだ予定と突き合わせて「直った」「元で消えた」を分ける
    @MainActor public func runRead(_ calIds: [JSONValue]?) async {
        haptic("light")
        let im = impObj
        setImp(["phase": str("scanning"), "error": str("")])
        let n = JSDate.local(now, timeZone)
        let range = im["range"]
        let fromParts: (Int, Int, Int) = range == str("year") ? (n.y, 0, 1) : range == str("back") ? (n.y - 1, n.m, 1) : (n.y, n.m - 1, 1)
        let fromDate = JSDate.make(fromParts.0, fromParts.1, fromParts.2, 0, 0, 0, timeZone)
        let imCals = (im["cals"]?.array ?? []).compactMap { $0.object }
        let ids: [JSONValue] = calIds ?? imCals.filter { JS.truthy($0["on"]) }.map { $0["id"] ?? .null }
        // 覚えておく（次は同じ選び方から始める）
        if !imCals.isEmpty {
            var mem: [String: JSONValue] = [:]
            for c in imCals { mem[JS.string(c["id"])] = .object(Self.with(["type": JS.or(c["type"], str("")) ?? str("")], ["on": c["on"]])) }
            set(["settings": .object(Self.with(settings, ["importCals": .object(mem)]))])
        }
        do {
            let all = try await PhoneCal.readCalendarEvents(phone, monthsAhead: 12, calIds: ids.isEmpty ? nil : ids.map { JS.string($0) }, fromDate: fromDate, now: now, tz: timeZone)
            let fd = JSDate.local(fromDate, timeZone)
            let fromN = Civil.dayNo(fd.y, fd.m, fd.d), toN = Civil.dayNo(n.y, n.m + 13, 0)
            let incoming = all.compactMap { $0.object }
            let existing = events
            let d = ImportCore.diffImport(incoming, existing, range: (fromN, toN, ids.isEmpty ? nil : ids))
            // 種類：カレンダーごとに決めてあればそれ、無ければ名前から当てる
            var calType: [String: JSONValue] = [:]
            for c in imCals where JS.truthy(c["type"]) { calType[JS.string(c["id"])] = c["type"] }
            let fresh = d.fresh.map { incoming[$0] }
            let guesses = ImportCore.guessTypes(fresh, typesList)
            var picked: [JSONValue] = []
            for (i, e) in fresh.enumerated() {
                let ct = calType[JS.string(e["srcCal"])]
                picked.append(.object(Self.with(e, ["key": str("k\(i)"), "on": .bool(true), "kind": str("new"),
                                                    "type": JS.or(ct, guesses[i]["key"]), "guessed": .bool(!JS.truthy(ct) && JS.truthy(guesses[i]["why"]))])))
            }
            for (i, c) in d.changed.enumerated() {
                let inc = incoming[c.0], ex = existing[c.1]
                let was = "\(JS.string(.number(JS.number(ex["m"]) + 1)))/\(JS.string(ex["day"])) " + (JS.truthy(ex["allDay"]) ? "終日" : JS.string(ex["start"]))
                picked.append(.object(Self.with(inc, ["key": str("c\(i)"), "on": .bool(true), "kind": str("changed"), "existingId": ex["id"], "type": ex["type"], "was": str(was)])))
            }
            for (i, gi) in d.gone.enumerated() {
                let e = existing[gi]
                picked.append(.object(Self.with(e, ["key": str("g\(i)"), "on": .bool(false), "kind": str("gone"), "existingId": e["id"]])))
            }
            // 1 件も無いときは、たいてい別のカレンダーアプリを使っている。ほかのカレンダーの案内を開いて出す
            setImp(["phase": str("found"), "found": .array(picked), "source": str("cal"), "otherOpen": picked.isEmpty ? .bool(true) : impObj["otherOpen"]])
        } catch {
            setImp(["phase": str("idle"), "error": str("予定を読めませんでした。時間をおいて試してください。")])
        }
    }

    /// .ics の中身を、カレンダーの取り込みと同じ一覧に流す
    public func runIcs(_ text: String) {
        let n = JSDate.local(now, timeZone)
        let all = IcsCore.parseIcs(text, today: (n.y, n.m, n.d), tz: timeZone).compactMap { $0.object }
        let fresh = ImportCore.dedupe(all, events).map { all[$0] }
        let guesses = ImportCore.guessTypes(fresh, typesList)
        func known(_ k: JSONValue?) -> Bool { typesList.contains { $0["key"] == k } }
        let picked: [JSONValue] = fresh.enumerated().map { i, e in
            let lt = JS.truthy(e["ltype"]) && known(e["ltype"])
            return .object(Self.with(e, ["key": str("k\(i)"), "on": .bool(true), "type": lt ? e["ltype"] : guesses[i]["key"],
                                         "guessed": .bool(!lt && JS.truthy(guesses[i]["why"])),
                                         "status": str(JS.truthy(e["tentative"]) ? "mikakutei" : (e["lstatus"] == str("jisseki") ? "jisseki" : "kakutei"))]))
        }
        set(["screen": str("import"), "imp": .object(Self.with(impObj, ["phase": str("found"), "found": .array(picked), "error": str(""), "source": str("ics"), "otherOpen": .bool(false)]))])
    }
}

extension Engine {
    /// 取り込むカレンダーを選ぶ段（Web 版 renderVals の impCals の on〜）
    public func toggleImportCal(_ id: JSONValue?) {
        haptic("light")
        setImp(["cals": .array((impObj["cals"]?.array ?? []).map { c in c["id"] == id ? .object(Self.with(c.object ?? [:], ["on": .bool(!JS.truthy(c["on"]))])) : c })])
    }
    /// カレンダーごとの種類を、名前から当てる → 見えている種類の順に回す
    public func cycleImportCalType(_ id: JSONValue?) {
        haptic("light")
        let keys: [JSONValue] = [""] + visibleTypes().map { $0["key"] ?? .null }
        setImp(["cals": .array((impObj["cals"]?.array ?? []).map { c in
            guard c["id"] == id else { return c }
            let cur = JS.or(c["type"], "") ?? ""
            let i = keys.firstIndex(of: cur) ?? -1
            return .object(Self.with(c.object ?? [:], ["type": keys[(i + 1) % keys.count]]))
        })])
    }
    public func setImportRange(_ k: String) { haptic("light"); setImp(["range": .string(k)]) }
    /// 1 件ごとの種類の札：押すと次の種類に
    public func cycleImportRowType(_ key: JSONValue?) {
        haptic("light")
        guard let e = (impObj["found"]?.array ?? []).first(where: { $0["key"] == key }) else { return }
        let keys = visibleTypes().map { $0["key"] ?? .null }
        guard !keys.isEmpty else { return }
        let i = keys.firstIndex(of: e["type"] ?? .null) ?? -1
        setImportRowType(key, keys[(i + 1) % keys.count])
    }
}
