import XCTest
@testable import LukkoKit

/// 予定の詳細と「どうなった？」の小窓が、Web 版と同じ中身を出し、押したときに同じように変わるか（golden/detail.json）
final class DetailGoldenTests: XCTestCase {
    static func detailJSON(_ v: DetailView) -> JSONValue {
        let hist: JSONValue = v.hist.map { ["year": .string($0.year), "month": .string($0.month), "prev": .string($0.prev), "ago": .string($0.ago)] } ?? .null
        return [
            "title": .string(v.title), "typeDark": .string(v.typeDark), "dateText": .string(v.dateText), "holText": .string(v.holText), "movedText": .string(v.movedText),
            "statusLabel": .string(v.statusLabel), "badgeChar": .string(v.badgeChar), "badgeBg": .string(v.badgeBg), "badgeColor": .string(v.badgeColor), "badgeBorder": .string(v.badgeBorder),
            "timeText": .string(v.timeText), "spanText": .string(v.spanText), "remindText": .string(v.remindText), "place": .string(v.place), "placeHref": .string(v.placeHref), "memo": .string(v.memo),
            "memoParts": .array(v.memoParts.map { p in p.href.map { ["t": .string(p.t), "href": .string($0)] } ?? ["t": .string(p.t)] }),
            "link": .string(v.link), "linkLabel": .string(v.linkLabel), "candText": .string(v.candText), "timeChanged": .bool(v.timeChanged), "wantText": .string(v.wantText),
            "wageShown": .bool(v.wageShown), "workHours": .string(v.workHours), "wage": .string(v.wage), "breakText": .string(v.breakText),
            "primaryLabel": v.primaryLabel.map { .string($0) } ?? .null, "primaryBg": .string(v.primaryBg), "primaryColor": .string(v.primaryColor), "primaryBorder": .string(v.primaryBorder),
            "menuRows": .array(v.menuRows.map { ["label": .string($0.label), "red": .bool($0.red)] }),
            "othersLabel": .string(v.othersLabel), "othersRest": .number(Double(v.othersRest)),
            "others": .array(v.others.map { ["title": .string($0.title), "when": .string($0.when), "pill": .object($0.pill)] }),
            "histLabel": .string(v.histLabel), "hist": hist,
        ]
    }
    static func dialogJSON(_ v: DialogView) -> JSONValue {
        [
            "heading": .string(v.heading), "goneLabel": .string(v.goneLabel), "maybeLabel": .string(v.maybeLabel), "sub": .string(v.sub), "start": .string(v.start), "end": .string(v.end),
            "changed": .bool(v.changed), "origText": .string(v.origText), "primaryLabel": .string(v.primaryLabel), "primaryBg": .string(v.primaryBg),
            "paidText": .string(v.paidText), "breakChips": .array(v.breakChips.map { .bool($0.sel) }),
            "moveShown": .bool(v.moveShown), "moving": .bool(v.moving), "moveLabel": .string(v.moveLabel), "moveTitle": .string(v.moveTitle), "moveChosenText": .string(v.moveChosenText),
            "moveCells": .array(v.moveCells.map { c in c.day == nil ? .null : ["day": .number(Double(c.day!)), "color": .string(c.color), "bg": .string(c.bg), "weight": .number(Double(c.weight)), "orig": .bool(c.orig)] }),
            "editLabel": .string(v.editLabel),
        ]
    }

    func testDetail() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/detail", withExtension: "json"))
        let cases = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        let keys = ["events", "screen", "returnTo", "detailId", "detailMenu", "dialog", "draft", "confirmDelete", "undo", "shareMsg", "shareToast", "someday", "ym", "candAsk", "settings", "trash", "today"]
        var fails = 0
        func fail(_ s: @autoclosure () -> String) { fails += 1; if fails <= 15 { XCTFail(s()) } }
        for (ci, c) in cases.enumerated() {
            let eng = Engine(state: c["init"]?.object ?? [:], now: c["now"]?.number ?? 0, timeZone: TimeZone(identifier: "Asia/Tokyo")!)
            var mapG: [String: String] = [:], mapW: [String: String] = [:]
            for (si, st) in (c["steps"]?.array ?? []).enumerated() {
                let out = st["out"] ?? .null
                if let want = out["detail"], want != .null {
                    let got = Self.detailJSON(eng.detailView())
                    if got != want {
                        let go = got.object ?? [:], wo = want.object ?? [:]
                        let diff = Set(go.keys).union(wo.keys).filter { go[$0] != wo[$0] }.sorted()
                        fail("#\(ci).\(si) 詳細が違う \(diff)：\n" + diff.map { "\($0)：\(String(describing: go[$0]))\n   ≠ \(String(describing: wo[$0]))" }.joined(separator: "\n"))
                        break
                    }
                }
                if let want = out["dialog"], want != .null {
                    let got = Self.dialogJSON(eng.dialogView())
                    if got != want {
                        let go = got.object ?? [:], wo = want.object ?? [:]
                        let diff = Set(go.keys).union(wo.keys).filter { go[$0] != wo[$0] }.sorted()
                        fail("#\(ci).\(si) 小窓が違う \(diff)：\n" + diff.map { "\($0)：\(String(describing: go[$0]))\n   ≠ \(String(describing: wo[$0]))" }.joined(separator: "\n"))
                        break
                    }
                }
                let op = st["op"] ?? .null
                func s(_ k: String) -> String { op[k]?.string ?? "" }
                func i(_ k: String) -> Int { op[k]?.int ?? 0 }
                switch s("h") {
                case "dlgRow": eng.dlgTapRow(s("f"))
                case "dlgWheel": eng.dlgSetWheel(s("f"), unit: s("u"), index: i("idx"))
                case "break": eng.dlgSetBreak(i("val"))
                case "startMove": eng.dlgStartMove()
                case "shiftMove": eng.dlgShiftMove(i("n"))
                case "moveDay": eng.dlgPickMoveDay(i("d"))
                case "moveTo": eng.dlgMoveTo(s("st"))
                case "moveSomeday": eng.dlgMoveSomeday()
                case "moveBack": eng.dlgMoveBack()
                case "primary": eng.dlgPrimary(); eng.flushTimersNow()
                case "nakunatta": eng.dlgNakunatta()
                case "dismiss": eng.dlgDismiss()
                case "dlgEdit": eng.dlgEdit()
                case "menu": eng.runDetailMenu(s("key"))
                case "primaryDetail": eng.runDetailPrimary(s("a"))
                case "back": eng.detailBack()
                case "other":
                    if let ev = eng.detailEvent() {
                        let o = EventCtx.othersOnDay((eng.state["events"]?.array ?? []).compactMap { $0.object }, ev, limit: 3).list
                        if i("i") < o.count { eng.openFor(o[i("i")], eng.state["returnTo"]) }
                    }
                default: XCTFail("知らない操作 \(op)")
                }
                var o: [String: JSONValue] = [:]
                for k in keys { if let v = eng.state[k] { o[k] = v } }
                let g = ActionsGoldenTests.normalize(.object(o), &mapG), w = ActionsGoldenTests.normalize(st["state"] ?? .null, &mapW)
                if g != w {
                    let go = g.object ?? [:], wo = w.object ?? [:]
                    let diff = keys.filter { go[$0] != wo[$0] }
                    fail("#\(ci).\(si) \(op) のあと、違う項目 \(diff)：\n" + diff.map { "\($0)：\(String(describing: go[$0]))\n   ≠ \(String(describing: wo[$0]))" }.joined(separator: "\n"))
                    break
                }
            }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
