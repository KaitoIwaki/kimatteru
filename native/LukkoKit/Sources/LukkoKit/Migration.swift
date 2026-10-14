import Foundation

/// いまの版（Web）から SwiftUI 版への、予定の引っ越し。
///
/// 約束（docs/swiftui-rewrite.md）：
///  1. 元のデータ（保存ファイル・localStorage・控え・iCloud）は消さない・上書きしない。
///     ただし保存ファイルだけは、より新しい localStorage の中身があればそれで書き換える
///     （Web 版の起動時と同じ決まり。書き換える前の丸ごとの写しを必ず別に残す）。
///  2. どれを使うかは、Web 版の起動と同じ決まりで決める（decide を見る）。
///  3. 書いたあと読み返して、選んだ中身と完全に一致するか確かめる。合わなければ引っ越しを終わりにしない。
///  4. 何度やり直しても安全（いつも「いちばん新しいもの」を選ぶので、2回目以降に古いもので上書きしない）。
public enum Migration {
    /// 候補のひとつ
    public struct Candidate: Equatable {
        public enum Source: String, Equatable { case file, localStorage }
        public let source: Source
        public let store: StoreFile
        public var savedAt: Double { store.savedAt }
        public var eventCount: Int { store.events.count }
    }

    /// 読めなかった理由（引っ越しの記録に残す。利用者には見せない）
    public enum Problem: Error, Equatable {
        case missing(Candidate.Source)
        case unreadable(Candidate.Source, String)
    }

    public struct Decision: Equatable {
        /// 使う中身（どれも無ければ nil ＝ はじめて使う人）
        public let chosen: Candidate?
        /// 保存ファイルを書き換える必要があるか（localStorage のほうが新しいとき）
        public let mustWriteFile: Bool
        public let problems: [Problem]
    }

    /// 文字（JSON）から候補を作る。オブジェクトでない・events が配列でない、は読めない扱い
    public static func parse(_ data: Data?, source: Candidate.Source) -> Result<Candidate, Problem> {
        guard let data, !data.isEmpty else { return .failure(.missing(source)) }
        do {
            let s = try StoreFile.decode(data)
            if let ev = s.raw["events"] {
                guard case .array = ev else { return .failure(.unreadable(source, "events が配列でない")) }
            }
            return .success(Candidate(source: source, store: s))
        } catch {
            return .failure(.unreadable(source, "JSON として読めない"))
        }
    }

    /// どれを使うか決める。Web 版の起動（constructor の readLocal）と _checkFile と同じ決まり：
    ///  - localStorage が読めれば、それを使う。
    ///    ただし保存ファイルに予定が 1 件以上あり、ファイルのほうが新しく（savedAt）、
    ///    予定・勤務先・種類のどれかが違えば、ファイルを使う。
    ///  - localStorage が無ければ、予定が 1 件以上あるファイルを使う。
    ///  - どちらも無ければ nil（はじめて使う人）。
    public static func decide(file: Data?, localStorage: Data?) -> Decision {
        var problems: [Problem] = []
        var f: Candidate?, l: Candidate?
        switch parse(file, source: .file) { case .success(let c): f = c; case .failure(let p): problems.append(p) }
        switch parse(localStorage, source: .localStorage) { case .success(let c): l = c; case .failure(let p): problems.append(p) }
        let fileOk = f.map { ($0.store.raw["events"]?.array?.count ?? 0) > 0 } ?? false
        func pick(_ c: Candidate) -> [JSONValue] {
            ["events", "jobs", "types"].map { JS.or(c.store.raw[$0], .array([])) ?? .array([]) }
        }
        if let l {
            if let f, fileOk, f.savedAt > l.savedAt, pick(f) != pick(l) {
                return Decision(chosen: f, mustWriteFile: false, problems: problems)
            }
            return Decision(chosen: l, mustWriteFile: true, problems: problems)
        }
        if let f, fileOk { return Decision(chosen: f, mustWriteFile: false, problems: problems) }
        return Decision(chosen: nil, mustWriteFile: false, problems: problems)
    }
}

/// ファイルを安全に書く：一時ファイルに書いて読み返し、中身が同じと確かめてから入れ替える。
/// 途中でアプリが落ちても、元のファイルか新しいファイルのどちらかが必ず丸ごと残る。
public enum SafeFile {
    public enum Failure: Error, Equatable { case verifyFailed, writeFailed(String) }

    public static func write(_ data: Data, to url: URL) throws {
        let fm = FileManager.default
        try fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let tmp = url.deletingLastPathComponent().appendingPathComponent("." + url.lastPathComponent + ".tmp-" + UUID().uuidString)
        do { try data.write(to: tmp, options: [.atomic]) } catch { throw Failure.writeFailed("\(error)") }
        guard let back = try? Data(contentsOf: tmp), back == data else { try? fm.removeItem(at: tmp); throw Failure.verifyFailed }
        if fm.fileExists(atPath: url.path) {
            _ = try fm.replaceItemAt(url, withItemAt: tmp)
        } else {
            try fm.moveItem(at: tmp, to: url)
        }
        guard let final = try? Data(contentsOf: url), final == data else { throw Failure.verifyFailed }
    }

    /// 写しを残す（同じ名前があれば番号を足す。決して上書きしない）
    @discardableResult
    public static func keepCopy(_ data: Data, in dir: URL, name: String) throws -> URL {
        let fm = FileManager.default
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)
        var url = dir.appendingPathComponent(name)
        var n = 2
        while fm.fileExists(atPath: url.path) {
            url = dir.appendingPathComponent((name as NSString).deletingPathExtension + "-\(n)." + (name as NSString).pathExtension)
            n += 1
        }
        try data.write(to: url, options: [.atomic])
        return url
    }
}
