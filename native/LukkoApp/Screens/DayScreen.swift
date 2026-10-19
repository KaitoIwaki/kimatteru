import SwiftUI
import LukkoKit

/// 日の画面（Web 版の DAY）。上に大きな日付と一覧｜時間、その下に日付の帯。日を送ると中身が左右から滑り込む
struct DayScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    /// 見出しの日付・曜日・祝日（日付は fixedSize で必ず全部出す）
    private func dayHead(_ h: DayCore.Head, dow: Bool, holiday: Bool) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(h.bigDate).font(.system(size: 22, weight: .semibold)).tracking(-0.3).foregroundStyle(ink.css(h.dateColor)).fixedSize()
            if dow { Text(h.dowFull).font(.system(size: 13)).foregroundStyle(ink("ink-mut")).fixedSize() }
            if holiday && !h.holiday.isEmpty {
                Text(h.holiday).font(.system(size: 11, weight: .semibold)).foregroundStyle(Color(red: 0xB4 / 255, green: 0x45 / 255, blue: 0x3A / 255)).fixedSize()
            }
        }
    }

    var body: some View {
        let ym = model.state["ym"] ?? .null
        let Y = JS.int(ym["y"]), M = JS.int(ym["m"])
        let d = max(1, JS.int(model.state["dayNum"]))
        let dn = Civil.dayNo(Y, M, d)
        let v = model.core.dayView(Y, M, d, dark: model.dark)
        let dir = JS.int(model.state["dayDir"])
        VStack(spacing: 0) {
            DayStrip(selected: dn)
            ZStack {
                Group {
                    if v.head.view == "time" {
                        DayTimeView(y: Y, m: M, d: d)
                    } else {
                        DayList(head: v.head, rows: v.rows, y: Y, m: M, d: d)
                    }
                }
                .id(dn)
                .transition(.asymmetric(insertion: .offset(x: CGFloat(30 * dir)).combined(with: .opacity), removal: .opacity))
            }
            .animation(dir == 0 ? nil : .timingCurve(0.2, 0.9, 0.2, 1, duration: 0.22), value: dn)
            .frame(maxHeight: .infinity)
        }
        .background(ink("bg"))
        .navigationDestination(isPresented: Binding(get: { model.state["screen"] == "detail" && model.state["returnTo"] == "day" },
                                                    set: { on in if !on && model.state["screen"] == "detail" { model.act { $0.detailBack() } } })) { DetailScreen() }
        .navigationTitle(v.head.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            // 大きな日付・曜日・祝日
            ToolbarItem(placement: .principal) {
                // 日付は切らない（祝日の名前が入ると「10月1…」と切れていた）。入らなければ、曜日 → 祝日の順に外す
                ViewThatFits(in: .horizontal) {
                    dayHead(v.head, dow: true, holiday: true)
                    dayHead(v.head, dow: false, holiday: true)
                    dayHead(v.head, dow: false, holiday: false)
                }
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
            }
            ToolbarItem(placement: .topBarTrailing) {
                Picker("表示", selection: Binding(get: { v.head.view }, set: { k in model.act { $0.setDayView(k) } })) {
                    Text("一覧").tag("list")
                    Text("時間").tag("time")
                }
                .pickerStyle(.segmented)
                .frame(width: 100)
                .accessibilityIdentifier("day.viewSeg")
            }
        }
    }
}

/// 日付の帯（Web 版の DayDateStrip）。7 日で 1 画面、指で流して 1 日ずつ止まる。押すとその日へ。
/// 流しているあいだだけ、上の真ん中に見えている月、下にあとどれだけ流せるかのバーを出す
struct DayStrip: View {
    let selected: Int
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    /// 並べる範囲の真ん中の週のはじまり（前後 42 日、計 91 日）。範囲の外へ移ったら並べ直す
    @State private var center: Int?
    @State private var leading: Int?
    @State private var scroll = DayStripScroll()
    static let pad = 42
    static var len: Int { pad * 2 + 7 }

    private func weekStartOf(_ n: Int) -> Int {
        let o = Civil.fromDayNo(n)
        return TimeGrid.weekStartNo(o.y, o.m, o.d, JS.int(model.state["settings"]?["weekStart"]))
    }

    var body: some View {
        let c = center ?? weekStartOf(selected)
        let base = c - Self.pad
        let core = model.core
        GeometryReader { geo in
            let cw = max(30, geo.size.width / 7)
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 0) {
                    ForEach(base..<(base + Self.len), id: \.self) { n in
                        DayStripCellView(c: core.dayStripCell(n, selected: selected))
                            .frame(width: cw)
                            .contentShape(Rectangle())
                            .onTapGesture { model.act { $0.dayStripTap(n, selected: selected) } }
                    }
                }
                .scrollTargetLayout()
                .background(GeometryReader { g in
                    Color.clear.preference(key: DayStripScrollKey.self, value: g.frame(in: .named("day.strip")).minX)
                })
            }
            .coordinateSpace(name: "day.strip")
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition(id: $leading, anchor: .leading)
            .modifier(DayStripScrollTrack { x in scroll.moved(x, width: cw * CGFloat(Self.len - 7)) })
            // 流しているあいだだけ：見えている真ん中の日の月
            .overlay(alignment: .top) { DayStripMonthChip(base: base, cw: cw, scroll: scroll).offset(y: -6) }
        }
        .frame(height: 62)
        .padding(.horizontal, 12).padding(.top, 4)
        .overlay(alignment: .bottom) { DayStripBar(scroll: scroll).padding(.horizontal, 12).offset(y: 7) }
        .padding(.bottom, 12)
        .onAppear {
            // 並べ直したとき（最初）は、選んだ日の週を左の端に。バーは出さない
            let w0 = weekStartOf(selected)
            scroll.quiet(); center = w0; leading = w0
        }
        .onChange(of: selected) { _, sel in
            // 選んだ日が見えていなければ、その週まで流す。範囲の外なら、その週を真ん中に並べ直す
            let vis = leading ?? c
            if sel >= vis && sel <= vis + 6 { return }
            let nf = weekStartOf(sel)
            if nf >= base && nf <= base + Self.len - 7 {
                withAnimation(.smooth(duration: 0.3)) { leading = nf }
            } else {
                scroll.quiet(); center = nf; leading = nf
            }
        }
    }
}

/// 日付の帯の流れ具合（帯の上の月の札と、下のバーだけがこれを見て動く）
@Observable final class DayStripScroll {
    var x: CGFloat = 0
    /// 0〜1（いちばん左〜いちばん右）
    var pos: CGFloat = 0.5
    var active = false
    @ObservationIgnored private var quietUntil = Date.distantPast
    @ObservationIgnored private var hide: DispatchWorkItem?

    func quiet() { quietUntil = Date().addingTimeInterval(0.35) }
    func moved(_ x: CGFloat, width: CGFloat) {
        self.x = x
        pos = width > 0 ? min(1, max(0, -x / width)) : 0.5
        // 並べ直しで位置を合わせたときは出さない
        if Date() < quietUntil { return }
        if !active { withAnimation(.easeOut(duration: 0.12)) { active = true } }
        hide?.cancel()
        let w = DispatchWorkItem { [weak self] in withAnimation(.easeOut(duration: 0.4)) { self?.active = false } }
        hide = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9, execute: w)
    }
}

private struct DayStripScrollKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = nextValue() }
}

/// 帯の上の真ん中の黒い札（「11月」、今年以外は「2027年11月」）
struct DayStripMonthChip: View {
    let base: Int, cw: CGFloat
    let scroll: DayStripScroll
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    var body: some View {
        let mid = base + Int((-scroll.x / max(1, cw)).rounded()) + 3
        Text(model.core.dayStripCell(mid, selected: Int.min).monthFull)
            .font(.system(size: 11, weight: .semibold)).foregroundStyle(ink("card"))
            .padding(.horizontal, 10).padding(.vertical, 2)
            .background(ink("ink"), in: Capsule())
            .opacity(scroll.active ? 1 : 0)
            .allowsHitTesting(false)
    }
}

/// 帯の下の細いバー（帯の幅いっぱい。あとどれだけ流せるか）
struct DayStripBar: View {
    let scroll: DayStripScroll
    @Environment(\.ink) private var ink
    var body: some View {
        GeometryReader { g in
            let track = g.size.width
            let thumb = max(44, (track * 7 / CGFloat(DayStrip.len)).rounded())
            ZStack(alignment: .leading) {
                Capsule().fill(ink("line"))
                Capsule().fill(ink("ink-faint")).frame(width: thumb).offset(x: scroll.pos * (track - thumb))
            }
        }
        .frame(height: 3)
        .opacity(scroll.active ? 1 : 0)
        .allowsHitTesting(false)
    }
}

/// 帯の 1 日：曜日（その月の 1 日は「11月」）・日付（選んだ日＝墨の丸、今日＝墨の輪）・予定がある日に点
struct DayStripCellView: View {
    let c: DayCore.StripCell
    @Environment(\.ink) private var ink
    var body: some View {
        VStack(spacing: 3) {
            Text(c.monthHead.isEmpty ? c.dow : c.monthHead)
                .font(.system(size: 10, weight: c.monthHead.isEmpty ? .semibold : .bold))
                .foregroundStyle(c.monthHead.isEmpty ? ink.css(c.dowColor) : ink("ink"))
                .lineLimit(1).fixedSize()
            Text("\(c.date)").font(.system(size: 15, weight: c.sel ? .bold : c.today ? .semibold : .regular)).monospacedDigit()
                .foregroundStyle(ink.css(c.numColor))
                .frame(width: 32, height: 32)
                .background { if c.sel { Circle().fill(ink("ink")) } else if c.today { Circle().strokeBorder(ink("ink"), lineWidth: 1.5) } }
            Circle().fill(c.has && !c.sel ? ink("ink-faint") : .clear).frame(width: 4, height: 4)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(c.monthFull)\(c.date)日（\(c.dow)）")
        .accessibilityAddTraits(c.sel ? [.isButton, .isSelected] : .isButton)
    }
}

/// 一覧。予定のカード（左に開始／終了、種類の色の縦棒、題名・長さ・場所、右に状態の札）
struct DayList: View {
    let head: DayCore.Head
    let rows: [DayCore.Row]
    let y: Int, m: Int, d: Int
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink

    var body: some View {
        let dn = Civil.dayNo(y, m, d)
        let overlay = model.core.dayOverlayRows(model.overlayFor(dn, dn + 1))
        List {
            if !head.summary.isEmpty {
                Text(head.summary).font(.system(size: 12)).foregroundStyle(ink("ink-mut"))
                    .listRowBackground(Color.clear).listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 4, trailing: 20))
            }
            if head.empty {
                VStack(spacing: 8) {
                    Image(systemName: "calendar").font(.system(size: 34, weight: .light)).foregroundStyle(ink("ink-faint"))
                    Text("この日の予定はまだありません").font(.system(size: 14)).foregroundStyle(ink("ink-mut"))
                }
                .frame(maxWidth: .infinity).padding(.top, 44).padding(.bottom, 20)
                .listRowBackground(Color.clear).listRowSeparator(.hidden)
            }
            ForEach(rows, id: \.key) { r in
                if let gap = r.gapBefore {
                    // 予定と予定のあいだが 1 時間以上空いている
                    HStack(spacing: 8) {
                        DayDashLine()
                        Text(gap).font(.system(size: 11.5)).foregroundStyle(ink("ink-faint")).fixedSize()
                        DayDashLine()
                    }
                    .listRowBackground(Color.clear).listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 0, leading: 22, bottom: 4, trailing: 22))
                }
                DayCard(row: r)
                    .contentShape(RoundedRectangle(cornerRadius: 16))
                    .onTapGesture { open(r) }
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                    .accessibilityIdentifier("day.row.\(JS.string(r.key))")
                    .listRowBackground(Color.clear).listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 5, trailing: 16))
                    // 左に払うと削除（赤）
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) { model.act { e in e.haptic("light"); e.askDelete(r.key) } } label: { Label("削除", systemImage: "trash") }
                            .tint(Color(red: 0xB4 / 255, green: 0x45 / 255, blue: 0x3A / 255))
                    }
                    // 長押し：開く／編集／削除（後ろはぼかし、押した予定の札が浮く）
                    .contextMenu {
                        Button { open(r) } label: { Label("開く", systemImage: "arrow.up.forward.app") }
                        Button { edit(r) } label: { Label("編集", systemImage: "pencil") }
                        Button(role: .destructive) { model.act { $0.askDelete(r.key) } } label: { Label("削除", systemImage: "trash") }
                    } preview: {
                        DayCtxPreview(row: r).environment(\.ink, ink)
                    }
            }
            // 重ねて表示している iPhone のカレンダーの予定（直すのは元のアプリで）
            ForEach(Array(overlay.enumerated()), id: \.offset) { _, o in
                DayOverlayRowView(row: o)
                    .contentShape(Rectangle())
                    .onTapGesture { model.act { $0.tapOverlayRow() } }
                    .listRowBackground(Color.clear).listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 5, trailing: 16))
            }
            // 主役は「予定を追加」1 つ。時間を決めずにその日にすること（終日）は、下に小さく添える
            VStack(spacing: 4) {
                Button { model.act { $0.openNew(d, "day") } } label: {
                    Text("＋ 予定を追加").font(.system(size: 14.5)).foregroundStyle(ink("ink-soft"))
                        .frame(maxWidth: .infinity).padding(15)
                        .overlay(RoundedRectangle(cornerRadius: 15).strokeBorder(ink("line"), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4])))
                        .contentShape(RoundedRectangle(cornerRadius: 15))
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("予定を追加")
                Button { model.act { $0.openNew(d, "day", ["allDay": true]) } } label: {
                    Text("時間を決めずに入れる").font(.system(size: 13)).foregroundStyle(ink("ink-mut")).padding(.horizontal, 14).padding(.vertical, 10)
                }
                .buttonStyle(.borderless)
            }
            .padding(.top, 10)
            .listRowBackground(Color.clear).listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 40, trailing: 16))
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    private func event(_ r: DayCore.Row) -> [String: JSONValue]? {
        (model.state["events"]?.array ?? []).lazy.compactMap { $0.object }.first { $0["id"] == r.key }
    }
    private func open(_ r: DayCore.Row) {
        guard let ev = event(r) else { return }
        model.act { e in e.set(["swipeRow": .null]); e.openFor(ev, "day") }
    }
    private func edit(_ r: DayCore.Row) {
        guard let ev = event(r) else { return }
        model.act { $0.openEdit(ev, "day") }
    }
}

/// 点線の横線（空き時間の両脇）
struct DayDashLine: View {
    @Environment(\.ink) private var ink
    var body: some View {
        GeometryReader { g in
            Path { p in p.move(to: CGPoint(x: 0, y: g.size.height / 2)); p.addLine(to: CGPoint(x: g.size.width, y: g.size.height / 2)) }
                .stroke(ink("line"), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
        }
        .frame(height: 1)
    }
}

/// 長押ししたときに浮く札（色の線・題名・時刻）
struct DayCtxPreview: View {
    let row: DayCore.Row
    @Environment(\.ink) private var ink
    var body: some View {
        let t = row.startText + (row.endText.isEmpty ? "" : "–" + row.endText)
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 2).fill(ink.css(row.accent)).frame(width: 4)
            VStack(alignment: .leading, spacing: 2) {
                Text(row.titlePlain).font(.system(size: 16, weight: .semibold)).foregroundStyle(ink("ink")).lineLimit(1)
                if !t.isEmpty { Text(t).font(.system(size: 13)).monospacedDigit().foregroundStyle(ink("ink-mut")) }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
        .frame(width: 320)
        .fixedSize(horizontal: false, vertical: true)
        .background(ink("card"))
    }
}

/// iPhone のカレンダーの予定の行（薄く、右に「iPhone」）
struct DayOverlayRowView: View {
    let row: DayOverlayRow
    @Environment(\.ink) private var ink
    var body: some View {
        HStack(spacing: 12) {
            Text(row.time).font(.system(size: 13)).monospacedDigit().foregroundStyle(ink("ink-mut")).frame(width: 44, alignment: .leading)
                .lineLimit(1).minimumScaleFactor(0.7)
            RoundedRectangle(cornerRadius: 2).fill(ink("ink-faint")).frame(width: 4).frame(maxHeight: .infinity)
            VStack(alignment: .leading, spacing: 2) {
                Text(row.title).font(.system(size: 14)).foregroundStyle(ink("ink-soft")).lineLimit(1)
                if !row.place.isEmpty { Text(row.place).font(.system(size: 11.5)).foregroundStyle(ink("ink-mut")).lineLimit(1) }
            }
            Spacer(minLength: 0)
            Text("iPhone").font(.system(size: 10.5)).foregroundStyle(ink("ink-faint"))
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 15))
        .overlay(RoundedRectangle(cornerRadius: 15).strokeBorder(ink("line")))
        .opacity(0.85)
    }
}

/// 予定のカード 1 枚
struct DayCard: View {
    let row: DayCore.Row
    @Environment(\.ink) private var ink

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.startText).font(.system(size: 15, weight: .semibold)).monospacedDigit().foregroundStyle(ink("ink"))
                if !row.endText.isEmpty { Text(row.endText).font(.system(size: 12)).monospacedDigit().foregroundStyle(ink("ink-mut")) }
            }
            .lineLimit(1).minimumScaleFactor(0.75)
            .frame(width: 52, alignment: .leading)
            // 種類の色の縦棒（まだは点線）
            Group {
                if row.dashed {
                    DashedBar().stroke(ink.css(row.accent), style: StrokeStyle(lineWidth: 3, dash: [4, 3]))
                } else {
                    RoundedRectangle(cornerRadius: 2).fill(ink.css(row.bar))
                }
            }
            .frame(width: row.dashed ? 3 : 4)
            .frame(maxHeight: .infinity)
            VStack(alignment: .leading, spacing: 4) {
                Text(row.titlePlain.isEmpty ? row.titleText : row.titlePlain).font(.system(size: row.titleSize, weight: .medium)).foregroundStyle(ink.css(row.titleColor))
                    .strikethrough(row.titleDeco == "line-through").lineLimit(1)
                if row.durText != nil || !row.place.isEmpty {
                    HStack(spacing: 8) {
                        if let dur = row.durText { Text(dur).fixedSize() }
                        if !row.place.isEmpty {
                            HStack(spacing: 3) {
                                Image(systemName: "mappin.and.ellipse").font(.system(size: 10))
                                Text(row.place).lineLimit(1)
                            }
                        }
                    }
                    .font(.system(size: 12)).foregroundStyle(ink("ink-mut"))
                }
            }
            Spacer(minLength: 0)
            Text(row.statusWord).font(.system(size: 11))
                .foregroundStyle(ink.css(row.chip["color"]?.string))
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(ink.css(row.chip["background"]?.string), in: Capsule())
                .overlay {
                    if let b = row.chip["border"]?.string {
                        Capsule().strokeBorder(ink.css(String(b.split(separator: " ").last ?? "")), style: StrokeStyle(lineWidth: 1, dash: [3, 2]))
                    }
                }
                .lineLimit(1).fixedSize()
        }
        .padding(.leading, 16).padding(.trailing, 14).padding(.vertical, 13)
        .background(ink("card"), in: RoundedRectangle(cornerRadius: 16))
        .overlay {
            if row.dashed {
                RoundedRectangle(cornerRadius: 16).strokeBorder(ink.css(String(row.cardBorder.split(separator: " ").last ?? "")), style: StrokeStyle(lineWidth: 1.5, dash: [5, 3]))
            } else {
                RoundedRectangle(cornerRadius: 16).strokeBorder(ink("line"), lineWidth: 1)
            }
        }
    }
}

struct DashedBar: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: rect.midX, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
        return p
    }
}

/// 時間（目盛りの上に箱）。何もない時間を押すと、その時刻から予定を作る。
/// 最初は 8 時か、その日いちばん早い予定から（日を送ったときだけ合わせ直す）
struct DayTimeView: View {
    let y: Int, m: Int, d: Int
    @Environment(AppModel.self) private var model
    @Environment(\.ink) private var ink
    static let gutter: CGFloat = 40

    var body: some View {
        let core = model.core
        let hide = JS.truthy(model.state["settings"]?["hideCanceled"])
        let dn = Civil.dayNo(y, m, d)
        let pool = EventDayIndex.of(model.state["events"]?.array ?? []).overlapping(dn - 1, dn).filter { !(hide && $0["status"] == "nakunatta") }
        let allDay = core.timeGridAllDay(pool, y, m, d, dark: model.dark)
        let boxes = core.timeGridBoxes(pool, over: model.overlayFor(dn, dn + 1), y, m, d, dark: model.dark)
        let H = CGFloat(DayCore.hourH)
        let t = model.state["today"] ?? .null
        let isToday = dn == Civil.dayNo(JS.int(t["y"]), JS.int(t["m"]), JS.int(t["d"]))
        let es = model.evScale
        let startMin = boxes.reduce(8 * 60.0) { Swift.min($0, $1.a) }
        VStack(spacing: 0) {
            if !allDay.pills.isEmpty {
                HStack(alignment: .top, spacing: 0) {
                    Text("終日").font(.system(size: 9)).foregroundStyle(ink("ink-faint")).padding(.top, 3).padding(.leading, 3)
                        .frame(width: Self.gutter, alignment: .leading)
                    VStack(alignment: .leading, spacing: 2) {
                        ForEach(Array(allDay.pills.enumerated()), id: \.offset) { _, p in
                            WeekAllDayPill(title: p.title, style: p.style, height: CGFloat(JS.round(17 * es)))
                                .onTapGesture { model.act { $0.openFor(p.ev, "day") } }
                        }
                        if allDay.more > 0 { Text("+\(allDay.more)").font(.system(size: 9)).foregroundStyle(ink("ink-mut")).padding(.leading, 2) }
                    }
                    .padding(.horizontal, 1)
                }
                .padding(.top, 3).padding(.bottom, 1).padding(.trailing, 8)
                .overlay(alignment: .bottom) { Rectangle().fill(ink("line")).frame(height: 1) }
            }
            ScrollViewReader { proxy in
                ScrollView {
                    ZStack(alignment: .topLeading) {
                    // 最初に見せる高さ：8 時か、その日いちばん早い予定から（-12px）
                    VStack(spacing: 0) {
                        Color.clear.frame(width: 1, height: CGFloat(Swift.max(0, startMin / 60 * DayCore.hourH - 12)))
                        Color.clear.frame(width: 1, height: 1).id("day.top")
                    }
                    HStack(alignment: .top, spacing: 0) {
                        ZStack(alignment: .topTrailing) {
                            ForEach(1..<24, id: \.self) { h in
                                Text("\(h)").font(.system(size: 9.5)).monospacedDigit().foregroundStyle(ink("ink-faint"))
                                    .padding(.trailing, 4).offset(y: CGFloat(h) * H - 6)
                            }
                        }
                        .frame(width: Self.gutter, height: H * 24, alignment: .topTrailing)
                        GeometryReader { geo in
                            ZStack(alignment: .topLeading) {
                                Color.clear.contentShape(Rectangle())
                                    .onTapGesture(coordinateSpace: .local) { pt in
                                        let min = Int((pt.y / (H * 24) * 48).rounded(.down)) * 30
                                        model.act { $0.openNew(d, "day", ["y": .number(Double(y)), "m": .number(Double(m)), "start": .number(Double(max(0, min)))]) }
                                    }
                                WeekHourLines().allowsHitTesting(false)
                                ForEach(boxes, id: \.key) { b in
                                    WeekGridBox(b: b, width: geo.size.width, from: "day")
                                }
                                if isToday { WeekNowLine(width: geo.size.width) }
                            }
                        }
                        .frame(height: H * 24)
                        .overlay(alignment: .leading) { Rectangle().fill(ink("line-faint")).frame(width: 1).allowsHitTesting(false) }
                    }
                    }
                }
                .onAppear { DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { proxy.scrollTo("day.top", anchor: .top) } }
            }
        }
    }
}

/// 日付の帯を流した量を見張る（iOS 18 からは ScrollView の位置そのもの、それより前は中身の位置）
struct DayStripScrollTrack: ViewModifier {
    let onChange: (CGFloat) -> Void
    func body(content: Content) -> some View {
        if #available(iOS 18.0, *) {
            content.onScrollGeometryChange(for: CGFloat.self, of: { $0.contentOffset.x + $0.contentInsets.leading }) { _, x in onChange(-x) }
        } else {
            content.onPreferenceChange(DayStripScrollKey.self) { x in onChange(x) }
        }
    }
}
