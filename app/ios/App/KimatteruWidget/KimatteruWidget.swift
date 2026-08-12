//
//  KimatteruWidget.swift
//  決まってる？のウィジェット
//
//  第1段：まず「置ける」ことだけを確かめるための、いちばん簡単な中身。
//  共有の置き場からデータを読めているかどうかも、ここで見えるようにしてある。
//  配管が通ったのを確かめてから、絵のとおりの見た目を作る。
//

import WidgetKit
import SwiftUI

// アプリ側（widgetbridge.js）と同じ名前をそろえる。
let APP_GROUP = "group.com.kimatteru.app"
let STORE_KEY = "widget"

struct Entry: TimelineEntry {
    let date: Date
    let note: String
}

struct Provider: TimelineProvider {
    // ウィジェットを選ぶ画面に出る見本。データはまだ読まない
    func placeholder(in context: Context) -> Entry {
        Entry(date: Date(), note: "決まってる？")
    }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: Date(), note: read()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        let entry = Entry(date: Date(), note: read())
        // 次の日付が変わるところで描き直す。
        // 中身が変わったときはアプリ側から reloadAllTimelines() で起こす。
        let tomorrow = Calendar.current.startOfDay(for: Date().addingTimeInterval(86400))
        completion(Timeline(entries: [entry], policy: .after(tomorrow)))
    }

    /// 共有の置き場から読む。届いていなければ、そのことが分かる言葉を返す。
    private func read() -> String {
        guard let store = UserDefaults(suiteName: APP_GROUP) else {
            return "置き場を開けません"
        }
        guard let json = store.string(forKey: STORE_KEY) else {
            return "まだ何も届いていません"
        }
        guard let data = json.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let days = obj["days"] as? [String: Any] else {
            return "中身を読めません（\(json.count)文字）"
        }
        return "\(days.count)日ぶん届いています"
    }
}

struct KimatteruWidgetView: View {
    var entry: Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 2) {
                Text("✓").foregroundColor(Color(red: 0.11, green: 0.62, blue: 0.46))
                Text("？").foregroundColor(Color(white: 0.76))
            }
            .font(.system(size: 15, weight: .bold))

            Text("決まってる？")
                .font(.system(size: 13, weight: .regular))
                .foregroundColor(Color(white: 0.15))

            Text(entry.note)
                .font(.system(size: 11))
                .foregroundColor(Color(white: 0.55))
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(14)
    }
}

@main
struct KimatteruWidget: Widget {
    let kind = "KimatteruWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            // iOS 17 から、ウィジェットの中身に自動で余白が付く。
            // こちらで余白を持っているので二重になる。使える版でだけ切る。
            if #available(iOS 17.0, *) {
                KimatteruWidgetView(entry: entry)
                    .containerBackground(Color(red: 0.984, green: 0.984, blue: 0.992), for: .widget)
            } else {
                KimatteruWidgetView(entry: entry)
                    .background(Color(red: 0.984, green: 0.984, blue: 0.992))
            }
        }
        .configurationDisplayName("決まってる？")
        .description("今日の予定と、まだ決まっていないものが出ます。")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
