import XCTest
@testable import LukkoKit

/// はじめての案内と、予定の取り込みの画面の中身が Web 版と同じか（golden/form-onboard.json・form-import.json）
final class FormUIGoldenTests: XCTestCase {
    private func load(_ name: String) throws -> [JSONValue] {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/\(name)", withExtension: "json"))
        return try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
    }
    private func compare(_ got: JSONValue, _ want: JSONValue, _ label: String, _ fails: inout Int) {
        guard got != want else { return }
        fails += 1
        guard fails <= 15 else { return }
        let go = got.object ?? [:], wo = want.object ?? [:]
        let diff = Set(go.keys).union(wo.keys).filter { go[$0] != wo[$0] }.sorted()
        XCTFail("\(label) 違う \(diff)：\n" + diff.map { "\($0)：\(String(describing: go[$0]))\n   ≠ \(String(describing: wo[$0]))" }.joined(separator: "\n"))
    }

    func testOnboard() throws {
        var fails = 0
        for (i, c) in try load("form-onboard").enumerated() {
            let eng = Engine(state: c["state"]?.object ?? [:], now: c["now"]?.number ?? 0, timeZone: TimeZone(identifier: "Asia/Tokyo")!)
            let v = eng.onboardView()
            let got: JSONValue = [
                "step": .number(Double(v.step)), "fast": .bool(v.fast),
                "profiles": .array(v.profiles.map { ["key": .string($0.key), "label": .string($0.label), "note": .string($0.note), "sel": .bool($0.sel)] }),
                "dateText": .string(v.dateText), "solidLabel": .string(v.solidLabel), "demoLabel": .string(v.demoLabel), "askHeading": .string(v.askHeading),
                "asking": .bool(v.asking), "filled": .bool(v.filled), "done": .bool(v.done), "caption": .string(v.caption), "captionGreen": .bool(v.captionGreen),
                "nextDark": .bool(v.nextDark), "morningOn": .bool(v.morningOn),
                "solidBg": .string(v.solidBg), "solidLine": .string(v.solidLine), "solidInk": .string(v.solidInk),
                "dashBg": .string(v.dashBg), "dashLine": .string(v.dashLine), "dashInk": .string(v.dashInk), "fillBg": .string(v.fillBg),
            ]
            compare(got, c["view"] ?? .null, "#\(i) はじめての案内", &fails)
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }

    func testImport() throws {
        var fails = 0
        for (i, c) in try load("form-import").enumerated() {
            let eng = Engine(state: c["state"]?.object ?? [:], now: c["now"]?.number ?? 0, timeZone: TimeZone(identifier: "Asia/Tokyo")!)
            let v = eng.importView()
            let got: JSONValue = [
                "phase": .string(v.phase), "error": .string(v.error), "denied": .bool(v.denied), "count": .string(v.count), "onCount": .string(v.onCount),
                "allOn": .bool(v.allOn), "guessText": .string(v.guessText),
                "rows": .array(v.rows.map { r in ["key": r.key, "title": .string(r.title), "on": .bool(r.on), "kindTag": .string(r.kindTag), "place": .string(r.place),
                                                  "when": .string(r.when), "typeName": .string(r.typeName), "typeBg": .string(r.typeBg), "typeInk": .string(r.typeInk), "typeLine": .string(r.typeLine)] }),
                "bulkChips": .array(v.bulkChips.map { .string($0.label) }),
                "added": .string(v.added), "doneDetail": .string(v.doneDetail), "doneDashed": .string(v.doneDashed), "undoShown": .bool(v.undoShown),
                "cals": .array(v.cals.map { k in ["id": k.id, "label": .string(k.label), "color": .string(k.color), "on": .bool(k.on), "typeName": .string(k.typeName),
                                                  "typeBg": .string(k.typeBg), "typeInk": .string(k.typeInk)] }),
                "rangeChips": .array(v.rangeChips.map { ["label": .string($0.label), "sel": .bool($0.sel)] }), "calsOnCount": .number(Double(v.calsOnCount)),
                "none": .bool(v.none), "fromIcs": .bool(v.fromIcs), "tidy": .bool(v.tidy), "tidied": .string(v.tidied),
                "otherOpen": .bool(v.otherOpen), "askOpen": .bool(v.askOpen), "bulkOpen": .bool(v.bulkOpen), "otherSteps": .array(v.otherSteps.map { .string($0) }),
            ]
            compare(got, c["view"] ?? .null, "#\(i) 取り込み", &fails)
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
