import XCTest
@testable import LukkoKit

/// 画面に出す中身が、Web 版の renderVals と同じか（golden/view-*.json）
final class ViewGoldenTests: XCTestCase {
    func testMonth() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/view-month", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? .null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in cases.enumerated() {
            let eng = Engine(state: c["state"]?.object ?? [:], now: c["now"]?.number ?? 0, timeZone: TimeZone(identifier: "Asia/Tokyo")!)
            let core = AppCore(state: eng.state)
            let dark = core.isDark(sysDark: false)
            let wageOn = JS.truthy(eng.state["wageOn"]) && eng.wageFeatureOn()
            let ym = eng.state["ym"] ?? .null
            let weeks = core.buildWeeks(ym["y"]?.int ?? 0, ym["m"]?.int ?? 0, wageOn: wageOn, dark: dark)
            let got: [JSONValue] = weeks.map { w in
                ["slots": .array(w.slots.map { s in
                    ["day": .number(Double(s.day)), "blank": .bool(s.blank), "color": .string(s.color), "today": .bool(s.today),
                     "todayBg": s.todayBg.map { .string($0) } ?? .null, "bg": .string(s.bg), "weight": .number(Double(s.weight))]
                 }),
                 "bars": .array(w.bars.map { b in
                    var o: [String: JSONValue] = ["key": .string(b.key), "text": .string(b.text), "mark": .string(b.mark),
                                                  "col": .string("\(b.c0 + 1) / span \(b.span)"), "row": .number(Double(b.lane + 2))]
                    for (k, v) in b.style { o[k] = v }
                    return .object(o)
                 }),
                 "more": .array(w.more.map { m in ["text": .string("+\(m.n)件"), "col": .string("\(m.col + 1) / span 1"), "row": .number(Double(w.lanes + 2))] })]
            }
            let want = c["weeks"]?.array ?? []
            if got.count != want.count { check(.number(Double(got.count)), .number(Double(want.count)), "#\(i) 週の数") }
            for (wi, (g, w)) in zip(got, want).enumerated() {
                for k in ["slots", "bars", "more"] { check(g[k] ?? .null, w[k], "#\(i) 週\(wi) \(k)") }
            }
            let h = eng.monthHead()
            let head: JSONValue = ["monthLabel": .string(h.monthLabel), "year": .string(h.year), "todayBtnShown": .bool(h.todayBtnShown),
                                   "undecidedCount": .number(Double(h.undecidedCount)), "shelfCount": .number(Double(h.shelfCount)), "shelfLabel": .string(h.shelfLabel),
                                   "bellCount": .number(Double(h.bellCount)), "bellBadge": .string(h.bellBadge),
                                   "weekdays": .array(h.weekdays.map { [.string($0.label), .string($0.color)] }),
                                   "stampChipShown": .bool(h.stampChipShown), "wageToggleShown": .bool(h.wageToggleShown), "calView": .string(h.calView)]
            check(head, c["head"], "#\(i) 見出し")
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }

    func testDay() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/view-day", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? .null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        func opt(_ s: String?) -> JSONValue? { s.map { .string($0) } }
        for (i, c) in cases.enumerated() {
            let st = c["state"]?.object ?? [:]
            let core = AppCore(state: st)
            let dark = core.isDark(sysDark: false)
            let ym = st["ym"] ?? .null
            let Y = ym["y"]?.int ?? 0, M = ym["m"]?.int ?? 0, d = st["dayNum"]?.int ?? 1
            let v = core.dayView(Y, M, d, dark: dark)
            let h = v.head
            check(["dayTitle": .string(h.title), "dayHoliday": .string(h.holiday), "dayBigDate": .string(h.bigDate), "dayDowFull": .string(h.dowFull),
                   "dayDateColor": .string(h.dateColor), "daySummary": .string(h.summary), "dayEmpty": .bool(h.empty), "dayView": .string(h.view),
                   "dayTitleColor": .string(h.titleColor)], c["head"], "#\(i) 見出し")
            let rows: [JSONValue] = v.rows.map { r in
                var o: [String: JSONValue] = ["key": r.key, "startText": .string(r.startText), "endText": .string(r.endText), "timeText": .string(r.timeText),
                    "accent": .string(r.accent), "dashed": .bool(r.dashed), "titleText": .string(r.titleText), "titlePlain": .string(r.titlePlain),
                    "place": .string(r.place), "statusWord": .string(r.statusWord), "chip": .object(r.chip), "cardBorder": .string(r.cardBorder),
                    "titleColor": .string(r.titleColor), "titleDeco": .string(r.titleDeco), "titleSize": .number(r.titleSize), "bar": opt(r.bar) ?? .null]
                if let x = r.durText { o["durText"] = .string(x) }
                if let x = r.gapBefore { o["gapBefore"] = .string(x) }
                return .object(o)
            }
            check(.array(rows), c["rows"], "#\(i) 一覧")
            let dn = Civil.dayNo(Y, M, d)
            let strip: [JSONValue] = ((dn - 9)...(dn + 9)).map { n in
                let x = core.dayStripCell(n, selected: dn)
                return ["key": .string(x.key), "dow": .string(x.dow), "date": .number(Double(x.date)), "sel": .bool(x.sel), "today": .bool(x.today), "has": .bool(x.has),
                        "monthHead": .string(x.monthHead), "monthFull": .string(x.monthFull), "dowColor": .string(x.dowColor), "numColor": .string(x.numColor)]
            }
            check(.array(strip), c["strip"], "#\(i) 日付の帯")
            if let want = c["time"], want != .null {
                let hide = JS.truthy(st["settings"]?["hideCanceled"])
                let pool = (st["events"]?.array ?? []).compactMap { $0.object }.filter { !(hide && $0["status"] == "nakunatta") }
                let ad = core.timeGridAllDay(pool, Y, M, d, dark: dark)
                let boxes = core.timeGridBoxes(pool, over: [], Y, M, d, dark: dark)
                let t = st["today"] ?? .null
                let got: JSONValue = [
                    "isToday": .bool(dn == Civil.dayNo(t["y"]?.int ?? 0, t["m"]?.int ?? 0, t["d"]?.int ?? 0)),
                    "more": .number(Double(ad.more)),
                    "pills": .array(ad.pills.map { ["key": $0.key, "title": .string($0.title), "style": .object($0.style)] }),
                    "boxes": .array(boxes.map { ["key": .string($0.key), "a": .number($0.a), "b": .number($0.b), "title": .string($0.title), "time": .string($0.time), "style": .object($0.style)] }),
                ]
                check(got, want, "#\(i) 時間")
            }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }

    func testAlerts() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/view-alert", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        let keys = ["events", "trash", "confirmDelete", "deleteRest", "confirmRestore", "candAsk", "confirmJob", "jobs", "discardAsk", "repEditAsk", "screen", "undo", "shareMsg", "shareToast", "gone", "detailId", "returnTo", "dialog"]
        var fails = 0
        func check(_ got: JSONValue, _ want: JSONValue?, _ what: @autoclosure () -> String) {
            if got != (want ?? .null) { fails += 1; if fails <= 15 { XCTFail("\(what())：\n\(got)\n≠\n\(String(describing: want))") } }
        }
        for (i, c) in cases.enumerated() {
            let eng = Engine(state: c["state"]?.object ?? [:], now: c["now"]?.number ?? 0, timeZone: TimeZone(identifier: "Asia/Tokyo")!)
            let spec = eng.alertSpec()
            let got: JSONValue = spec.map { sp in
                var o: [String: JSONValue] = ["key": .string(sp.key), "title": .string(sp.title), "sheet": .bool(sp.sheet),
                    "buttons": .array(sp.buttons.map { ["label": .string($0.label), "style": .string($0.style), "preferred": .bool($0.preferred)] })]
                if let m = sp.message { o["message"] = .string(m) }
                return .object(o)
            } ?? .null
            check(got, c["spec"], "#\(i) 確認")
            if let p = c["pressed"]?.int, let sp = spec, p < sp.buttons.count {
                eng.runAlert(sp.buttons[p].run)
                var o: [String: JSONValue] = [:]
                for k in keys { if let v = eng.state[k] { o[k] = v } }
                var m1: [String: String] = [:], m2: [String: String] = [:]
                check(ActionsGoldenTests.normalize(.object(o), &m1), ActionsGoldenTests.normalize(c["after"] ?? .null, &m2), "#\(i) 「\(sp.buttons[p].label)」を押したあと")
            }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
