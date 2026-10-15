import XCTest
@testable import LukkoKit

/// 時間・給料・まとめの内訳・お知らせの言葉が、Web 版と 1 つ残らず同じか（正解表 golden/calc.json）
final class CalcGoldenTests: XCTestCase {
    func testCalc() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/calc", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        var fails = 0
        for (i, c) in cases.enumerated() {
            let st = try XCTUnwrap(c["st"]?.object)
            let core = AppCore(state: st)
            let method = try XCTUnwrap(c["method"]?.string)
            let args = c["args"]?.array ?? []
            let want = c["out"]
            func arg(_ k: Int) -> JSONValue? { k < args.count ? args[k] : nil }
            func ev(_ k: Int) -> [String: JSONValue] { arg(k)?.object ?? [:] }
            func num(_ k: Int) -> Double { JS.number(arg(k)) }
            let got: JSONValue?
            switch method {
            case "hourlyFor": got = core.hourlyFor(ev(0))
            case "breakMin": got = .number(core.breakMin(ev(0)))
            case "paidHours": got = .number(core.paidHours(ev(0)))
            case "wage": got = .number(core.wage(ev(0)))
            case "spentHours": got = .number(core.spentHours(ev(0)))
            case "spanLabel": got = .string(core.spanLabel(ev(0)))
            case "fmtHours": got = .string(core.fmtHours(num(0)))
            case "_timeBreakdown": got = .array(core.timeBreakdown((arg(0)?.array ?? []).compactMap { $0.object }))
            case "_jobBreakdownNoColor": got = .array(core.jobBreakdown((arg(0)?.array ?? []).compactMap { $0.object }).map { .object(($0.object ?? [:]).filter { $0.key != "color" }) })
            case "priorFor": got = .number(core.priorFor(Int(num(0))))
            case "mins": got = .number(core.mins(JS.string(arg(0))))
            case "addMin": got = .string(core.addMin(JS.string(arg(0)), num(1)))
            case "hoursBetween": got = .number(core.hoursBetween(JS.string(arg(0)), JS.string(arg(1))))
            case "fmtWage": got = .string(core.fmtWage(num(0)))
            case "fmtMin": got = .string(core.fmtMin(num(0)))
            case "fmtSpent": got = .string(core.fmtSpent(num(0), num(1)))
            case "remindLabel": got = .string(core.remindLabel(arg(0), arg(1)))
            default: XCTFail("知らないメソッド \(method)"); continue
            }
            if got != want {
                fails += 1
                if fails <= 40 { XCTFail("#\(i) \(method)(\(args)) → \(String(describing: got)) ≠ \(String(describing: want))") }
            }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }

    /// 数 → 文字（JS と同じ書き方）
    func testNumberToString() {
        let cases: [(Double, String)] = [(0, "0"), (1, "1"), (-1, "-1"), (0.1, "0.1"), (1.5, "1.5"), (1e21, "1e+21"), (123456789012345680000, "123456789012345680000"),
            (0.000001, "0.000001"), (0.0000001, "1e-7"), (0.003472222222222222, "0.003472222222222222"), (66.41666666666666, "66.41666666666666"), (1e-5, "0.00001"), (2.5e-7, "2.5e-7"), (1234.5, "1234.5")]
        for (n, s) in cases { XCTAssertEqual(JS.numberToString(n), s, "\(n)") }
        XCTAssertEqual(JS.round(2.5), 3); XCTAssertEqual(JS.round(-2.5), -2); XCTAssertEqual(JS.round(0.49999999999999994), 0)
        XCTAssertEqual(JS.groupedInt(1234567), "1,234,567"); XCTAssertEqual(JS.groupedInt(0), "0"); XCTAssertEqual(JS.groupedInt(999), "999")
    }
}
