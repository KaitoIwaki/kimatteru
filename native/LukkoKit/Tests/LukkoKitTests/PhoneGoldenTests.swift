import XCTest
@testable import LukkoKit

/// 試験用の iPhone のカレンダー。呼ばれた順番を、Web 版の正解表と同じ形で記録する
final class FakeCalendar: PhoneCalendar {
    struct Fail: Error {}
    var log: [JSONValue] = []
    let opt: JSONValue
    var cals: [JSONValue], events: [JSONValue]
    var n = 0
    init(_ opt: JSONValue, cals: [JSONValue] = [], events: [JSONValue] = []) { self.opt = opt; self.cals = cals; self.events = events }
    func has(_ k: String, _ v: JSONValue) -> Bool { (opt[k]?.array ?? []).contains(v) }
    func checkPermission() async throws -> String { log.append(["checkPermission"]); return opt["perm"]?.string ?? "" }
    func requestFullAccess() async throws -> String { log.append(["requestFullCalendarAccess"]); return opt["ask"]?.string ?? "" }
    func listCalendars() async throws -> [JSONValue] { log.append(["listCalendars"]); if opt["calsThrow"] == .bool(true) { throw Fail() }; return cals }
    func listEventsInRange(from: Double, to: Double) async throws -> [JSONValue] {
        log.append(.array([.string("listEventsInRange"), .number(from), .number(to)]))
        if opt["evThrow"] == .bool(true) { throw Fail() }
        return events
    }
    func fetchAllCalendarSources() async throws -> [JSONValue] {
        log.append(["fetchAllCalendarSources"]); if opt["srcThrow"] == .bool(true) { throw Fail() }; return opt["sources"]?.array ?? []
    }
    func createCalendar(title: String, color: String, sourceId: String?) async throws -> String? {
        var a: [String: JSONValue] = ["title": .string(title), "color": .string(color)]
        if let sourceId { a["sourceId"] = .string(sourceId) }
        log.append(.array([.string("createCalendar"), .object(a)]))
        return JS.truthy(opt["madeId"]) ? opt["madeId"]?.string : nil
    }
    func createEvent(_ body: [String: JSONValue]) async throws -> String? {
        var b = body; b["commit"] = .bool(true)
        log.append(.array([.string("createEvent"), .object(b)]))
        n += 1
        if has("createFails", .number(Double(n))) { throw Fail() }
        return opt["noId"] == .bool(true) ? nil : "N\(n)"
    }
    func modifyEvent(id: String, _ body: [String: JSONValue]) async throws {
        var b = body; b["id"] = .string(id)
        log.append(.array([.string("modifyEvent"), .object(b)]))
        if has("modifyFails", .string(id)) { throw Fail() }
    }
    func deleteEvent(id: String) async throws {
        log.append(.array([.string("deleteEvent"), .string(id)]))
        if has("deleteFails", .string(id)) { throw Fail() }
    }
}

/// iPhone のカレンダーとのやりとりと、ベルのお知らせが、Web 版と 1 つ残らず同じか（golden/phone.json）
final class PhoneGoldenTests: XCTestCase {
    let tz = TimeZone(identifier: "Asia/Tokyo")!
    var fails = 0
    func check(_ got: JSONValue?, _ want: JSONValue?, _ what: @autoclosure () -> String) {
        if (got ?? .null) != (want ?? .null) { fails += 1; if fails <= 20 { XCTFail("\(what())：\n\(String(describing: got))\n≠\n\(String(describing: want))") } }
    }
    func load() throws -> JSONValue {
        let url = try XCTUnwrap(Bundle.module.url(forResource: "Fixtures/golden/phone", withExtension: "json"))
        return try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: url))
    }
    static let CALS: [JSONValue] = [
        ["id": "c1", "title": "仕事", "color": "#FF0000", "type": 1, "isSubscribed": false],
        ["id": "c2", "title": "", "color": .null, "type": 0, "isSubscribed": false],
        ["id": "c3", "title": "LUKKO", "color": "#6E85BE", "type": 1, "isSubscribed": false],
        ["id": "sub", "title": "日本の祝日", "color": "#00FF00", "type": 3, "isSubscribed": true],
        ["id": "bday", "title": "誕生日", "color": "#0000FF", "type": 4, "isSubscribed": false],
        ["id": "c4", "title": "共有", "color": "#123456", "type": 1, "isSubscribed": true],
    ]

    func testToAppShape() throws {
        let g = try load()
        for (i, c) in (g["toAppShape"]?.array ?? []).enumerated() {
            check(PhoneCal.toAppShape(c["e"] ?? .null, tz).map { .object($0) }, c["shape"], "toAppShape #\(i) \(c["e"] ?? .null)")
        }
        XCTAssertEqual(fails, 0)
    }

    func testReadCalendar() async throws {
        let g = try load()
        for (i, c) in (g["read"]?.array ?? []).enumerated() {
            let fake = FakeCalendar(.object(["calsThrow": c["calsThrow"] ?? .bool(false)]), cals: Self.CALS, events: c["events"]?.array ?? [])
            let o = c["opts"] ?? .object([:])
            let r = try await PhoneCal.readCalendarEvents(fake, monthsBack: o["monthsBack"]?.int ?? 1, monthsAhead: o["monthsAhead"]?.int ?? 12,
                                                          calIds: o["calIds"]?.array.map { $0.compactMap { $0.string } }, fromDate: o["fromDate"]?.number,
                                                          now: c["now"]?.number ?? 0, tz: tz)
            check(.array(fake.log), c["log"], "read #\(i) 呼んだ順")
            check(.array(r), c["result"], "read #\(i)")
        }
        for (i, c) in (g["overlay"]?.array ?? []).enumerated() {
            let fake = FakeCalendar(.object(["evThrow": c["evThrow"] ?? .bool(false)]), cals: Self.CALS, events: c["events"]?.array ?? [])
            let r = await PhoneCal.readOverlay(fake, ids: c["ids"]?.array, from: c["from"]?.number ?? 0, to: c["to"]?.number ?? 0, tz: tz)
            check(.array(fake.log), c["log"], "overlay #\(i) 呼んだ順")
            check(.array(r), c["result"], "overlay #\(i)")
        }
        for (i, c) in (g["ensure"]?.array ?? []).enumerated() {
            let opt = c["opt"] ?? .null
            let fake = FakeCalendar(opt, cals: opt["cals"]?.array ?? [])
            let r = await PhoneCal.ensureExportCalendar(fake, knownId: c["known"])
            check(.array(fake.log), c["log"], "ensure #\(i) 呼んだ順")
            check(r.map { .string($0) }, c["result"], "ensure #\(i)")
        }
        XCTAssertEqual(fails, 0)
    }

    /// 呼んだ順を比べる。はじめに続けて消すもの（map の鍵の順に消す）は、順番を問わない
    func normLog(_ v: JSONValue?) -> JSONValue {
        let a = v?.array ?? []
        let head = a.prefix { $0.array?.first == .string("deleteEvent") }
        let sortedHead = head.sorted { JS.string($0.array?[1]) < JS.string($1.array?[1]) }
        return .array(sortedHead + a.dropFirst(head.count))
    }

    func testExportSync() async throws {
        let g = try load()
        for (i, rounds) in (g["exportSync"]?.array ?? []).enumerated() {
            for (ri, r) in (rounds.array ?? []).enumerated() {
                let fake = FakeCalendar(r["opt"] ?? .null)
                let out = await PhoneCal.syncExport(fake, events: r["events"]?.array ?? [], calId: r["calId"]?.string, map: r["map"]?.object ?? [:],
                                                    hideAll: r["hideAll"] == .bool(true), tz: tz)
                check(normLog(.array(fake.log)), normLog(r["log"]), "export #\(i).\(ri) 呼んだ順")
                check(.object(out.object), r["result"], "export #\(i).\(ri) map")
            }
        }
        XCTAssertEqual(fails, 0)
    }

    func testImportFlow() async throws {
        let g = try load()
        let keys = ["events", "types", "settings", "screen", "imp", "today"]
        func snap(_ e: Engine) -> JSONValue { var o: [String: JSONValue] = [:]; for k in keys { if let v = e.state[k] { o[k] = v } }; return .object(o) }
        for (i, c) in (g["runRead"]?.array ?? []).enumerated() {
            let fake = FakeCalendar(.object(["perm": c["perm"] ?? .null, "ask": c["ask"] ?? .null, "calsThrow": c["calsThrow"] ?? .bool(false)]),
                                    cals: Self.CALS, events: c["phone"]?.array ?? [])
            let eng = Engine(state: c["init"]?.object ?? [:], now: c["now"]?.number ?? 0, timeZone: tz)
            eng.phone = fake
            for (si, st) in (c["steps"]?.array ?? []).enumerated() {
                switch st["call"]?.string {
                case "runScan": await eng.runScan()
                case "set": eng.set(["imp": st["imp"]])
                case "runRead": await eng.runRead(nil)
                default: XCTFail("知らない操作")
                }
                check(snap(eng), st["state"], "runRead #\(i).\(si) \(st["call"]?.string ?? "")")
            }
            check(.array(fake.log), c["log"], "runRead #\(i) 呼んだ順")
        }
        for (i, c) in (g["runIcs"]?.array ?? []).enumerated() {
            let eng = Engine(state: c["init"]?.object ?? [:], now: c["now"]?.number ?? 0, timeZone: tz)
            eng.runIcs(c["text"]?.string ?? "")
            check(snap(eng), c["state"], "runIcs #\(i)")
        }
        XCTAssertEqual(fails, 0)
    }

    func testNotices() throws {
        let g = try load()
        let nt = g["notices"] ?? .null
        for c in nt["cmp"]?.array ?? [] {
            let a = c.array ?? []
            check(.number(Double(NoticesCore.cmpVersion(a[0], a[1]))), a[2], "cmpVersion \(a[0]) \(a[1])")
        }
        for (i, c) in (nt["shift"]?.array ?? []).enumerated() {
            check(.array(NoticesCore.syncShiftNotices(c["notices"]?.array ?? [], c["events"]?.array ?? [], now: c["now"]?.number ?? 0, tz: tz)), c["out"], "shift #\(i)")
        }
        for (i, c) in (nt["info"]?.array ?? []).enumerated() {
            check(.array(NoticesCore.syncInfoNotices(c["notices"]?.array ?? [], current: c["cur"]?.string ?? "", lastSeen: c["last"], now: c["now"]?.number ?? 0, notes: NoticesCore.webReleaseNotes)), c["out"], "info #\(i)")
        }
        for (i, c) in (nt["current"]?.array ?? []).enumerated() {
            check(NoticesCore.currentNoteText(c["n"]), c["out"], "current #\(i)")
        }
        for c in nt["relative"]?.array ?? [] {
            let a = c.array ?? []
            check(.string(NoticesCore.relativeTime(a[0].number ?? 0, now: a[1].number ?? 0, tz: tz)), a[2], "relative \(a[0])")
        }
        let notes: [JSONValue] = NoticesCore.webReleaseNotes.map { .object(["version": .string($0.version), "title": .string($0.title), "body": .string($0.body)]) }
        check(.array(notes), nt["releaseNotes"], "お知らせの文")
        XCTAssertEqual(fails, 0)
    }
}
