import Foundation
import EventKit
import UIKit
import LukkoKit

/// iPhone のカレンダー（EventKit）。予定とカレンダーは、Web 版が使っていたプラグイン（@ebarooni/capacitor-calendar）と同じ形の JSON にする。
/// そうすれば、読み方・書き方の決まり（PhoneCal）を Web 版と 1 つ残らず同じにできる
final class EventKitCalendar: PhoneCalendar {
    let store = EKEventStore()
    struct Fail: Error {}

    func checkPermission() async throws -> String {
        switch EKEventStore.authorizationStatus(for: .event) {
        case .fullAccess, .authorized: return "granted"
        case .denied, .restricted: return "denied"
        default: return "prompt"
        }
    }
    func requestFullAccess() async throws -> String {
        try await store.requestFullAccessToEvents() ? "granted" : "denied"
    }

    static func hex(_ cg: CGColor?) -> JSONValue {
        guard let cg, let c = cg.components else { return .null }
        if c.count == 2 { let g = lroundf(Float(c[0]) * 255); return .string(String(format: "#%02lX%02lX%02lX", g, g, g)) }
        guard c.count >= 3 else { return .null }
        return .string(String(format: "#%02lX%02lX%02lX", lroundf(Float(c[0]) * 255), lroundf(Float(c[1]) * 255), lroundf(Float(c[2]) * 255)))
    }
    static func ms(_ d: Date?) -> JSONValue { d.map { .number($0.timeIntervalSince1970 * 1000) } ?? .null }

    func listCalendars() async throws -> [JSONValue] {
        store.calendars(for: .event).map { c in
            ["id": .string(c.calendarIdentifier), "title": .string(c.title), "color": Self.hex(c.cgColor), "type": .number(Double(c.type.rawValue)),
             "isSubscribed": .bool(c.isSubscribed), "isImmutable": .bool(c.isImmutable)]
        }
    }
    func listEventsInRange(from: Double, to: Double) async throws -> [JSONValue] {
        let p = store.predicateForEvents(withStart: Date(timeIntervalSince1970: from / 1000), end: Date(timeIntervalSince1970: to / 1000), calendars: nil)
        return store.events(matching: p).map { e in
            let status: String = { switch e.status { case .confirmed: return "confirmed"; case .tentative: return "tentative"; case .canceled: return "canceled"; default: return "none" } }()
            return ["id": e.eventIdentifier.map { .string($0) } ?? .null, "title": e.title.map { .string($0) } ?? .null,
                    "calendarId": e.calendar.map { .string($0.calendarIdentifier) } ?? .null, "location": e.location.map { .string($0) } ?? .null,
                    "startDate": Self.ms(e.startDate), "endDate": Self.ms(e.endDate), "allDay": .bool(e.isAllDay),
                    "url": e.url.map { .string($0.absoluteString) } ?? .null, "description": e.notes.map { .string($0) } ?? .null,
                    "status": .string(status), "lastModifiedDate": Self.ms(e.lastModifiedDate)]
        }
    }
    func fetchAllCalendarSources() async throws -> [JSONValue] {
        store.sources.map { ["id": .string($0.sourceIdentifier), "title": .string($0.title), "type": .number(Double($0.sourceType.rawValue))] }
    }
    func createCalendar(title: String, color: String, sourceId: String?) async throws -> String? {
        let cal = EKCalendar(for: .event, eventStore: store)
        cal.title = title
        cal.cgColor = UIColor(red: 0x6E / 255, green: 0x85 / 255, blue: 0xBE / 255, alpha: 1).cgColor
        cal.source = store.sources.first { $0.sourceIdentifier == sourceId } ?? store.defaultCalendarForNewEvents?.source
        try store.saveCalendar(cal, commit: true)
        return cal.calendarIdentifier
    }
    /// プラグインの createEvent / modifyEvent と同じく、渡された項目だけを書く（url が無ければ消さない）
    private func apply(_ b: [String: JSONValue], to e: EKEvent) {
        if let t = b["title"]?.string { e.title = t }
        if let cid = b["calendarId"]?.string, let cal = store.calendar(withIdentifier: cid) { e.calendar = cal }
        if let l = b["location"]?.string { e.location = l }
        if let s = b["startDate"]?.number { e.startDate = Date(timeIntervalSince1970: s / 1000) }
        if let s = b["endDate"]?.number { e.endDate = Date(timeIntervalSince1970: s / 1000) }
        if let a = b["isAllDay"]?.bool { e.isAllDay = a }
        if let u = b["url"]?.string { e.url = URL(string: u) }
        if let d = b["description"]?.string { e.notes = d }
    }
    func createEvent(_ body: [String: JSONValue]) async throws -> String? {
        let e = EKEvent(eventStore: store)
        apply(body, to: e)
        if e.calendar == nil { e.calendar = store.defaultCalendarForNewEvents }
        try store.save(e, span: .thisEvent, commit: true)
        return e.eventIdentifier
    }
    func modifyEvent(id: String, _ body: [String: JSONValue]) async throws {
        guard let e = store.event(withIdentifier: id) else { throw Fail() }
        apply(body, to: e)
        e.recurrenceRules = []
        try store.save(e, span: .thisEvent, commit: true)
    }
    func deleteEvent(id: String) async throws {
        guard let e = store.event(withIdentifier: id) else { throw Fail() }
        try store.remove(e, span: .thisEvent, commit: true)
    }
}
