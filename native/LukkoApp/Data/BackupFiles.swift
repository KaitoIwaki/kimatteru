import Foundation
import LukkoKit

/// 端末の中の控え（Web 版 backup.js の写し）。置き場はいまの版と同じ Library/backups なので、
/// いまの版が書いた控えも、そのまま一覧に出て戻せる。
///   ・毎日のぶん（auto-2026-09-28.json）を 7 日、毎月 1 日のぶんを 3 か月
///   ・戻す・取り込む前のぶん（before-2026-09-28-153012.json）を 5 つ
enum BackupFiles {
    struct Item: Equatable { var name: String; var kind: String; var at: Double; var day: String }
    static var dir: URL { FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0].appendingPathComponent("backups") }

    static func pad(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }
    static func stamp(_ d: Date) -> String {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: d)
        return "\(c.year!)-\(pad(c.month!))-\(pad(c.day!))"
    }
    static func nameFor(_ kind: String, _ d: Date) -> String {
        if kind == "auto" { return "auto-\(stamp(d)).json" }
        let c = Calendar(identifier: .gregorian).dateComponents([.hour, .minute, .second], from: d)
        return "\(kind)-\(stamp(d))-\(pad(c.hour!))\(pad(c.minute!))\(pad(c.second!)).json"
    }

    /// 控えを 1 つ書く。書けたら名前
    @discardableResult
    static func write(_ kind: String, _ text: String, now: Date = Date()) -> String? {
        let name = nameFor(kind, now)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            try SafeFile.write(Data(text.utf8), to: dir.appendingPathComponent(name))
            return name
        } catch { return nil }
    }

    static let re = try! NSRegularExpression(pattern: "^(auto|before)-(\\d{4})-(\\d{2})-(\\d{2})(?:-(\\d{2})(\\d{2})(\\d{2})?)?\\.json$")
    static func parse(_ name: String) -> Item? {
        let ns = name as NSString
        guard let m = re.firstMatch(in: name, range: NSRange(location: 0, length: ns.length)) else { return nil }
        func g(_ i: Int) -> Int? { let r = m.range(at: i); return r.location == NSNotFound ? nil : Int(ns.substring(with: r)) }
        let kind = ns.substring(with: m.range(at: 1))
        var c = DateComponents(); c.year = g(2); c.month = g(3); c.day = g(4); c.hour = g(5) ?? 0; c.minute = g(6) ?? 0
        let d = Calendar(identifier: .gregorian).date(from: c) ?? Date(timeIntervalSince1970: 0)
        return Item(name: name, kind: kind, at: d.timeIntervalSince1970 * 1000, day: "\(g(3) ?? 0)月\(g(4) ?? 0)日")
    }
    /// 一覧（新しい順）
    static func list() -> [Item] {
        let names = (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
        return names.compactMap(parse).sorted { $0.at > $1.at }
    }
    static func read(_ name: String) -> String? {
        guard let d = try? Data(contentsOf: dir.appendingPathComponent(name)) else { return nil }
        var s = String(decoding: d, as: UTF8.self)
        if s.hasPrefix("\u{FEFF}") { s.removeFirst() }   // ファイルの頭の BOM は、Web 版（file.text()）と同じく落とす
        return s
    }
    /// 古い控えを消す
    static func prune() {
        let all = list()
        let daily = all.filter { $0.kind == "auto" }
        var keep = Set(daily.prefix(7).map { $0.name })
        for b in daily.filter({ $0.name.hasSuffix("-01.json") }).prefix(3) { keep.insert(b.name) }
        for b in all.filter({ $0.kind == "before" }).prefix(5) { keep.insert(b.name) }
        for b in all where !keep.contains(b.name) { try? FileManager.default.removeItem(at: dir.appendingPathComponent(b.name)) }
    }
    static func hasToday(_ now: Date = Date()) -> Bool { list().contains { $0.name == "auto-\(stamp(now)).json" } }
}
