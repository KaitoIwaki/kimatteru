import Foundation

/// 日本の祝日を、通信なしでその場で計算する（Web 版 app/src/holidays.js の写し）。
/// 春分・秋分は近似式（1980〜2099年で一致する式）。
public enum Holidays {
    private static func nthMonday(_ y: Int, _ m: Int, _ nth: Int) -> Int {
        let first = Civil.weekday(y, m, 1)
        return 1 + ((8 - first) % 7) + (nth - 1) * 7
    }
    private static func vernal(_ y: Int) -> Int {
        Int((20.8431 + 0.242194 * Double(y - 1980) - (Double(y - 1980) / 4).rounded(.down)).rounded(.down))
    }
    private static func autumnal(_ y: Int) -> Int {
        Int((23.2488 + 0.242194 * Double(y - 1980) - (Double(y - 1980) / 4).rounded(.down)).rounded(.down))
    }

    private static func buildYear(_ y: Int) -> [String: String] {
        var map: [String: String] = [:]
        func put(_ m: Int, _ d: Int, _ name: String) { if d >= 1 { map["\(m)-\(d)"] = name } }

        put(0, 1, "元日")
        put(0, nthMonday(y, 0, 2), "成人の日")
        put(1, 11, "建国記念の日")
        if y >= 2020 { put(1, 23, "天皇誕生日") }
        put(2, vernal(y), "春分の日")
        put(3, 29, "昭和の日")
        put(4, 3, "憲法記念日")
        put(4, 4, "みどりの日")
        put(4, 5, "こどもの日")

        if y == 2020 { put(6, 23, "海の日"); put(6, 24, "スポーツの日"); put(7, 10, "山の日") }
        else if y == 2021 { put(6, 22, "海の日"); put(6, 23, "スポーツの日"); put(7, 8, "山の日") }
        else {
            put(6, nthMonday(y, 6, 3), "海の日")
            if y >= 2016 { put(7, 11, "山の日") }
            put(9, nthMonday(y, 9, 2), y >= 2020 ? "スポーツの日" : "体育の日")
        }

        put(8, nthMonday(y, 8, 3), "敬老の日")
        put(8, autumnal(y), "秋分の日")
        put(10, 3, "文化の日")
        put(10, 23, "勤労感謝の日")

        // 国民の休日：前後を祝日にはさまれた平日
        for m in 0..<12 {
            let dim = Civil.daysInMonth(y, m)
            var d = 2
            while d < dim {
                defer { d += 1 }
                if map["\(m)-\(d)"] != nil { continue }
                if Civil.weekday(y, m, d) == 0 { continue }
                if map["\(m)-\(d - 1)"] != nil && map["\(m)-\(d + 1)"] != nil { map["\(m)-\(d)"] = "国民の休日" }
            }
        }

        // 振替休日：日曜が祝日なら、次の祝日でない日
        var extra: [String: String] = [:]
        for m in 0..<12 {
            let dim = Civil.daysInMonth(y, m)
            for d in stride(from: 1, through: dim, by: 1) {
                if map["\(m)-\(d)"] == nil { continue }
                if Civil.weekday(y, m, d) != 0 { continue }
                var nm = m, nd = d + 1
                for _ in 0..<7 {
                    if nd > Civil.daysInMonth(y, nm) { nd = 1; nm += 1 }
                    if nm > 11 { break }
                    if map["\(nm)-\(nd)"] == nil && extra["\(nm)-\(nd)"] == nil { extra["\(nm)-\(nd)"] = "振替休日"; break }
                    nd += 1
                }
            }
        }
        return map.merging(extra) { _, b in b }
    }

    private static var cache: [Int: [String: String]] = [:]
    private static let lock = NSLock()

    /// その日が祝日なら名前、そうでなければ nil（m は 0〜11）
    public static func name(_ y: Int, _ m: Int, _ d: Int) -> String? {
        lock.lock(); defer { lock.unlock() }
        if cache[y] == nil { cache[y] = buildYear(y) }
        return cache[y]?["\(m)-\(d)"]
    }
}
