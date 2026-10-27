import Foundation

/// 保存ファイルを読む。「ファイルが無い」と「あるのに読めない」を分ける。
///
/// 読めないのに「無い」と同じに扱うと、空のカレンダーで開き、次の保存で本物のファイルを上書きしてしまう
/// （他のカレンダーアプリで「アップデートしたら予定が全部消えた」と言われる形）。
/// iPhone の再起動のあと、まだ一度もロックを解いていないあいだは、ファイルがあっても読めないことがある
public enum StoreRead: Equatable {
    case missing
    case data(Data)
    case unreadable(String)

    public static func read(_ url: URL) -> StoreRead {
        let fm = FileManager.default
        var isDir: ObjCBool = false
        guard fm.fileExists(atPath: url.path, isDirectory: &isDir) else { return .missing }
        if isDir.boolValue { return .unreadable("フォルダになっている") }
        do { return .data(try Data(contentsOf: url)) } catch { return .unreadable("\(error)") }
    }
}
