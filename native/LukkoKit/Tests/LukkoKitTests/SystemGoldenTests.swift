import XCTest
@testable import LukkoKit

/// 下のタブを押したとき・文字の大きさが、Web 版と同じか（golden/system.json）
final class SystemGoldenTests: XCTestCase {
    private func load() throws -> JSONValue {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/system", withExtension: "json"))
        return try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
    }

    func testNavTab() throws {
        let g = try load()
        let tz = TimeZone(identifier: "Asia/Tokyo")!
        let cases = g["nav"]?.array ?? []
        XCTAssertGreaterThan(cases.count, 100)
        var fails = 0
        for (i, c) in cases.enumerated() {
            let now = c["now"]?.number ?? 0
            var st = Engine.defaultState(now: now, tz: tz)
            for (k, v) in c["init"]?.object ?? [:] { st[k] = v }
            let eng = Engine(state: st, now: now, timeZone: tz)
            eng.navTab(c["tab"]?.string ?? "")
            for (k, want) in c["out"]?.object ?? [:] {
                let got = eng.state[k] ?? .null
                if got != want {
                    fails += 1
                    if fails <= 20 { XCTFail("nav #\(i) \(c["tab"]?.string ?? "") \(k)：\n\(got)\n≠\n\(want)") }
                }
            }
        }
    }

    func testZoom() throws {
        let g = try load()
        let cases = g["zoom"]?.array ?? []
        XCTAssertGreaterThan(cases.count, 100)
        for (i, c) in cases.enumerated() {
            let px = c["px"]?.number ?? 0
            let z = SystemCore.sysZoom(bodyPointSize: px)
            XCTAssertEqual(z, c["sysZoom"]?.number ?? -1, "zoom #\(i) px \(px)")
            var settings: [String: JSONValue] = [:]
            if let f = c["fontScale"], f != .null { settings["fontScale"] = f }
            let core = AppCore(state: ["settings": .object(settings)])
            XCTAssertEqual(core.evScale(sysZoom: z), c["evScale"]?.number ?? -1, "evScale #\(i) px \(px) fontScale \(String(describing: c["fontScale"]))")
        }
    }

    func testRootTabAndStamp() {
        XCTAssertEqual(SystemCore.rootTab("month"), "month")
        XCTAssertEqual(SystemCore.rootTab("settings"), "settings")
        XCTAssertNil(SystemCore.rootTab("day"))
        XCTAssertNil(SystemCore.rootTab(nil))
        let a: [String: JSONValue] = ["events": [["id": "a"]], "types": [["key": "yoji"]], "settings": ["weekStart": 1]]
        var b = a
        XCTAssertEqual(SystemCore.widgetStamp(a), SystemCore.widgetStamp(b))
        b["settings"] = ["weekStart": 1, "hideTitles": true]
        XCTAssertNotEqual(SystemCore.widgetStamp(a), SystemCore.widgetStamp(b))
        b = a
        b["settings"] = ["weekStart": 1, "theme": "dark"]
        XCTAssertEqual(SystemCore.widgetStamp(a), SystemCore.widgetStamp(b), "表示の設定だけでは送り直さない")
    }
}
