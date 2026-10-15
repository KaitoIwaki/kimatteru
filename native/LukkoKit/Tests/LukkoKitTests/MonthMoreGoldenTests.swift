import XCTest
@testable import LukkoKit

/// 月のまわり（sw-month）：週表示・年月えらび・シフト入力のパレット・給料バー・はじめての案内・確定したときの帯・
/// 日の画面の iPhone の予定、と押したあとの state が Web 版と同じか（golden/view-week・view-month-more・actions-month）
final class MonthMoreGoldenTests: XCTestCase {
    private func load(_ name: String) throws -> [JSONValue] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/\(name)", withExtension: "json"))
        return try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
    }
    /// Web 版の _overlayFor（日番号 a〜b、b は含まない）
    private func overlayFor(_ list: [[String: JSONValue]], _ settings: JSONValue?, _ a: Int, _ b: Int) -> [[String: JSONValue]] {
        guard JS.truthy(settings?["overlayOn"]) else { return [] }
        return list.filter { e in
            let f = AppCore.evFrom(e), l = AppCore.evTo(e) + (WhenLib.endsNextDay(e) ? 1 : 0)
            return l >= a && f < b
        }
    }

    func testWeek() throws {
        let cases = try load("view-week")
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? .null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in cases.enumerated() {
            let eng = ViewGoldenTests.engine(c)
            let core = AppCore(state: eng.state)
            let dark = core.isDark(sysDark: false)
            let first = core.weekFirst()
            let base = first - WeekCore.winBack
            let ov = overlayFor((c["overlay"]?.array ?? []).compactMap { $0.object }, eng.state["settings"], base, base + WeekCore.winBack + WeekCore.winAhead)
            let v = core.weekView(over: ov, dark: dark)
            let w = c["week"] ?? .null
            check(.number(Double(v.base)), w["base"], "#\(i) base")
            check(.number(Double(v.first)), w["first"], "#\(i) first")
            check(.string(v.monthLabel), w["monthLabel"], "#\(i) 月")
            check(.string(v.year), w["year"], "#\(i) 年")
            check(.bool(v.todayBtnShown), w["todayBtnShown"], "#\(i) 今日")
            check(.number(v.startTop), w["startTop"], "#\(i) 最初の位置")
            // 月表示の見出しも、週表示のときは同じ値になる
            let h = eng.monthHead()
            check(.array([.string(h.monthLabel), .string(h.year), .bool(h.todayBtnShown)]), .array([w["monthLabel"] ?? .null, w["year"] ?? .null, w["todayBtnShown"] ?? .null]), "#\(i) 見出し")
            let want = w["cols"]?.array ?? []
            check(.number(Double(v.cols.count)), .number(Double(want.count)), "#\(i) 列の数")
            for (ci, (col, wc)) in zip(v.cols, want).enumerated() {
                let numBg: JSONValue = col.numBg.map { JSONValue.string($0) } ?? .null
                let pills: [JSONValue] = col.allDay.pills.map { p -> JSONValue in ["key": p.key, "title": .string(p.title), "style": .object(p.style)] }
                let boxes: [JSONValue] = col.boxes.map { (b: DayCore.Box) -> JSONValue in
                    ["key": .string(b.key), "a": .number(b.a), "b": .number(b.b), "title": .string(b.title), "time": .string(b.time), "style": .object(b.style)]
                }
                let allDay: JSONValue = ["more": .number(Double(col.allDay.more)), "pills": .array(pills)]
                let got: JSONValue = [
                    "key": .string(col.key), "dow": .string(col.dow), "date": .number(Double(col.d)), "isToday": .bool(col.isToday), "hol": .string(col.hol),
                    "dowColor": .string(col.dowColor), "numColor": .string(col.numColor), "numBg": numBg, "allDay": allDay, "boxes": .array(boxes),
                ]
                check(got, wc, "#\(i) 列\(ci)")
            }
            // 1 日ずつ作っても（アプリの並べ方）同じ
            if let mid = v.cols.dropFirst(30).first {
                let one = core.weekCol(mid.n, over: ov, dark: dark)
                check(.bool(one == mid), .bool(true), "#\(i) 1 日ずつ")
            }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }

    func testMonthMore() throws {
        let cases = try load("view-month-more")
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? .null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in cases.enumerated() {
            let eng = ViewGoldenTests.engine(c)
            let core = AppCore(state: eng.state)
            let dark = core.isDark(sysDark: false)
            // 年月えらび
            // Web 版の正解表は枠の色で見ている（選んでいる月は墨の枠なので、今月の薄い枠は出ない）
            var ys: JSONValue = .null
            if let v = eng.ymSheetView() {
                let months: [JSONValue] = v.months.map { (mo: YMSheetView.Month) -> JSONValue in ["label": .string(mo.label), "sel": .bool(mo.sel), "isThis": .bool(mo.isThis && !mo.sel)] }
                let slide: String = v.dir == 0 ? "none" : (v.dir > 0 ? "slideFromRight" : "slideFromLeft") + " .24s cubic-bezier(.2,.9,.2,1)"
                ys = ["year": .string(v.year), "todayLabel": .string(v.todayLabel), "months": .array(months), "slide": .string(slide)]
            }
            check(ys, c["ymSheet"], "#\(i) 年月えらび")
            // シフト入力
            let sb = eng.stampBarView()
            let tpls: [JSONValue] = (sb?.tpls ?? []).map { (t: StampBarView.Tpl) -> JSONValue in ["key": t.key, "label": .string(t.label), "sub": .string(t.sub), "sel": .bool(t.sel)] }
            let segs: [JSONValue] = (sb?.seg ?? []).map { (g: StampBarView.Seg) -> JSONValue in ["label": .string(g.label), "sel": .bool(g.sel)] }
            let stampLabel: JSONValue = sb.map { JSONValue.string($0.monthLabel) } ?? .null
            let stamp: JSONValue = ["chipShown": .bool(eng.monthHead().stampChipShown), "on": .bool(JS.truthy(eng.state["stamp"])),
                                    "tpls": .array(tpls), "seg": .array(segs), "monthLabel": stampLabel]
            check(stamp, c["stamp"], "#\(i) シフト入力")
            // 給料バー
            let wb = eng.wageBarView()
            let wageOn = JS.truthy(eng.state["wageOn"]) && eng.wageFeatureOn()
            check(["on": .bool(wageOn), "total": .string(wb.total), "unit": .string(wb.unit), "num": .string(wb.num), "label": .string(wb.label)], c["wage"], "#\(i) 給料バー")
            // はじめての案内
            check(.bool(eng.showFirstRunHint()), c["hint"], "#\(i) 案内")
            // 確定したときの帯
            var morph: [JSONValue] = []
            if let m = eng.state["morph"], JS.truthy(m) {
                let ym = eng.state["ym"] ?? .null
                let Y = ym["y"]?.int ?? 0, M = ym["m"]?.int ?? 0
                for w in core.buildWeeks(Y, M, wageOn: wageOn, dark: dark) {
                    for b in w.bars where b.id == m["id"] {
                        guard let ev = (eng.state["events"]?.array ?? []).compactMap({ $0.object }).first(where: { $0["id"] == b.id }) else { continue }
                        let x = core.morphBar(ev, phase: JS.string(m["phase"]), startsHere: (b.style["marginLeft"]?.number ?? 0) > 0, endsHere: (b.style["marginRight"]?.number ?? 0) > 0, dark: dark)
                        let bl: JSONValue = x.borderLeft.map { JSONValue.string($0) } ?? .null
                        let br: JSONValue = x.borderRight.map { JSONValue.string($0) } ?? .null
                        let o: [String: JSONValue] = ["key": .string(b.key), "text": .string(x.text), "mark": .string(x.mark), "background": x.background, "border": .string(x.border),
                                                      "fill": .string(x.fill), "fillOn": .bool(x.fillOn), "ink": .string(x.ink), "settle": .bool(x.settle),
                                                      "borderLeft": bl, "borderRight": br]
                        morph.append(.object(o))
                    }
                }
            }
            check(.array(morph), c["morph"], "#\(i) 確定の帯")
            // 日の画面の iPhone の予定
            let t = eng.state["today"] ?? .null
            let dn = Civil.dayNo(t["y"]?.int ?? 0, t["m"]?.int ?? 0, c["day"]?.int ?? 1)
            let rows = core.dayOverlayRows(overlayFor((c["overlay"]?.array ?? []).compactMap { $0.object }, eng.state["settings"], dn, dn + 1))
            let rowsJ: [JSONValue] = rows.map { (r: DayOverlayRow) -> JSONValue in ["key": r.key, "title": .string(r.title), "place": .string(r.place), "time": .string(r.time)] }
            check(.array(rowsJ), c["dayOverlay"], "#\(i) iPhone の予定")
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }

    func testActions() throws {
        let cases = try load("actions-month")
        let keys = ["ym", "weekAnchor", "flashToday", "ymSheet", "stamp", "dayNum", "screen", "calView", "hintClosed", "returnTo", "dayFrom", "wageOn", "cardKind", "cardFrom", "shareToast"]
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? .null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in cases.enumerated() {
            let eng = ViewGoldenTests.engine(c)
            let ops = c["ops"]?.array ?? [], steps = c["steps"]?.array ?? []
            for (si, (op, want)) in zip(ops, steps).enumerated() {
                let n = op["n"]?.int ?? 0, ix = op["i"]?.int ?? 0
                switch op["op"]?.string ?? "" {
                case "head": eng.tapMonthHead()
                case "today": eng.headToday()
                case "prev": eng.headPrev()
                case "next": eng.headNext()
                case "seg": eng.setCalView(ix == 0 ? "month" : "week")
                case "closeHint": eng.closeFirstRunHint()
                case "stamp", "stampOff": eng.toggleStamp()
                case "wageBar": eng.openWageSummary()
                case "settle": eng.weekSettle(n)
                case "ymPrev": eng.ymSheetShift(-1)
                case "ymNext": eng.ymSheetShift(1)
                case "ymPick": eng.ymSheetPick(ix)
                case "ymToday": eng.ymSheetToday()
                case "ymSwipe":
                    let dx = op["dx"]?.number ?? 0, dy = op["dy"]?.number ?? 0
                    if let h = Engine.ymSheetAxisIsX(dx: dx, dy: dy) { eng.ymSheetSwipeEnd(horizontal: h, dx: dx) }
                case "ymClose": eng.ymSheetClose()
                case "stampPick": eng.stampPick(eng.stampBarView()?.tpls[ix].key)
                case "stampStatus": eng.stampSetStatus(ix == 0 ? "kakutei" : "mikakutei")
                default: XCTFail("知らない操作 \(op)")
                }
                var got: [String: JSONValue] = [:], w: [String: JSONValue] = [:]
                for k in keys {
                    let v = (k == "calView" || k == "hintClosed") ? eng.state["settings"]?[k] : eng.state[k]
                    if let v, v != .null { got[k] = v }
                    if let x = want[k], x != .null { w[k] = x }
                }
                check(.object(got), .object(w), "#\(i) \(si) \(op)")
            }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }

    // MARK: 何千件あっても重くならないか

    private func bigState(_ n: Int) -> [String: JSONValue] {
        let tz = TimeZone(identifier: "Asia/Tokyo")!
        let now = 1_791_000_000_000.0
        var st = Engine.defaultState(now: now, tz: tz)
        var evs: [JSONValue] = []
        var seed: UInt64 = 42
        func r(_ k: Int) -> Int { seed = seed &* 6364136223846793005 &+ 1442695040888963407; return Int((seed >> 33) % UInt64(k)) }
        let statuses = ["kakutei", "mikakutei", "jisseki", "nakunatta"], types = ["yoji", "baito", "asobi", "other"]
        for i in 0..<n {
            var e: [String: JSONValue] = ["id": .string("e\(i)"), "y": .number(Double(2026 + r(2))), "m": .number(Double(r(12))), "day": .number(Double(1 + r(28))),
                                          "start": .string(String(format: "%02d:00", r(24))), "end": .string(String(format: "%02d:30", r(24))),
                                          "title": .string("予定\(i % 37)"), "type": .string(types[r(4)]), "status": .string(statuses[r(4)]), "updatedAt": .number(Double(i))]
            if r(6) == 0 { e["allDay"] = true; e["days"] = .number(Double(1 + r(5))) }
            evs.append(.object(e))
        }
        st["events"] = .array(evs)
        st["ym"] = ["y": 2026, "m": 9]
        return st
    }

    /// 索引で絞っても、全部を見たときと同じ予定が同じ並びで出る
    func testIndexMatchesLinearScan() {
        let st = bigState(3000)
        let all = (st["events"]?.array ?? []).compactMap { $0.object }
        let ix = EventDayIndex.of(st["events"]?.array ?? [])
        for (a, b) in [(Civil.dayNo(2026, 9, 1), Civil.dayNo(2026, 9, 31)), (Civil.dayNo(2027, 0, 5), Civil.dayNo(2027, 0, 5)), (Civil.dayNo(2025, 11, 30), Civil.dayNo(2026, 0, 2)), (0, 1)] {
            let want = all.filter { AppCore.evTo($0) >= a && AppCore.evFrom($0) <= b }
            XCTAssertEqual(ix.overlapping(a, b), want, "\(a)〜\(b)")
        }
        // 同じ配列なら同じ索引、変わったら作り直す
        XCTAssertTrue(EventDayIndex.of(st["events"]?.array ?? []) === ix)
        var changed = st["events"]?.array ?? []
        changed[0] = .object(["id": "x", "y": 2026, "m": 9, "day": 1, "start": "10:00", "end": "11:00", "title": "x", "type": "yoji", "status": "kakutei"])
        XCTAssertFalse(EventDayIndex.of(changed) === ix)
        XCTAssertEqual(EventDayIndex.of(changed).overlapping(Civil.dayNo(2026, 9, 1), Civil.dayNo(2026, 9, 1)).first?["id"], "x")
    }

    /// 5000 件で、月を前後ふくめて描く・週を描く・日を描くのが十分に速い（ゆるい上限）
    func testFiveThousandEventsIsFast() {
        let st = bigState(5000)
        let core = AppCore(state: st)
        let start = Date()
        // 月表示は前後 2 か月ずつ、5 ページを描く
        for m in 7...11 { _ = core.buildWeeks(2026, m, lanes: 4, wageOn: true, dark: false) }
        let first = Date().timeIntervalSince(start)
        // 2 回目は作ったものを使う
        let s2 = Date()
        for _ in 0..<20 { for m in 7...11 { _ = core.buildWeeks(2026, m, lanes: 4, wageOn: true, dark: false) } }
        let again = Date().timeIntervalSince(s2)
        // 週表示（Web 版と同じ 63 日ぶん）と日の画面
        let s3 = Date()
        var e = st; e["settings"] = .object(Engine.with(st["settings"]?.object ?? [:], ["calView": "week"]))
        _ = AppCore(state: e).weekView(dark: false)
        for d in 1...28 { _ = core.dayView(2026, 9, d, dark: false); _ = core.dayStripCell(Civil.dayNo(2026, 9, d), selected: Civil.dayNo(2026, 9, 1)) }
        let week = Date().timeIntervalSince(s3)
        print("5000 件：月 5 ページ \(first)s、2 回目×20 \(again)s、週と日 \(week)s")
        XCTAssertLessThan(first, 3.0)
        XCTAssertLessThan(again, 0.5)
        XCTAssertLessThan(week, 3.0)
        // 作ったものを使っても、答えは作り直したときと同じ
        let ix = EventDayIndex.of(st["events"]?.array ?? [])
        XCTAssertEqual(core.buildWeeks(2026, 9, lanes: 4, wageOn: true, dark: false),
                       core.buildWeeksRaw(2026, 9, lanes: 4, overlay: [], wageOn: true, dark: false, sysZoom: 1, index: ix))
    }
}
