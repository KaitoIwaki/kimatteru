import XCTest
@testable import LukkoKit

/// 予定を変える操作が、Web 版と 1 つ残らず同じ結果になるか（golden/actions-events.json）。
/// はじめの状態から、記録した操作を同じ順に・同じ時刻に行い、そのたびの状態を比べる。
/// 乱数で作る番号（uid）は、出てきた順に名前を付け直してから比べる。
final class ActionsGoldenTests: XCTestCase {
    static let generated = try! NSRegularExpression(pattern: "^[a-z][0-9a-z]{12,}(-[0-9]+)?$")
    static func normalize(_ v: JSONValue, _ map: inout [String: String]) -> JSONValue {
        switch v {
        case .string(let s):
            let ns = s as NSString
            guard let m = generated.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) else { return v }
            let suffixRange = m.range(at: 1)
            let suffix = suffixRange.location == NSNotFound ? "" : ns.substring(with: suffixRange)
            let base = String(s.dropLast(suffix.count))
            if map[base] == nil { map[base] = "ID\(map.count + 1)" }
            return .string(map[base]! + suffix)
        case .array(let a): return .array(a.map { normalize($0, &map) })
        case .object(let o):
            var out: [String: JSONValue] = [:]
            for k in o.keys.sorted() { out[k] = normalize(o[k]!, &map) }
            return .object(out)
        default: return v
        }
    }
    static let keys = ["events", "types", "overrides", "settings", "notices", "jobs", "supports", "trash", "someday", "gone",
                       "screen", "returnTo", "detailId", "dayNum", "ym", "today", "dialog", "confirmDelete", "deleteRest", "candAsk", "undo", "repEditAsk", "shareMsg", "shareToast", "draft"]
    static func snap(_ e: Engine) -> JSONValue {
        var o: [String: JSONValue] = [:]
        for k in keys { if let v = e.state[k] { o[k] = v } }
        return .object(o)
    }

    func testEventActions() throws {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/actions-events", withExtension: "json"))
        let scenarios = try XCTUnwrap(JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url)).array)
        var fails = 0
        for (si, sc) in scenarios.enumerated() {
            let eng = Engine(state: sc["init"]?.object ?? [:], now: sc["now0"]?.number ?? 0, timeZone: TimeZone(identifier: "Asia/Tokyo")!)
            var mapW: [String: String] = [:], mapG: [String: String] = [:]
            for (ti, st) in (sc["steps"]?.array ?? []).enumerated() {
                let op = st["op"]?.object ?? [:]
                eng.advance(op.isEmpty ? 0 : (st["gap"]?.number ?? 0))
                let call = op["call"]?.string ?? ""
                // 記録の中の番号（Web 版が乱数で作ったもの）を、Swift 版の同じ番号に置き換える。
                // どちらも、出てきた順に付けた名前（ID1, ID2…）が同じものどうしが対応する
                func tr(_ v: JSONValue?) -> JSONValue? {
                    guard let v else { return nil }
                    switch v {
                    case .string(let s):
                        let ns = s as NSString
                        guard let m = Self.generated.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) else { return v }
                        let sr = m.range(at: 1)
                        let suffix = sr.location == NSNotFound ? "" : ns.substring(with: sr)
                        let base = String(s.dropLast(suffix.count))
                        guard let token = mapW[base], let mine = mapG.first(where: { $0.value == token })?.key else { return v }
                        return .string(mine + suffix)
                    case .array(let a): return .array(a.map { tr($0)! })
                    case .object(let o): var r: [String: JSONValue] = [:]; for (k, x) in o { r[k] = tr(x)! }; return .object(r)
                    default: return v
                    }
                }
                let opRaw = op
                var op = op
                for (k, x) in op { op[k] = tr(x)! }
                func ev(_ id: JSONValue?) -> [String: JSONValue]? { (eng.state["events"]?.array ?? []).compactMap { $0.object }.first { $0["id"] == id } }
                var draftCheck: (JSONValue?, JSONValue?)? = nil
                switch call {
                case "new":
                    eng.openNew(op["day"]!.int!, op["ret"], op["opts"]?.object)
                    draftCheck = (eng.state["draft"], opRaw["draft0"])
                    eng.set(["draft": op["draft"]])
                    eng.save()
                case "edit":
                    guard let e = ev(op["id"]) else { XCTFail("#\(si).\(ti) 直す予定が無い"); continue }
                    eng.openEdit(e, op["ret"])
                    draftCheck = (eng.state["draft"], opRaw["draft0"])
                    eng.set(["draft": op["draft"]])
                    eng.save()
                    if let scope = op["scope"]?.string { eng.save(scope) }
                case "delete":
                    eng.askDelete(op["id"] ?? .null)
                    if op["rest"] == .bool(true) { eng.set(["deleteRest": .bool(true)]) }
                    eng.doDelete()
                    if op["undo"] == .bool(true) { eng.undoLast() }
                case "restoreTrash":
                    eng.restoreTrash(op["ids"]?.array ?? [], op["quiet"] == .bool(true))
                case "dialog":
                    guard let e = ev(op["id"]) else { XCTFail("#\(si).\(ti) 小窓の予定が無い"); continue }
                    eng.openDialog(e, op["mode"]?.string ?? "", op["ret"])
                    if let p = op["patch"]?.array { eng.patchDlg(p[0].string ?? "", p[1].number ?? 0) }
                    if let b = op["brk"], b != .null { var d = eng.state["dialog"]?.object ?? [:]; d["breakMin"] = b; eng.set(["dialog": .object(d)]) }
                    if op["nak"] == .bool(true) { eng.dlgNakunatta() } else { eng.dlgPrimary() }
                    eng.advance(1000)
                    if case .bool(let yes)? = op["settle"] { eng.settleCandidates(yes) }
                    if op["undo"] == .bool(true) { eng.undoLast() }
                case "move":
                    let to = op["to"]?.object ?? [:]
                    eng.moveEvent(op["id"], to: (to["y"]!.int!, to["m"]!.int!, to["d"]!.int!), status: op["status"]?.string ?? "")
                    if op["undo"] == .bool(true) { eng.undoLast() }
                case "toSomeday": eng.toSomeday(op["id"], op["when"]?.string ?? "")
                case "placeSomeday": eng.placeSomeday(op["sid"], op["y"]!.int!, op["m"]!.int!, op["d"]!.int!)
                case "dropSomeday": eng.dropSomeday(op["sid"])
                case "update":
                    var patch: [String: JSONValue?] = [:]
                    for (k, v) in op["patch"]?.object ?? [:] { patch[k] = v }
                    eng.updateEvent(op["id"], patch)
                default: XCTFail("知らない操作 \(call)")
                }
                if let (g, w) = draftCheck {
                    var m1 = mapG, m2 = mapW
                    let gn = Self.normalize(g ?? .null, &m1), wn = Self.normalize(w ?? .null, &m2)
                    if gn != wn { fails += 1; if fails <= 15 { XCTFail("#\(si).\(ti) \(call) の開いたときの下書き：\n\(gn)\n≠\n\(wn)") } }
                }
                let got = Self.normalize(Self.snap(eng), &mapG)
                let want = Self.normalize(st["state"] ?? .null, &mapW)
                if got != want {
                    fails += 1
                    if fails <= 15 {
                        let go = got.object ?? [:], wo = want.object ?? [:]
                        let diff = Self.keys.filter { go[$0] != wo[$0] }
                        XCTFail("#\(si).\(ti) \(call) のあと、違う項目 \(diff)：\n" + diff.map { "\($0)：\(String(describing: go[$0]))\n   ≠ \(String(describing: wo[$0]))" }.joined(separator: "\n"))
                    }
                    break
                }
            }
        }
        XCTAssertEqual(fails, 0, "合わなかった数")
    }
}
