//
//  KimatteruWidget.swift
//  決まってる？のウィジェット
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
    let n: String       // 名前
    let c: String       // 種類の色
    let s: Int          // 1 = 決まっている（塗り）／0 = まだ（点線）
    let m: [String]?    // 持ち物
    var solid: Bool { s == 1 }
    var time: String { t ?? "終日" }
}

struct Payload: Decodable {
    let weekStart: Int
    let days: [String: [Item]]
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

// MARK: - 日付

private let keyFormatter: DateFormatter = {
    let f = DateFormatter()
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

// MARK: - 画面に出すかたち

struct Ahead {
    let when: String
    let item: Item
}
struct Day {
    let w: String
    let d: Int
    let isToday: Bool
    let marks: [Item]
}

struct Entry: TimelineEntry {
    let date: Date
    let today: [Item]
    let ahead: [Ahead]
    let week: [Day]
    let weekUndecided: Int
    let loaded: Bool

    var undecided: Int { today.filter { !$0.solid }.count }
    var head: Item? { today.first }
    var rest: [Item] { today.count > 1 ? Array(today.dropFirst()) : [] }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry { build(Date()) }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(build(Date()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        // 日付が変わったら描き直す。中身が変わったときはアプリ側から起こす。
        let tomorrow = Calendar.current.startOfDay(for: addDays(Date(), 1))
        completion(Timeline(entries: [build(Date())], policy: .after(tomorrow)))
    }

    private func load() -> Payload? {
        guard let store = UserDefaults(suiteName: APP_GROUP),
              let json = store.string(forKey: STORE_KEY),
              let data = json.data(using: .utf8),
              let p = try? JSONDecoder().decode(Payload.self, from: data) else { return nil }
        return p
    }

    private func build(_ now: Date) -> Entry {
        guard let p = load() else {
            return Entry(date: now, today: [], ahead: [], week: [], weekUndecided: 0, loaded: false)
        }
        let today = p.days[dayKey(now)] ?? []

        // このあと。今日より先で、予定のある日から順に3件まで
        var ahead: [Ahead] = []
        var i = 1
        while i <= 14 && ahead.count < 3 {
            let d = addDays(now, i)
            if let items = p.days[dayKey(d)] {
                for it in items where ahead.count < 3 {
                    ahead.append(Ahead(when: weekday(d), item: it))
                }
            }
            i += 1
        }

        // 今週。週のはじまりは設定に合わせる
        let cal = Calendar.current
        let offset = (cal.component(.weekday, from: now) - 1 - p.weekStart + 7) % 7
        let first = addDays(now, -offset)
        var week: [Day] = []
        var undecided = 0
        for k in 0..<7 {
            let d = addDays(first, k)
            let items = p.days[dayKey(d)] ?? []
            undecided += items.filter { !$0.solid }.count
            week.append(Day(w: weekday(d),
                            d: cal.component(.day, from: d),
                            isToday: cal.isDate(d, inSameDayAs: now),
                            marks: items))
        }
        return Entry(date: now, today: today, ahead: ahead, week: week,
                     weekUndecided: undecided, loaded: true)
    }
}

// MARK: - 部品

/// 予定ひとつ。塗り＝決まっている、点線＝まだ。
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
    var body: some View {
        HStack(spacing: 8) {
            Text(a.when).font(.system(size: 10)).foregroundColor(INK_FAINT)
                .frame(width: 16, alignment: .leading)
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

/// 今週の並び。1日3件まで印を出す
struct Week: View {
    let days: [Day]
    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                VStack(spacing: 3) {
                    Text(day.w).font(.system(size: 8.5))
                        .foregroundColor(day.isToday ? INK : INK_FAINT)
                    Text("\(day.d)")
                        .font(.system(size: 12, weight: day.isToday ? .semibold : .regular))
                        .foregroundColor(day.isToday ? INK : INK_MUT)
                        .frame(width: 20, height: 20)
                        .overlay(Circle().stroke(day.isToday ? LINE : Color.clear, lineWidth: 1.2))
                    VStack(spacing: 2.5) {
                        ForEach(Array(day.marks.prefix(3).enumerated()), id: \.offset) { _, m in
                            if m.solid {
                                RoundedRectangle(cornerRadius: 2.5)
                                    .fill(plain(m.c)).frame(width: 14, height: 5)
                            } else {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(toWhite(m.c, 0.62)).frame(width: 14, height: 5)
                                    .overlay(RoundedRectangle(cornerRadius: 2)
                                        .strokeBorder(plain(m.c),
                                                      style: StrokeStyle(lineWidth: 1.2, dash: [2.5, 2])))
                            }
                        }
                    }
                    .frame(height: 22, alignment: .top)
                }
                .frame(maxWidth: .infinity)
            }
        }
    }
}

// MARK: - 小 158×158

struct SmallView: View {
    let entry: Entry
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Head(entry: entry, long: false)
            if let head = entry.head {
                Pill(item: head, height: 26)
                if let memo = head.m, !memo.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(Array(memo.prefix(3).enumerated()), id: \.offset) { _, m in
                            MemoLine(text: m)
                        }
                    }
                    // 残りの予定は1行に畳む。塗り／点線の印だけは残す
                    if let next = entry.rest.first {
                        HStack(spacing: 6) {
                            Mark(item: next)
                            Text("\(next.time) \(next.n)")
                                .font(.system(size: 10)).foregroundColor(INK_MUT)
                                .lineLimit(1)
                            Spacer(minLength: 0)
                            if entry.rest.count > 1 {
                                Text("＋\(entry.rest.count - 1)")
                                    .font(.system(size: 9.5)).foregroundColor(INK_FAINT)
                            }
                        }
                    }
                } else {
                    ForEach(Array(entry.rest.prefix(2).enumerated()), id: \.offset) { _, it in
                        Pill(item: it, height: 26)
                    }
                    if entry.rest.count > 2 {
                        Text("ほか \(entry.rest.count - 2)件")
                            .font(.system(size: 9.5)).foregroundColor(INK_FAINT)
                    }
                }
            } else {
                Empty(entry: entry, big: 15)
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - 中 338×158

struct MediumView: View {
    let entry: Entry
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Head(entry: entry, long: true)
            if let head = entry.head {
                if let memo = head.m, !memo.isEmpty {
                    Pill(item: head, height: 26)
                    HStack(alignment: .top, spacing: 14) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("持ちもの").font(.system(size: 9))
                                .foregroundColor(INK_FAINT).tracking(0.6)
                            ForEach(Array(memo.prefix(4).enumerated()), id: \.offset) { _, m in
                                MemoLine(text: m)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        VStack(alignment: .leading, spacing: 4) {
                            if !entry.rest.isEmpty {
                                Text("このあと").font(.system(size: 9))
                                    .foregroundColor(INK_FAINT).tracking(0.6)
                                ForEach(Array(entry.rest.prefix(2).enumerated()), id: \.offset) { _, it in
                                    Pill(item: it)
                                }
                                if entry.rest.count > 2 {
                                    Text("ほか \(entry.rest.count - 2)件")
                                        .font(.system(size: 9.5)).foregroundColor(INK_FAINT)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else {
                    ForEach(Array(entry.today.prefix(4).enumerated()), id: \.offset) { _, it in
                        Pill(item: it, height: 24)
                    }
                    if entry.today.count > 4 {
                        Text("ほか \(entry.today.count - 4)件")
                            .font(.system(size: 10)).foregroundColor(INK_FAINT)
                    } else if let a = entry.ahead.first {
                        HStack(spacing: 6) {
                            Text("このあと").font(.system(size: 9.5))
                                .foregroundColor(INK_FAINT).tracking(0.6)
                            Text("\(a.when)　\(a.item.time) \(a.item.n)")
                                .font(.system(size: 10.5)).foregroundColor(INK_MUT).lineLimit(1)
                        }
                    }
                }
            } else {
                Empty(entry: entry, big: 19)
                if let a = entry.ahead.first {
                    HStack(spacing: 6) {
                        Text("このあと").font(.system(size: 9.5)).foregroundColor(INK_FAINT)
                        Text("\(a.when)　\(a.item.time) \(a.item.n)")
                            .font(.system(size: 10.5)).foregroundColor(INK_MUT).lineLimit(1)
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - 大 338×354

struct LargeView: View {
    let entry: Entry
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Head(entry: entry, long: true)
            Week(days: entry.week).padding(.top, 10)
            Rectangle().fill(LINE).frame(height: 1).padding(.top, 8)

            if entry.today.isEmpty {
                Empty(entry: entry, big: 17).padding(.top, 14)
            } else {
                Text("今日").font(.system(size: 10)).foregroundColor(INK_MUT)
                    .tracking(0.6).padding(.top, 12)
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(entry.today.prefix(5).enumerated()), id: \.offset) { _, item in
                        Pill(item: item, height: 24)
                        if let memo = item.m, !memo.isEmpty {
                            HStack(alignment: .top, spacing: 6) {
                                RoundedRectangle(cornerRadius: 1).fill(LINE)
                                    .frame(width: 1.5, height: 12).padding(.leading, 7)
                                Text(memo.prefix(4).joined(separator: "・"))
                                    .font(.system(size: 10)).foregroundColor(INK_MUT).lineLimit(1)
                            }
                        }
                    }
                    if entry.today.count > 5 {
                        Text("ほか \(entry.today.count - 5)件")
                            .font(.system(size: 10)).foregroundColor(INK_FAINT)
                    }
                }
                .padding(.top, 6)
            }

            // 下が空くなら、先の予定で埋める
            if entry.today.count <= 4 && !entry.ahead.isEmpty {
                Text("このあと").font(.system(size: 10)).foregroundColor(INK_MUT)
                    .tracking(0.6).padding(.top, 14)
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(entry.ahead.prefix(3).enumerated()), id: \.offset) { _, a in
                        AheadLine(a: a)
                    }
                }
                .padding(.top, 6)
            }
            Spacer(minLength: 0)
        }
    }
}

// MARK: - 入り口

struct RootView: View {
    @Environment(\.widgetFamily) var family
    var entry: Entry
    var body: some View {
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
            RootView(entry: entry)
                .containerBackground(BG, for: .widget)
        }
        .configurationDisplayName("決まってる？")
        .description("今日の予定と、まだ決まっていないものが出ます。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
        // iOS 17 から中身に自動で余白が付く。こちらで持っているので二重になる
        .contentMarginsDisabled()
    }
}
