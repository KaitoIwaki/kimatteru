#if DEBUG
import EventKit

/// 試験のときだけ：シミュレーターの iPhone のカレンダーに、取り込みの見本の予定を入れる（ストア画像の写真用）。
/// 起動の引数 -lukkoSeedPhoneCalendar のときだけ動く。リリースのビルドには入らない（#if DEBUG）
enum PhoneSeed {
    static func run() async {
        let store = EKEventStore()
        guard (try? await store.requestFullAccessToEvents()) == true, let cal = store.defaultCalendarForNewEvents else { return }
        let g = Calendar(identifier: .gregorian)
        let now = Date()
        var c = g.dateComponents([.year, .month], from: now)
        // [日, 名前, 始まり(時), 長さ(時), 終日]
        let items: [(Int, String, Int, Int, Bool)] = [
            (21, "サークル", 18, 2, false),
            (22, "ゼミ発表", 13, 2, false),
            (24, "仮）打ち合わせ", 15, 1, false),
            (25, "候補：旅行", 0, 0, true),
            (27, "サークル", 18, 2, false),
            (29, "歯医者", 10, 1, false),
            (30, "バイト", 17, 5, false),
        ]
        let start = g.date(from: c)!
        let end = g.date(byAdding: .month, value: 1, to: start)!
        let have = Set(store.events(matching: store.predicateForEvents(withStart: start, end: end, calendars: [cal])).compactMap { $0.title })
        for (d, title, h, len, all) in items where !have.contains(title) || title == "サークル" {
            c.day = d; c.hour = all ? 0 : h; c.minute = 0
            guard let s = g.date(from: c) else { continue }
            if store.events(matching: store.predicateForEvents(withStart: s, end: s.addingTimeInterval(3600 * 24), calendars: [cal])).contains(where: { $0.title == title }) { continue }
            let e = EKEvent(eventStore: store)
            e.calendar = cal; e.title = title; e.isAllDay = all
            e.startDate = s; e.endDate = all ? s : s.addingTimeInterval(Double(len) * 3600)
            try? store.save(e, span: .thisEvent)
        }
        try? store.commit()
    }
}
#endif
