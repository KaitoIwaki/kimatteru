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
}
