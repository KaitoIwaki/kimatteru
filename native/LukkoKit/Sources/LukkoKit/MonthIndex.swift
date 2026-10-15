import Foundation

/// 予定を「始まりの日」ごとに分けておく索引（sw-month）。
///
/// 予定が何千件あっても、月・週・日の帯を描くたびに全部を見直さないためのもの。
/// 答えは全件を見たときと同じ（元の並びのまま返す）。予定の配列が変わったら作り直す。
/// 同じ配列かどうかは、配列の中身の置き場（バッファ）が同じかで見る。索引が配列を持ち続けるので、
/// 中身が書き換わるときは必ず別の置き場に写される（同じ置き場のまま違う中身になることはない）
public final class EventDayIndex {
    public typealias Obj = [String: JSONValue]
    /// 予定（オブジェクトだけ。元の並びのまま）
    public let objs: [Obj]
    let from: [Int]
    let to: [Int]
    let byFrom: [Int: [Int]]
    private let source: [JSONValue]
    /// この索引（＝この予定の配列）から作った月の週。設定などが同じなら作り直さない
    private var weeksCache: [(key: MonthWeeksKey, weeks: [MonthCore.Week])] = []
    private let lock = NSLock()

    init(_ arr: [JSONValue]) {
        source = arr
        var o: [Obj] = [], f: [Int] = [], t: [Int] = []
        var by: [Int: [Int]] = [:]
        o.reserveCapacity(arr.count); f.reserveCapacity(arr.count); t.reserveCapacity(arr.count)
        for v in arr {
            guard let e = v.object else { continue }
            let a = AppCore.evFrom(e)
            by[a, default: []].append(o.count)
            o.append(e); f.append(a); t.append(a + AppCore.evSpan(e) - 1)
        }
        objs = o; from = f; to = t; byFrom = by
    }

    private static var last: EventDayIndex?
    private static let shared = NSLock()

    /// その予定の配列の索引（同じ配列なら前に作ったものを使う）
    public static func of(_ arr: [JSONValue]) -> EventDayIndex {
        shared.lock(); defer { shared.unlock() }
        if let l = last, l.source.count == arr.count, same(l.source, arr) { return l }
        let x = EventDayIndex(arr)
        last = x
        return x
    }
    static func same(_ a: [JSONValue], _ b: [JSONValue]) -> Bool {
        if a.isEmpty && b.isEmpty { return true }
        return a.withUnsafeBufferPointer { pa in b.withUnsafeBufferPointer { pb in pa.baseAddress == pb.baseAddress } }
    }

    /// a〜b 日（両端を含む）に 1 日でもかかる予定。元の並びのまま
    public func overlapping(_ a: Int, _ b: Int) -> [Obj] {
        guard a <= b else { return [] }
        // 続くのは最長 60 日なので、始まりが a-59〜b の予定だけを見ればよい
        let lo = a - 59
        var idx: [Int] = []
        if b - lo + 1 > byFrom.count {
            for (k, list) in byFrom where k >= lo && k <= b { idx.append(contentsOf: list) }
        } else {
            for k in lo...b { if let list = byFrom[k] { idx.append(contentsOf: list) } }
        }
        idx.sort()
        var out: [Obj] = []
        out.reserveCapacity(idx.count)
        for i in idx where to[i] >= a && from[i] <= b { out.append(objs[i]) }
        return out
    }

    func cachedWeeks(_ key: MonthWeeksKey) -> [MonthCore.Week]? {
        lock.lock(); defer { lock.unlock() }
        return weeksCache.first { $0.key == key }?.weeks
    }
    func storeWeeks(_ key: MonthWeeksKey, _ weeks: [MonthCore.Week]) {
        lock.lock(); defer { lock.unlock() }
        weeksCache.removeAll { $0.key == key }
        weeksCache.append((key, weeks))
        // 前後の月を行き来するぶんだけ取っておく
        if weeksCache.count > 16 { weeksCache.removeFirst(weeksCache.count - 16) }
    }
}

/// 月の週を作り直すかどうかを決める値（予定のほかに、答えを変えるもの）
struct MonthWeeksKey: Equatable {
    var settings: JSONValue?, types: JSONValue?, jobs: JSONValue?, today: JSONValue?
    var y: Int, m: Int, lanes: Int, wageOn: Bool, dark: Bool, sysZoom: Double
    var overlay: [[String: JSONValue]]
}
