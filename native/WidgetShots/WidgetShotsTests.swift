import XCTest
import SwiftUI
import LukkoKit

/// ストア画像のための、ウィジェットの絵。本物のウィジェットの部品（KimatteruWidget.swift）をそのまま使い、
/// アプリと同じ作り方の中身（WidgetCore.buildPayload → App Group の JSON）から描く。
/// 見本の予定は StoreShots と同じ「学生の 1 か月」。今日は 20 日（バイトとレポート締切がある日）にする
@MainActor
final class WidgetShotsTests: XCTestCase {
    private typealias E = (d: Int, t: String, ty: String, st: String, s: String, e: String, all: Bool, days: Int, cand: String)
    private let month: [E] = [
        (3, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (5, "ゼミ", "yoji", "kakutei", "13:00", "14:30", false, 1, ""),
        (6, "飲み会", "asobi", "mikakutei", "19:00", "21:00", false, 1, "k1"),
        (7, "飲み会", "asobi", "mikakutei", "19:00", "21:00", false, 1, "k1"),
        (8, "飲み会", "asobi", "mikakutei", "19:00", "21:00", false, 1, "k1"),
        (9, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (10, "旅行", "asobi", "mikakutei", "00:00", "23:59", true, 2, ""),
        (12, "歯医者", "yoji", "mikakutei", "10:00", "11:00", false, 1, ""),
        (13, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (14, "美容院", "yoji", "kakutei", "11:00", "12:30", false, 1, ""),
        (15, "シフト希望", "baito", "mikakutei", "17:00", "22:00", false, 1, ""),
        (16, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (17, "映画", "asobi", "kakutei", "18:30", "21:00", false, 1, ""),
        (19, "面接", "yoji", "mikakutei", "15:00", "16:00", false, 1, ""),
        (20, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (20, "レポート締切", "other", "kakutei", "00:00", "23:59", true, 1, ""),
        (21, "ライブ", "asobi", "kakutei", "18:00", "21:00", false, 1, ""),
        (23, "シフト希望", "baito", "mikakutei", "17:00", "22:00", false, 1, ""),
        (24, "誕生日会", "asobi", "mikakutei", "19:00", "22:00", false, 1, ""),
        (26, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
        (27, "健康診断", "yoji", "kakutei", "09:00", "10:00", false, 1, ""),
        (28, "ごはん", "asobi", "mikakutei", "19:00", "21:00", false, 1, ""),
        (30, "バイト", "baito", "kakutei", "17:00", "22:00", false, 1, ""),
    ]

    private func attach(_ view: some View, _ name: String) {
        let r = ImageRenderer(content: view)
        r.scale = 3
        guard let img = r.uiImage else { return XCTFail("\(name) が描けない") }
        let a = XCTAttachment(image: img)
        a.name = name
        a.lifetime = .keepAlways
        add(a)
    }

    /// ホーム画面のウィジェット（地の色・余白・角丸は RootView と同じ）
    private func home(_ content: some View, _ w: CGFloat, _ h: CGFloat, large: Bool = false) -> some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(large ? 16 : 14)
            .frame(width: w, height: h)
            .background(BG)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .environment(\.colorScheme, .light)
    }
    /// ロック画面のウィジェット（白い文字。地は付けない）
    private func lock(_ content: some View, _ w: CGFloat, _ h: CGFloat) -> some View {
        content
            .frame(width: w, height: h)
            .environment(\.colorScheme, .dark)
            .foregroundStyle(.white)
    }

    func testWidgetShots() throws {
        let cal = Calendar(identifier: .gregorian)
        var c = cal.dateComponents([.year, .month], from: Date())
        c.day = 20; c.hour = 9; c.minute = 41
        let now = cal.date(from: c)!
        let ms = (now.timeIntervalSince1970 * 1000).rounded(.down)
        let y = c.year!, m = c.month! - 1

        let evs: [JSONValue] = month.enumerated().map { i, e in
            var o: [String: JSONValue] = ["id": .string("st\(i)"), "y": .number(Double(y)), "m": .number(Double(m)), "day": .number(Double(e.d)),
                                          "start": .string(e.s), "end": .string(e.e), "title": .string(e.t), "type": .string(e.ty),
                                          "status": .string(e.st), "updatedAt": 1]
            if e.all { o["allDay"] = true }
            if e.days > 1 { o["days"] = .number(Double(e.days)) }
            if !e.cand.isEmpty { o["candId"] = .string(e.cand) }
            return .object(o)
        }
        var st = Engine.defaultState(now: ms, tz: .current)
        st["events"] = .array(evs)
        let payload = WidgetCore.buildPayload(st, today: (y, m, 20), atMs: ms)
        let store = try XCTUnwrap(UserDefaults(suiteName: APP_GROUP))
        store.set(JSJSON.stringify(payload), forKey: STORE_KEY)

        let e = Provider().shotEntry(now)
        XCTAssertTrue(e.loaded, "ウィジェットの中身が読めない")
        // 大きさは 6.9 インチの iPhone のもの（pt）
        attach(home(SmallView(entry: e), 170, 170), "widget-small")
        attach(home(MediumView(entry: e), 364, 170), "widget-medium")
        attach(home(LargeView(entry: e), 364, 382, large: true), "widget-large")
        attach(lock(LockRectView(entry: e), 172, 76), "widget-lock-rect")
        attach(lock(LockCircleView(entry: e), 76, 76), "widget-lock-circle")
        attach(lock(LockInlineView(entry: e), 260, 24), "widget-lock-inline")
    }
}
