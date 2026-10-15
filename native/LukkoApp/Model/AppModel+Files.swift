import SwiftUI
import UIKit
import UniformTypeIdentifiers
import LukkoKit

/// ファイルでの出し入れ（Web 版の exportBackup・pickBackupFile・readBackupFile・openBackups・pickLocalBackup・exportIcs・readIcsFile の写し）。
/// 中身を確かめて state を変えるのは Engine。ここはファイルを読む・書く・共有シートを出すだけ
extension AppModel {
    /// 「控えをファイルに保存」：整形した JSON を「LUKKO-控え-YYYYMMDD.json」で共有シートへ。閉じただけでも書き出した日を残す
    func exportBackup() {
        engine.haptic("light")
        let text = engine.backupText(appVersion: Self.version, pretty: true)
        let name = engine.backupFileName()
        SettingsFileShare.shareFile(name: name, data: Data(text.utf8)) { [weak self] in self?.engine.markBackupExported() }
    }
    /// 「ファイルに書き出す .ics」
    func exportIcs() {
        engine.haptic("light")
        SettingsFileShare.shareFile(name: engine.icsFileName(), data: Data(engine.icsText().utf8), done: nil)
    }
    /// 「端末の中の控え」：一覧を読んでシートを出す
    func openBackups() {
        engine.haptic("light")
        let items: [JSONValue] = BackupFiles.list().map { b in
            ["name": .string(b.name), "kind": .string(b.kind), "at": .number(b.at), "day": .string(b.day)]
        }
        engine.openBackupList(items)
    }
    /// 一覧の控えを押した
    func pickLocalBackup(_ name: String) {
        engine.pickLocalBackup(BackupFiles.read(name))
    }
    /// えらんだ控えのファイル
    func readBackupFile(_ result: Result<[URL], Error>) {
        switch result {
        case .failure:
            engine.pickBackupUnavailable()
        case .success(let urls):
            guard let url = urls.first else { return }
            let r = SettingsFileShare.read(url, limit: Backup.maxBytes)
            engine.readBackupFile(r.text, size: r.size)
        }
    }
    /// えらんだ .ics のファイル（読めなければ空の中身として流す。Web 版と同じ）
    func readIcsFile(_ result: Result<[URL], Error>) {
        guard case .success(let urls) = result, let url = urls.first else { return }
        let r = SettingsFileShare.read(url, limit: nil)
        engine.runIcs(r.text ?? "")
    }
}

/// 共有シートとファイルの読み書き（設定の書き出し・カードの画像で使う）
enum SettingsFileShare {
    static let icsTypes: [UTType] = {
        var out: [UTType] = []
        if let ics = UTType(filenameExtension: "ics") { out.append(ics) }
        for t in [UTType.calendarEvent, UTType.plainText] where !out.contains(t) { out.append(t) }
        return out
    }()
    static let backupTypes: [UTType] = [UTType.json, UTType.plainText, UTType.data]

    /// 一時の置き場に名前どおりに書いて、iPhone の共有シートを出す。done は閉じたとき（共有しなくても）
    @MainActor
    static func shareFile(name: String, data: Data, done: (() -> Void)?) {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("share", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let url = dir.appendingPathComponent(name)
        do { try data.write(to: url, options: .atomic) } catch { done?(); return }
        present([url], done: done)
    }

    @MainActor
    static func present(_ items: [Any], done: (() -> Void)?) {
        guard let top = topController() else { done?(); return }
        let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
        vc.popoverPresentationController?.sourceView = top.view
        vc.popoverPresentationController?.sourceRect = CGRect(x: top.view.bounds.midX, y: top.view.bounds.midY, width: 1, height: 1)
        vc.completionWithItemsHandler = { _, _, _, _ in done?() }
        top.present(vc, animated: true)
    }

    @MainActor
    static func topController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
        guard var top = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController ?? scene?.windows.first?.rootViewController else { return nil }
        while let p = top.presentedViewController, !p.isBeingDismissed { top = p }
        return top
    }

    /// ファイルを読む（えらんだファイルは、読むあいだだけ使わせてもらう）。limit を超えたら中身は読まない
    static func read(_ url: URL, limit: Int?) -> (text: String?, size: Int) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        if let limit, size > limit { return (nil, size) }
        guard let d = try? Data(contentsOf: url) else { return (nil, size) }
        var s = String(decoding: d, as: UTF8.self)
        if s.hasPrefix("\u{FEFF}") { s.removeFirst() }   // file.text() と同じく、頭の BOM は落とす
        return (s, max(size, d.count))
    }
}
