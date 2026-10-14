import Foundation
import Observation
import LukkoKit

/// アプリの中身（予定・種類・設定…）と、その保存。
///
/// 保存先は、いまの版と同じ Library/kimatteru-store.json・同じ形（docs/swiftui-rewrite.md）。
/// はじめて SwiftUI 版が開いたときに、いまの版から引っ越す（Migration）。
@MainActor @Observable
final class AppData {
    /// 保存する 11 項目（StoreFile.persistedKeys）
    private(set) var state: [String: JSONValue] = [:]
    private(set) var loaded = false
    /// 引っ越しの記録（試験と、困ったときの診断で見る。利用者には出さない）
    private(set) var migrationLog: [String] = []
    private(set) var chosenSource = "none"

    static let migratedKey = "lukko.native.migrated"
    let library: URL
    var fileURL: URL { library.appendingPathComponent(StoreFile.fileName) }
    var migrationDir: URL { library.appendingPathComponent("LUKKO-migration") }

    init(library: URL? = nil) {
        self.library = library ?? FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
    }

    var events: [JSONValue] { state["events"]?.array ?? [] }

    private func now() -> Double { (Date().timeIntervalSince1970 * 1000).rounded(.down) }
    private func log(_ s: String) { migrationLog.append(s) }

    /// 起動したとき。引っ越しがまだなら引っ越す
    func start() async {
        let fileData = try? Data(contentsOf: fileURL)
        let migrated = UserDefaults.standard.bool(forKey: Self.migratedKey)
        var fileValid = false
        if case .success = Migration.parse(fileData, source: .file) { fileValid = true }

        if migrated && fileValid, case .success(let c) = Migration.parse(fileData, source: .file) {
            // 引っ越し後は、保存ファイルがいつも正しい（予定が 0 件でも、設定などはそのまま使う）
            adopt(c)
            log("引っ越し済み：保存ファイルから開いた")
            loaded = true
            return
        }

        // 引っ越し（初回。または、引っ越し済みなのに保存ファイルが読めないとき）
        log(migrated ? "引っ越し済みだが保存ファイルが読めない：もう一度引っ越す" : "はじめての起動：引っ越す")
        let keys = ["kimatteru.v2", "lukko.exportMap", "lukko.backups", "lukko.lastError"]
        let ls = await LocalStorageReader.read(keys: keys)
        log(ls == nil ? "localStorage を読めなかった（次の起動でもう一度）" : "localStorage を読んだ：" + keys.map { "\($0)=\(ls?[$0]?.count ?? 0)字" }.joined(separator: " "))

        // 1. 元のものを、手を付ける前に丸ごと写して残す（決して上書きしない）
        let stamp = Self.stamp(Date())
        let dir = migrationDir.appendingPathComponent(stamp)
        do {
            if let fileData { try SafeFile.keepCopy(fileData, in: dir, name: "kimatteru-store.json") }
            for k in keys { if let v = ls?[k] { try SafeFile.keepCopy(Data(v.utf8), in: dir, name: "localStorage-\(k).json") } }
            log("元の写しを残した：\(dir.lastPathComponent)")
        } catch {
            // 写しを残せないなら、何も書き換えない（読むだけで開く）
            log("写しを残せなかった：\(error)。書き換えずに開く")
            let d = Migration.decide(file: fileData, localStorage: ls?["kimatteru.v2"].map { Data($0.utf8) })
            adopt(d.chosen)
            loaded = true
            return
        }

        // 2. どれを使うか決める（いまの版の起動と同じ決まり）
        let d = Migration.decide(file: fileData, localStorage: ls?["kimatteru.v2"].map { Data($0.utf8) })
        for p in d.problems { log("読めなかったもの：\(p)") }
        adopt(d.chosen)
        log("使う中身：\(chosenSource)（予定 \(events.count) 件）")

        // 3. localStorage のほうを使うなら、保存ファイルに書いて、読み返して確かめる
        if d.mustWriteFile {
            do {
                try save()
                let back = try StoreFile.decode(Data(contentsOf: fileURL))
                let ok = StoreFile.persistedKeys.allSatisfy { back.raw[$0] == state[$0] }
                log(ok ? "保存ファイルに書いて、読み返して一致した" : "読み返したら一致しない")
                guard ok else { loaded = true; return }
            } catch {
                log("保存ファイルに書けなかった：\(error)")
                loaded = true
                return
            }
        }
        // 4. 印を付ける（localStorage を読めたときだけ。読めなかったら、次の起動でもう一度）
        if ls != nil {
            UserDefaults.standard.set(true, forKey: Self.migratedKey)
            log("引っ越しを終えた")
        }
        loaded = true
    }

    private func adopt(_ c: Migration.Candidate?) {
        chosenSource = c?.source.rawValue ?? "none"
        state = Loader.load(c?.store.raw, now: now()) { Loader.uid("x", now: self.now()) }
    }

    /// いまの中身を保存ファイルに書く（いまの版の pack と同じ：savedAt と 11 項目）
    func save() throws {
        var raw: [String: JSONValue] = ["savedAt": .number(now())]
        for k in StoreFile.persistedKeys { raw[k] = state[k] ?? .null }
        try SafeFile.write(try StoreFile(raw: raw).encode(), to: fileURL)
    }

    static func stamp(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyyMMdd-HHmmss"
        return f.string(from: d)
    }

    // MARK: 試験のためだけ（GitHub の Mac の試験から、起動の引数で使う）
    func resetForTest() {
        try? FileManager.default.removeItem(at: fileURL)
        try? FileManager.default.removeItem(at: migrationDir)
        UserDefaults.standard.removeObject(forKey: Self.migratedKey)
    }
}
