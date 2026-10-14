import Foundation

/// アプリの中身と、それを変える操作（Web 版 App.jsx の App クラスの setState する操作の写し）。
///
/// 中身（state）は Web 版と同じ形の JSON。画面（SwiftUI）はこの state を見て描き、押されたら同じ名前の操作を呼ぶ。
/// 時計（now）と待ち（setTimeout）もここで持つ。正解表の試験では、時計を進めて待ちを動かす。
public final class Engine {
    public typealias Obj = [String: JSONValue]

    public private(set) var state: Obj
    /// いまのミリ秒（JS の Date.now()）
    public var now: Double
    /// 地元の時刻の数え方（端末のタイムゾーン）
    public var timeZone: TimeZone
    /// 番号を作る（Web 版の uid）。試験では差し替えられる
    public var makeUid: (String, Double) -> String = { p, n in Loader.uid(p, now: n) }
    /// iPhone の部品を呼ぶところ（評価の小窓など）。画面の側から差し込む
    public var onRequestReview: () -> Void = {}

    struct Timer { let id: Int; let at: Double; let fn: () -> Void }
    private var timers: [Timer] = []
    private var nextTimer = 1
    var named: [String: Int] = [:]
    /// 取り消しの「前の値」の項目（JS では値が undefined の項目も「消す」として戻すため、項目の名前を持っておく）
    public var undoPrevKeys: [String] = []

    public init(state: Obj, now: Double, timeZone: TimeZone) {
        self.state = state; self.now = now; self.timeZone = timeZone
    }

    // MARK: 中身の差し替え（JS の setState。上の段だけ混ぜる。nil は「無い」）
    public func set(_ patch: [String: JSONValue?]) {
        for (k, v) in patch { if let v { state[k] = v } else { state.removeValue(forKey: k) } }
    }
    func core() -> AppCore { AppCore(state: state) }
    func uid(_ prefix: String) -> String { makeUid(prefix, now) }

    // MARK: 待ち（setTimeout）
    @discardableResult
    func later(_ ms: Double, _ fn: @escaping () -> Void) -> Int {
        let id = nextTimer; nextTimer += 1
        timers.append(Timer(id: id, at: now + ms, fn: fn))
        return id
    }
    func cancel(_ id: Int?) { if let id { timers.removeAll { $0.id == id } } }
    /// 時計を ms だけ進め、そのあいだに来る待ちを時刻の順に動かす
    public func advance(_ ms: Double) {
        let end = now + ms
        for _ in 0..<200 {
            timers.sort { $0.at != $1.at ? $0.at < $1.at : $0.id < $1.id }
            guard let t = timers.first, t.at <= end else { break }
            timers.removeFirst()
            if t.at > now { now = t.at }
            t.fn()
        }
        now = end
    }

    // MARK: 便利なもの
    var events: [Obj] { (state["events"]?.array ?? []).compactMap { $0.object } }
    var settings: Obj { state["settings"]?.object ?? [:] }
    var today: (y: Int, m: Int, d: Int) {
        let t = state["today"]?.object ?? [:]
        return (Int(JS.number(t["y"])), Int(JS.number(t["m"])), Int(JS.number(t["d"])))
    }
    func num(_ v: Double) -> JSONValue { .number(v) }
    func str(_ s: String) -> JSONValue { .string(s) }
    func eventsArray(_ list: [Obj]) -> JSONValue { .array(list.map { .object($0) }) }
    /// 消した印（iCloud 同期のため）
    func goneAdd(_ ids: [JSONValue]) -> JSONValue {
        let add = ids.filter { JS.truthy($0) }.map { JSONValue.array([$0, num(now)]) }
        return .array(Array((add + (state["gone"]?.array ?? [])).prefix(800)))
    }
    /// JS の `{...o, k: v}`（v が nil なら「無い」）
    static func with(_ o: Obj, _ patch: [String: JSONValue?]) -> Obj {
        var r = o
        for (k, v) in patch { if let v { r[k] = v } else { r.removeValue(forKey: k) } }
        return r
    }
    static let somedayLabel = ["week": "今週のどこか", "month": "今月のどこか", "next": "来月あたり", "someday": "いつか"]

    // MARK: 種類
    func visibleTypes() -> [Obj] {
        let all = (state["types"]?.array ?? []).compactMap { $0.object }
        let v = all.filter { !JS.truthy($0["hidden"]) }
        return v.isEmpty ? all : v
    }
    public func defTimes(_ key: JSONValue?) -> (start: String, end: String) {
        let t = (state["types"]?.array ?? []).compactMap { $0.object }.first { $0["key"] == key } ?? [:]
        return (JS.truthy(t["defStart"]) ? JS.string(t["defStart"]) : "10:00", JS.truthy(t["defEnd"]) ? JS.string(t["defEnd"]) : "11:00")
    }

    // MARK: 知らせのひとこと
    func toast(_ msg: String, _ ms: Double = 2400) {
        set(["shareToast": .bool(true), "shareMsg": str(msg)])
        cancel(named["toast"])
        named["toast"] = later(ms) { [weak self] in self?.set(["shareToast": .bool(false)]) }
    }
    func showUndo(_ text: String, _ data: JSONValue) {
        cancel(named["undo"])
        set(["undo": .object(["text": str(text), "data": data, "key": num(now)])])
        named["undo"] = later(5000) { [weak self] in self?.set(["undo": nil]) }
    }

    // MARK: 評価の小窓（うれしい瞬間にだけ、控えめに）
    public func maybeAskReview(_ reason: String) {
        let cfg = settings
        // JS：if(!cfg.firstUseAt || now-cfg.firstUseAt < 7*86400000) return;
        if !JS.truthy(cfg["firstUseAt"]) || now - JS.number(cfg["firstUseAt"]) < 7 * 86_400_000 { return }
        if JS.truthy(cfg["lastReviewAsk"]) && now - JS.number(cfg["lastReviewAsk"]) < 60 * 86_400_000 { return }
        let n = JS.truthy(cfg["confirmCount"]) ? JS.number(cfg["confirmCount"]) : 0
        let good = reason == "share" || (reason == "confirm" && [5, 10, 25].contains(n))
            || (reason == "open" && now - JS.number(cfg["firstUseAt"]) > 14 * 86_400_000 && events.count >= 20)
        if !good { return }
        set(["settings": .object(Self.with(settings, ["lastReviewAsk": num(now)]))])
        later(1200) { [weak self] in self?.onRequestReview() }
    }
}
