import Foundation

/// 控え（バックアップ）の中身。Web 版 App.jsx の _backupText・parseBackup の写し。
///
/// 前の版で書いた控えも、これからの版で戻せないといけない。形（format 2）と印（app: "kimatteru"）は変えない。
public enum Backup {
    public static let mark = "kimatteru"
    public static let format = 2
    /// 控えは予定 200 件でも数十 KB。桁違いのものは読みに行かない
    public static let maxBytes = 5 * 1024 * 1024

    /// JS の new Date(ms).toISOString()（2026-10-15T01:07:00.000Z）
    public static func isoString(_ ms: Double) -> String {
        let secs = (ms / 1000).rounded(.down)
        let milli = Int(ms - secs * 1000)
        var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "UTC")!
        let c = cal.dateComponents([.year, .month, .day, .hour, .minute, .second], from: Date(timeIntervalSince1970: secs))
        func p(_ n: Int, _ w: Int = 2) -> String { let s = String(n); return String(repeating: "0", count: max(0, w - s.count)) + s }
        return "\(p(c.year!, 4))-\(p(c.month!))-\(p(c.day!))T\(p(c.hour!)):\(p(c.minute!)):\(p(c.second!)).\(p(milli, 3))Z"
    }

    /// 控えの中身（書き出す控えと同じ形）。保存する 11 項目だけを入れる
    public static func object(_ state: [String: JSONValue], appVersion: String, now: Double) -> JSONValue {
        var data: [String: JSONValue] = [:]
        for k in StoreFile.persistedKeys { if let v = state[k] { data[k] = v } }
        return .object(["app": .string(mark), "format": .number(Double(format)), "appVersion": .string(appVersion),
                        "exportedAt": .string(isoString(now)), "data": .object(data)])
    }
    public static func text(_ state: [String: JSONValue], appVersion: String, now: Double, pretty: Bool = false) -> String {
        let enc = JSONEncoder()
        enc.outputFormatting = pretty ? [.sortedKeys, .prettyPrinted, .withoutEscapingSlashes] : [.sortedKeys, .withoutEscapingSlashes]
        let d = (try? enc.encode(object(state, appVersion: appVersion, now: now))) ?? Data()
        return String(decoding: d, as: UTF8.self)
    }

    /// 貼り付けられた・えらばれた控えを確かめる。おかしければ { error } を返す（Web 版と同じ言い方）。
    /// 読めたら { data, count, dropped, at }。予定は数える前にふるいにかける（出す件数と、実際に戻る件数を合わせる）
    public static func parse(_ text: String, makeId: () -> String) -> JSONValue {
        func err(_ s: String) -> JSONValue { .object(["error": .string(s)]) }
        guard let obj = try? JSONDecoder().decode(JSONValue.self, from: Data(text.utf8)) else {
            return err("控えの中身を読めませんでした。全文が貼れているか確かめてください。")
        }
        guard JS.truthy(obj), obj["app"] == .string(mark) else { return err("このアプリの控えではないようです。") }
        // 先の版で書かれた控えは読まない（形が変わっているかもしれず、黙って読むと壊れた予定が並ぶ）
        if Int(JS.toInt32(obj["format"])) > format {
            return err("この控えは新しい版のアプリで作られています。アプリを最新にしてから戻してください。")
        }
        guard let d = obj["data"], JS.truthy(d), case .array(let raw)? = d["events"] else { return err("控えに予定が入っていません。") }
        let events = Loader.sanitizeEvents(.array(raw), makeId: makeId)
        var data: [String: JSONValue] = [:]
        for (k, v) in Loader.spread(d) { data[k] = v }
        data["events"] = .array(events)
        var out: [String: JSONValue] = ["data": .object(data), "count": .number(Double(events.count)), "dropped": .number(Double(raw.count - events.count))]
        if let at = obj["exportedAt"] { out["at"] = at }
        return .object(out)
    }
}

extension Engine {
    /// 控えの中身（いまの状態から）
    public func backupText(appVersion: String, pretty: Bool = false) -> String { Backup.text(state, appVersion: appVersion, now: now, pretty: pretty) }

    /// 貼り付けた控えを確かめて、戻す前の確かめを出す
    public func askRestore() {
        let r = Backup.parse(JS.string(JS.or(state["backupText"], .string(""))), makeId: { self.uid("x") })
        if let e = r["error"] { set(["backupError": e]); return }
        haptic("light")
        set(["backupError": str(""), "confirmRestore": r])
    }

    /// 控えから戻す。戻す直前の状態は、控えとして 1 つ残す
    public func doRestore() {
        guard let r = state["confirmRestore"], JS.truthy(r) else { return }
        haptic("heavy")
        if !events.isEmpty { onBackup("before") }
        let d = r["data"] ?? .null
        // 「足りない予定だけ足す」：置き換えずに混ぜる。同じ予定なら新しいほうを残す
        if JS.truthy(r["merge"]) {
            let incoming = Loader.sanitizeEvents(d["events"], makeId: { self.uid("x") }).compactMap { $0.object }
            // JS の new Map(…)：同じ番号が何度出ても、場所は最初・中身は最後
            var order: [JSONValue?] = [], byId: [Obj] = []
            func put(_ e: Obj) {
                if let i = order.firstIndex(where: { $0 == e["id"] }) { byId[i] = e } else { order.append(e["id"]); byId.append(e) }
            }
            for e in events { put(e) }
            var added = 0
            for e in incoming {
                if let i = order.firstIndex(where: { $0 == e["id"] }) {
                    if JS.number(JS.or(e["updatedAt"], num(0))) > JS.number(JS.or(byId[i]["updatedAt"], num(0))) { byId[i] = e }
                } else { put(e); added += 1 }
            }
            set(["events": eventsArray(byId), "confirmRestore": .null, "pasteOpen": .bool(false), "backupText": str(""), "backupError": str(""), "screen": str("month")])
            toast("\(added)件の予定を足しました")
            return
        }
        var types = state["types"]
        if Loader.typesOk(d["types"]) {
            types = .array(Loader.mergeTypes((d["types"]?.array ?? []).compactMap { $0.object }, typesList).map { .object($0) })
        }
        var st = settings
        for (k, v) in Loader.spread(JS.or(d["settings"], .object([:]))) { st[k] = v }
        set(["events": .array(Loader.sanitizeEvents(d["events"], makeId: { self.uid("x") })),
             "types": types,
             "jobs": .array(Loader.sanitizeJobs(d["jobs"])),
             "supports": .array(Loader.sanitizeSupports(d["supports"])),
             "trash": .array(Loader.sanitizeTrash(d["trash"], now: now)),
             "someday": .array(Loader.sanitizeSomeday(d["someday"])),
             "overrides": JS.or(d["overrides"], .object([:])),
             "notices": JS.or(d["notices"], .array([])),
             "settings": .object(st),
             "lastSeenVersion": JS.or(d["lastSeenVersion"], state["lastSeenVersion"]),
             "confirmRestore": .null, "pasteOpen": .bool(false), "backupText": str(""), "backupError": str(""), "screen": str("month")])
        toast("\(JS.truthy(d["events"]) ? (d["events"]?.array?.count ?? 0) : 0)件の予定を戻しました")
    }
}
