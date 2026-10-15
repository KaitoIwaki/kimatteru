import Foundation

/// 取り込み（Web 版 app/src/calendarimport.js の diffImport・dedupe・guessTypes の写し）
public enum ImportCore {
    public typealias Ev = [String: JSONValue]

    static func key(_ e: Ev) -> String {
        [e["y"], e["m"], e["day"], e["start"], e["title"]].map { JS.string($0) }.joined(separator: "-")
    }
    static func dayNo0(_ e: Ev) -> Int { Civil.dayNo(JS.int(e["y"]), JS.int(e["m"]), JS.int(e["day"])) }

    public struct Diff: Equatable {
        public var fresh: [Int]          // incoming の番号
        public var changed: [(Int, Int)] // (incoming の番号, existing の番号)
        public var gone: [Int]           // existing の番号
        public static func == (a: Diff, b: Diff) -> Bool { a.fresh == b.fresh && a.gone == b.gone && a.changed.map { [$0.0, $0.1] } == b.changed.map { [$0.0, $0.1] } }
    }

    /// 2回目からの取り込みで、新しいもの・直ったもの・元で消えたものに分ける（番号は配列の位置）
    public static func diffImport(_ incoming: [Ev], _ existing: [Ev], range: (from: Int, to: Int, cals: [JSONValue]?)?) -> Diff {
        var bySrc: [String: [Int]] = [:]
        for (i, e) in existing.enumerated() where JS.truthy(e["srcId"]) { bySrc[JS.string(e["srcId"]), default: []].append(i) }
        var inCount: [String: Int] = [:]
        for e in incoming where JS.truthy(e["srcId"]) { inCount[JS.string(e["srcId"]), default: 0] += 1 }
        func days(_ e: Ev) -> JSONValue { JS.truthy(e["allDay"]) ? (JS.or(e["days"], .number(1)) ?? .number(1)) : .number(1) }
        var seen = Set(existing.map(key))
        var fresh: [Int] = [], changed: [(Int, Int)] = []
        var hit = Set<String>()
        func strictEq(_ a: JSONValue?, _ b: JSONValue?) -> Bool { a == b }   // JS の ===（undefined どうしは同じ）
        for (ii, e) in incoming.enumerated() {
            let src = JS.truthy(e["srcId"]) ? JS.string(e["srcId"]) : nil
            let all = src.flatMap { bySrc[$0] } ?? []
            let list = all.filter { !hit.contains(JS.string(existing[$0]["id"])) }
            var cur: Int? = list.first { x in strictEq(existing[x]["y"], e["y"]) && strictEq(existing[x]["m"], e["m"]) && strictEq(existing[x]["day"], e["day"]) }
            if cur == nil, list.count == 1, all.count == 1, inCount[src ?? ""] == 1 { cur = list[0] }
            if let ci = cur {
                let c = existing[ci]
                hit.insert(JS.string(c["id"]))
                let same = strictEq(c["y"], e["y"]) && strictEq(c["m"], e["m"]) && strictEq(c["day"], e["day"]) && strictEq(c["start"], e["start"]) && strictEq(c["end"], e["end"])
                    && strictEq(c["title"], e["title"]) && strictEq(JS.or(c["place"], .string("")), JS.or(e["place"], .string("")))
                    && JS.truthy(c["allDay"]) == JS.truthy(e["allDay"]) && days(c) == days(e)
                if !same { changed.append((ii, ci)) }
                continue
            }
            let k = key(e)
            if seen.contains(k) { continue }
            seen.insert(k)
            fresh.append(ii)
        }
        var gone: [Int] = []
        if let range {
            for (i, e) in existing.enumerated() {
                guard JS.truthy(e["srcId"]), !hit.contains(JS.string(e["id"])), JS.string(e["status"]) != "nakunatta" || e["status"]?.string == nil else { continue }
                if let cals = range.cals, JS.truthy(e["srcCal"]), !cals.contains(where: { $0 == e["srcCal"] }) { continue }
                let n = dayNo0(e)
                if n >= range.from && n <= range.to { gone.append(i) }
            }
        }
        return Diff(fresh: fresh, changed: changed, gone: gone)
    }

    /// 同じ日・同じ時刻・同じ名前、または同じ番号のものは、すでに入っているとみなす（.ics の取り込み）
    public static func dedupe(_ incoming: [Ev], _ existing: [Ev]) -> [Int] {
        var seen = Set(existing.map(key))
        let bySrc = Set(existing.filter { JS.truthy($0["srcId"]) }.map { JS.string($0["srcId"]) })
        var out: [Int] = []
        for (i, e) in incoming.enumerated() {
            let k = key(e)
            if seen.contains(k) || (JS.truthy(e["srcId"]) && bySrc.contains(JS.string(e["srcId"]))) { continue }
            seen.insert(k)
            out.append(i)
        }
        return out
    }

    static let keywords: [(key: String, words: [String])] = [
        ("off", ["有給", "有休", "年休", "公休", "希望休", "半休", "午前休", "午後休", "夜勤明け", "明け休み", "振休", "代休"]),
        ("work", ["会議", "打ち合わせ", "打合せ", "ミーティング", "mtg", "1on1", "面談", "商談", "来客", "出張", "定例",
                  "研修", "在宅", "テレワーク", "残業", "業務", "納品", "締切", "締め切り", "レビュー", "朝会", "夕会", "セミナー", "勉強会", "勤務", "出勤", "出社"]),
        ("baito", ["バイト", "アルバイト", "シフト", "パート", "勤務", "出勤", "早番", "遅番", "中番", "日勤", "夜勤", "準夜", "深夜", "当直", "宿直"]),
        ("yoji", ["病院", "歯医者", "歯科", "クリニック", "医院", "通院", "診察", "健診", "健康診断",
                  "予防接種", "銀行", "役所", "郵便局", "美容院", "美容室", "床屋", "サロン", "ネイル",
                  "提出", "締切", "締め切り", "面接", "面談", "手続き", "車検", "引っ越し", "引越",
                  "打ち合わせ", "打合せ", "会議", "ミーティング", "mtg", "説明会", "授業", "講義", "試験", "テスト",
                  "塾", "部活", "ジム", "練習", "習い事", "レッスン", "稽古", "サークル", "ゼミ"]),
        ("asobi", ["飲み", "のみ会", "ランチ", "ディナー", "ごはん", "ご飯", "映画", "ライブ",
                   "コンサート", "フェス", "旅行", "温泉", "誕生日", "誕生会", "カラオケ", "bbq", "バーベキュー",
                   "花火", "デート", "観光", "買い物", "ショッピング", "遊び", "遊ぶ", "パーティ"]),
    ]

    /// 全角の英数を半角に落として、小文字にする（MTG と ｍｔｇ を同じに）
    public static func norm(_ v: JSONValue?) -> String {
        let s = JS.truthy(v) ? JS.string(v) : ""
        var out = String.UnicodeScalarView()
        for u in s.unicodeScalars {
            let c = u.value
            if (0xFF21...0xFF3A).contains(c) || (0xFF41...0xFF5A).contains(c) || (0xFF10...0xFF19).contains(c) { out.append(Unicode.Scalar(c - 0xFEE0)!) } else { out.append(u) }
        }
        return String(out).lowercased()
    }
    /// JS の includes（UTF-16 のまま探す）
    static func includes(_ a: String, _ b: String) -> Bool {
        if b.isEmpty { return true }
        return (a as NSString).range(of: b, options: .literal).location != NSNotFound
    }
    static func mins(_ t: JSONValue?) -> Double {
        let p = JS.string(t).components(separatedBy: ":")
        return JS.number(p[0]) * 60 + (p.count > 1 ? JS.number(p[1]) : .nan)
    }

    /// 取り込んだ予定に種類を当てる。戻りは [{key, why}]（why：name / word / repeat / ''）
    public static func guessTypes(_ list: [Ev], _ types: [[String: JSONValue]]) -> [JSONValue] {
        func has(_ k: String) -> Bool { types.contains { $0["key"] == .string(k) && !JS.truthy($0["hidden"]) } }
        let fallback: JSONValue = has("yoji") ? .string("yoji") : (types.first?["key"] ?? .null)
        var runs: [String: Int] = [:]
        func runKey(_ e: Ev) -> String { norm(e["title"]) + "@" + JS.string(e["start"]) + "-" + JS.string(e["end"]) }
        for e in list { runs[runKey(e), default: 0] += 1 }
        let baitoVisible = types.contains { $0["key"] == .string("baito") && !JS.truthy($0["hidden"]) }
        let workVisible = types.contains { $0["key"] == .string("work") && !JS.truthy($0["hidden"]) }
        return list.map { e -> JSONValue in
            let title = norm(e["title"])
            for t in types {
                let n = norm(t["name"])
                if n.utf16.count >= 2 && includes(title, n) { return .object(["key": t["key"] ?? .null, "why": .string("name")]) }
            }
            for g in keywords {
                if !has(g.key) { continue }
                if g.words.contains(where: { includes(title, norm(.string($0))) }) { return .object(["key": .string(g.key), "why": .string("word")]) }
            }
            if baitoVisible && !workVisible && !JS.truthy(e["allDay"]) {
                let n = runs[runKey(e)] ?? 0
                var len = mins(e["end"]) - mins(e["start"])
                if len <= 0 { len += 1440 }
                if n >= 3 && len >= 180 { return .object(["key": .string("baito"), "why": .string("repeat")]) }
            }
            // 種類が 1 つも無いとき、JS では key が undefined になり、書き出すと key の無い形になる
            if case .null = fallback { return .object(["why": .string("")]) }
            return .object(["key": fallback, "why": .string("")])
        }
    }
}
