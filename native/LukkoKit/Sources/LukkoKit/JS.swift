import Foundation

/// Web 版（JavaScript）と答えを 1 つ残らずそろえるための、JS の決まりの写し。
///
/// 予定のデータは JSON のまま持つ（JSONValue）。JS のコードは「値があるか」を
/// `a || b`（空の文字・0・false・null は「無い」）で判断している所が多い。
/// その判断を Swift で少しでも変えると、たとえば actualEnd が "" の予定で答えが変わる。
/// だから、JS の決まりをここに写して、計算はすべてこれを通す。
public enum JS {
    /// JS の「真っぽいか」（truthy）
    public static func truthy(_ v: JSONValue?) -> Bool {
        guard let v else { return false }
        switch v {
        case .null: return false
        case .bool(let b): return b
        case .number(let n): return n != 0 && !n.isNaN
        case .string(let s): return !s.isEmpty
        case .array, .object: return true
        }
    }

    /// JS の `a || b`
    public static func or(_ a: JSONValue?, _ b: JSONValue?) -> JSONValue? { truthy(a) ? a : b }

    /// JS の String(v)（数と文字だけで足りる。予定のデータに出てくるのはこの形）
    public static func string(_ v: JSONValue?) -> String {
        guard let v else { return "undefined" }
        switch v {
        case .null: return "null"
        case .bool(let b): return b ? "true" : "false"
        case .number(let n): return numberToString(n)
        case .string(let s): return s
        case .array(let a): return a.map { e -> String in if case .null = e { return "" }; return string(e) }.joined(separator: ",")
        case .object: return "[object Object]"
        }
    }

    static func numberToString(_ n: Double) -> String {
        if n.isNaN { return "NaN" }
        if n.isInfinite { return n > 0 ? "Infinity" : "-Infinity" }
        if n == n.rounded(), abs(n) < 1e21 { return String(format: "%.0f", n) }
        // 小数は最短の表し方（JS と同じく、読み戻すと同じ値になる最短）
        var s = "\(n)"
        if s.hasSuffix(".0") { s.removeLast(2) }
        return s
    }

    /// JS の Number(文字)。前後の空白は無視、空なら 0、読めなければ NaN
    public static func number(_ s: String) -> Double {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return 0 }
        let lower = t.lowercased()
        if lower.hasPrefix("0x"), let v = UInt64(t.dropFirst(2), radix: 16) { return Double(v) }
        if lower.hasPrefix("0o"), let v = UInt64(t.dropFirst(2), radix: 8) { return Double(v) }
        if lower.hasPrefix("0b"), let v = UInt64(t.dropFirst(2), radix: 2) { return Double(v) }
        if t == "Infinity" || t == "+Infinity" { return .infinity }
        if t == "-Infinity" { return -.infinity }
        // 数の形だけ受け付ける（Swift の Double は "inf" や "nan" も読むが、JS は NaN）
        let ok = t.range(of: #"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$"#, options: .regularExpression) != nil
        guard ok, let v = Double(t) else { return .nan }
        return v
    }

    /// JS の Number(値)
    public static func number(_ v: JSONValue?) -> Double {
        guard let v else { return .nan }
        switch v {
        case .null: return 0
        case .bool(let b): return b ? 1 : 0
        case .number(let n): return n
        case .string(let s): return number(s)
        case .array(let a): return a.isEmpty ? 0 : (a.count == 1 ? number(.string(string(a[0]))) : .nan)
        case .object: return .nan
        }
    }

    /// JS の `x || 0`（数で、NaN と 0 は 0）
    public static func orZero(_ n: Double) -> Double { (n.isNaN || n == 0) ? 0 : n }

    /// JS の `v | 0`（ToInt32）
    public static func toInt32(_ v: JSONValue?) -> Int32 {
        let n = number(v)
        if n.isNaN || n.isInfinite { return 0 }
        let t = n < 0 ? -(-n).rounded(.down) : n.rounded(.down)
        let m = t.truncatingRemainder(dividingBy: 4294967296)
        let u = m < 0 ? m + 4294967296 : m
        return Int32(bitPattern: UInt32(u))
    }

    /// JS の配列の sort（安定な並べ替え。Swift の sort は安定と決まっていないので、元の順番で決着をつける）
    public static func stableSorted<T>(_ a: [T], _ less: (T, T) -> Int) -> [T] {
        a.enumerated().sorted { x, y in
            let c = less(x.element, y.element)
            return c != 0 ? c < 0 : x.offset < y.offset
        }.map { $0.element }
    }
}

/// 日付の数え方（タイムゾーンに左右されない、暦の上の計算だけ）
public enum Civil {
    /// 1970-01-01 からの日数（JS の Math.floor(Date.UTC(y, m, d) / 86400000) と同じ。月・日のはみ出しも同じく繰り上げる）
    public static func dayNo(_ y: Int, _ m: Int, _ d: Int) -> Int {
        let yy = y + Int((Double(m) / 12).rounded(.down))
        let mm = ((m % 12) + 12) % 12
        return daysFromCivil(yy, mm + 1, 1) + (d - 1)
    }

    /// 年・月（1〜12）・日 → 1970-01-01 からの日数（H. Hinnant の式）
    public static func daysFromCivil(_ y0: Int, _ m: Int, _ d: Int) -> Int {
        let y = m <= 2 ? y0 - 1 : y0
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }

    /// 日数 → 年・月（0〜11）・日
    public static func fromDayNo(_ z0: Int) -> (y: Int, m: Int, d: Int) {
        let z = z0 + 719468
        let era = (z >= 0 ? z : z - 146096) / 146097
        let doe = z - era * 146097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        let y = yoe + era * 400
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        return (m <= 2 ? y + 1 : y, m - 1, d)
    }

    /// 曜日（0=日曜）。JS の new Date(y, m, d).getDay() と同じ
    public static func weekday(_ y: Int, _ m: Int, _ d: Int) -> Int {
        let n = dayNo(y, m, d)
        return ((n % 7) + 7 + 4) % 7
    }

    /// その月の日数。JS の new Date(y, m + 1, 0).getDate() と同じ
    public static func daysInMonth(_ y: Int, _ m: Int) -> Int {
        dayNo(y, m + 1, 1) - dayNo(y, m, 1)
    }
}
