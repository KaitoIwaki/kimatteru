import Foundation
import LukkoKit

/// iCloud で 2 台の iPhone の予定をそろえる（Web 版 sync.js と LukkoNative の kvs の写し）。
/// 置き場・鍵の名前・切り方は、いまの版と同じにする。片方の iPhone だけ新しい版になっても、そのままそろう
enum SyncStore {
    static let meta = "lukko.sync.meta"
    static let part = "lukko.sync."
    static let chunk = 60000
    static var store: NSUbiquitousKeyValueStore { .default }

    static func info() -> (available: Bool, signedIn: Bool) {
        let synced = store.synchronize()
        let signedIn = FileManager.default.ubiquityIdentityToken != nil
        return (synced && signedIn, signedIn)
    }

    /// iCloud から読む。無ければ nil
    static func readRemote() -> JSONValue? {
        _ = store.synchronize()
        guard let m = store.string(forKey: meta), let mv = try? JSJSON.parse(m) else { return nil }
        let parts = Int(JS.toInt32(mv["parts"]))
        var text = ""
        for i in 0..<max(0, parts) {
            guard let p = store.string(forKey: part + String(i)) else { return nil }
            text += p
        }
        guard case .object(var data)? = try? JSJSON.parse(text) else { return nil }
        data["at"] = mv["at"] ?? .null
        data["device"] = mv["device"] ?? .null
        return .object(data)
    }

    /// iCloud に書く。小さく切って、最後に目次（meta）を書く
    @discardableResult
    static func writeRemote(_ data: JSONValue, device: String) -> Bool {
        let text = JSJSON.stringify(data)
        let u = Array(text.utf16)
        if u.count > 900_000 { return false }   // 置き場の上限（1MB）に近い。書かない
        var parts: [String] = []
        var i = 0
        while i < u.count {
            var j = min(u.count, i + chunk)
            // 絵文字（サロゲートの組）を切り離さない
            if j < u.count, UTF16.isLeadSurrogate(u[j - 1]) { j -= 1 }
            parts.append(String(decoding: u[i..<j], as: UTF16.self))
            i = j
        }
        for (k, p) in parts.enumerated() { store.set(p, forKey: part + String(k)) }
        for k in parts.count..<(parts.count + 5) { store.removeObject(forKey: part + String(k)) }
        store.set(JSJSON.stringify(["parts": .number(Double(parts.count)), "at": .number((Date().timeIntervalSince1970 * 1000).rounded(.down)), "device": .string(device)]), forKey: meta)
        return store.synchronize()
    }
}

