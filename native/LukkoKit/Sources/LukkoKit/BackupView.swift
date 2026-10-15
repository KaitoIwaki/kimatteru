import Foundation

/// 設定の「控えと機種変更」「ファイルで出し入れ」「最近消した予定」と、設定の中の小さな操作。
/// Web 版 App.jsx の openBackups・pickLocalBackup・pickBackupFile・readBackupFile・exportBackup・exportIcs の写し
/// （ファイルを読む・書く・共有シートを出すのは画面の側。ここは中身を確かめて state を変えるだけ）
extension Engine {
    /// 端末の中の控えの一覧の行（Web 版の backupRows）
    public struct BackupRow: Equatable { public var key: String; public var label: String }
    public func backupRows() -> [BackupRow] {
        guard JS.truthy(state["backupListOpen"]) else { return [] }
        return (state["backupList"]?.array ?? []).map { b in
            .init(key: JS.string(b["name"]), label: b["kind"] == "auto" ? "\(JS.string(b["day"]))（自動）" : "\(JS.string(b["day"]))（戻す・取り込む前）")
        }
    }
    /// 「端末の中の控え」を開く。items は [{name, kind, at, day}]（新しい順）
    public func openBackupList(_ items: [JSONValue]) { set(["backupList": .array(items), "backupListOpen": true]) }
    public func closeBackupList() { set(["backupListOpen": false]) }
    /// 一覧の控えを押した。text はその中身（読めなければ nil）
    public func pickLocalBackup(_ text: String?) {
        let r: JSONValue = (text ?? "").isEmpty ? ["error": "控えを読めませんでした。"] : Backup.parse(text!, makeId: { self.uid("x") })
        if let e = r["error"] { set(["backupError": e, "backupListOpen": false]); return }
        haptic("light")
        set(["backupListOpen": false, "confirmRestore": r])
    }
    /// ファイルをえらべなかった（貼り付けを開いて、そう言う）
    public func pickBackupUnavailable() {
        set(["pasteOpen": true, "backupError": "ファイルをえらべませんでした。貼り付けで戻してください。"])
    }
    /// えらんだファイルを確かめる。text はファイルの中身（読めなければ nil）、size はバイト数
    public func readBackupFile(_ text: String?, size: Int) {
        if size > Backup.maxBytes {
            set(["backupError": "このファイルは控えにしては大きすぎます。書き出した控えをえらんでください。"]); return
        }
        guard let text else { set(["backupError": "ファイルを読めませんでした。もう一度えらんでください。"]); return }
        let r = Backup.parse(text, makeId: { self.uid("x") })
        if let e = r["error"] { set(["backupError": e]); return }
        haptic("light")
        set(["backupError": "", "confirmRestore": r])
    }
    /// 「ファイルをえらべないときは、貼り付けで戻す」
    public func togglePaste() { haptic("light"); set(["pasteOpen": .bool(!JS.truthy(state["pasteOpen"])), "backupText": "", "backupError": ""]) }
    public func setBackupText(_ s: String) { set(["backupText": .string(s), "backupError": ""]) }
    /// 書き出した日を残す（共有シートを閉じただけでも残す。Web 版と同じ）
    public func markBackupExported() { set(["settings": .object(Self.with(settings, ["lastExportAt": num(now)]))]) }
    /// ファイルの名前に付ける日付（YYYYMMDD、地元の日付）
    public func fileStamp() -> String {
        let p = JSDate.local(now, timeZone)
        func p2(_ n: Int) -> String { n < 10 ? "0\(n)" : "\(n)" }
        return "\(p.y)\(p2(p.m + 1))\(p2(p.d))"
    }
    public func backupFileName() -> String { "LUKKO-控え-\(fileStamp()).json" }
    public func icsFileName() -> String { "LUKKO-\(fileStamp()).ics" }
    /// 書き出す .ics の中身（すべての予定）
    public func icsText() -> String {
        let u = JSDate.local(now, TimeZone(identifier: "UTC")!)
        return IcsCore.toIcs(state["events"]?.array ?? [], stampUTC: (u.y, u.m, u.d, u.h, u.min, u.s))
    }

    // MARK: 最近消した予定
    public func openTrash() { haptic("light"); set(["trashOpen": true]) }
    public func closeTrash() { set(["trashOpen": false]) }
    public func restoreTrashRow(_ key: JSONValue) { haptic("light"); restoreTrash([key]) }

    // MARK: 設定の中の小さな操作
    /// 「＋ 種類を追加」（開いている種類は閉じる）
    public func addTypeRow() {
        haptic("light")
        set(["newType": JS.truthy(state["newType"]) ? .null : ["name": "", "color": "#2F72C4"], "editTypeKey": .null])
    }
    /// 時給の − ／ ＋（10 円ずつ。0 より下にしない）
    public func stepJobHourly(_ id: JSONValue?, _ d: Double) {
        guard let j = jobsList.first(where: { $0["id"] == id }) else { return }
        let h = JS.number(j["hourly"]) + d
        patchJob(id, ["hourly": .number(d < 0 ? max(0, h) : h)])
    }
    public func closeTemplateNew() { set(["tplNew": .null]) }
    public func setTemplateSym(_ s: String) { patchTemplateNew(["sym": .string(JS.slice16(s, 2))]) }
    public func setTemplateName(_ s: String) { patchTemplateNew(["name": .string(JS.slice16(s, 12))]) }
    /// 規約・プライバシーポリシー
    public func openDoc(_ key: String) { set(["screen": "doc", "docKey": .string(key)]) }
    public func docBack() { set(["screen": "settings", "docKey": .null]) }
}
