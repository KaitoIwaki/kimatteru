import Foundation

/// 保存ファイル（Library/kimatteru-store.json）の中身。いまの Web 版（app/src/store.js の pack）と同じ形。
///
/// 約束：
///  - ファイル名・置き場所・形は Web 版と同じ。SwiftUI 版が書いたものを、元の版に戻しても読める。
///  - 知らない項目も消さない（丸ごと JSONValue で持ち、書くときもそのまま返す）。
public struct StoreFile: Equatable, Sendable {
    /// Web 版の PERSISTED と同じ並び（app/src/store.js）
    public static let persistedKeys = ["events", "types", "overrides", "settings", "notices", "lastSeenVersion", "jobs", "supports", "trash", "someday", "gone"]
    public static let fileName = "kimatteru-store.json"

    /// ファイルの中身を丸ごと（savedAt と、上のキーと、知らないキーも）
    public var raw: [String: JSONValue]

    public init(raw: [String: JSONValue]) { self.raw = raw }

    /// いつ保存したか（ミリ秒。Web 版の Date.now() と同じ）
    public var savedAt: Double { raw["savedAt"]?.number ?? 0 }

    public var events: [JSONValue] { raw["events"]?.array ?? [] }

    public static func decode(_ data: Data) throws -> StoreFile {
        let v = try JSONDecoder().decode(JSONValue.self, from: data)
        guard case .object(let o) = v else { throw StoreError.notAnObject }
        return StoreFile(raw: o)
    }

    public func encode() throws -> Data {
        let enc = JSONEncoder()
        enc.outputFormatting = [.sortedKeys]
        return try enc.encode(JSONValue.object(raw))
    }
}

public enum StoreError: Error, Equatable {
    case notAnObject
}
