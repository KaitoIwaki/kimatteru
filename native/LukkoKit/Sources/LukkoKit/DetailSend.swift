import Foundation

/// 予定の詳細の「この予定を送る」（Web 版 sendEvent の写し）
extension Engine {
    /// 送る中身：文（shareText）と、その 1 件だけの .ics（ファイル名「LUKKO-M月D日.ics」）。押した手ごたえ（tapLight）もここで
    public func sendEventPayload(_ ev: Obj) -> (text: String, fileName: String, ics: String) {
        haptic("light")
        var uc = Calendar(identifier: .gregorian)
        uc.timeZone = TimeZone(identifier: "UTC")!
        let u = uc.dateComponents([.year, .month, .day, .hour, .minute, .second], from: Date(timeIntervalSince1970: now / 1000))
        let stamp = (u.year ?? 1970, (u.month ?? 1) - 1, u.day ?? 1, u.hour ?? 0, u.minute ?? 0, u.second ?? 0)
        let name = "LUKKO-\(JS.string(.number(JS.number(ev["m"]) + 1)))月\(JS.string(ev["day"]))日.ics"
        return (shareText(ev), name, IcsCore.toIcs([.object(ev)], stampUTC: stamp))
    }
}
