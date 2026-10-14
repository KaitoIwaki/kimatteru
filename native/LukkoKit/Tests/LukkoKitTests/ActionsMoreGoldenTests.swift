import XCTest
@testable import LukkoKit

/// 予定のほかの操作（勤務先・種類・使い方・シフト入力・取り込み・整理・有給）が、Web 版と 1 つ残らず同じ結果になるか
/// （golden/actions-more.json）。やり方は ActionsGoldenTests と同じ。
final class ActionsMoreGoldenTests: XCTestCase {
    /// 記録の中の番号（Web 版が乱数で作ったもの）を、Swift 版の同じ番号に置き換える
    static func translate(_ v: JSONValue, _ mapW: [String: String], _ mapG: [String: String]) -> JSONValue {
        switch v {
        case .string(let s):
            let ns = s as NSString
            guard let m = ActionsGoldenTests.generated.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) else { return v }
            let sr = m.range(at: 1)
            let suffix = sr.location == NSNotFound ? "" : ns.substring(with: sr)
            let base = String(s.dropLast(suffix.count))
            guard let token = mapW[base], let mine = mapG.first(where: { $0.value == token })?.key else { return v }
            return .string(mine + suffix)
        case .array(let a): return .array(a.map { translate($0, mapW, mapG) })
        case .object(let o): return .object(o.mapValues { translate($0, mapW, mapG) })
        default: return v
        }
    }

    func testMoreActions() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/actions-more", withExtension: "json"))
        let file = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
        let keys = (file["keys"]?.array ?? []).compactMap { $0.string }
        let scenarios = try XCTUnwrap(file["scenarios"]?.array)
        var fails = 0, steps = 0
        for (si, sc) in scenarios.enumerated() {
            let eng = Engine(state: sc["init"]?.object ?? [:], now: sc["now0"]?.number ?? 0, timeZone: TimeZone(identifier: "Asia/Tokyo")!)
            var mapW: [String: String] = [:], mapG: [String: String] = [:]
            var backups = 0
            eng.onBackup = { _ in backups += 1 }
            for (ti, st) in (sc["steps"]?.array ?? []).enumerated() {
                steps += 1
                eng.advance(st["gap"]?.number ?? 0)
                var op: [String: JSONValue] = [:]
                for (k, x) in st["op"]?.object ?? [:] { op[k] = Self.translate(x, mapW, mapG) }
                let call = op["call"]?.string ?? ""
                func ev(_ id: JSONValue?) -> [String: JSONValue]? { (eng.state["events"]?.array ?? []).compactMap { $0.object }.first { $0["id"] == id } }
                func i(_ k: String) -> Int { op[k]?.int ?? 0 }
                var out: JSONValue? = nil
                switch call {
                case "set":
                    var p: [String: JSONValue?] = [:]
                    for (k, v) in op["patch"]?.object ?? [:] { p[k] = v }
                    eng.set(p)
                case "openNew": eng.openNew(i("day"), op["ret"])
                case "saveDraft": eng.set(["draft": op["draft"]]); eng.save()
                case "addJob": eng.addJob()
                case "patchJob": eng.patchJob(op["id"], op["patch"]?.object ?? [:])
                case "recountJob": eng.recountJob(op["id"])
                case "retireJob": eng.retireJob(op["id"], op["on"] == .bool(true))
                case "removeJob": eng.removeJob(op["id"])
                case "pickJob": eng.pickJob(op["id"])
                case "clearJob": eng.clearJob()
                case "startNewJob": eng.startNewJob()
                case "cancelNewJob": eng.cancelNewJob()
                case "commitNewJob": eng.commitNewJob()
                case "toggleExtraDay": eng.toggleExtraDay(i("y"), i("m"), i("d"))
                case "selectType": eng.selectType(op["key"])
                case "addType": eng.addType()
                case "toggleStamp": eng.toggleStamp()
                case "stampDay": eng.stampDay(i("Y"), i("M"), i("d"))
                case "undoLast": eng.undoLast()
                case "confirmMonthShifts": eng.confirmMonthShifts()
                case "setProfile": eng.setProfile(op["key"]?.string ?? "", op["retire"] == .bool(true))
                case "moveType": eng.moveType(op["key"], i("dir"))
                case "toggleTypeHidden": eng.toggleTypeHidden(op["key"])
                case "deleteType": eng.deleteType(op["key"], op["to"])
                case "setTypeWords": eng.setTypeWords(op["key"], op["which"]?.string ?? "", op["val"])
                case "recolorKey": eng.recolorKey(op["key"], op["hex"]?.string ?? "")
                case "renameType": eng.renameType(op["key"], op["name"])
                case "cycleMark": eng.cycleMark(op["day"]?.string ?? "", op["auto"]?.string ?? "")
                case "setPrior": eng.setPrior(i("y"), op["n"])
                case "setSetting": eng.setSetting(op["k"]?.string ?? "", op["val"])
                case "onboardPick": eng.onboardPick(op["key"])
                case "finishOnboard": eng.finishOnboard(op["goImport"] == .bool(true))
                case "doImport": eng.doImport()
                case "undoImport": eng.undoImport()
                case "openTidy": eng.openTidy()
                case "toggleImportRow": eng.toggleImportRow(op["key"])
                case "setAllImport": eng.setAllImport(op["on"] == .bool(true))
                case "setAllImportType": eng.setAllImportType(op["type"])
                case "setImportRowType": eng.setImportRowType(op["key"], op["type"])
                case "tidySkip": eng.tidySkip()
                case "tidyDelete": eng.tidyDelete()
                case "openCopy":
                    guard let e = ev(op["id"]) else { XCTFail("#\(si).\(ti) 写す予定が無い"); continue }
                    eng.openCopy(e, op["ret"])
                case "leaveSummary": out = eng.leaveSummary() ?? .null
                case "pruneTrash": eng.pruneTrash()
                default: XCTFail("知らない操作 \(call)")
                }
                if call == "leaveSummary", out != (st["out"] ?? .null) {
                    fails += 1
                    if fails <= 15 { XCTFail("#\(si).\(ti) 有給のまとめ：\n\(String(describing: out))\n≠\n\(String(describing: st["out"]))") }
                }
                var o: [String: JSONValue] = [:]
                for k in keys { if let v = eng.state[k] { o[k] = v } }
                let got = ActionsGoldenTests.normalize(.object(o), &mapG)
                let want = ActionsGoldenTests.normalize(st["state"] ?? .null, &mapW)
                if got != want {
                    fails += 1
                    if fails <= 15 {
                        let go = got.object ?? [:], wo = want.object ?? [:]
                        let diff = keys.filter { go[$0] != wo[$0] }
                        XCTFail("#\(si).\(ti) \(call) のあと、違う項目 \(diff)：\n" + diff.map { "\($0)：\(String(describing: go[$0]))\n   ≠ \(String(describing: wo[$0]))" }.joined(separator: "\n"))
                    }
                    break
                }
            }
            _ = backups
        }
        XCTAssertGreaterThan(steps, 1000)
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
