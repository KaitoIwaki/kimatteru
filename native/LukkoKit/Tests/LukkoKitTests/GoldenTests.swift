import XCTest
@testable import LukkoKit

/// 正解表（native/golden/gen.mjs が、いまの Web 版のコードを動かして作った表）と、
/// SwiftUI 版の計算が 1 つ残らず一致するかを確かめる。
final class GoldenTests: XCTestCase {
    private func load(_ name: String) throws -> JSONValue {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/\(name)", withExtension: "json"))
        return try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
    }

    func testHolidays() throws {
        let rows = try XCTUnwrap(load("holidays").array)
        var expected: [String: String] = [:]
        for r in rows { let a = r.array!; expected["\(a[0].int!)-\(a[1].int!)-\(a[2].int!)"] = a[3].string! }
        var mismatches: [String] = []
        for y in 2000...2040 {
            for m in 0..<12 {
                for d in 1...Civil.daysInMonth(y, m) {
                    let got = Holidays.name(y, m, d)
                    let want = expected["\(y)-\(m)-\(d)"]
                    if got != want { mismatches.append("\(y)-\(m + 1)-\(d): \(got ?? "なし") ≠ \(want ?? "なし")") }
                }
            }
        }
        XCTAssertEqual(mismatches, [], "祝日が合わない")
    }

    func testWhenLib() throws {
        let rows = try XCTUnwrap(load("whenlib").array)
        for (i, r) in rows.enumerated() {
            let ev = try XCTUnwrap(r["ev"]?.object)
            XCTAssertEqual(WhenLib.toMin(ev["start"]), r["toMinStart"]?.number, "toMin #\(i) \(ev)")
            XCTAssertEqual(WhenLib.endsNextDay(ev), r["endsNextDay"]?.bool, "endsNextDay #\(i) \(ev)")
            XCTAssertEqual(WhenLib.spillsNextDay(ev), r["spillsNextDay"]?.bool, "spillsNextDay #\(i) \(ev)")
            XCTAssertEqual(WhenLib.busyEndMin(ev), r["busyEndMin"]?.number, "busyEndMin #\(i) \(ev)")
            let em = WhenLib.endMoment(ev)
            XCTAssertEqual([em.y, em.m, em.d, em.h, em.min], r["endMoment"]?.array?.compactMap { $0.int }, "endMoment #\(i) \(ev)")
        }
    }

    func testTimeGrid() throws {
        let rows = try XCTUnwrap(load("timegrid").array)
        for (i, r) in rows.enumerated() {
            let evs = try XCTUnwrap(r["evs"]?.array).compactMap { $0.object }
            let y = r["y"]!.int!, m = r["m"]!.int!, d = r["d"]!.int!
            let segs = TimeGrid.segmentsForDay(evs, y, m, d)
            XCTAssertEqual(segs.map { [JSONValue.string($0.id), .number($0.a), .number($0.b), .bool($0.cont)] }, r["segs"]?.array?.compactMap { $0.array }, "segments #\(i)")
            let lay = TimeGrid.layoutColumns(segs)
            XCTAssertEqual(lay.map { [JSONValue.string($0.id), .number($0.a), .number($0.b), .bool($0.cont), .number(Double($0.col)), .number(Double($0.cols))] },
                           r["layout"]?.array?.compactMap { $0.array }, "layout #\(i)")
            XCTAssertEqual(TimeGrid.allDayFor(evs, y, m, d).map { JS.string($0["id"]) }, r["allDay"]?.array?.compactMap { $0.string }, "allDay #\(i)")
            XCTAssertEqual(TimeGrid.weekStartNo(y, m, d, 0), r["weekStart0"]?.int, "weekStart0 #\(i)")
            XCTAssertEqual(TimeGrid.weekStartNo(y, m, d, 1), r["weekStart1"]?.int, "weekStart1 #\(i)")
        }
    }
}
