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
    /// 開いたときに利用者へ知らせること（いまの版の _checkFile と同じ：ファイルから戻した／新しいほうから開いた）
    enum StartNotice: Equatable { case recovered(Int), newer }
    private(set) var startNotice: StartNotice?
    /// 元の写しを残せなかったときは、保存ファイルを書き換えない（読むだけで開く。書こうとすると「保存できていません」を出す）
    private(set) var writeBlocked = false
    /// 保存ファイルがあるのに読めなかった（再起動のあと、まだロックを解いていないときなど）。
    /// このときは何も開かず、何も書かない（空のカレンダーで開いて、本物のファイルを上書きしないように）
    private(set) var unreadable = false

    static let migratedKey = "lukko.native.migrated"
    let library: URL
    var fileURL: URL { library.appendingPathComponent(StoreFile.fileName) }
    var migrationDir: URL { library.appendingPathComponent("LUKKO-migration") }
    /// 「LUKKO」カレンダーに書いた予定の対応表（いまの版は localStorage の lukko.exportMap に持っていた）
    var exportMapURL: URL { library.appendingPathComponent("lukko-exportMap.json") }

    init(library: URL? = nil) {
        self.library = library ?? FileManager.default.urls(for: .libraryDirectory, in: .userDomainMask)[0]
    }

    var events: [JSONValue] { state["events"]?.array ?? [] }

    private func now() -> Double { (Date().timeIntervalSince1970 * 1000).rounded(.down) }
    private func log(_ s: String) { migrationLog.append(s) }

    /// 起動したとき。引っ越しがまだなら引っ越す
    func start() async {
        unreadable = false
        // 「ファイルが無い」と「あるのに読めない」を分ける。読めなければ少し待って読み直す（最大 10 秒）
        var read = StoreRead.read(fileURL)
        for _ in 0..<20 {
            guard case .unreadable = read else { break }
            try? await Task.sleep(nanoseconds: 500_000_000)
            read = StoreRead.read(fileURL)
        }
        if case .unreadable(let why) = read {
            log("保存ファイルがあるのに読めない：\(why)。開かずに待つ")
            unreadable = true
            return
        }
        let fileData: Data? = { if case .data(let d) = read { return d }; return nil }()
        let migrated = UserDefaults.standard.bool(forKey: Self.migratedKey)
        var fileValid = false
        if case .success(let c) = Migration.parse(fileData, source: .file) {
            fileValid = true
            if migrated {
                // 引っ越し後は、保存ファイルがいつも正しい（予定が 0 件でも、設定などはそのまま使う）
                adopt(c.store.raw, source: "file")
                log("引っ越し済み：保存ファイルから開いた")
                loaded = true
                return
            }
        }

        // 引っ越し（初回。または、引っ越し済みなのに保存ファイルが読めないとき）
        log(migrated ? "引っ越し済みだが保存ファイルが読めない：もう一度引っ越す" : "はじめての起動：引っ越す")
        let keys = ["kimatteru.v2", "lukko.exportMap", "lukko.backups", "lukko.lastError"]
        var ls = await LocalStorageReader.read(keys: keys)
        if ls == nil {
            // 読めないまま始めると、空のカレンダーで始まってしまう。もう一度、長めに待って読む
            log("localStorage を 1 回目は読めなかった：もう一度")
            ls = await LocalStorageReader.read(keys: keys, timeout: 15)
        }
        log(ls == nil ? "localStorage を読めなかった（次の起動でもう一度）" : "localStorage を読んだ：" + keys.map { "\($0)=\(ls?[$0]?.count ?? 0)字" }.joined(separator: " "))
        let lsStore = ls?["kimatteru.v2"].map { Data($0.utf8) }

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
            writeBlocked = true
            let d = Migration.decide(file: fileData, localStorage: lsStore)
            adopt(d.chosen?.store.raw, source: d.chosen?.source.rawValue ?? "none")
            loaded = true
            return
        }

        // 2. どれを使うか決める（いまの版の起動と同じ決まり）
        let d = Migration.decide(file: fileData, localStorage: lsStore)
        for p in d.problems { log("読めなかったもの：\(p)") }
        var raw = d.chosen?.store.raw
        var source = d.chosen?.source.rawValue ?? "none"
        var mustWrite = d.mustWriteFile

        // 2b. 使えるものが無い、または引っ越し後に保存ファイルが読めなくなった：
        //     端末の中の控え（毎日の自動の控え）のほうが新しければ、そこから戻す
        if d.chosen == nil || (migrated && !fileValid), let b = newestBackup(), b.at > (d.chosen?.savedAt ?? -1) {
            raw = b.raw
            source = "backup"
            mustWrite = true
            startNotice = .recovered(b.count)
            log("端末の中の控えから戻す：\(b.name)（予定 \(b.count) 件）")
        } else if d.chosen?.source == .file {
            if let lsStore, case .success(let l) = Migration.parse(lsStore, source: .localStorage) {
                // ファイルのほうが新しく中身も違う（いまの版の _checkFile と同じ）。古いほう（localStorage）は、戻せるように控えに残す
                BackupFiles.write("before", Backup.text(l.store.raw, appVersion: AppModel.version, now: now()))
                startNotice = .newer
                log("localStorage のほうを、戻す前の控えに残した")
            } else if ls != nil, (d.chosen?.eventCount ?? 0) > 0 {
                // localStorage が消えていて、ファイルから戻した（いまの版の recovered と同じ）
                startNotice = .recovered(d.chosen?.eventCount ?? 0)
            }
        }
        adopt(raw, source: source)
        log("使う中身：\(chosenSource)（予定 \(events.count) 件）")

        // 3. localStorage（か控え）のほうを使うなら、保存ファイルに書いて、読み返して確かめる
        if mustWrite {
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
        // 3b. 書き出しの対応表も持ってくる。無いと、引っ越した直後に「LUKKO」カレンダーへ同じ予定をもう一度書いてしまう
        if let text = ls?["lukko.exportMap"], !FileManager.default.fileExists(atPath: exportMapURL.path) {
            if let v = try? JSONDecoder().decode(JSONValue.self, from: Data(text.utf8)), case .object = v {
                do { try SafeFile.write(Data(text.utf8), to: exportMapURL); log("書き出しの対応表を持ってきた") }
                catch { log("書き出しの対応表を書けなかった：\(error)"); loaded = true; return }
            } else {
                log("書き出しの対応表が読めない形だった（持ってこない。次の書き出しで作り直す）")
            }
        }
        // 4. 印を付ける（localStorage を読めたときだけ。読めなかったら、次の起動でもう一度）
        if ls != nil {
            UserDefaults.standard.set(true, forKey: Self.migratedKey)
            log("引っ越しを終えた")
        }
        loaded = true
    }

    /// 端末の中の控え（Library/backups）のうち、予定が入っていていちばん新しいもの
    private func newestBackup() -> (name: String, at: Double, count: Int, raw: [String: JSONValue])? {
        for item in BackupFiles.list() {
            guard let text = BackupFiles.read(item.name) else { continue }
            let p = Backup.parse(text, makeId: { Loader.uid("x", now: self.now()) })
            guard case .object(var data)? = p["data"], JS.int(p["count"]) > 0 else { continue }
            data["savedAt"] = .number(item.at)
            return (item.name, item.at, JS.int(p["count"]), data)
        }
        return nil
    }

    private func adopt(_ raw: [String: JSONValue]?, source: String) {
        chosenSource = raw == nil ? "none" : source
        state = Loader.load(raw, now: now()) { Loader.uid("x", now: self.now()) }
    }

    /// いまの中身を保存ファイルに書く（いまの版の pack と同じ：savedAt と 11 項目）
    func save() throws { try save(state) }
    /// 画面で変わった中身（保存する 11 項目）を書く
    func save(_ persisted: [String: JSONValue]) throws {
        if writeBlocked { throw SafeFile.Failure.writeFailed("元の写しを残せなかったので、書き換えない") }
        var raw: [String: JSONValue] = ["savedAt": .number(now())]
        for k in StoreFile.persistedKeys { raw[k] = persisted[k] ?? .null }
        try SafeFile.write(try StoreFile(raw: raw).encode(), to: fileURL)
        state = persisted
    }

    static func stamp(_ d: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyyMMdd-HHmmss"
        return f.string(from: d)
    }

    // MARK: 試験のためだけ（GitHub の Mac の試験から、起動の引数で使う）
    /// 試験用：保存ファイルに書けないときを作る（「予定を保存できていません」の確かめ）
    func blockWritesForTest() { writeBlocked = true }

    func resetForTest() {
        try? FileManager.default.removeItem(at: fileURL)
        try? FileManager.default.removeItem(at: migrationDir)
        try? FileManager.default.removeItem(at: exportMapURL)
        try? FileManager.default.removeItem(at: BackupFiles.dir)
        UserDefaults.standard.removeObject(forKey: Self.migratedKey)
    }
}
