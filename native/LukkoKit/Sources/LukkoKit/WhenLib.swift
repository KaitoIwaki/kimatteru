import Foundation

/// 予定が「いつ終わるか」を、日またぎまで含めて決める（Web 版 app/src/whenlib.js の写し）。
/// 予定は JSON のまま（[String: JSONValue]）受け取る。
public enum WhenLib {
    public typealias Ev = [String: JSONValue]

    /// "HH:MM" → 分。JS：String(t).split(':').map(Number) で (h||0)*60 + (m||0)
    public static func toMin(_ t: JSONValue?) -> Double {
        let parts = JS.string(t).components(separatedBy: ":")
        let h = JS.orZero(JS.number(parts[0]))
        let m = parts.count > 1 ? JS.orZero(JS.number(parts[1])) : 0
        return h * 60 + m
    }

    /// 終わりが翌日にずれ込むか（終日は対象外）
    public static func endsNextDay(_ ev: Ev?) -> Bool {
        guard let ev else { return false }
        if JS.truthy(ev["allDay"]) { return false }
        let end = JS.or(ev["actualEnd"], ev["end"])
        let e = toMin(end), s = toMin(ev["start"])
        return e <= s && e != s
    }

    /// 次の日にも「続き」として出すか（0:00 ちょうどに終わる予定は出さない）
    public static func spillsNextDay(_ ev: Ev) -> Bool {
        endsNextDay(ev) && toMin(JS.or(ev["actualEnd"], ev["end"])) > 0
    }

    /// その予定が実際に終わる瞬間（年・月 0〜11・日・時・分。月や日のはみ出しは繰り上げる）
    public static func endMoment(_ ev: Ev) -> (y: Int, m: Int, d: Int, h: Int, min: Int) {
        let end = JS.or(ev["actualEnd"], ev["end"])
        let parts = JS.string(end).components(separatedBy: ":")
        let h = JS.int(.number(JS.orZero(JS.number(parts[0]))))
        let mi = parts.count > 1 ? JS.int(.number(JS.orZero(JS.number(parts[1])))) : 0
        let y = JS.int(ev["y"]), m = JS.int(ev["m"]), d = JS.int(ev["day"])
        let total = (Civil.dayNo(y, m, d + (endsNextDay(ev) ? 1 : 0))) * 1440 + h * 60 + mi
        let dn = Int((Double(total) / 1440).rounded(.down))
        let rest = total - dn * 1440
        let c = Civil.fromDayNo(dn)
        return (c.y, c.m, c.d, rest / 60, rest % 60)
    }

    /// その日のうちで、予定がふさいでいる終わりの分（日をまたぐなら 24:00）
    public static func busyEndMin(_ ev: Ev) -> Double {
        endsNextDay(ev) ? 1440 : toMin(JS.or(ev["actualEnd"], ev["end"]))
    }
}
