//
//  KimatteruWidget.swift
//  LUKKO のウィジェット
//
//  答える一文は「今日、何が決まっていて、何がまだか」。
//
//  決めごと
//   ・上2段（日付と「まだ○件」、次の1件）は、どの日でも同じ場所に置く。
//     毎日何十回も目に入るものなので、見る場所が動くと読み直しになる。
//   ・見分けは形が受け持つ（塗り＝決まった／点線＝まだ）。色は補助。
//     iOS 18 のホーム画面には色を1色に染める表示があり、ロック画面は
//     もともと単色なので、色＝種類はウィジェットでは成立しない。
//   ・空の日を空白にしない。「今週 まだ○件」や、この先の予定で埋める。
//   ・終わった予定は後ろへ回して薄くする。朝の会議が夕方まで先頭に居座ると、
//     「次は何？」に答えられない。そのために、予定が終わる時刻ごとに描き直す。
//
//  中身はアプリが App Group に書いた JSON を読むだけ。どれが今日かは
//  こちら側で決める（アプリが数日開かれなくても、正しい日を指すため）。
//
//  ウィジェットだけ iOS 17 以降にしてある。16 以前と両対応にすると、
//  余白を切る指定（contentMarginsDisabled）が版によって型の違う値を返し、
//  Swift の戻り値の書き方が通らない。回避はできるが、そのために
//  読みにくい書き方を持ち込むより、対象を絞るほうがよいと判断した。
//  アプリ本体は iOS 15 のまま。
//

import WidgetKit
import SwiftUI

let APP_GROUP = "group.com.kimatteru.app"
let STORE_KEY = "widget"

// MARK: - 受け取る中身

struct Item: Decodable, Hashable {
    let t: String?      // 時刻。終日なら nil
    let e: String?      // その日の終わりの時刻。終日なら nil。夜中の0時をまたぐ日は "24:00"
    let n: String       // 名前（伏せる設定のときは、アプリが「予定あり」に置き換えてある）
    let c: String       // 種類の色
    let s: Int          // 1 = 決まっている（塗り）／0 = まだ（点線）
    let m: [String]?    // 持ち物
    let k: String?      // 予定の id。大のカレンダーで日をまたぐ帯をつなぐ
    let p: Int?         // その日が何日目か。0=1日だけ 1=初日 2=途中 3=最終日
    let x: Int?         // 1 = 名前を伏せてある。置き換えはアプリ側で済んでいるので、ここでは読むだけ
    /// もう終わった予定。JSON には無く、組み立てるときにこちらで付ける
    var past = false

    // past は JSON から読まない。ここに挙げると、無いキーを読もうとして全体の読み込みが失敗する
    enum CodingKeys: String, CodingKey { case t, e, n, c, s, m, k, p, x }

    var solid: Bool { s == 1 }
    var time: String { t ?? "終日" }
    /// 終わる時刻（その日の0時からの分）。終日と、終わりを持たない古い中身は nil
    var endMin: Int? { t == nil ? nil : clockMinutes(e) }
}

struct Payload: Decodable {
    let weekStart: Int
    let days: [String: [Item]]
    let hol: [String]?          // 祝日の日付。日付を赤くするために使う
}

// MARK: - 色

/// アプリと同じ混ぜ方。塗りの地は白へ .32、点線の地は白へ .62、文字は黒へ .66。
/// ここを勝手に変えると、アプリとウィジェットで同じ予定が違う色になる。
private func rgb(_ hex: String) -> (Double, Double, Double) {
    let s = hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    let v = UInt64(s, radix: 16) ?? 0x8A8A8A
    return (Double((v >> 16) & 0xFF), Double((v >> 8) & 0xFF), Double(v & 0xFF))
}
private func plain(_ hex: String) -> Color {
    let (r, g, b) = rgb(hex)
    return Color(red: r / 255, green: g / 255, blue: b / 255)
}
private func toWhite(_ hex: String, _ t: Double) -> Color {
    let (r, g, b) = rgb(hex)
    return Color(red: (r + (255 - r) * t) / 255,
                 green: (g + (255 - g) * t) / 255,
                 blue: (b + (255 - b) * t) / 255)
}
private func toBlack(_ hex: String, _ t: Double) -> Color {
    let (r, g, b) = rgb(hex)
    return Color(red: r * (1 - t) / 255, green: g * (1 - t) / 255, blue: b * (1 - t) / 255)
}

let INK = Color(red: 0.149, green: 0.145, blue: 0.122)
let INK_MUT = Color(red: 0.549, green: 0.533, blue: 0.486)
let INK_FAINT = Color(red: 0.718, green: 0.702, blue: 0.651)
let LINE = Color(red: 0.902, green: 0.886, blue: 0.839)
let BG = Color(red: 0.984, green: 0.984, blue: 0.992)
let UNDECIDED = Color(red: 0.545, green: 0.478, blue: 0.722)   // 用事の藤色
let SUMI = Color(red: 0.353, green: 0.341, blue: 0.314)        // 月の点を色なしにするとき用
// 当日の印は、アプリと同じく「数字を丸で囲う」。丸はその日の色（日曜・祝日は赤、
// 土曜は青、ほかは墨）で塗り、数字は白。アプリとウィジェットで今日の見え方が
// 違うと、同じカレンダーに見えない。
// 丸は数字の後ろに敷くだけ（background）にして、マスの高さは取らない。
// 高さを取ると、予定の点や帯が下へ押し出される。

// 祝日と日曜は赤、土曜は青。アプリの月表示と同じ色。
let HOLIDAY_RED = Color(red: 0.706, green: 0.271, blue: 0.227)
let SATURDAY_BLUE = Color(red: 0.239, green: 0.431, blue: 0.612)

// MARK: - 日付

// 暦は西暦に固定する。iPhone の設定で和暦にしていると、"yyyy" が「0008」
// （令和8年）になり、アプリが書いた "2026-..." と合わずに毎日「予定なし」になる。
private let keyFormatter: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.calendar = Calendar(identifier: .gregorian)
    f.dateFormat = "yyyy-MM-dd"
    return f
}()
private let WD = ["日", "月", "火", "水", "木", "金", "土"]

private func dayKey(_ d: Date) -> String { keyFormatter.string(from: d) }
private func addDays(_ d: Date, _ n: Int) -> Date {
    Calendar.current.date(byAdding: .day, value: n, to: d) ?? d
}
private func weekday(_ d: Date) -> String {
    WD[Calendar.current.component(.weekday, from: d) - 1]
}
/// "HH:MM" を、その日の0時からの分にする。"24:00" は 1440（その日の終わり）。
/// 読めない形は nil（その予定は「終わらない」扱いになり、先頭から外れないだけで済む）
private func clockMinutes(_ s: String?) -> Int? {
    guard let s = s else { return nil }
    let parts = s.split(separator: ":")
    guard parts.count >= 2,
          let h = Int(parts[0]), let m = Int(parts[1]),
          h >= 0, h <= 24, m >= 0, m < 60 else { return nil }
    return h * 60 + m
}

// MARK: - 画面に出すかたち

struct Ahead {
    let w: String      // 曜日
    let d: Int         // 日
    let item: Item
    var inDays: Int = 0   // 今日から何日後か。1 なら「明日」と書ける
    var short: String { w }
    var long: String { "\(w) \(d)日" }
    /// 「明日」か「水 12日」。今日が終わったあとに次の1件を出すときに使う
    var dayLabel: String { inDays == 1 ? "明日" : long }
}
struct MonthCell {
    let day: Int?          // その月の日。前後の空きは nil
    let isToday: Bool
    let dots: [Item]       // その日の予定（3つまで出す）
}
/// ロック画面の「次の1件」。今日の残りがあればそれ、無ければこの先の1件
struct NextUp {
    let item: Item
    let text: String       // 「14:00 定例」／「明日 9:30 朝会」
}

struct Entry: TimelineEntry {
    let date: Date
    let today: [Item]             // 終わっていないもの → 終わったもの（past）の順
    let ahead: [Ahead]            // この先の予定（決まっているかは問わない）
    let undecidedAhead: [Ahead]   // この先の、まだ決まっていないもの
    let weekUndecided: Int        // 「今週 まだ○件」に使う
    let monthWeekdays: [String]
    let month: [MonthCell]
    let dayNum: Int             // 今日の日
    let dayWeek: String         // 今日の曜日
    let dayColor: Int           // 0=ふつう 1=赤（祝日・日曜） 2=青（土曜）
    let monthLabel: String      // 「8月」
    let loaded: Bool
    var holDays: Set<Int> = []  // 今月の祝日の日。大のカレンダーで赤くする
    var weekStart: Int = 0      // 週のはじまり（0=日曜）。大のカレンダーの曜日の色に使う

    // 終わった予定は「まだ」に数えない。夜になっても朝の未定が残って見えるのは困る
    var undecided: Int { today.filter { !$0.solid && !$0.past }.count }
    /// 先頭の1件は、まだ終わっていないもの。終わったものは後ろに回してある
    var head: Item? { today.first(where: { !$0.past }) }
    var rest: [Item] { head != nil && today.count > 1 ? Array(today.dropFirst()) : [] }
    /// 今日の予定が全部終わった
    var allDone: Bool { !today.isEmpty && today.allSatisfy { $0.past } }
    var next: NextUp? {
        if let h = head { return NextUp(item: h, text: "\(h.time) \(h.n)") }
        if let a = ahead.first {
            return NextUp(item: a.item, text: "\(a.dayLabel) \(a.item.time) \(a.item.n)")
        }
        return nil
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { build(Date()) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(build(Date()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        // 今日の予定が終わる時刻ごとに、描き直しを先に並べておく。
        // 並べておくだけなので、描き直しの回数の枠（リロードの予算）は食わない。
        // 日付が変わったら描き直す。中身が変わったときはアプリ側から起こす。
        let cal = Calendar.current
        let now = Date()
        let payload = load()
        let startOfToday = cal.startOfDay(for: now)
        let tomorrow = cal.startOfDay(for: addDays(now, 1))

        var ends: [Date] = []
        if let p = payload, let items = p.days[dayKey(now)] {
            for it in items {
                guard let end = it.endMin,
                      let at = cal.date(byAdding: .minute, value: end, to: startOfToday),
                      at > now, at < tomorrow else { continue }
                if !ends.contains(at) { ends.append(at) }
            }
        }
        ends.sort()

        var entries: [Entry] = [build(now, payload)]
        for at in ends { entries.append(build(at, payload)) }
        entries.append(build(tomorrow, payload))
        completion(Timeline(entries: entries, policy: .after(tomorrow)))
    }

    private func load() -> Payload? {
        guard let store = UserDefaults(suiteName: APP_GROUP),
              let json = store.string(forKey: STORE_KEY),
              let data = json.data(using: .utf8),
              let p = try? JSONDecoder().decode(Payload.self, from: data) else { return nil }
        return p
    }

    private func build(_ now: Date) -> Entry { build(now, load()) }

    private func build(_ now: Date, _ loaded: Payload?) -> Entry {
        let cal = Calendar.current
        guard let p = loaded else {
            return Entry(date: now, today: [], ahead: [], undecidedAhead: [],
                         weekUndecided: 0, monthWeekdays: WD, month: [],
                         dayNum: cal.component(.day, from: now), dayWeek: weekday(now),
                         dayColor: 0, monthLabel: "\(cal.component(.month, from: now))月",
                         loaded: false)
        }

        // 今日。終わった予定は後ろへ回して、past を付ける（薄く出す）。
        // 並びそのものはアプリの順（終日→時刻順）のまま。終わったかどうかで2つに分けるだけ
        let nowMin = cal.component(.hour, from: now) * 60 + cal.component(.minute, from: now)
        var upcoming: [Item] = []
        var done: [Item] = []
        let todays: [Item] = p.days[dayKey(now)] ?? []
        for it in todays {
            if let end = it.endMin, end <= nowMin {
                var d = it
                d.past = true
                done.append(d)
            } else {
                upcoming.append(it)
            }
        }
        let today = upcoming + done

        // この先の予定。「このあと」と「まだ決まっていない」の2本を作る
        var ahead: [Ahead] = []
        var undecidedAhead: [Ahead] = []
        var i = 1
        while i <= 21 && (ahead.count < 3 || undecidedAhead.count < 3) {
            let d = addDays(now, i)
            if let items = p.days[dayKey(d)] {
                let w = weekday(d), dd = cal.component(.day, from: d)
                for it in items {
                    if ahead.count < 3 { ahead.append(Ahead(w: w, d: dd, item: it, inDays: i)) }
                    if !it.solid && undecidedAhead.count < 3 {
                        undecidedAhead.append(Ahead(w: w, d: dd, item: it, inDays: i))
                    }
                }
            }
            i += 1
        }

        // 今週。週のはじまりは設定に合わせる
        let offset = (cal.component(.weekday, from: now) - 1 - p.weekStart + 7) % 7
        let first = addDays(now, -offset)
        var undecided = 0
        for k in 0..<7 {
            let items = p.days[dayKey(addDays(first, k))] ?? []
            undecided += items.filter { !$0.solid }.count
        }

        // 今月のマス。前後の空きも入れて、7の倍数にそろえる
        var month: [MonthCell] = []
        if let firstOfMonth = cal.date(from: cal.dateComponents([.year, .month], from: now)),
           let range = cal.range(of: .day, in: .month, for: now) {
            let last = range.count
            let off = (cal.component(.weekday, from: firstOfMonth) - 1 - p.weekStart + 7) % 7
            let rows = Int(ceil(Double(off + last) / 7.0))
            for idx in 0..<(rows * 7) {
                let n = idx - off + 1
                if n < 1 || n > last {
                    month.append(MonthCell(day: nil, isToday: false, dots: []))
                } else {
                    let d = addDays(firstOfMonth, n - 1)
                    month.append(MonthCell(day: n,
                                           isToday: cal.isDate(d, inSameDayAs: now),
                                           dots: p.days[dayKey(d)] ?? []))
                }
            }
        }
        let weekdays = (0..<7).map { WD[($0 + p.weekStart) % 7] }
        // 今月の祝日の日
        var holDays = Set<Int>()
        if let firstOfMonth = cal.date(from: cal.dateComponents([.year, .month], from: now)),
           let range = cal.range(of: .day, in: .month, for: now) {
            for n in 1...range.count where (p.hol ?? []).contains(dayKey(addDays(firstOfMonth, n - 1))) { holDays.insert(n) }
        }

        // 今日の日付の色。祝日と日曜は赤、土曜は青
        let wd = cal.component(.weekday, from: now) - 1
        let isHoliday = (p.hol ?? []).contains(dayKey(now))
        let dayColor = (isHoliday || wd == 0) ? 1 : (wd == 6 ? 2 : 0)

        return Entry(date: now, today: today, ahead: ahead, undecidedAhead: undecidedAhead,
                     weekUndecided: undecided,
                     monthWeekdays: weekdays, month: month,
                     dayNum: cal.component(.day, from: now), dayWeek: weekday(now),
                     dayColor: dayColor, monthLabel: "\(cal.component(.month, from: now))月",
                     loaded: true, holDays: holDays, weekStart: p.weekStart)
    }
}

// MARK: - 部品

/// 予定ひとつ。塗り＝決まっている、点線＝まだ。
/// 終わった予定（past）は薄くする。消さないのは「今日は何があったか」も一目で分かるように
struct Pill: View {
    let item: Item
    var height: CGFloat = 22
    var body: some View {
        HStack(spacing: 5) {
            Text(item.time)
                .font(.system(size: 9.5))
                .foregroundColor(toBlack(item.c, 0.66))
            Text(item.n)
                .font(.system(size: 10.5))
                .foregroundColor(toBlack(item.c, 0.66))
                .lineLimit(1)
                .truncationMode(.tail)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 7)
        .frame(height: height)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 5)
                .fill(item.solid ? toWhite(item.c, 0.32) : toWhite(item.c, 0.62))
        )
        .overlay(
            Group {
                if !item.solid {
                    RoundedRectangle(cornerRadius: 5)
                        .strokeBorder(plain(item.c),
                                      style: StrokeStyle(lineWidth: 1.5, dash: [3, 2.5]))
                }
            }
        )
        .opacity(item.past ? 0.45 : 1)
    }
}

/// 畳んだ行の左に置く、塗り／点線の小さな印
struct Mark: View {
    let item: Item
    var body: some View {
        Group {
            if item.solid {
                RoundedRectangle(cornerRadius: 2.5).fill(plain(item.c))
            } else {
                RoundedRectangle(cornerRadius: 2).fill(toWhite(item.c, 0.62))
                    .overlay(RoundedRectangle(cornerRadius: 2)
                        .strokeBorder(plain(item.c),
                                      style: StrokeStyle(lineWidth: 1.2, dash: [2.4, 1.8])))
            }
        }
        .frame(width: 12, height: 7.5)
    }
}

/// 上の1段目。どの日でも同じ場所に置く
struct Head: View {
    let entry: Entry
    let long: Bool
    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(INK_MUT)
                .tracking(0.4)
            Spacer(minLength: 4)
            if entry.undecided > 0 {
                Text("まだ \(entry.undecided)件")
                    .font(.system(size: 10.5))
                    .foregroundColor(UNDECIDED)
            }
        }
    }
    private var label: String {
        let cal = Calendar.current
        let m = cal.component(.month, from: entry.date)
        let d = cal.component(.day, from: entry.date)
        let w = weekday(entry.date)
        return long ? "\(m)月\(d)日（\(w)）" : "\(m)/\(d) \(w)"
    }
}

/// 持ち物の1行
struct MemoLine: View {
    let text: String
    var body: some View {
        HStack(alignment: .top, spacing: 5) {
            Circle().fill(INK_FAINT).frame(width: 3.6, height: 3.6).padding(.top, 5)
            Text(text).font(.system(size: 10.5)).foregroundColor(INK)
                .lineLimit(1).truncationMode(.tail)
            Spacer(minLength: 0)
        }
    }
}

/// 「このあと」の1行
struct AheadLine: View {
    let a: Ahead
    var long: Bool = false
    var body: some View {
        HStack(spacing: 8) {
            Text(long ? a.long : a.short)
                .font(.system(size: 10)).foregroundColor(INK_FAINT)
                .frame(width: long ? 46 : 16, alignment: .leading)
            Pill(item: a.item)
        }
    }
}

/// 予定なしの日。空白にせず、今週の残りを出す
struct Empty: View {
    let entry: Entry
    let big: CGFloat
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(entry.loaded ? "予定なし" : "アプリを一度開いてください")
                .font(.system(size: big, weight: .light))
                .foregroundColor(INK)
            if entry.loaded && entry.weekUndecided > 0 {
                Text("今週 まだ\(entry.weekUndecided)件")
                    .font(.system(size: 10)).foregroundColor(INK_MUT)
                Text("決まっていません")
                    .font(.system(size: 10)).foregroundColor(INK_MUT)
            }
        }
    }
}

// MARK: - 月のミニカレンダー

/// 数字の下に点を置く。塗りの点＝決まった予定、輪＝まだのもの。
/// 5pt の点線は潰れて読めないので、点線ではなく輪で表す。
/// 1日に両方あるときは「●○」と並ぶので、どちらを優先するかを決めずに済む。
struct MonthGrid: View {
    let weekdays: [String]
    let cells: [MonthCell]
    var rowH: CGFloat = 20
    var dotR: CGFloat = 2.4
    var numSize: CGFloat = 10
    var colored: Bool = true

    private var rows: Int { max(1, cells.count / 7) }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(Array(weekdays.enumerated()), id: \.offset) { _, w in
                    Text(w).font(.system(size: 8)).foregroundColor(INK_FAINT)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.bottom, 2)
            ForEach(0..<rows, id: \.self) { r in
                HStack(spacing: 0) {
                    ForEach(0..<7, id: \.self) { c in
                        cell(cells[r * 7 + c]).frame(maxWidth: .infinity)
                    }
                }
                .frame(height: rowH)
            }
        }
    }

    @ViewBuilder
    private func cell(_ m: MonthCell) -> some View {
        VStack(spacing: 2) {
            if let d = m.day {
                // 今日は数字を丸で囲う（アプリと同じ）。ここは土日・祝日を知らないので、丸は墨で塗る。
                // 丸は background なので行の高さは変わらず、下の点の位置もほかの日とそろう
                Text("\(d)")
                    .font(.system(size: numSize, weight: m.isToday ? .semibold : .regular))
                    .tracking(m.isToday ? -0.3 : 0)
                    .foregroundColor(m.isToday ? Color.white : (m.dots.isEmpty ? INK_FAINT : INK))
                    .background(Group {
                        if m.isToday {
                            Circle().fill(INK).frame(width: numSize + 4, height: numSize + 4)
                        }
                    })
                HStack(spacing: 1.6) {
                    ForEach(Array(m.dots.prefix(3).enumerated()), id: \.offset) { _, it in
                        if it.solid {
                            Circle()
                                .fill(colored ? plain(it.c) : SUMI)
                                .frame(width: dotR * 2, height: dotR * 2)
                        } else {
                            Circle()
                                .strokeBorder(colored ? plain(it.c) : SUMI, lineWidth: 1)
                                .frame(width: dotR * 2, height: dotR * 2)
                        }
                    }
                }
                .frame(height: dotR * 2)
            } else {
                Color.clear
            }
        }
    }
}

// MARK: - 小 158×158
//
// 日付を主役にする。小に出すのは今日のことだけ——この先の予定は入れない。
// 「今日、何時から？」に答えるのが小の役目で、先のことは中と大が持つ。
// ただし今日の予定が全部終わったら「今日はおしまい」と、次の1件だけを文字で出す。
// 夜に見たとき、終わった予定が並んでいても何の答えにもならないので。
//
// 積み上げ（158pt）：余白28 ＋ 日付のかたまり50 ＋ あき12 ＋ 予定2件×28
// 予定が3件以上ある日は、2件出して数を右上に添える（下に「ほか○件」を
// 置くと縦が足りない）。
//
// 日付の色は、祝日と日曜が赤、土曜が青。アプリの月表示と同じ。

struct BigDate: View {
    let entry: Entry
    var body: some View {
        HStack(alignment: .top, spacing: 7) {
            Text("\(entry.dayNum)")
                .font(.system(size: 46, weight: .light))
                .foregroundColor(color)
                .fixedSize()
            // 細い縦線をはさんで、曜日を縦に置く。日本のカレンダーの見慣れた形
            Rectangle().fill(LINE).frame(width: 1, height: 42).padding(.top, 4)
            VStack(alignment: .leading, spacing: -1) {
                ForEach(Array(Array("\(entry.dayWeek)曜日").enumerated()), id: \.offset) { _, ch in
                    Text(String(ch)).font(.system(size: 12)).foregroundColor(color)
                }
            }
            .padding(.top, 3)
        }
    }
    private var color: Color {
        entry.dayColor == 1 ? HOLIDAY_RED : entry.dayColor == 2 ? SATURDAY_BLUE : INK
    }
}

struct SmallView: View {
    let entry: Entry
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 4) {
                BigDate(entry: entry)
                Spacer(minLength: 0)
                // 件数は右上に小さく。3件以上あっても、下に行を足さずに済む
                VStack(alignment: .trailing, spacing: 1) {
                    if entry.today.count > 2 {
                        Text("\(entry.today.count)件")
                            .font(.system(size: 10)).foregroundColor(INK_MUT)
                    }
                    if entry.undecided > 0 {
                        Text("まだ \(entry.undecided)")
                            .font(.system(size: 10)).foregroundColor(UNDECIDED)
                    }
                }
                .padding(.top, 2)
            }

            if let head = entry.head {
                VStack(alignment: .leading, spacing: 4) {
                    Pill(item: head, height: 24)
                    // 持ち物があれば、2件目の予定の代わりに出す。
                    // 大きい日付を入れたぶん、2件目と持ち物の両方は入らない。
                    // 行ごとに並べる縦の余裕も無いので、1行にまとめる。
                    if let memo = head.m, !memo.isEmpty {
                        HStack(alignment: .top, spacing: 5) {
                            Circle().fill(INK_FAINT).frame(width: 3, height: 3).padding(.top, 5)
                            Text(memo.prefix(4).joined(separator: "・"))
                                .font(.system(size: 10.5)).foregroundColor(INK)
                                .lineLimit(1).truncationMode(.tail)
                        }
                    } else if let second = entry.rest.first {
                        Pill(item: second, height: 24)
                    }
                }
                .padding(.top, 12)
            } else if entry.allDone {
                VStack(alignment: .leading, spacing: 4) {
                    Text("今日はおしまい")
                        .font(.system(size: 14)).foregroundColor(INK_MUT)
                    if let a = entry.ahead.first {
                        Text("\(a.dayLabel) \(a.item.time) \(a.item.n)")
                            .font(.system(size: 10.5)).foregroundColor(INK)
                            .lineLimit(1).truncationMode(.tail)
                    }
                }
                .padding(.top, 16)
            } else {
                Text(entry.loaded ? "今日の予定なし" : "アプリを開いてください")
                    .font(.system(size: 14)).foregroundColor(INK_MUT)
                    .padding(.top, 16)
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - 中 338×158
//
// 左は「今日、何時から？」——1日に何度も浮かぶ問い。だから読み始めの位置に置く。
// 右は「その日、空いてる？」——週に数回の問い。埋め草ではなく、空き状況を
// 圧縮したもの。月は必ず31日あるので、予定が少ない日でも空白にならない。

struct MediumView: View {
    let entry: Entry
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Head(entry: entry, long: true)
                if let head = entry.head {
                    Pill(item: head, height: 26)
                    if let memo = head.m, !memo.isEmpty {
                        VStack(alignment: .leading, spacing: 3) {
                            ForEach(Array(memo.prefix(2).enumerated()), id: \.offset) { _, m in
                                MemoLine(text: m)
                            }
                        }
                    } else if !entry.rest.isEmpty {
                        ForEach(Array(entry.rest.prefix(2).enumerated()), id: \.offset) { _, it in
                            Pill(item: it, height: 22)
                        }
                        if entry.rest.count > 2 {
                            Text("ほか \(entry.rest.count - 2)件")
                                .font(.system(size: 9.5)).foregroundColor(INK_FAINT)
                        }
                    } else if let a = entry.ahead.first {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("このあと").font(.system(size: 9))
                                .foregroundColor(INK_FAINT).tracking(0.6)
                            Text("\(a.long)　\(a.item.time) \(a.item.n)")
                                .font(.system(size: 10.5)).foregroundColor(INK_MUT).lineLimit(1)
                        }
                    }
                } else if entry.allDone {
                    // 今日の予定は全部終わった。終わったものを並べるより、次の1件を出す
                    Text("今日はおしまい")
                        .font(.system(size: 17, weight: .light)).foregroundColor(INK)
                    if let a = entry.ahead.first {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("このあと").font(.system(size: 9))
                                .foregroundColor(INK_FAINT).tracking(0.6)
                            Text("\(a.dayLabel)　\(a.item.time) \(a.item.n)")
                                .font(.system(size: 10.5)).foregroundColor(INK_MUT).lineLimit(1)
                        }
                    }
                } else {
                    Empty(entry: entry, big: 17)
                    if let a = entry.ahead.first {
                        Text("このあと　\(a.long)　\(a.item.n)")
                            .font(.system(size: 10)).foregroundColor(INK_FAINT).lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(width: 134, alignment: .leading)

            MonthGrid(weekdays: entry.monthWeekdays, cells: entry.month,
                      rowH: 20, dotR: 2.4, numSize: 10)
        }
    }
}

// MARK: - 大 364×382
//
// **カレンダーがそのまま見える**大きさ。アプリの月表示と同じで、マスの中に予定の名前を
// 塗り（決まった）と点線（まだ）で並べる。小と中が「今日と、この先」を答えるのに対して、
// 大は「今月がどう見えているか」を答える。
//
// 日をまたぐ予定は、アプリと同じやり方でつなぐ：週ごとに、長い予定から先に段を決める。
// 同じ段に居続けるので、隣のマスと横一列につながる。帯の端は、その予定の初日／最終日の
// ときだけ丸める。途中で週が変わる側は切り落とし、「まだ続く」を形で言う。
// 1週に段は3つまで、あふれた分はマスの下に「+○」。文字は 7.5pt。

/// 1本の帯。何列目から何列目まで、何段目か
struct Bar: Identifiable {
    let id: String
    let item: Item
    let c0: Int, c1: Int, lane: Int
    let startsHere: Bool, endsHere: Bool
}

struct MonthBar: View {
    let bar: Bar
    private var shape: UnevenRoundedRectangle {
        let r: CGFloat = 2.5
        return UnevenRoundedRectangle(topLeadingRadius: bar.startsHere ? r : 0, bottomLeadingRadius: bar.startsHere ? r : 0,
                                      bottomTrailingRadius: bar.endsHere ? r : 0, topTrailingRadius: bar.endsHere ? r : 0)
    }
    var body: some View {
        Text(bar.item.n)
            .font(.system(size: 7.5, weight: .medium))
            .foregroundColor(toBlack(bar.item.c, 0.66))
            .lineLimit(1).truncationMode(.tail)
            .padding(.horizontal, 3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(shape.fill(bar.item.solid ? toWhite(bar.item.c, 0.32) : toWhite(bar.item.c, 0.62)))
            .overlay(Group {
                if !bar.item.solid {
                    shape.strokeBorder(plain(bar.item.c), style: StrokeStyle(lineWidth: 1, dash: [2, 1.5]))
                }
            })
    }
}

/// 1週ぶん。帯の段をここで決める
struct WeekRow: View {
    let week: [MonthCell]
    let hol: Set<Int>
    let weekStart: Int
    static let pillH: CGFloat = 11, gap: CGFloat = 1.5, numH: CGFloat = 12, maxLanes = 3

    private struct Seg { var first: Item; var last: Item; var c0: Int; var c1: Int }

    /// 帯と、段に入りきらなかった数（列ごと）
    private var layout: (bars: [Bar], overflow: [Int]) {
        var ranges: [String: Seg] = [:]
        var order: [String] = []
        for (c, cell) in week.enumerated() {
            for (i, it) in cell.dots.enumerated() {
                // k が無い古い中身は、1日ずつ別の帯として扱う
                let base = it.k.flatMap { $0.isEmpty ? nil : $0 } ?? "\(c)-\(i)-\(it.n)"
                if var rg = ranges[base], rg.c1 == c - 1 {
                    rg.c1 = c; rg.last = it; ranges[base] = rg
                } else if ranges[base] == nil {
                    ranges[base] = Seg(first: it, last: it, c0: c, c1: c); order.append(base)
                } else {
                    let k2 = base + "#\(c)"
                    ranges[k2] = Seg(first: it, last: it, c0: c, c1: c); order.append(k2)
                }
            }
        }
        // 長い帯から。同じ長さなら左から、同じ列なら時刻の早い順
        let sorted = order.sorted { a, b in
            let A = ranges[a]!, B = ranges[b]!
            if (A.c1 - A.c0) != (B.c1 - B.c0) { return (A.c1 - A.c0) > (B.c1 - B.c0) }
            if A.c0 != B.c0 { return A.c0 < B.c0 }
            return (A.first.t ?? "") < (B.first.t ?? "")
        }
        var lanes: [[(Int, Int)]] = []
        var bars: [Bar] = []
        var overflow = [Int](repeating: 0, count: 7)
        for key in sorted {
            let rg = ranges[key]!
            var li = 0
            while li < lanes.count && lanes[li].contains(where: { rg.c0 <= $0.1 && rg.c1 >= $0.0 }) { li += 1 }
            if li >= WeekRow.maxLanes { for c in rg.c0...rg.c1 { overflow[c] += 1 }; continue }
            if li == lanes.count { lanes.append([]) }
            lanes[li].append((rg.c0, rg.c1))
            let pf = rg.first.p ?? 0, pl = rg.last.p ?? 0
            bars.append(Bar(id: key, item: rg.first, c0: rg.c0, c1: rg.c1, lane: li,
                            startsHere: pf == 0 || pf == 1, endsHere: pl == 0 || pl == 3))
        }
        return (bars, overflow)
    }

    var body: some View {
        let lay = layout
        return GeometryReader { g in
            let cw = g.size.width / 7
            ZStack(alignment: .topLeading) {
                HStack(spacing: 0) {
                    ForEach(0..<7, id: \.self) { c in
                        cellBase(week[c], dow: c, over: lay.overflow[c]).frame(width: cw, height: g.size.height, alignment: .topLeading)
                    }
                }
                ForEach(lay.bars) { b in
                    MonthBar(bar: b)
                        .frame(width: cw * CGFloat(b.c1 - b.c0 + 1) - 2, height: WeekRow.pillH)
                        .offset(x: cw * CGFloat(b.c0) + 1, y: WeekRow.numH + CGFloat(b.lane) * (WeekRow.pillH + WeekRow.gap))
                }
            }
        }
    }

    @ViewBuilder
    private func cellBase(_ m: MonthCell, dow: Int, over: Int) -> some View {
        // 数字は左上。帯がマスの左端から始まるので、数字も左に揃えないと「ずれて」見える。
        // 今日の印はアプリと同じく、数字をその日の色の丸で囲って数字を白にする。
        // 丸は数字の後ろに敷くだけ（高さは numH のまま）。今日だけ上の余白を詰めて、
        // 丸の下端が1段目の帯に食い込まないようにする
        ZStack(alignment: .topLeading) {
            if let d = m.day {
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(d)")
                        .font(.system(size: m.isToday ? 8.5 : 9, weight: m.isToday ? .semibold : .regular))
                        .tracking(m.isToday ? -0.3 : 0)
                        .foregroundColor(m.isToday ? Color.white : numColor(d, dow: dow))
                        .padding(.horizontal, 3).padding(.vertical, 1)
                        .background(Group {
                            if m.isToday {
                                Circle().fill(numColor(d, dow: dow)).frame(width: 12, height: 12)
                            }
                        })
                        .padding(.leading, 1).padding(.top, m.isToday ? 0 : 1)
                        .frame(height: WeekRow.numH, alignment: .topLeading)
                    Spacer(minLength: 0)
                    if over > 0 {
                        Text("+\(over)").font(.system(size: 7)).foregroundColor(INK_FAINT).padding(.leading, 2.5).padding(.bottom, 1)
                    }
                }
            }
        }
    }

    private func numColor(_ d: Int, dow: Int) -> Color {
        let wd = (weekStart + dow) % 7
        if hol.contains(d) || wd == 0 { return HOLIDAY_RED }
        if wd == 6 { return SATURDAY_BLUE }
        return INK
    }
}

struct MonthCalendar: View {
    let weekdays: [String]
    let cells: [MonthCell]
    let hol: Set<Int>
    let weekStart: Int
    private var rows: Int { max(1, cells.count / 7) }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(Array(weekdays.enumerated()), id: \.offset) { i, w in
                    Text(w).font(.system(size: 8)).foregroundColor(dowColor(i)).frame(maxWidth: .infinity)
                }
            }
            .padding(.bottom, 3)
            ForEach(0..<rows, id: \.self) { r in
                WeekRow(week: Array(cells[(r * 7)..<(r * 7 + 7)]), hol: hol, weekStart: weekStart)
                    .frame(maxHeight: .infinity)
                    .overlay(Rectangle().fill(LINE).frame(height: 0.5), alignment: .top)
            }
        }
    }

    // 曜日の色。日曜は赤、土曜は青。アプリの月表示と同じ
    private func dowColor(_ i: Int) -> Color {
        let dow = (weekStart + i) % 7
        return dow == 0 ? HOLIDAY_RED : dow == 6 ? SATURDAY_BLUE : INK_FAINT
    }
}

struct LargeView: View {
    let entry: Entry
    /// 今月の未定の数。今日の分（entry.undecided）ではなく月ぶん——大は月のカレンダーなので。
    /// 日をまたぐ予定は k で1つに数える（k が無い古い中身は日ごとに数える）
    private var monthUndecided: Int {
        var seen = Set<String>()
        var n = 0
        for (i, cell) in entry.month.enumerated() {
            for it in cell.dots where !it.solid {
                let key = it.k.flatMap { $0.isEmpty ? nil : $0 } ?? "\(i)-\(it.n)"
                if seen.insert(key).inserted { n += 1 }
            }
        }
        return n
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 上の1行：月と、まだの数だけ。今日は数字の丸で分かるので、日付は繰り返さない
            HStack(alignment: .firstTextBaseline) {
                Text(entry.monthLabel).font(.system(size: 14, weight: .semibold)).foregroundColor(INK)
                Spacer(minLength: 4)
                if monthUndecided > 0 {
                    Text("まだ \(monthUndecided)件").font(.system(size: 10.5)).foregroundColor(UNDECIDED)
                }
            }
            .padding(.bottom, 6)
            if !entry.loaded {
                Empty(entry: entry, big: 17).padding(.top, 12)
                Spacer(minLength: 0)
            } else {
                MonthCalendar(weekdays: entry.monthWeekdays, cells: entry.month,
                              hol: entry.holDays, weekStart: entry.weekStart)
            }
        }
    }
}

// MARK: - ロック画面
//
// ロック画面は単色（色は明るさにしか残らない）。だから決まった／まだの見分けは
// 形だけで言う：塗りの角丸＝決まった、点線の角丸＝まだ。ホーム画面の予定の形と同じ。
// 色は .primary / .secondary だけを使い、どの壁紙の上でもシステムに染めてもらう。

/// ロック画面用の、塗り／点線の小さな印。Mark と同じ考えで、色だけ .primary にしたもの
struct LockMark: View {
    let solid: Bool
    var body: some View {
        Group {
            if solid {
                RoundedRectangle(cornerRadius: 2.5).fill(Color.primary)
            } else {
                RoundedRectangle(cornerRadius: 2.5)
                    .strokeBorder(Color.primary, style: StrokeStyle(lineWidth: 1.3, dash: [2.4, 1.8]))
            }
        }
        .frame(width: 12, height: 8)
    }
}

/// 長方形：1行目に次の1件、2行目に今日の数
struct LockRectView: View {
    let entry: Entry
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let n = entry.next {
                HStack(spacing: 5) {
                    LockMark(solid: n.item.solid)
                    Text(n.text)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1).truncationMode(.tail)
                }
                Text(summary)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            } else {
                Text(entry.loaded ? "予定なし" : "アプリを開いてください")
                    .font(.system(size: 13, weight: .semibold))
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
    // 「まだ」があればそれを先に言う。無ければ今日の数。
    // 0件や全部終わった日に「今日 0件」「今日 3件」と出しても答えにならないので、言い方を変える
    private var summary: String {
        if entry.undecided > 0 { return "まだ \(entry.undecided)件" }
        if entry.today.isEmpty { return "今日は予定なし" }
        if entry.allDone { return "今日はおしまい" }
        return "今日 \(entry.today.count)件"
    }
}

/// 丸：数だけ。「まだ」があればその数、無ければ今日の数
struct LockCircleView: View {
    let entry: Entry
    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: -1) {
                Text(entry.undecided > 0 ? "まだ" : "今日")
                    .font(.system(size: 10))
                Text("\(entry.undecided > 0 ? entry.undecided : entry.today.count)")
                    .font(.system(size: 20, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
        }
    }
}

/// 時計の上の1行：文字だけ（ここは1行の文字しか出せない）
struct LockInlineView: View {
    let entry: Entry
    var body: some View {
        Text(line)
    }
    private var line: String {
        if let n = entry.next { return n.text }
        return entry.loaded ? "今日の予定なし" : "アプリを開いてください"
    }
}

// MARK: - 入り口

struct RootView: View {
    @Environment(\.widgetFamily) var family
    var entry: Entry
    var body: some View {
        // ホーム画面は地の色と余白をこちらで持つ。ロック画面は地も余白も付けない
        // （システムが壁紙の上に置く。地を塗ると、単色の表示で四角い板が浮く）
        Group {
            switch family {
            case .accessoryRectangular:
                LockRectView(entry: entry)
                    .containerBackground(for: .widget) { Color.clear }
            case .accessoryCircular:
                LockCircleView(entry: entry)
                    .containerBackground(for: .widget) { Color.clear }
            case .accessoryInline:
                LockInlineView(entry: entry)
                    .containerBackground(for: .widget) { Color.clear }
            default:
                home
                    .containerBackground(BG, for: .widget)
            }
        }
    }

    private var home: some View {
        Group {
            switch family {
            case .systemSmall:  SmallView(entry: entry)
            case .systemLarge:  LargeView(entry: entry)
            default:            MediumView(entry: entry)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(family == .systemLarge ? 16 : 14)
    }
}

@main
struct KimatteruWidget: Widget {
    let kind = "KimatteruWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            // 地の色は RootView で大きさごとに付ける（ロック画面には付けない）
            RootView(entry: entry)
        }
        .configurationDisplayName("LUKKO")
        .description("今日の予定と、まだ決まっていないものが出ます。ロック画面にも置けます。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge,
                            .accessoryRectangular, .accessoryCircular, .accessoryInline])
        // iOS 17 から中身に自動で余白が付く。こちらで持っているので二重になる
        .contentMarginsDisabled()
    }
}
