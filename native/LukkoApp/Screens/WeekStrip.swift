import SwiftUI
import LukkoKit

/// 週表示（Web 版の WeekStrip）。日を横一列に並べて、指で流す（iPhone 標準のカレンダーの週表示と同じ動き）。
/// ・1 画面に 7 日。離すと日の区切りに止まる。払えば何日も進む
/// ・上の曜日・日付・終日の段は、縦に送っても残る。左の時刻は、横に流しても残る
/// ・流し終わって 160ms たったら、いちばん左に見えている日を覚える（weekAnchor。見出しの月もそれで決まる）
struct WeekStripView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        // 最初の位置は中身が決める（weekAnchor があればそこ、今月なら今日の週、ほかの月はその月 1 日の週）
        WeekStripBody(initialFirst: model.core.weekFirst())
    }
}

/// 横の位置（左の端からどれだけ流したか）。見出しだけがこれを見て動く（本体を描き直さない）
@Observable final class WeekScrollX {
    var x: CGFloat = 0
}

private struct WeekScrollKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

struct WeekStripBody: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    /// 並べる範囲の真ん中。この前後 pad 日を並べる（見えている所だけ作るので、長くても軽い）。範囲の外へ移ったら並べ直す
    @State private var center: Int
    /// いちばん左に見えている日
    @State private var leading: Int?
    @State private var scroll = WeekScrollX()
    @State private var settleWork: DispatchWorkItem?
    /// 最初の位置に合わせ終わったか（それまでは「流し終わった」を拾わない）
    @State private var placed = false
    static let pad = 370
    static let gutter = CGFloat(WeekCore.gutter)
    static let hourH = CGFloat(DayCore.hourH)

    init(initialFirst: Int) {
        _center = State(initialValue: initialFirst)
        _leading = State(initialValue: initialFirst)
    }

    /// 縦の最初の位置（Web 版の weekStartTop）
    private func startTop(_ first: Int) -> CGFloat {
        let cols = (first..<(first + 7)).map { model.core.weekCol($0, over: model.overlayFor($0 - 1, $0 + 1), dark: model.dark) }
        return CGFloat(model.core.weekStartTop(cols))
    }

    var body: some View {
        let first = model.core.weekFirst()
        let lo = center - Self.pad, hi = center + Self.pad
        GeometryReader { geo in
            let colW = max(30, (geo.size.width - Self.gutter) / 7)
            // 終日の段の高さ：いま見えているあたり（前後 1 週）でいちばん多い日に合わせる（流すたびに高さが変わらないように）
            let near = ((first - 7)...(first + 13)).map { model.core.weekCol($0, dark: model.dark, withBoxes: false).allDay }
            VStack(spacing: 0) {
                WeekStripHeader(lo: lo, hi: hi, colW: colW, maxPills: near.map { $0.pills.count }.max() ?? 0,
                                anyMore: near.contains { $0.more > 0 }, scroll: scroll)
                ScrollViewReader { proxy in
                    ScrollView(.vertical, showsIndicators: false) {
                        ZStack(alignment: .topLeading) {
                        // 最初に見せる高さ（朝 7 時あたり。見えている 7 日にもっと早い予定があればそこから）
                        VStack(spacing: 0) {
                            Color.clear.frame(width: 1, height: startTop(first))
                            Color.clear.frame(width: 1, height: 1).id("week.top")
                        }
                        HStack(alignment: .top, spacing: 0) {
                            WeekHourGutter()
                                .frame(width: Self.gutter, height: Self.hourH * 24)
                            ScrollView(.horizontal, showsIndicators: false) {
                                LazyHStack(spacing: 0) {
                                    ForEach(lo...hi, id: \.self) { n in
                                        WeekDayColumn(n: n)
                                            .frame(width: colW, height: Self.hourH * 24)
                                    }
                                }
                                .scrollTargetLayout()
                                .background(GeometryReader { g in
                                    Color.clear.preference(key: WeekScrollKey.self, value: g.frame(in: .named("week.h")).minX)
                                })
                            }
                            .coordinateSpace(name: "week.h")
                            .scrollTargetBehavior(.viewAligned)
                            .scrollPosition(id: $leading, anchor: .leading)
                            .modifier(WeekScrollTrack { x in scroll.x = x })
                        }
                        }
                    }
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            proxy.scrollTo("week.top", anchor: .top)
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { placed = true }
                        }
                    }
                }
            }
        }
        // ‹ ›・今日などで、いちばん左の日が変わった：そこまで滑らかに流す。範囲の外なら並べ直す
        .onChange(of: first) { _, f in
            guard leading != f else { return }
            if abs(f - center) > Self.pad - 30 {
                center = f
                leading = f
            } else {
                withAnimation(.smooth(duration: 0.35)) { leading = f }
            }
        }
        // 流し終わった（160ms 動かなかった）：いちばん左に見えている日を覚える
        .onChange(of: leading) { _, n in
            settleWork?.cancel()
            guard let n, placed else { return }
            let w = DispatchWorkItem { [model] in model.act { $0.weekSettle(n) } }
            settleWork = w
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.16, execute: w)
        }
    }
}

/// 上の段：曜日と日付（押すとその日の画面）と、終日の予定。横の位置は本体に合わせて動く
struct WeekStripHeader: View {
    let lo: Int, hi: Int
    let colW: CGFloat
    let maxPills: Int, anyMore: Bool
    let scroll: WeekScrollX
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let x = scroll.x
        let core = model.core
        let dark = model.dark
        let es = core.evScale()
        let i0 = Int((-x / max(1, colW)).rounded(.down))
        let days = Array(max(lo, lo + i0 - 1)...min(hi, lo + i0 + 8))
        let cols = Dictionary(uniqueKeysWithValues: days.map { ($0, core.weekCol($0, dark: dark, withBoxes: false)) })
        let pillH = CGFloat(JS.round(17 * es))
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                Color.clear.frame(width: WeekStripBody.gutter, height: 50)
                ZStack(alignment: .topLeading) {
                    ForEach(days, id: \.self) { n in
                        if let c = cols[n] {
                            WeekHeadCell(c: c)
                                .frame(width: colW)
                                .offset(x: CGFloat(n - lo) * colW + x)
                        }
                    }
                }
                .frame(width: colW * 7, height: 50, alignment: .topLeading)
                .clipped()
            }
            if maxPills > 0 || anyMore {
                HStack(alignment: .top, spacing: 0) {
                    Text("終日").font(.system(size: 9)).foregroundStyle(ink("ink-faint")).fixedSize()
                        .padding(.top, 3).padding(.leading, 3)
                        .frame(width: WeekStripBody.gutter, alignment: .topLeading)
                    ZStack(alignment: .topLeading) {
                        ForEach(days, id: \.self) { n in
                            if let c = cols[n] {
                                WeekAllDayCell(c: c, pillH: pillH)
                                    .frame(width: colW, alignment: .topLeading)
                                    .offset(x: CGFloat(n - lo) * colW + x)
                            }
                        }
                    }
                    .frame(width: colW * 7, height: CGFloat(maxPills) * (pillH + 2) + (anyMore ? 13 : 0), alignment: .topLeading)
                    .clipped()
                }
                .padding(.top, 3).padding(.bottom, 1)
                .overlay(alignment: .top) { Rectangle().fill(ink("line")).frame(height: 1) }
            }
        }
        .background(ink("bg"))
        .overlay(alignment: .bottom) { Rectangle().fill(ink("line")).frame(height: 1) }
    }
}

/// 列の見出し：曜日と日付。今日は曜日色の丸で白抜き。押すとその日の画面へ
struct WeekHeadCell: View {
    let c: WeekView.Col
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        Button { model.act { $0.weekOpenDay(c.n) } } label: {
            VStack(spacing: 2) {
                Text(c.dow).font(.system(size: 10, weight: .semibold)).foregroundStyle(ink.css(c.dowColor))
                if let bg = c.numBg {
                    Text("\(c.d)").font(.system(size: 13, weight: .bold)).monospacedDigit().foregroundStyle(ink.css(c.numColor))
                        .frame(minWidth: 24, minHeight: 24).background(ink.css(bg), in: Capsule())
                } else {
                    Text("\(c.d)").font(.system(size: 14)).monospacedDigit().foregroundStyle(ink.css(c.numColor))
                        .frame(minHeight: 24)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.top, 4).padding(.bottom, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(c.m + 1)月\(c.d)日（\(c.dow)）")
        .accessibilityIdentifier("week.head.\(c.m + 1)-\(c.d)")
    }
}

/// 列の終日の予定（2 件まで＋「+N」）。押すとその予定
struct WeekAllDayCell: View {
    let c: WeekView.Col
    let pillH: CGFloat
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            ForEach(Array(c.allDay.pills.enumerated()), id: \.offset) { _, p in
                WeekAllDayPill(title: p.title, style: p.style, height: pillH)
                    .onTapGesture { model.act { $0.openFor(p.ev, "month") } }
            }
            if c.allDay.more > 0 {
                Text("+\(c.allDay.more)").font(.system(size: 9)).foregroundStyle(ink("ink-mut")).padding(.leading, 2)
            }
        }
        .padding(.horizontal, 1)
    }
}

/// 終日の予定の札（決まった＝塗り、まだ＝点線）
struct WeekAllDayPill: View {
    let title: String
    let style: [String: JSONValue]
    let height: CGFloat
    @Environment(\.ink) private var ink

    var body: some View {
        Text(title).font(.system(size: style["fontSize"]?.number ?? 10)).lineLimit(1).truncationMode(.tail)
            .foregroundStyle(ink.css(style["color"]?.string))
            .padding(.horizontal, 4)
            .frame(maxWidth: .infinity, alignment: .leading).frame(height: height)
            .background(ink.css(style["background"]?.string), in: RoundedRectangle(cornerRadius: 4))
            .overlay {
                if let b = style["border"]?.string {
                    RoundedRectangle(cornerRadius: 4).strokeBorder(ink.css(String(b.split(separator: " ").last ?? "")), style: StrokeStyle(lineWidth: 1.3, dash: [3, 2]))
                }
            }
    }
}

/// 左の時刻（0 時は空、1〜23）
struct WeekHourGutter: View {
    @Environment(\.ink) private var ink
    var body: some View {
        ZStack(alignment: .topTrailing) {
            ink("bg")
            ForEach(1..<24, id: \.self) { h in
                Text("\(h)").font(.system(size: 9.5)).monospacedDigit().foregroundStyle(ink("ink-faint"))
                    .padding(.trailing, 4)
                    .offset(y: CGFloat(h) * WeekStripBody.hourH - 6)
            }
        }
    }
}

/// 1 日の列：時刻の線・予定の箱・今の時刻の赤い線。何もない所を押すと、その時刻（30 分単位）から新しい予定
struct WeekDayColumn: View {
    let n: Int
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let c = model.core.weekCol(n, over: model.overlayFor(n - 1, n + 1), dark: model.dark)
        let H = WeekStripBody.hourH
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                (c.isToday ? ink("today-bg") : Color.clear)
                    .contentShape(Rectangle())
                    .onTapGesture(coordinateSpace: .local) { pt in
                        let minute = Int((pt.y / max(1, H * 24) * 48).rounded(.down)) * 30
                        model.act { $0.weekOpenNew(n, minute: max(0, min(1410, minute))) }
                    }
                WeekHourLines()
                    .allowsHitTesting(false)
                ForEach(c.boxes, id: \.key) { b in
                    WeekGridBox(b: b, width: geo.size.width)
                }
                if c.isToday { WeekNowLine(width: geo.size.width) }
            }
        }
        .overlay(alignment: .leading) { Rectangle().fill(ink("line-faint")).frame(width: 1).allowsHitTesting(false) }
    }
}

/// 時刻の線（0 時の上は引かない）
struct WeekHourLines: View {
    @Environment(\.ink) private var ink
    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<24, id: \.self) { h in
                VStack(spacing: 0) {
                    Rectangle().fill(h == 0 ? Color.clear : ink("line-faint")).frame(height: 1)
                    Spacer(minLength: 0)
                }
                .frame(height: WeekStripBody.hourH)
            }
        }
    }
}

/// 時刻の目盛りの上の箱 1 つ（週表示と、日の「時間」表示で同じ）。重なりは列に分ける
struct WeekGridBox: View {
    let b: DayCore.Box
    let width: CGFloat
    var from: JSONValue = "month"
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let cols = CGFloat(max(1, b.cols))
        let st = b.style
        let fs = st["fontSize"]?.number ?? 10.5
        let border = st["border"]?.string
        VStack(alignment: .leading, spacing: 0) {
            Text(b.title).font(.system(size: fs, weight: .medium)).lineLimit(1).truncationMode(.tail)
                .strikethrough(st["textDecoration"] == "line-through")
            if !b.time.isEmpty {
                Text(b.time).font(.system(size: 9.5)).monospacedDigit().opacity(0.8).lineLimit(1)
            }
        }
        .foregroundStyle(ink.css(st["color"]?.string))
        .padding(.horizontal, 4).padding(.vertical, 2)
        .frame(width: max(0, width / cols - 2), height: CGFloat(st["height"]?.number ?? 16), alignment: .topLeading)
        .background(ink.css(st["background"]?.string), in: RoundedRectangle(cornerRadius: 5))
        .overlay {
            if let border {
                RoundedRectangle(cornerRadius: 5).strokeBorder(ink.css(String(border.split(separator: " ").last ?? "")),
                                                               style: StrokeStyle(lineWidth: border.hasPrefix("1.5px") ? 1.5 : 1, dash: border.contains("dashed") ? [4, 3] : []))
            }
            if st["borderLeft"] != nil {
                HStack(spacing: 0) { Rectangle().fill(ink("ink-faint")).frame(width: 2.5); Spacer(minLength: 0) }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 5))
        .offset(x: width * CGFloat(b.col) / cols + 1, y: CGFloat(st["top"]?.number ?? 0))
        .onTapGesture {
            // iPhone のカレンダーの予定（重ね表示）は押しても何もしない
            if JS.truthy(b.ev["overlay"]) { return }
            model.act { $0.openFor(b.ev, from) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}

/// 今の時刻の赤い線と点（1 分ごとに動く）
struct WeekNowLine: View {
    let width: CGFloat
    @Environment(\.ink) private var ink
    var body: some View {
        TimelineView(.everyMinute) { ctx in
            let p = Calendar.current.dateComponents([.hour, .minute], from: ctx.date)
            let top = CGFloat((p.hour ?? 0) * 60 + (p.minute ?? 0)) / 60 * WeekStripBody.hourH
            ZStack(alignment: .leading) {
                Rectangle().fill(ink("sun")).frame(width: width + 3, height: 1.5)
                Circle().fill(ink("sun")).frame(width: 7, height: 7).offset(x: -1)
            }
            .offset(x: -3, y: top - 3.5)
            .allowsHitTesting(false)
        }
    }
}

/// 横に流した量を見張る（iOS 18 からは ScrollView の位置そのもの、それより前は中身の位置）
struct WeekScrollTrack: ViewModifier {
    let onChange: (CGFloat) -> Void
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.onScrollGeometryChange(for: CGFloat.self, of: { $0.contentOffset.x + $0.contentInsets.leading }) { _, x in onChange(-x) }
        } else {
            content.onPreferenceChange(WeekScrollKey.self) { x in onChange(x) }
        }
    }
}
